"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExamSelector } from "./_components/exam-selector";
import { ExamDashboard } from "./_components/exam-dashboard";
import {
  buildExamDashboardData,
  buildExamList,
  type DashboardApiPayload,
} from "./lib/dashboard-adapters";
import type {
  AblyConnectionStatus,
  ExamFocusAnalysis,
  OllamaConnectionStatus,
} from "./lib/types";

const POLL_INTERVAL_MS = 15_000;

export default function ExamMonitoringApp() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [focusAnalysis, setFocusAnalysis] = useState<ExamFocusAnalysis | null>(
    null,
  );
  const [focusAnalysisError, setFocusAnalysisError] = useState<string | null>(
    null,
  );
  const [isFocusAnalysisLoading, setIsFocusAnalysisLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] =
    useState<OllamaConnectionStatus | null>(null);
  const [ablyStatus, setAblyStatus] = useState<AblyConnectionStatus | null>(
    null,
  );
  const realtimeRefreshTimeoutRef = useRef<number | null>(null);

  const loadOllamaStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/ollama-teacher-feedback", {
        cache: "no-store",
      });
      const nextStatus = (await response.json()) as OllamaConnectionStatus & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          nextStatus.message ?? "Ollama AI төлөв шалгаж чадсангүй.",
        );
      }

      setOllamaStatus(nextStatus);
    } catch (nextError) {
      setOllamaStatus({
        error:
          nextError instanceof Error
            ? nextError.message
            : "Ollama AI төлөв шалгаж чадсангүй.",
        model: "llama3.1:latest",
        modelAvailable: false,
        reachable: false,
      });
    }
  }, []);

  const loadDashboard = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams({ limit: "40" });
        if (selectedExamId) {
          params.set("testId", selectedExamId);
        }

        const response = await fetch(`/api/take-exam-dashboard?${params}`, {
          cache: "no-store",
        });
        const nextPayload = (await response.json()) as DashboardApiPayload & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(
            nextPayload.message ?? "Dashboard өгөгдөл ачаалж чадсангүй.",
          );
        }

        setPayload(nextPayload);
        setError(null);
        setLastUpdated(new Date());
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Dashboard ачаалах үед алдаа гарлаа.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedExamId],
  );

  useEffect(() => {
    void loadDashboard(true);
    void loadOllamaStatus();

    const intervalId = window.setInterval(() => {
      void loadDashboard(false);
      void loadOllamaStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDashboard, loadOllamaStatus]);

  const exams = useMemo(() => buildExamList(payload ?? {
    availableTests: [],
    attempts: [],
    liveMonitoringFeed: [],
    testMaterial: null,
  }), [payload]);

  const selectedExamData = useMemo(
    () =>
      selectedExamId && payload
        ? buildExamDashboardData(payload, selectedExamId)
        : null,
    [payload, selectedExamId],
  );

  const selectedExamPayload = useMemo(() => {
    if (!selectedExamId || !payload) {
      return null;
    }

    return {
      attempts: payload.attempts.filter((attempt) => attempt.testId === selectedExamId),
      exam:
        payload.availableTests.find((test) => test.id === selectedExamId) ?? null,
      testMaterial:
        payload.testMaterial?.testId === selectedExamId ? payload.testMaterial : null,
    };
  }, [payload, selectedExamId]);

  const focusAnalysisKey = useMemo(() => {
    if (!selectedExamPayload?.exam) {
      return null;
    }

    return JSON.stringify({
      examId: selectedExamPayload.exam.id,
      attempts: selectedExamPayload.attempts.map((attempt) => ({
        attemptId: attempt.attemptId,
        questionResultCount: attempt.result?.questionResults.length ?? 0,
        score: attempt.result?.score ?? attempt.score ?? null,
        status: attempt.status,
        submittedAt: attempt.submittedAt ?? null,
      })),
      questionCount: selectedExamPayload.testMaterial?.questions.length ?? 0,
    });
  }, [selectedExamPayload]);

  const focusAnalysisRequestBody = useMemo(() => {
    if (!selectedExamPayload?.exam) {
      return null;
    }

    return JSON.stringify({
      attempts: selectedExamPayload.attempts.map((attempt) => ({
        answerReview: attempt.answerReview,
        result: attempt.result,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
      })),
      exam: {
        id: selectedExamPayload.exam.id,
        subject: selectedExamPayload.exam.criteria.subject,
        title: selectedExamPayload.exam.title,
        topic: selectedExamPayload.exam.criteria.topic,
      },
      testMaterial: selectedExamPayload.testMaterial
        ? {
            questions: selectedExamPayload.testMaterial.questions.map((question) => ({
              competency: question.competency,
              points: question.points,
              prompt: question.prompt,
              questionId: question.questionId,
              type: question.type,
            })),
          }
        : null,
    });
  }, [selectedExamPayload]);

  useEffect(() => {
    if (!selectedExamId) {
      return;
    }

    if (!selectedExamData?.exam) {
      setSelectedExamId(null);
    }
  }, [selectedExamData?.exam, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) {
      setAblyStatus(null);
      return;
    }

    const authUrl = process.env.NEXT_PUBLIC_ABLY_AUTH_URL || "/api/ably/auth";
    let isActive = true;
    let cleanup: (() => void) | null = null;
    setAblyStatus({
      lastCheckedAt: new Date().toISOString(),
      state: "connecting",
    });

    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimeoutRef.current !== null) {
        return;
      }

      realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null;
        void loadDashboard(false);
      }, 350);
    };

    void import("ably")
      .then((mod) => {
        if (!isActive) {
          return;
        }

        const Ably = (mod.default ?? mod) as any;
        const realtime = new Ably.Realtime({
          authUrl,
          authMethod: "POST",
        });
        const channel = realtime.channels.get(`exam-monitoring:${selectedExamId}`);
        const subscribedEvents = [
          "attempt.started",
          "attempt.saved",
          "attempt.submitted",
          "attempt.approved",
          "monitoring.updated",
        ] as const;
        const handleRealtimeMessage = () => {
          scheduleRealtimeRefresh();
        };
        const handleConnectionState = (change: {
          current?: string;
          reason?: { message?: string };
        }) => {
          if (!isActive) {
            return;
          }

          const timestamp = new Date().toISOString();

          if (change.current === "connected") {
            setAblyStatus({
              lastCheckedAt: timestamp,
              state: "connected",
            });
            return;
          }

          if (change.current === "connecting") {
            setAblyStatus({
              lastCheckedAt: timestamp,
              state: "connecting",
            });
            return;
          }

          if (change.current === "failed") {
            setAblyStatus({
              error: change.reason?.message ?? "Ably auth эсвэл network алдаа.",
              lastCheckedAt: timestamp,
              state: "failed",
            });
            return;
          }

          setAblyStatus({
            error: change.reason?.message,
            lastCheckedAt: timestamp,
            state: "disconnected",
          });
        };

        try {
          for (const eventName of subscribedEvents) {
            channel.subscribe(eventName, handleRealtimeMessage);
          }
          realtime.connection.on(handleConnectionState);
        } catch (error) {
          setAblyStatus({
            error:
              error instanceof Error
                ? error.message
                : "Ably realtime subscription эхлүүлж чадсангүй.",
            lastCheckedAt: new Date().toISOString(),
            state: "failed",
          });
          try {
            realtime.close();
          } catch {
            // Ignore realtime cleanup failures.
          }
          return;
        }

        cleanup = () => {
          try {
            realtime.connection.off(handleConnectionState);
            for (const eventName of subscribedEvents) {
              channel.unsubscribe(eventName, handleRealtimeMessage);
            }
            realtime.close();
          } catch {
            // Ignore realtime cleanup failures.
          }
        };
      })
      .catch((error) => {
        setAblyStatus({
          error:
            error instanceof Error
              ? error.message
              : "Ably realtime эхлүүлж чадсангүй.",
          lastCheckedAt: new Date().toISOString(),
          state: "failed",
        });
        // Ignore realtime init failures; polling remains the fallback.
      });

    return () => {
      isActive = false;
      if (realtimeRefreshTimeoutRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      cleanup?.();
    };
  }, [loadDashboard, selectedExamId]);

  useEffect(() => {
    if (!focusAnalysisRequestBody || !focusAnalysisKey) {
      setFocusAnalysis(null);
      setFocusAnalysisError(null);
      setIsFocusAnalysisLoading(false);
      return;
    }

    let isCancelled = false;

    const runFocusAnalysis = async () => {
      setIsFocusAnalysisLoading(true);
      setFocusAnalysisError(null);

      try {
        const response = await fetch("/api/take-exam-focus-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: focusAnalysisRequestBody,
        });

        const nextAnalysis = (await response.json()) as ExamFocusAnalysis & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(
            nextAnalysis.message ?? "AI focus analysis үүсгэж чадсангүй.",
          );
        }

        if (!isCancelled) {
          setFocusAnalysis(nextAnalysis);
        }
      } catch (nextError) {
        if (!isCancelled) {
          setFocusAnalysis(null);
          setFocusAnalysisError(
            nextError instanceof Error
              ? nextError.message
              : "AI focus analysis ачаалж чадсангүй.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsFocusAnalysisLoading(false);
        }
      }
    };

    void runFocusAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [focusAnalysisKey, focusAnalysisRequestBody]);

  if (isLoading && !payload) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center justify-center px-6 text-sm text-muted-foreground">
        Live monitoring өгөгдөл ачаалж байна...
      </div>
    );
  }

  if (!selectedExamId || !selectedExamData?.exam) {
    return (
      <div className="mx-auto w-full max-w-[1440px]">
        <ExamSelector exams={exams} onSelectExam={(exam) => setSelectedExamId(exam.id)} />
        {error && (
          <div className="px-6 pb-8 text-sm text-danger">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <ExamDashboard
        analytics={selectedExamData.analytics}
        exam={selectedExamData.exam}
        students={selectedExamData.students}
        events={selectedExamData.events}
        attempts={selectedExamData.attempts}
        focusAnalysis={focusAnalysis}
        focusAnalysisError={focusAnalysisError}
        isFocusAnalysisLoading={isFocusAnalysisLoading}
        ablyStatus={ablyStatus}
        ollamaStatus={ollamaStatus}
        onBack={() => setSelectedExamId(null)}
        onApproveAttempt={() => {
          void loadDashboard(false);
          void loadOllamaStatus();
        }}
        onRefresh={() => {
          void loadDashboard(false);
          void loadOllamaStatus();
        }}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        error={error}
      />
    </div>
  );
}
