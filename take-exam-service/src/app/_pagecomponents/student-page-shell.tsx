"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
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

export type NavigationSection = "dashboard" | "tests" | "results";

export type ResultRow = {
  attemptId: string;
  className: string;
  examName: string;
  finishedAt: string;
  isApproved: boolean;
  scoreText: string;
  startedAt: string;
  subject: string;
  teacher: string;
};

type ResultCardsGridProps = {
  attemptsById: Map<string, AttemptSummary>;
  rows: ResultRow[];
  onOpenAttempt: (attemptId: string) => void;
};

type StudentPageShellProps = {
  activeSection: NavigationSection;
  activeTestsCount: number;
  approvedAttempts: AttemptSummary[];
  approvedAttemptsCount: number;
  averageScore: number;
  availableStudents: StudentInfo[];
  completedAttemptsLength: number;
  completionRate: number;
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
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-slate-500 sm:text-sm">{title}</p>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e6f5fd] text-[#1a9cdc] sm:h-11 sm:w-11 sm:rounded-xl">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </div>
      {emptyMessage ? (
        <p className="mt-2.5 text-[13px] font-medium leading-5 text-slate-500 sm:mt-3 sm:text-sm">
          {emptyMessage}
        </p>
      ) : (
        <>
          <p className="mt-2.5 text-xl font-bold leading-none text-slate-900 sm:mt-3 sm:text-2xl">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
            {caption}
          </p>
        </>
      )}
    </article>
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
        Сурагч
      </p>
    </>
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
    <nav className="space-y-1">
      {items.map(({ badge, icon: Icon, label, section }) => {
        const isActive = activeSection === section;

        return (
          <button
            key={section}
            type="button"
            onClick={() => onSectionChange(section)}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition sm:text-sm ${
              isActive
                ? "bg-[#e6f5fd] text-[#1287c7]"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {typeof badge === "number" ? (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[11px] font-semibold text-slate-700">
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
  filteredTests: TeacherTestSummary[];
  inProgressByTestId: Map<string, AttemptSummary>;
  isMutating: boolean;
  selectedStudent: StudentInfo | null;
  onResumeExam: (attemptId: string) => void;
  onStartExam: (testId: string) => void;
};

function TestCardsGrid({
  completedByTestId,
  emptyMessage,
  filteredTests,
  inProgressByTestId,
  isMutating,
  selectedStudent,
  onResumeExam,
  onStartExam,
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

    filteredTests.forEach((test, index) => {
      if (!nextStartTimes[test.id]) {
        nextStartTimes[test.id] = Date.now() + (index + 2) * 60 * 60 * 1000;
      }
    });

    mockStartTimesRef.current = nextStartTimes;
  }, [filteredTests]);

  if (!selectedStudent) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[13px] text-slate-500 sm:rounded-2xl sm:p-8 sm:text-sm">
        Сурагч сонгоогүй байна.
      </div>
    );
  }

  if (filteredTests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[13px] text-slate-500 sm:rounded-2xl sm:p-8 sm:text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {filteredTests.map((test, index) => {
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

        return (
          <article
            key={test.id}
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 pt-4 shadow-[0_6px_22px_rgba(15,23,42,0.06)] sm:rounded-2xl sm:p-5 sm:pt-6"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-[#59c9ee]" />
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-slate-900 sm:text-lg">
                  {test.title}
                </h3>
                <div className="shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-right shadow-[0_6px_16px_rgba(14,116,144,0.08)] sm:rounded-2xl sm:px-3 sm:py-2">
                  <p className="mt-1 text-[11px] font-semibold text-sky-900 sm:text-xs">
                    {mockCountdownLabel}
                  </p>
                  {/* <p className="text-[11px] text-sky-700/80">дараа эхэлнэ</p> */}
                </div>
              </div>
              {completedAttempt && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:text-xs">
                  Дууссан
                </span>
              )}
              <p className="flex items-center gap-2 text-[13px] text-slate-500 sm:text-sm">
                <BookOpen className="h-4 w-4" />
                {test.criteria.subject}
              </p>
              <p className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                <Clock3 className="h-4 w-4" />
                Үргэлжлэх хугацаа: {estimateDurationMinutes(test)} мин
              </p>
              <p className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
                <CalendarClock className="h-4 w-4" />
                Эхлэх хугацаа:{" "}
                {formatDate(new Date(displayStartAt).toISOString())}
              </p>
            </div>

            {resumableAttempt ? (
              <button
                onClick={() => onResumeExam(resumableAttempt.attemptId)}
                disabled={isMutating}
                className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#18a7eb] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-4 sm:text-sm"
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Үргэлжлүүлэх
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : completedAttempt ? (
              <button
                disabled={true}
                className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-500 sm:mt-4 sm:text-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                Өгсөн шалгалт
              </button>
            ) : (
              <button
                onClick={() => onStartExam(test.id)}
                disabled={isMutating}
                className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#18a7eb] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-4 sm:text-sm"
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
              const isClickable = Boolean(attempt && row.isApproved);

              return (
                <tr
                  key={row.attemptId}
                  className={`border-t border-slate-200 text-[12px] text-slate-800 sm:text-sm ${
                    row.isApproved ? "bg-emerald-50/40" : "bg-white"
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
                          row.isApproved ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {row.isApproved ? row.scoreText : "Хүлээгдэж байна"}
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
  approvedAttempts,
  approvedAttemptsCount,
  averageScore,
  availableStudents,
  completedAttemptsLength,
  completedByTestId,
  completionRate,
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
  const [selectedResultAttemptId, setSelectedResultAttemptId] = useState<
    string | null
  >(null);
  const studentMenuRef = useRef<HTMLDivElement | null>(null);
  const approvedAttemptById = useMemo(
    () =>
      new Map(
        approvedAttempts.map(
          (attempt) => [attempt.attemptId, attempt] as const,
        ),
      ),
    [approvedAttempts],
  );
  const selectedResultAttempt =
    (selectedResultAttemptId
      ? approvedAttemptById.get(selectedResultAttemptId)
      : null) ?? null;
  const hasResultAttempts = completedAttemptsLength > 0;
  const isResultApprovalPending =
    completedAttemptsLength > 0 && approvedAttemptsCount === 0;

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!studentMenuRef.current?.contains(event.target as Node)) {
        setIsStudentMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, []);

  const handleSectionChange = (section: NavigationSection) => {
    onSectionChange(section);
    setIsMobileNavOpen(false);
    setIsStudentMenuOpen(false);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#eceff3] px-0">
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col lg:grid lg:grid-cols-[228px_1fr] lg:grid-rows-[58px_minmax(0,1fr)]">
        <aside className="hidden items-center gap-3 border-r border-b border-slate-200 bg-white px-3 lg:row-start-1 lg:col-start-1 lg:flex">
          <PortalBrand />
        </aside>

        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 lg:row-start-1 lg:col-start-2 lg:px-6 lg:py-0">
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
                className="flex max-w-[calc(100vw-6.25rem)] items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50 sm:max-w-none"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-700 sm:h-9 sm:w-9">
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

        <aside className="hidden overflow-y-auto border-r border-slate-200 bg-white p-2 lg:row-start-2 lg:col-start-1 lg:block">
          <NavigationItems
            activeSection={activeSection}
            activeTestsCount={activeTestsCount}
            completedAttemptsLength={completedAttemptsLength}
            onSectionChange={handleSectionChange}
          />
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f5f7fa] px-0 py-3 sm:p-5 lg:row-start-2 lg:col-start-2">
          <div className="w-full space-y-4 sm:space-y-6">
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
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                      <StatCard
                        title="Идэвхтэй шалгалт"
                        value={String(activeTestsCount)}
                        caption="Дуусгах хүлээгдэж буй"
                        icon={ClipboardList}
                      />
                      <StatCard
                        title="Тэнцсэн хувь"
                        value={`${completionRate}%`}
                        caption={`${approvedAttemptsCount} шалгалт батлагдсан`}
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

                    <section className="space-y-2.5 sm:space-y-3">
                      <div className="flex items-center gap-2 text-slate-900">
                        <span className="status-dot-breathe h-3 w-3 rounded-full bg-emerald-500" />
                        <h3 className="text-base font-semibold sm:text-lg">
                          Идэвхтэй шалгалтууд
                        </h3>
                        <span className="text-[13px] text-slate-500 sm:text-sm">
                          {filteredTests.length} боломжтой
                        </span>
                      </div>
                      <TestCardsGrid
                        completedByTestId={completedByTestId}
                        emptyMessage="Танд тохирох идэвхтэй шалгалт олдсонгүй."
                        filteredTests={filteredTests}
                        inProgressByTestId={inProgressByTestId}
                        isMutating={isMutating}
                        selectedStudent={selectedStudent}
                        onResumeExam={onResumeExam}
                        onStartExam={onStartExam}
                      />
                    </section>
                  </>
                )}

                {activeSection === "tests" && (
                  <section className="space-y-4 sm:space-y-5">
                    <div className="flex items-start gap-3">
                      <span className="status-dot-breathe mt-2 h-3 w-3 rounded-full bg-emerald-500" />
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                          Идэвхтэй шалгалтууд
                        </h3>
                        <p className="text-[13px] text-slate-500 sm:text-lg">
                          Хугацаа дуусахаас өмнө шалгалтуудаа дуусгана уу
                        </p>
                      </div>
                    </div>
                    <TestCardsGrid
                      completedByTestId={completedByTestId}
                      emptyMessage="Одоогоор шалгалт алга."
                      filteredTests={filteredTests}
                      inProgressByTestId={inProgressByTestId}
                      isMutating={isMutating}
                      selectedStudent={selectedStudent}
                      onResumeExam={onResumeExam}
                      onStartExam={onStartExam}
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
                        attemptsById={approvedAttemptById}
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
          className="w-[min(18rem,calc(100vw-0.75rem))] border-slate-200 bg-[#f3f6f9] p-0 sm:max-w-none"
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
                      {selectedResultAttempt.percentage ?? 0}% гүйцэтгэл. Алдаа,
                      тайлбар болон зөвлөмжийг доороос харна.
                    </DialogDescription>
                  </div>
                  <div className="mr-2 flex min-w-28 flex-col items-center rounded-full bg-emerald-50 px-4 py-2 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Нийт оноо
                    </p>
                    <p className="text-lg font-bold text-emerald-700">
                      {selectedResultAttempt.score ?? 0}/
                      {selectedResultAttempt.maxScore ?? 0}
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
