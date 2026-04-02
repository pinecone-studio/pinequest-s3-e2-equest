"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  AppWindow,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  PenLine,
  Send,
  TriangleAlert,
  Users,
  VideoOff,
  Wifi,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  Exam,
  MonitoringEvent,
  QuestionReview,
  Student,
  SubmittedAttempt,
} from "../../live-dashboard/lib/types";

type ExamProgressMonitoringProps = {
  exam: Exam;
  events: MonitoringEvent[];
  lastUpdated: Date | null;
  onBack: () => void;
  reviewAttempts: SubmittedAttempt[];
  students: Student[];
};

type MonitoringTab = "monitoring" | "performance";
type EventTone = "danger" | "info" | "muted" | "warning";
type PerformanceQuestionFilter = "all" | "correct" | "incorrect" | "open";
type StudentConnectionState = "idle" | "offline" | "online";
type StudentStatusTone = "danger" | "muted" | "online" | "warning";

type EventBadge = {
  icon: LucideIcon;
  id: string;
  label: string;
  tone: EventTone;
};

type EventScreenshot = {
  caption: string;
  fallbackUrl?: string;
  id: string;
  occurredLabel: string;
  url: string;
};

type DisplayEvent = {
  code?: string;
  detail: string;
  icon: LucideIcon;
  id: string;
  label: string;
  occurredLabel: string;
  screenshotUrl?: string;
  severity: "danger" | "info" | "warning";
  studentId: string;
  studentName: string;
  timestamp: Date;
  title: string;
  tone: EventTone;
};

type StudentRow = {
  attemptBadges: EventBadge[];
  attemptCount: number;
  connectionState: StudentConnectionState;
  id: string;
  name: string;
  risk: number;
  scoreLabel: string;
  screenshots: EventScreenshot[];
  statusLabel: string;
  statusTone: StudentStatusTone;
};

const NON_SUSPICIOUS_EVENT_CODES = new Set([
  "attempt-finalize",
  "attempt-save",
  "attempt-session-open",
  "answer-selected",
  "connection_restored",
  "question-revisit",
  "tab_visible",
  "window_focus",
]);

const KPI_CARD_CONFIG = [
  {
    accent: "bg-[#1f5ea8]",
    icon: Users,
    key: "active",
    title: "Шалгалт өгч буй",
    tone: "text-[#1f5ea8]",
  },
  {
    accent: "bg-[#179c35]",
    icon: Send,
    key: "submitted",
    title: "Шалгалт илгээсэн",
    tone: "text-[#179c35]",
  },
  {
    accent: "bg-[#ff630f]",
    icon: TriangleAlert,
    key: "warnings",
    title: "Анхааруулга",
    tone: "text-[#ff630f]",
  },
  {
    accent: "bg-[#70829f]",
    icon: WifiOff,
    key: "offline",
    title: "Холболт тасарсан",
    tone: "text-[#70829f]",
  },
] as const;

