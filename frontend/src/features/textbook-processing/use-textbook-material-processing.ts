"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createTextbookMaterialRecord,
  downloadR2Textbook,
  fetchR2TextbookCandidates,
  getExpectedR2FileName,
  hasConfiguredTextbookPresignUpload,
  getTextbookMaterialById,
  parseTextbookPdfByServer,
  getTextbookMaterialByR2,
  replaceTextbookMaterialStructure,
  type MaterialBuilderSubject,
  type R2TextbookCandidate,
  updateTextbookMaterialStatus,
  uploadTextbookPdfToR2,
  upsertTextbookMaterialPages,
  validateTextbookPdfFile,
} from "./api";
import { buildUploadedAssetFromMaterial } from "./material-asset";
import { getTextbookMaterialStructureById } from "./material-selection-api";
import { getCachedPersistedTextbookMaterial } from "./persisted-material-cache";
import { getCachedSessionTextbookMaterial } from "./session-material-cache";
import { buildProgressMessage } from "./status";
import { getInitialExpandedChapterIds } from "./selectors";
import type {
  TextbookMaterialDetail,
  TextbookMaterialStructureDetail,
  TextbookProcessingChunk,
  TextbookProcessingPage,
  TextbookProcessingSection,
  TextbookStructurePayload,
  TextbookUploadedAsset,
  TextbookWorkerResponse,
} from "./types";

function isExpectedR2Candidate(
  candidate: R2TextbookCandidate | null,
  expectedFileName: string,
) {
  if (!candidate) {
    return false;
  }

  return candidate.fileName.toLowerCase() === expectedFileName.toLowerCase();
}

let remoteTextbookR2UnavailableReason = "";

