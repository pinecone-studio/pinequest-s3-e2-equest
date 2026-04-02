import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
  textbookChunks,
  textbookSections,
} from "@/db/schema";
import { getTextbookMaterialDetail } from "./repository";
import type {
  GetTextbookMaterialSelectionInput,
  StoredTextbookChunk,
  StoredTextbookSection,
  TextbookMaterialDetail,
  TextbookMaterialStructureDetail,
} from "./types";

type Database = DrizzleD1Database<typeof schema>;

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function serializeSection(row: typeof textbookSections.$inferSelect): StoredTextbookSection {
  return {
    id: row.id,
    materialId: row.materialId,
    parentId: row.parentId ?? null,
    nodeType: row.nodeType as StoredTextbookSection["nodeType"],
    title: row.title,
    normalizedTitle: row.normalizedTitle,
    orderIndex: safeNumber(row.orderIndex),
    depth: safeNumber(row.depth),
    startPage: row.startPage ?? null,
    endPage: row.endPage ?? null,
    childCount: safeNumber(row.childCount),
    pageNumbers: parseJsonArray<number>(row.pageNumbersJson).map((value) =>
      safeNumber(value),
    ),
    metadata: parseJsonRecord(row.metadataJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeChunk(row: typeof textbookChunks.$inferSelect): StoredTextbookChunk {
  return {
    id: row.id,
    materialId: row.materialId,
    sectionId: row.sectionId,
    chapterId: row.chapterId ?? null,
    subchapterId: row.subchapterId ?? null,
    chunkType: row.chunkType as StoredTextbookChunk["chunkType"],
    orderIndex: safeNumber(row.orderIndex),
    pageStart: row.pageStart ?? null,
    pageEnd: row.pageEnd ?? null,
    charCount: safeNumber(row.charCount),
    pageNumbers: parseJsonArray<number>(row.pageNumbersJson).map((value) =>
      safeNumber(value),
    ),
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getDirectPageNumbers(section: StoredTextbookSection) {
  const raw = section.metadata?.directPageNumbers;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1)
    .map((value) => Math.trunc(value));
}

function buildSectionMaps(sections: StoredTextbookSection[]) {
  const byId = new Map(sections.map((section) => [section.id, section] as const));
  const childrenByParent = new Map<string | null, StoredTextbookSection[]>();

  for (const section of sections) {
    const list = childrenByParent.get(section.parentId) || [];
    list.push(section);
    childrenByParent.set(section.parentId, list);
  }

  for (const list of childrenByParent.values()) {
    list.sort((left, right) => left.orderIndex - right.orderIndex);
  }

  return {
    byId,
    childrenByParent,
  };
}

function collectSectionSelection(
  sections: StoredTextbookSection[],
  input: GetTextbookMaterialSelectionInput,
) {
  const { byId, childrenByParent } = buildSectionMaps(sections);
  const subtreeIds = new Set<string>();
  const effectiveChunkSectionIds = new Set<string>();

  const visit = (section: StoredTextbookSection) => {
    subtreeIds.add(section.id);

    if (section.nodeType === "chapter") {
      for (const child of childrenByParent.get(section.id) || []) {
        visit(child);
      }
      return;
    }

    const children = childrenByParent.get(section.id) || [];
    const directPageNumbers = getDirectPageNumbers(section);
    const shouldIncludeSelf = directPageNumbers.length > 0 || children.length === 0;

    if (shouldIncludeSelf) {
      effectiveChunkSectionIds.add(section.id);
    }

    for (const child of children) {
      visit(child);
    }
  };

  const normalizedNodeIds = Array.from(
    new Set(
      (input.nodeIds || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  for (const nodeId of normalizedNodeIds) {
    const section = byId.get(nodeId) || null;
    if (!section) {
      continue;
    }
    visit(section);
  }

  return {
    effectiveChunkSectionIds: Array.from(effectiveChunkSectionIds),
    subtreeIds,
  };
}

export async function getTextbookMaterialStructure(
  db: Database,
  materialId: string,
): Promise<TextbookMaterialStructureDetail | null> {
  const detail = await getTextbookMaterialDetail(
    db,
    { materialId },
    { includeContent: false },
  );

  if (!detail) {
    return null;
  }

  const sectionRows = await db
    .select()
    .from(textbookSections)
    .where(eq(textbookSections.materialId, materialId))
    .orderBy(asc(textbookSections.depth), asc(textbookSections.orderIndex));

  return {
    material: detail.material,
    sections: sectionRows.map(serializeSection),
  };
}

export async function getTextbookMaterialSelection(
  db: Database,
  materialId: string,
  input: GetTextbookMaterialSelectionInput,
): Promise<TextbookMaterialDetail | null> {
  const structure = await getTextbookMaterialStructure(db, materialId);
  if (!structure) {
    return null;
  }

  const { effectiveChunkSectionIds, subtreeIds } = collectSectionSelection(
    structure.sections,
    input,
  );

  if (subtreeIds.size === 0) {
    return {
      material: structure.material,
      pages: [],
      sections: [],
      chunks: [],
    };
  }

  const chunks =
    effectiveChunkSectionIds.length > 0
      ? (
          await db
            .select()
            .from(textbookChunks)
            .where(
              and(
                eq(textbookChunks.materialId, materialId),
                inArray(textbookChunks.sectionId, effectiveChunkSectionIds),
              ),
            )
            .orderBy(asc(textbookChunks.orderIndex))
        ).map(serializeChunk)
      : [];

  return {
    material: structure.material,
    pages: [],
    sections: structure.sections.filter((section) => subtreeIds.has(section.id)),
    chunks,
  };
}
