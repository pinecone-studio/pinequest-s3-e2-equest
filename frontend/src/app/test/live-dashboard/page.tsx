"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRuntimeJson } from "@/lib/runtime-api";
import { fetchTakeExamDashboard } from "@/lib/take-exam-dashboard-api";
import { TestShell } from "../_components/test-shell";
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
      const nextStatus = await fetchRuntimeJson<
        OllamaConnectionStatus & { message?: string }
      >("/api/ollama-teacher-feedback", {
        cache: "no-store",
      });

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

        const nextPayload = await fetchTakeExamDashboard(
          40,
          selectedExamId ?? null,
        );

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
        const nextAnalysis = await fetchRuntimeJson<
          ExamFocusAnalysis & { message?: string }
        >("/api/take-exam-focus-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: focusAnalysisRequestBody,
        });

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

  const handleRefresh = useCallback(() => {
    void loadDashboard(false);
    void loadOllamaStatus();
  }, [loadDashboard, loadOllamaStatus]);

  const headerTitle = selectedExamData?.exam?.title ?? "Шууд хяналтын самбар";
  const headerDescription = selectedExamData?.exam
    ? `${selectedExamData.exam.subject} • ${selectedExamData.exam.topic} • ${selectedExamData.exam.class}`
    : "Шалгалтуудаа нэг дороос сонгож, идэвхтэй явц ба үнэлгээний хяналтыг удирдана.";

  const headerMeta = (
    <>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
        <span>Систем идэвхтэй</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            ablyStatus
              ? getConnectionDotClass(ablyStatus.state)
              : "bg-muted-foreground/40"
          }`}
        />
        <span>{formatAblyStatusLabel(ablyStatus)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            ollamaStatus
              ? ollamaStatus.reachable && ollamaStatus.modelAvailable
                ? "bg-success"
                : "bg-warning"
              : "bg-muted-foreground/40"
          }`}
        />
        <span>{formatOllamaStatusLabel(ollamaStatus)}</span>
      </div>
      <span>Шинэчлэгдсэн {lastUpdated ? formatTimeAgo(lastUpdated) : "саяхан"}</span>
    </>
  );

  const headerActions = (
    <>
      {selectedExamId ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedExamId(null)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Жагсаалт руу
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={handleRefresh}>
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
        />
        Шинэчлэх
      </Button>
    </>
  );

  if (isLoading && !payload) {
    return (
      <TestShell
        title={headerTitle}
        description={headerDescription}
        meta={headerMeta}
        actions={headerActions}
      >
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-dashed border-border bg-card/70 px-6 text-sm text-muted-foreground">
          Live monitoring өгөгдөл ачаалж байна...
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell
      title={headerTitle}
      description={headerDescription}
      meta={headerMeta}
      actions={headerActions}
      contentClassName="pb-10"
    >
      {!selectedExamId || !selectedExamData?.exam ? (
        <div className="mx-auto w-full max-w-[1440px]">
          {error && (
            <div className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          <ExamSelector
            exams={exams}
            onSelectExam={(exam) => setSelectedExamId(exam.id)}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[1440px]">
          <ExamDashboard
            analytics={selectedExamData.analytics}
            students={selectedExamData.students}
            events={selectedExamData.events}
            attempts={selectedExamData.attempts}
            focusAnalysis={focusAnalysis}
            focusAnalysisError={focusAnalysisError}
            isFocusAnalysisLoading={isFocusAnalysisLoading}
            onApproveAttempt={handleRefresh}
            error={error}
          />
        </div>
      )}
    </TestShell>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSecs < 5) return "саяхан";
  if (diffSecs < 60) return `${diffSecs} секундын өмнө`;
  return `${Math.floor(diffSecs / 60)} минутын өмнө`;
}

function getConnectionDotClass(
  state: AblyConnectionStatus["state"],
): string {
  switch (state) {
    case "connected":
      return "bg-success";
    case "connecting":
    case "checking":
      return "bg-warning";
    case "disconnected":
    case "failed":
      return "bg-danger";
    default:
      return "bg-muted-foreground/40";
  }
}

function formatAblyStatusLabel(status: AblyConnectionStatus | null): string {
  if (!status) {
    return "Ably шалгаж байна";
  }

  switch (status.state) {
    case "connected":
      return "Ably realtime холбогдсон";
    case "connecting":
    case "checking":
      return "Ably realtime холбогдож байна";
    case "disconnected":
      return "Ably realtime тасарсан";
    case "failed":
      return "Ably realtime холбогдоогүй";
    default:
      return "Ably realtime шалгаж байна";
  }
}

function formatOllamaStatusLabel(status: OllamaConnectionStatus | null): string {
  if (!status) {
    return "Ollama AI шалгаж байна";
  }

  if (status.reachable && status.modelAvailable) {
    return `Ollama AI холбогдсон${status.model ? ` • ${status.model}` : ""}`;
  }

  if (status.reachable) {
    return "Ollama AI хүрч байна, model бэлэн биш";
  }

  return "Ollama AI холбогдоогүй";
}
