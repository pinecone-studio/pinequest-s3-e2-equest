"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildAblyAuthUrl } from "@/lib/runtime-api";
import {
  approveTakeExamAttempt,
  fetchTakeExamDashboard,
  fetchTakeExamLiveDashboardExam,
} from "@/lib/take-exam-dashboard-api";
import { TestShell } from "../_components/test-shell";
import { ExamProgressMonitoring } from "./_components/exam-progress-monitoring-mock";
import { ExamProgressOverview, type ExamProgressExamMeta } from "./_components/exam-progress-overview";
import {
  buildExamDashboardData,
  buildExamList,
  type DashboardApiPayload,
} from "../live-dashboard/lib/dashboard-adapters";
import type { AblyConnectionStatus } from "../live-dashboard/lib/types";
import type { QuestionReview, SubmittedAttempt } from "../live-dashboard/lib/types";

const ACTIVE_POLL_INTERVAL_MS = 4_000;
const OVERVIEW_POLL_INTERVAL_MS = 8_000;
const EMPTY_DASHBOARD_PAYLOAD: DashboardApiPayload = {
  availableTests: [],
  attempts: [],
  liveMonitoringFeed: [],
  testMaterial: null,
};

export default function ExamProgressPage() {
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [approvingAttemptId, setApprovingAttemptId] = useState<string | null>(null);
  const [ablyStatus, setAblyStatus] = useState<AblyConnectionStatus | null>(
    null,
  );
  const dashboardRequestIdRef = useRef(0);
  const realtimeRefreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith("test-exam-progress-dashboard:")) {
        window.sessionStorage.removeItem(key);
      }
    }
  }, []);

  const loadDashboard = useCallback(async ({
    force = false,
    showLoader = false,
  }: {
    force?: boolean;
    showLoader?: boolean;
  } = {}) => {
    const requestId = dashboardRequestIdRef.current + 1;
    dashboardRequestIdRef.current = requestId;
    const shouldShowLoader = showLoader;

    if (shouldShowLoader) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const nextPayload = selectedExamId
        ? await fetchTakeExamLiveDashboardExam(
            40,
            selectedExamId,
            undefined,
            { forceRefresh: force },
          )
        : await fetchTakeExamDashboard(40, null, undefined, {
            forceRefresh: force,
          });
      if (dashboardRequestIdRef.current !== requestId) {
        return;
      }

      setPayload(nextPayload);
      setError(null);
    } catch (nextError) {
      if (dashboardRequestIdRef.current !== requestId) {
        return;
      }

      setError(
        nextError instanceof Error
          ? nextError.message
          : "Шалгалтын явц ачаалах үед алдаа гарлаа.",
      );
    } finally {
      if (dashboardRequestIdRef.current === requestId) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedExamId]);

  useEffect(() => {
    void loadDashboard({ force: true, showLoader: true });
  }, [loadDashboard]);

  useEffect(() => {
    return () => {
      dashboardRequestIdRef.current += 1;
    };
  }, []);

  const exams = useMemo(
    () => buildExamList(payload ?? EMPTY_DASHBOARD_PAYLOAD),
    [payload],
  );
  const hasAnyActiveExam = useMemo(
    () => exams.some((exam) => exam.liveStudentCount > 0),
    [exams],
  );
  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  );
  const handleForceRefresh = useCallback(() => {
    void loadDashboard({ force: true });
  }, [loadDashboard]);
  const handleApproveAttempt = useCallback(
    async (attempt: SubmittedAttempt) => {
      setError(null);
      setApprovingAttemptId(attempt.id);

      try {
        await approveTakeExamAttempt({
          attemptId: attempt.id,
          review: {
            questionReviews: attempt.questions.map((question) => ({
              explanation: buildAttemptReviewExplanation(question),
              isCorrect: question.reviewState === "correct",
              maxPoints: question.maxPoints,
              pointsAwarded: clampAttemptReviewPoints(
                question.points,
                question.maxPoints,
              ),
              questionId: question.id,
            })),
          },
        });

        await loadDashboard({ force: true });
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Шалгалтын дүн батлах үед алдаа гарлаа.",
        );
        throw nextError;
      } finally {
        setApprovingAttemptId(null);
      }
    },
    [loadDashboard],
  );
  const headerBreadcrumb = (
    <div className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px]">
      Шалгалтын явц
    </div>
  );
  const pollIntervalMs = useMemo(() => {
    if (selectedExam) {
      return selectedExam.liveStudentCount > 0
        ? ACTIVE_POLL_INTERVAL_MS
        : OVERVIEW_POLL_INTERVAL_MS;
    }

    return hasAnyActiveExam ? ACTIVE_POLL_INTERVAL_MS : OVERVIEW_POLL_INTERVAL_MS;
  }, [hasAnyActiveExam, selectedExam]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadDashboard({ force: true });
    }, pollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDashboard, pollIntervalMs]);

  useEffect(() => {
    const authUrl = buildAblyAuthUrl();
    let isActive = true;
    let cleanup: (() => void) | null = null;
    setAblyStatus({
      lastCheckedAt: new Date().toISOString(),
      state: "checking",
    });

    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimeoutRef.current !== null) {
        return;
      }

      realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null;
        void loadDashboard({ force: true });
      }, 350);
    };

    void import("ably")
      .then((mod) => {
        if (!isActive) {
          return;
        }

        const AblyModule: typeof import("ably") =
          "default" in mod ? mod.default : mod;
        const realtime = new AblyModule.Realtime({
          authMethod: "POST",
          authUrl,
        });
        const channel = realtime.channels.get(
          selectedExamId ? `exam-monitoring:${selectedExamId}` : "exam-monitoring",
        );
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
          const nextState = normalizeAblyConnectionState(change.current);

          if (!nextState) {
            return;
          }

          if (nextState === "connected") {
            setAblyStatus({
              lastCheckedAt: timestamp,
              state: "connected",
            });
            return;
          }

          if (nextState === "connecting" || nextState === "checking") {
            setAblyStatus({
              lastCheckedAt: timestamp,
              state: nextState,
            });
            return;
          }

          if (nextState === "failed") {
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
            state: nextState,
          });
        };
        let didDisposeRealtime = false;
        const disposeRealtime = () => {
          if (didDisposeRealtime) {
            return;
          }
          didDisposeRealtime = true;

          try {
            realtime.connection.off(handleConnectionState);
          } catch {
            // Ignore realtime listener cleanup failures.
          }

          try {
            for (const eventName of subscribedEvents) {
              channel.unsubscribe(eventName, handleRealtimeMessage);
            }
          } catch {
            // Ignore realtime channel cleanup failures.
          }

          const currentState = realtime.connection.state;
          if (
            currentState === "closed" ||
            currentState === "closing" ||
            currentState === "failed"
          ) {
            return;
          }

          try {
            realtime.close();
          } catch {
            // Ignore realtime close failures.
          }
        };

        cleanup = disposeRealtime;

        try {
          realtime.connection.on(handleConnectionState);
          handleConnectionState({
            current: realtime.connection.state,
            reason: realtime.connection.errorReason ?? undefined,
          });
        } catch (nextError) {
          setAblyStatus({
            error:
              nextError instanceof Error
                ? nextError.message
                : "Ably realtime subscription эхлүүлж чадсангүй.",
            lastCheckedAt: new Date().toISOString(),
            state: "failed",
          });
          disposeRealtime();
          return;
        }

        void channel
          .subscribe([...subscribedEvents], handleRealtimeMessage)
          .then(() => {
            if (!isActive) {
              disposeRealtime();
            }
          })
          .catch((nextError) => {
            if (!isActive || didDisposeRealtime) {
              return;
            }

            setAblyStatus({
              error:
                nextError instanceof Error
                  ? nextError.message
                  : "Ably realtime subscription эхлүүлж чадсангүй.",
              lastCheckedAt: new Date().toISOString(),
              state: "failed",
            });
            disposeRealtime();
          });
      })
      .catch((nextError) => {
        setAblyStatus({
          error:
            nextError instanceof Error
              ? nextError.message
              : "Ably realtime эхлүүлж чадсангүй.",
          lastCheckedAt: new Date().toISOString(),
          state: "failed",
        });
        // Polling remains the fallback.
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
  const activityExamIds = useMemo(() => {
    const ids = new Set<string>();

    for (const attempt of payload?.attempts ?? []) {
      ids.add(attempt.testId);
    }

    for (const feedItem of payload?.liveMonitoringFeed ?? []) {
      ids.add(feedItem.testId);
    }

    return ids;
  }, [payload]);
  const progressExams = useMemo(
    () =>
      exams
        .filter((exam) => activityExamIds.has(exam.id))
        .sort((left, right) => right.startTime.getTime() - left.startTime.getTime()),
    [activityExamIds, exams],
  );
  const selectedExamData = useMemo(
    () =>
      selectedExamId && payload
        ? buildExamDashboardData(payload, selectedExamId)
        : null,
    [payload, selectedExamId],
  );
  const selectedExamLastUpdated = useMemo(() => {
    if (!selectedExamData?.exam) {
      return null;
    }

    const timestamps = [
      ...selectedExamData.events.map((event) => event.timestamp.getTime()),
      ...selectedExamData.attempts.map((attempt) => attempt.submissionTime.getTime()),
      ...selectedExamData.students.map((student) => student.lastActivity.getTime()),
      selectedExamData.exam.startTime.getTime(),
    ].filter((value) => Number.isFinite(value));

    const latestTimestamp = timestamps.sort((left, right) => right - left)[0];

    return typeof latestTimestamp === "number"
      ? new Date(latestTimestamp)
      : null;
  }, [selectedExamData]);
  const selectedExamHasActiveSystem = useMemo(
    () =>
      selectedExamData?.students.some(
        (student) =>
          student.status === "in-progress" || student.status === "processing",
      ) ?? false,
    [selectedExamData],
  );
  const examMetaById = useMemo<Record<string, ExamProgressExamMeta>>(() => {
    const result: Record<string, ExamProgressExamMeta> = {};

    for (const exam of progressExams) {
      const examAttempts = payload?.attempts.filter((attempt) => attempt.testId === exam.id) ?? [];
      const latestActivityMs = examAttempts
        .map((attempt) => {
          const recentEventMs = (attempt.monitoring?.recentEvents ?? [])
            .map((event) => new Date(event.occurredAt).getTime())
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => right - left)[0];

          const submittedMs = attempt.submittedAt
            ? new Date(attempt.submittedAt).getTime()
            : undefined;
          const startedMs = new Date(attempt.startedAt).getTime();

          return recentEventMs ?? submittedMs ?? startedMs;
        })
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => right - left)[0];

      const pendingReviewCount = examAttempts.filter(
        (attempt) => attempt.status === "submitted" || attempt.status === "processing",
      ).length;
      const approvedCount = examAttempts.filter(
        (attempt) => attempt.status === "approved",
      ).length;

      result[exam.id] = {
        reviewState:
          pendingReviewCount > 0 ? "pending" : approvedCount > 0 ? "approved" : null,
        updatedAgo:
          typeof latestActivityMs === "number" && Number.isFinite(latestActivityMs)
            ? formatTimeAgo(new Date(latestActivityMs))
            : null,
      };
    }

    return result;
  }, [payload, progressExams]);

  useEffect(() => {
    if (selectedExamId && !progressExams.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(null);
    }
  }, [progressExams, selectedExamId]);

  if (selectedExam && selectedExamData?.exam) {
    return (
      <TestShell
        breadcrumb={headerBreadcrumb}
        breadcrumbItems={[]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceRefresh}
            className="h-10 rounded-[14px] px-4 text-[15px] font-semibold"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Шинэчлэх
          </Button>
        }
        compactSidebar
        contentClassName="pb-8"
        description={`${selectedExam.subject} • ${selectedExam.topic} • ${selectedExam.class}`}
        isTeacherRefreshing={isRefreshing}
        meta={
          <>
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  selectedExamHasActiveSystem ? "bg-[#17a34a]" : "bg-slate-400"
                }`}
              />
              {selectedExamHasActiveSystem ? "Систем идэвхтэй" : "Систем идэвхгүй"}
            </span>
            <span>|</span>
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${getConnectionDotClass(
                  ablyStatus?.state,
                )}`}
              />
              {formatAblyStatusLabel(ablyStatus)}
            </span>
            <span>|</span>
            <span>
              {selectedExamLastUpdated
                ? `${formatTimeAgo(selectedExamLastUpdated)} шинэчлэгдсэн`
                : "Шинэчлэлтийн мэдээлэл алга"}
            </span>
          </>
        }
        onTeacherRefresh={handleForceRefresh}
        sidebarCollapsible
        teacherVariant="none"
        title={selectedExam.title}
      >
        <div className="mx-auto w-full max-w-[1460px]">
          <ExamProgressMonitoring
            exam={selectedExamData.exam}
            events={selectedExamData.events}
            isApprovingAttemptId={approvingAttemptId}
            lastUpdated={selectedExamLastUpdated}
            onBack={() => setSelectedExamId(null)}
            onApproveAttempt={handleApproveAttempt}
            reviewAttempts={selectedExamData.attempts}
            students={selectedExamData.students}
          />
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell
      breadcrumb={headerBreadcrumb}
      breadcrumbItems={[]}
      title="Шалгалтын явц"
      isTeacherRefreshing={isRefreshing}
      onTeacherRefresh={handleForceRefresh}
      sidebarCollapsible
      teacherVariant="live"
    >
      <div className="mx-auto w-full max-w-[1460px]">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading && !payload ? (
          <div className="flex min-h-[60vh] items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-6 text-sm text-slate-500">
            Шалгалтын явц ачаалж байна...
          </div>
        ) : (
          <ExamProgressOverview
            examMetaById={examMetaById}
            exams={progressExams}
            onSelectExam={(exam) => setSelectedExamId(exam.id)}
          />
        )}
      </div>
    </TestShell>
  );
}

