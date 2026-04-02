import { loadPdfJs } from "@/lib/pdfjs";
import { countTokens, normalizeExtractedText } from "./normalizer";
import type { TextbookProcessingPage } from "./types";

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

function joinLineTokens(tokens: Array<{ text: string; x: number }>) {
  let currentLine = "";

  for (const token of tokens) {
    const text = token.text.trim();
    if (!text) {
      continue;
    }

    const needsTightJoin = /^[,.;:!?)}\]]/.test(text) || /[(\[{]$/.test(currentLine);
    currentLine += currentLine && !needsTightJoin ? ` ${text}` : text;
  }

  return currentLine.trim();
}

export function extractPageTextFromItems(items: PdfTextItem[]) {
  const positionedItems = items
    .map((item) => ({
      text: String(item.str || "").replace(/\s+/g, " ").trim(),
      x: Array.isArray(item.transform) ? Number(item.transform[4] || 0) : 0,
      y: Array.isArray(item.transform) ? Number(item.transform[5] || 0) : 0,
    }))
    .filter((item) => item.text);

  positionedItems.sort((left, right) => {
    const yGap = Math.abs(right.y - left.y);
    if (yGap > 2) {
      return right.y - left.y;
    }
    return left.x - right.x;
  });

  const lines: Array<Array<{ text: string; x: number; y: number }>> = [];
  for (const item of positionedItems) {
    const existingLine = lines.find(
      (line) => line.length > 0 && Math.abs(line[0].y - item.y) <= 3,
    );
    if (existingLine) {
      existingLine.push(item);
      continue;
    }
    lines.push([item]);
  }

  return lines
    .sort((left, right) => right[0].y - left[0].y)
    .map((line) => line.sort((left, right) => left.x - right.x))
    .map((line) => joinLineTokens(line))
    .filter(Boolean)
    .join("\n");
}

export async function getPdfDocument(arrayBuffer: ArrayBuffer) {
  const pdfjs = await loadPdfJs();
  const documentInit = {
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0];
  const loadingTask = pdfjs.getDocument(documentInit);

  return loadingTask.promise;
}

export async function extractPdfPage(
  pdfDocument: Awaited<ReturnType<typeof getPdfDocument>>,
  pageNumber: number,
) {
  const page = await pdfDocument.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const rawText = extractPageTextFromItems(textContent.items as PdfTextItem[]);
  const normalizedText = normalizeExtractedText(rawText);
  page.cleanup();

  const parsedPage: TextbookProcessingPage = {
    pageNumber,
    rawText,
    normalizedText,
    charCount: normalizedText.length,
    tokenCount: countTokens(normalizedText),
    extractionStatus: normalizedText.length > 0 ? "ready" : "ocr_needed",
  };

  return parsedPage;
}