function createLocalUploadedAsset(file: File): TextbookUploadedAsset {
  const localId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    bucketName: "local",
    contentType: file.type || "application/pdf",
    fileName: file.name,
    key: `local/${localId}-${file.name}`,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

function createLocalMaterialDetail(input: {
  asset: TextbookUploadedAsset;
  file: File;
  grade: number;
  subject: MaterialBuilderSubject;
}): TextbookMaterialDetail {
  const now = new Date().toISOString();
  const materialId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `local:${crypto.randomUUID()}`
      : `local:${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    material: {
      id: materialId,
      bucketName: input.asset.bucketName,
      r2Key: input.asset.key,
      fileName: input.file.name,
      contentType: input.file.type || "application/pdf",
      title: input.file.name.replace(/\.pdf$/i, "") || input.file.name,
      grade: input.grade,
      subject: input.subject,
      size: input.file.size,
      pageCount: 0,
      chapterCount: 0,
      sectionCount: 0,
      subchapterCount: 0,
      progressCurrent: 0,
      progressTotal: 0,
      status: "uploaded",
      stage: "uploaded",
      statusMessage: "Локал горимоор PDF боловсруулж байна.",
      errorMessage: null,
      warnings: [],
      ocrNeededPageCount: 0,
      unsupportedReason: null,
      readyAt: null,
      lastProcessedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    pages: [],
    sections: [],
    chunks: [],
  };
}

function toStoredSectionRecord(
  materialId: string,
  section: TextbookProcessingSection,
  now: string,
) {
  return {
    id: section.id,
    materialId,
    parentId: section.parentId,
    nodeType: section.nodeType,
    title: section.title,
    normalizedTitle: section.normalizedTitle,
    orderIndex: section.orderIndex,
    depth: section.depth,
    startPage: section.startPage,
    endPage: section.endPage,
    childCount: section.childCount,
    pageNumbers: section.pageNumbers,
    metadata: section.metadata,
    createdAt: now,
    updatedAt: now,
  };
}

function toStoredChunkRecord(
  materialId: string,
  chunk: TextbookProcessingChunk,
  now: string,
  scopeBySectionId: Map<
    string,
    {
      chapterId: string | null;
      subchapterId: string | null;
    }
  >,
) {
  const scope = scopeBySectionId.get(chunk.sectionId) || {
    chapterId: null,
    subchapterId: null,
  };
  return {
    id: chunk.id,
    materialId,
    sectionId: chunk.sectionId,
    chapterId: scope.chapterId,
    subchapterId: scope.subchapterId,
    chunkType: chunk.chunkType,
    orderIndex: chunk.orderIndex,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    charCount: chunk.charCount,
    pageNumbers: chunk.pageNumbers,
    text: chunk.text,
    createdAt: now,
    updatedAt: now,
  };
}

function finalizeLocalMaterialDetail(
  detail: TextbookMaterialDetail,
  payload: TextbookStructurePayload,
): TextbookMaterialDetail {
  const now = new Date().toISOString();
  const sectionById = new Map(
    payload.sections.map((section) => [section.id, section] as const),
  );
  const scopeBySectionId = new Map<
    string,
    {
      chapterId: string | null;
      subchapterId: string | null;
    }
  >();

  const resolveScope = (sectionId: string) => {
    if (scopeBySectionId.has(sectionId)) {
      return scopeBySectionId.get(sectionId)!;
    }

    let chapterId: string | null = null;
    let subchapterId: string | null = null;
    let currentId: string | null = sectionId;

    while (currentId) {
      const current: TextbookProcessingSection | null =
        sectionById.get(currentId) || null;
      if (!current) {
        break;
      }

      if (!chapterId && current.nodeType === "chapter") {
        chapterId = current.id;
      }

      if (!subchapterId && current.nodeType === "subchapter") {
        subchapterId = current.id;
      }

      currentId = current.parentId;
    }

    const scope = {
      chapterId,
      subchapterId,
    };
    scopeBySectionId.set(sectionId, scope);
    return scope;
  };

  const chapterCount = payload.sections.filter(
    (item) => item.nodeType === "chapter",
  ).length;
  const sectionCount = payload.sections.filter(
    (item) => item.nodeType === "section",
  ).length;
  const subchapterCount = payload.sections.filter(
    (item) => item.nodeType === "subchapter",
  ).length;

  return {
    ...detail,
    material: {
      ...detail.material,
      title: payload.title || detail.material.title,
      pageCount: payload.pageCount,
      chapterCount,
      sectionCount,
      subchapterCount,
      progressCurrent: payload.pageCount,
      progressTotal: payload.pageCount,
      status: payload.status,
      stage: payload.stage,
      statusMessage: payload.statusMessage,
      warnings: payload.warnings,
      ocrNeededPageCount: payload.ocrNeededPageCount,
      unsupportedReason: payload.unsupportedReason,
      errorMessage: null,
      readyAt: payload.status === "ready" ? now : detail.material.readyAt,
      lastProcessedAt: now,
      updatedAt: now,
    },
    sections: payload.sections.map((section) =>
      toStoredSectionRecord(detail.material.id, section, now),
    ),
    chunks: payload.chunks.map((chunk) => {
      resolveScope(chunk.sectionId);
      return toStoredChunkRecord(
        detail.material.id,
        chunk,
        now,
        scopeBySectionId,
      );
    }),
  };
}

function createDetailFromStructure(
  structure: TextbookMaterialStructureDetail,
): TextbookMaterialDetail {
  return {
    material: structure.material,
    pages: [],
    sections: structure.sections,
    chunks: [],
  };
}

function shouldFallbackToLocalMode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("500") ||
    message.includes("503") ||
    message.includes("cors") ||
    message.includes("proxy request failed") ||
    message.includes("service unavailable") ||
    message.includes("bucket") ||
    message.includes("r2") ||
    message.includes("network") ||
    message.includes("failed to fetch")
  );
}

function shouldFallbackToLocalMaterialMode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    shouldFallbackToLocalMode(error) ||
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("this page could not be found")
  );
}

function getUploadFallbackMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("this page could not be found")
  ) {
    return {
      status:
        "Create exam service дээр textbook backend deploy хийгдээгүй байна. Локал горимоор боловсруулж байна...",
      toast:
        "Create exam service дээр textbook backend deploy хийгдээгүй байна. Локал горимоор үргэлжлүүллээ.",
    };
  }

  return {
    status:
      "R2 upload service түр ажиллахгүй байна. Локал горимоор боловсруулж байна...",
    toast:
      "R2 upload service түр ажиллахгүй байна. Локал горимоор үргэлжлүүллээ.",
  };
}

function isRecoverableBrowserPdfParseError(message: string) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("invalid pdf") ||
    normalized.includes("structure") ||
    normalized.includes("unexpected server response")
  );
}

export function useTextbookMaterialProcessing({
  enableR2Lookup = true,
  grade,
  subject,
}: {
  enableR2Lookup?: boolean;
  grade: number;
  subject: MaterialBuilderSubject;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [materialDetail, setMaterialDetail] =
    useState<TextbookMaterialDetail | null>(null);
  const [uploadedAsset, setUploadedAsset] =
    useState<TextbookUploadedAsset | null>(null);
  const [r2Candidates, setR2Candidates] = useState<R2TextbookCandidate[]>([]);
  const [selectedR2Key, setSelectedR2Key] = useState("");
  const [r2Error, setR2Error] = useState(remoteTextbookR2UnavailableReason);
  const [isLoadingR2, setIsLoadingR2] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);
  const [transientStatusMessage, setTransientStatusMessage] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const activeJobRef = useRef<string>("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autoLoadedR2KeyRef = useRef("");

  const expectedR2FileName = useMemo(
    () => getExpectedR2FileName(grade, subject),
    [grade, subject],
  );
  const selectedR2Candidate =
    r2Candidates.find((candidate) => candidate.key === selectedR2Key) || null;
  const statusMessage =
    materialDetail?.material.statusMessage?.trim() ||
    transientStatusMessage ||
    buildProgressMessage(materialDetail?.material || null);

  function disableRemoteTextbookR2(reason: string) {
    remoteTextbookR2UnavailableReason = reason;
    setR2Error(reason);
    setR2Candidates([]);
    setSelectedR2Key("");
    setIsLoadingR2(false);
  }

  function terminateWorker() {
    workerRef.current?.terminate();
    workerRef.current = null;
  }

  function enqueueSave(task: () => Promise<void>) {
    saveQueueRef.current = saveQueueRef.current.then(task, task);
    return saveQueueRef.current;
  }

  function updateMaterialDetailLocally(
    materialId: string,
    updater: (detail: TextbookMaterialDetail) => TextbookMaterialDetail,
  ) {
    setMaterialDetail((current) =>
      current?.material.id === materialId ? updater(current) : current,
    );
  }

  function mergePageBatch(
    materialId: string,
    existingPages: TextbookMaterialDetail["pages"],
    nextPages: TextbookProcessingPage[],
  ) {
    const now = new Date().toISOString();
    const pageMap = new Map(
      existingPages.map((page) => [page.pageNumber, page] as const),
    );

    for (const page of nextPages) {
      const previous = pageMap.get(page.pageNumber);
      pageMap.set(page.pageNumber, {
        id: previous?.id || `${materialId}-page-${page.pageNumber}`,
        materialId,
        pageNumber: page.pageNumber,
        rawText: page.rawText,
        normalizedText: page.normalizedText,
        charCount: page.charCount,
        tokenCount: page.tokenCount,
        extractionStatus: page.extractionStatus,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      });
    }

    return Array.from(pageMap.values()).sort(
      (left, right) => left.pageNumber - right.pageNumber,
    );
  }

  function applyMaterialPatchLocally(
    materialId: string,
    payload: Record<string, unknown>,
  ) {
    updateMaterialDetailLocally(materialId, (detail) => ({
      ...detail,
      material: {
        ...detail.material,
        ...payload,
      },
    }));
  }

  function applyPageBatchLocally(
    materialId: string,
    payload: {
      current: number;
      ocrNeededPageCount: number;
      pages: TextbookProcessingPage[];
      total: number;
    },
  ) {
    updateMaterialDetailLocally(materialId, (detail) => ({
      ...detail,
      material: {
        ...detail.material,
        pageCount: payload.total,
        progressCurrent: payload.current,
        progressTotal: payload.total,
        status: "processing",
        stage: "processing_pages",
        statusMessage: `Хуудас ${payload.current}/${payload.total} боловсруулав`,
        ocrNeededPageCount: payload.ocrNeededPageCount,
      },
      pages: mergePageBatch(materialId, detail.pages, payload.pages),
    }));
  }

  async function applyMaterialPatch(
    materialId: string,
    payload: Record<string, unknown>,
  ) {
    const detail = await updateTextbookMaterialStatus(materialId, payload);
    setMaterialDetail((current) =>
      current?.material.id === materialId
        ? {
            ...current,
            material: detail.material,
          }
        : detail,
    );
  }

  async function finalizeProcessedResult(
    materialId: string,
    pages: TextbookProcessingPage[],
    payload: TextbookStructurePayload,
    options: {
      localOnly: boolean;
      successMessage?: string;
    },
  ) {
    applyPageBatchLocally(materialId, {
      current: payload.pageCount,
      total: payload.pageCount,
      pages,
      ocrNeededPageCount: payload.ocrNeededPageCount,
    });

    let detail: TextbookMaterialDetail | null = null;
    if (options.localOnly) {
      setMaterialDetail((current) => {
        if (current?.material.id !== materialId) {
          return current;
        }

        detail = finalizeLocalMaterialDetail(
          {
            ...current,
            pages: mergePageBatch(materialId, current.pages, pages),
          },
          payload,
        );
        return detail;
      });
    } else {
      const withProgress = {
        ...payload,
        progressCurrent: payload.pageCount,
        progressTotal: payload.pageCount,
      };
      await upsertTextbookMaterialPages(materialId, {
        pages,
        pageCount: payload.pageCount,
        progressCurrent: payload.pageCount,
        progressTotal: payload.pageCount,
        status: "processing",
        stage: "detecting_chapters",
        statusMessage: "Бүлэг, дэд сэдвүүдийг ялгаж байна...",
        ocrNeededPageCount: payload.ocrNeededPageCount,
      });
      detail = await replaceTextbookMaterialStructure(materialId, withProgress);
    }

    if (activeJobRef.current !== materialId) {
      return;
    }
    if (!detail) {
      return;
    }
    setMaterialDetail(detail);
    setExpandedChapterIds(getInitialExpandedChapterIds(detail));
    setTransientStatusMessage(detail.material.statusMessage || "");
    setIsProcessing(false);
    activeJobRef.current = "";
    terminateWorker();
    if (detail.material.status === "ready") {
      toast.success(
        options.successMessage || "Сурах бичгийн бүтэц бэлэн боллоо.",
      );
    } else {
      toast.warning(
        detail.material.unsupportedReason ||
          "PDF-ийн зарим хуудас OCR шаардлагатай байна.",
      );
    }
  }

  async function runServerParseFallback(
    file: File,
    materialId: string,
    localOnly: boolean,
  ) {
    setTransientStatusMessage(
      "Browser parser гацсан тул сервер parser-р үргэлжлүүлж байна...",
    );
    const result = await parseTextbookPdfByServer(file);
    await finalizeProcessedResult(materialId, result.pages, result.payload, {
      localOnly,
      successMessage: "Сурах бичгийг fallback parser-р амжилттай боловсруулав.",
    });
  }

  async function runWorkerProcessing(
    file: File,
    asset: TextbookUploadedAsset,
    materialId: string,
    options: {
      localOnly?: boolean;
    } = {},
  ) {
    const validationError = validateTextbookPdfFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const localOnly = options.localOnly ?? false;

    terminateWorker();
    activeJobRef.current = materialId;
    setUploadedAsset(asset);
    setIsProcessing(true);
    setUploadProgressPercent(100);
    setTransientStatusMessage("Хуудас бүрийн текстийг уншиж байна...");
    applyMaterialPatchLocally(materialId, {
      title: file.name.replace(/\.pdf$/i, "") || file.name,
      status: "processing",
      stage: "processing_pages",
      statusMessage: "Хуудас бүрийн текстийг уншиж байна...",
      progressCurrent: 0,
      progressTotal: 0,
      errorMessage: null,
      warnings: [],
      unsupportedReason: null,
      ocrNeededPageCount: 0,
    });

    if (!localOnly) {
      const prepped = await updateTextbookMaterialStatus(materialId, {
        resetStoredContent: true,
        title: file.name.replace(/\.pdf$/i, "") || file.name,
        status: "processing",
        stage: "processing_pages",
        statusMessage: "Хуудас бүрийн текстийг уншиж байна...",
        progressCurrent: 0,
        progressTotal: 0,
        errorMessage: null,
        warnings: [],
        unsupportedReason: null,
        ocrNeededPageCount: 0,
      });
      setMaterialDetail(prepped);
    }

    const worker = new Worker(
      new URL("./processor.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<TextbookWorkerResponse>) => {
      if (activeJobRef.current !== materialId) {
        return;
      }

      switch (event.data.type) {
        case "document-info": {
          const payload = event.data.payload;
          applyMaterialPatchLocally(materialId, {
            title: payload.title,
            pageCount: payload.pageCount,
            progressTotal: payload.pageCount,
            status: "processing",
            stage: "processing_pages",
            statusMessage: "Хуудас бүрийн текстийг уншиж байна...",
          });
          if (!localOnly) {
            void enqueueSave(() =>
              applyMaterialPatch(materialId, {
                title: payload.title,
                pageCount: payload.pageCount,
                progressTotal: payload.pageCount,
                status: "processing",
                stage: "processing_pages",
                statusMessage: "Хуудас бүрийн текстийг уншиж байна...",
              }),
            );
          }
          return;
        }
        case "progress": {
          const payload = event.data.payload;
          setTransientStatusMessage(payload.message);
          applyMaterialPatchLocally(materialId, {
            progressCurrent: payload.current,
            progressTotal: payload.total,
            status: "processing",
            stage: "processing_pages",
            statusMessage: payload.message,
            ocrNeededPageCount: payload.ocrNeededPageCount,
          });
          return;
        }
        case "pages-batch": {
          const payload = event.data.payload;
          applyPageBatchLocally(materialId, payload);
          if (!localOnly) {
            void enqueueSave(async () => {
              const detail = await upsertTextbookMaterialPages(materialId, {
                pages: payload.pages,
                pageCount: payload.total,
                progressCurrent: payload.current,
                progressTotal: payload.total,
                status: "processing",
                stage: "processing_pages",
                statusMessage: `Хуудас ${payload.current}/${payload.total} боловсруулав`,
                ocrNeededPageCount: payload.ocrNeededPageCount,
              });
              setMaterialDetail((current) =>
                current?.material.id === materialId
                  ? {
                      ...current,
                      material: detail.material,
                    }
                  : detail,
              );
            });
          }
          return;
        }
        case "stage": {
          const payload = event.data.payload;
          setTransientStatusMessage(payload.message);
          applyMaterialPatchLocally(materialId, {
            status: "processing",
            stage: payload.stage,
            statusMessage: payload.message,
          });
          if (!localOnly) {
            void enqueueSave(() =>
              applyMaterialPatch(materialId, {
                status: "processing",
                stage: payload.stage,
                statusMessage: payload.message,
              }),
            );
          }
          return;
        }
        case "complete": {
          const payload = event.data.payload;
          setTransientStatusMessage(payload.statusMessage);
          void (async () => {
            try {
              await saveQueueRef.current;
              await finalizeProcessedResult(materialId, [], payload, {
                localOnly,
              });
            } catch (error) {
              applyMaterialPatchLocally(materialId, {
                status: "error",
                stage: "error",
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : "Бүтцийг хадгалах үед алдаа гарлаа.",
                statusMessage: "PDF боловсруулах үед алдаа гарлаа.",
              });
              setTransientStatusMessage("");
              setIsProcessing(false);
              activeJobRef.current = "";
              terminateWorker();
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Бүтцийг хадгалах үед алдаа гарлаа.",
              );
            }
          })();
          return;
        }
        case "error": {
          const payload = event.data.payload;
          if (isRecoverableBrowserPdfParseError(payload.message)) {
            void (async () => {
              try {
                await runServerParseFallback(file, materialId, localOnly);
              } catch (error) {
                applyMaterialPatchLocally(materialId, {
                  status: "error",
                  stage: "error",
                  errorMessage:
                    error instanceof Error ? error.message : payload.message,
                  statusMessage: "PDF боловсруулах үед алдаа гарлаа.",
                });
                setTransientStatusMessage("");
                setIsProcessing(false);
                activeJobRef.current = "";
                terminateWorker();
                toast.error(
                  error instanceof Error ? error.message : payload.message,
                );
              }
            })();
            return;
          }

          applyMaterialPatchLocally(materialId, {
            status: "error",
            stage: "error",
            errorMessage: payload.message,
            statusMessage: "PDF боловсруулах үед алдаа гарлаа.",
          });
          setTransientStatusMessage("");
          setIsProcessing(false);
          activeJobRef.current = "";
          terminateWorker();
          if (!localOnly) {
            void enqueueSave(() =>
              applyMaterialPatch(materialId, {
                status: "error",
                stage: "error",
                errorMessage: payload.message,
                statusMessage: "PDF боловсруулах үед алдаа гарлаа.",
              }),
            );
          }
          toast.error(payload.message);
          return;
        }
      }
    };

    worker.onerror = (event) => {
      applyMaterialPatchLocally(materialId, {
        status: "error",
        stage: "error",
        errorMessage: event.message || "Worker алдаа гарлаа.",
        statusMessage: "PDF боловсруулах үед алдаа гарлаа.",
      });
      setTransientStatusMessage("");
      setIsProcessing(false);
      activeJobRef.current = "";
      terminateWorker();
      if (!localOnly) {
        void enqueueSave(() =>
          applyMaterialPatch(materialId, {
            status: "error",
            stage: "error",
            errorMessage: event.message || "Worker алдаа гарлаа.",
            statusMessage: "PDF боловсруулах үед алдаа гарлаа.",
          }),
        );
      }
    };

    worker.postMessage({
      type: "process",
      payload: {
        file,
        fileName: file.name,
      },
    });
  }

  async function hydrateStoredMaterial(
    detail: TextbookMaterialDetail | null,
    asset: TextbookUploadedAsset | null,
  ) {
    if (!detail) {
      return false;
    }

    setMaterialDetail(detail);
    setUploadedAsset(asset);
    setExpandedChapterIds(getInitialExpandedChapterIds(detail));
    setTransientStatusMessage(detail.material.statusMessage || "");
    return true;
  }

  async function loadMaterialById(materialId: string) {
    const normalizedMaterialId = String(materialId || "").trim();
    if (!normalizedMaterialId) {
      return false;
    }

    const cached = getCachedSessionTextbookMaterial({
      materialId: normalizedMaterialId,
    });
    if (cached?.detail) {
      await hydrateStoredMaterial(cached.detail, cached.asset);
      return true;
    }

    const persisted = getCachedPersistedTextbookMaterial({
      materialId: normalizedMaterialId,
    });
    if (persisted?.detail) {
      await hydrateStoredMaterial(persisted.detail, persisted.asset);
      return true;
    }

    if (normalizedMaterialId.startsWith("local:")) {
      setTransientStatusMessage("");
      return false;
    }

    setTransientStatusMessage(
      "Сурах бичгийн хадгалсан бүтцийг ачаалж байна...",
    );

    try {
      const structuredDetail =
        await getTextbookMaterialStructureById(normalizedMaterialId);
      const detail = structuredDetail
        ? createDetailFromStructure(structuredDetail)
        : null;

      if (!detail) {
        const fullDetail = await getTextbookMaterialById(normalizedMaterialId, {
          includeContent: true,
        });

        if (!fullDetail) {
          setTransientStatusMessage("");
          toast.error("Сурах бичгийн материал олдсонгүй.");
          return false;
        }

        const fullAsset = buildUploadedAssetFromMaterial(fullDetail.material);
        const hasStoredContent =
          fullDetail.sections.length > 0 || fullDetail.pages.length > 0;

        if (hasStoredContent) {
          await hydrateStoredMaterial(fullDetail, fullAsset);
          if (
            fullDetail.material.status === "ready" ||
            fullDetail.material.status === "ocr_needed"
          ) {
            return true;
          }
        } else {
          setMaterialDetail(fullDetail);
          setUploadedAsset(fullAsset);
        }

        if (fullAsset.bucketName === "local") {
          return hasStoredContent;
        }

        const file = await downloadR2Textbook({
          bucketName: fullAsset.bucketName,
          fileName: fullAsset.fileName,
          key: fullAsset.key,
          lastModified: fullAsset.uploadedAt,
          matchScore: 100,
          size: fullAsset.size,
        });
        await runWorkerProcessing(file, fullAsset, fullDetail.material.id);
        return true;
      }

      const asset = buildUploadedAssetFromMaterial(detail.material);
      await hydrateStoredMaterial(detail, asset);
      if (
        detail.material.status === "ready" ||
        detail.material.status === "ocr_needed"
      ) {
        return true;
      }

      if (asset.bucketName === "local") {
        return detail.sections.length > 0;
      }

      const file = await downloadR2Textbook({
        bucketName: asset.bucketName,
        fileName: asset.fileName,
        key: asset.key,
        lastModified: asset.uploadedAt,
        matchScore: 100,
        size: asset.size,
      });
      await runWorkerProcessing(file, asset, detail.material.id);
      return true;
    } catch (error) {
      setTransientStatusMessage("");
      toast.error(
        error instanceof Error
          ? error.message
          : "Сурах бичгийн материалыг ачаалж чадсангүй.",
      );
      return false;
    }
  }

  async function importBook(file: File) {
    const validationError = validateTextbookPdfFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSelectedFile(file);
    setUploadProgressPercent(0);
    setIsUploading(true);
    setTransientStatusMessage("PDF файлыг R2-д хадгалж байна...");

    let asset: TextbookUploadedAsset | null = null;
    let created: TextbookMaterialDetail | null = null;
    let localOnly = false;

    if (
      remoteTextbookR2UnavailableReason &&
      !hasConfiguredTextbookPresignUpload()
    ) {
      asset = createLocalUploadedAsset(file);
      created = createLocalMaterialDetail({
        asset,
        file,
        grade,
        subject,
      });
      localOnly = true;
      setMaterialDetail(created);
      setUploadedAsset(asset);
      setUploadProgressPercent(100);
      setTransientStatusMessage(
        "R2 service одоогоор ажиллахгүй байна. Локал горимоор боловсруулж байна...",
      );
      setIsUploading(false);
    } else {
      try {
        try {
          asset = await uploadTextbookPdfToR2(file, {
            onProgress: (snapshot) => {
              const nextPercent = Math.max(1, snapshot.percent);
              setUploadProgressPercent(nextPercent);
              setTransientStatusMessage(
                `PDF файлыг мэдээллийн санд хадгалж байна... ${nextPercent}%`,
              );
            },
          });
        } catch (error) {
          if (!shouldFallbackToLocalMode(error)) {
            setTransientStatusMessage("");
            setUploadProgressPercent(0);
            toast.error(
              error instanceof Error
                ? error.message
                : "PDF upload хийх үед алдаа гарлаа.",
            );
            return;
          }

          disableRemoteTextbookR2(
            "R2 upload service одоогоор ажиллахгүй байна. Локал горим руу шилжлээ.",
          );
          asset = createLocalUploadedAsset(file);
          created = createLocalMaterialDetail({
            asset,
            file,
            grade,
            subject,
          });
          localOnly = true;
          setMaterialDetail(created);
          setUploadedAsset(asset);
          setUploadProgressPercent(100);
          const fallbackMessage = getUploadFallbackMessage(error);
          setTransientStatusMessage(fallbackMessage.status);
          toast.warning(fallbackMessage.toast);
        }

        if (!localOnly && asset) {
          try {
            setTransientStatusMessage("Материалын бүртгэл үүсгэж байна...");
            created = await createTextbookMaterialRecord({
              asset,
              grade,
              subject,
            });
            setMaterialDetail(created);
          } catch (error) {
            if (!shouldFallbackToLocalMaterialMode(error)) {
              setTransientStatusMessage("");
              setUploadProgressPercent(0);
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Материалын бүртгэл үүсгэх үед алдаа гарлаа.",
              );
              return;
            }

            created = createLocalMaterialDetail({
              asset,
              file,
              grade,
              subject,
            });
            localOnly = true;
            setMaterialDetail(created);
            setUploadedAsset(asset);
            setUploadProgressPercent(100);
            const fallbackMessage = getUploadFallbackMessage(error);
            setTransientStatusMessage(fallbackMessage.status);
            toast.warning(fallbackMessage.toast);
          }
        }
      } finally {
        setIsUploading(false);
      }
    }

    if (!asset || !created) {
      return;
    }

    try {
      await runWorkerProcessing(file, asset, created.material.id, {
        localOnly,
      });
    } catch (error) {
      setTransientStatusMessage("");
      toast.error(
        error instanceof Error
          ? error.message
          : "PDF боловсруулах үед алдаа гарлаа.",
      );
    }
  }

  async function loadFromR2(
    candidate = selectedR2Candidate,
    automatic = false,
  ) {
    if (remoteTextbookR2UnavailableReason) {
      if (!automatic) {
        toast.error(remoteTextbookR2UnavailableReason);
      }
      return false;
    }

    if (!candidate) {
      if (!automatic) {
        toast.error("R2-оос тохирох сурах бичиг сонгоно уу.");
      }
      return false;
    }

    setTransientStatusMessage(
      automatic
        ? `R2-оос ${candidate.fileName} автоматаар шалгаж байна...`
        : `R2-оос ${candidate.fileName} ачаалж байна...`,
    );

    try {
      const existing = await getTextbookMaterialByR2(
        candidate.bucketName,
        candidate.key,
      );

      const asset: TextbookUploadedAsset = {
        bucketName: candidate.bucketName,
        contentType: "application/pdf",
        fileName: candidate.fileName,
        key: candidate.key,
        size: candidate.size,
        uploadedAt: candidate.lastModified || new Date().toISOString(),
      };

      if (
        existing?.material.status === "ready" ||
        existing?.material.status === "ocr_needed"
      ) {
        const structuredDetail = await getTextbookMaterialStructureById(
          existing.material.id,
        );
        if (structuredDetail?.sections.length) {
          await hydrateStoredMaterial(
            createDetailFromStructure(structuredDetail),
            asset,
          );
          return true;
        }
      }

      const file = await downloadR2Textbook(candidate);
      const created =
        existing ||
        (await createTextbookMaterialRecord({
          asset,
          grade,
          subject,
        }));
      setMaterialDetail(created);
      await runWorkerProcessing(file, asset, created.material.id);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "R2-оос сурах бичиг ачаалахад алдаа гарлаа.";
      setTransientStatusMessage("");
      if (shouldFallbackToLocalMode(error)) {
        disableRemoteTextbookR2(
          "R2 service одоогоор ажиллахгүй байна. Импорт хэсгийн локал горимыг ашиглана уу.",
        );
      } else {
        setR2Error(message);
      }
      if (!automatic) {
        toast.error(message);
      }
      return false;
    }
  }

  useEffect(() => {
    if (!enableR2Lookup) {
      autoLoadedR2KeyRef.current = "";
      setR2Candidates([]);
      setSelectedR2Key("");
      setR2Error(remoteTextbookR2UnavailableReason);
      setIsLoadingR2(false);
      return;
    }

    if (remoteTextbookR2UnavailableReason) {
      autoLoadedR2KeyRef.current = "";
      setR2Candidates([]);
      setSelectedR2Key("");
      setR2Error(remoteTextbookR2UnavailableReason);
      setIsLoadingR2(false);
      return;
    }

    let cancelled = false;
    autoLoadedR2KeyRef.current = "";
    setMaterialDetail(null);
    setUploadedAsset(null);
    setExpandedChapterIds([]);
    setTransientStatusMessage("");
    setSelectedFile(null);
    setUploadProgressPercent(0);

    async function loadCandidates() {
      setIsLoadingR2(true);
      setR2Error("");

      try {
        const payload = await fetchR2TextbookCandidates(grade, subject);
        if (cancelled) {
          return;
        }

        setR2Candidates(payload.items);
        const exactMatch =
          payload.items.find(
            (item) =>
              item.fileName.toLowerCase() ===
              payload.expectedFileName.toLowerCase(),
          ) ||
          payload.items[0] ||
          null;
        setSelectedR2Key(exactMatch?.key || "");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setR2Candidates([]);
        setSelectedR2Key("");
        if (shouldFallbackToLocalMode(error)) {
          disableRemoteTextbookR2(
            "R2 service одоогоор ажиллахгүй байна. Локал upload ашиглана уу.",
          );
        } else {
          setR2Error(
            error instanceof Error
              ? error.message
              : "R2-оос сурах бичгийн жагсаалт татаж чадсангүй.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingR2(false);
        }
      }
    }

    void loadCandidates();

    return () => {
      cancelled = true;
      activeJobRef.current = "";
      terminateWorker();
    };
  }, [enableR2Lookup, grade, subject]);

  useEffect(() => {
    if (!enableR2Lookup) {
      return;
    }

    if (isLoadingR2 || isUploading || isProcessing) {
      return;
    }

    const candidateToLoad =
      (selectedR2Candidate &&
      isExpectedR2Candidate(selectedR2Candidate, expectedR2FileName)
        ? selectedR2Candidate
        : r2Candidates.find((candidate) =>
            isExpectedR2Candidate(candidate, expectedR2FileName),
          )) || null;

    if (!candidateToLoad) {
      return;
    }

    if (
      autoLoadedR2KeyRef.current === candidateToLoad.key ||
      uploadedAsset?.key === candidateToLoad.key
    ) {
      return;
    }

    autoLoadedR2KeyRef.current = candidateToLoad.key;
    void loadFromR2(candidateToLoad, true);
  }, [
    expectedR2FileName,
    isLoadingR2,
    isProcessing,
    isUploading,
    enableR2Lookup,
    r2Candidates,
    selectedR2Candidate,
    uploadedAsset?.key,
  ]);

  return {
    expandedChapterIds,
    isLoadingR2,
    isProcessing,
    isUploading,
    materialDetail,
    r2Candidates,
    r2Error,
    selectedFile,
    selectedR2Candidate,
    selectedR2Key,
    setExpandedChapterIds,
    setSelectedFile,
    setSelectedR2Key,
    statusMessage,
    uploadProgressPercent,
    uploadedAsset,
    importBook,
    loadFromR2,
    loadMaterialById,
  };
}
