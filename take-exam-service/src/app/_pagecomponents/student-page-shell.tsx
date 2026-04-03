"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Menu,
  RotateCcw,
  TrendingUp,
  Trophy,
  type LucideIcon,
  UserRound,
} from "lucide-react";
import { AiContentBadge } from "@/components/ai-content-badge";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  AttemptSummary,
  GetProgressResponse,
  StudentInfo,
  SubmitAnswersResponse,
  TeacherTestSummary,
} from "@/lib/exam-service/types";
import { cn } from "@/lib/utils";
import {
  estimateDurationMinutes,
  formatDate,
  formatQuestionPrompt,
} from "./student-page-utils";

const TEACHER_PORTAL_URL =
  process.env.NEXT_PUBLIC_TEACHER_PORTAL_URL?.trim() ||
  "https://frontend.tsetsegulziiocherdene.workers.dev/test/live-dashboard";

export type NavigationSection = "dashboard" | "tests" | "results";

export type ResultRow = {
  attemptId: string;
  className: string;
  examName: string;
  finishedAt: string;
  hasResult: boolean;
  scoreText: string;
  startedAt: string;
  subject: string;
  teacher: string;
};

type ResultCardsGridProps = {
  attemptsById: Map<string, AttemptSummary>;
  highlightedAttemptId: string | null;
  rows: ResultRow[];
  onOpenAttempt: (attemptId: string) => void;
};

type StudentPageShellProps = {
  activeSection: NavigationSection;
  activeTestsCount: number;
  averageScore: number;
  availableStudents: StudentInfo[];
  completedAttemptsLength: number;
  completedByTestId: Map<string, AttemptSummary>;
  error: string | null;
  filteredTests: TeacherTestSummary[];
  inProgressByTestId: Map<string, AttemptSummary>;
  isInitialLoading: boolean;
  isMutating: boolean;
  latestProgress: GetProgressResponse | SubmitAnswersResponse | null;
  latestSubmittedExamTitle: string | null;
  pageTitle: string;
  passRate: number;
  passedAttemptsCount: number;
  resultAttempts: AttemptSummary[];
  resultRows: ResultRow[];
  selectedStudent: StudentInfo | null;
  selectedStudentId: string;
  onResumeExam: (attemptId: string) => void;
  onSectionChange: (section: NavigationSection) => void;
  onSelectStudent: (studentId: string) => void;
  onStartExam: (testId: string) => void;
};

type StatCardProps = {
  caption: string;
  emptyMessage?: string;
  icon: LucideIcon;
  title: string;
  value: string;
};

type ExamsSectionHeaderProps = {
  indicatorClassName: string;
  subtitle: string;
  title: string;
};

type FeedbackPanelProps = {
  feedback: NonNullable<GetProgressResponse["feedback"]>;
};

type ResultBreakdownPanelProps = {
  attempt: AttemptSummary;
};

type NavigationItemsProps = {
  activeSection: NavigationSection;
  activeTestsCount: number;
  completedAttemptsLength: number;
  onSectionChange: (section: NavigationSection) => void;
};

const MAX_INLINE_FEEDBACK_CHARS = 160;

const compactInlineFeedback = (value?: string | null) => {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) {
    return "";
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const limited = sentences.slice(0, 2).join(" ").trim();
  const candidate = limited || normalized;

  if (candidate.length <= MAX_INLINE_FEEDBACK_CHARS) {
    return candidate;
  }

  return `${candidate.slice(0, MAX_INLINE_FEEDBACK_CHARS - 1).trimEnd()}…`;
};

