"use client";

import type { ProctoringEventSeverity } from "@/lib/exam-service/types";

type ProctoringScreenshotPresignPayload = {
  attemptId: string;
  capturedAt: string;
  contentType: string;
  eventCode: string;
  userId: string;
};

type ProctoringScreenshotPresignResponse = {
  key: string;
  publicUrl: string;
  uploadUrl: string;
};

type ProctoringEvidenceUploadInput = {
  attemptId: string;
  capturedAt: string;
  detail: string;
  eventCode: string;
  title: string;
  userId: string;
};

export type ProctoringEvidenceUploadResult = {
  key: string;
  publicUrl: string;
};

const DEFAULT_PRESIGN_PATH = "/api/proctoring-screenshots/presign";
const DEFAULT_IMAGE_TYPE = "image/jpeg";
const DEFAULT_CAPTURE_TIMEOUT_MS = 4_000;
const MAX_CAPTURE_EDGE_PX = 1600;
const EVIDENCE_EVENT_CODES = new Set([
  "devtools-suspected",
  "fullscreen-exit",
  "fullscreen-not-active",
  "parallel-tab-suspected",
  "shortcut-i",
  "shortcut-j",
  "shortcut-u",
  "split-view-suspected",
  "tab_hidden",
  "window_blur",
]);
const HTML2CANVAS_THEME_VARS = {
  light: {
    "--accent": "#f5f5f5",
    "--accent-foreground": "#111827",
    "--background": "#ffffff",
    "--border": "#e5e7eb",
    "--card": "#ffffff",
    "--card-foreground": "#111827",
    "--destructive": "#dc2626",
    "--foreground": "#111827",
    "--input": "#e5e7eb",
    "--muted": "#f3f4f6",
    "--muted-foreground": "#6b7280",
    "--popover": "#ffffff",
    "--popover-foreground": "#111827",
    "--primary": "#111827",
    "--primary-foreground": "#f9fafb",
    "--ring": "#9ca3af",
    "--secondary": "#f3f4f6",
    "--secondary-foreground": "#111827",
    "--sidebar": "#fafafa",
    "--sidebar-accent": "#f3f4f6",
    "--sidebar-accent-foreground": "#111827",
    "--sidebar-border": "#e5e7eb",
    "--sidebar-foreground": "#111827",
    "--sidebar-primary": "#111827",
    "--sidebar-primary-foreground": "#f9fafb",
    "--sidebar-ring": "#9ca3af",
  },
  dark: {
    "--accent": "#374151",
    "--accent-foreground": "#f9fafb",
    "--background": "#111827",
    "--border": "rgba(255, 255, 255, 0.12)",
    "--card": "#1f2937",
    "--card-foreground": "#f9fafb",
    "--destructive": "#ef4444",
    "--foreground": "#f9fafb",
    "--input": "rgba(255, 255, 255, 0.16)",
    "--muted": "#374151",
    "--muted-foreground": "#d1d5db",
    "--popover": "#1f2937",
    "--popover-foreground": "#f9fafb",
    "--primary": "#e5e7eb",
    "--primary-foreground": "#111827",
    "--ring": "#9ca3af",
    "--secondary": "#374151",
    "--secondary-foreground": "#f9fafb",
    "--sidebar": "#1f2937",
    "--sidebar-accent": "#374151",
    "--sidebar-accent-foreground": "#f9fafb",
    "--sidebar-border": "rgba(255, 255, 255, 0.12)",
    "--sidebar-foreground": "#f9fafb",
    "--sidebar-primary": "#7c3aed",
    "--sidebar-primary-foreground": "#f9fafb",
    "--sidebar-ring": "#9ca3af",
  },
} as const;

const trimText = (value: string, maxLength: number) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: number | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error("Proctoring evidence capture timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const getPresignUrl = () => {
  const configured = process.env.NEXT_PUBLIC_R2_PRESIGN_URL?.trim();
  return configured || DEFAULT_PRESIGN_PATH;
};

