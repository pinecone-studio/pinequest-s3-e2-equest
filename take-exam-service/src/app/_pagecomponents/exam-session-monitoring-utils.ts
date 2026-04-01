"use client";

import type { MonitoringMode } from "@/lib/exam-service/types";
import type { AttemptActivityInput } from "./student-page-api";

export type ExamSessionEventType =
  | "connection_lost"
  | "connection_restored"
  | "heartbeat"
  | "device_change_suspected"
  | "tab_hidden"
  | "tab_visible"
  | "window_blur"
  | "window_focus";

export type FingerprintField =
  | "userAgent"
  | "platform"
  | "language"
  | "timezone"
  | "screen";

export type BrowserFingerprintSignals = {
  language: string;
  platform: string;
  screenHeight: number;
  screenWidth: number;
  timezone: string;
  userAgent: string;
};

export type BrowserFingerprintSnapshot = BrowserFingerprintSignals & {
  hash: string;
};

export type ExamEventMetadata = Record<string, unknown>;

const DEFAULT_MONITORING_MODE: MonitoringMode = "limited-monitoring";

type QueuedExamEvent = {
  attemptId: string;
  input: AttemptActivityInput;
};

type SendExamEvent = (
  attemptId: string,
  input: AttemptActivityInput,
) => Promise<unknown>;

const GLOBAL_SESSION_STORAGE_KEY = "exam_monitoring:session_id";
const MAX_LOG_QUEUE_SIZE = 25;

const EVENT_CONFIG: Record<
  ExamSessionEventType,
  Pick<AttemptActivityInput, "severity" | "title">
> = {
  connection_lost: {
    severity: "danger",
    title: "Connection lost",
  },
  connection_restored: {
    severity: "info",
    title: "Connection restored",
  },
  heartbeat: {
    severity: "info",
    title: "Heartbeat",
  },
  device_change_suspected: {
    severity: "warning",
    title: "Device change suspected",
  },
  tab_hidden: {
    severity: "warning",
    title: "Tab hidden",
  },
  tab_visible: {
    severity: "info",
    title: "Tab visible",
  },
  window_blur: {
    severity: "warning",
    title: "Window blur",
  },
  window_focus: {
    severity: "info",
    title: "Window focus",
  },
};

const getFingerprintStorageKey = (attemptId: string) =>
  `exam_monitoring:fingerprint:${attemptId}`;

const getAttemptSessionStorageKey = (attemptId: string) =>
  `exam_monitoring:attempt_session:${attemptId}`;

const getTimestamp = () => new Date().toISOString();

const safeStorageGet = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (storage: Storage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures in private mode or restricted contexts.
  }
};

const safeStorageRemove = (storage: Storage, key: string) => {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures in private mode or restricted contexts.
  }
};

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const fallbackHash = (value: string) => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return `fallback_${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const hashString = async (value: string) => {
  if (
    typeof crypto !== "undefined" &&
    "subtle" in crypto &&
    typeof crypto.subtle?.digest === "function"
  ) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return toHex(digest);
  }

  return fallbackHash(value);
};

const compactHash = (value: string) => value.slice(0, 16);

export const getCurrentOnlineStatus = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

export const getOrCreateExamSessionId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = safeStorageGet(window.sessionStorage, GLOBAL_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now().toString(36)}`;

  safeStorageSet(window.sessionStorage, GLOBAL_SESSION_STORAGE_KEY, next);
  return next;
};

export const createBrowserFingerprintSnapshot =
  async (): Promise<BrowserFingerprintSnapshot> => {
    const signals: BrowserFingerprintSignals = {
      userAgent: navigator.userAgent || "unknown",
      platform: navigator.platform || "unknown",
      language: navigator.language || "unknown",
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      screenWidth: window.screen?.width ?? window.innerWidth ?? 0,
      screenHeight: window.screen?.height ?? window.innerHeight ?? 0,
    };

    const raw = JSON.stringify(signals);
    const hash = compactHash(await hashString(raw));

    return {
      ...signals,
      hash,
    };
  };

