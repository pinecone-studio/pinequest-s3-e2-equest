import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
  textbookChunks,
  textbookMaterials,
  textbookPages,
  textbookSections,
} from "@/db/schema";
import type {
  CreateTextbookMaterialInput,
  ReplaceTextbookStructureInput,
  StoredTextbookChunk,
  StoredTextbookMaterial,
  StoredTextbookPage,
  StoredTextbookSection,
  TextbookMaterialDetail,
  UpdateTextbookMaterialInput,
  UpsertTextbookPagesInput,
} from "./types";

type Database = DrizzleD1Database<typeof schema>;

function nowIso() {
  return new Date().toISOString();
}

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

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const warnings: string[] = [];
  for (const item of value) {
    const next = String(item ?? "").trim();
    if (!next || seen.has(next)) {
      continue;
    }
    seen.add(next);
    warnings.push(next);
  }
  return warnings;
}

function serializeMaterial(row: typeof textbookMaterials.$inferSelect): StoredTextbookMaterial {
  return {
    id: row.id,
    bucketName: row.bucketName,
    r2Key: row.r2Key,
    fileName: row.fileName,
    contentType: row.contentType ?? null,
    title: row.title ?? null,
    grade: row.grade ?? null,
    subject: row.subject ?? null,
    size: safeNumber(row.size),
    pageCount: safeNumber(row.pageCount),
    chapterCount: safeNumber(row.chapterCount),
    sectionCount: safeNumber(row.sectionCount),
    subchapterCount: safeNumber(row.subchapterCount),
    progressCurrent: safeNumber(row.progressCurrent),
    progressTotal: safeNumber(row.progressTotal),
    status: row.status as StoredTextbookMaterial["status"],
    stage: row.stage as StoredTextbookMaterial["stage"],
    statusMessage: row.statusMessage ?? null,
    errorMessage: row.errorMessage ?? null,
    warnings: parseJsonArray<string>(row.warningsJson),
    ocrNeededPageCount: safeNumber(row.ocrNeededPageCount),
    unsupportedReason: row.unsupportedReason ?? null,
    readyAt: row.readyAt ?? null,
    lastProcessedAt: row.lastProcessedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializePage(row: typeof textbookPages.$inferSelect): StoredTextbookPage {
  return {
    id: row.id,
    materialId: row.materialId,
    pageNumber: safeNumber(row.pageNumber),
    rawText: row.rawText,
    normalizedText: row.normalizedText,
    charCount: safeNumber(row.charCount),
    tokenCount: safeNumber(row.tokenCount),
    extractionStatus: row.extractionStatus as StoredTextbookPage["extractionStatus"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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

export async function getTextbookMaterialRow(
  db: Database,
  filters:
    | { materialId: string }
    | {
        bucketName: string;
        r2Key: string;
      },
) {
  const rows =
    "materialId" in filters
      ? await db
          .select()
          .from(textbookMaterials)
          .where(eq(textbookMaterials.id, filters.materialId))
          .limit(1)
      : await db
          .select()
          .from(textbookMaterials)
          .where(
            and(
              eq(textbookMaterials.bucketName, filters.bucketName),
              eq(textbookMaterials.r2Key, filters.r2Key),
            ),
          )
          .limit(1);

  return rows[0] ?? null;
}

export async function getTextbookMaterialDetail(
  db: Database,
  filters:
    | { materialId: string }
    | {
        bucketName: string;
        r2Key: string;
      },
  options: { includeContent?: boolean } = {},
): Promise<TextbookMaterialDetail | null> {
  const materialRow = await getTextbookMaterialRow(db, filters);
  if (!materialRow) {
    return null;
  }

  let pages: StoredTextbookPage[] = [];
  let sections: StoredTextbookSection[] = [];
  let chunks: StoredTextbookChunk[] = [];

  if (options.includeContent) {
    const [pageRows, sectionRows, chunkRows] = await Promise.all([
      db
        .select()
        .from(textbookPages)
        .where(eq(textbookPages.materialId, materialRow.id))
        .orderBy(asc(textbookPages.pageNumber)),
      db
        .select()
        .from(textbookSections)
        .where(eq(textbookSections.materialId, materialRow.id))
        .orderBy(asc(textbookSections.depth), asc(textbookSections.orderIndex)),
      db
        .select()
        .from(textbookChunks)
        .where(eq(textbookChunks.materialId, materialRow.id))
        .orderBy(asc(textbookChunks.orderIndex)),
    ]);

    pages = pageRows.map(serializePage);
    sections = sectionRows.map(serializeSection);
    chunks = chunkRows.map(serializeChunk);
  }

  return {
    material: serializeMaterial(materialRow),
    pages,
    sections,
    chunks,
  };
}

export async function createOrReuseTextbookMaterial(
  db: Database,
  input: CreateTextbookMaterialInput,
) {
  const bucketName = String(input.bucketName ?? "").trim();
  const r2Key = String(input.key ?? "").trim();
  const fileName = String(input.fileName ?? "").trim();
  if (!bucketName || !r2Key || !fileName) {
    throw new Error("bucketName, key, fileName заавал хэрэгтэй.");
  }

  const now = nowIso();
  const existing = await getTextbookMaterialRow(db, { bucketName, r2Key });
  const id = existing?.id ?? crypto.randomUUID();

  await db
    .insert(textbookMaterials)
    .values({
      id,
      bucketName,
      r2Key,
      fileName,
      contentType: input.contentType?.trim() || null,
      grade:
        input.grade != null && Number.isFinite(Number(input.grade))
          ? safeNumber(input.grade)
          : null,
      subject: input.subject?.trim() || null,
      size: Math.max(0, safeNumber(input.size, 0)),
      status: existing?.status ?? "uploaded",
      stage: existing?.stage ?? "uploaded",
      statusMessage:
        existing?.statusMessage ?? "PDF файл бэлэн боллоо. Боловсруулалтыг эхлүүлнэ.",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: textbookMaterials.id,
      set: {
        bucketName,
        r2Key,
        fileName,
        contentType: input.contentType?.trim() || null,
        grade:
          input.grade != null && Number.isFinite(Number(input.grade))
            ? safeNumber(input.grade)
            : null,
        subject: input.subject?.trim() || null,
        size: Math.max(0, safeNumber(input.size, 0)),
        updatedAt: now,
      },
    });

  const detail = await getTextbookMaterialDetail(
    db,
    { materialId: id },
    { includeContent: false },
  );
  if (!detail) {
    throw new Error("Textbook material record үүсгэж чадсангүй.");
  }

  return detail;
}

export async function updateTextbookMaterial(
  db: Database,
  materialId: string,
  input: UpdateTextbookMaterialInput,
) {
  const material = await getTextbookMaterialRow(db, { materialId });
  if (!material) {
    throw new Error("Textbook material олдсонгүй.");
  }

  if (input.resetStoredContent) {
    await db.delete(textbookChunks).where(eq(textbookChunks.materialId, materialId));
    await db.delete(textbookSections).where(eq(textbookSections.materialId, materialId));
    await db.delete(textbookPages).where(eq(textbookPages.materialId, materialId));
  }

  const now = nowIso();
  const warnings = input.warnings ? normalizeWarnings(input.warnings) : null;
  await db
    .update(textbookMaterials)
    .set({
      title:
        input.title !== undefined
          ? input.title?.trim() || null
          : material.title,
      pageCount:
        input.pageCount !== undefined && input.pageCount !== null
          ? Math.max(0, safeNumber(input.pageCount))
          : material.pageCount,
      progressCurrent:
        input.progressCurrent !== undefined && input.progressCurrent !== null
          ? Math.max(0, safeNumber(input.progressCurrent))
          : material.progressCurrent,
      progressTotal:
        input.progressTotal !== undefined && input.progressTotal !== null
          ? Math.max(0, safeNumber(input.progressTotal))
          : material.progressTotal,
      status: input.status ?? material.status,
      stage: input.stage ?? material.stage,
      statusMessage:
        input.statusMessage !== undefined
          ? input.statusMessage?.trim() || null
          : material.statusMessage,
      errorMessage:
        input.errorMessage !== undefined
          ? input.errorMessage?.trim() || null
          : material.errorMessage,
      warningsJson: warnings ? JSON.stringify(warnings) : material.warningsJson,
      ocrNeededPageCount:
        input.ocrNeededPageCount !== undefined && input.ocrNeededPageCount !== null
          ? Math.max(0, safeNumber(input.ocrNeededPageCount))
          : material.ocrNeededPageCount,
      unsupportedReason:
        input.unsupportedReason !== undefined
          ? input.unsupportedReason?.trim() || null
          : material.unsupportedReason,
      readyAt:
        input.readyAt !== undefined
          ? input.readyAt?.trim() || null
          : input.status === "ready"
            ? now
            : material.readyAt,
      lastProcessedAt:
        input.lastProcessedAt !== undefined
          ? input.lastProcessedAt?.trim() || null
          : material.lastProcessedAt,
      updatedAt: now,
    })
    .where(eq(textbookMaterials.id, materialId));

  const detail = await getTextbookMaterialDetail(
    db,
    { materialId },
    { includeContent: false },
  );
  if (!detail) {
    throw new Error("Textbook material update амжилтгүй боллоо.");
  }
  return detail;
}

export async function upsertTextbookMaterialPages(
  db: Database,
  materialId: string,
  input: UpsertTextbookPagesInput,
) {
  const material = await getTextbookMaterialRow(db, { materialId });
  if (!material) {
    throw new Error("Textbook material олдсонгүй.");
  }

  const now = nowIso();
  for (const page of input.pages ?? []) {
    const pageNumber = Math.max(1, safeNumber(page.pageNumber, 1));
    const id = `${materialId}:page:${pageNumber}`;
    await db
      .insert(textbookPages)
      .values({
        id,
        materialId,
        pageNumber,
        rawText: String(page.rawText ?? ""),
        normalizedText: String(page.normalizedText ?? ""),
        charCount: Math.max(0, safeNumber(page.charCount)),
        tokenCount: Math.max(0, safeNumber(page.tokenCount)),
        extractionStatus: page.extractionStatus ?? "ready",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: textbookPages.id,
        set: {
          rawText: String(page.rawText ?? ""),
          normalizedText: String(page.normalizedText ?? ""),
          charCount: Math.max(0, safeNumber(page.charCount)),
          tokenCount: Math.max(0, safeNumber(page.tokenCount)),
          extractionStatus: page.extractionStatus ?? "ready",
          updatedAt: now,
        },
      });
  }

  await db
    .update(textbookMaterials)
    .set({
      pageCount:
        input.pageCount != null
          ? Math.max(0, safeNumber(input.pageCount))
          : material.pageCount,
      progressCurrent:
        input.progressCurrent != null
          ? Math.max(0, safeNumber(input.progressCurrent))
          : material.progressCurrent,
      progressTotal:
        input.progressTotal != null
          ? Math.max(0, safeNumber(input.progressTotal))
          : material.progressTotal,
      status: input.status ?? material.status,
      stage: input.stage ?? material.stage,
      statusMessage:
        input.statusMessage !== undefined
          ? input.statusMessage?.trim() || null
          : material.statusMessage,
      ocrNeededPageCount:
        input.ocrNeededPageCount != null
          ? Math.max(0, safeNumber(input.ocrNeededPageCount))
          : material.ocrNeededPageCount,
      updatedAt: now,
    })
    .where(eq(textbookMaterials.id, materialId));

  const detail = await getTextbookMaterialDetail(
    db,
    { materialId },
    { includeContent: false },
  );
  if (!detail) {
    throw new Error("Textbook pages хадгалж чадсангүй.");
  }
  return detail;
}

export async function replaceTextbookMaterialStructure(
  db: Database,
  materialId: string,
  input: ReplaceTextbookStructureInput,
) {
  const material = await getTextbookMaterialRow(db, { materialId });
  if (!material) {
    throw new Error("Textbook material олдсонгүй.");
  }

  const now = nowIso();
  await db.delete(textbookChunks).where(eq(textbookChunks.materialId, materialId));
  await db.delete(textbookSections).where(eq(textbookSections.materialId, materialId));

  for (const section of input.sections ?? []) {
    await db.insert(textbookSections).values({
      id: section.id,
      materialId,
      parentId: section.parentId?.trim() || null,
      nodeType: section.nodeType,
      title: String(section.title ?? "").trim() || "Untitled",
      normalizedTitle: String(section.normalizedTitle ?? "").trim() || "untitled",
      orderIndex: Math.max(0, safeNumber(section.orderIndex)),
      depth: Math.max(0, safeNumber(section.depth)),
      startPage:
        section.startPage != null ? Math.max(1, safeNumber(section.startPage)) : null,
      endPage:
        section.endPage != null ? Math.max(1, safeNumber(section.endPage)) : null,
      childCount: Math.max(0, safeNumber(section.childCount, 0)),
      pageNumbersJson: JSON.stringify(
        (section.pageNumbers ?? []).map((value) => Math.max(1, safeNumber(value))),
      ),
      metadataJson: section.metadata ? JSON.stringify(section.metadata) : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const chunk of input.chunks ?? []) {
    await db.insert(textbookChunks).values({
      id: chunk.id,
      materialId,
      sectionId: chunk.sectionId,
      chunkType: chunk.chunkType,
      orderIndex: Math.max(0, safeNumber(chunk.orderIndex)),
      pageStart:
        chunk.pageStart != null ? Math.max(1, safeNumber(chunk.pageStart)) : null,
      pageEnd:
        chunk.pageEnd != null ? Math.max(1, safeNumber(chunk.pageEnd)) : null,
      charCount: Math.max(0, safeNumber(chunk.charCount)),
      pageNumbersJson: JSON.stringify(
        (chunk.pageNumbers ?? []).map((value) => Math.max(1, safeNumber(value))),
      ),
      text: String(chunk.text ?? ""),
      createdAt: now,
      updatedAt: now,
    });
  }

  const warnings = normalizeWarnings(input.warnings);
  const chapterCount = (input.sections ?? []).filter(
    (section) => section.nodeType === "chapter",
  ).length;
  const sectionCount = (input.sections ?? []).filter(
    (section) => section.nodeType === "section",
  ).length;
  const subchapterCount = (input.sections ?? []).filter(
    (section) => section.nodeType === "subchapter",
  ).length;
  const finalStatus =
    input.status ??
    (input.unsupportedReason || (input.ocrNeededPageCount ?? 0) > 0
      ? "ocr_needed"
      : "ready");
  const finalStage =
    input.stage ?? (finalStatus === "ready" ? "ready" : "ocr_needed");

  await db
    .update(textbookMaterials)
    .set({
      title:
        input.title !== undefined
          ? input.title?.trim() || null
          : material.title,
      pageCount:
        input.pageCount != null
          ? Math.max(0, safeNumber(input.pageCount))
          : material.pageCount,
      chapterCount,
      sectionCount,
      subchapterCount,
      progressCurrent:
        input.progressCurrent != null
          ? Math.max(0, safeNumber(input.progressCurrent))
          : material.progressCurrent,
      progressTotal:
        input.progressTotal != null
          ? Math.max(0, safeNumber(input.progressTotal))
          : material.progressTotal,
      status: finalStatus,
      stage: finalStage,
      statusMessage:
        input.statusMessage !== undefined
          ? input.statusMessage?.trim() || null
          : finalStatus === "ready"
            ? "Сурах бичиг бэлэн боллоо."
            : "PDF текстийн чанар OCR шаардлагатай байна.",
      warningsJson: JSON.stringify(warnings),
      ocrNeededPageCount: Math.max(0, safeNumber(input.ocrNeededPageCount, 0)),
      unsupportedReason: input.unsupportedReason?.trim() || null,
      readyAt: finalStatus === "ready" ? now : null,
      lastProcessedAt: now,
      updatedAt: now,
    })
    .where(eq(textbookMaterials.id, materialId));

  const detail = await getTextbookMaterialDetail(
    db,
    { materialId },
    { includeContent: true },
  );
  if (!detail) {
    throw new Error("Textbook structure хадгалж чадсангүй.");
  }
  return detail;
}
