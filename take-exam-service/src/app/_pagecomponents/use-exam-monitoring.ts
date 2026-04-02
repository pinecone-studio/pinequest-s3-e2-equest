"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  type AttemptActivityInput,
  logAttemptActivityRequest,
} from "./student-page-api";
import type {
  MonitoringMode,
  StartExamResponse,
} from "@/lib/exam-service/types";

type MonitoringEvidenceResult = {
  mode: MonitoringMode;
  screenshotCapturedAt?: string;
  screenshotStorageKey?: string;
  screenshotUrl?: string;
};

type MonitoringActivityDraft = Omit<
  AttemptActivityInput,
  "mode" | "occurredAt" | "screenshotCapturedAt" | "screenshotStorageKey" | "screenshotUrl"
> & {
  cooldownMs?: number;
  mode?: MonitoringMode;
  occurredAt?: string;
  screenshotCapturedAt?: string;
  screenshotStorageKey?: string;
  screenshotUrl?: string;
};

type UseExamMonitoringOptions = {
  captureEvidence?: (input: {
    attemptId: string;
    eventCode: string;
    occurredAt?: string;
  }) => Promise<MonitoringEvidenceResult>;
  enabled?: boolean;
  monitoringMode: MonitoringMode;
  suspiciousScoreThreshold?: number;
};

const CAPTURE_TRIGGER_CODES = new Set([
  "tab_hidden",
  "tab_visible",
  "window_blur",
  "window_focus",
  "fullscreen-exit",
]);
const FULLSCREEN_REQUEST_DELAY_MS = 5_000;

