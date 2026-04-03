import {
  MAX_TEXTBOOK_PAGE_COUNT,
  MIN_PAGE_TEXT_CHAR_COUNT,
  MIN_READY_TEXT_PAGE_COUNT,
  OCR_UNSUPPORTED_PAGE_RATIO,
} from "@/features/textbook-processing/constants";
import { buildTextbookChunks } from "@/features/textbook-processing/chunk-builder";
import { extractPdfPage, getPdfDocument } from "@/features/textbook-processing/pdf-extractor";
import { detectTextbookStructure } from "@/features/textbook-processing/structure-detector";
import type {
  TextbookProcessingPage,
  TextbookStructurePayload,
} from "@/features/textbook-processing/types";

export type TextbookServerParseResult = {
  pages: TextbookProcessingPage[];
  payload: TextbookStructurePayload;
};

export function normalizeTextbookParseErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "PDF боловсруулах үед алдаа гарлаа.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid pdf structure") || normalized.includes("invalid pdf")) {
    return "PDF файл гэмтсэн эсвэл бүрэн PDF бүтэцгүй байна. Өөр PDF сонгоод дахин оролдоно уу.";
  }

  return message;
}

export async function parseTextbookFileOnServer(
  file: File,
): Promise<TextbookServerParseResult> {
  const pdfDocument = await getPdfDocument(await file.arrayBuffer());

  try {
    const pageCount = Number(pdfDocument.numPages) || 0;

    if (pageCount <= 0) {
      throw new Error("PDF файл дотор уншигдах хуудас олдсонгүй.");
    }

    if (pageCount > MAX_TEXTBOOK_PAGE_COUNT) {
      throw new Error(
        `Энэ PDF ${pageCount} хуудастай байна. Одоогийн дээд хязгаар ${MAX_TEXTBOOK_PAGE_COUNT} хуудас.`,
      );
    }

    const pages: TextbookProcessingPage[] = [];
    let ocrNeededPageCount = 0;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const parsedPage = await extractPdfPage(pdfDocument, pageNumber);
      const extractionStatus =
        parsedPage.charCount >= MIN_PAGE_TEXT_CHAR_COUNT ? "ready" : "ocr_needed";
      const nextPage = {
        ...parsedPage,
        extractionStatus,
      } as const;

      if (extractionStatus === "ocr_needed") {
        ocrNeededPageCount += 1;
      }

      pages.push(nextPage);
    }

    const structure = detectTextbookStructure(pages, { fileName: file.name });
    const chunks = buildTextbookChunks(structure.sections, pages);
    const readyPageCount = pages.filter(
      (page) => page.extractionStatus === "ready",
    ).length;
    const ocrRatio = pageCount > 0 ? ocrNeededPageCount / pageCount : 1;
    const warnings: string[] = [];
    let unsupportedReason: string | null = null;
    let status: "ready" | "ocr_needed" = "ready";
    let statusMessage = "Сурах бичиг бэлэн боллоо.";

    if (ocrNeededPageCount > 0) {
      warnings.push(
        `${ocrNeededPageCount} хуудасны текст маш бага байсан тул OCR шаардлагатай гэж тэмдэглэлээ.`,
      );
    }

    if (
      readyPageCount < MIN_READY_TEXT_PAGE_COUNT ||
      ocrRatio >= OCR_UNSUPPORTED_PAGE_RATIO
    ) {
      status = "ocr_needed";
      unsupportedReason =
        "Энэ PDF скан зурагтай эсвэл текст давхарга маш бага байна. OCR дэмжлэг хэрэгтэй.";
      statusMessage = "PDF-ийн текст хангалтгүй тул OCR шаардлагатай байна.";
    } else if (!chunks.length) {
      status = "ocr_needed";
      unsupportedReason =
        "Текст уншигдсан ч бүтэцтэй хэсэг болон chunk үүсгэж чадсангүй. Илүү цэвэр PDF хэрэгтэй.";
      statusMessage = "Бүтэцтэй хэсэг илрүүлж чадсангүй.";
    }

    return {
      pages,
      payload: {
        title: structure.title,
        pageCount,
        status,
        stage: status === "ready" ? "ready" : "ocr_needed",
        statusMessage,
        warnings,
        ocrNeededPageCount,
        unsupportedReason,
        sections: structure.sections,
        chunks,
      },
    };
  } finally {
    pdfDocument.cleanup();
    void pdfDocument.destroy();
  }
}

export async function handleTextbookParsePost(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof (file as File).arrayBuffer !== "function") {
      return Response.json(
        { error: "PDF файл олдсонгүй." },
        { status: 400 },
      );
    }

    const result = await parseTextbookFileOnServer(file as File);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: normalizeTextbookParseErrorMessage(error) },
      { status: 400 },
    );
  }
}