function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-slate-800 sm:rounded-2xl sm:p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-sky-900">
        <FileText className="h-4 w-4" />
        <span>{feedback.headline}</span>
        <AiContentBadge source={feedback.source} />
      </div>
      <p className="mt-2 text-[13px] leading-[1.45] text-slate-700 sm:text-sm sm:leading-6">
        {feedback.summary}
      </p>
      <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            Сайн тал
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-slate-700 sm:text-sm">
            {feedback.strengths.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            Сайжруулах зүйл
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-slate-700 sm:text-sm">
            {feedback.improvements.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultBreakdownPanel({ attempt }: ResultBreakdownPanelProps) {
  if (!attempt.result || attempt.result.questionResults.length === 0) {
    return null;
  }

  const answerReviewByQuestionId = new Map(
    (attempt.answerReview ?? []).map(
      (item) => [item.questionId, item] as const,
    ),
  );

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {attempt.result.questionResults.map((questionResult, index) => {
          const answerReview = answerReviewByQuestionId.get(
            questionResult.questionId,
          );
          const isCorrect = questionResult.isCorrect;

          return (
            <article
              key={questionResult.questionId}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:rounded-2xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Асуулт {index + 1}
                  </p>
                  <MathText
                    as="p"
                    className="mt-2 text-[15px] font-semibold leading-6 text-slate-900 sm:text-base sm:leading-7"
                    displayMode={answerReview?.questionType === "math"}
                    text={formatQuestionPrompt(
                      answerReview?.prompt ?? `Асуулт ${index + 1}`,
                    )}
                  />
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                    isCorrect
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {questionResult.pointsAwarded}/{questionResult.maxPoints} оноо
                </span>
              </div>

              <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-2">
                <div
                  className={`rounded-xl border p-3 sm:p-4 ${
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-rose-200 bg-rose-50"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                      isCorrect ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    Таны хариулт
                  </p>
                  <MathText
                    as="p"
                    className="mt-2 text-[13px] leading-[1.45] text-slate-800 sm:text-sm sm:leading-6"
                    displayMode={answerReview?.questionType === "math"}
                    text={
                      answerReview?.selectedAnswerText ??
                      answerReview?.selectedOptionId ??
                      "Хариу өгөөгүй"
                    }
                  />
                </div>

                {(answerReview?.correctAnswerText ||
                  questionResult.correctOptionId) && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Зөв хариулт
                    </p>
                    <MathText
                      as="p"
                      className="mt-2 text-[13px] leading-[1.45] text-slate-800 sm:text-sm sm:leading-6"
                      displayMode={answerReview?.questionType === "math"}
                      text={
                        answerReview?.correctAnswerText ??
                        questionResult.correctOptionId ??
                        "Зөв хариулт бүртгэгдээгүй"
                      }
                    />
                  </div>
                )}

                {!isCorrect &&
                (answerReview?.responseGuide || questionResult.explanation) ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                        Зөвлөмж
                      </p>
                      <AiContentBadge
                        source={questionResult.explanationSource}
                      />
                    </div>
                    <MathText
                      as="p"
                      className="mt-2 text-[13px] leading-[1.45] text-slate-800 sm:text-sm sm:leading-6"
                      displayMode={answerReview?.questionType === "math"}
                      text={compactInlineFeedback(
                        questionResult.explanation ||
                          answerReview?.responseGuide ||
                          "Хариугаа дахин шалгаарай.",
                      )}
                    />
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  caption,
  emptyMessage,
  icon: Icon,
  title,
  value,
}: StatCardProps) {
  return (
    <article className="rounded-[28px] border border-[#c8d4e6] bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#e6f5fd] text-[#1a9cdc]">
          <Icon className="h-7 w-7" />
        </span>
      </div>
      {emptyMessage ? (
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <>
          <p className="mt-3 text-[30px] font-bold leading-none text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {caption}
          </p>
        </>
      )}
    </article>
  );
}

function ExamsSectionHeader({
  indicatorClassName,
  subtitle,
  title,
}: ExamsSectionHeaderProps) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={cn(
          "mt-3 h-7 w-7 shrink-0 rounded-full",
          indicatorClassName,
        )}
      />
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function PortalBrand({
  hideLabelOnMobile = false,
}: {
  hideLabelOnMobile?: boolean;
}) {
  return (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#16a4e5] text-white sm:h-10 sm:w-10 sm:rounded-xl">
        <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p
        className={`truncate text-lg font-semibold text-slate-900 sm:text-xl ${
          hideLabelOnMobile ? "hidden lg:block" : ""
        }`}
      >
        Сурагч Портал
      </p>
    </>
  );
}

function TeacherPortalShortcut({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={TEACHER_PORTAL_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center rounded-2xl border border-[#d6e5f7] bg-[#f8fbff] py-3 text-left text-[15px] font-semibold text-[#0b5cab] transition-[background-color,color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#eef5ff]",
        compact ? "h-14 w-14 justify-center px-0" : "w-full gap-3 px-4",
      )}
      aria-label="Багшийн портал нээх"
      title={compact ? "Багшийн портал нээх" : undefined}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <ArrowUpRight className="h-5 w-5 shrink-0" />
      </span>
      {compact ? null : <span>Багшийн портал нээх</span>}
    </a>
  );
}

function NavigationItems({
  activeSection,
  activeTestsCount,
  completedAttemptsLength,
  onSectionChange,
}: NavigationItemsProps) {
  const items: Array<{
    badge?: number;
    icon: LucideIcon;
    label: string;
    section: NavigationSection;
  }> = [
    {
      icon: LayoutDashboard,
      label: "Хяналтын самбар",
      section: "dashboard",
    },
    {
      badge: activeTestsCount,
      icon: FileText,
      label: "Идэвхтэй шалгалтууд",
      section: "tests",
    },
    {
      badge: completedAttemptsLength,
      icon: Trophy,
      label: "Шалгалтын дүн",
      section: "results",
    },
  ];

  return (
    <nav className="space-y-2">
      {items.map(({ badge, icon: Icon, label, section }) => {
        const isActive = activeSection === section;

        return (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold transition ${
              isActive
                ? "border-[#9fd8f7] bg-[#dff1fe] text-[#0f7db6] shadow-[0_0_0_1px_rgba(159,216,247,0.35)]"
                : "border-transparent text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {typeof badge === "number" ? (
              <span className="ml-auto inline-flex min-w-7 items-center justify-center rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

type TestCardsGridProps = {
  completedByTestId: Map<string, AttemptSummary>;
  emptyMessage: string;
  inProgressByTestId: Map<string, AttemptSummary>;
  isMutating: boolean;
  selectedStudent: StudentInfo | null;
  tests: TeacherTestSummary[];
  variant: "active" | "completed";
  onResumeExam: (attemptId: string) => void;
  onStartExam: (testId: string) => void;
  onViewResults: (attemptId: string) => void;
};

function TestCardsGrid({
  completedByTestId,
  emptyMessage,
  inProgressByTestId,
  isMutating,
  selectedStudent,
  tests,
  variant,
  onResumeExam,
  onStartExam,
  onViewResults,
}: TestCardsGridProps) {
  const [now, setNow] = useState(Date.now());
  const mockStartTimesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextStartTimes = { ...mockStartTimesRef.current };

    tests.forEach((test, index) => {
      if (!nextStartTimes[test.id]) {
        nextStartTimes[test.id] = Date.now() + (index + 2) * 60 * 60 * 1000;
      }
    });

    mockStartTimesRef.current = nextStartTimes;
  }, [tests]);

  if (!selectedStudent) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[13px] text-slate-500 sm:rounded-2xl sm:p-8 sm:text-sm">
        Сурагч сонгоогүй байна.
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[13px] text-slate-500 sm:rounded-2xl sm:p-8 sm:text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {tests.map((test, index) => {
        const resumableAttempt = inProgressByTestId.get(test.id);
        const completedAttempt = completedByTestId.get(test.id);
        const mockStartAt =
          mockStartTimesRef.current[test.id] ??
          Date.now() + (index + 2) * 60 * 60 * 1000;
        const realStartAt = new Date(test.updatedAt).getTime();
        const hasFutureRealStartAt =
          Number.isFinite(realStartAt) && realStartAt > now;
        const displayStartAt = hasFutureRealStartAt ? realStartAt : mockStartAt;
        const countdownMs = Math.max(0, displayStartAt - now);
        const countdownHours = Math.floor(countdownMs / (60 * 60 * 1000));
        const countdownMinutes = Math.floor(
          (countdownMs % (60 * 60 * 1000)) / (60 * 1000),
        );
        const countdownSeconds = Math.floor((countdownMs % (60 * 1000)) / 1000);
        const mockCountdownLabel =
          countdownHours > 0
            ? `${countdownHours}:${String(countdownMinutes).padStart(2, "0")}:${String(countdownSeconds).padStart(2, "0")}`
            : `${countdownMinutes}:${String(countdownSeconds).padStart(2, "0")}`;
        const isCompletedCard = variant === "completed";
        const canViewResults = Boolean(completedAttempt);

        return (
          <article
            key={test.id}
            className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 pt-8 shadow-[0_12px_30px_rgba(148,163,184,0.14)]"
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1.5",
                isCompletedCard ? "bg-[#94a3b8]" : "bg-[#4fc9f5]",
              )}
            />
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="pr-4 text-[17px] font-bold text-slate-950 sm:text-[18px]">
                  {test.title}
                </h3>
                <div
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
                    isCompletedCard
                      ? "bg-slate-100 text-slate-700"
                      : "border border-sky-200 bg-sky-50 text-slate-900",
                  )}
                >
                  {isCompletedCard ? "Дууссан" : mockCountdownLabel}
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <BookOpen className="h-4 w-4" />
                {test.criteria.subject}
              </p>
              <div className="space-y-3 pt-6 text-sm text-slate-500">
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  {estimateDurationMinutes(test)} мин
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Хаагдах хугацаа: {formatDate(test.updatedAt)}
                </p>
              </div>
            </div>

            {isCompletedCard ? (
              <button
                type="button"
                onClick={() => {
                  if (completedAttempt) {
                    onViewResults(completedAttempt.attemptId);
                  }
                }}
                disabled={!canViewResults}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#98aac3] px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#8194af] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Шалгалтын дүн харах
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : resumableAttempt ? (
              <button
                onClick={() => onResumeExam(resumableAttempt.attemptId)}
                disabled={isMutating}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#18a7eb] px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Шалгалт үргэлжлүүлэх
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => onStartExam(test.id)}
                disabled={isMutating}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#18a7eb] px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Шалгалт эхлүүлэх
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ResultCardsGrid({
  attemptsById,
  highlightedAttemptId,
  rows,
  onOpenAttempt,
}: ResultCardsGridProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[13px] text-slate-500 sm:p-8 sm:text-sm">
        Дүнгийн мэдээлэл одоогоор алга.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_6px_22px_rgba(15,23,42,0.06)] sm:rounded-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-[12px] font-semibold text-slate-700 sm:text-sm">
              <th className="px-3 py-3 sm:px-4 sm:py-4">Шалгалтын нэр</th>
              <th className="px-3 py-3 sm:px-4 sm:py-4">Хичээл</th>
              <th className="px-3 py-3 sm:px-4 sm:py-4">Анги</th>
              <th className="px-3 py-3 sm:px-4 sm:py-4">Багш</th>
              <th className="px-3 py-3 sm:px-4 sm:py-4">Эхэлсэн огноо</th>
              <th className="px-3 py-3 sm:px-4 sm:py-4">Дууссан огноо</th>
              <th className="px-3 py-3 text-center sm:px-4 sm:py-4">
                Авсан оноо
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const attempt = attemptsById.get(row.attemptId);
              const isClickable = Boolean(attempt && row.hasResult);
              const isHighlighted = highlightedAttemptId === row.attemptId;

              return (
                <tr
                  id={`result-row-${row.attemptId}`}
                  key={row.attemptId}
                  className={`border-t border-slate-200 text-[12px] text-slate-800 transition sm:text-sm ${
                    isHighlighted
                      ? "bg-sky-50/80 outline-2 -outline-offset-2 outline-sky-300"
                      : row.hasResult
                        ? "bg-emerald-50/40"
                        : "bg-white"
                  }`}
                >
                  <td className="px-3 py-3 font-medium text-slate-900 sm:px-4 sm:py-4">
                    {row.examName}
                  </td>
                  <td className="px-3 py-3 sm:px-4 sm:py-4">{row.subject}</td>
                  <td className="px-3 py-3 sm:px-4 sm:py-4">{row.className}</td>
                  <td className="px-3 py-3 sm:px-4 sm:py-4">{row.teacher}</td>
                  <td className="px-3 py-3 whitespace-nowrap sm:px-4 sm:py-4">
                    {row.startedAt}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap sm:px-4 sm:py-4">
                    {row.finishedAt}
                  </td>
                  <td className="px-3 py-3 sm:px-4 sm:py-4">
                    <div className="relative flex items-center justify-center">
                      <span
                        className={`font-semibold ${
                          row.hasResult ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {row.hasResult ? row.scoreText : "Хүлээгдэж байна"}
                      </span>
                      {isClickable ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenAttempt(row.attemptId);
                          }}
                          className="absolute right-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-50 sm:h-9 sm:w-9"
                          aria-label="Дэлгэрэнгүй харах"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StudentPageShell({
  activeSection,
  activeTestsCount,
  averageScore,
  availableStudents,
  completedAttemptsLength,
  completedByTestId,
  error,
  filteredTests,
  inProgressByTestId,
  isInitialLoading,
  isMutating,
  latestProgress,
  latestSubmittedExamTitle,
  pageTitle,
  passRate,
  passedAttemptsCount,
  resultAttempts,
  resultRows,
  selectedStudent,
  selectedStudentId,
  onResumeExam,
  onSectionChange,
  onSelectStudent,
  onStartExam,
}: StudentPageShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);
  const [highlightedResultAttemptId, setHighlightedResultAttemptId] = useState<
    string | null
  >(null);
  const [selectedResultAttemptId, setSelectedResultAttemptId] = useState<
    string | null
  >(null);
  const studentMenuRef = useRef<HTMLDivElement | null>(null);
  const resultAttemptById = useMemo(
    () =>
      new Map(
        resultAttempts.map(
          (attempt) => [attempt.attemptId, attempt] as const,
        ),
      ),
    [resultAttempts],
  );
  const selectedResultAttempt =
    (selectedResultAttemptId
      ? resultAttemptById.get(selectedResultAttemptId)
      : null) ?? null;
  const activeTests = useMemo(
    () => filteredTests.filter((test) => !completedByTestId.has(test.id)),
    [completedByTestId, filteredTests],
  );
  const completedTests = useMemo(
    () => filteredTests.filter((test) => completedByTestId.has(test.id)),
    [completedByTestId, filteredTests],
  );
  const hasResultAttempts = resultAttempts.length > 0;
  const isResultApprovalPending =
    completedAttemptsLength > 0 && !hasResultAttempts;

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!studentMenuRef.current?.contains(event.target as Node)) {
        setIsStudentMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    if (activeSection !== "results" || !highlightedResultAttemptId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(
        `result-row-${highlightedResultAttemptId}`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeSection, highlightedResultAttemptId]);

  const handleSectionChange = (section: NavigationSection) => {
    onSectionChange(section);
    setIsMobileNavOpen(false);
    setIsStudentMenuOpen(false);
  };

  const handleViewResults = (attemptId: string) => {
    setHighlightedResultAttemptId(attemptId);
    handleSectionChange("results");
  };

  return (
    <div className="h-screen overflow-hidden bg-[#eef3f8] px-0">
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col border border-slate-200/90 bg-white lg:grid lg:grid-cols-[240px_1fr] lg:grid-rows-[80px_minmax(0,1fr)]">
        <aside className="hidden items-center gap-4 border-r border-b border-slate-200 bg-white px-4 lg:row-start-1 lg:col-start-1 lg:flex">
          <PortalBrand />
        </aside>

        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-5 lg:row-start-1 lg:col-start-2 lg:px-8 lg:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <PortalBrand hideLabelOnMobile={true} />
            </div>
            <div className="hidden min-w-0 lg:block">
              <h1 className="truncate text-2xl font-semibold text-slate-900">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" ref={studentMenuRef}>
              <button
                type="button"
                onClick={() => setIsStudentMenuOpen((prev) => !prev)}
                className="flex max-w-[calc(100vw-6.25rem)] items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50 sm:max-w-none"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-700 sm:h-10 sm:w-10">
                  <UserRound className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900 sm:text-sm">
                    {selectedStudent?.name ?? "Сурагч сонгох"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {selectedStudent?.className ?? "Анги"}
                  </p>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition sm:h-4 sm:w-4 ${isStudentMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isStudentMenuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-[min(16rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.15)] sm:w-72">
                  <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Сурагч сонгох
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {availableStudents.length === 0 ? (
                      <p className="px-2 py-3 text-[13px] text-slate-500 sm:text-sm">
                        Сурагч олдсонгүй.
                      </p>
                    ) : (
                      availableStudents.map((student) => {
                        const isSelected = student.id === selectedStudentId;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => {
                              onSelectStudent(student.id);
                              setIsStudentMenuOpen(false);
                            }}
                            className={`mb-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition sm:text-sm ${
                              isSelected
                                ? "bg-[#e6f5fd] font-semibold text-[#1287c7]"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span className="truncate">{student.name}</span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {student.className}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Навигаци нээх"
              onClick={() => {
                setIsStudentMenuOpen(false);
                setIsMobileNavOpen(true);
              }}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <aside className="hidden min-h-0 flex-col border-r border-slate-200 bg-white lg:row-start-2 lg:col-start-1 lg:flex">
          <div className="flex-1 overflow-y-auto p-3">
            <NavigationItems
              activeSection={activeSection}
              activeTestsCount={activeTestsCount}
              completedAttemptsLength={completedAttemptsLength}
              onSectionChange={handleSectionChange}
            />
          </div>
          <div className="border-t border-slate-200 px-4 py-4">
            <TeacherPortalShortcut />
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#fbfdff] px-4 py-5 sm:px-5 sm:py-6 lg:row-start-2 lg:col-start-2 lg:px-8 lg:py-8">
          <div className="w-full space-y-6">
            {isInitialLoading ? (
              <div className="flex h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] text-slate-500 sm:h-[500px] sm:rounded-2xl sm:text-base">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Өгөгдөл ачаалж байна...
              </div>
            ) : (
              <section className="space-y-4 sm:space-y-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 sm:px-4 sm:py-3 sm:text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {activeSection === "dashboard" && (
                  <>
                    <div className="grid gap-4 xl:grid-cols-3">
                      <StatCard
                        title="Идэвхтэй шалгалт"
                        value={String(activeTestsCount)}
                        caption="Дуусгах хүлээгдэж буй"
                        icon={ClipboardList}
                      />
                      <StatCard
                        title="Тэнцсэн хувь"
                        value={`${passRate}%`}
                        caption={`${completedAttemptsLength}-с ${passedAttemptsCount} тэнцсэн`}
                        icon={Trophy}
                      />
                      <StatCard
                        title="Дундаж оноо"
                        value={`${averageScore}%`}
                        caption="Бүх шалгалтаар"
                        icon={TrendingUp}
                      />
                    </div>

                    {latestProgress &&
                      (latestProgress.status === "submitted" ||
                        latestProgress.status === "processing" ||
                        latestProgress.status === "approved") && (
                        <div className="space-y-3 sm:space-y-4">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 sm:rounded-2xl sm:p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <FileCheck2 className="h-4 w-4" />
                              {latestProgress.status === "processing"
                                ? "Шалгалтыг боловсруулж байна"
                                : latestProgress.status === "approved"
                                  ? "Шалгалтын дүн бэлэн боллоо"
                                  : latestSubmittedExamTitle
                                    ? `"${latestSubmittedExamTitle}" шалгалт амжилттай илгээгдлээ`
                                    : "Шалгалт амжилттай илгээгдлээ"}
                            </div>
                            <p className="mt-1 text-[13px] text-emerald-700/90 sm:text-sm">
                              {latestProgress.status === "approved" &&
                              latestProgress.result
                                ? `${latestProgress.result.maxScore} онооноос ${latestProgress.result.score} авч, ${latestProgress.result.percentage}% гүйцэтгэл үзүүллээ.`
                                : latestSubmittedExamTitle
                                  ? ` Багш баталсны дараа дүн, зөв хариу, тайлбар хэсэгт харагдана.`
                                  : "Таны хариулт амжилттай бүртгэгдсэн. Багш баталсны дараа дүн, зөв хариу, тайлбар хэсэгт харагдана."}
                            </p>
                          </div>

                          {latestProgress.status === "approved" &&
                            latestProgress.feedback && (
                              <FeedbackPanel
                                feedback={latestProgress.feedback}
                              />
                            )}
                        </div>
                      )}

                    <section className="space-y-4">
                      <ExamsSectionHeader
                        indicatorClassName="bg-[#22c55e]"
                        title="Идэвхтэй шалгалтууд"
                        subtitle={`${activeTests.length} шалгалт өгөх боломжтой`}
                      />
                      <TestCardsGrid
                        completedByTestId={completedByTestId}
                        emptyMessage="Танд тохирох идэвхтэй шалгалт олдсонгүй."
                        inProgressByTestId={inProgressByTestId}
                        isMutating={isMutating}
                        selectedStudent={selectedStudent}
                        tests={activeTests}
                        variant="active"
                        onResumeExam={onResumeExam}
                        onStartExam={onStartExam}
                        onViewResults={handleViewResults}
                      />
                    </section>

                    <section className="space-y-4">
                      <ExamsSectionHeader
                        indicatorClassName="bg-[#64748b]"
                        title="Дууссан шалгалтууд"
                        subtitle={`${completedTests.length} дууссан шалгалт`}
                      />
                      <TestCardsGrid
                        completedByTestId={completedByTestId}
                        emptyMessage="Дууссан шалгалт одоогоор алга."
                        inProgressByTestId={inProgressByTestId}
                        isMutating={isMutating}
                        selectedStudent={selectedStudent}
                        tests={completedTests}
                        variant="completed"
                        onResumeExam={onResumeExam}
                        onStartExam={onStartExam}
                        onViewResults={handleViewResults}
                      />
                    </section>
                  </>
                )}

                {activeSection === "tests" && (
                  <section className="space-y-4 sm:space-y-5">
                    <ExamsSectionHeader
                      indicatorClassName="bg-[#22c55e]"
                      title="Идэвхтэй шалгалтууд"
                      subtitle="Хугацаа дуусахаас өмнө шалгалтуудаа дуусгана уу"
                    />
                    <TestCardsGrid
                      completedByTestId={completedByTestId}
                      emptyMessage="Одоогоор шалгалт алга."
                      inProgressByTestId={inProgressByTestId}
                      isMutating={isMutating}
                      selectedStudent={selectedStudent}
                      tests={activeTests}
                      variant="active"
                      onResumeExam={onResumeExam}
                      onStartExam={onStartExam}
                      onViewResults={handleViewResults}
                    />
                  </section>
                )}

                {activeSection === "results" && (
                  <section className="space-y-3 sm:space-y-5">
                    <div>
                      <h3 className="text-lg font-medium tracking-tight text-slate-900 sm:text-xl">
                        Миний үр дүн
                      </h3>
                    </div>

                    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                      <StatCard
                        title="Нийт шалгалт"
                        value={String(completedAttemptsLength)}
                        caption="Дуусгасан шалгалт"
                        emptyMessage={
                          hasResultAttempts
                            ? undefined
                            : "Шалгалт өгөөгүй байна"
                        }
                        icon={Trophy}
                      />
                      <StatCard
                        title="Тэнцсэн хувь"
                        value={`${passRate}%`}
                        caption={`${completedAttemptsLength}-с ${passedAttemptsCount} тэнцсэн`}
                        emptyMessage={
                          !hasResultAttempts
                            ? "Шалгалт өгөөгүй байна"
                            : isResultApprovalPending
                              ? "Хүлээгдэж байна"
                              : undefined
                        }
                        icon={CheckCircle2}
                      />
                      <StatCard
                        title="Дундаж оноо"
                        value={`${averageScore}%`}
                        caption="Бүх шалгалтаар"
                        emptyMessage={
                          !hasResultAttempts
                            ? "Шалгалт өгөөгүй байна"
                            : isResultApprovalPending
                              ? "Хүлээгдэж байна"
                              : undefined
                        }
                        icon={TrendingUp}
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-lg font-medium tracking-tight text-slate-900 sm:text-xl">
                        Шалгалтын дүнгүүд
                      </h4>

                      <ResultCardsGrid
                        attemptsById={resultAttemptById}
                        highlightedAttemptId={highlightedResultAttemptId}
                        rows={resultRows}
                        onOpenAttempt={setSelectedResultAttemptId}
                      />
                    </div>
                  </section>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-[min(18rem,calc(100vw-0.75rem))] flex-col border-slate-200 bg-[#f3f6f9] p-0 sm:max-w-none"
        >
          <SheetHeader className="border-b border-slate-200 bg-white pr-12">
            <div className="flex items-center gap-3">
              <PortalBrand hideLabelOnMobile={true} />
            </div>
            <SheetTitle className="sr-only">Навигаци</SheetTitle>
            <SheetDescription className="sr-only">
              Хуудас хооронд шилжих цэс.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3">
            <NavigationItems
              activeSection={activeSection}
              activeTestsCount={activeTestsCount}
              completedAttemptsLength={completedAttemptsLength}
              onSectionChange={handleSectionChange}
            />
          </div>
          <div className="border-t border-slate-200 bg-white px-4 py-4">
            <TeacherPortalShortcut />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(selectedResultAttempt)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedResultAttemptId(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-5xl lg:max-w-6xl">
          {selectedResultAttempt ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pr-10">
                  <div>
                    <DialogTitle>{selectedResultAttempt.title}</DialogTitle>
                    <DialogDescription>
                      {selectedResultAttempt.percentage ??
                        selectedResultAttempt.result?.percentage ??
                        0}
                      % гүйцэтгэл. Алдаа,
                      тайлбар болон зөвлөмжийг доороос харна.
                    </DialogDescription>
                  </div>
                  <div className="mr-2 flex min-w-28 flex-col items-center rounded-full bg-emerald-50 px-4 py-2 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Нийт оноо
                    </p>
                    <p className="text-lg font-bold text-emerald-700">
                      {selectedResultAttempt.score ??
                        selectedResultAttempt.result?.score ??
                        0}
                      /
                      {selectedResultAttempt.maxScore ??
                        selectedResultAttempt.result?.maxScore ??
                        0}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="max-h-[75vh] overflow-y-auto pr-2">
                {selectedResultAttempt.feedback && (
                  <div className="mb-4">
                    <FeedbackPanel feedback={selectedResultAttempt.feedback} />
                  </div>
                )}
                <ResultBreakdownPanel attempt={selectedResultAttempt} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
