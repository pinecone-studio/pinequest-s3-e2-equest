import {
  buildTextbookGenerationSource,
  generateTextbookTest,
  type GeneratedTextbookTest,
  type ParsedTextbook,
  type ParsedTextbookChapter,
  type ParsedTextbookPage,
  type ParsedTextbookSection,
  type ParsedTextbookSectionPage,
  type TextbookSourceProblem,
} from "@/app/test/material-builder/_components/textbook-material-data";
import { cleanTextbookPageContent } from "./generation-source-cleaner";
import { directPageNumbersFromMetadata, splitParagraphs } from "./normalizer";
import { resolveGenerateSelection } from "./selectors";
import type {
  TextbookChunkRecord,
  TextbookMaterialDetail,
  TextbookPageRecord,
  TextbookSectionRecord,
} from "./types";

type GenerationOptions = {
  difficultyCounts?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  fallbackDifficulty?: "easy" | "medium" | "hard";
  openQuestionCount?: number;
  questionCount?: number;
  totalScore?: number;
};

type LegacySelectionResult = {
  book: ParsedTextbook;
  effectiveSectionIds: string[];
  selectedSectionTitles: string[];
};

function uniqueSortedPageNumbers(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isFinite(value) && value >= 1),
    ),
  ).sort((left, right) => left - right);
}

