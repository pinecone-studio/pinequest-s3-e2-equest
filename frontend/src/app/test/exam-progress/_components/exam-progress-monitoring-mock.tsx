"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  AppWindow,
  Check,
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
import MathPreviewText from "@/components/math-preview-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatMonitoringEventDetail } from "@/lib/format-monitoring-event-detail";
import { isMathQuestionType } from "@/lib/is-math-question-type";
import { localizeMonitoringEventTitle } from "@/lib/monitoring-event-localization";
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
  isApprovingAttemptId?: string | null;
  lastUpdated: Date | null;
  onBack: () => void;
  onApproveAttempt?: (attempt: SubmittedAttempt) => Promise<void>;
  reviewAttempts: SubmittedAttempt[];
  students: Student[];
};

type MonitoringTab = "monitoring" | "performance";
type EventTone = "danger" | "info" | "muted" | "warning";
type PerformanceQuestionFilter = "all" | "correct" | "incorrect" | "open";
type StudentConnectionState = "idle" | "offline" | "online";
type StudentStatusTone = "danger" | "muted" | "online" | "warning";

type EventBadge = {
  count: number;
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
  count: number;
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

type KpiCardKey = (typeof KPI_CARD_CONFIG)[number]["key"];

type KpiHoverItem = {
  id: string;
  label: string;
  meta: string;
};

type KpiHoverDetail = {
  description: string;
  emptyMessage: string;
  items: KpiHoverItem[];
  title: string;
};

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

const SUSPICIOUS_EVENT_CODES = new Set([
  "clipboard-copy",
  "clipboard-cut",
  "clipboard-paste",
  "context-menu",
  "device_change_suspected",
  "fullscreen-exit",
  "fullscreen-not-active",
  "parallel-tab-suspected",
  "split-view-suspected",
  "tab_hidden",
  "viewport-resize-suspicious",
  "window_blur",
]);

function isSuspiciousEventCode(code?: string) {
  if (!code) {
    return false;
  }

  return (
    SUSPICIOUS_EVENT_CODES.has(code) ||
    code.includes("devtools") ||
    code.startsWith("shortcut-")
  );
}

function sumEventCounts<T extends { count?: number }>(events: T[]) {
  return events.reduce((total, event) => total + (event.count ?? 1), 0);
}

export function ExamProgressMonitoring({
  exam,
  events,
  isApprovingAttemptId = null,
  onBack,
  onApproveAttempt,
  reviewAttempts,
  students,
}: ExamProgressMonitoringProps) {
  const [activeTab, setActiveTab] = useState<MonitoringTab>("monitoring");
  const [localReviewAttempts, setLocalReviewAttempts] =
    useState<SubmittedAttempt[]>(reviewAttempts);
  const [isAllEventsDialogOpen, setIsAllEventsDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );
  const [selectedScreenshot, setSelectedScreenshot] =
    useState<EventScreenshot | null>(null);
  const [selectedReviewAttemptId, setSelectedReviewAttemptId] = useState<
    string | null
  >(reviewAttempts[0]?.id ?? null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    reviewAttempts[0]?.questions[0]?.id ?? null,
  );
  const [isScoreEditing, setIsScoreEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [mockRemainingEndTime] = useState(
    () => new Date(Date.now() + 30 * 60 * 1000),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setLocalReviewAttempts((currentAttempts) =>
      mergeReviewAttempts(currentAttempts, reviewAttempts),
    );
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
      ? (localReviewAttempts.find(
          (attempt) => attempt.id === selectedReviewAttemptId,
        ) ?? localReviewAttempts[0])
      : localReviewAttempts[0];

    if (nextAttempt.id !== selectedReviewAttemptId) {
      setSelectedReviewAttemptId(nextAttempt.id);
    }

    const hasSelectedQuestion = nextAttempt.questions.some(
      (question) => question.id === selectedQuestionId,
    );
    const nextQuestionId = hasSelectedQuestion
      ? selectedQuestionId
      : (nextAttempt.questions[0]?.id ?? null);

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
  const stackedMonitoringEvents = useMemo(
    () => stackDisplayEvents(allMonitoringEvents),
    [allMonitoringEvents],
  );

  const studentRows = useMemo(
    () => buildStudentRows(students, localReviewAttempts, allMonitoringEvents),
    [allMonitoringEvents, localReviewAttempts, students],
  );

  const selectedStudent = useMemo(
    () =>
      studentRows.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, studentRows],
  );

  const selectedAttempt = useMemo(
    () =>
      localReviewAttempts.find(
        (attempt) => attempt.id === selectedReviewAttemptId,
      ) ??
      localReviewAttempts[0] ??
      null,
    [localReviewAttempts, selectedReviewAttemptId],
  );

  const selectedQuestion = useMemo(
    () =>
      selectedAttempt?.questions.find(
        (question) => question.id === selectedQuestionId,
      ) ??
      selectedAttempt?.questions[0] ??
      null,
    [selectedAttempt, selectedQuestionId],
  );

  const correctCount =
    selectedAttempt?.questions.filter(
      (question) => question.reviewState === "correct",
    ).length ?? 0;
  const incorrectCount =
    selectedAttempt?.questions.filter(
      (question) => question.reviewState === "incorrect",
    ).length ?? 0;
  const selectedAttemptScoreLabel = selectedAttempt
    ? formatAttemptPoints(selectedAttempt)
    : "Хүлээгдэж байна";

  const totalStudentCount = Math.max(exam.totalStudentCount, students.length);
  const activeStudentCount = students.filter(
    (student) =>
      student.status === "in-progress" || student.status === "processing",
  ).length;
  const submittedCount = localReviewAttempts.length;
  const suspiciousMonitoringEvents = useMemo(
    () =>
      stackedMonitoringEvents.filter((event) => isSuspiciousEventCode(event.code)),
    [stackedMonitoringEvents],
  );
  const suspiciousAttemptCount = useMemo(
    () => sumEventCounts(suspiciousMonitoringEvents),
    [suspiciousMonitoringEvents],
  );
  const totalMonitoringEventCount = useMemo(
    () => sumEventCounts(stackedMonitoringEvents),
    [stackedMonitoringEvents],
  );
  const offlineCount = students.filter(
    (student) => student.monitoringState === "offline",
  ).length;
  const activeStudents = useMemo(
    () =>
      [...students]
        .filter(
          (student) =>
            student.status === "in-progress" || student.status === "processing",
        )
        .sort((left, right) => right.lastActivity.getTime() - left.lastActivity.getTime()),
    [students],
  );
  const suspiciousStudents = useMemo(() => {
    const counts = new Map<string, { count: number; name: string }>();

    for (const event of suspiciousMonitoringEvents) {
      const existing = counts.get(event.studentId);
      if (existing) {
        existing.count += event.count;
        continue;
      }

      counts.set(event.studentId, {
        count: event.count,
        name: event.studentName,
      });
    }

    return [...counts.entries()]
      .map(([studentId, value]) => ({
        count: value.count,
        studentId,
        studentName: value.name,
      }))
      .sort((left, right) => right.count - left.count);
  }, [suspiciousMonitoringEvents]);
  const offlineStudents = useMemo(
    () =>
      [...students]
        .filter((student) => student.monitoringState === "offline")
        .sort((left, right) => right.lastActivity.getTime() - left.lastActivity.getTime()),
    [students],
  );

  const kpiValues = {
    active: `${activeStudentCount}/${Math.max(totalStudentCount, activeStudentCount)}`,
    offline: padCount(offlineCount),
    submitted: String(submittedCount),
    warnings: padCount(suspiciousAttemptCount),
  };
  const kpiHoverDetails = useMemo<Record<KpiCardKey, KpiHoverDetail>>(
    () => ({
      active: {
        description: `Нийт ${Math.max(totalStudentCount, activeStudentCount)} сурагчаас ${activeStudentCount} нь одоо шалгалт өгч байна.`,
        emptyMessage: "Одоогоор идэвхтэй шалгалт өгч буй сурагч алга байна.",
        items: activeStudents.map((student) => ({
          id: student.id,
          label: student.name,
          meta: `${formatStudentStatus(student.status)} • Явц ${student.progress}%`,
        })),
        title: "Шалгалт өгч буй сурагчид",
      },
      offline: {
        description: `${offlineCount} сурагчийн холболт одоогоор тасарсан байна.`,
        emptyMessage: "Одоогоор холболт тасарсан сурагч алга байна.",
        items: offlineStudents.map((student) => ({
          id: student.id,
          label: student.name,
          meta: `${formatStudentStatus(student.status)} • Сүүлд ${formatDateTime(student.lastActivity)}`,
        })),
        title: "Холболт тасарсан сурагчид",
      },
      submitted: {
        description: `${submittedCount} сурагчийн илгээсэн ажил review хэсэгт орж ирсэн байна.`,
        emptyMessage: "Одоогоор илгээсэн шалгалт алга байна.",
        items: [...localReviewAttempts]
          .sort(
            (left, right) =>
              right.submissionTime.getTime() - left.submissionTime.getTime(),
          )
          .map((attempt) => ({
            id: attempt.id,
            label: attempt.studentName,
            meta: `${formatShortTime(attempt.submissionTime)} • ${formatReviewStatusLabel(attempt.status)}`,
          })),
        title: "Шалгалт илгээсэн сурагчид",
      },
      warnings: {
        description: `${suspiciousAttemptCount} сэжигтэй үйлдэл бүртгэгдсэн бөгөөд доор сурагчаар нь харуулж байна.`,
        emptyMessage: "Одоогоор сэжигтэй үйлдэл бүртгэгдээгүй байна.",
        items: suspiciousStudents.map((student) => ({
          id: student.studentId,
          label: student.studentName,
          meta: `${student.count} сэжигтэй бүртгэл`,
        })),
        title: "Анхааруулгатай сурагчид",
      },
    }),
    [
      activeStudentCount,
      activeStudents,
      localReviewAttempts,
      offlineCount,
      offlineStudents,
      submittedCount,
      suspiciousAttemptCount,
      suspiciousStudents,
      totalStudentCount,
    ],
  );
  const showRemainingTime = activeStudentCount > 0 && !exam.endTime;
  const remainingTimeCountdownLabel =
    showRemainingTime
      ? formatRemainingTime(mockRemainingEndTime, currentTime) ?? "00:30:00"
      : null;

  return (
    <section className="min-h-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="h-10 rounded-[14px] px-3 text-[14px] font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Шалгалтын явц руу буцах
          </Button>

          <div className="flex flex-wrap items-end gap-11">
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
        </div>

        {showRemainingTime ? (
          <div className="flex min-w-42 flex-col rounded-[12px] border border-[#0b5cab] bg-white px-4 py-2 text-right text-slate-900">
            <span className="text-[13px] font-semibold leading-none">
              Үлдсэн хугацаа:
            </span>
            <span className="mt-1 text-[18px] font-bold leading-none tracking-[0.02em] text-[#0b5cab]">
              {remainingTimeCountdownLabel}
            </span>
          </div>
        ) : null}
      </div>

      {activeTab === "monitoring" ? (
        <>
          <div className="grid gap-5 xl:grid-cols-4">
            {KPI_CARD_CONFIG.map((card) => (
              <HoverCard key={card.key} closeDelay={120} openDelay={120}>
                <HoverCardTrigger asChild>
                  <article
                    tabIndex={0}
                    aria-label={`${card.title} дэлгэрэнгүйг харах`}
                    className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white px-7 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)] outline-none transition-all duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)] focus-visible:ring-2 focus-visible:ring-[#0b5cab]/20"
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-[5px] rounded-l-[24px] ${card.accent} transition-all duration-200 group-hover:w-[7px]`}
                      aria-hidden="true"
                    />
                    <span
                      className={`pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full ${card.accent} opacity-[0.08] blur-2xl transition-all duration-200 group-hover:scale-110 group-hover:opacity-[0.14]`}
                      aria-hidden="true"
                    />
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[17px] font-bold text-slate-700 transition-colors duration-200 group-hover:text-slate-900">
                        {card.title}
                      </p>
                      <card.icon
                        className={`h-6 w-6 ${card.tone} transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5`}
                      />
                    </div>
                    <p
                      className={`mt-10 text-[42px] font-bold leading-none ${card.tone} transition-transform duration-200 group-hover:translate-x-0.5`}
                    >
                      {kpiValues[card.key]}
                    </p>
                  </article>
                </HoverCardTrigger>
                <HoverCardContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  className="w-[22rem] rounded-[20px] border border-slate-200 bg-white p-0 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {kpiHoverDetails[card.key].title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {kpiHoverDetails[card.key].description}
                    </p>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
                    {kpiHoverDetails[card.key].items.length > 0 ? (
                      kpiHoverDetails[card.key].items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[14px] border border-slate-100 bg-slate-50/70 px-3 py-2"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.meta}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">
                        {kpiHoverDetails[card.key].emptyMessage}
                      </div>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-200 px-8 py-7">
                <h2 className="text-[20px] font-bold text-slate-900">
                  Сурагчдын явц
                </h2>
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
                        <span className={statusTextClass(row.statusTone)}>
                          {row.statusLabel}
                        </span>
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
              <h2 className="text-[20px] font-bold text-slate-900">
                Бодит цагийн мэдээлэл
              </h2>

              <div className="mt-8 space-y-5">
                {stackedMonitoringEvents.length > 0 ? (
                  stackedMonitoringEvents.slice(0, 4).map((event) => (
                    <article
                      key={event.id}
                      className={`rounded-[20px] border border-slate-100 px-6 py-5 ${alertContainerClass(event.tone)}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                          <event.icon
                            className={`h-5 w-5 ${alertIconClass(event.tone)}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p
                                className={`text-[15px] font-bold ${alertIconClass(event.tone)}`}
                              >
                                {event.title}
                              </p>
                              <p className="mt-1 text-[13px] text-slate-400">
                                {event.studentName}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {event.count > 1 ? (
                                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
                                  x{event.count}
                                </span>
                              ) : null}
                              <span className="text-[13px] text-slate-400">
                                {event.occurredLabel}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-[15px] text-slate-700">
                            {event.detail}
                          </p>
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
                onClick={() => setIsAllEventsDialogOpen(true)}
              >
                Бүгдийг харах
              </Button>
            </aside>
          </div>

          <Dialog
            open={isAllEventsDialogOpen}
            onOpenChange={setIsAllEventsDialogOpen}
          >
            <DialogContent className="w-[min(100vw-2rem,64rem)]! max-w-none overflow-hidden rounded-[22px] border border-[#dfe7f2] bg-white p-0 shadow-[0_16px_46px_rgba(15,23,42,0.1)] [&>button:last-child]:right-5 [&>button:last-child]:top-4 [&>button:last-child]:h-6 [&>button:last-child]:w-6 [&>button:last-child]:rounded-full [&>button:last-child]:border-0 [&>button:last-child]:bg-transparent [&>button:last-child]:p-0 [&>button:last-child]:text-slate-900 [&>button:last-child]:opacity-100 [&>button:last-child]:shadow-none [&>button:last-child]:ring-0 [&>button:last-child]:transition-none [&>button:last-child]:hover:bg-transparent [&>button:last-child]:hover:text-slate-900 [&>button:last-child]:focus:outline-none [&>button:last-child]:focus-visible:ring-0 sm:max-w-none">
              <DialogHeader className="px-5 py-4">
                <DialogTitle className="text-[17px] font-bold text-slate-900">
                  Бодит цагийн бүх мэдээлэл
                </DialogTitle>
                <DialogDescription className="mt-1 text-[12px] text-slate-500">
                  {stackedMonitoringEvents.length > 0
                    ? `${totalMonitoringEventCount} event бүртгэгдсэн байна.`
                    : "Одоогоор бүртгэгдсэн event алга байна."}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[min(70vh,48rem)] overflow-y-auto border-t border-[#e8edf5] px-5 py-5">
                {stackedMonitoringEvents.length > 0 ? (
                  <div className="space-y-4">
                    {stackedMonitoringEvents.map((event) => (
                      <article
                        key={event.id}
                        className={`rounded-[20px] border border-slate-100 px-6 py-5 ${alertContainerClass(event.tone)}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                            <event.icon
                              className={`h-5 w-5 ${alertIconClass(event.tone)}`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p
                                  className={`text-[15px] font-bold ${alertIconClass(event.tone)}`}
                                >
                                  {event.title}
                                </p>
                                <p className="mt-1 text-[13px] text-slate-400">
                                  {event.studentName}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {event.count > 1 ? (
                                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
                                    x{event.count}
                                  </span>
                                ) : null}
                                <span className="text-[13px] text-slate-400">
                                  {event.occurredLabel}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-[15px] text-slate-700">
                              {event.detail}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 px-5 py-10 text-center text-[15px] text-slate-500">
                    Хяналтын event одоогоор бүртгэгдээгүй байна.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={selectedStudent !== null}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedStudentId(null);
                setSelectedScreenshot(null);
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
                          {selectedStudent.risk} төрөл
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.attemptBadges.map((attempt) => (
                          <div
                            key={attempt.id}
                            className={attemptBadgeClass(attempt.tone)}
                          >
                            <attempt.icon className="h-4 w-4 shrink-0" />
                            <span>{attempt.label}</span>
                            {attempt.count > 1 ? (
                              <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-current shadow-[0_2px_5px_rgba(15,23,42,0.08)]">
                                x{attempt.count}
                              </span>
                            ) : null}
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
                            <button
                              type="button"
                              key={screenshot.id}
                              onClick={() => setSelectedScreenshot(screenshot)}
                              className="overflow-hidden rounded-[16px] border border-[#dfe7f2] bg-white text-left transition hover:border-[#93c5fd] hover:shadow-[0_10px_24px_rgba(59,130,246,0.14)]"
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
                                  Үүсгэсэн:{" "}
                                  {screenshot.occurredLabel.split(" • ")[0] ??
                                    screenshot.occurredLabel}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[14px] border border-dashed border-[#d9e2ec] px-4 py-7 text-center text-[12px] text-slate-500">
                          Энэ сурагчийн дэлгэцийн зураг хараахан бүртгэгдээгүй
                          байна.
                        </div>
                      )}
                    </section>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            open={selectedScreenshot !== null}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedScreenshot(null);
              }
            }}
          >
            <DialogContent className="w-[min(100vw-2rem,72rem)]! max-w-none overflow-hidden rounded-[22px] border border-[#dfe7f2] bg-white p-0 shadow-[0_16px_46px_rgba(15,23,42,0.12)] [&>button:last-child]:right-5 [&>button:last-child]:top-4 [&>button:last-child]:h-6 [&>button:last-child]:w-6 [&>button:last-child]:rounded-full [&>button:last-child]:border-0 [&>button:last-child]:bg-transparent [&>button:last-child]:p-0 [&>button:last-child]:text-slate-900 [&>button:last-child]:opacity-100 [&>button:last-child]:shadow-none [&>button:last-child]:ring-0 [&>button:last-child]:transition-none [&>button:last-child]:hover:bg-transparent [&>button:last-child]:hover:text-slate-900 [&>button:last-child]:focus:outline-none [&>button:last-child]:focus-visible:ring-0 sm:max-w-none">
              {selectedScreenshot ? (
                <>
                  <DialogHeader className="border-b border-[#e8edf5] px-5 py-4">
                    <DialogTitle className="text-[17px] font-bold text-slate-900">
                      {selectedScreenshot.caption}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-[12px] text-slate-500">
                      {selectedScreenshot.occurredLabel}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="px-5 py-5">
                    <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-[18px] border border-[#dfe7f2] bg-[#0f172a] p-3">
                      <div className="relative h-[min(75vh,42rem)] w-full">
                        <ScreenshotPreviewImage
                          src={selectedScreenshot.url}
                          fallbackSrc={selectedScreenshot.fallbackUrl}
                          alt={selectedScreenshot.caption}
                          className="object-contain"
                          sizes="100vw"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <PerformanceTabContent
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          isScoreEditing={isScoreEditing}
          openEndedCount={
            selectedAttempt?.questions.filter(
              (question) =>
                question.requiresManualReview || isOpenEndedQuestion(question),
            ).length ?? 0
          }
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
          isApprovingAttempt={isApprovingAttemptId === selectedAttempt?.id}
          onApproveAttempt={onApproveAttempt}
          onMarkAttemptReviewed={(nextAttempt) => {
            setLocalReviewAttempts((currentAttempts) =>
              currentAttempts.map((attempt) =>
                attempt.id === nextAttempt.id ? nextAttempt : attempt,
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
  incorrectCount,
  isApprovingAttempt,
  isScoreEditing,
  openEndedCount,
  onApproveAttempt,
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
  incorrectCount: number;
  isApprovingAttempt: boolean;
  isScoreEditing: boolean;
  openEndedCount: number;
  onApproveAttempt?: (attempt: SubmittedAttempt) => Promise<void>;
  selectedAttempt: SubmittedAttempt | null;
  selectedAttemptScoreLabel: string;
  selectedQuestionId: string | null;
  selectedReviewAttemptId: string | null;
  onAwardPoints: (points: number) => void;
  onMarkAttemptReviewed: (attempt: SubmittedAttempt) => void;
  onMarkQuestionReviewed: () => void;
  onSelectAttempt: (attemptId: string | null) => void;
  onSelectQuestion: (questionId: string | null) => void;
  onSetScoreEditing: (nextValue: boolean) => void;
  reviewAttempts: SubmittedAttempt[];
}) {
  const [questionFilter, setQuestionFilter] =
    useState<PerformanceQuestionFilter>("all");
  const [scoreDraft, setScoreDraft] = useState("0");
  const pendingCount = reviewAttempts.filter(
    (attempt) => attempt.status !== "reviewed",
  ).length;
  const selectedAttemptScoreSummary = selectedAttempt
    ? `${selectedAttemptScoreLabel} (${calculateAttemptPercentage(selectedAttempt)}%)`
    : "0/0 (0%)";
  const selectedAttemptTeacherSyncAlert =
    getTeacherSyncAlert(selectedAttempt);
  const filteredQuestions = useMemo(
    () =>
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
      }) ?? [],
    [questionFilter, selectedAttempt?.questions],
  );
  const visibleSelectedQuestion =
    filteredQuestions.find((question) => question.id === selectedQuestionId) ??
    null;
  const visibleSelectedQuestionReviewed = Boolean(
    selectedAttempt &&
    visibleSelectedQuestion &&
    isQuestionReviewed(selectedAttempt, visibleSelectedQuestion),
  );
  const visibleSelectedQuestionIsMath = isMathQuestionType(
    visibleSelectedQuestion?.questionType,
  );
  const visibleSelectedQuestionReferenceText = visibleSelectedQuestion
    ? getQuestionReferenceText(visibleSelectedQuestion) ||
      buildMissingCorrectAnswerFallback(visibleSelectedQuestion)
    : "";
  const canScoreVisibleQuestion = Boolean(
    visibleSelectedQuestion && canManuallyScoreQuestion(visibleSelectedQuestion),
  );
  const studentAnswerPointsLabel = visibleSelectedQuestion
    ? canScoreVisibleQuestion
      ? visibleSelectedQuestionReviewed
        ? `${formatPointsValue(visibleSelectedQuestion.points)}/${formatPointsValue(
            visibleSelectedQuestion.maxPoints,
          )} оноо`
        : `${formatPointsValue(visibleSelectedQuestion.maxPoints)} оноо`
      : `${formatPointsValue(visibleSelectedQuestion.points)}/${formatPointsValue(
          visibleSelectedQuestion.maxPoints,
        )} оноо`
    : "";

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

  useEffect(() => {
    if (!visibleSelectedQuestion || !canManuallyScoreQuestion(visibleSelectedQuestion)) {
      setScoreDraft("0");
      return;
    }

    setScoreDraft(formatPointsValue(visibleSelectedQuestion.points));
  }, [visibleSelectedQuestion]);

  const handleMarkCurrentQuestionReviewed = () => {
    if (visibleSelectedQuestion && canScoreVisibleQuestion) {
      onAwardPoints(Number(scoreDraft));
    }

    onMarkQuestionReviewed();
  };

  const handleMarkAttemptAsReviewed = async () => {
    if (!selectedAttempt) {
      return;
    }

    const nextQuestions = selectedAttempt.questions.map((question) => {
      if (
        visibleSelectedQuestion &&
        canScoreVisibleQuestion &&
        isScoreEditing &&
        question.id === visibleSelectedQuestion.id
      ) {
        return markQuestionReviewed({
          ...question,
          points: clampPoints(Number(scoreDraft), question.maxPoints),
        });
      }

      return markQuestionReviewed(question);
    });

    const nextAttempt = buildUpdatedAttempt(selectedAttempt, nextQuestions);

    if (onApproveAttempt) {
      await onApproveAttempt(nextAttempt);
    }

    onSetScoreEditing(false);
    onMarkAttemptReviewed(nextAttempt);
  };

  if (!selectedAttempt) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center text-[15px] text-slate-500">
        Хянах бодит илгээлт хараахан алга байна.
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[540px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-6 py-6">
          <h2 className="text-[18px] font-semibold text-slate-900">
            Хянах дараалал
          </h2>
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

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-8 py-7">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-950">
              {selectedAttempt.studentName}
            </h2>
          </div>
          <Button
            disabled={selectedAttempt.status === "reviewed" || isApprovingAttempt}
            onClick={handleMarkAttemptAsReviewed}
            className="h-[52px] rounded-[14px] bg-[#0b5cab] px-8 text-[15px] font-semibold shadow-[0_12px_24px_rgba(11,92,171,0.2)] hover:bg-[#094f95]"
          >
            {isApprovingAttempt ? "Баталж байна..." : "Бүгдийг батлах"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-8 text-[14px] font-medium">
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
              className={performanceFilterTabClass(
                questionFilter === "correct",
              )}
            >
              <CheckCircle2 className="h-4 w-4 text-[#179c35]" />
              Зөв: {correctCount}
            </button>
            <button
              type="button"
              onClick={() => setQuestionFilter("incorrect")}
              className={performanceFilterTabClass(
                questionFilter === "incorrect",
              )}
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
          <p className="text-[16px] font-semibold text-slate-800">
            Оноо: {selectedAttemptScoreSummary}
          </p>
        </div>

        <div className="grid min-h-190 xl:grid-cols-[224px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 bg-white px-3 py-4">
            {filteredQuestions.map((question) => {
              const isSelected = question.id === selectedQuestionId;
              const isReviewed = isQuestionReviewed(selectedAttempt, question);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onSelectQuestion(question.id)}
                  className={cn(
                    "mb-2 flex w-full items-center justify-between rounded-[16px] px-5 py-4 text-left transition-colors hover:bg-slate-50",
                    isSelected &&
                      "bg-[#f3f6fb] shadow-[inset_0_0_0_1px_rgba(203,213,225,0.5)]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {isReviewed ? (
                      <Check className="h-4 w-4 shrink-0 text-[#0b5cab]" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "truncate text-[15px]",
                        isReviewed
                          ? "font-semibold text-[#0b5cab]"
                          : isSelected
                            ? "font-semibold text-slate-900"
                            : "text-slate-500",
                      )}
                    >
                      Асуулт {question.questionNumber}
                    </span>
                  </span>
                  <QuestionStateIcon
                    isOpenEnded={isOpenEndedQuestion(question)}
                    reviewState={question.reviewState}
                  />
                </button>
              );
            })}
          </aside>

          <div className="flex flex-col px-8 py-7">
            {visibleSelectedQuestion ? (
              <>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900">
                    Асуулт {visibleSelectedQuestion.questionNumber}
                  </h3>
                  <div className="mt-4 rounded-[18px] border border-[#dfe5ee] bg-[#f3f6fc] px-6 py-5 text-[15px] font-medium leading-7 text-slate-800">
                    <MathPreviewText
                      content={normalizeDisplayText(
                        visibleSelectedQuestion.questionText,
                      )}
                      className="text-[15px] font-medium leading-7 text-slate-800"
                      displayMode={visibleSelectedQuestionIsMath}
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <h4 className="text-[15px] font-semibold text-slate-900">
                    Сурагчийн хариулт
                  </h4>
                  <span
                    className={questionPointsClass(
                      visibleSelectedQuestion.reviewState,
                    )}
                  >
                    {studentAnswerPointsLabel}
                  </span>
                </div>

                {selectedAttemptTeacherSyncAlert ? (
                  <div
                    className={`mt-4 rounded-[16px] border px-4 py-3 text-[13px] ${
                      selectedAttemptTeacherSyncAlert.className
                    }`}
                  >
                    <p className="font-semibold">
                      {selectedAttemptTeacherSyncAlert.title}
                    </p>
                    <p className="mt-1">
                      {selectedAttemptTeacherSyncAlert.description}
                    </p>
                  </div>
                ) : null}

                <div
                  className={studentAnswerClass(
                    visibleSelectedQuestion.reviewState,
                  )}
                >
                  <MathPreviewText
                    content={normalizeDisplayText(
                      visibleSelectedQuestion.studentAnswer,
                    )}
                    className="text-[15px] font-medium leading-7 text-slate-800"
                    displayMode={visibleSelectedQuestionIsMath}
                  />
                </div>

                {canScoreVisibleQuestion && !visibleSelectedQuestionReviewed ? (
                  isScoreEditing ? (
                    <div className="mt-5 rounded-[20px] border border-[#d7e7fb] bg-[#f8fbff] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h5 className="text-[15px] font-semibold text-slate-900">
                            Оноо өгөх
                          </h5>
                          <p className="mt-1 text-[13px] text-slate-500">
                            Энэ асуултад хамгийн ихдээ{" "}
                            {formatPointsValue(visibleSelectedQuestion.maxPoints)} оноо
                            өгч болно.
                          </p>
                        </div>
                        <span className="rounded-full border border-[#cfe0f5] bg-white px-3 py-1 text-[13px] font-semibold text-[#0b5cab]">
                          {formatPointsValue(visibleSelectedQuestion.maxPoints)} оноо
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          max={visibleSelectedQuestion.maxPoints}
                          step={0.5}
                          value={scoreDraft}
                          onChange={(event) => {
                            setScoreDraft(event.target.value);
                          }}
                          className="h-11 w-28 rounded-[14px] border border-[#cfe0f5] bg-white px-4 text-[14px] font-semibold text-slate-900 outline-none ring-2 ring-[#dbeafe]"
                        />
                        <span className="text-[14px] text-slate-500">
                          / {formatPointsValue(visibleSelectedQuestion.maxPoints)} оноо
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSetScoreEditing(true)}
                        className="inline-flex items-center gap-3 text-[15px] font-semibold text-slate-900"
                      >
                        <PenLine className="h-5 w-5" />
                        Оноо өгөх
                      </button>
                      <span className="text-[13px] text-slate-500">
                        Хамгийн ихдээ{" "}
                        {formatPointsValue(visibleSelectedQuestion.maxPoints)} оноо
                      </span>
                    </div>
                  )
                ) : canScoreVisibleQuestion ? (
                  <p className="mt-4 text-[13px] text-slate-500">
                    Энэ задгай асуултын багшийн үнэлгээ хадгалагдсан.
                  </p>
                ) : null}

                <div className="mt-8">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-[15px] font-semibold text-slate-900">
                      Зөв хариулт
                    </h4>
                    <span className={questionPointsClass("correct")}>
                      {formatPointsValue(visibleSelectedQuestion.maxPoints)} оноо
                    </span>
                  </div>
                  <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-[15px] font-medium leading-7 text-slate-800">
                    <MathPreviewText
                      content={visibleSelectedQuestionReferenceText}
                      className="text-[15px] font-medium leading-7 text-slate-800"
                      displayMode={visibleSelectedQuestionIsMath}
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-[15px] font-semibold text-slate-900">
                    Зөв хариултын тайлбар
                  </h4>
                  <div className="mt-4 whitespace-pre-line rounded-[18px] border border-[#dfe5ee] bg-[#f3f6fc] px-6 py-5 text-[15px] leading-8 text-slate-800">
                    <MathPreviewText
                      content={resolveQuestionExplanation(visibleSelectedQuestion)}
                      className="text-[15px] leading-8 text-slate-800"
                      displayMode={visibleSelectedQuestionIsMath}
                    />
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-4 pt-10">
                  {canScoreVisibleQuestion && !visibleSelectedQuestionReviewed ? (
                    <p className="text-[13px] text-slate-500">
                      Оноо өгөөд <span className="font-semibold">Хянасан</span>{" "}
                      дарвал нийт оноонд автоматаар нэмэгдэнэ.
                    </p>
                  ) : canScoreVisibleQuestion ? (
                    <span className="text-[13px] text-slate-500">
                      Энэ асуулт хянагдаж, нийт оноонд нэмэгдсэн.
                    </span>
                  ) : null}

                  <Button
                    variant={visibleSelectedQuestionReviewed ? "outline" : "default"}
                    disabled={visibleSelectedQuestionReviewed}
                    onClick={handleMarkCurrentQuestionReviewed}
                    className={cn(
                      "h-[52px] min-w-[164px] rounded-[14px] px-8 text-[15px] font-semibold shadow-none disabled:cursor-default disabled:opacity-100",
                      visibleSelectedQuestionReviewed
                        ? "!border-[#0b5cab] !bg-white !text-[#0b5cab] hover:!border-[#0b5cab] hover:!bg-[#eff6ff] hover:!text-[#0b5cab] disabled:!border-[#0b5cab] disabled:!bg-white disabled:!text-[#0b5cab]"
                        : "!border-[#0b5cab] !bg-[#0b5cab] !text-white hover:!border-[#094f95] hover:!bg-[#094f95] hover:!text-white disabled:!border-[#0b5cab] disabled:!bg-[#0b5cab] disabled:!text-white",
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
  className,
  fallbackSrc,
  sizes = "(max-width: 1280px) 100vw, 33vw",
  src,
}: {
  alt: string;
  className?: string;
  fallbackSrc?: string;
  sizes?: string;
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
      className={cn("h-full w-full object-cover", className)}
      fill
      unoptimized
      sizes={sizes}
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
    const localizedTitle = localizeMonitoringEventTitle(event.code, event.title);
    const appearance = getEventAppearance({
      code: event.code,
      severity: event.severity,
      title: localizedTitle,
    });

    eventMap.set(event.id, {
      code: event.code,
      count: event.count ?? 1,
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
      const localizedTitle = localizeMonitoringEventTitle(event.code, event.title);
      const appearance = getEventAppearance({
        code: event.code,
        severity: event.severity,
        title: localizedTitle,
      });
      const existingEvent = eventMap.get(event.id);

      eventMap.set(event.id, {
        code: event.code,
        count: existingEvent?.count ?? 1,
        detail:
          localizeEventDetail(event.code, event.detail) ?? appearance.title,
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
    .sort(
      (left, right) =>
        right.lastActivity.getTime() - left.lastActivity.getTime(),
    )
    .map((student) => {
      const studentEvents = events.filter(
        (event) => event.studentId === student.id,
      );
      const suspiciousStudentEvents = studentEvents.filter((event) =>
        isSuspiciousEventCode(event.code),
      );
      const uniqueAttemptBadges = suspiciousStudentEvents.reduce<EventBadge[]>(
        (acc, event) => {
          const existingBadge = acc.find((item) => item.label === event.label);

          if (existingBadge) {
            existingBadge.count += event.count;
            return acc;
          }

          acc.push({
            count: event.count,
            icon: event.icon,
            id: event.id,
            label: event.label,
            tone: event.tone,
          });

          return acc;
        },
        [],
      );

      const attemptBadges =
        uniqueAttemptBadges.length > 0
          ? uniqueAttemptBadges
          : [
              {
                count: 0,
                icon: CheckCircle2,
                id: `${student.id}-clean`,
                label: "Зөрчил бүртгэгдээгүй",
                tone: "muted" as const,
              },
            ];
      const attemptCount = sumEventCounts(uniqueAttemptBadges);
      const riskCount = uniqueAttemptBadges.length;

      const screenshots = suspiciousStudentEvents.slice(0, 6).map((event) => {
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
        attemptCount,
        connectionState: toConnectionState(student.monitoringState),
        id: student.id,
        name: student.name,
        risk: riskCount,
        scoreLabel:
          latestAttempt?.score !== undefined
            ? `${latestAttempt.score}%`
            : "Хүлээгдэж байна",
        screenshots,
        statusLabel: formatStudentStatus(student.status),
        statusTone: toStudentStatusTone(student),
      };
    });
}

function stackDisplayEvents(events: DisplayEvent[]) {
  const stackedEventMap = new Map<string, DisplayEvent>();

  for (const event of events) {
    const signature = getDisplayEventStackSignature(event);
    const existingEvent = stackedEventMap.get(signature);

    if (!existingEvent) {
      stackedEventMap.set(signature, { ...event });
      continue;
    }

    existingEvent.count += event.count;
  }

  return [...stackedEventMap.values()].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
}

function getDisplayEventStackSignature(event: DisplayEvent) {
  switch (event.code) {
    case "fullscreen-not-active":
    case "fullscreen-exit":
      return `${event.studentId}:fullscreen`;
    case "split-view-suspected":
      return `${event.studentId}:split-view`;
    case "parallel-tab-suspected":
      return `${event.studentId}:parallel-tab`;
    case "device_change_suspected":
      return `${event.studentId}:device-switch`;
    case "tab_hidden":
    case "window_blur":
      return `${event.studentId}:focus-lost`;
    case "connection_lost":
      return `${event.studentId}:connection-lost`;
    case "connection_restored":
      return `${event.studentId}:connection-restored`;
    case "viewport-resize-suspicious":
      return `${event.studentId}:viewport-resize`;
    default:
      return [event.studentId, event.code, event.severity, event.title].join(
        ":",
      );
  }
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
    return {
      icon: AlertTriangle,
      label: title,
      title,
      tone: "danger" as const,
    };
  }
  if (severity === "warning") {
    return {
      icon: TriangleAlert,
      label: title,
      title,
      tone: "warning" as const,
    };
  }

  return { icon: CheckCircle2, label: title, title, tone: "info" as const };
}

function QuestionStateIcon({
  isOpenEnded,
  reviewState,
}: {
  isOpenEnded: boolean;
  reviewState: QuestionReview["reviewState"];
}) {
  if (reviewState === "correct") {
    return <CheckCircle2 className="h-5 w-5 text-[#179c35]" />;
  }

  if (reviewState === "incorrect") {
    return <XCircle className="h-5 w-5 text-[#ff3b30]" />;
  }

  if (isOpenEnded) {
    return <PenLine className="h-5 w-5 text-slate-700" />;
  }

  return <TriangleAlert className="h-5 w-5 text-[#f59e0b]" />;
}

function tabClassName(isActive: boolean) {
  return isActive
    ? "border-b-[3px] border-slate-900 pb-4 text-[18px] font-extrabold tracking-[-0.02em] text-slate-900"
    : "border-b-[3px] border-transparent pb-4 text-[18px] font-extrabold tracking-[-0.02em] text-slate-900/90 transition-colors hover:text-slate-900";
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

  return "inline-flex rounded-full border border-[#cde0f4] bg-[#f3f8ff] px-4 py-2 text-[13px] font-semibold text-[#0b5cab]";
}

function studentAnswerClass(reviewState: QuestionReview["reviewState"]) {
  if (reviewState === "correct") {
    return "mt-5 rounded-[18px] border border-[#abdcbc] bg-[#eefaf3] px-6 py-5 text-[16px] font-semibold text-slate-800";
  }

  if (reviewState === "incorrect") {
    return "mt-5 rounded-[18px] border border-[#f3c1bb] bg-[#fff3f1] px-6 py-5 text-[16px] font-semibold text-slate-800";
  }

  return "mt-5 rounded-[18px] border border-[#cde0f4] bg-[#f5f9ff] px-6 py-5 text-[16px] font-semibold text-slate-800";
}

function canManuallyScoreQuestion(question: QuestionReview) {
  return question.requiresManualReview || isOpenEndedQuestion(question);
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
      <div className="relative h-8 w-[50px] shrink-0">
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
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-[#0b5cab] px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_4px_10px_rgba(11,92,171,0.22)]">
          {attemptCount}
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

function toConnectionState(
  state: Student["monitoringState"],
): StudentConnectionState {
  return state === "offline"
    ? "offline"
    : state === "online" || state === "reconnected"
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
    question.explanation?.trim() || question.aiAnalysis?.trim();

  if (explanation) {
    return explanation;
  }

  const referenceText = getQuestionReferenceText(question);
  if (!referenceText) {
    return "Тайлбар хараахан ирээгүй байна.";
  }

  return question.correctAnswerKind === "reference"
    ? `Жишиг чиглүүлэг: ${referenceText}`
    : `Зөв хариулт: ${referenceText}`;
}

function clampPoints(value: number, maxPoints: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const boundedValue = Math.max(0, Math.min(value, maxPoints));
  return Math.round(boundedValue * 10) / 10;
}

function formatPointsValue(value: number) {
  const normalizedValue = Math.round(value * 10) / 10;

  return Number.isInteger(normalizedValue)
    ? String(normalizedValue)
    : normalizedValue.toFixed(1);
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

function isQuestionReviewed(
  attempt: SubmittedAttempt,
  question: QuestionReview,
) {
  if (question.reviewed) {
    return true;
  }

  if (attempt.status === "reviewed") {
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
        reviewed: true,
      };
    }

    return {
      ...question,
      points: clampPoints(question.points, question.maxPoints),
      reviewState: "incorrect",
      reviewed: true,
    };
  }

  return {
    ...question,
    points: clampPoints(question.points, question.maxPoints),
    reviewed: true,
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
  const hasReviewedQuestions = nextQuestions.some((question) =>
    isQuestionReviewed(attempt, question),
  );
  const hasUnreviewedQuestions = nextQuestions.some(
    (question) => !isQuestionReviewed(attempt, question),
  );

  return {
    ...attempt,
    questions: nextQuestions,
    score:
      totalMaxPoints > 0
        ? Math.round((totalAwardedPoints / totalMaxPoints) * 100)
        : 0,
    status: hasUnreviewedQuestions
      ? hasReviewedQuestions
        ? "in-review"
        : "pending"
      : "reviewed",
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

  return `${formatPointsValue(totalAwardedPoints)}/${formatPointsValue(totalMaxPoints)}`;
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
  if (typeof attempt.score === "number") {
    return `${attempt.score}%`;
  }

  if (typeof attempt.completionRate === "number") {
    return `${attempt.completionRate}%`;
  }

  return `${calculateAttemptPercentage(attempt)}%`;
}

function normalizeDisplayText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Хариу оруулаагүй";
}

function normalizeCorrectAnswerText(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed === "Зөв хариулт ирээгүй" ||
    trimmed === "Зөв хариулт ирээгүй байна."
  ) {
    return "";
  }

  return trimmed;
}

function getQuestionReferenceText(question: QuestionReview) {
  return normalizeCorrectAnswerText(question.correctAnswer);
}

function buildMissingCorrectAnswerFallback(question: QuestionReview) {
  const explanation = question.explanation?.trim();
  if (explanation) {
    return explanation;
  }

  const aiAnalysis = question.aiAnalysis?.trim();
  if (aiAnalysis) {
    return aiAnalysis;
  }

  return "Зөв хариулт хараахан ирээгүй байна.";
}

function mergeReviewAttempts(
  currentAttempts: SubmittedAttempt[],
  nextAttempts: SubmittedAttempt[],
) {
  const currentAttemptMap = new Map(
    currentAttempts.map((attempt) => [attempt.id, attempt] as const),
  );

  return nextAttempts.map((attempt) => {
    const currentAttempt = currentAttemptMap.get(attempt.id);

    if (!currentAttempt) {
      return attempt;
    }

    const currentQuestions = new Map(
      currentAttempt.questions.map(
        (question) => [question.id, question] as const,
      ),
    );

    const mergedQuestions = attempt.questions.map((question) => {
      const currentQuestion = currentQuestions.get(question.id);

      if (!currentQuestion?.reviewed) {
        return question;
      }

      return {
        ...question,
        points: canManuallyScoreQuestion(currentQuestion)
          ? clampPoints(currentQuestion.points, question.maxPoints)
          : question.points,
        reviewState: canManuallyScoreQuestion(currentQuestion)
          ? currentQuestion.reviewState
          : question.reviewState,
        reviewed: true,
      };
    });

    return buildUpdatedAttempt(
      {
        ...attempt,
        status:
          currentAttempt.status === "reviewed" ? "reviewed" : attempt.status,
      },
      mergedQuestions,
    );
  });
}

function localizeEventDetail(code?: string, detail?: string) {
  return formatMonitoringEventDetail({ code, detail });
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

function getTeacherSyncAlert(attempt: SubmittedAttempt | null) {
  if (
    !attempt ||
    attempt.answerKeySource !== "teacher_service" ||
    attempt.status === "reviewed"
  ) {
    return null;
  }

  const sync = attempt.teacherSync;

  if (sync?.status === "failed") {
    const errorMessage = sync.lastError?.trim();

    return {
      className: "border-red-200 bg-red-50 text-red-700",
      description: errorMessage
        ? `Teacher-service рүү илгээхдээ алдаа гарсан: ${errorMessage}. Энэ attempt-ийг эндээс гараар баталж demo-гоо үргэлжлүүлж болно.`
        : "Teacher-service рүү илгээхдээ алдаа гарсан. Энэ attempt-ийг эндээс гараар баталж demo-гоо үргэлжлүүлж болно.",
      title: "Teacher-service sync амжилтгүй болсон.",
    };
  }

  if (sync?.status === "pending") {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      description:
        "Webhook тохиргоо байхгүй эсвэл автомат илгээлт хүлээгдэж байна. Энэ attempt-ийг эндээс гараар баталбал сурагч талд дүн шууд гарна.",
      title: "Teacher-service автомат sync хүлээгдэж байна.",
    };
  }

  if (
    attempt.answerKeySource === "teacher_service" &&
    !attempt.hasPublishedResult
  ) {
    const sentAt = sync?.sentAt ? formatDateTime(new Date(sync.sentAt)) : null;

    return {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      description: sentAt
        ? `Teacher-service рүү ${sentAt}-д амжилттай илгээсэн, харин шалгасан дүн хараахан буцаж ирээгүй байна. Сурагч шалгалтаа ${attempt.completionRate ?? 0}% бөглөсөн.`
        : `Энэ оролдлогын дүн болон зөв хариулт backend дээр хараахан sync болоогүй байна. Сурагч шалгалтаа ${attempt.completionRate ?? 0}% бөглөсөн.`,
      title: "Teacher-service хариу хүлээгдэж байна.",
    };
  }

  return null;
}
