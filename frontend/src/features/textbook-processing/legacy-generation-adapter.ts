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
import { directPageNumbersFromMetadata, splitParagraphs } from "./normalizer";
import { resolveGenerateSelection } from "./selectors";
import type { TextbookMaterialDetail } from "./types";

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

function buildSectionPage(content: string, pageNumber: number): ParsedTextbookSectionPage {
  return {
    content,
    examples: [],
    formulas: [],
    pageNumber,
    paragraphs: splitParagraphs(content),
  };
}

function buildSelectedLegacyBook(
  detail: TextbookMaterialDetail,
  selectedNodeIds: string[],
): LegacySelectionResult {
  const selection = resolveGenerateSelection(detail, selectedNodeIds);
  const selectedIds = new Set(selection.effectiveNodeIds);
  const pageMap = new Map(detail.pages.map((page) => [page.pageNumber, page]));
  const sections = detail.sections.filter((section) => selectedIds.has(section.id));

  const legacySections: ParsedTextbookSection[] = sections.map((section) => {
    const directPageNumbers = directPageNumbersFromMetadata(section.metadata);
    const pageNumbers = (directPageNumbers.length > 0
      ? directPageNumbers
      : section.pageNumbers
    ).filter((pageNumber) => pageMap.has(pageNumber));
    const pages = pageNumbers.map((pageNumber) => {
      const page = pageMap.get(pageNumber);
      const content = String(page?.normalizedText || page?.rawText || "").trim();
      return buildSectionPage(content, pageNumber);
    });

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

    return {
      chapterTitle,
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
            text,
          } satisfies ParsedTextbookPage,
        ] as const;
      }),
    ).values(),
  );

  const book: ParsedTextbook = {
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
  };

  return {
    book,
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
