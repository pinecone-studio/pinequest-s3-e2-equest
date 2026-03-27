"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type AttemptActivityInput,
  logAttemptActivityRequest,
} from "./student-page-api";
import type { StartExamResponse } from "@/lib/exam-service/types";

const monitoringToastStyle = {
  background: "#e6f5fd",
  border: "1px solid #9fdafb",
  color: "#0f3b53",
} as const;

export function useExamMonitoring(activeAttempt: StartExamResponse | null) {
  const [now, setNow] = useState(Date.now());
  const activityCooldownRef = useRef<Record<string, number>>({});
  const activeAttemptRef = useRef<StartExamResponse | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
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

  const showMonitoringToast = useEffectEvent(
    (title: string, description: string) => {
      toast(title, {
        description,
        style: monitoringToastStyle,
      });
    },
  );

  const recordAttemptActivity = useEffectEvent(
    async ({
      code,
      cooldownMs = 1_500,
      detail,
      severity = "warning",
      title,
    }: AttemptActivityInput & { cooldownMs?: number }) => {
      const attempt = activeAttemptRef.current;
      if (!attempt) return;

      const nowTs = Date.now();
      const lastLoggedAt = activityCooldownRef.current[code] ?? 0;
      if (nowTs - lastLoggedAt < cooldownMs) {
        return;
      }

      activityCooldownRef.current[code] = nowTs;
      const occurredAt = new Date(nowTs).toISOString();

      try {
        await logAttemptActivityRequest(attempt.attemptId, {
          code,
          detail,
          severity,
          title,
          occurredAt,
        });
      } catch {
        // Monitoring events are best-effort and must not block the exam.
      }

      showMonitoringToast(title, detail);
    },
  );

  const getBreakpoint = (width: number) => {
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
    if (!activeAttempt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt]);

  useEffect(() => {
    if (!activeAttempt) {
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

    void requestFullscreen();
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
        cooldownMs: 5_000,
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
          cooldownMs: 5_000,
          detail: "Fullscreen идэвхжээгүй байна.",
          severity: "warning",
          title: "Fullscreen",
        });
      }

      if (isSplitViewLikely(window.innerWidth, window.innerHeight)) {
        void recordAttemptActivity({
          code: "split-view-suspected",
          cooldownMs: 5_000,
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
      if (!document.hidden) return;
      void recordAttemptActivity({
        code: "visibility-hidden",
        cooldownMs: 2_000,
        detail: "Tab солилоо.",
        severity: "danger",
        title: "Tab",
      });
    };

    const handleBlur = () => {
      void recordAttemptActivity({
        code: "window-blur",
        cooldownMs: 2_000,
        detail: "Фокус алдагдлаа.",
        severity: "danger",
        title: "Window blur",
      });
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      void recordAttemptActivity({
        code: "fullscreen-exit",
        cooldownMs: 2_000,
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
          cooldownMs: 6_000,
          detail: "DevTools нээгдсэн байж магадгүй.",
          severity: "danger",
          title: "DevTools",
        });
      }
    };

    const handleResize = () => {
      const previousViewport = viewportRef.current;
      const nextViewport = {
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
          cooldownMs: 4_000,
          detail: "Цонх хувааж нээсэн байж магадгүй.",
          severity: "warning",
          title: "Split view",
        });
      }
    };

    const devtoolsInterval = window.setInterval(detectDevtools, 1_200);

    document.addEventListener("copy", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(initialViewportCheckTimer);
      window.clearInterval(devtoolsInterval);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown, true);
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
      viewportRef.current = null;
    };
  }, [activeAttempt, recordAttemptActivity]);

  const resetActivityTracking = () => {
    activityCooldownRef.current = {};
  };

  const timeLeftMs = activeAttempt
    ? Math.max(0, new Date(activeAttempt.expiresAt).getTime() - now)
    : 0;

  return {
    resetActivityTracking,
    timeLeftMs,
  };
}