const getCaptureRoot = () =>
  document.querySelector<HTMLElement>("[data-proctoring-capture-root]") ??
  document.body;

const getScaledDimensions = (width: number, height: number) => {
  const longestEdge = Math.max(width, height, 1);
  const scale = Math.min(1, MAX_CAPTURE_EDGE_PX / longestEdge);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

const blobFromCanvas = (canvas: HTMLCanvasElement, type = DEFAULT_IMAGE_TYPE) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Canvas snapshot blob үүсгэж чадсангүй."));
      },
      type,
      0.78,
    );
  });

const isUnsupportedHtml2CanvasColorLog = (value: unknown) => {
  if (typeof value === "string") {
    return value.includes(
      'Attempting to parse an unsupported color function "lab"',
    );
  }

  if (value instanceof Error) {
    return value.message.includes(
      'Attempting to parse an unsupported color function "lab"',
    );
  }

  return false;
};

const withFilteredHtml2CanvasLogs = async <T>(
  action: () => Promise<T>,
): Promise<T> => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const shouldSuppress = (args: unknown[]) =>
    args.some((value) => isUnsupportedHtml2CanvasColorLog(value));

  console.error = (...args: unknown[]) => {
    if (shouldSuppress(args)) {
      return;
    }

    originalConsoleError(...args);
  };

  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(args)) {
      return;
    }

    originalConsoleWarn(...args);
  };

  try {
    return await action();
  } finally {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
};

const renderFallbackEvidenceBlob = async ({
  attemptId,
  capturedAt,
  detail,
  eventCode,
  title,
  userId,
}: ProctoringEvidenceUploadInput) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Monitoring snapshot canvas context үүсгэж чадсангүй.");
  }

  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#38bdf8";
  context.fillRect(0, 0, canvas.width, 12);

  context.fillStyle = "#f8fafc";
  context.font = "700 48px ui-sans-serif, system-ui, sans-serif";
  context.fillText("Proctoring evidence", 64, 96);

  context.fillStyle = "#cbd5e1";
  context.font = "500 28px ui-sans-serif, system-ui, sans-serif";
  context.fillText(`Title: ${trimText(title, 70)}`, 64, 162);
  context.fillText(`Event: ${trimText(eventCode, 70)}`, 64, 212);
  context.fillText(`Captured: ${trimText(capturedAt, 70)}`, 64, 262);
  context.fillText(`Attempt: ${trimText(attemptId, 70)}`, 64, 312);
  context.fillText(`Student: ${trimText(userId, 70)}`, 64, 362);
  context.fillText(
    `Viewport: ${window.innerWidth}x${window.innerHeight} @ ${window.location.pathname}`,
    64,
    412,
  );

  context.fillStyle = "#e2e8f0";
  context.font = "400 24px ui-monospace, SFMono-Regular, monospace";

  const detailLines = trimText(detail, 260).match(/.{1,72}(\s|$)/g) ?? [];
  detailLines.slice(0, 6).forEach((line, index) => {
    context.fillText(line.trim(), 64, 500 + index * 34);
  });

  return blobFromCanvas(canvas);
};

const renderDomEvidenceBlob = async (input: ProctoringEvidenceUploadInput) => {
  const { default: html2canvas } = await import("html2canvas");
  const root = getCaptureRoot();
  const isDarkMode =
    document.documentElement.classList.contains("dark") ||
    document.body.classList.contains("dark");
  const width = Math.min(window.innerWidth, 1440);
  const height = Math.min(window.innerHeight, 2200);
  const canvas = await withFilteredHtml2CanvasLogs(() =>
    html2canvas(root, {
      backgroundColor: "#f8fafc",
      height,
      logging: false,
      onclone: (clonedDocument) => {
        const palette = isDarkMode
          ? HTML2CANVAS_THEME_VARS.dark
          : HTML2CANVAS_THEME_VARS.light;

        for (const [name, value] of Object.entries(palette)) {
          clonedDocument.documentElement.style.setProperty(name, value);
          clonedDocument.body.style.setProperty(name, value);
        }
      },
      scale: 1,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      useCORS: true,
      width,
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
      x: window.scrollX,
      y: window.scrollY,
    }),
  );
  const scaledDimensions = getScaledDimensions(canvas.width, canvas.height);
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = scaledDimensions.width;
  finalCanvas.height = scaledDimensions.height;
  const context = finalCanvas.getContext("2d");

  if (!context) {
    throw new Error("Monitoring snapshot canvas context үүсгэж чадсангүй.");
  }

  context.drawImage(canvas, 0, 0, scaledDimensions.width, scaledDimensions.height);
  const blob = await blobFromCanvas(finalCanvas);

  if (blob.size > 0) {
    return blob;
  }

  return renderFallbackEvidenceBlob(input);
};

