"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRuntimeJson } from "@/lib/runtime-api";
import { fetchTakeExamDashboard } from "@/lib/take-exam-dashboard-api";
import { TestShell } from "../_components/test-shell";
import type { BreadcrumbItem } from "../_components/test-header-bar";
import { ExamDashboard } from "./_components/exam-dashboard";
import { TeacherExamGallery } from "./_components/teacher-exam-gallery";
import {
  buildExamDashboardData,
  type DashboardApiPayload,
} from "./lib/dashboard-adapters";
import type {
  AblyConnectionStatus,
  Exam,
  ExamFocusAnalysis,
  OllamaConnectionStatus,
} from "./lib/types";

const POLL_INTERVAL_MS = 15_000;
const CREATED_EXAMS_CACHE_KEY = "test-live-dashboard-created-exams";
const CREATED_EXAMS_CACHE_TTL_MS = 2 * 60 * 1000;
const CREATE_EXAM_LIST_QUERY = `
  query FrontendListNewMathExams($limit: Int = 40) {
    listNewMathExams(limit: $limit) {
      examId
      title
      durationMinutes
      updatedAt
    }
  }
`;
const CREATE_EXAM_DETAIL_QUERY = `
  query FrontendGetNewMathExam($examId: ID!) {
    getNewMathExam(examId: $examId) {
      examId
      title
      createdAt
      updatedAt
      mathCount
      mcqCount
      sessionMeta {
        durationMinutes
        examType
        grade
        groupClass
        subject
        topics
      }
    }
  }
`;
type CreatedExamListApiResponse = {
  exams: Array<{
    class: string;
    durationMinutes?: number | null;
    endTime?: string | null;
    examType?: string | null;
    id: string;
    questionCount: number;
    startTime: string;
    subject: string;
    title: string;
    topic: string;
  }>;
};