function dedupeTexts(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function buildSectionPage(content: string, pageNumber: number): ParsedTextbookSectionPage {
  const cleanedContent = cleanTextbookPageContent(content);
  return {
    content: cleanedContent,
    examples: [],
    formulas: [],
    pageNumber,
    paragraphs: splitParagraphs(cleanedContent),
  };
}

function getSectionPageNumbers(section: TextbookSectionRecord) {
  const directPageNumbers = directPageNumbersFromMetadata(section.metadata);
  return uniqueSortedPageNumbers(
    directPageNumbers.length > 0 ? directPageNumbers : section.pageNumbers,
  );
}

function buildSectionPageBuckets(
  pageNumbers: number[],
  chunks: TextbookChunkRecord[],
  pageMap: Map<number, TextbookPageRecord>,
) {
  const chunkTextsByPage = new Map<number, string[]>();

  for (const chunk of chunks) {
    const chunkText = String(chunk.text || "").trim();
    if (!chunkText) {
      continue;
    }

    const chunkPages = uniqueSortedPageNumbers(
      chunk.pageNumbers.length > 0
        ? chunk.pageNumbers
        : [chunk.pageStart ?? 0, chunk.pageEnd ?? 0],
    );
    const targetPages = chunkPages.filter((pageNumber) => pageNumbers.includes(pageNumber));

    for (const pageNumber of targetPages) {
      const list = chunkTextsByPage.get(pageNumber) || [];
      list.push(chunkText);
      chunkTextsByPage.set(pageNumber, list);
    }
  }

  return pageNumbers
    .map((pageNumber) => {
      const chunkTexts = dedupeTexts(chunkTextsByPage.get(pageNumber) || []);
      const fallbackText = String(
        pageMap.get(pageNumber)?.normalizedText || pageMap.get(pageNumber)?.rawText || "",
      ).trim();
      const content = cleanTextbookPageContent(
        chunkTexts.length > 0 ? chunkTexts.join("\n\n") : fallbackText,
      );

      return content ? buildSectionPage(content, pageNumber) : null;
    })
    .filter((page): page is ParsedTextbookSectionPage => Boolean(page));
}

function getSectionChapterTitle(
  detail: TextbookMaterialDetail,
  section: TextbookSectionRecord,
) {
  let chapterTitle = "БҮЛЭГ";
  let parentId = section.parentId;

  while (parentId) {
    const parent = detail.sections.find((item) => item.id === parentId) || null;
    if (!parent) {
      break;
    }

    if (parent.nodeType === "chapter") {
      chapterTitle = parent.title;
      break;
    }

    parentId = parent.parentId;
  }

  return chapterTitle;
}

function buildSelectedLegacyBook(
  detail: TextbookMaterialDetail,
  selectedNodeIds: string[],
): LegacySelectionResult {
  const selection = resolveGenerateSelection(detail, selectedNodeIds);
  const selectedIds = new Set(selection.effectiveNodeIds);
  const pageMap = new Map(detail.pages.map((page) => [page.pageNumber, page] as const));
  const chunkMap = new Map<string, TextbookChunkRecord[]>();

  for (const chunk of detail.chunks) {
    const list = chunkMap.get(chunk.sectionId) || [];
    list.push(chunk);
    chunkMap.set(chunk.sectionId, list);
  }

  for (const chunks of chunkMap.values()) {
    chunks.sort((left, right) => left.orderIndex - right.orderIndex);
  }

  const sections = detail.sections.filter((section) => selectedIds.has(section.id));
  const legacySections: ParsedTextbookSection[] = sections.map((section) => {
    const pageNumbers = getSectionPageNumbers(section);
    const pages = buildSectionPageBuckets(
      pageNumbers,
      chunkMap.get(section.id) || [],
      pageMap,
    );

    return {
      chapterTitle: getSectionChapterTitle(detail, section),
      endPage: pageNumbers[pageNumbers.length - 1] ?? null,
      id: section.id,
      pageCount: pageNumbers.length,
      pageNumbers,
      pages,
      startPage: pageNumbers[0] ?? null,
      subsections: [],
      title: section.title,
    };
  });

  const chaptersByTitle = new Map<string, ParsedTextbookSection[]>();
  for (const section of legacySections) {
    const list = chaptersByTitle.get(section.chapterTitle) || [];
    list.push(section);
    chaptersByTitle.set(section.chapterTitle, list);
  }

  const chapters: ParsedTextbookChapter[] = Array.from(chaptersByTitle.entries()).map(
    ([title, chapterSections], index) => ({
      id: `chapter-${index + 1}`,
      title,
      sections: chapterSections,
    }),
  );

  const uniquePages = Array.from(
    new Map(
      selection.selectedPageNumbers.map((pageNumber) => {
        const page = pageMap.get(pageNumber);
        const text = String(page?.normalizedText || page?.rawText || "").trim();
        return [
          pageNumber,
          {
            pageNumber,
            text: cleanTextbookPageContent(text, 900),
          } satisfies ParsedTextbookPage,
        ] as const;
      }),
    ).values(),
  );

  return {
    book: {
      chapters,
      createdAt: detail.material.createdAt,
      fileName: detail.material.fileName,
      id: detail.material.id,
      pageCount: uniquePages.length,
      pages: uniquePages,
      sections: legacySections,
      title:
        detail.material.title?.trim() ||
        detail.material.fileName.replace(/\.pdf$/i, "") ||
        "Сурах бичиг",
    },
    effectiveSectionIds: legacySections.map((section) => section.id),
    selectedSectionTitles: selection.selectedSectionTitles,
  };
}

export function generateTextbookTestFromMaterial(
  detail: TextbookMaterialDetail,
  selectedNodeIds: string[],
  options: GenerationOptions = {},
): {
  result: GeneratedTextbookTest;
  selectedSectionTitles: string[];
} {
  const { book, effectiveSectionIds, selectedSectionTitles } =
    buildSelectedLegacyBook(detail, selectedNodeIds);
  const result = generateTextbookTest(book, effectiveSectionIds, options);
  return { result, selectedSectionTitles };
}

export function buildTextbookGenerationSourceFromMaterial(
  detail: TextbookMaterialDetail,
  selectedNodeIds: string[],
  options: {
    questionCount?: number;
  } = {},
): {
  selectedSectionTitles: string[];
  sourceProblems: TextbookSourceProblem[];
  visiblePages: Array<{ content: string; pageNumber: number }>;
} {
  const { book, effectiveSectionIds, selectedSectionTitles } =
    buildSelectedLegacyBook(detail, selectedNodeIds);
  const source = buildTextbookGenerationSource(book, effectiveSectionIds, options);
  return {
    selectedSectionTitles,
    sourceProblems: source.selectedExerciseProblems,
    visiblePages: source.visiblePages,
  };
}
