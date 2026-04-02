"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MonitoringMode } from "@/lib/exam-service/types";
import { uploadProctoringScreenshotRequest } from "./student-page-api";

const CAPTURE_DEBOUNCE_MS = 300;
const MAX_CAPTURE_EDGE_PX = 1600;
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

export type MonitoringEvidencePayload = {
  attemptId: string;
  eventCode: string;
  occurredAt?: string;
};

export type MonitoringEvidenceResult = {
  mode: MonitoringMode;
  screenshotCapturedAt?: string;
  screenshotStorageKey?: string;
  screenshotUrl?: string;
};

type UseScreenCaptureOptions = {
  attemptId: string | null;
  examContainerRef: RefObject<HTMLElement | null>;
  studentName: string | null;
  userId: string | null;
};

const isMonitoringMode = (value: unknown): value is MonitoringMode =>
  value === "screen-capture-enabled" ||
  value === "fallback-dom-capture" ||
  value === "limited-monitoring";

const getScaledDimensions = (width: number, height: number) => {
  const longestEdge = Math.max(width, height, 1);
  const scale = Math.min(1, MAX_CAPTURE_EDGE_PX / longestEdge);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

const canvasToBlobWithType = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

const canvasToBlob = async (canvas: HTMLCanvasElement) => {
  try {
    const jpegBlob = await canvasToBlobWithType(canvas, "image/jpeg", 0.86);
    if (jpegBlob) {
      return jpegBlob;
    }
  } catch {
    // Fallback to PNG below.
  }

  try {
    return await canvasToBlobWithType(canvas, "image/png");
  } catch {
    return null;
  }
};

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

const waitForVideoReadiness = async (video: HTMLVideoElement) => {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const handleLoadedData = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Screen stream frame-ийг уншиж чадсангүй."));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadeddata", handleLoadedData, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
};

const drawWatermark = ({
  canvas,
  capturedAt,
  userId,
}: {
  canvas: HTMLCanvasElement;
  capturedAt: string;
  userId: string;
}) => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const label = `${userId} • ${new Date(capturedAt).toLocaleString("en-US", {
    hour12: false,
  })}`;
  const fontSize = Math.max(15, Math.round(canvas.width * 0.018));
  const paddingX = Math.max(10, Math.round(fontSize * 0.8));
  const paddingY = Math.max(8, Math.round(fontSize * 0.55));
  context.save();
  context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const textMetrics = context.measureText(label);
  const textWidth = textMetrics.width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 2;
  const x = canvas.width - boxWidth - paddingX;
  const y = canvas.height - boxHeight - paddingY;

  context.fillStyle = "rgba(15, 23, 42, 0.72)";
  context.fillRect(x, y, boxWidth, boxHeight);
  context.fillStyle = "rgba(255, 255, 255, 0.96)";
  context.textBaseline = "middle";
  context.fillText(label, x + paddingX, y + boxHeight / 2);
  context.restore();
};