export default function ExamMonitoringApp() {
  const router = useRouter();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [createdExams, setCreatedExams] = useState<Exam[]>([]);
  const [createdExamsError, setCreatedExamsError] = useState<string | null>(
    null,
  );
  const [isCreatedExamsLoading, setIsCreatedExamsLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
  const createdExamsRequestIdRef = useRef(0);
  const realtimeRefreshTimeoutRef = useRef<number | null>(null);

  const loadCreatedExams = useCallback(async () => {
    const requestId = createdExamsRequestIdRef.current + 1;
    createdExamsRequestIdRef.current = requestId;

    const cachedExams = readCreatedExamsCache();
    if (cachedExams) {
      setCreatedExams(cachedExams);
      setCreatedExamsError(null);
      setIsCreatedExamsLoading(false);
      return;
    }

    setIsCreatedExamsLoading(true);

    try {
      let listResult: CreatedExamListApiResponse;

      try {
        listResult = await fetchRuntimeJson<CreatedExamListApiResponse>(
          "/api/create-exam-list?limit=40",
          {
            cache: "no-store",
          },
        );
      } catch {
        listResult = await fetchCreatedExamsDirect();
      }

      if (createdExamsRequestIdRef.current !== requestId) {
        return;
      }

      const nextCreatedExams = listResult.exams
        .map((exam) => mapApiCreatedExamToExam(exam))
        .sort(sortCreatedExamsByStartTime);

      setCreatedExams(nextCreatedExams);
      setCreatedExamsError(null);
      setIsCreatedExamsLoading(false);
    } catch (nextError) {
      if (createdExamsRequestIdRef.current !== requestId) {
        return;
      }

      setCreatedExams([]);
      setCreatedExamsError(
        nextError instanceof Error
          ? nextError.message
          : "Үүсгэсэн шалгалтуудыг ачаалж чадсангүй.",
      );
    } finally {
      if (createdExamsRequestIdRef.current === requestId) {
        setIsCreatedExamsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (createdExams.length === 0) {
      return;
    }

    writeCreatedExamsCache(createdExams);
  }, [createdExams]);

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
      if (!selectedExamId) {
        return;
      }

      if (showLoader) {
        setIsLoading(true);
        setPayload(null);
        setDashboardError(null);
        setLastUpdated(null);
      } else {
        setIsRefreshing(true);
      }

      try {
        const nextPayload = await fetchTakeExamDashboard(40, selectedExamId);

        setPayload(nextPayload);
        setDashboardError(null);
        setLastUpdated(new Date());
      } catch (nextError) {
        setDashboardError(
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
    void loadCreatedExams();
  }, [loadCreatedExams]);

  useEffect(() => {
    if (!selectedExamId) {
      setPayload(null);
      setDashboardError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      setLastUpdated(null);
      setOllamaStatus(null);
      return;
    }

    void loadDashboard(true);
    void loadOllamaStatus();

    const intervalId = window.setInterval(() => {
      void loadDashboard(false);
      void loadOllamaStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDashboard, loadOllamaStatus, selectedExamId]);

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
      attempts: payload.attempts.filter(
        (attempt) => attempt.testId === selectedExamId,
      ),
      exam:
        payload.availableTests.find((test) => test.id === selectedExamId) ??
        null,
      testMaterial:
        payload.testMaterial?.testId === selectedExamId
          ? payload.testMaterial
          : null,
    };
  }, [payload, selectedExamId]);

  const selectedCreatedExam = useMemo(
    () => createdExams.find((exam) => exam.id === selectedExamId) ?? null,
    [createdExams, selectedExamId],
  );

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
            questions: selectedExamPayload.testMaterial.questions.map(
              (question) => ({
                competency: question.competency,
                points: question.points,
                prompt: question.prompt,
                questionId: question.questionId,
                type: question.type,
              }),
            ),
          }
        : null,
    });
  }, [selectedExamPayload]);

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

        const AblyModule: typeof import("ably") =
          "default" in mod ? mod.default : mod;
        const realtime = new AblyModule.Realtime({
          authUrl,
          authMethod: "POST",
        });
        const channel = realtime.channels.get(
          `exam-monitoring:${selectedExamId}`,
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
          disposeRealtime();
          return;
        }

        cleanup = disposeRealtime;
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
    if (!selectedExamId) {
      return;
    }

    void loadDashboard(false);
    void loadOllamaStatus();
  }, [loadDashboard, loadOllamaStatus, selectedExamId]);

  const headerTitle =
    selectedExamData?.exam?.title ??
    selectedCreatedExam?.title ??
    "Шууд хяналтын самбар";
  const headerDescription = selectedExamData?.exam
    ? `${selectedExamData.exam.subject} • ${selectedExamData.exam.topic} • ${selectedExamData.exam.class}`
    : selectedCreatedExam
      ? `${selectedCreatedExam.subject} • ${selectedCreatedExam.topic} • ${selectedCreatedExam.class}`
      : "Шалгалтуудаа нэг дороос сонгож, идэвхтэй явц ба үнэлгээний хяналтыг удирдана.";
  const breadcrumbItems: BreadcrumbItem[] = selectedExamId
    ? [
        { href: "/test/live-dashboard", label: "Нүүр" },
        { href: "/test/live-dashboard", label: "Миний шалгалтууд" },
        { active: true, label: headerTitle },
      ]
    : [];

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
      <span>
        Шинэчлэгдсэн {lastUpdated ? formatTimeAgo(lastUpdated) : "саяхан"}
      </span>
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

  if (isCreatedExamsLoading) {
    return (
      <TestShell
        breadcrumbItems={breadcrumbItems}
        title="Миний шалгалтууд"
        sidebarCollapsible
        teacherVariant="switcher"
      >
        <div className="flex min-h-full items-center justify-center px-8 py-10">
          <div className="flex min-h-[60vh] w-full items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-6 text-sm text-slate-500">
            Үүсгэсэн шалгалтуудыг ачаалж байна...
          </div>
        </div>
      </TestShell>
    );
  }

  if (!selectedExamId) {
    return (
      <TestShell
        breadcrumbItems={breadcrumbItems}
        title="Миний шалгалтууд"
        sidebarCollapsible
        teacherVariant="switcher"
      >
        <TeacherExamGallery
          exams={createdExams}
          error={createdExamsError}
          onSelectExam={(exam) =>
            router.push(
              `/test/material-builder?examId=${encodeURIComponent(exam.id)}`,
            )
          }
        />
      </TestShell>
    );
  }

  if (isLoading && !payload) {
    return (
      <TestShell
        breadcrumbItems={breadcrumbItems}
        title={headerTitle}
        description={headerDescription}
        actions={headerActions}
        teacherVariant="live"
      >
        <div className="flex min-h-full items-center justify-center px-8 py-10">
          <div className="flex min-h-[60vh] w-full items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-6 text-sm text-slate-500">
            Live monitoring өгөгдөл ачаалж байна...
          </div>
        </div>
      </TestShell>
    );
  }

  if (!selectedExamData?.exam) {
    return (
      <TestShell
        breadcrumbItems={breadcrumbItems}
        title={headerTitle}
        description={headerDescription}
        actions={headerActions}
        teacherVariant="live"
      >
        <div className="px-8 py-10">
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
            Энэ шалгалтын live monitoring өгөгдөл одоогоор take-exam-service
            дээр олдсонгүй.
          </div>
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell
      breadcrumbItems={breadcrumbItems}
      title={headerTitle}
      description={headerDescription}
      meta={headerMeta}
      actions={headerActions}
      contentClassName="pb-10"
      teacherVariant="live"
    >
      <div className="w-full">
        <ExamDashboard
          analytics={selectedExamData.analytics}
          students={selectedExamData.students}
          events={selectedExamData.events}
          attempts={selectedExamData.attempts}
          focusAnalysis={focusAnalysis}
          focusAnalysisError={focusAnalysisError}
          isFocusAnalysisLoading={isFocusAnalysisLoading}
          onApproveAttempt={handleRefresh}
          error={dashboardError}
        />
      </div>
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

function getConnectionDotClass(state: AblyConnectionStatus["state"]): string {
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

function formatOllamaStatusLabel(
  status: OllamaConnectionStatus | null,
): string {
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

function mapApiCreatedExamToExam(
  exam: CreatedExamListApiResponse["exams"][number],
): Exam {
  return {
    averageScore: undefined,
    class: exam.class,
    endTime: exam.endTime ? parseExamDate(exam.endTime) : undefined,
    id: exam.id,
    liveStudentCount: 0,
    questionCount: exam.questionCount,
    startTime: parseExamDate(exam.startTime),
    subject: exam.subject,
    title: exam.title,
    topic: exam.topic,
    totalStudentCount: 0,
  };
}

async function fetchCreatedExamsDirect(): Promise<CreatedExamListApiResponse> {
  const targetUrl =
    process.env.NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL?.trim() ||
    "https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

  const listResponse = await fetch(targetUrl, {
    body: JSON.stringify({
      query: CREATE_EXAM_LIST_QUERY,
      variables: { limit: 40 },
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const listPayload = (await listResponse.json()) as {
    data?: {
      listNewMathExams?: Array<{
        durationMinutes?: number | null;
        examId: string;
        title: string;
        updatedAt: string;
      }>;
    };
    errors?: Array<{ message?: string }>;
  };

  if (!listResponse.ok || listPayload.errors?.length || !listPayload.data) {
    throw new Error(
      listPayload.errors?.[0]?.message ??
        "Create exam service-ээс шалгалтын жагсаалт авч чадсангүй.",
    );
  }

  const summaries = listPayload.data.listNewMathExams ?? [];
  const details = await Promise.allSettled(
    summaries.map((summary) =>
      fetch(targetUrl, {
        body: JSON.stringify({
          query: CREATE_EXAM_DETAIL_QUERY,
          variables: { examId: summary.examId },
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).then(async (response) => {
        const payload = (await response.json()) as {
          data?: {
            getNewMathExam?: {
              createdAt?: string | null;
              examId: string;
              mathCount?: number | null;
              mcqCount?: number | null;
              sessionMeta?: {
                durationMinutes?: number | null;
                examType?: string | null;
                grade?: number | null;
                groupClass?: string | null;
                subject?: string | null;
                topics?: string[] | null;
              } | null;
              title: string;
              updatedAt?: string | null;
            } | null;
          };
        };

        return payload.data?.getNewMathExam ?? null;
      }),
    ),
  );

  return {
    exams: summaries.map((summary, index) => {
      const detail = details[index];
      const exam = detail.status === "fulfilled" ? detail.value : null;
      const sessionMeta = exam?.sessionMeta;
      const gradeLabel =
        typeof sessionMeta?.grade === "number"
          ? `${sessionMeta.grade}-р анги`
          : "";
      const groupLabel = sessionMeta?.groupClass?.trim() ?? "";
      const startTime = exam?.createdAt ?? summary.updatedAt;
      const durationMinutes =
        sessionMeta?.durationMinutes ?? summary.durationMinutes ?? null;

      return {
        class:
          [gradeLabel, groupLabel].filter(Boolean).join(" ") ||
          "Тодорхойгүй анги",
        durationMinutes,
        endTime:
          durationMinutes && startTime
            ? new Date(
                new Date(startTime).getTime() + durationMinutes * 60_000,
              ).toISOString()
            : null,
        examType: sessionMeta?.examType?.trim() || null,
        id: summary.examId,
        questionCount: Math.max(
          (exam?.mathCount ?? 0) + (exam?.mcqCount ?? 0),
          0,
        ),
        startTime,
        subject: sessionMeta?.subject?.trim() || "Математик",
        title: exam?.title ?? summary.title,
        topic:
          sessionMeta?.topics?.find((item) => item?.trim())?.trim() ??
          "Тодорхойгүй сэдэв",
      };
    }),
  };
}

function parseExamDate(value?: string | null): Date {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function sortCreatedExamsByStartTime(left: Exam, right: Exam) {
  return right.startTime.getTime() - left.startTime.getTime();
}

function readCreatedExamsCache(): Exam[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CREATED_EXAMS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      expiresAt?: number;
      exams?: Array<
        Omit<Exam, "startTime" | "endTime"> & {
          endTime?: string;
          startTime: string;
        }
      >;
    };

    if (!parsed.expiresAt || parsed.expiresAt < Date.now() || !parsed.exams) {
      window.sessionStorage.removeItem(CREATED_EXAMS_CACHE_KEY);
      return null;
    }

    return parsed.exams.map((exam) => ({
      ...exam,
      endTime: exam.endTime ? new Date(exam.endTime) : undefined,
      startTime: new Date(exam.startTime),
    }));
  } catch {
    return null;
  }
}

function writeCreatedExamsCache(exams: Exam[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      CREATED_EXAMS_CACHE_KEY,
      JSON.stringify({
        exams: exams.map((exam) => ({
          ...exam,
          endTime: exam.endTime?.toISOString(),
          startTime: exam.startTime.toISOString(),
        })),
        expiresAt: Date.now() + CREATED_EXAMS_CACHE_TTL_MS,
      }),
    );
  } catch {
    // Ignore storage failures.
  }
}
