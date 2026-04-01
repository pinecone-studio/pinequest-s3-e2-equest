"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { logAttemptActivityRequest } from "./student-page-api";
import {
  clearStoredExamSessionMonitoringState,
  createBrowserFingerprintSnapshot,
  createSafeExamEventLogger,
  diffFingerprintFields,
  getCurrentOnlineStatus,
  getOrCreateExamSessionId,
  persistAttemptSessionId,
  persistFingerprint,
  readStoredAttemptSessionId,
  readStoredFingerprint,
  type BrowserFingerprintSnapshot,
} from "./exam-session-monitoring-utils";
import type { MonitoringMode } from "@/lib/exam-service/types";

type UseExamSessionMonitoringOptions = {
  attemptId: string | null;
  enabled?: boolean;
  heartbeatIntervalMs?: number;
  monitoringMode?: MonitoringMode;
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

export function useExamSessionMonitoring({
  attemptId,
  enabled = true,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  monitoringMode = "limited-monitoring",
}: UseExamSessionMonitoringOptions) {
  const [isOnline, setIsOnline] = useState(getCurrentOnlineStatus);
  const baselineFingerprintRef = useRef<BrowserFingerprintSnapshot | null>(null);
  const currentFingerprintRef = useRef<BrowserFingerprintSnapshot | null>(null);
  const loggedDeviceChangeSignatureRef = useRef<string | null>(null);
  const latestAttemptIdRef = useRef<string | null>(attemptId);
  const monitoringModeRef = useRef<MonitoringMode>(monitoringMode);
  const sessionIdRef = useRef<string | null>(null);
  const isOnlineRef = useRef(isOnline);
  const logger = useMemo(
    () => createSafeExamEventLogger(logAttemptActivityRequest),
    [],
  );

  useEffect(() => {
    latestAttemptIdRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    monitoringModeRef.current = monitoringMode;
  }, [monitoringMode]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (!enabled || !attemptId) {
      baselineFingerprintRef.current = null;
      currentFingerprintRef.current = null;
      loggedDeviceChangeSignatureRef.current = null;
      return;
    }

    setIsOnline(getCurrentOnlineStatus());
    sessionIdRef.current = getOrCreateExamSessionId();
  }, [attemptId, enabled]);

  const logExamEvent = useEffectEvent(
    (eventType: Parameters<typeof logger.logExamEvent>[1], metadata = {}) => {
      const activeAttemptId = latestAttemptIdRef.current;
      if (!enabled || !activeAttemptId) {
        return;
      }

      logger.logExamEvent(activeAttemptId, eventType, {
        attemptId: activeAttemptId,
        mode: monitoringModeRef.current,
        sessionId: sessionIdRef.current,
        ...metadata,
      });
    },
  );

  const compareFingerprint = useEffectEvent(
    async (reason: "heartbeat" | "resume") => {
      const activeAttemptId = latestAttemptIdRef.current;
      if (!enabled || !activeAttemptId) {
        return;
      }

      try {
        const currentFingerprint = await createBrowserFingerprintSnapshot();
        currentFingerprintRef.current = currentFingerprint;

        const storedFingerprint =
          baselineFingerprintRef.current ?? readStoredFingerprint(activeAttemptId);
        const storedSessionId = readStoredAttemptSessionId(activeAttemptId);

        if (!storedFingerprint) {
          baselineFingerprintRef.current = currentFingerprint;
          persistFingerprint(activeAttemptId, currentFingerprint);

          if (sessionIdRef.current) {
            persistAttemptSessionId(activeAttemptId, sessionIdRef.current);
          }
          return;
        }

        baselineFingerprintRef.current = storedFingerprint;

        const changedFields = diffFingerprintFields(
          storedFingerprint,
          currentFingerprint,
        );

        const sessionChanged =
          Boolean(storedSessionId) &&
          Boolean(sessionIdRef.current) &&
          storedSessionId !== sessionIdRef.current;

        if (changedFields.length === 0 && !sessionChanged) {
          return;
        }

        const allChangedFields = sessionChanged
          ? [...changedFields, "sessionId"]
          : changedFields;
        const signature = [
          storedFingerprint.hash,
          currentFingerprint.hash,
          allChangedFields.join(","),
          storedSessionId ?? "",
          sessionIdRef.current ?? "",
          reason,
        ].join("|");

        if (loggedDeviceChangeSignatureRef.current === signature) {
          return;
        }

        loggedDeviceChangeSignatureRef.current = signature;

        logExamEvent("device_change_suspected", {
          timestamp: new Date().toISOString(),
          reason,
          oldFingerprintHash: storedFingerprint.hash,
          newFingerprintHash: currentFingerprint.hash,
          changedFields: allChangedFields,
          previousSessionId: storedSessionId ?? null,
          currentSessionId: sessionIdRef.current,
        });
      } catch {
        // Fingerprint collection is best-effort only.
      }
    },
  );

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      await compareFingerprint("resume");

      if (cancelled || !attemptId) {
        return;
      }

      const currentFingerprint = currentFingerprintRef.current;
      if (!currentFingerprint) {
        return;
      }

      persistFingerprint(attemptId, currentFingerprint);
      if (sessionIdRef.current) {
        persistAttemptSessionId(attemptId, sessionIdRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId, compareFingerprint, enabled]);

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    const handleOffline = () => {
      setIsOnline(false);
      logExamEvent("connection_lost", {
        timestamp: new Date().toISOString(),
        online: false,
        fingerprintHash: currentFingerprintRef.current?.hash ?? null,
      });
    };

    const handleOnline = () => {
      setIsOnline(true);
      logExamEvent("connection_restored", {
        timestamp: new Date().toISOString(),
        online: true,
        fingerprintHash: currentFingerprintRef.current?.hash ?? null,
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [attemptId, enabled, logExamEvent]);

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        await compareFingerprint("heartbeat");

        logExamEvent("heartbeat", {
          timestamp: new Date().toISOString(),
          online: isOnlineRef.current,
          sessionId: sessionIdRef.current,
          fingerprintHash: currentFingerprintRef.current?.hash ?? null,
        });
      })();
    }, heartbeatIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [attemptId, compareFingerprint, enabled, heartbeatIntervalMs, logExamEvent]);

  const clearMonitoringState = useEffectEvent((targetAttemptId?: string | null) => {
    const resolvedAttemptId = targetAttemptId ?? latestAttemptIdRef.current;
    if (!resolvedAttemptId) {
      return;
    }

    clearStoredExamSessionMonitoringState(resolvedAttemptId);
    logger.clearQueue();
    baselineFingerprintRef.current = null;
    currentFingerprintRef.current = null;
    loggedDeviceChangeSignatureRef.current = null;
  });

  return {
    clearMonitoringState,
    isOnline,
    sessionId: sessionIdRef.current,
  };
}
