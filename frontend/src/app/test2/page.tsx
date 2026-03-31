"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  History,
  Loader2,
  Radio,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DashboardTest = {
  id: string;
  title: string;
  description: string;
  answerKeySource: "local" | "teacher_service" | string;
  updatedAt: string;
  criteria: {
    gradeLevel: number;
    className: string;
    subject: string;
    topic: string;
    difficulty: string;
    questionCount: number;
  };
};

type AttemptProgress = {
  totalQuestions: number;
  answeredQuestions: number;
  remainingQuestions: number;
  completionRate: number;
};

type MonitoringEvent = {
  id: string;
  code: string;
  severity: "info" | "warning" | "danger" | string;
  title: string;
  detail: string;
  occurredAt: string;
};

type MonitoringSummary = {
  totalEvents: number;
  infoCount?: number;
  warningCount: number;
  dangerCount: number;
  lastEventAt?: string | null;
  recentEvents?: MonitoringEvent[];
};

type QuestionResult = {
  questionId: string;
  prompt: string;
  competency: string;
  questionType: string;
  selectedOptionId?: string | null;
  correctOptionId?: string | null;
  isCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  explanation?: string | null;
  dwellMs?: number | null;
  answerChangeCount?: number | null;
};

type AnswerReviewItem = {
  questionId: string;
  prompt: string;
  competency: string;
  questionType: string;
  selectedOptionId?: string | null;
  selectedAnswerText?: string | null;
  points: number;
  responseGuide?: string | null;
  dwellMs?: number | null;
  answerChangeCount?: number | null;
};

type AttemptResult = {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  questionResults: QuestionResult[];
};

type AttemptSummary = {
  attemptId: string;
  testId: string;
  title: string;
  studentId: string;
  studentName: string;
  status: "in_progress" | "processing" | "submitted" | "approved" | string;
  answerKeySource: "local" | "teacher_service" | string;
  criteria?: DashboardTest["criteria"] | null;
  progress: AttemptProgress;
  score?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  startedAt: string;
  submittedAt?: string | null;
  monitoring?: MonitoringSummary | null;
  result?: AttemptResult | null;
  answerReview?: AnswerReviewItem[] | null;
};

type LiveFeedItem = {
  attemptId: string;
  testId: string;
  title: string;
  studentId: string;
  studentName: string;
  status: AttemptSummary["status"];
  startedAt: string;
  submittedAt?: string | null;
  monitoring?: Omit<MonitoringSummary, "recentEvents"> | null;
  latestEvent?: MonitoringEvent | null;
};

type DashboardPayload = {
  availableTests: DashboardTest[];
  attempts: AttemptSummary[];
  liveMonitoringFeed: LiveFeedItem[];
  testMaterial?: {
    testId: string;
    title: string;
    description: string;
    timeLimitMinutes: number;
    criteria: DashboardTest["criteria"];
    questions: Array<{
      questionId: string;
      type: string;
      prompt: string;
      points: number;
      competency?: string | null;
      responseGuide?: string | null;
      options: Array<{ id: string; text: string }>;
    }>;
  } | null;
};

type AnalyticsQuestionInsight = {
  prompt: string;
  competency: string;
  dwellMs: number;
  answerChangeCount: number;
};

type TabKey = "live" | "analytics" | "review";