export const diffFingerprintFields = (
  baseline: BrowserFingerprintSnapshot,
  current: BrowserFingerprintSnapshot,
): FingerprintField[] => {
  const changedFields: FingerprintField[] = [];

  if (baseline.userAgent !== current.userAgent) changedFields.push("userAgent");
  if (baseline.platform !== current.platform) changedFields.push("platform");
  if (baseline.language !== current.language) changedFields.push("language");
  if (baseline.timezone !== current.timezone) changedFields.push("timezone");
  if (
    baseline.screenWidth !== current.screenWidth ||
    baseline.screenHeight !== current.screenHeight
  ) {
    changedFields.push("screen");
  }

  return changedFields;
};

export const readStoredFingerprint = (
  attemptId: string,
): BrowserFingerprintSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return safeParseJson<BrowserFingerprintSnapshot>(
    safeStorageGet(window.localStorage, getFingerprintStorageKey(attemptId)),
  );
};

export const persistFingerprint = (
  attemptId: string,
  snapshot: BrowserFingerprintSnapshot,
) => {
  if (typeof window === "undefined") {
    return;
  }

  safeStorageSet(
    window.localStorage,
    getFingerprintStorageKey(attemptId),
    JSON.stringify(snapshot),
  );
};

export const readStoredAttemptSessionId = (attemptId: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  return safeStorageGet(window.localStorage, getAttemptSessionStorageKey(attemptId));
};

export const persistAttemptSessionId = (attemptId: string, sessionId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  safeStorageSet(
    window.localStorage,
    getAttemptSessionStorageKey(attemptId),
    sessionId,
  );
};

export const clearStoredExamSessionMonitoringState = (attemptId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  safeStorageRemove(window.localStorage, getFingerprintStorageKey(attemptId));
  safeStorageRemove(window.localStorage, getAttemptSessionStorageKey(attemptId));
};

const stringifyMetadata = (metadata: ExamEventMetadata) => {
  try {
    return JSON.stringify(metadata);
  } catch {
    return JSON.stringify({
      error: "metadata_serialization_failed",
    });
  }
};

const buildAttemptActivityInput = (
  eventType: ExamSessionEventType,
  metadata: ExamEventMetadata,
): AttemptActivityInput => {
  const config = EVENT_CONFIG[eventType];
  const occurredAt =
    typeof metadata.timestamp === "string" ? metadata.timestamp : getTimestamp();
  const mode =
    metadata.mode === "screen-capture-enabled" ||
    metadata.mode === "fallback-dom-capture" ||
    metadata.mode === "limited-monitoring"
      ? (metadata.mode as MonitoringMode)
      : DEFAULT_MONITORING_MODE;

  return {
    code: eventType,
    mode,
    severity: config.severity,
    title: config.title,
    occurredAt,
    detail: stringifyMetadata({
      ...metadata,
      timestamp: occurredAt,
    }),
  };
};

export const createSafeExamEventLogger = (sendEvent: SendExamEvent) => {
  const queue: QueuedExamEvent[] = [];
  let isFlushing = false;

  const flushQueue = async () => {
    if (isFlushing || queue.length === 0) {
      return;
    }

    isFlushing = true;

    try {
      while (queue.length > 0) {
        const next = queue[0];

        try {
          await sendEvent(next.attemptId, next.input);
        } catch {
          // Best-effort logging only.
        } finally {
          queue.shift();
        }
      }
    } finally {
      isFlushing = false;
    }
  };

  return {
    clearQueue() {
      queue.length = 0;
    },
    logExamEvent(
      attemptId: string | null,
      eventType: ExamSessionEventType,
      metadata: ExamEventMetadata = {},
    ) {
      if (!attemptId) {
        return;
      }

      if (queue.length >= MAX_LOG_QUEUE_SIZE) {
        queue.shift();
      }

      queue.push({
        attemptId,
        input: buildAttemptActivityInput(eventType, metadata),
      });

      void flushQueue();
    },
  };
};