const captureStreamFrame = async ({
  capturedAt,
  stream,
  userId,
}: {
  capturedAt: string;
  stream: MediaStream;
  userId: string;
}) => {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;

  try {
    await video.play();
    await waitForVideoReadiness(video);
    const naturalWidth = video.videoWidth || 1280;
    const naturalHeight = video.videoHeight || 720;
    const { height, width } = getScaledDimensions(naturalWidth, naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    drawWatermark({
      canvas,
      capturedAt,
      userId,
    });

    return canvasToBlob(canvas);
  } finally {
    video.pause();
    video.srcObject = null;
  }
};

const captureTrackFrame = async ({
  capturedAt,
  stream,
  userId,
}: {
  capturedAt: string;
  stream: MediaStream;
  userId: string;
}) => {
  const [track] = stream.getVideoTracks();
  if (!track) {
    return captureStreamFrame({
      capturedAt,
      stream,
      userId,
    });
  }

  if (typeof ImageCapture === "undefined") {
    return captureStreamFrame({
      capturedAt,
      stream,
      userId,
    });
  }

  const imageCapture = new ImageCapture(track) as ImageCapture & {
    grabFrame: () => Promise<ImageBitmap>;
  };
  const frame = await imageCapture.grabFrame();

  try {
    const { height, width } = getScaledDimensions(frame.width, frame.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.drawImage(frame, 0, 0, width, height);
    drawWatermark({
      canvas,
      capturedAt,
      userId,
    });

    return canvasToBlob(canvas);
  } finally {
    frame.close();
  }
};

const captureDomFrame = async ({
  capturedAt,
  target,
  userId,
}: {
  capturedAt: string;
  target: HTMLElement;
  userId: string;
}) => {
  const isDarkMode =
    document.documentElement.classList.contains("dark") ||
    document.body.classList.contains("dark");
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await withFilteredHtml2CanvasLogs(() =>
    html2canvas(target, {
      backgroundColor: "#f7f7f8",
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
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
    }),
  );

  const { height, width } = getScaledDimensions(canvas.width, canvas.height);
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = height;
  const context = finalCanvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(canvas, 0, 0, width, height);
  drawWatermark({
    canvas: finalCanvas,
    capturedAt,
    userId,
  });

  return canvasToBlob(finalCanvas);
};

const escapeSvgText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const buildEventLabel = (eventCode: string) => {
  switch (eventCode) {
    case "tab_hidden":
      return "Tab сольсон";
    case "tab_visible":
      return "Tab руу буцаж орсон";
    case "window_blur":
      return "Фокус алдагдсан";
    case "window_focus":
      return "Фокус сэргэсний дараах төлөв";
    case "fullscreen-exit":
    case "fullscreen-not-active":
      return "Fullscreen төлөв өөрчлөгдсөн";
    case "split-view-suspected":
      return "Цонх хуваасан байж болзошгүй";
    case "devtools-suspected":
      return "DevTools нээсэн байж болзошгүй";
    case "viewport-resize-suspicious":
      return "Цонхны хэмжээ өөрчлөгдсөн";
    default:
      return eventCode.replaceAll("-", " ");
  }
};

const buildSyntheticEvidenceBlob = async ({
  capturedAt,
  eventCode,
  studentName,
  userId,
}: {
  capturedAt: string;
  eventCode: string;
  studentName: string;
  userId: string;
}) => {
  const timestamp = new Date(capturedAt).toLocaleString("en-US", {
    hour12: false,
  });
  const currentLocation =
    typeof window !== "undefined" ? window.location.href : "about:blank";
  const title = buildEventLabel(eventCode);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#eef4ff" />
          <stop offset="100%" stop-color="#f8fafc" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <rect x="72" y="72" width="1456" height="756" rx="30" fill="#ffffff" stroke="#dbe4f0" stroke-width="2" />
      <rect x="72" y="72" width="12" height="756" rx="6" fill="#f97316" />
      <text x="128" y="170" fill="#0f172a" font-size="56" font-family="Inter, Arial, sans-serif" font-weight="700">
        ${escapeSvgText(title)}
      </text>
      <text x="128" y="232" fill="#475569" font-size="30" font-family="Inter, Arial, sans-serif">
        Автомат screenshot fallback evidence
      </text>

      <rect x="128" y="286" width="1344" height="166" rx="20" fill="#f8fafc" stroke="#e2e8f0" />
      <text x="168" y="350" fill="#0f172a" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="600">
        Student
      </text>
      <text x="168" y="392" fill="#334155" font-size="34" font-family="Inter, Arial, sans-serif">
        ${escapeSvgText(studentName)}
      </text>
      <text x="168" y="430" fill="#64748b" font-size="24" font-family="Inter, Arial, sans-serif">
        ${escapeSvgText(userId)}
      </text>

      <text x="960" y="350" fill="#0f172a" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="600">
        Captured at
      </text>
      <text x="960" y="392" fill="#334155" font-size="34" font-family="Inter, Arial, sans-serif">
        ${escapeSvgText(timestamp)}
      </text>
      <text x="960" y="430" fill="#64748b" font-size="24" font-family="Inter, Arial, sans-serif">
        ${escapeSvgText(eventCode)}
      </text>

      <rect x="128" y="492" width="1344" height="260" rx="24" fill="#f8fafc" stroke="#e2e8f0" />
      <text x="168" y="556" fill="#0f172a" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="600">
        Location
      </text>
      <foreignObject x="168" y="586" width="1264" height="126">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, sans-serif; font-size: 22px; line-height: 1.5; color: #334155; word-break: break-all;">
          ${escapeSvgText(currentLocation)}
        </div>
      </foreignObject>
    </svg>
  `.trim();

  return new Blob([svg], { type: "image/svg+xml" });
};

export function useScreenCapture({
  attemptId,
  examContainerRef,
  studentName,
  userId,
}: UseScreenCaptureOptions) {
  const [isPermissionWarningOpen, setIsPermissionWarningOpen] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [mode, setMode] = useState<MonitoringMode>("limited-monitoring");
  const activeAttemptIdRef = useRef<string | null>(attemptId);
  const currentModeRef = useRef<MonitoringMode>(mode);
  const lastCaptureAtRef = useRef<number>(0);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const studentNameRef = useRef<string | null>(studentName);
  const userIdRef = useRef<string | null>(userId);

  useEffect(() => {
    activeAttemptIdRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    currentModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    studentNameRef.current = studentName;
  }, [studentName]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const stopCapture = useCallback(() => {
    const stream = screenStreamRef.current;
    if (!stream) {
      return;
    }

    for (const track of stream.getTracks()) {
      track.stop();
    }

    screenStreamRef.current = null;
  }, []);

  const requestScreenCaptureAccess = useCallback(async () => {
    setIsRequestingPermission(true);

    try {
      if (
        typeof navigator === "undefined" ||
        typeof navigator.mediaDevices?.getDisplayMedia !== "function"
      ) {
        setMode("fallback-dom-capture");
        return "fallback-dom-capture" as const;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      stopCapture();
      screenStreamRef.current = stream;

      for (const track of stream.getVideoTracks()) {
        track.addEventListener(
          "ended",
          () => {
            screenStreamRef.current = null;
            setMode("fallback-dom-capture");
            setIsPermissionWarningOpen(true);
          },
          { once: true },
        );
      }

      setMode("screen-capture-enabled");
      return "screen-capture-enabled" as const;
    } catch {
      setMode("fallback-dom-capture");
      setIsPermissionWarningOpen(true);
      return "fallback-dom-capture" as const;
    } finally {
      setIsRequestingPermission(false);
    }
  }, [stopCapture]);

  const captureEvidence = useCallback(
    async ({
      attemptId: attemptIdOverride,
      eventCode,
      occurredAt,
    }: MonitoringEvidencePayload): Promise<MonitoringEvidenceResult> => {
      const resolvedAttemptId = attemptIdOverride ?? activeAttemptIdRef.current;
      const capturedAt = occurredAt ?? new Date().toISOString();
      const activeStudentName = studentNameRef.current ?? "unknown-student";
      const activeUserId = userIdRef.current ?? "unknown-user";
      let resolvedMode = currentModeRef.current;

      if (!resolvedAttemptId) {
        return {
          mode: resolvedMode,
        };
      }

      const now = Date.now();
      if (now - lastCaptureAtRef.current < CAPTURE_DEBOUNCE_MS) {
        return {
          mode: resolvedMode,
        };
      }

      let screenshotBlob: Blob | null = null;

      if (
        resolvedMode === "screen-capture-enabled" &&
        screenStreamRef.current
      ) {
        try {
          screenshotBlob = await captureTrackFrame({
            capturedAt,
            stream: screenStreamRef.current,
            userId: activeUserId,
          });
        } catch (error) {
          console.error("Failed to capture screen stream frame:", error);
        }
      }

      if (!screenshotBlob) {
        const targetCandidates = [
          examContainerRef.current,
          document.documentElement,
          document.body,
        ].filter(
          (target): target is HTMLElement =>
            typeof HTMLElement !== "undefined" &&
            target instanceof HTMLElement &&
            target.offsetWidth > 0 &&
            target.offsetHeight > 0,
        );
        let encounteredUnsupportedColorError = false;

        for (const target of targetCandidates) {
          try {
            screenshotBlob = await captureDomFrame({
              capturedAt,
              target,
              userId: activeUserId,
            });
            if (screenshotBlob) {
              resolvedMode = "fallback-dom-capture";
              break;
            }
          } catch (error) {
            if (isUnsupportedHtml2CanvasColorLog(error)) {
              encounteredUnsupportedColorError = true;
              break;
            }

            console.error("Failed to capture fallback DOM screenshot:", error);
          }
        }

        if (!screenshotBlob) {
          if (encounteredUnsupportedColorError) {
            console.warn(
              "DOM screenshot capture skipped because html2canvas could not parse a browser color format. Falling back to synthetic evidence.",
            );
          }
          resolvedMode = "limited-monitoring";
        }
      }

      if (!screenshotBlob) {
        try {
          screenshotBlob = await buildSyntheticEvidenceBlob({
            capturedAt,
            eventCode,
            studentName: activeStudentName,
            userId: activeUserId,
          });
          resolvedMode =
            resolvedMode === "screen-capture-enabled"
              ? resolvedMode
              : "fallback-dom-capture";
        } catch (error) {
          console.error("Failed to build synthetic evidence screenshot:", error);
        }
      }

      if (!screenshotBlob) {
        if (resolvedMode !== currentModeRef.current) {
          setMode(resolvedMode);
        }

        return {
          mode: resolvedMode,
        };
      }

      lastCaptureAtRef.current = now;

      if (resolvedMode !== currentModeRef.current) {
        setMode(resolvedMode);
      }

      try {
        const uploadedScreenshot = await uploadProctoringScreenshotRequest({
          attemptId: resolvedAttemptId,
          blob: screenshotBlob,
          capturedAt,
          eventCode,
          mode: resolvedMode,
          studentName: activeStudentName,
          userId: activeUserId,
        });

        return {
          mode: resolvedMode,
          screenshotCapturedAt: capturedAt,
          screenshotStorageKey: uploadedScreenshot.key,
          screenshotUrl: uploadedScreenshot.publicUrl,
        };
      } catch (error) {
        console.error("Failed to upload proctoring screenshot:", error);
        return {
          mode: resolvedMode,
        };
      }
    },
    [examContainerRef],
  );

  const resetMonitoringCapture = useCallback(() => {
    stopCapture();
    lastCaptureAtRef.current = 0;
    setIsPermissionWarningOpen(false);
    setMode("limited-monitoring");
  }, [stopCapture]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    captureEvidence,
    dismissPermissionWarning: () => setIsPermissionWarningOpen(false),
    isPermissionWarningOpen,
    isRequestingPermission,
    mode,
    requestScreenCaptureAccess,
    resetMonitoringCapture,
    setMode: (nextMode: string) => {
      if (isMonitoringMode(nextMode)) {
        setMode(nextMode);
      }
    },
    stopCapture,
  };
}