const POLL_INTERVAL_MS = 15_000;
const RISK_COLORS = ["#16a34a", "#f59e0b", "#ef4444"];

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";

  return new Intl.DateTimeFormat("mn-MN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return "саяхан";

  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );

  if (diffMinutes < 1) return "саяхан";
  if (diffMinutes < 60) return `${diffMinutes} мин өмнө`;

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} ц өмнө`;

  const days = Math.floor(hours / 24);
  return `${days} өдрийн өмнө`;
};

const formatDwell = (milliseconds?: number | null) => {
  if (!milliseconds || milliseconds <= 0) return "--";

  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds} сек`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}м ${seconds}с`;
};

const getAttemptPercentage = (attempt: AttemptSummary) =>
  attempt.result?.percentage ?? attempt.percentage ?? null;

const getAttemptTimestamp = (
  attempt: Pick<AttemptSummary, "startedAt" | "submittedAt">,
) => attempt.submittedAt ?? attempt.startedAt;

const getRiskLevel = (attempt: AttemptSummary) => {
  const warningCount = attempt.monitoring?.warningCount ?? 0;
  const dangerCount = attempt.monitoring?.dangerCount ?? 0;

  if (dangerCount > 0 || warningCount >= 3) return "өндөр";
  if (warningCount > 0) return "дунд";
  return "бага";
};

const getStatusLabel = (status: AttemptSummary["status"]) => {
  switch (status) {
    case "in_progress":
      return "Явж байна";
    case "processing":
      return "Боловсруулж байна";
    case "submitted":
      return "Илгээгдсэн";
    case "approved":
      return "Батлагдсан";
    default:
      return status;
  }
};

const getStatusBadgeClassName = (status: AttemptSummary["status"]) => {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "submitted":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "in_progress":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const getRiskBadgeClassName = (risk: string) => {
  switch (risk) {
    case "өндөр":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "дунд":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
};

function StatCard({
  icon: Icon,
  title,
  value,
  caption,
}: {
  icon: typeof Users;
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-indigo-600">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function SimpleBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export default function ExamAdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("live");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async (showLoader = false) => {
      if (showLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams({ limit: "40" });
        if (selectedTestId) {
          params.set("testId", selectedTestId);
        }

        const response = await fetch(
          `/api/take-exam-dashboard?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as DashboardPayload & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.message || "Dashboard өгөгдөл татаж чадсангүй.",
          );
        }

        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Dashboard ачаалах үед алдаа гарлаа.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void loadDashboard(true);
    const intervalId = window.setInterval(() => {
      void loadDashboard(false);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedTestId]);

  const examCards = useMemo(() => {
    return (data?.availableTests ?? []).map((test) => {
      const attempts = (data?.attempts ?? []).filter(
        (attempt) => attempt.testId === test.id,
      );
      const approved = attempts.filter(
        (attempt) => attempt.status === "approved",
      );
      const liveCount = attempts.filter(
        (attempt) =>
          attempt.status === "in_progress" || attempt.status === "processing",
      ).length;
      const averageScore = approved.length
        ? Math.round(
            approved.reduce(
              (sum, attempt) => sum + (getAttemptPercentage(attempt) ?? 0),
              0,
            ) / approved.length,
          )
        : null;

      return {
        averageScore,
        liveCount,
        studentCount: attempts.length,
        test,
      };
    });
  }, [data]);

  const selectedTest = useMemo(
    () =>
      examCards.find((item) => item.test.id === selectedTestId)?.test ?? null,
    [examCards, selectedTestId],
  );

  const selectedAttempts = useMemo(() => {
    return [...(data?.attempts ?? [])]
      .filter((attempt) => attempt.testId === selectedTestId)
      .sort(
        (left, right) =>
          new Date(getAttemptTimestamp(right)).getTime() -
          new Date(getAttemptTimestamp(left)).getTime(),
      );
  }, [data, selectedTestId]);

  const selectedFeed = useMemo(() => {
    return [...(data?.liveMonitoringFeed ?? [])]
      .filter((item) => item.testId === selectedTestId)
      .sort(
        (left, right) =>
          new Date(
            right.latestEvent?.occurredAt ??
              right.submittedAt ??
              right.startedAt,
          ).getTime() -
          new Date(
            left.latestEvent?.occurredAt ?? left.submittedAt ?? left.startedAt,
          ).getTime(),
      );
  }, [data, selectedTestId]);

  useEffect(() => {
    if (selectedAttempts.length === 0) {
      setSelectedAttemptId(null);
      return;
    }

    if (
      !selectedAttemptId ||
      !selectedAttempts.some((item) => item.attemptId === selectedAttemptId)
    ) {
      setSelectedAttemptId(selectedAttempts[0].attemptId);
    }
  }, [selectedAttemptId, selectedAttempts]);

  const selectedAttempt = useMemo(
    () =>
      selectedAttempts.find(
        (attempt) => attempt.attemptId === selectedAttemptId,
      ) ?? null,
    [selectedAttemptId, selectedAttempts],
  );

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return selectedAttempts;

    return selectedAttempts.filter((attempt) => {
      return (
        attempt.studentName.toLowerCase().includes(q) ||
        attempt.studentId.toLowerCase().includes(q) ||
        getStatusLabel(attempt.status).toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedAttempts]);

  const focusAreas = useMemo(() => {
    const map = new Map<string, number>();

    for (const attempt of selectedAttempts) {
      const labels =
        attempt.result?.questionResults
          ?.filter((item) => !item.isCorrect)
          .map(
            (item) => item.competency || attempt.criteria?.topic || "Сэдэв",
          ) ??
        attempt.answerReview?.map(
          (item) => item.competency || attempt.criteria?.topic || "Сэдэв",
        ) ??
        [];

      for (const label of labels) {
        map.set(label, (map.get(label) ?? 0) + 1);
      }
    }

    return [...map.entries()]
      .map(([name, count]) => ({ count, name }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [selectedAttempts]);

  const scoreDistribution = useMemo(() => {
    const buckets = [
      { name: "0-50", count: 0 },
      { name: "51-60", count: 0 },
      { name: "61-70", count: 0 },
      { name: "71-80", count: 0 },
      { name: "81-90", count: 0 },
      { name: "91-100", count: 0 },
    ];

    for (const attempt of selectedAttempts) {
      const percentage = getAttemptPercentage(attempt);
      if (percentage == null) continue;

      if (percentage <= 50) buckets[0].count += 1;
      else if (percentage <= 60) buckets[1].count += 1;
      else if (percentage <= 70) buckets[2].count += 1;
      else if (percentage <= 80) buckets[3].count += 1;
      else if (percentage <= 90) buckets[4].count += 1;
      else buckets[5].count += 1;
    }

    return buckets;
  }, [selectedAttempts]);

  const riskChartData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 };

    for (const attempt of selectedAttempts) {
      const risk = getRiskLevel(attempt);
      if (risk === "өндөр") counts.high += 1;
      else if (risk === "дунд") counts.medium += 1;
      else counts.low += 1;
    }

    return [
      { color: RISK_COLORS[0], name: "Бага эрсдэл", value: counts.low },
      { color: RISK_COLORS[1], name: "Дунд эрсдэл", value: counts.medium },
      { color: RISK_COLORS[2], name: "Өндөр эрсдэл", value: counts.high },
    ].filter((item) => item.value > 0);
  }, [selectedAttempts]);

  const kpis = useMemo(() => {
    const approved = selectedAttempts.filter(
      (attempt) => attempt.status === "approved",
    );
    const averageProgress = selectedAttempts.length
      ? Math.round(
          selectedAttempts.reduce(
            (sum, attempt) => sum + attempt.progress.completionRate,
            0,
          ) / selectedAttempts.length,
        )
      : null;
    const highRiskCount = selectedAttempts.filter(
      (attempt) => getRiskLevel(attempt) === "өндөр",
    ).length;
    const pendingReviewCount = selectedAttempts.filter(
      (attempt) =>
        attempt.answerKeySource === "teacher_service" &&
        attempt.status !== "approved",
    ).length;
    const averageScore = approved.length
      ? Math.round(
          approved.reduce(
            (sum, attempt) => sum + (getAttemptPercentage(attempt) ?? 0),
            0,
          ) / approved.length,
        )
      : null;

    return {
      averageProgress,
      averageScore,
      highRiskCount,
      pendingReviewCount,
      studentCount: selectedAttempts.length,
    };
  }, [selectedAttempts]);

  const analyticsInsights = useMemo(() => {
    const allQuestions: AnalyticsQuestionInsight[] = selectedAttempts.flatMap(
      (attempt) => {
        if (attempt.result?.questionResults?.length) {
          return attempt.result.questionResults.map((item) => ({
            answerChangeCount: item.answerChangeCount ?? 0,
            competency: item.competency,
            dwellMs: item.dwellMs ?? 0,
            prompt: item.prompt,
          }));
        }

        return (
          attempt.answerReview?.map((item) => ({
            answerChangeCount: item.answerChangeCount ?? 0,
            competency: item.competency,
            dwellMs: item.dwellMs ?? 0,
            prompt: item.prompt,
          })) ?? []
        );
      },
    );

    const slowestQuestion = [...allQuestions]
      .filter((item) => (item.dwellMs ?? 0) > 0)
      .sort((left, right) => (right.dwellMs ?? 0) - (left.dwellMs ?? 0))[0];

    const mostChanged = [...allQuestions]
      .filter((item) => (item.answerChangeCount ?? 0) > 0)
      .sort(
        (left, right) =>
          (right.answerChangeCount ?? 0) - (left.answerChangeCount ?? 0),
      )[0];

    const riskWindow = selectedFeed
      .slice(0, 6)
      .filter((item) => item.latestEvent?.severity === "danger");

    return {
      mostChanged,
      riskWindow,
      slowestQuestion,
    };
  }, [selectedAttempts, selectedFeed]);

  const reviewQueue = useMemo(() => {
    return selectedAttempts.filter((attempt) => {
      if (attempt.answerKeySource === "teacher_service") {
        return attempt.status !== "approved";
      }
      return Boolean(
        attempt.answerReview?.length || attempt.result?.questionResults.length,
      );
    });
  }, [selectedAttempts]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <Loader2 className="mr-2 size-5 animate-spin" />
        `/test2` dashboard ачаалж байна...
      </div>
    );
  }

  if (!selectedTest) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <SimpleBadge className="border-sky-200 bg-sky-50 text-sky-700">
                  <BookOpen className="mr-1 inline size-3.5" />
                  Шалгалт сонгох самбар
                </SimpleBadge>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                  Эхлээд аль шалгалтын dashboard руу орохоо сонгоно.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                  Энэ хуудас mock data ашиглахгүй. `take-exam-service`-ээс бодит
                  шалгалт, attempt, monitoring feed, review data татаад
                  харуулна.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {isRefreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Activity size={16} />
                )}
                Шинэчлэх
              </button>
            </div>
            {error && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {examCards.map((item) => (
              <button
                key={item.test.id}
                type="button"
                onClick={() => setSelectedTestId(item.test.id)}
                className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold text-slate-950">
                      {item.test.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.test.description}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 text-slate-400" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <SimpleBadge className="border-slate-200 bg-slate-50 text-slate-700">
                    {item.test.criteria.subject}
                  </SimpleBadge>
                  <SimpleBadge className="border-slate-200 bg-slate-50 text-slate-700">
                    {item.test.criteria.topic}
                  </SimpleBadge>
                  <SimpleBadge className="border-slate-200 bg-slate-50 text-slate-700">
                    {item.test.criteria.questionCount} асуулт
                  </SimpleBadge>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Сурагч</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {item.studentCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-3">
                    <p className="text-xs text-sky-700">Live</p>
                    <p className="mt-1 text-lg font-semibold text-sky-900">
                      {item.liveCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Дундаж</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-900">
                      {item.averageScore != null
                        ? `${item.averageScore}%`
                        : "--"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-200 bg-white xl:flex xl:flex-col">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Шалгалтын самбар
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
              {selectedTest.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {selectedTest.criteria.className} •{" "}
              {selectedTest.criteria.subject} • {selectedTest.criteria.topic}
            </p>
          </div>

          <div className="space-y-2 px-4 py-5">
            {[
              { key: "live", icon: Radio, label: "Live monitoring" },
              { key: "analytics", icon: BarChart3, label: "Нийт analytics" },
              { key: "review", icon: FileCheck2, label: "Засвар / review" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key as TabKey)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  activeTab === item.key
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-auto border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => setSelectedTestId(null)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
              Шалгалт солих
            </button>
          </div>
        </aside>

        <main className="flex-1">
          <header className="border-b border-slate-200 bg-white px-6 py-5 md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTestId(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 xl:hidden"
                  >
                    <ArrowLeft size={14} />
                    Буцах
                  </button>
                  <SimpleBadge className="border-slate-200 bg-slate-50 text-slate-700">
                    ID: {selectedTest.id}
                  </SimpleBadge>
                  <SimpleBadge className="border-slate-200 bg-slate-50 text-slate-700">
                    {selectedTest.answerKeySource === "teacher_service"
                      ? "Багшийн answer key"
                      : "Local answer key"}
                  </SimpleBadge>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                  {selectedTest.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Сүүлд шинэчилсэн: {formatDateTime(selectedTest.updatedAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {isRefreshing ? "Шинэчилж байна..." : "Систем идэвхтэй"}
                </div>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Сурагч хайх..."
                    className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-300"
                  />
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </header>

          <div className="space-y-6 p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Шалгалт өгсөн сурагч"
                value={String(kpis.studentCount)}
                caption="Сонгосон шалгалтын нийт attempt"
                icon={Users}
              />
              <StatCard
                title="Дундаж явц"
                value={
                  kpis.averageProgress != null
                    ? `${kpis.averageProgress}%`
                    : "--"
                }
                caption="Completion rate-ийн дундаж"
                icon={Activity}
              />
              <StatCard
                title="Өндөр эрсдэл"
                value={String(kpis.highRiskCount)}
                caption="Danger эсвэл олон warning-тэй сурагч"
                icon={ShieldAlert}
              />
              <StatCard
                title="Review хүлээж буй"
                value={String(kpis.pendingReviewCount)}
                caption="Teacher-side check хараахан дуусаагүй"
                icon={FileCheck2}
              />
            </div>

            {activeTab === "live" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">
                          Сурагчдын roster ба төлөв
                        </h2>
                        <p className="text-sm text-slate-500">
                          Нэр дээр дарахад баруун талын detail шинэчлэгдэнэ
                        </p>
                      </div>
                      <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                        <Filter size={16} />
                        Шүүх
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-5 py-3 font-medium">Сурагч</th>
                            <th className="px-5 py-3 font-medium">Төлөв</th>
                            <th className="px-5 py-3 font-medium">Явц</th>
                            <th className="px-5 py-3 font-medium">Эрсдэл</th>
                            <th className="px-5 py-3 font-medium">
                              Monitoring
                            </th>
                            <th className="px-5 py-3 font-medium text-right">
                              Оноо
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAttempts.map((attempt) => {
                            const risk = getRiskLevel(attempt);
                            const percentage = getAttemptPercentage(attempt);
                            const isSelected =
                              attempt.attemptId === selectedAttemptId;

                            return (
                              <tr
                                key={attempt.attemptId}
                                onClick={() =>
                                  setSelectedAttemptId(attempt.attemptId)
                                }
                                className={`cursor-pointer transition hover:bg-slate-50 ${
                                  isSelected ? "bg-indigo-50/60" : ""
                                }`}
                              >
                                <td className="px-5 py-4">
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {attempt.studentName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {formatDateTime(
                                        getAttemptTimestamp(attempt),
                                      )}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <SimpleBadge
                                    className={getStatusBadgeClassName(
                                      attempt.status,
                                    )}
                                  >
                                    {getStatusLabel(attempt.status)}
                                  </SimpleBadge>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-indigo-500"
                                        style={{
                                          width: `${attempt.progress.completionRate}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500">
                                      {attempt.progress.completionRate}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <SimpleBadge
                                    className={getRiskBadgeClassName(risk)}
                                  >
                                    {risk}
                                  </SimpleBadge>
                                </td>
                                <td className="px-5 py-4 text-slate-600">
                                  {attempt.monitoring?.warningCount ?? 0}{" "}
                                  warning /{" "}
                                  {attempt.monitoring?.dangerCount ?? 0} danger
                                </td>
                                <td className="px-5 py-4 text-right font-semibold text-slate-900">
                                  {percentage != null ? `${percentage}%` : "--"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <h2 className="text-lg font-semibold text-slate-950">
                        Live incident feed
                      </h2>
                      <p className="text-sm text-slate-500">
                        Тухайн шалгалтын хамгийн сүүлийн monitoring event-үүд
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedFeed.slice(0, 8).map((item, index) => (
                        <div
                          key={`${item.attemptId}-${item.latestEvent?.id ?? index}`}
                          className="flex items-start justify-between gap-4 px-5 py-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`size-2 rounded-full ${
                                  item.latestEvent?.severity === "danger"
                                    ? "bg-rose-500"
                                    : item.latestEvent?.severity === "warning"
                                      ? "bg-amber-500"
                                      : "bg-sky-500"
                                }`}
                              />
                              <p className="font-medium text-slate-900">
                                {item.studentName}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {item.latestEvent?.title ?? "Event"}:{" "}
                              {item.latestEvent?.detail ?? "Monitoring update"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-400">
                              {formatRelativeTime(
                                item.latestEvent?.occurredAt ??
                                  item.submittedAt ??
                                  item.startedAt,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {getStatusLabel(item.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">
                          Сонгосон сурагч
                        </h2>
                        <p className="text-sm text-slate-500">
                          Timeline, monitoring, answer pattern
                        </p>
                      </div>
                      {selectedAttempt && (
                        <SimpleBadge
                          className={getStatusBadgeClassName(
                            selectedAttempt.status,
                          )}
                        >
                          {getStatusLabel(selectedAttempt.status)}
                        </SimpleBadge>
                      )}
                    </div>

                    {selectedAttempt ? (
                      <div className="mt-5 space-y-5">
                        <div>
                          <p className="text-xl font-bold text-slate-950">
                            {selectedAttempt.studentName}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {selectedAttempt.criteria?.subject} •{" "}
                            {selectedAttempt.criteria?.topic}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Progress</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">
                              {selectedAttempt.progress.completionRate}%
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Оноо</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">
                              {getAttemptPercentage(selectedAttempt) != null
                                ? `${getAttemptPercentage(selectedAttempt)}%`
                                : "--"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 p-3">
                            <p className="text-xs text-amber-700">Warning</p>
                            <p className="mt-1 text-lg font-semibold text-amber-900">
                              {selectedAttempt.monitoring?.warningCount ?? 0}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-rose-50 p-3">
                            <p className="text-xs text-rose-700">Danger</p>
                            <p className="mt-1 text-lg font-semibold text-rose-900">
                              {selectedAttempt.monitoring?.dangerCount ?? 0}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-3 text-sm font-semibold text-slate-900">
                            Event timeline
                          </p>
                          <div className="space-y-3">
                            {(selectedAttempt.monitoring?.recentEvents ?? [])
                              .slice(0, 6)
                              .map((event) => (
                                <div
                                  key={event.id}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium text-slate-900">
                                      {event.title}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {formatDateTime(event.occurredAt)}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {event.detail}
                                  </p>
                                </div>
                              ))}
                            {(selectedAttempt.monitoring?.recentEvents ?? [])
                              .length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                                Одоогоор monitoring timeline бүртгэгдээгүй
                                байна.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">
                        Сурагч сонгоогүй байна.
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Шалгалтын материал
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Сонгосон шалгалтын асуултууд
                    </p>
                    {data?.testMaterial?.testId === selectedTest.id ? (
                      <div className="mt-4 space-y-3">
                        {data.testMaterial.questions
                          .slice(0, 4)
                          .map((question, index) => (
                            <div
                              key={question.questionId}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <p className="font-medium text-slate-900">
                                {index + 1}. {question.prompt}
                              </p>
                              <p className="mt-2 text-xs text-slate-500">
                                {question.points} оноо • {question.type}
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                        Шалгалтын material ачаалж байна.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
                        <BrainCircuit size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-indigo-900">
                          Хамгийн удаан саатсан асуулт
                        </p>
                        <p className="mt-2 text-sm leading-6 text-indigo-800">
                          {analyticsInsights.slowestQuestion
                            ? `${analyticsInsights.slowestQuestion.prompt} • ${formatDwell(
                                analyticsInsights.slowestQuestion.dwellMs,
                              )}`
                            : "Timing data хараахан хангалттай бүрдээгүй байна."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">
                          Дундаж гүйцэтгэл
                        </p>
                        <p className="mt-2 text-sm leading-6 text-emerald-800">
                          Батлагдсан attempt-уудын дундаж оноо{" "}
                          {kpis.averageScore != null
                            ? `${kpis.averageScore}%`
                            : "--"}{" "}
                          байна.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Эрсдэлтэй cluster
                        </p>
                        <p className="mt-2 text-sm leading-6 text-amber-800">
                          {analyticsInsights.riskWindow.length > 0
                            ? `${analyticsInsights.riskWindow.length} danger event ойрын feed дээр илэрсэн.`
                            : "Ойрын хугацаанд danger cluster ажиглагдсангүй."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Онооны тархалт
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Сонгосон шалгалтын score bucket
                    </p>
                    <div className="mt-6 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreDistribution}>
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="name"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Bar
                            dataKey="count"
                            fill="#6366f1"
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Эрсдэлийн зураглал
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Monitoring signal дээр суурилсан risk profile
                    </p>
                    <div className="mt-6 flex flex-col items-center justify-center gap-6 lg:flex-row">
                      <div className="h-72 w-full max-w-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={riskChartData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={64}
                              outerRadius={92}
                              paddingAngle={4}
                            >
                              {riskChartData.map((item, index) => (
                                <Cell
                                  key={`${item.name}-${index}`}
                                  fill={item.color}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {riskChartData.map((item) => (
                          <div
                            key={item.name}
                            className="flex items-center gap-3"
                          >
                            <span
                              className="size-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="w-28 text-sm text-slate-600">
                              {item.name}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Нийтээр анхаарах сэдвүүд
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Алдаа, answer review, competency distribution
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {focusAreas.length > 0 ? (
                      focusAreas.map((item) => (
                        <div
                          key={item.name}
                          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
                        >
                          <span className="font-semibold">{item.name}</span> •{" "}
                          {item.count}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                        Competency analytics хараахан бүрдээгүй байна.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "review" && (
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h2 className="text-lg font-semibold text-slate-950">
                      Review хийх оролдлогууд
                    </h2>
                    <p className="text-sm text-slate-500">
                      Teacher-side check эсвэл answer review шаардлагатай
                      attempt
                    </p>
                  </div>
                  <div className="space-y-2 p-3">
                    {reviewQueue.map((attempt) => (
                      <button
                        key={attempt.attemptId}
                        type="button"
                        onClick={() => setSelectedAttemptId(attempt.attemptId)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          attempt.attemptId === selectedAttemptId
                            ? "border-indigo-200 bg-indigo-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {attempt.studentName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDateTime(getAttemptTimestamp(attempt))}
                            </p>
                          </div>
                          <SimpleBadge
                            className={getStatusBadgeClassName(attempt.status)}
                          >
                            {getStatusLabel(attempt.status)}
                          </SimpleBadge>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {attempt.answerKeySource === "teacher_service"
                            ? "Teacher-side шалгалтын check хүлээгдэж байна."
                            : `${
                                attempt.answerReview?.length ??
                                attempt.result?.questionResults.length ??
                                0
                              } асуултын review data байна.`}
                        </p>
                      </button>
                    ))}
                    {reviewQueue.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">
                        Review queue хоосон байна.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-6 py-5">
                    <h2 className="text-xl font-semibold text-slate-950">
                      {selectedAttempt?.studentName ?? "Attempt сонгоно уу"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Илгээсэн хариу, answer review, result analytics
                    </p>
                  </div>

                  {selectedAttempt ? (
                    <div className="space-y-6 p-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">Оноо</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">
                            {getAttemptPercentage(selectedAttempt) != null
                              ? `${getAttemptPercentage(selectedAttempt)}%`
                              : "--"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">
                            Correct / Incorrect
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">
                            {selectedAttempt.result
                              ? `${selectedAttempt.result.correctCount} / ${selectedAttempt.result.incorrectCount}`
                              : "--"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">Monitoring</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">
                            {selectedAttempt.monitoring?.totalEvents ?? 0}
                          </p>
                        </div>
                      </div>

                      {selectedAttempt.answerReview &&
                      selectedAttempt.answerReview.length > 0 ? (
                        <div>
                          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                            <FileText size={16} />
                            Сурагчийн оруулсан хариунууд
                          </h3>
                          <div className="space-y-3">
                            {selectedAttempt.answerReview.map((item, index) => (
                              <div
                                key={item.questionId}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-medium text-slate-900">
                                    {index + 1}. {item.prompt}
                                  </p>
                                  <SimpleBadge className="border-slate-200 bg-white text-slate-700">
                                    {item.points} оноо
                                  </SimpleBadge>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-700">
                                  {item.selectedAnswerText ||
                                    item.selectedOptionId ||
                                    "Хариу хоосон"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                  <SimpleBadge className="border-slate-200 bg-white text-slate-600">
                                    {item.competency || "Сэдэвгүй"}
                                  </SimpleBadge>
                                  <SimpleBadge className="border-slate-200 bg-white text-slate-600">
                                    {formatDwell(item.dwellMs)}
                                  </SimpleBadge>
                                  <SimpleBadge className="border-slate-200 bg-white text-slate-600">
                                    {item.answerChangeCount ?? 0} өөрчлөлт
                                  </SimpleBadge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : selectedAttempt.result?.questionResults.length ? (
                        <div>
                          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                            <Eye size={16} />
                            Result analytics
                          </h3>
                          <div className="space-y-3">
                            {selectedAttempt.result.questionResults.map(
                              (item, index) => (
                                <div
                                  key={item.questionId}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="font-medium text-slate-900">
                                      {index + 1}. {item.prompt}
                                    </p>
                                    <SimpleBadge
                                      className={
                                        item.isCorrect
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : "border-rose-200 bg-rose-50 text-rose-700"
                                      }
                                    >
                                      {item.isCorrect ? "Зөв" : "Буруу"}
                                    </SimpleBadge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                    <SimpleBadge className="border-slate-200 bg-white text-slate-600">
                                      {item.competency || "Сэдэвгүй"}
                                    </SimpleBadge>
                                    <SimpleBadge className="border-slate-200 bg-white text-slate-600">
                                      {formatDwell(item.dwellMs)}
                                    </SimpleBadge>
                                    <SimpleBadge className="border-slate-200 bg-white text-slate-600">
                                      {item.answerChangeCount ?? 0} өөрчлөлт
                                    </SimpleBadge>
                                  </div>
                                  {item.explanation && (
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                      {item.explanation}
                                    </p>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">
                          Энэ attempt дээр review харагдуулах дата хараахан
                          алга.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500">
                        Review хийх attempt сонгоно уу.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
