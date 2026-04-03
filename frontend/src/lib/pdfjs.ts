type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

type PdfJsWorkerScope = typeof globalThis & {
  __pinequestPdfJsWorker?: Worker | null;
  pdfjsWorker?: {
    WorkerMessageHandler?: unknown;
  };
};

let cachedPdfJsWorkerUrl: string | null | undefined;

function getPdfJsWorkerScope() {
  return globalThis as PdfJsWorkerScope;
}

function canUseDedicatedPdfJsWorker() {
  return (
    typeof Worker !== "undefined"
    && typeof window !== "undefined"
    && typeof document !== "undefined"
  );
}

function getPdfJsWorkerUrl() {
  if (cachedPdfJsWorkerUrl !== undefined) {
    return cachedPdfJsWorkerUrl;
  }

  try {
    cachedPdfJsWorkerUrl = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
  } catch {
    cachedPdfJsWorkerUrl = null;
  }

  return cachedPdfJsWorkerUrl;
}

function ensureNodePdfJsGlobals() {
  const scope = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };

  if (typeof scope.DOMMatrix === "undefined") {
    scope.DOMMatrix = class DOMMatrix {} as typeof DOMMatrix;
  }
  if (typeof scope.ImageData === "undefined") {
    scope.ImageData = class ImageData {} as unknown as typeof ImageData;
  }
  if (typeof scope.Path2D === "undefined") {
    scope.Path2D = class Path2D {} as typeof Path2D;
  }
}

function ensurePdfJsWorker(pdfjs: PdfJsModule) {
  const workerUrl = getPdfJsWorkerUrl();
  const scope = getPdfJsWorkerScope();

  if (!canUseDedicatedPdfJsWorker()) {
    ensureNodePdfJsGlobals();
    return;
  }

  if (scope.__pinequestPdfJsWorker === undefined) {
    try {
      scope.__pinequestPdfJsWorker = workerUrl
        ? new Worker(workerUrl, {
            type: "module",
          })
        : null;
    } catch {
      scope.__pinequestPdfJsWorker = null;
    }
  }

  if (scope.__pinequestPdfJsWorker) {
    pdfjs.GlobalWorkerOptions.workerPort = scope.__pinequestPdfJsWorker;
  } else if (workerUrl && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
}

export async function loadPdfJs() {
  if (!canUseDedicatedPdfJsWorker()) {
    ensureNodePdfJsGlobals();
    const scope = getPdfJsWorkerScope();
    if (!scope.pdfjsWorker?.WorkerMessageHandler) {
      const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      scope.pdfjsWorker = {
        WorkerMessageHandler: workerModule.WorkerMessageHandler,
      };
    }
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  ensurePdfJsWorker(pdfjs);
  return pdfjs;
}