function clampAttemptReviewPoints(points: number, maxPoints: number) {
  return Math.min(Math.max(points, 0), maxPoints);
}

function buildAttemptReviewExplanation(question: QuestionReview) {
  const explanation = question.explanation?.trim();
  if (explanation) {
    return explanation;
  }

  const aiAnalysis = question.aiAnalysis?.trim();
  if (aiAnalysis) {
    return aiAnalysis;
  }

  const correctAnswer = question.correctAnswer?.trim();
  return correctAnswer || null;
}

function formatTimeAgo(date: Date): string {
  const diffSecs = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );

  if (diffSecs < 60) {
    return `${diffSecs || 1} сек өмнө`;
  }

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `${diffMins} мин өмнө`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} цаг өмнө`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} өдрийн өмнө`;
}

function getConnectionDotClass(state?: AblyConnectionStatus["state"]): string {
  switch (state) {
    case "connected":
      return "bg-[#17a34a]";
    case "connecting":
    case "checking":
      return "bg-[#f59e0b]";
    case "disconnected":
    case "failed":
      return "bg-[#dc2626]";
    default:
      return "bg-slate-400";
  }
}

function normalizeAblyConnectionState(
  state?: string,
): AblyConnectionStatus["state"] | null {
  switch (state) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting";
    case "initialized":
    case "closing":
    case "closed":
      return "checking";
    case "disconnected":
    case "suspended":
      return "disconnected";
    case "failed":
      return "failed";
    default:
      return state ? "checking" : null;
  }
}

function formatAblyStatusLabel(status: AblyConnectionStatus | null): string {
  if (!status) {
    return "Шууд холболтыг шалгаж байна";
  }

  switch (status.state) {
    case "connected":
      return "Шууд холболт идэвхтэй";
    case "connecting":
    case "checking":
      return "Шууд холболт тогтоож байна";
    case "disconnected":
      return "Шууд холболт тасарсан";
    case "failed":
      return "Шууд холболт тогтсонгүй";
    default:
      return "Шууд холболтыг шалгаж байна";
  }
}