export function useExamMonitoring(
  activeAttempt: StartExamResponse | null,
  {
    captureEvidence,
    enabled = true,
    monitoringMode,
    suspiciousScoreThreshold = 3,
  }: UseExamMonitoringOptions,
) {
  const [now, setNow] = useState(Date.now());
  const activityCooldownRef = useRef<Record<string, number>>({});
  const activeAttemptRef = useRef<StartExamResponse | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const focusLossStartedAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef(Date.now());
  const loggedAttemptSessionRef = useRef<string | null>(null);
  const questionViewCountsRef = useRef<Record<string, number>>({});
  const monitoringModeRef = useRef<MonitoringMode>(monitoringMode);
  const suspiciousScoreRef = useRef(0);
  const tabIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}`,
  );
  const viewportRef = useRef<{
    breakpoint: "lg" | "md" | "sm";
    height: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    activeAttemptRef.current = activeAttempt;
  }, [activeAttempt]);

  useEffect(() => {
    monitoringModeRef.current = monitoringMode;
  }, [monitoringMode]);

  const recordAttemptActivity = useEffectEvent(
    async ({
      code,
      cooldownMs = 1_500,
      detail,
      mode,
      occurredAt,
      severity = "warning",
      screenshotCapturedAt,
      screenshotStorageKey,
      screenshotUrl,
      title,
    }: MonitoringActivityDraft) => {
      const attempt = activeAttemptRef.current;
      if (!attempt || !enabled) return;

      const nowTs = Date.now();
      const lastLoggedAt = activityCooldownRef.current[code] ?? 0;
      if (nowTs - lastLoggedAt < cooldownMs) {
        return;
      }

      activityCooldownRef.current[code] = nowTs;
      const resolvedOccurredAt = occurredAt ?? new Date(nowTs).toISOString();
      const nextSuspiciousScore =
        suspiciousScoreRef.current +
        (severity === "danger" ? 2 : severity === "warning" ? 1 : 0);
      suspiciousScoreRef.current = nextSuspiciousScore;
      const shouldCaptureEvidence =
        Boolean(captureEvidence) &&
        (severity !== "info" ||
          CAPTURE_TRIGGER_CODES.has(code) ||
          nextSuspiciousScore >= suspiciousScoreThreshold);
      const evidence = shouldCaptureEvidence
        ? await captureEvidence?.({
            attemptId: attempt.attemptId,
            eventCode: code,
            occurredAt: resolvedOccurredAt,
          })
        : undefined;

      try {
        await logAttemptActivityRequest(attempt.attemptId, {
          code,
          detail,
          mode: evidence?.mode ?? mode ?? monitoringModeRef.current,
          severity,
          screenshotCapturedAt:
            evidence?.screenshotCapturedAt ?? screenshotCapturedAt,
          screenshotStorageKey:
            evidence?.screenshotStorageKey ?? screenshotStorageKey,
          screenshotUrl: evidence?.screenshotUrl ?? screenshotUrl,
          title,
          occurredAt: resolvedOccurredAt,
        });
      } catch {
        // Monitoring events are best-effort and must not block the exam.
      }
    },
  );

  const markInteraction = useEffectEvent(() => {
    lastInteractionAtRef.current = Date.now();
  });

  const recordBehaviorEvent = useEffectEvent(
    ({
      code,
      cooldownMs,
      detail,
      mode,
      occurredAt,
      severity = "info",
      screenshotCapturedAt,
      screenshotStorageKey,
      screenshotUrl,
      title,
    }: MonitoringActivityDraft) => {
      markInteraction();
      void recordAttemptActivity({
        code,
        cooldownMs,
        detail,
        mode,
        occurredAt,
        severity,
        screenshotCapturedAt,
        screenshotStorageKey,
        screenshotUrl,
        title,
      });
    },
  );

  const trackQuestionView = useEffectEvent(
    (questionId: string, index: number, totalQuestions: number) => {
      markInteraction();
      const nextCount = (questionViewCountsRef.current[questionId] ?? 0) + 1;
      questionViewCountsRef.current[questionId] = nextCount;

      if (nextCount === 3 || nextCount === 5) {
        void recordAttemptActivity({
          code: "question-revisit",
          cooldownMs: 15_000,
          detail: `${index}/${totalQuestions} асуулт руу ${nextCount} дахь удаагаа буцаж орлоо.`,
          severity: nextCount >= 5 ? "warning" : "info",
          title: "Question revisit",
        });
      }
    },
  );

  const getBreakpoint = (width: number): "lg" | "md" | "sm" => {
    if (width < 640) return "sm";
    if (width < 1024) return "md";
    return "lg";
  };

  const isSplitViewLikely = (width: number, height: number) => {
    const screenWidth = window.screen.availWidth || window.screen.width || width;
    const screenHeight =
      window.screen.availHeight || window.screen.height || height;
    const widthRatio = width / Math.max(screenWidth, 1);
    const heightRatio = height / Math.max(screenHeight, 1);

    return (
      (screenWidth >= 1100 && widthRatio < 0.78) ||
      (screenHeight >= 800 && heightRatio < 0.78)
    );
  };

  useEffect(() => {
    if (!activeAttempt || !enabled) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt, enabled]);

  useEffect(() => {
    if (!activeAttempt || !enabled) {
      focusLossStartedAtRef.current = null;
      lastInteractionAtRef.current = Date.now();
      questionViewCountsRef.current = {};
      loggedAttemptSessionRef.current = null;
      suspiciousScoreRef.current = 0;
      return;
    }

    lastInteractionAtRef.current = Date.now();
    questionViewCountsRef.current = {};
    suspiciousScoreRef.current = 0;

    if (loggedAttemptSessionRef.current === activeAttempt.attemptId) {
      return;
    }

    loggedAttemptSessionRef.current = activeAttempt.attemptId;
    void recordAttemptActivity({
      code: "attempt-session-open",
      cooldownMs: 0,
      detail: "Шалгалтын session энэ tab дээр эхэллээ.",
      severity: "info",
      title: "Session open",
    });
  }, [
    activeAttempt,
    captureEvidence,
    enabled,
    recordAttemptActivity,
    suspiciousScoreThreshold,
  ]);

  useEffect(() => {
    if (!activeAttempt || !enabled) {
      return;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";

    const requestFullscreen = async () => {
      try {
        if (!isLocalhost && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Some browsers require a stricter gesture policy.
      }
    };

    const fullscreenRequestTimer = window.setTimeout(() => {
      void requestFullscreen();
    }, FULLSCREEN_REQUEST_DELAY_MS);
    viewportRef.current = {
      breakpoint: getBreakpoint(window.innerWidth),
      height: window.innerHeight,
      width: window.innerWidth,
    };

    const broadcastChannel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(`exam-attempt-${activeAttempt.attemptId}`)
        : null;
    broadcastChannelRef.current = broadcastChannel;

    broadcastChannel?.addEventListener("message", (event) => {
      const data = event.data as
        | { attemptId: string; tabId: string; type: "attempt-presence" }
        | { attemptId: string; tabId: string; type: "attempt-presence-ack" }
        | undefined;

      if (
        !data ||
        data.attemptId !== activeAttempt.attemptId ||
        data.tabId === tabIdRef.current
      ) {
        return;
      }

      void recordAttemptActivity({
        code: "parallel-tab-suspected",
        cooldownMs: 60_000,
        detail: "Ижил шалгалт өөр tab дээр нээгдсэн байж магадгүй.",
        severity: "danger",
        title: "Another tab",
      });

      if (data.type === "attempt-presence") {
        broadcastChannel.postMessage({
          attemptId: activeAttempt.attemptId,
          tabId: tabIdRef.current,
          type: "attempt-presence-ack",
        });
      }
    });

    broadcastChannel?.postMessage({
      attemptId: activeAttempt.attemptId,
      tabId: tabIdRef.current,
      type: "attempt-presence",
    });

    const initialViewportCheckTimer = window.setTimeout(() => {
      if (
        !document.fullscreenElement &&
        isSplitViewLikely(window.innerWidth, window.innerHeight)
      ) {
        void recordAttemptActivity({
          code: "fullscreen-not-active",
          cooldownMs: 60_000,
          detail: "Fullscreen идэвхжээгүй байна.",
          severity: "warning",
          title: "Fullscreen",
        });
      }

      if (isSplitViewLikely(window.innerWidth, window.innerHeight)) {
        void recordAttemptActivity({
          code: "split-view-suspected",
          cooldownMs: 60_000,
          detail: "Цонх хувааж нээсэн байж магадгүй.",
          severity: "warning",
          title: "Split view",
        });
      }
    }, 900);

    const handleClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      const actionLabel =
        event.type === "copy"
          ? "Copy хийлээ."
          : event.type === "cut"
            ? "Cut хийлээ."
            : "Paste хийлээ.";
      void recordAttemptActivity({
        code: `clipboard-${event.type}`,
        detail: actionLabel,
        severity: "warning",
        title: "Clipboard",
      });
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void recordAttemptActivity({
        code: "context-menu",
        detail: "Right click дарлаа.",
        severity: "warning",
        title: "Context menu",
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        focusLossStartedAtRef.current = Date.now();
        void recordAttemptActivity({
          code: "tab_hidden",
          cooldownMs: 2_000,
          detail: "Tab солилоо.",
          severity: "warning",
          title: "Tab hidden",
        });
        return;
      }

      markInteraction();
      const lostAt = focusLossStartedAtRef.current;
      if (!lostAt) {
        return;
      }

      const awaySeconds = Math.max(1, Math.round((Date.now() - lostAt) / 1000));
      focusLossStartedAtRef.current = null;
      void recordAttemptActivity({
        code: "tab_visible",
        cooldownMs: 0,
        detail: `Tab руу ${awaySeconds} сек дараа буцаж орлоо.`,
        severity: awaySeconds >= 15 ? "warning" : "info",
        title: "Tab visible",
      });
    };

    const handleBlur = () => {
      focusLossStartedAtRef.current = focusLossStartedAtRef.current ?? Date.now();
      void recordAttemptActivity({
        code: "window_blur",
        cooldownMs: 2_000,
        detail: "Фокус алдагдлаа.",
        severity: "warning",
        title: "Window blur",
      });
    };

    const handleFocus = () => {
      markInteraction();
      const lostAt = focusLossStartedAtRef.current;
      if (!lostAt) {
        return;
      }

      const awaySeconds = Math.max(1, Math.round((Date.now() - lostAt) / 1000));
      focusLossStartedAtRef.current = null;
      void recordAttemptActivity({
        code: "window_focus",
        cooldownMs: 0,
        detail: `Фокус ${awaySeconds} сек алдагдсаны дараа сэргэлээ.`,
        severity: awaySeconds >= 15 ? "warning" : "info",
        title: "Window focus",
      });
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      void recordAttemptActivity({
        code: "fullscreen-exit",
        cooldownMs: 60_000,
        detail: "Fullscreen-ээс гарлаа.",
        severity: "danger",
        title: "Fullscreen",
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const metaOrCtrl = event.metaKey || event.ctrlKey;
      const isInspectShortcut =
        event.key === "F12" ||
        (metaOrCtrl && event.shiftKey && ["c", "i", "j"].includes(key)) ||
        (metaOrCtrl && ["i", "j", "u"].includes(key));
      const isClipboardShortcut =
        metaOrCtrl && ["a", "c", "p", "s", "v", "x"].includes(key);

      if (!isInspectShortcut && !isClipboardShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void recordAttemptActivity({
        code: `shortcut-${key}`,
        detail: isInspectShortcut
          ? "Inspect нээх гэж оролдлоо."
          : "Shortcut дарлаа.",
        severity: isInspectShortcut ? "danger" : "warning",
        title: isInspectShortcut ? "Inspect" : "Shortcut",
      });
    };

    const detectDevtools = () => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;

      if (widthGap > 160 || heightGap > 160) {
        void recordAttemptActivity({
          code: "devtools-suspected",
          cooldownMs: 30_000,
          detail: "DevTools нээгдсэн байж магадгүй.",
          severity: "danger",
          title: "DevTools",
        });
      }
    };

    const handleResize = () => {
      const previousViewport = viewportRef.current;
      const nextViewport: {
        breakpoint: "lg" | "md" | "sm";
        height: number;
        width: number;
      } = {
        breakpoint: getBreakpoint(window.innerWidth),
        height: window.innerHeight,
        width: window.innerWidth,
      };

      viewportRef.current = nextViewport;

      if (!previousViewport) {
        return;
      }

      if (previousViewport.breakpoint !== nextViewport.breakpoint) {
        void recordAttemptActivity({
          code: `viewport-breakpoint-${nextViewport.breakpoint}`,
          cooldownMs: 4_000,
          detail: "Цонхны хэмжээ өөрчлөгдлөө.",
          severity: "warning",
          title: "Viewport",
        });
        return;
      }

      const widthDelta = Math.abs(previousViewport.width - nextViewport.width);
      const heightDelta = Math.abs(
        previousViewport.height - nextViewport.height,
      );

      if (widthDelta > 220 || heightDelta > 180) {
        void recordAttemptActivity({
          code: "viewport-resize-suspicious",
          cooldownMs: 4_000,
          detail: "Цонхны хэмжээ огцом өөрчлөгдлөө.",
          severity: "warning",
          title: "Window resize",
        });
      }

      if (isSplitViewLikely(nextViewport.width, nextViewport.height)) {
        void recordAttemptActivity({
          code: "split-view-suspected",
          cooldownMs: 60_000,
          detail: "Цонх хувааж нээсэн байж магадгүй.",
          severity: "warning",
          title: "Split view",
        });
      }
    };

    const devtoolsInterval = window.setInterval(detectDevtools, 1_200);
    const idleInterval = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      const idleMs = Date.now() - lastInteractionAtRef.current;
      if (idleMs >= 90_000) {
        void recordAttemptActivity({
          code: "idle-90s",
          cooldownMs: 60_000,
          detail: `${Math.round(idleMs / 1000)} сек идэвхгүй байлаа.`,
          severity: "warning",
          title: "Idle",
        });
      } else if (idleMs >= 45_000) {
        void recordAttemptActivity({
          code: "idle-45s",
          cooldownMs: 45_000,
          detail: `${Math.round(idleMs / 1000)} сек interaction хийгээгүй байна.`,
          severity: "info",
          title: "Idle",
        });
      }
    }, 15_000);

    const handleInteraction = () => {
      markInteraction();
    };

    document.addEventListener("copy", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("pointerdown", handleInteraction, true);
    document.addEventListener("touchstart", handleInteraction, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", handleInteraction, true);

    return () => {
      window.clearTimeout(fullscreenRequestTimer);
      window.clearTimeout(initialViewportCheckTimer);
      window.clearInterval(devtoolsInterval);
      window.clearInterval(idleInterval);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("pointerdown", handleInteraction, true);
      document.removeEventListener("touchstart", handleInteraction, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", handleInteraction, true);
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
      viewportRef.current = null;
    };
  }, [activeAttempt, enabled, markInteraction, recordAttemptActivity]);

  const resetActivityTracking = () => {
    activityCooldownRef.current = {};
  };

  const timeLeftMs = activeAttempt
    ? Math.max(0, new Date(activeAttempt.expiresAt).getTime() - now)
    : 0;

  return {
    markInteraction,
    recordBehaviorEvent,
    resetActivityTracking,
    trackQuestionView,
    timeLeftMs,
  };
}