export function ExamProgressMonitoring({
  exam,
  events,
  lastUpdated,
  onBack,
  reviewAttempts,
  students,
}: ExamProgressMonitoringProps) {
  const [activeTab, setActiveTab] = useState<MonitoringTab>("monitoring");
  const [localReviewAttempts, setLocalReviewAttempts] = useState<SubmittedAttempt[]>(
    reviewAttempts,
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedReviewAttemptId, setSelectedReviewAttemptId] = useState<string | null>(
    reviewAttempts[0]?.id ?? null,
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    reviewAttempts[0]?.questions[0]?.id ?? null,
  );
  const [isScoreEditing, setIsScoreEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setLocalReviewAttempts(reviewAttempts);
  }, [reviewAttempts]);

  useEffect(() => {
    if (localReviewAttempts.length === 0) {
      setSelectedReviewAttemptId(null);
      setSelectedQuestionId(null);
      return;
    }

    const hasSelectedAttempt = localReviewAttempts.some(
      (attempt) => attempt.id === selectedReviewAttemptId,
    );
    const nextAttempt = hasSelectedAttempt
      ? localReviewAttempts.find((attempt) => attempt.id === selectedReviewAttemptId) ??
        localReviewAttempts[0]
      : localReviewAttempts[0];

    if (nextAttempt.id !== selectedReviewAttemptId) {
      setSelectedReviewAttemptId(nextAttempt.id);
    }

    const hasSelectedQuestion = nextAttempt.questions.some(
      (question) => question.id === selectedQuestionId,
    );
    const nextQuestionId = hasSelectedQuestion
      ? selectedQuestionId
      : nextAttempt.questions[0]?.id ?? null;

    if (nextQuestionId !== selectedQuestionId) {
      setSelectedQuestionId(nextQuestionId);
    }
  }, [localReviewAttempts, selectedQuestionId, selectedReviewAttemptId]);

  useEffect(() => {
    setIsScoreEditing(false);
  }, [selectedQuestionId, selectedReviewAttemptId]);

  const allMonitoringEvents = useMemo(
    () => buildDisplayEvents(events, localReviewAttempts),
    [events, localReviewAttempts],
  );

  const studentRows = useMemo(
    () => buildStudentRows(students, localReviewAttempts, allMonitoringEvents),
    [allMonitoringEvents, localReviewAttempts, students],
  );

  const selectedStudent = useMemo(
    () => studentRows.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, studentRows],
  );

  const selectedAttempt = useMemo(
    () =>
      localReviewAttempts.find((attempt) => attempt.id === selectedReviewAttemptId) ??
      localReviewAttempts[0] ??
      null,
    [localReviewAttempts, selectedReviewAttemptId],
  );

  const selectedQuestion = useMemo(
    () =>
      selectedAttempt?.questions.find((question) => question.id === selectedQuestionId) ??
      selectedAttempt?.questions[0] ??
      null,
    [selectedAttempt, selectedQuestionId],
  );

  const correctCount = selectedAttempt?.questions.filter(
    (question) => question.reviewState === "correct",
  ).length ?? 0;
  const incorrectCount = selectedAttempt?.questions.filter(
    (question) => question.reviewState === "incorrect",
  ).length ?? 0;
  const selectedAttemptScoreLabel = selectedAttempt
    ? formatAttemptPoints(selectedAttempt)
    : "Хүлээгдэж байна";
  const canEditSelectedQuestionScore = Boolean(selectedQuestion);

  const totalStudentCount = Math.max(exam.totalStudentCount, students.length);
  const activeStudentCount = students.filter(
    (student) => student.status === "in-progress" || student.status === "processing",
  ).length;
  const submittedCount = localReviewAttempts.length;
  const warningCount = allMonitoringEvents.filter(
    (event) => event.severity === "warning",
  ).length;
  const offlineCount = students.filter(
    (student) => student.monitoringState === "offline",
  ).length;

  const kpiValues = {
    active: `${activeStudentCount}/${Math.max(totalStudentCount, activeStudentCount)}`,
    offline: padCount(offlineCount),
    submitted: String(submittedCount),
    warnings: padCount(warningCount),
  };
  const remainingTimeLabel = formatRemainingTime(exam.endTime, currentTime);

  return (
    <section className="min-h-full space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="px-0 text-slate-600" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Жагсаалт руу буцах
        </Button>
        <p className="text-[15px] font-semibold text-slate-900">
          {lastUpdated
            ? `Сүүлд шинэчлэгдсэн: ${formatDateTime(lastUpdated)}`
            : "Сүүлд шинэчлэгдсэн хугацаа алга"}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-wrap items-end gap-10">
          <button
            type="button"
            onClick={() => setActiveTab("monitoring")}
            className={tabClassName(activeTab === "monitoring")}
          >
            Шалгалтын явцын хяналт
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("performance")}
            className={tabClassName(activeTab === "performance")}
          >
            Гүйцэтгэлийн хяналт
          </button>
        </div>

        {activeTab === "performance" && remainingTimeLabel ? (
          <div className="inline-flex h-[42px] items-center rounded-[12px] border border-[#0b5cab] bg-white px-5 text-[14px] font-semibold text-slate-900">
            Үлдсэн хугацаа {remainingTimeLabel}
          </div>
        ) : null}
      </div>

      {activeTab === "monitoring" ? (
        <>
          <div className="grid gap-5 xl:grid-cols-4">
            {KPI_CARD_CONFIG.map((card) => (
              <article
                key={card.key}
                className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white px-7 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-[5px] rounded-l-[24px] ${card.accent}`}
                  aria-hidden="true"
                />
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[17px] font-bold text-slate-700">{card.title}</p>
                  <card.icon className={`h-6 w-6 ${card.tone}`} />
                </div>
                <p className={`mt-10 text-[42px] font-bold leading-none ${card.tone}`}>
                  {kpiValues[card.key]}
                </p>
              </article>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-200 px-8 py-7">
                <h2 className="text-[20px] font-bold text-slate-900">Сурагчдын явц</h2>
              </div>

              <div className="grid grid-cols-[1.5fr_0.8fr_1.1fr_0.8fr_0.6fr] border-b border-slate-200 bg-[#f8fafc] px-8 py-6 text-[15px] font-bold text-slate-800">
                <span>Сурагчдын нэрс</span>
                <span>Төлөв</span>
                <span>Хуулах оролдлого</span>
                <span>Холболт</span>
                <span>Эрсдэл</span>
              </div>

              {studentRows.length > 0 ? (
                studentRows.slice(0, 6).map((row) => {
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedStudentId(row.id)}
                      className="grid w-full grid-cols-[1.5fr_0.8fr_1.1fr_0.8fr_0.6fr] items-center border-b border-slate-100 px-8 py-7 text-left text-[15px] transition-colors hover:bg-slate-50"
                    >
                      <span className="text-[18px] font-semibold text-slate-900">
                        {row.name}
                      </span>
                      <span className="flex items-center gap-3 font-medium">
                        <span className={statusDotClass(row.statusTone)} />
                        <span className={statusTextClass(row.statusTone)}>{row.statusLabel}</span>
                      </span>
                      <span className="flex items-center justify-center">
                        <AttemptStackIndicator
                          attemptBadges={row.attemptBadges}
                          attemptCount={row.attemptCount}
                        />
                      </span>
                      <span className="flex items-center">
                        {row.connectionState === "offline" ? (
                          <WifiOff className="h-5 w-5 text-[#cf2f25]" />
                        ) : (
                          <Wifi className="h-5 w-5 text-[#9aa8be]" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-[18px] font-semibold",
                          row.risk > 0 ? "text-[#b63817]" : "text-slate-800",
                        )}
                      >
                        {row.risk}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-8 py-12 text-center text-[15px] text-slate-500">
                  Сурагчийн бодит хяналтын өгөгдөл алга байна.
                </div>
              )}

              <div className="flex items-center justify-between px-8 py-6 text-[15px] text-slate-700">
                <p>
                  {studentRows.length === 0
                    ? "0 сурагч байна"
                    : `${studentRows.length} сурагчаас 1-${Math.min(studentRows.length, 6)}-ийг харуулж байна`}
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" className="text-slate-700">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" className="text-slate-700">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </section>

            <aside className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <h2 className="text-[20px] font-bold text-slate-900">Бодит цагийн мэдээлэл</h2>

              <div className="mt-8 space-y-5">
                {allMonitoringEvents.length > 0 ? (
                  allMonitoringEvents.slice(0, 4).map((event) => (
                    <article
                      key={event.id}
                      className={`rounded-[20px] border border-slate-100 px-6 py-5 ${alertContainerClass(event.tone)}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                          <event.icon className={`h-5 w-5 ${alertIconClass(event.tone)}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-[15px] font-bold ${alertIconClass(event.tone)}`}>
                                {event.title}
                              </p>
                              <p className="mt-1 text-[13px] text-slate-400">
                                {event.studentName}
                              </p>
                            </div>
                            <span className="text-[13px] text-slate-400">
                              {event.occurredLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-[15px] text-slate-700">{event.detail}</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 px-5 py-10 text-center text-[15px] text-slate-500">
                    Хяналтын event одоогоор бүртгэгдээгүй байна.
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="mt-8 h-11 w-full rounded-[14px] border-slate-200 text-[15px] font-semibold text-slate-600"
              >
                Бүгдийг харах
              </Button>
            </aside>
          </div>

          <Dialog
            open={selectedStudent !== null}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedStudentId(null);
              }
            }}
          >
            <DialogContent className="w-[min(100vw-2rem,64rem)]! max-w-none overflow-hidden rounded-[22px] border border-[#dfe7f2] bg-white p-0 shadow-[0_16px_46px_rgba(15,23,42,0.1)] [&>button:last-child]:right-5 [&>button:last-child]:top-4 [&>button:last-child]:h-6 [&>button:last-child]:w-6 [&>button:last-child]:rounded-full [&>button:last-child]:border-0 [&>button:last-child]:bg-transparent [&>button:last-child]:p-0 [&>button:last-child]:text-slate-900 [&>button:last-child]:opacity-100 [&>button:last-child]:shadow-none [&>button:last-child]:ring-0 [&>button:last-child]:transition-none [&>button:last-child]:hover:bg-transparent [&>button:last-child]:hover:text-slate-900 [&>button:last-child]:focus:outline-none [&>button:last-child]:focus-visible:ring-0 sm:max-w-none">
              {selectedStudent ? (
                <>
                  <DialogHeader className="px-5 py-4">
                    <DialogTitle className="text-[17px] font-bold text-slate-900">
                      {selectedStudent.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-[12px] text-slate-500">
                      Бүртгэгдсэн үйлдлүүд
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 border-t border-[#e8edf5] px-5 py-5">
                    <section className="space-y-3.5">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-[15px] font-bold text-slate-900">
                          Сэжигтэй үйлдлүүд
                        </h3>
                        <span className="rounded-full bg-[#eaf3ff] px-3.5 py-1.5 text-[12px] font-semibold text-[#0b5cab]">
                          {selectedStudent.risk} бүртгэл
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.attemptBadges.map((attempt) => (
                          <div key={attempt.id} className={attemptBadgeClass(attempt.tone)}>
                            <attempt.icon className="h-4 w-4 shrink-0" />
                            <span>{attempt.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-3.5">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-[15px] font-bold text-slate-900">
                          Бүртгэгдсэн дэлгэцийн зургууд
                        </h3>
                        <span className="rounded-full bg-[#eaf3ff] px-3.5 py-1.5 text-[12px] font-semibold text-[#0b5cab]">
                          {selectedStudent.screenshots.length} зураг
                        </span>
                      </div>

                      {selectedStudent.screenshots.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {selectedStudent.screenshots.map((screenshot) => (
                            <article
                              key={screenshot.id}
                              className="overflow-hidden rounded-[16px] border border-[#dfe7f2] bg-white"
                            >
                              <div className="relative aspect-[16/9] overflow-hidden border-b border-[#e8edf5] bg-[#edf3fb]">
                                <ScreenshotPreviewImage
                                  src={screenshot.url}
                                  fallbackSrc={screenshot.fallbackUrl}
                                  alt={`${selectedStudent.name} - ${screenshot.caption}`}
                                />
                              </div>
                              <div className="space-y-1 px-3.5 py-3">
                                <p className="text-[13px] font-semibold text-slate-900">
                                  {screenshot.caption}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Үүсгэсэн: {screenshot.occurredLabel.split(" • ")[0] ?? screenshot.occurredLabel}
                                </p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[14px] border border-dashed border-[#d9e2ec] px-4 py-7 text-center text-[12px] text-slate-500">
                          Энэ сурагчийн дэлгэцийн зураг хараахан бүртгэгдээгүй байна.
                        </div>
                      )}
                    </section>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <PerformanceTabContent
          correctCount={correctCount}
          canEditSelectedQuestionScore={canEditSelectedQuestionScore}
          incorrectCount={incorrectCount}
          isScoreEditing={isScoreEditing}
          openEndedCount={selectedAttempt?.questions.filter(
            (question) =>
              question.requiresManualReview || isOpenEndedQuestion(question),
          ).length ?? 0}
          selectedAttempt={selectedAttempt}
          selectedAttemptScoreLabel={selectedAttemptScoreLabel}
          selectedQuestionId={selectedQuestionId}
          selectedReviewAttemptId={selectedReviewAttemptId}
          onAwardPoints={(points) => {
            if (!selectedAttempt || !selectedQuestion) {
              return;
            }

            setLocalReviewAttempts((currentAttempts) =>
              currentAttempts.map((attempt) => {
                if (attempt.id !== selectedAttempt.id) {
                  return attempt;
                }

                const nextQuestions = attempt.questions.map((question) => {
                  if (question.id !== selectedQuestion.id) {
                    return question;
                  }

                  return {
                    ...question,
                    points: clampPoints(points, question.maxPoints),
                  };
                });

                return buildUpdatedAttempt(attempt, nextQuestions);
              }),
            );
          }}
          onMarkAttemptReviewed={() => {
            if (!selectedAttempt) {
              return;
            }

            setLocalReviewAttempts((currentAttempts) =>
              currentAttempts.map((attempt) =>
                attempt.id === selectedAttempt.id
                  ? buildUpdatedAttempt(
                      attempt,
                      attempt.questions.map((question) => markQuestionReviewed(question)),
                    )
                  : attempt,
              ),
            );
          }}
          onMarkQuestionReviewed={() => {
            if (!selectedAttempt || !selectedQuestion) {
              return;
            }

            setLocalReviewAttempts((currentAttempts) =>
              currentAttempts.map((attempt) => {
                if (attempt.id !== selectedAttempt.id) {
                  return attempt;
                }

                const nextQuestions = attempt.questions.map((question) =>
                  question.id === selectedQuestion.id
                    ? markQuestionReviewed(question)
                    : question,
                );

                return buildUpdatedAttempt(attempt, nextQuestions);
              }),
            );
            setIsScoreEditing(false);
          }}
          onSelectAttempt={setSelectedReviewAttemptId}
          onSelectQuestion={setSelectedQuestionId}
          onSetScoreEditing={setIsScoreEditing}
          reviewAttempts={localReviewAttempts}
        />
      )}
    </section>
  );
}

function PerformanceTabContent({
  correctCount,
  canEditSelectedQuestionScore,
  incorrectCount,
  isScoreEditing,
  openEndedCount,
  selectedAttempt,
  selectedAttemptScoreLabel,
  selectedQuestionId,
  selectedReviewAttemptId,
  onAwardPoints,
  onMarkAttemptReviewed,
  onMarkQuestionReviewed,
  onSelectAttempt,
  onSelectQuestion,
  onSetScoreEditing,
  reviewAttempts,
}: {
  correctCount: number;
  canEditSelectedQuestionScore: boolean;
  incorrectCount: number;
  isScoreEditing: boolean;
  openEndedCount: number;
  selectedAttempt: SubmittedAttempt | null;
  selectedAttemptScoreLabel: string;
  selectedQuestionId: string | null;
  selectedReviewAttemptId: string | null;
  onAwardPoints: (points: number) => void;
  onMarkAttemptReviewed: () => void;
  onMarkQuestionReviewed: () => void;
  onSelectAttempt: (attemptId: string | null) => void;
  onSelectQuestion: (questionId: string | null) => void;
  onSetScoreEditing: (nextValue: boolean) => void;
  reviewAttempts: SubmittedAttempt[];
}) {
  const [questionFilter, setQuestionFilter] =
    useState<PerformanceQuestionFilter>("all");
  const pendingCount = reviewAttempts.filter(
    (attempt) => attempt.status !== "reviewed",
  ).length;
  const selectedAttemptScoreSummary = selectedAttempt
    ? `${selectedAttemptScoreLabel} (${calculateAttemptPercentage(selectedAttempt)}%)`
    : "0/0 (0%)";
  const filteredQuestions =
    selectedAttempt?.questions.filter((question) => {
      if (questionFilter === "correct") {
        return question.reviewState === "correct";
      }
      if (questionFilter === "incorrect") {
        return question.reviewState === "incorrect";
      }
      if (questionFilter === "open") {
        return question.requiresManualReview || isOpenEndedQuestion(question);
      }

      return true;
    }) ?? [];
  const visibleSelectedQuestion =
    filteredQuestions.find((question) => question.id === selectedQuestionId) ?? null;
  const visibleSelectedQuestionReviewed = Boolean(
    selectedAttempt &&
      visibleSelectedQuestion &&
      isQuestionReviewed(selectedAttempt, visibleSelectedQuestion),
  );

  useEffect(() => {
    if (filteredQuestions.length === 0) {
      return;
    }

    const stillVisible = filteredQuestions.some(
      (question) => question.id === selectedQuestionId,
    );

    if (!stillVisible) {
      onSelectQuestion(filteredQuestions[0]?.id ?? null);
    }
  }, [filteredQuestions, onSelectQuestion, selectedQuestionId]);

  if (!selectedAttempt) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center text-[15px] text-slate-500">
        Хянах бодит илгээлт хараахан алга байна.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 px-6 py-6">
          <h2 className="text-[18px] font-semibold text-slate-900">Хянах дараалал</h2>
          <p className="mt-1 text-[14px] text-slate-500">
            {pendingCount} материал хүлээгдэж байна
          </p>
        </div>

        <div className="grid grid-cols-[1.45fr_0.8fr_0.45fr] border-b border-slate-200 px-6 py-4 text-[14px] font-medium text-slate-900">
          <span>Сурагчдын нэрс</span>
          <span>Төлөв</span>
          <span>Оноо</span>
        </div>

        <div>
          {reviewAttempts.map((attempt) => {
            const isSelected = attempt.id === selectedReviewAttemptId;

            return (
              <button
                key={attempt.id}
                type="button"
                onClick={() => onSelectAttempt(attempt.id)}
                className={`grid w-full grid-cols-[1.45fr_0.8fr_0.45fr] items-center border-b border-slate-100 px-6 py-4 text-left transition-colors hover:bg-slate-50 ${
                  isSelected ? "bg-[#fafcff]" : "bg-white"
                }`}
              >
                <span className="flex items-center gap-4">
                  <span className="h-9 w-9 rounded-full bg-[#d4d6da]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-slate-900">
                      {attempt.studentName}
                    </span>
                    <span className="block text-[13px] text-slate-500">
                      {formatShortTime(attempt.submissionTime)}
                    </span>
                  </span>
                </span>
                <span>
                  <span className={reviewStatusBadgeClass(attempt.status)}>
                    {formatReviewStatusLabel(attempt.status)}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-2 text-[16px] font-medium text-slate-800">
                  <span>{formatAttemptPercent(attempt)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-700" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-[18px] font-semibold text-slate-900">
              {selectedAttempt.studentName}
            </h2>
          </div>
          <Button
            disabled={selectedAttempt.status === "reviewed"}
            onClick={onMarkAttemptReviewed}
            className="h-[52px] rounded-[14px] bg-[#0b5cab] px-8 text-[15px] font-semibold shadow-[0_12px_24px_rgba(11,92,171,0.2)] hover:bg-[#094f95]"
          >
            Бүгдийг батлах
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-7 text-[14px] font-medium">
            <button
              type="button"
              onClick={() => setQuestionFilter("all")}
              className={performanceFilterTabClass(questionFilter === "all")}
            >
              <ClipboardCheck className="h-4 w-4 text-[#0b5cab]" />
              Бүгд: {selectedAttempt.questions.length}
            </button>
            <button
              type="button"
              onClick={() => setQuestionFilter("correct")}
              className={performanceFilterTabClass(questionFilter === "correct")}
            >
              <CheckCircle2 className="h-4 w-4 text-[#179c35]" />
              Зөв: {correctCount}
            </button>
            <button
              type="button"
              onClick={() => setQuestionFilter("incorrect")}
              className={performanceFilterTabClass(questionFilter === "incorrect")}
            >
              <XCircle className="h-4 w-4 text-[#ff3b30]" />
              Буруу: {incorrectCount}
            </button>
            <button
              type="button"
              onClick={() => setQuestionFilter("open")}
              className={performanceFilterTabClass(questionFilter === "open")}
            >
              <PenLine className="h-4 w-4 text-slate-700" />
              Нээлттэй: {openEndedCount}
            </button>
          </div>
          <p className="text-[15px] font-semibold text-slate-700">
            Оноо: {selectedAttemptScoreSummary}
          </p>
        </div>

        <div className="grid min-h-[680px] xl:grid-cols-[232px_1fr]">
          <aside className="border-r border-slate-200 bg-white">
            {filteredQuestions.map((question) => {
              const isSelected = question.id === selectedQuestionId;
              const isReviewed = isQuestionReviewed(selectedAttempt, question);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onSelectQuestion(question.id)}
                  className={cn(
                    "flex w-full items-center justify-between border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50",
                    isSelected && "bg-[#f2f6fb]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0b5cab]" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "truncate text-[15px]",
                        isReviewed || isSelected
                          ? "font-semibold text-slate-900"
                          : "text-slate-500",
                      )}
                    >
                      Асуулт {question.questionNumber}
                    </span>
                  </span>
                  <QuestionStateIcon
                    reviewState={question.reviewState}
                    reviewed={isReviewed}
                  />
                </button>
              );
            })}
          </aside>

          <div className="flex flex-col px-6 py-5">
            {visibleSelectedQuestion ? (
              <>
                <div>
                  <h3 className="text-[16px] font-medium text-slate-900">
                    Асуулт {visibleSelectedQuestion.questionNumber}
                  </h3>
                  <div className="mt-4 rounded-[14px] border border-slate-200 bg-[#f3f6fc] px-5 py-4 text-[15px] font-medium text-slate-800">
                    {normalizeDisplayText(visibleSelectedQuestion.questionText)}
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-between gap-4">
                  <h4 className="text-[15px] font-semibold text-slate-900">
                    Сурагчийн хариулт
                  </h4>
                  <span className={questionPointsClass(visibleSelectedQuestion.reviewState)}>
                    {visibleSelectedQuestion.points}/{visibleSelectedQuestion.maxPoints} оноо
                  </span>
                </div>

                <div className={studentAnswerClass(visibleSelectedQuestion.reviewState)}>
                  {normalizeDisplayText(visibleSelectedQuestion.studentAnswer)}
                </div>

                {canEditSelectedQuestionScore ? (
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-[14px] text-slate-600">Оноо</span>
                    <input
                      type="number"
                      min={0}
                      max={visibleSelectedQuestion.maxPoints}
                      step={1}
                      disabled={!isScoreEditing}
                      value={visibleSelectedQuestion.points}
                      onChange={(event) => {
                        onAwardPoints(Number(event.target.value));
                      }}
                      className={cn(
                        "h-10 w-24 rounded-[12px] border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-900 outline-none",
                        isScoreEditing
                          ? "border-[#0b5cab] ring-2 ring-[#dbeafe]"
                          : "cursor-default bg-slate-50 text-slate-500",
                      )}
                    />
                    <span className="text-[14px] text-slate-500">
                      / {visibleSelectedQuestion.maxPoints} оноо
                    </span>
                  </div>
                ) : null}

                <div className="mt-6">
                  <h4 className="text-[15px] font-semibold text-slate-900">
                    Зөв хариулт
                  </h4>
                  <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-[15px] font-medium text-slate-800">
                    {normalizeCorrectAnswerText(visibleSelectedQuestion.correctAnswer)}
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-[15px] font-semibold text-slate-900">
                    Зөв хариултын тайлбар
                  </h4>
                  <div className="mt-4 whitespace-pre-line rounded-[14px] border border-slate-200 bg-[#f3f6fc] px-5 py-4 text-[15px] leading-7 text-slate-800">
                    {resolveQuestionExplanation(visibleSelectedQuestion)}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-4 pt-8">
                  <button
                    type="button"
                    disabled={!canEditSelectedQuestionScore}
                    onClick={() => {
                      if (!canEditSelectedQuestionScore) {
                        return;
                      }
                      onSetScoreEditing(!isScoreEditing);
                    }}
                    className={cn(
                      "inline-flex items-center gap-3 text-[15px] font-semibold",
                      canEditSelectedQuestionScore
                        ? "text-slate-900"
                        : "cursor-not-allowed text-slate-400",
                    )}
                  >
                    <PenLine className="h-5 w-5" />
                    {isScoreEditing ? "Оноо хадгалах" : "Оноо өөрчлөх"}
                  </button>

                  <Button
                    variant="outline"
                    disabled={visibleSelectedQuestionReviewed}
                    onClick={onMarkQuestionReviewed}
                    className={cn(
                      "h-[52px] rounded-[14px] px-8 text-[15px] font-semibold",
                      visibleSelectedQuestionReviewed
                        ? "border-[#179c35] bg-[#179c35] text-white hover:bg-[#14862e]"
                        : "border-[#0b5cab] text-[#0b5cab] hover:bg-[#f4f8ff]",
                    )}
                  >
                    Хянасан
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center text-[15px] text-slate-500">
                {filteredQuestions.length === 0
                  ? "Сонгосон ангилалд асуулт алга."
                  : "Асуулт сонгоно уу."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ScreenshotPreviewImage({
  alt,
  fallbackSrc,
  src,
}: {
  alt: string;
  fallbackSrc?: string;
  src: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      className="h-full w-full object-cover"
      fill
      unoptimized
      sizes="(max-width: 1280px) 100vw, 33vw"
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}

function buildDisplayEvents(
  liveEvents: MonitoringEvent[],
  reviewAttempts: SubmittedAttempt[],
): DisplayEvent[] {
  const eventMap = new Map<string, DisplayEvent>();

  for (const event of liveEvents) {
    const appearance = getEventAppearance({
      code: event.code,
      severity: event.severity,
      title: event.title,
    });

    eventMap.set(event.id, {
      code: event.code,
      detail: localizeEventDetail(event.code, event.detail) ?? appearance.title,
      icon: appearance.icon,
      id: event.id,
      label: appearance.label,
      occurredLabel: formatRelativeTime(event.timestamp),
      screenshotUrl: event.screenshotUrl,
      severity: event.severity,
      studentId: event.studentId,
      studentName: event.studentName,
      timestamp: event.timestamp,
      title: appearance.title,
      tone: appearance.tone,
    });
  }

  for (const attempt of reviewAttempts) {
    for (const event of attempt.monitoringSummary.events) {
      const appearance = getEventAppearance({
        code: event.code,
        severity: event.severity,
        title: event.title,
      });

      eventMap.set(event.id, {
        code: event.code,
        detail: localizeEventDetail(event.code, event.detail) ?? appearance.title,
        icon: appearance.icon,
        id: event.id,
        label: appearance.label,
        occurredLabel: formatRelativeTime(event.occurredAt),
        screenshotUrl: event.screenshotUrl,
        severity: event.severity,
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        timestamp: event.occurredAt,
        title: appearance.title,
        tone: appearance.tone,
      });
    }
  }

  return [...eventMap.values()].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
}

function buildStudentRows(
  students: Student[],
  reviewAttempts: SubmittedAttempt[],
  events: DisplayEvent[],
): StudentRow[] {
  return [...students]
    .sort((left, right) => right.lastActivity.getTime() - left.lastActivity.getTime())
    .map((student) => {
      const studentEvents = events.filter((event) => event.studentId === student.id);
      const suspiciousStudentEvents = studentEvents.filter(
        (event) => !NON_SUSPICIOUS_EVENT_CODES.has(event.code ?? ""),
      );
      const uniqueAttemptBadges = suspiciousStudentEvents.reduce<EventBadge[]>((acc, event) => {
        if (acc.some((item) => item.label === event.label)) {
          return acc;
        }

        acc.push({
          icon: event.icon,
          id: event.id,
          label: event.label,
          tone: event.tone,
        });

        return acc;
      }, []);

      const attemptBadges =
        uniqueAttemptBadges.length > 0
          ? uniqueAttemptBadges.slice(0, 3)
          : [
              {
                icon: CheckCircle2,
                id: `${student.id}-clean`,
                label: "Зөрчил бүртгэгдээгүй",
                tone: "muted" as const,
              },
            ];

      const screenshots = studentEvents
        .filter((event) => !NON_SUSPICIOUS_EVENT_CODES.has(event.code ?? ""))
        .slice(0, 6)
        .map((event) => {
          const fallbackUrl = getEventFallbackImageUrl(event.code);

          return {
            caption: event.title,
            fallbackUrl,
            id: event.id,
            occurredLabel: `${event.occurredLabel} • ${event.label}`,
            url: event.screenshotUrl ?? fallbackUrl,
          };
        });

      const latestAttempt = reviewAttempts.find(
        (attempt) => attempt.studentId === student.id,
      );

      return {
        attemptBadges,
        attemptCount: suspiciousStudentEvents.length,
        connectionState: toConnectionState(student.monitoringState),
        id: student.id,
        name: student.name,
        risk: uniqueAttemptBadges.length,
        scoreLabel:
          latestAttempt?.score !== undefined ? `${latestAttempt.score}%` : "Хүлээгдэж байна",
        screenshots,
        statusLabel: formatStudentStatus(student.status),
        statusTone: toStudentStatusTone(student),
      };
    });
}

function getEventAppearance({
  code,
  severity,
  title,
}: {
  code?: string;
  severity: "danger" | "info" | "warning";
  title: string;
}) {
  if (code === "attempt-finalize") {
    return {
      icon: CheckCircle2,
      label: "Шалгалт илгээсэн",
      title: "Шалгалт илгээсэн",
      tone: "info" as const,
    };
  }
  if (code === "connection_lost") {
    return {
      icon: WifiOff,
      label: "Холболт тасарсан",
      title: "Холболт тасарсан",
      tone: "danger" as const,
    };
  }
  if (code === "connection_restored") {
    return {
      icon: Wifi,
      label: "Холболт сэргэсэн",
      title: "Холболт сэргэсэн",
      tone: "info" as const,
    };
  }
  if (code === "tab_hidden" || code === "window_blur") {
    return {
      icon: Copy,
      label: "Таб сольсон",
      title: "Таб сольсон",
      tone: "warning" as const,
    };
  }
  if (code === "tab_visible" || code === "window_focus") {
    return {
      icon: CheckCircle2,
      label: "Таб руу буцсан",
      title: "Таб руу буцсан",
      tone: "info" as const,
    };
  }
  if (
    code === "split-view-suspected" ||
    code === "device_change_suspected" ||
    code === "parallel-tab-suspected"
  ) {
    return {
      icon: AppWindow,
      label: "Олон цонх нээсэн",
      title: "Олон цонх нээсэн",
      tone: "danger" as const,
    };
  }
  if (
    code === "fullscreen-not-active" ||
    code === "viewport-resize-suspicious" ||
    code === "fullscreen-exit"
  ) {
    return {
      icon: VideoOff,
      label: "Цонх жижигрүүлсэн",
      title: "Цонх жижигрүүлсэн",
      tone: "warning" as const,
    };
  }
  if (code?.includes("devtools")) {
    return {
      icon: AlertTriangle,
      label: "Хөгжүүлэгчийн цонх нээсэн",
      title: "Хөгжүүлэгчийн цонх нээсэн",
      tone: "danger" as const,
    };
  }
  if (code?.startsWith("shortcut")) {
    return {
      icon: AlertTriangle,
      label: "Хос товч ашигласан",
      title: "Хос товч ашигласан",
      tone: "warning" as const,
    };
  }
  if (severity === "danger") {
    return { icon: AlertTriangle, label: title, title, tone: "danger" as const };
  }
  if (severity === "warning") {
    return { icon: TriangleAlert, label: title, title, tone: "warning" as const };
  }

  return { icon: CheckCircle2, label: title, title, tone: "info" as const };
}

function QuestionStateIcon({
  reviewState,
  reviewed,
}: {
  reviewState: QuestionReview["reviewState"];
  reviewed?: boolean;
}) {
  if (reviewed) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#179c35] text-white shadow-[0_3px_8px_rgba(23,156,53,0.16)]">
        <CheckCircle2 className="h-3 w-3" />
      </span>
    );
  }

  if (reviewState === "correct") {
    return <CheckCircle2 className="h-5 w-5 text-[#179c35]" />;
  }

  if (reviewState === "incorrect") {
    return <XCircle className="h-5 w-5 text-[#ff3b30]" />;
  }

  return <TriangleAlert className="h-5 w-5 text-[#f59e0b]" />;
}

function tabClassName(isActive: boolean) {
  return isActive
    ? "border-b-[3px] border-slate-900 pb-3 text-[16px] font-bold text-slate-900"
    : "pb-3 text-[16px] font-bold text-slate-900 opacity-80";
}

function performanceFilterTabClass(isActive: boolean) {
  return cn(
    "flex items-center gap-2 border-b-[3px] pb-3 transition-colors",
    isActive
      ? "border-slate-900 text-slate-900"
      : "border-transparent text-slate-900/90 hover:text-slate-900",
  );
}

function reviewStatusBadgeClass(status: SubmittedAttempt["status"]) {
  switch (status) {
    case "reviewed":
      return "inline-flex rounded-full border border-[#9de2c1] bg-[#daf5e8] px-3.5 py-1.5 text-[13px] font-medium text-[#119a62]";
    case "in-review":
      return "inline-flex rounded-full border border-[#c7d7ec] bg-[#eef5ff] px-3.5 py-1.5 text-[13px] font-medium text-[#0b5cab]";
    default:
      return "inline-flex rounded-full border border-[#f3d6aa] bg-[#fff3df] px-3.5 py-1.5 text-[13px] font-medium text-[#cf7c10]";
  }
}

function questionPointsClass(reviewState: QuestionReview["reviewState"]) {
  if (reviewState === "correct") {
    return "inline-flex rounded-full border border-[#9de2c1] bg-[#eefaf3] px-4 py-2 text-[13px] font-semibold text-[#12794d]";
  }

  if (reviewState === "incorrect") {
    return "inline-flex rounded-full border border-[#f5b8b2] bg-[#fff1ef] px-4 py-2 text-[13px] font-semibold text-[#c3382b]";
  }

  return "inline-flex rounded-full border border-[#f5deb3] bg-[#fff7ea] px-4 py-2 text-[13px] font-semibold text-[#b7791f]";
}

function studentAnswerClass(reviewState: QuestionReview["reviewState"]) {
  if (reviewState === "correct") {
    return "mt-5 rounded-[16px] border border-[#abdcbc] bg-[#eefaf3] px-6 py-5 text-[16px] font-semibold text-slate-800";
  }

  if (reviewState === "incorrect") {
    return "mt-5 rounded-[16px] border border-[#f3c1bb] bg-[#fff3f1] px-6 py-5 text-[16px] font-semibold text-slate-800";
  }

  return "mt-5 rounded-[16px] border border-[#f5deb3] bg-[#fff8ec] px-6 py-5 text-[16px] font-semibold text-slate-800";
}

function statusDotClass(tone: StudentStatusTone) {
  switch (tone) {
    case "online":
      return "h-3 w-3 rounded-full bg-[#179c35]";
    case "warning":
      return "h-3 w-3 rounded-full bg-[#9f3412]";
    case "danger":
      return "h-3 w-3 rounded-full bg-[#dc2626]";
    default:
      return "h-3 w-3 rounded-full bg-[#cbd5e1]";
  }
}

function statusTextClass(tone: StudentStatusTone) {
  switch (tone) {
    case "danger":
      return "text-[#dc2626]";
    case "muted":
      return "text-slate-600";
    default:
      return "text-slate-800";
  }
}

function alertContainerClass(tone: EventTone) {
  switch (tone) {
    case "danger":
      return "border-l-4 border-l-[#ff630f] bg-[#fff8f1]";
    case "info":
      return "border-l-4 border-l-[#8aa4c8] bg-[#eef5ff]";
    default:
      return "border-l-4 border-l-[#ff630f] bg-[#fff8f1]";
  }
}

function alertIconClass(tone: EventTone) {
  switch (tone) {
    case "danger":
      return "text-[#cf2f25]";
    case "info":
      return "text-[#1f5ea8]";
    case "muted":
      return "text-slate-500";
    default:
      return "text-[#ff630f]";
  }
}

function attemptIndicatorToneClasses(tone: EventTone) {
  switch (tone) {
    case "danger":
      return {
        border: "border-[#f0c6bf]",
        icon: "text-[#c33f2c]",
        layer: "bg-[#fff8f6]",
      };
    case "info":
      return {
        border: "border-[#c7d7ec]",
        icon: "text-[#0b5cab]",
        layer: "bg-[#f5f9ff]",
      };
    case "muted":
      return {
        border: "border-[#d9e1eb]",
        icon: "text-slate-500",
        layer: "bg-[#fafbfd]",
      };
    default:
      return {
        border: "border-[#f1d4ac]",
        icon: "text-[#cf7c10]",
        layer: "bg-[#fffaf1]",
      };
  }
}

function AttemptStackIndicator({
  attemptBadges,
  attemptCount,
}: Pick<StudentRow, "attemptBadges" | "attemptCount">) {
  const primaryBadge = attemptBadges[0];
  const PrimaryIcon = primaryBadge?.icon ?? AppWindow;
  const tone = primaryBadge?.tone ?? "muted";
  const classes = attemptIndicatorToneClasses(tone);

  if (attemptCount === 0) {
    return (
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-400 shadow-[0_6px_14px_rgba(15,23,42,0.05)]">
        <PrimaryIcon className="h-5 w-5" />
      </span>
    );
  }

  return (
    <div className="flex w-full items-center justify-center">
      <div className="relative h-8 w-[44px] shrink-0">
        <span
          className={cn(
            "absolute left-4 top-0 h-8 w-8 rounded-[11px] border shadow-[0_3px_8px_rgba(15,23,42,0.05)]",
            classes.border,
            classes.layer,
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "absolute left-2 top-0 h-8 w-8 rounded-[11px] border shadow-[0_3px_8px_rgba(15,23,42,0.06)]",
            classes.border,
            classes.layer,
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-[11px] border bg-white shadow-[0_6px_14px_rgba(15,23,42,0.08)]",
            classes.border,
          )}
        >
          <PrimaryIcon className={cn("h-4 w-4", classes.icon)} />
        </span>
      </div>
    </div>
  );
}

function attemptBadgeClass(tone: EventTone) {
  switch (tone) {
    case "danger":
      return "inline-flex items-center gap-1.5 rounded-full border border-[#f3d6aa] bg-[#fff7ea] px-3.5 py-1.5 text-[12px] font-medium text-[#cf7c10]";
    case "info":
      return "inline-flex items-center gap-1.5 rounded-full border border-[#c7d7ec] bg-[#eef5ff] px-3.5 py-1.5 text-[12px] font-medium text-[#0b5cab]";
    case "muted":
      return "inline-flex items-center gap-1.5 rounded-full border border-[#d7dee8] bg-[#f7f9fc] px-3.5 py-1.5 text-[12px] font-medium text-slate-600";
    default:
      return "inline-flex items-center gap-1.5 rounded-full border border-[#f3d6aa] bg-[#fff7ea] px-3.5 py-1.5 text-[12px] font-medium text-[#cf7c10]";
  }
}

function toConnectionState(state: Student["monitoringState"]): StudentConnectionState {
  return state === "offline" ? "offline" : state === "online" || state === "reconnected"
    ? "online"
    : "idle";
}

function toStudentStatusTone(student: Student): StudentStatusTone {
  if (student.monitoringState === "offline") {
    return "danger";
  }
  if (student.status === "approved") {
    return "muted";
  }
  if (student.dangerCount > 0 || student.warningCount > 0) {
    return "warning";
  }
  return "online";
}

function formatStudentStatus(status: Student["status"]) {
  switch (status) {
    case "in-progress":
      return "Идэвхтэй";
    case "processing":
      return "Хянагдаж байна";
    case "submitted":
      return "Илгээсэн";
    case "approved":
      return "Хянасан";
    default:
      return "Тодорхойгүй";
  }
}

function formatReviewStatusLabel(status: SubmittedAttempt["status"]) {
  switch (status) {
    case "reviewed":
      return "Хянасан";
    case "in-review":
      return "Хянаж байна";
    default:
      return "Хүлээж байна";
  }
}

function resolveQuestionExplanation(question: QuestionReview) {
  const explanation =
    question.explanation?.trim() ||
    question.aiAnalysis?.trim() ||
    question.correctAnswer?.trim() ||
    "Тайлбар ирээгүй байна.";

  if (question.explanation?.trim() || question.aiAnalysis?.trim()) {
    return explanation;
  }

  return `Зөв хариулт: ${explanation}`;
}

function clampPoints(value: number, maxPoints: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.round(value), maxPoints));
}

function isOpenEndedQuestion(question: QuestionReview) {
  const normalizedType = question.questionType?.toLowerCase() ?? "";
  return (
    normalizedType.includes("math") ||
    normalizedType.includes("open") ||
    normalizedType.includes("essay") ||
    normalizedType.includes("written")
  );
}

function isQuestionReviewed(attempt: SubmittedAttempt, question: QuestionReview) {
  if (question.reviewState !== "pending") {
    return true;
  }

  if (question.requiresManualReview) {
    return attempt.status === "reviewed";
  }

  return false;
}

function markQuestionReviewed(question: QuestionReview): QuestionReview {
  if (question.reviewState === "pending") {
    if (question.points >= question.maxPoints) {
      return {
        ...question,
        points: clampPoints(question.points, question.maxPoints),
        reviewState: "correct",
      };
    }

    return {
      ...question,
      points: clampPoints(question.points, question.maxPoints),
      reviewState: "incorrect",
    };
  }

  return {
    ...question,
    points: clampPoints(question.points, question.maxPoints),
  };
}

function buildUpdatedAttempt(
  attempt: SubmittedAttempt,
  nextQuestions: QuestionReview[],
): SubmittedAttempt {
  const totalMaxPoints = nextQuestions.reduce(
    (sum, question) => sum + question.maxPoints,
    0,
  );
  const totalAwardedPoints = nextQuestions.reduce(
    (sum, question) => sum + clampPoints(question.points, question.maxPoints),
    0,
  );
  const hasPendingQuestions = nextQuestions.some(
    (question) => question.reviewState === "pending",
  );

  return {
    ...attempt,
    questions: nextQuestions,
    score:
      totalMaxPoints > 0
        ? Math.round((totalAwardedPoints / totalMaxPoints) * 100)
        : 0,
    status: hasPendingQuestions ? "in-review" : "reviewed",
  };
}

function formatAttemptPoints(attempt: SubmittedAttempt) {
  const totalAwardedPoints = attempt.questions.reduce(
    (sum, question) => sum + clampPoints(question.points, question.maxPoints),
    0,
  );
  const totalMaxPoints = attempt.questions.reduce(
    (sum, question) => sum + question.maxPoints,
    0,
  );

  if (totalMaxPoints === 0) {
    return "0/0";
  }

  return `${totalAwardedPoints}/${totalMaxPoints}`;
}

function calculateAttemptPercentage(attempt: SubmittedAttempt) {
  const totalAwardedPoints = attempt.questions.reduce(
    (sum, question) => sum + clampPoints(question.points, question.maxPoints),
    0,
  );
  const totalMaxPoints = attempt.questions.reduce(
    (sum, question) => sum + question.maxPoints,
    0,
  );

  if (totalMaxPoints === 0) {
    return 0;
  }

  return Math.round((totalAwardedPoints / totalMaxPoints) * 100);
}

function formatAttemptPercent(attempt: SubmittedAttempt) {
  return `${attempt.score ?? calculateAttemptPercentage(attempt)}%`;
}

function normalizeDisplayText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Хариу оруулаагүй";
}

function normalizeCorrectAnswerText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Зөв хариулт ирээгүй байна.";
}

function localizeEventDetail(code?: string, detail?: string) {
  switch (code) {
    case "attempt-finalize":
      return "Шалгалтыг амжилттай илгээж дуусгасан.";
    case "connection_lost":
      return "Интернэт холболт тасарсан байна.";
    case "connection_restored":
      return "Интернэт холболт дахин сэргэж хэвийн болсон.";
    case "tab_hidden":
    case "window_blur":
      return "Шалгалтын табаас гарсан эсвэл өөр цонх руу шилжсэн.";
    case "tab_visible":
    case "window_focus":
      return "Шалгалтын таб руу буцаж орсон.";
    case "split-view-suspected":
    case "device_change_suspected":
    case "parallel-tab-suspected":
      return "Олон цонх эсвэл хуваасан дэлгэц ашигласан байж болзошгүй.";
    case "fullscreen-not-active":
    case "fullscreen-exit":
    case "viewport-resize-suspicious":
      return "Шалгалтын цонх жижигэрсэн эсвэл бүтэн дэлгэцээс гарсан.";
    default:
      break;
  }

  if (code?.includes("devtools")) {
    return "Хөгжүүлэгчийн хэрэгсэл нээсэн байж болзошгүй.";
  }

  if (code?.startsWith("shortcut")) {
    return "Сэжигтэй хос товчийн үйлдэл илэрлээ.";
  }

  return detail;
}

function getEventFallbackImageUrl(code?: string) {
  if (
    code === "split-view-suspected" ||
    code === "device_change_suspected" ||
    code === "parallel-tab-suspected"
  ) {
    return "/split-tab.png";
  }

  if (
    code?.includes("devtools") ||
    code?.startsWith("shortcut") ||
    code?.includes("clipboard") ||
    code?.includes("copy") ||
    code?.includes("paste") ||
    code?.includes("contextmenu")
  ) {
    return "/devtool.png";
  }

  return "/switch-tab.png";
}

function padCount(value: number) {
  return String(value).padStart(2, "0");
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(date: Date) {
  return date.toLocaleString("mn-MN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRelativeTime(date: Date) {
  const diffSecs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

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

  return formatDateTime(date);
}

function formatRemainingTime(endTime: Date | undefined, currentTime: number) {
  if (!endTime) {
    return null;
  }

  const remainingMs = Math.max(0, endTime.getTime() - currentTime);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
