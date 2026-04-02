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
  const { toJpeg } = await import("html-to-image");
  const root = getCaptureRoot();
  const width = Math.min(window.innerWidth, 1440);
  const height = Math.min(window.innerHeight, 2200);
  const dataUrl = await toJpeg(root, {
    backgroundColor: "#f8fafc",
    cacheBust: true,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    quality: 0.78,
    style: {
      transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
      transformOrigin: "top left",
    },
  });
  const response = await fetch(dataUrl);
  const blob = await response.blob();

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
