type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

const PDFJS_WORKER_URL = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url,
).toString();

type PdfJsWorkerScope = typeof globalThis & {
  __pinequestPdfJsWorker?: Worker | null;
  pdfjsWorker?: {
    WorkerMessageHandler?: unknown;
  };
};

function getPdfJsWorkerScope() {
  return globalThis as PdfJsWorkerScope;
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
  const scope = getPdfJsWorkerScope();

  if (typeof Worker === "undefined") {
    ensureNodePdfJsGlobals();
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    }
    return;
  }

  if (scope.__pinequestPdfJsWorker === undefined) {
    try {
      scope.__pinequestPdfJsWorker = new Worker(PDFJS_WORKER_URL, {
        type: "module",
      });
    } catch {
      scope.__pinequestPdfJsWorker = null;
    }
  }

  if (scope.__pinequestPdfJsWorker) {
    pdfjs.GlobalWorkerOptions.workerPort = scope.__pinequestPdfJsWorker;
  } else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
}

export async function loadPdfJs() {
  if (typeof Worker === "undefined") {
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