const createEvidenceBlob = async (input: ProctoringEvidenceUploadInput) => {
  try {
    return await withTimeout(
      renderDomEvidenceBlob(input),
      DEFAULT_CAPTURE_TIMEOUT_MS,
    );
  } catch {
    return renderFallbackEvidenceBlob(input);
  }
};

const requestPresignedUpload = async (
  payload: ProctoringScreenshotPresignPayload,
) => {
  const response = await fetch(getPresignUrl(), {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payloadJson =
    (await response.json().catch(() => null)) as
      | ProctoringScreenshotPresignResponse
      | { error?: string; message?: string }
      | null;

  if (!response.ok || !payloadJson) {
    const errorPayload =
      payloadJson && !("uploadUrl" in payloadJson) ? payloadJson : null;
    throw new Error(
      errorPayload?.message ||
        errorPayload?.error ||
        "Proctoring screenshot presign үүсгэж чадсангүй.",
    );
  }

  if (
    !("uploadUrl" in payloadJson) ||
    !payloadJson.uploadUrl ||
    !payloadJson.publicUrl ||
    !payloadJson.key
  ) {
    throw new Error("Proctoring screenshot presign хариу дутуу байна.");
  }

  return payloadJson;
};

const uploadEvidenceBlob = async (uploadUrl: string, blob: Blob) => {
  const response = await fetch(uploadUrl, {
    body: blob,
    headers: {
      "Content-Type": blob.type || DEFAULT_IMAGE_TYPE,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error("Proctoring evidence upload амжилтгүй боллоо.");
  }
};

export const shouldCaptureProctoringEvidence = (
  code: string,
  severity: ProctoringEventSeverity,
) => severity === "danger" || EVIDENCE_EVENT_CODES.has(code);

export const getEvidenceCaptureCooldownMs = (code: string) => {
  switch (code) {
    case "window_blur":
    case "tab_hidden":
      return 90_000;
    case "split-view-suspected":
    case "fullscreen-not-active":
      return 120_000;
    default:
      return 180_000;
  }
};

export const appendEvidenceUrlToDetail = (
  detail: string,
  evidenceUrl: string,
) => {
  const normalizedDetail = String(detail || "").trim();
  const evidenceLine = `Evidence: ${evidenceUrl}`;
  if (!normalizedDetail) {
    return evidenceLine;
  }

  if (normalizedDetail.includes(evidenceLine)) {
    return normalizedDetail;
  }

  return `${normalizedDetail}\n${evidenceLine}`;
};

export const captureAndUploadProctoringEvidence = async (
  input: ProctoringEvidenceUploadInput,
): Promise<ProctoringEvidenceUploadResult | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  const blob = await createEvidenceBlob(input);
  const presign = await requestPresignedUpload({
    attemptId: input.attemptId,
    capturedAt: input.capturedAt,
    contentType: blob.type || DEFAULT_IMAGE_TYPE,
    eventCode: input.eventCode,
    userId: input.userId,
  });
  await uploadEvidenceBlob(presign.uploadUrl, blob);

  return {
    key: presign.key,
    publicUrl: presign.publicUrl,
  };
};
