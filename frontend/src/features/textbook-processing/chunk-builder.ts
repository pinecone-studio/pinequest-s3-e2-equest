import {
  MAX_CHUNK_CHAR_COUNT,
  MAX_EXERCISE_LINES_PER_CHUNK,
  MIN_PAGE_TEXT_CHAR_COUNT,
} from "./constants";
import {
  directPageNumbersFromMetadata,
  splitParagraphs,
} from "./normalizer";
import type {
  TextbookChunkRecord,
  TextbookPageRecord,
  TextbookProcessingChunk,
  TextbookProcessingPage,
  TextbookProcessingSection,
  TextbookSectionRecord,
} from "./types";

type AnyPage = TextbookProcessingPage | TextbookPageRecord;
type AnySection = TextbookProcessingSection | TextbookSectionRecord;

function getPageText(page: AnyPage | undefined) {
  if (!page) {
    return "";
  }

  return String(page.normalizedText || page.rawText || "").trim();
}

function getDirectPageNumbers(section: AnySection) {
  return directPageNumbersFromMetadata(section.metadata || null);
}

function extractExerciseLines(text: string) {
  const lines = String(text || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.length < 4 || line.length > 240) {
      continue;
    }
    const looksExercise =
      /(Жишээ|Бодлого|Дасгал|Даалгавар|Example|Exercise|Problem)/iu.test(line) ||
      (/\d/.test(line) && /[=+\-*/<>≤≥≈×÷√]/.test(line));
    if (!looksExercise || seen.has(line)) {
      continue;
    }
    seen.add(line);
    out.push(line);
  }

  return out;
}

function buildParagraphChunks(pageNumbers: number[], pageMap: Map<number, AnyPage>) {
  const chunks: Array<{
    pageNumbers: number[];
    text: string;
  }> = [];
  let currentText = "";
  let currentPages = new Set<number>();

  const flush = () => {
    const text = currentText.trim();
    if (!text) {
      return;
    }
    chunks.push({
      pageNumbers: Array.from(currentPages).sort((left, right) => left - right),
      text,
    });
    currentText = "";
    currentPages = new Set<number>();
  };

  for (const pageNumber of pageNumbers) {
    const pageText = getPageText(pageMap.get(pageNumber));
    if (pageText.length < MIN_PAGE_TEXT_CHAR_COUNT) {
      continue;
    }
    const paragraphs = splitParagraphs(pageText);
    const paragraphsToUse = paragraphs.length ? paragraphs : [pageText];
    for (const paragraph of paragraphsToUse) {
      const next = paragraph.trim();
      if (!next) {
        continue;
      }
      const proposal = currentText ? `${currentText}\n\n${next}` : next;
      if (proposal.length > MAX_CHUNK_CHAR_COUNT && currentText) {
        flush();
      }
      currentText = currentText ? `${currentText}\n\n${next}` : next;
      currentPages.add(pageNumber);
    }
  }

  flush();
  return chunks;
}

function buildExerciseChunks(pageNumbers: number[], pageMap: Map<number, AnyPage>) {
  const allExercises: Array<{ pageNumber: number; text: string }> = [];
  for (const pageNumber of pageNumbers) {
    const pageText = getPageText(pageMap.get(pageNumber));
    if (pageText.length < MIN_PAGE_TEXT_CHAR_COUNT) {
      continue;
    }
    const lines = extractExerciseLines(pageText);
    for (const line of lines) {
      allExercises.push({ pageNumber, text: line });
    }
  }

  const chunks: Array<{
    pageNumbers: number[];
    text: string;
  }> = [];
  for (let index = 0; index < allExercises.length; index += MAX_EXERCISE_LINES_PER_CHUNK) {
    const slice = allExercises.slice(index, index + MAX_EXERCISE_LINES_PER_CHUNK);
    if (!slice.length) {
      continue;
    }
    chunks.push({
      pageNumbers: Array.from(
        new Set(slice.map((item) => item.pageNumber)),
      ).sort((left, right) => left - right),
      text: slice.map((item) => item.text).join("\n"),
    });
  }
  return chunks;
}

export function buildTextbookChunks(
  sections: AnySection[],
  pages: AnyPage[],
): TextbookProcessingChunk[] {
  const pageMap = new Map(pages.map((page) => [page.pageNumber, page]));
  const chunks: TextbookProcessingChunk[] = [];

  for (const section of sections) {
    if (section.nodeType === "chapter") {
      continue;
    }

    const directPageNumbers = getDirectPageNumbers(section);
    const pageNumbers =
      directPageNumbers.length > 0 ? directPageNumbers : section.pageNumbers;
    if (!pageNumbers.length) {
      continue;
    }

    const contentChunks = buildParagraphChunks(pageNumbers, pageMap);
    for (const [index, chunk] of contentChunks.entries()) {
      chunks.push({
        id: `${section.id}:content:${index + 1}`,
        sectionId: section.id,
        chunkType: "content",
        orderIndex: chunks.length,
        pageStart: chunk.pageNumbers[0] ?? null,
        pageEnd: chunk.pageNumbers[chunk.pageNumbers.length - 1] ?? null,
        charCount: chunk.text.length,
        pageNumbers: chunk.pageNumbers,
        text: chunk.text,
      });
    }

    const exerciseChunks = buildExerciseChunks(pageNumbers, pageMap);
    for (const [index, chunk] of exerciseChunks.entries()) {
      chunks.push({
        id: `${section.id}:exercise:${index + 1}`,
        sectionId: section.id,
        chunkType: "exercise",
        orderIndex: chunks.length,
        pageStart: chunk.pageNumbers[0] ?? null,
        pageEnd: chunk.pageNumbers[chunk.pageNumbers.length - 1] ?? null,
        charCount: chunk.text.length,
        pageNumbers: chunk.pageNumbers,
        text: chunk.text,
      });
    }
  }

  return chunks;
}
