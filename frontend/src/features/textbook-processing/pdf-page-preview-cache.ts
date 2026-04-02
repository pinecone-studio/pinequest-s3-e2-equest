"use client";

import { downloadR2Textbook } from "./api";
import { getPdfDocument } from "./pdf-extractor";
import type { TextbookUploadedAsset } from "./types";

type PreviewSourceInput = {
  asset: TextbookUploadedAsset | null;
  file?: File | null;
};

type RenderPreviewInput = PreviewSourceInput & {
  maxWidth?: number;
  pageNumber: number;
};

const pdfDocumentPromiseCache = new Map<
  string,
  Promise<Awaited<ReturnType<typeof getPdfDocument>>>
>();
const pagePreviewPromiseCache = new Map<string, Promise<string>>();

function buildSourceCacheKey(input: PreviewSourceInput) {
  if (input.asset?.bucketName && input.asset?.key) {
    return `${input.asset.bucketName}:${input.asset.key}`;
  }

  const file = input.file;
  if (!file) {
    return "";
  }

  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

async function resolvePdfFile(input: PreviewSourceInput) {
  if (input.file) {
    return input.file;
  }

  if (!input.asset || input.asset.bucketName === "local") {
    throw new Error("Эх PDF файл олдсонгүй.");
  }

  return downloadR2Textbook({
    bucketName: input.asset.bucketName,
    fileName: input.asset.fileName,
    key: input.asset.key,
    lastModified: input.asset.uploadedAt,
    matchScore: 100,
    size: input.asset.size,
  });
}

async function getCachedPdfDocument(input: PreviewSourceInput) {
  const cacheKey = buildSourceCacheKey(input);
  if (!cacheKey) {
    throw new Error("PDF source key олдсонгүй.");
  }

  const cached = pdfDocumentPromiseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextPromise = (async () => {
    const file = await resolvePdfFile(input);
    const buffer = await file.arrayBuffer();
    return getPdfDocument(buffer);
  })();

  pdfDocumentPromiseCache.set(cacheKey, nextPromise);
  return nextPromise;
}

export async function renderTextbookPdfPagePreview({
  asset,
  file,
  maxWidth = 480,
  pageNumber,
}: RenderPreviewInput) {
  if (typeof document === "undefined") {
    throw new Error("Browser орчинд page preview render хийнэ.");
  }

  const normalizedPageNumber = Math.max(1, Math.trunc(Number(pageNumber) || 0));
  const sourceKey = buildSourceCacheKey({ asset, file });
  if (!sourceKey) {
    throw new Error("PDF source key олдсонгүй.");
  }

  const previewCacheKey = `${sourceKey}:page:${normalizedPageNumber}:w:${Math.trunc(maxWidth)}`;
  const cachedPreview = pagePreviewPromiseCache.get(previewCacheKey);
  if (cachedPreview) {
    return cachedPreview;
  }

  const nextPreviewPromise = (async () => {
    const pdfDocument = await getCachedPdfDocument({ asset, file });
    const page = await pdfDocument.getPage(normalizedPageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.35, Math.max(0.7, maxWidth / Math.max(1, baseViewport.width)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context үүсгэж чадсангүй.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL("image/png");
    page.cleanup();
    return dataUrl;
  })();

  pagePreviewPromiseCache.set(previewCacheKey, nextPreviewPromise);
  return nextPreviewPromise;
}
