/// <reference lib="webworker" />

import {
  MIN_PAGE_TEXT_CHAR_COUNT,
  MIN_READY_TEXT_PAGE_COUNT,
  OCR_UNSUPPORTED_PAGE_RATIO,
  PAGE_BATCH_SIZE,
  MAX_TEXTBOOK_PAGE_COUNT,
} from "./constants";
import { buildTextbookChunks } from "./chunk-builder";
import { extractPdfPage, getPdfDocument } from "./pdf-extractor";
import { detectTextbookStructure } from "./structure-detector";
import type { TextbookWorkerRequest, TextbookWorkerResponse } from "./types";

const workerScope = self as DedicatedWorkerGlobalScope;

function postMessage(message: TextbookWorkerResponse) {
  workerScope.postMessage(message);
}

function normalizeWorkerErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "PDF боловсруулах үед алдаа гарлаа.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid pdf structure") || normalized.includes("invalid pdf")) {
    return "PDF файл гэмтсэн эсвэл бүрэн PDF бүтэцгүй байна. Өөр PDF сонгоод дахин оролдоно уу.";
  }

  if (normalized.includes("unexpected server response")) {
    return "PDF файл биш өгөгдөл ирсэн байна. Файлаа дахин шалгаад оролдоно уу.";
  }

  return message;
}

workerScope.onmessage = async (event: MessageEvent<TextbookWorkerRequest>) => {
  if (event.data?.type !== "process") {
    return;
  }

  try {
    const { file, fileName } = event.data.payload;
    const arrayBuffer = await file.arrayBuffer();
    const pdfDocument = await getPdfDocument(arrayBuffer);
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

      postMessage({
        type: "document-info",
        payload: {
          fileName,
          pageCount,
          title: fileName.replace(/\.pdf$/i, "").trim() || "Сурах бичиг",
        },
      });

      postMessage({
        type: "stage",
        payload: {
          stage: "processing_pages",
          message: "Хуудас бүрийн текстийг уншиж байна...",
        },
      });

      const pages = [];
      const batch = [];
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
        batch.push(nextPage);

        postMessage({
          type: "progress",
          payload: {
            current: pageNumber,
            total: pageCount,
            message: `Хуудас ${pageNumber}/${pageCount} боловсруулав`,
            ocrNeededPageCount,
          },
        });

        if (batch.length >= PAGE_BATCH_SIZE || pageNumber === pageCount) {
          postMessage({
            type: "pages-batch",
            payload: {
              current: pageNumber,
              total: pageCount,
              pages: batch.splice(0, batch.length),
              ocrNeededPageCount,
            },
          });
        }

        if (pageNumber % PAGE_BATCH_SIZE === 0) {
          await Promise.resolve();
        }
      }

      postMessage({
        type: "stage",
        payload: {
          stage: "detecting_chapters",
          message: "Бүлэг, дэд сэдвүүдийг ялгаж байна...",
        },
      });

      const structure = detectTextbookStructure(pages, { fileName });
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

      postMessage({
        type: "complete",
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
      });
    } finally {
      pdfDocument.cleanup();
      void pdfDocument.destroy();
    }
  } catch (error) {
    postMessage({
      type: "error",
      payload: {
        message: normalizeWorkerErrorMessage(error),
      },
    });
  }
};
