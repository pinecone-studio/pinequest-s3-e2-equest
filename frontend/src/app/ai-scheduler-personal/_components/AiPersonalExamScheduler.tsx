"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  addDays,
  format,
  getISODay,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { mn } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ApproveAiExamScheduleDocument,
  GetAiExamScheduleDocument,
  RequestAiExamScheduleDocument,
} from "@/gql/create-exam-documents";
import type {
  ExamSchedule,
  ExamScheduleVariant,
  RequestExamSchedulePayload,
} from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
  buildSchoolCalendarSegmentsForWeek,
  percentIntervalsOverlap,
} from "@/lib/schoolCalendarWeekSegments";
import {
  CALENDAR_BUFFER_BANDS,
  CALENDAR_OVERLAY_LAYOUTS,
  CALENDAR_VIEW_CONFIG,
  DAY_VISIBLE_SPAN_MIN,
  DAY_VISIBLE_START_MIN,
  GRID_BODY_MIN_H,
  HOUR_PX,
  SHIFT_MARKER_LAYOUTS,
  TEACHER_SHIFT_INITIAL_FOCUS,
  TIME_SLOT_LABELS,
  blockHeightPercent,
  slotTopPercent,
  type TeacherShiftId,
} from "@/constants/calendar";
import {
  CALENDAR_LAYER_CONSTRAINT,
  constraintLabelMn,
} from "@/constants/calendarLayerTaxonomy";
import { INTELLIGENT_BUFFER_ROADMAP_MN } from "@/constants/intelligentBufferStrategy";
import type { MockPrimaryLesson } from "@/constants/teacherScheduleMock";
import {
  DEFAULT_MOCK_TEACHER_ID,
  MOCK_I_SHIFT_TEACHERS,
  getMockTeacherById,
  roomBadgeForPrimaryLesson,
} from "@/constants/teacherScheduleMock";
import { REAL_WORLD_SCHOOL_CALENDAR_MOCK } from "@/constants/schoolCalendarRealWorldMock";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  Monitor,
  Moon,
  PanelRight,
  Play,
  Sun,
  Target,
  Square,
  Circle,
  Triangle,
} from "lucide-react";

/** I/II ээлж: хичээл 40 мин, завсар 5–15 мин (давхаргын тайлбарт дундаж). */
const LESSON_MINUTES = 40;
const BREAK_MINUTES = 10;

/** Жишээ: баталгаажсан шалгалт (Пүрэв — багана 3, I ээлжийн 7-р цагийн цонх). */
const CONFIRMED_EXAM_DEMO = {
  startH: 12,
  startM: 35,
  endH: 13,
  endM: 15,
} as const;

/** Жишээ: AI draft (Лхагва — багана 2, II ээлжийн 6-р цаг). */
const AI_DRAFT_DEMO = {
  startH: 17,
  startM: 25,
  endH: 18,
  endM: 5,
} as const;

function formatPeriodClockRange(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(startHour)}:${pad(startMinute)}–${pad(endHour)}:${pad(endMinute)}`;
}

function periodLengthMinutes(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

/**
 * Хичээлийн карт: анги + цаг (+ өрөө badge). Багш өөрийн хуваарийг л хардаг тул
 * хичээл/багшийн нэрийг карт дээр давтахгүй.
 */
function primaryLessonCardModel(
  lesson: MockPrimaryLesson,
  opts?: { cabinetRoom?: string },
) {
  const v = lesson.slotVariant ?? "default";
  const mins = periodLengthMinutes(
    lesson.startH,
    lesson.startM,
    lesson.endH,
    lesson.endM,
  );
  const clock = formatPeriodClockRange(
    lesson.startH,
    lesson.startM,
    lesson.endH,
    lesson.endM,
  );
  /** Карт дээр зөвхөн цагийн муж; минутыг tooltip-д үлдээнэ. */
  const timeLine = clock;
  const durationPart = `${mins} мин`;

  if (v === "duty") {
    return {
      variant: v,
      headline: lesson.title,
      subline: undefined as string | undefined,
      room: null as string | null,
      timeLine,
      tooltip: `${lesson.title} · ${lesson.periodLabel} · ${clock} · ${durationPart}`,
    };
  }

  const room = roomBadgeForPrimaryLesson(lesson.title, opts?.cabinetRoom);
  return {
    variant: v,
    headline: lesson.title,
    subline: undefined as string | undefined,
    room,
    timeLine,
    tooltip: `${lesson.title} · ${lesson.periodLabel} · ${clock} · ${durationPart}${
      room ? ` · Өрөө ${room}` : ""
    }`,
  };
}

/** Эхлэл–дуусах + нийт минут (нийтийн эвент гэх мэт урт хугацаа). */
function formatBlockDuration(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const s = startHour * 60 + startMinute;
  const e = endHour * 60 + endMinute;
  const mins = Math.max(0, e - s);
  return `${pad(startHour)}:${pad(startMinute)}–${pad(endHour)}:${pad(endMinute)} · ${mins} мин`;
}

/** getISODay: 1=Даваа … 7=Ням — нэг үсэг (Дав/Мяг гэх мэт биш). */
const WEEKDAY_LETTER_MN: Record<number, string> = {
  1: "Д",
  2: "М",
  3: "Л",
  4: "П",
  5: "Б",
  6: "Б",
  7: "Н",
};

const DEFAULT_TEST_ID = "a1000000-0000-4000-8000-000000000001";
const DEFAULT_CLASS_ID = "10A";

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:shadow-black/40";
const textDim = "text-zinc-500 dark:text-zinc-400";

function SchedulerAppearanceMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Дүрсийн горим: цайвар, харанхуй, систем"
        >
          {!mounted ? (
            <Sun className="size-4 opacity-70" aria-hidden />
          ) : resolvedTheme === "dark" ? (
            <Moon className="size-4" aria-hidden />
          ) : (
            <Sun className="size-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {""}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light" className="text-sm">
            <Sun className="size-4" aria-hidden />
            Цайвар
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="text-sm">
            <Moon className="size-4" aria-hidden />
            Харанхуй
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="text-sm">
            <Monitor className="size-4" aria-hidden />
            Систем
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type RequestAiExamScheduleData = {
  requestAiExamSchedule: RequestExamSchedulePayload;
};

type RequestAiExamScheduleVars = {
  testId: string;
  classId: string;
  preferredDate: string;
};

type GetAiExamScheduleData = {
  getAiExamSchedule?: ExamSchedule | null;
};

type GetAiExamScheduleVars = {
  examId: string;
};

type ApproveAiExamScheduleData = {
  approveAiExamSchedule: ExamSchedule;
};

type ApproveAiExamScheduleVars = {
  examId: string;
  variantId: string;
};

function formatVariantWhen(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "yyyy-MM-dd HH:mm", { locale: mn });
  } catch {
    return iso;
  }
}

function parseStart(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Багшийн хуанли = зөвхөн цаг харах биш, AI-Powered Operations Center.
 * Cron / Linear / Reclaim-ийн урсгал + ирээдүйн шийдлүүдийг нэг дэлгэцэнд.
 */
type CalendarLayerId =
  | "primary"
  | "confirmed_exam"
  | "ai_draft"
  | "school_event"
  | "personal"
  | "conflict";

const CALENDAR_LAYERS: {
  id: CalendarLayerId;
  label: string;
  role: string;
  swatch: string;
  style?: string;
}[] = [
  {
    id: "primary",
    label: "Үндсэн хичээл",
    role: `I/II ээлж · ${LESSON_MINUTES} мин цаг · завсар 5–15 мин (жишээ)`,
    swatch: "bg-sky-400",
  },
  {
    id: "confirmed_exam",
    label: "Баталгаажсан шалгалт",
    role: "Цаг товлогдсон, сурагчдад зарлагдсан шалгалтууд",
    swatch: "bg-emerald-500",
  },
  {
    id: "ai_draft",
    label: "AI-ийн санал (Draft)",
    role: "Gemini-ийн санал болгож буй хамгийн оновчтой цагууд",
    swatch: "bg-violet-200",
    style: "border-2 border-dashed border-violet-400 opacity-80",
  },
  {
    id: "school_event",
    label: "Сургуулийн эвент",
    role:
      "Дэвсгэр давхарга (read-only) — нийтийн хуанлиас; зөөх боломжгүй. Sky = таны хичээл",
    swatch: "bg-amber-100 ring-1 ring-amber-400/30",
  },
  {
    id: "personal",
    label: "Хувийн (Sync)",
    role: "Google Calendar-аас синк хийсэн завгүй цаг",
    swatch: "bg-slate-100",
    style: "ring-1 ring-slate-300/80 dark:bg-slate-800 dark:ring-slate-600/80",
  },
  {
    id: "conflict",
    label: "Зөрчилтэй",
    role: "Давхцал үүссэн эсвэл ачаалал ихтэй үе",
    swatch: "bg-rose-500",
    style: "animate-pulse",
  },
];

function ReclaimLightBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-[#f4f5f7] dark:bg-zinc-950"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(59,130,246,0.12),transparent_50%)] dark:bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(59,130,246,0.22),transparent_55%)]" />
    </div>
  );
}

export type AiPersonalExamSchedulerProps = {
  /** Үнэн бол гаднах hub rail нуугдана (зөвхөн /ai-scheduler дээр). */
  shellMode?: boolean;
  /** Хуанлийн анхны scroll: I → 07:00, II → 12:00 (профайлаас дамжуулж болно). */
  defaultTeacherShift?: TeacherShiftId;
};

export function AiPersonalExamScheduler({
  shellMode = false,
  defaultTeacherShift = "I",
}: AiPersonalExamSchedulerProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [testId, setTestId] = useState(DEFAULT_TEST_ID);
  const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
  const [lastQueuedExamId, setLastQueuedExamId] = useState<string | null>(null);
  const [pollExamId, setPollExamId] = useState<string | null>(null);
  const [liveSchedule, setLiveSchedule] = useState<ExamSchedule | null>(null);
  const [rightTab, setRightTab] = useState<"ai" | "form">("ai");
  const [layerOn, setLayerOn] = useState<Record<CalendarLayerId, boolean>>({
    primary: true,
    confirmed_exam: true,
    ai_draft: true,
    school_event: true,
    personal: true,
    conflict: true,
  });
  /** Хуанли + давхаргын зүүн панел нээгдсэн эсэх (rail-аас сэлгэнэ). */
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  /** I = өглөөний ээлж (ахлах), II = өдрийн ээлж (бага анги) — анхны scroll төвлөрөлт. */
  const [teacherShift, setTeacherShift] =
    useState<TeacherShiftId>(defaultTeacherShift);
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    DEFAULT_MOCK_TEACHER_ID,
  );
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const calendarMainRef = useRef<HTMLElement>(null);
  const calendarFocusAnchorRef = useRef<HTMLDivElement>(null);
  const toastKeyRef = useRef<string>("");

  useEffect(() => {
    setTeacherShift(defaultTeacherShift);
  }, [defaultTeacherShift]);

  const selectedTeacher = useMemo(() => {
    return (
      getMockTeacherById(selectedTeacherId) ?? MOCK_I_SHIFT_TEACHERS[0]
    );
  }, [selectedTeacherId]);

  const activePrimaryLessons = selectedTeacher.lessons;

  useLayoutEffect(() => {
    const main = calendarMainRef.current;
    const anchor = calendarFocusAnchorRef.current;
    if (!main || !anchor) return;
    const st =
      anchor.getBoundingClientRect().top -
      main.getBoundingClientRect().top +
      main.scrollTop;
    main.scrollTo({ top: Math.max(0, st - 12), behavior: "auto" });
  }, [teacherShift]);

  function toggleLayer(id: CalendarLayerId) {
    setLayerOn((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const [requestSchedule, { loading: queueLoading }] = useMutation<
    RequestAiExamScheduleData,
    RequestAiExamScheduleVars
  >(RequestAiExamScheduleDocument);

  const [approveSchedule, { loading: approveLoading }] = useMutation<
    ApproveAiExamScheduleData,
    ApproveAiExamScheduleVars
  >(ApproveAiExamScheduleDocument);

  const { data: pollData } = useQuery<
    GetAiExamScheduleData,
    GetAiExamScheduleVars
  >(GetAiExamScheduleDocument, {
    variables: { examId: pollExamId ?? "" },
    skip: !pollExamId,
    pollInterval: pollExamId ? 2500 : 0,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (row) {
      setLiveSchedule(row);
    }
  }, [pollData]);

  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (!row || !pollExamId) return;
    const st = row.status;
    if (st === "suggested") {
      setPollExamId(null);
      const key = `${row.id}:suggested`;
      if (toastKeyRef.current === key) return;
      toastKeyRef.current = key;
      toast.message("Саналууд бэлэн", {
        description: "Баруун панелаас хувилбар сонгоно уу.",
      });
      return;
    }
    if (st !== "confirmed" && st !== "failed") return;
    const key = `${row.id}:${st}`;
    if (toastKeyRef.current === key) return;
    toastKeyRef.current = key;
    if (st === "confirmed") {
      toast.success("Хуваарь баталгаажлаа.");
    } else {
      toast.error(row.aiReasoning ?? "AI scheduler алдаатай дууслаа.");
    }
    setPollExamId(null);
  }, [pollData?.getAiExamSchedule, pollExamId]);

  async function handleApproveVariant(v: ExamScheduleVariant) {
    const examId = liveSchedule?.id ?? lastQueuedExamId;
    if (!examId) {
      toast.error("examId олдсонгүй.");
      return;
    }
    try {
      const { data } = await approveSchedule({
        variables: { examId, variantId: v.id },
      });
      const next = data?.approveAiExamSchedule;
      if (next) {
        setLiveSchedule(next);
        toastKeyRef.current = `${next.id}:confirmed`;
        toast.success("Сонгосон хувилбар баталгаажлаа.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Батлахад алдаа гарлаа.";
      toast.error(msg);
    }
  }

  async function handleQueueSchedule() {
    const tid = testId.trim();
    const cid = classId.trim();
    if (!tid || !cid) {
      toast.error("Шалгалтын загварын ID болон ангийн ID заавал бөглөнө.");
      return;
    }
    const day = date ?? new Date();
    const preferredDate = startOfDay(day).toISOString();

    try {
      const { data } = await requestSchedule({
        variables: {
          testId: tid,
          classId: cid,
          preferredDate,
        },
      });
      const payload = data?.requestAiExamSchedule;
      if (payload?.success) {
        toastKeyRef.current = "";
        if (payload.examId) {
          setLiveSchedule(null);
          setLastQueuedExamId(payload.examId);
          setPollExamId(payload.examId);
        }
        toast.success(payload.message, {
          description: payload.examId ? `examId: ${payload.examId}` : undefined,
        });
      } else {
        toast.error(payload?.message ?? "Дараалалд оруулахад алдаа гарлаа.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Сүлжээ эсвэл серверийн алдаа.";
      toast.error(msg);
    }
  }

  const anchor = date ?? new Date();
  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  /** Сургуулийн нэгдсэн календарийн mock — багшийн тор дээр дэвсгэр давхарга (GraphQL ирэхэд солино). */
  const teacherSchoolEventSegments = useMemo(
    () =>
      buildSchoolCalendarSegmentsForWeek(
        REAL_WORLD_SCHOOL_CALENDAR_MOCK,
        weekDays,
      ),
    [weekDays],
  );

  /** Үндсэн хичээлийн цаг сургуулийн эвенттой давхцвал conflict (drag ирэхэд ижил шалгуур). */
  const teacherSchoolConflictColumns = useMemo(() => {
    const cols = new Set<number>();
    for (const lesson of activePrimaryLessons) {
      if (lesson.slotVariant === "free") continue;
      const lt = slotTopPercent(lesson.startH, lesson.startM);
      const lh = blockHeightPercent(
        lesson.startH,
        lesson.startM,
        lesson.endH,
        lesson.endM,
      );
      for (const seg of teacherSchoolEventSegments) {
        if (seg.colIdx !== lesson.colIdx) continue;
        if (percentIntervalsOverlap(seg.topPct, seg.heightPct, lt, lh)) {
          cols.add(lesson.colIdx);
          break;
        }
      }
    }
    return cols;
  }, [activePrimaryLessons, teacherSchoolEventSegments]);

  const scheduleStart = liveSchedule
    ? parseStart(liveSchedule.startTime)
    : null;
  const suggested = liveSchedule?.status === "suggested";
  const showJob =
    liveSchedule && liveSchedule.id === lastQueuedExamId ? liveSchedule : null;

  /** `CALENDAR_VIEW_CONFIG.dayVisible` хүрээнд блокын байрлал (%) */
  function blockTopPercent(d: Date) {
    const mins = d.getHours() * 60 + d.getMinutes();
    const t = Math.min(
      Math.max((mins - DAY_VISIBLE_START_MIN) / DAY_VISIBLE_SPAN_MIN, 0),
      1,
    );
    return t * 100;
  }

  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, "MMM d", { locale: mn })} – ${format(weekEnd, "MMM d", { locale: mn })}`;

  function shiftWeek(deltaWeeks: number) {
    setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
  }

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-[#f4f5f7] font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100",
        "selection:bg-blue-500/20 selection:text-zinc-900 dark:selection:bg-blue-400/25 dark:selection:text-zinc-100",
      )}
    >
      <ReclaimLightBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Дээд мөр */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-950/90 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {shellMode ? (
              <>
                <button
                  type="button"
                  className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:flex"
                  aria-expanded={calendarSidebarOpen}
                  aria-controls="scheduler-calendar-sidebar"
                  onClick={() => setCalendarSidebarOpen((o) => !o)}
                >
                  <span className="sr-only">Хуанлын панел нээх, хаах</span>
                  {calendarSidebarOpen ? (
                    <ChevronLeft
                      className="size-5"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="size-5"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  )}
                </button>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
                  aria-expanded={calendarSidebarOpen}
                  aria-controls="scheduler-calendar-sidebar"
                  onClick={() => setCalendarSidebarOpen((o) => !o)}
                >
                  <span className="sr-only">Хуанлын панел нээх, хаах</span>
                  <Menu className="size-5" strokeWidth={1.5} aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
                aria-expanded={calendarSidebarOpen}
                aria-controls="scheduler-calendar-sidebar"
                onClick={() => setCalendarSidebarOpen((o) => !o)}
              >
                <span className="sr-only">Хуанлын панел нээх, хаах</span>
                <Menu className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-950/80 dark:text-sky-200 dark:ring-sky-700/60">
                <CalendarClock className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                  Багшийн хуанли
                </h1>
                <p className={cn("truncate text-xs", textDim)}>
                  {selectedTeacher.displayName} · {selectedTeacher.roleNote} · I
                  ээлж
                </p>
                <p className={cn("truncate text-[11px]", textDim)}>
                  {format(anchor, "yyyy MMMM", { locale: mn })}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                  AI-Powered Operations Center · Cron · Linear · Reclaim ·
                  ирээдүйн шийдэл
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <SchedulerAppearanceMenu />
            <Popover open={teacherPickerOpen} onOpenChange={setTeacherPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 max-w-[min(100%,14rem)] shrink-0 gap-1.5 rounded-xl border-zinc-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  aria-expanded={teacherPickerOpen}
                  aria-haspopup="dialog"
                >
                  <span className="truncate">
                    {selectedTeacher.displayName}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[min(100vw-2rem,20rem)] border-zinc-200 p-2 shadow-lg dark:border-zinc-600"
              >
                <p className="px-2 pb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Багш сонгох (I / II ээлж · mock)
                </p>
                <p className="mb-2 px-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                  Дараа нь DB-аас ачаална. Одоо mock: I ээлж 5 + II ээлж 5 (нийт 10).
                </p>
                <ul className="max-h-[min(60vh,16rem)] space-y-0.5 overflow-y-auto">
                  {MOCK_I_SHIFT_TEACHERS.map((t) => {
                    const on = t.id === selectedTeacherId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeacherId(t.id);
                            setTeacherShift(t.shift);
                            setTeacherPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                            on
                              ? "bg-sky-50 text-sky-950 dark:bg-sky-950/50 dark:text-sky-50"
                              : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                              on
                                ? "border-sky-600 bg-sky-600 text-white dark:border-sky-500 dark:bg-sky-500"
                                : "border-zinc-300 dark:border-zinc-600",
                            )}
                            aria-hidden
                          >
                            {on ? (
                              <Check className="size-2.5" strokeWidth={3} />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {t.displayName}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                              {t.roleNote}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>
            {pollExamId ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <Loader2 className="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                Синк…
              </span>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          {!shellMode ? (
            <nav
              className="flex w-[68px] shrink-0 flex-col border-r border-zinc-600/25 bg-[#3a3a42] text-zinc-200"
              aria-label="Үндсэн навигаци"
            >
              <div className="flex h-[52px] items-center justify-center border-b border-zinc-500/20">
                <div className="flex items-center gap-0.5" aria-hidden>
                  <Square className="size-2 fill-amber-300/75 text-amber-300/75" />
                  <Circle className="size-2 fill-sky-400 text-sky-400" />
                  <Triangle className="size-2 fill-amber-300/75 text-amber-300/75" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 px-2 py-3">
                <Link
                  href={
                    shellMode
                      ? "/ai-scheduler?view=school"
                      : "/ai-scheduler-school-event"
                  }
                  title="Сургуулийн хуанли"
                  aria-label="Сургуулийн хуанли руу очих"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-blue-200"
                >
                  <CalendarDays
                    className="size-5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </Link>
                <button
                  type="button"
                  title="Багшийн хуанли"
                  aria-current="page"
                  aria-label="Багшийн хуанли (одоо)"
                  className="flex size-11 items-center justify-center rounded-xl bg-white/14 text-white shadow-sm ring-1 ring-white/12"
                >
                  <CalendarClock
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </button>
              </div>
              <div className="border-t border-zinc-500/20 p-2">
                <button
                  type="button"
                  onClick={() => setCalendarSidebarOpen((o) => !o)}
                  aria-expanded={calendarSidebarOpen}
                  title={
                    calendarSidebarOpen
                      ? "Хуанлын панел хураах"
                      : "Хуанлын панел дэлгэх"
                  }
                  className="flex size-11 w-full items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
                >
                  {calendarSidebarOpen ? (
                    <ChevronLeft className="size-5" strokeWidth={1.5} />
                  ) : (
                    <ChevronRight className="size-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </nav>
          ) : null}

          {/* Хураагддаг: жижиг хуанли + давхарга */}
          <aside
            id="scheduler-calendar-sidebar"
            className={cn(
              "shrink-0 overflow-hidden border-zinc-200/90 bg-white/50 transition-[width] duration-200 ease-out xl:bg-white/40 dark:border-zinc-700/90 dark:bg-zinc-950/60 xl:dark:bg-zinc-950/50",
              calendarSidebarOpen
                ? shellMode
                  ? "w-full max-w-[min(100vw,280px)] border-r sm:max-w-[272px]"
                  : "w-full max-w-[min(100vw-68px,280px)] border-r sm:max-w-[272px]"
                : "w-0 border-r-0",
            )}
          >
            <div
              className={cn(
                "flex h-full w-full max-w-[272px] flex-col gap-4 overflow-y-auto p-4",
                shellMode
                  ? "min-w-[min(100vw,272px)]"
                  : "min-w-[min(100vw-68px,272px)]",
              )}
            >
              <div className={cn(panelLight, "p-3")}>
                <div className="mb-2 space-y-0.5 px-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Календарь
                  </p>
                </div>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={mn}
                    className="w-fit"
                  />
                </div>
              </div>

              <div
                className={cn(
                  panelLight,
                  "divide-y divide-zinc-100 dark:divide-zinc-800",
                )}
              >
                <div className="px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Давхарга · Ops Center ({CALENDAR_LAYERS.length})
                  </p>
                </div>
                {CALENDAR_LAYERS.map((layer) => {
                  const on = layerOn[layer.id];
                  const constraintKind = CALENDAR_LAYER_CONSTRAINT[layer.id];
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLayer(layer.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        on
                          ? "bg-blue-50/80 text-zinc-900 dark:bg-blue-950/50 dark:text-zinc-100"
                          : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-sm",
                          layer.swatch,
                          layer.style,
                          !on && "opacity-35",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {layer.label}
                        </span>
                        <span className="line-clamp-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                          {layer.role}
                        </span>
                        <span
                          className="mt-0.5 line-clamp-1 text-[9px] text-zinc-400 dark:text-zinc-500"
                          title={constraintLabelMn(constraintKind)}
                        >
                          {constraintLabelMn(constraintKind)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          on
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                        )}
                      >
                        {on ? "Идэвхтэй" : "Нуугдсан"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
            {/* Төв: цагийн багана + 7 хоногийн тор */}
            <main
              ref={calendarMainRef}
              className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-200/90 p-3 sm:p-4 xl:rounded-l-3xl xl:border-r xl:bg-zinc-50/30 dark:border-zinc-700/90 dark:xl:bg-zinc-950/40"
            >
              <div
                className={cn(
                  panelLight,
                  "flex h-full min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Энэ 7 хоног
                    </p>
                    <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {weekRangeLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5 dark:border-zinc-600 dark:bg-zinc-900/80">
                    <button
                      type="button"
                      onClick={() => shiftWeek(-1)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Өмнөх долоо хоног"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(new Date())}
                      className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Өнөөдөр
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftWeek(1)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Дараагийн долоо хоног"
                    >
                      <ChevronRight className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-blue-100/90 bg-linear-to-r from-blue-50/90 to-white px-3 py-2.5 dark:border-blue-900/50 dark:from-blue-950/50 dark:to-zinc-900/80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        <Target className="size-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Фокус цаг (жишээ)
                        </p>
                        <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                          Reclaim / Linear-тай ижил төстэй: долоо хоногийн чухал
                          ажилд цаг гаргах — Operations Center-ийн нэг хэсэг.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                      6ц / 10ц
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100/80 dark:bg-blue-950/80"
                    role="progressbar"
                    aria-valuenow={60}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Фокус цагийн явц (жишээ)"
                  >
                    <div className="h-full w-[60%] rounded-full bg-blue-400 dark:bg-blue-500" />
                  </div>
                </div>

                <div
                  className={cn(
                    "mb-2 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-2 text-[10px] leading-snug text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400",
                  )}
                >
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Цагийн муж (`constants/calendar.ts`)
                  </p>
                  <p className="mt-1">
                    <span className="text-zinc-500 dark:text-zinc-500">
                      Тор:
                    </span>{" "}
                    {CALENDAR_VIEW_CONFIG.dayVisible.start}–
                    {CALENDAR_VIEW_CONFIG.dayVisible.end} ·{" "}
                    <span className="text-zinc-500 dark:text-zinc-500">
                      Critical:
                    </span>{" "}
                    {CALENDAR_VIEW_CONFIG.criticalFocus.start}–
                    {CALENDAR_VIEW_CONFIG.criticalFocus.end}.{" "}
                    <span className="text-rose-600/90 dark:text-rose-400/90">
                      Улаан 07:30–07:50
                    </span>{" "}
                    (өглөөний бэлтгэл),{" "}
                    <span className="text-rose-600/90 dark:text-rose-400/90">
                      13:05–13:25
                    </span>{" "}
                    (ээлж солих).
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-zinc-200/80 pt-2 dark:border-zinc-700/80 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[9px] text-zinc-500 dark:text-zinc-500">
                      I ээлж: ихэвчлэн 10–12 (өглөө). II ээлж: ихэвчлэн 1–5
                      (~13:15-аас). Сонголтоор хуанли 07:45 эсвэл 12:00 руу
                      scroll хийнэ.
                    </p>
                    <div
                      className="flex shrink-0 rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-600 dark:bg-zinc-900"
                      role="group"
                      aria-label="Багшийн ээлж — хуанлийн анхны төвлөрөл"
                    >
                      <button
                        type="button"
                        aria-pressed={teacherShift === "I"}
                        onClick={() => setTeacherShift("I")}
                        className={cn(
                          "rounded-md px-2 py-1 text-[9px] font-semibold transition-colors",
                          teacherShift === "I"
                            ? "bg-sky-600 text-white shadow-sm dark:bg-sky-500"
                            : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800",
                        )}
                      >
                        I · Өглөө
                      </button>
                      <button
                        type="button"
                        aria-pressed={teacherShift === "II"}
                        onClick={() => setTeacherShift("II")}
                        className={cn(
                          "rounded-md px-2 py-1 text-[9px] font-semibold transition-colors",
                          teacherShift === "II"
                            ? "bg-amber-600 text-white shadow-sm dark:bg-amber-600"
                            : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800",
                        )}
                      >
                        II · Өдөр
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-0 border-b border-zinc-200 pb-2 dark:border-zinc-700 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
                  <div
                    className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    Цаг
                  </div>
                  {weekDays.map((d) => {
                    const isSel = isSameDay(d, anchor);
                    return (
                      <div
                        key={format(d, "yyyy-MM-dd")}
                        className="text-center"
                      >
                        <div
                          className={cn(
                            "mx-auto flex size-8 items-center justify-center rounded-full text-[11px] font-medium sm:size-9 sm:text-xs",
                            isSel
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/30"
                              : "border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                          )}
                          aria-label={format(d, "EEEE", { locale: mn })}
                        >
                          {WEEKDAY_LETTER_MN[getISODay(d)] ?? "?"}
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 sm:text-sm">
                          {format(d, "d")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="relative min-h-0 flex-1">
                  <div className="grid min-h-0 flex-1 grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
                    <div
                      className="relative shrink-0 text-right"
                      style={{ minHeight: GRID_BODY_MIN_H }}
                    >
                      <div
                        ref={calendarFocusAnchorRef}
                        className="pointer-events-none absolute left-0 right-0 h-px opacity-0"
                        style={{
                          top: `${slotTopPercent(
                            TEACHER_SHIFT_INITIAL_FOCUS[teacherShift].hour,
                            TEACHER_SHIFT_INITIAL_FOCUS[teacherShift].minute,
                          )}%`,
                        }}
                        aria-hidden
                      />
                      {TIME_SLOT_LABELS.map((row) => (
                        <div
                          key={row.key}
                          className={cn(
                            "flex items-start justify-end border-t pr-1 pt-0.5 text-[10px] tabular-nums first:border-t-0 first:pt-0 sm:pr-1.5",
                            row.isHourMark
                              ? "border-zinc-200 font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 sm:text-[11px]"
                              : "border-zinc-100 text-[9px] text-zinc-400/85 dark:border-zinc-800 dark:text-zinc-500/90",
                          )}
                          style={{ height: HOUR_PX }}
                        >
                          {row.label}
                        </div>
                      ))}
                      {SHIFT_MARKER_LAYOUTS.map((mk) => (
                        <div
                          key={mk.at}
                          className="pointer-events-none absolute right-0 z-[2] max-w-[2.85rem] -translate-y-1/2 text-right sm:max-w-[3.25rem]"
                          style={{ top: `${mk.topPct}%` }}
                        >
                          <span className="inline-block rounded border border-indigo-200 bg-indigo-50/95 px-0.5 py-px text-[7px] font-bold leading-tight text-indigo-700 shadow-sm dark:border-indigo-500/50 dark:bg-indigo-950/80 dark:text-indigo-200 sm:text-[8px]">
                            {mk.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {weekDays.map((d, colIdx) => {
                      const sameDay =
                        scheduleStart && isSameDay(scheduleStart, d);
                      const top = scheduleStart
                        ? blockTopPercent(scheduleStart)
                        : 28;

                      return (
                        <div
                          key={`col-${colIdx}`}
                          className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/80 dark:border-zinc-600/90 dark:bg-zinc-900/50"
                          style={{ minHeight: GRID_BODY_MIN_H }}
                        >
                          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
                            <div
                              className="absolute inset-x-0 bg-zinc-400/11 dark:bg-zinc-500/20"
                              style={{
                                top: `${CALENDAR_BUFFER_BANDS.beforeTopPct}%`,
                                height: `${CALENDAR_BUFFER_BANDS.beforeHeightPct}%`,
                              }}
                            />
                            <div
                              className="absolute inset-x-0 bg-zinc-400/11 dark:bg-zinc-500/20"
                              style={{
                                top: `${CALENDAR_BUFFER_BANDS.afterTopPct}%`,
                                height: `${CALENDAR_BUFFER_BANDS.afterHeightPct}%`,
                              }}
                            />
                            {CALENDAR_OVERLAY_LAYOUTS.map((z) => (
                              <div
                                key={z.id}
                                className="calendar-red-zone-stripes pointer-events-auto absolute inset-x-0 z-[1] cursor-help border-y border-rose-300/35 dark:border-rose-800/45"
                                style={{
                                  top: `${z.topPct}%`,
                                  height: `${z.heightPct}%`,
                                }}
                                title={z.tooltip ?? z.label}
                                aria-label={z.tooltip}
                                role="img"
                              />
                            ))}
                          </div>
                          <div
                            className="scheduler-slot-grid-bg pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
                            aria-hidden
                          />
                          {layerOn.school_event
                            ? teacherSchoolEventSegments
                                .filter((seg) => seg.colIdx === colIdx)
                                .map((seg) => (
                                  <div
                                    key={`school-bg-${seg.eventId}-${colIdx}-${seg.topPct}`}
                                    className="pointer-events-none absolute left-0.5 right-0.5 z-[1] select-none rounded-xl border border-amber-200/75 bg-amber-100/70 px-2 py-1.5 text-[10px] font-medium leading-tight text-amber-950/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] dark:border-amber-800/55 dark:bg-amber-950/45 dark:text-amber-50"
                                    style={{
                                      top: `${seg.topPct}%`,
                                      height: `${seg.heightPct}%`,
                                      minHeight: seg.allDay ? "48px" : "40px",
                                    }}
                                    title="Сургуулийн нийтийн эвент (read-only) — зөөх боломжгүй"
                                    aria-readonly
                                  >
                                    <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-900/85 dark:text-amber-200/90">
                                      Сургууль
                                    </span>
                                    <span className="mt-0.5 block line-clamp-4 font-semibold">
                                      {seg.title}
                                    </span>
                                  </div>
                                ))
                            : null}

                          {activePrimaryLessons
                            .filter(
                              (lesson) =>
                                layerOn.primary &&
                                lesson.colIdx === colIdx &&
                                lesson.slotVariant !== "free",
                            )
                            .map((lesson) => {
                              const v = lesson.slotVariant ?? "default";
                              const card = primaryLessonCardModel(lesson, {
                                cabinetRoom: selectedTeacher.cabinetRoom,
                              });
                              return (
                                <div
                                  key={`${selectedTeacherId}-${lesson.colIdx}-${lesson.periodLabel}-${lesson.startH}-${lesson.startM}`}
                                  title={card.tooltip}
                                  className={cn(
                                    "absolute left-1 right-1 z-[3] overflow-hidden rounded-xl border shadow-sm",
                                    v === "default" &&
                                      "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/45 dark:text-sky-50",
                                    v === "free" &&
                                      "border-dashed border-slate-300/80 bg-slate-50/90 text-slate-700 dark:border-slate-600 dark:bg-slate-900/35 dark:text-slate-200",
                                    v === "duty" &&
                                      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50",
                                    "px-2 py-1.5",
                                  )}
                                  style={{
                                    top: `${slotTopPercent(lesson.startH, lesson.startM)}%`,
                                    height: `${blockHeightPercent(lesson.startH, lesson.startM, lesson.endH, lesson.endM)}%`,
                                    /* minHeight бүү тавь: % өндөрөөс их болж цагийн цонхоос зөрөхөөс сэргийлнэ */
                                    minHeight: 0,
                                  }}
                                >
                                  <div className="relative flex min-h-full flex-col">
                                    {card.room ? (
                                      <span
                                        className={cn(
                                          "pointer-events-none absolute right-0 top-0 z-[1] max-w-[46%] truncate rounded-bl-md rounded-tr-[10px] border px-1 py-px text-[7px] font-bold tabular-nums leading-none tracking-wide",
                                          v === "default" &&
                                            "border-sky-400/55 bg-white/95 text-sky-950 dark:border-sky-500/50 dark:bg-sky-950/90 dark:text-sky-50",
                                        )}
                                        title={`Өрөө ${card.room}`}
                                      >
                                        {card.room}
                                      </span>
                                    ) : null}
                                    <div
                                      className={cn(
                                        "flex shrink-0 flex-col gap-1",
                                        card.room ? "pr-9" : "",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "shrink-0 truncate text-[13px] font-bold leading-tight tracking-tight",
                                          v === "duty" &&
                                            "text-[12px] leading-snug",
                                        )}
                                      >
                                        {card.headline}
                                      </div>
                                      {card.subline ? (
                                        <div
                                          className={cn(
                                            "shrink-0 truncate text-[10px] font-medium leading-normal",
                                            v === "default" &&
                                              "text-sky-800/95 dark:text-sky-100/90",
                                          )}
                                        >
                                          {card.subline}
                                        </div>
                                      ) : null}
                                      <div
                                        className={cn(
                                          "shrink-0 text-[10px] font-normal tabular-nums leading-4",
                                          v === "default" &&
                                            "text-sky-700/90 dark:text-sky-300/95",
                                          v === "duty" &&
                                            "text-amber-900/85 dark:text-amber-200/90",
                                        )}
                                      >
                                        {card.timeLine}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                          {layerOn.confirmed_exam &&
                          colIdx === 3 &&
                          !(
                            showJob &&
                            sameDay &&
                            !suggested &&
                            showJob.status === "confirmed"
                          ) ? (
                            <div
                              className="absolute left-1 right-1 z-[1] rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-950 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-50"
                              style={{
                                top: `${slotTopPercent(CONFIRMED_EXAM_DEMO.startH, CONFIRMED_EXAM_DEMO.startM)}%`,
                                height: `${blockHeightPercent(CONFIRMED_EXAM_DEMO.startH, CONFIRMED_EXAM_DEMO.startM, CONFIRMED_EXAM_DEMO.endH, CONFIRMED_EXAM_DEMO.endM)}%`,
                                minHeight: "48px",
                              }}
                            >
                              Баталгаажсан шалгалт
                              <span className="mt-0.5 block font-normal text-emerald-700 dark:text-emerald-300">
                                {formatBlockDuration(
                                  CONFIRMED_EXAM_DEMO.startH,
                                  CONFIRMED_EXAM_DEMO.startM,
                                  CONFIRMED_EXAM_DEMO.endH,
                                  CONFIRMED_EXAM_DEMO.endM,
                                )}
                              </span>
                              <span className="mt-0.5 block text-[9px] font-normal text-emerald-600/90 dark:text-emerald-400/90">
                                Сурагчдад зарлагдсан · 10А · Алгебр
                              </span>
                            </div>
                          ) : null}

                          {layerOn.conflict &&
                          teacherSchoolConflictColumns.has(colIdx) ? (
                            <div
                              className="absolute left-1 right-1 top-[28%] z-[4] rounded-xl border border-rose-300 bg-rose-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-rose-950 shadow-md ring-1 ring-rose-200/80 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-50"
                              style={{ minHeight: "48px" }}
                            >
                              Зөрчилтэй
                              <span className="mt-0.5 block font-normal text-rose-800 dark:text-rose-200">
                                Үндсэн хичээл + сургуулийн эвент давхцсан
                              </span>
                            </div>
                          ) : null}

                          {layerOn.personal && colIdx === 6 ? (
                            <div
                              className="absolute left-1 right-1 top-[48%] z-[1] rounded-xl border border-slate-300/80 bg-slate-100/95 px-2 py-1.5 text-[10px] text-slate-800 shadow-sm ring-1 ring-slate-300/50 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-slate-600/60"
                              style={{ minHeight: "44px" }}
                              title="Юу гэдэг нь харагдахгүй — зөвхөн Завгүй"
                            >
                              <span className="font-medium">Хувийн</span>
                              <span className="mt-0.5 block text-[9px] font-normal text-slate-500 dark:text-slate-400">
                                Busy · Google Calendar (дэлгэрүүлэхгүй)
                              </span>
                            </div>
                          ) : null}

                          {layerOn.ai_draft && colIdx === 2 && !suggested ? (
                            <div
                              className="absolute left-1 right-1 z-[1] rounded-xl border-2 border-dashed border-violet-400/90 bg-violet-50/95 px-2 py-1.5 text-[10px] font-semibold leading-tight text-violet-950 opacity-90 shadow-sm ring-1 ring-violet-200/70 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50"
                              style={{
                                top: `${slotTopPercent(AI_DRAFT_DEMO.startH, AI_DRAFT_DEMO.startM)}%`,
                                height: `${blockHeightPercent(AI_DRAFT_DEMO.startH, AI_DRAFT_DEMO.startM, AI_DRAFT_DEMO.endH, AI_DRAFT_DEMO.endM)}%`,
                                minHeight: "52px",
                              }}
                            >
                              AI-ийн санал
                              <span className="mt-0.5 block font-normal text-violet-700 dark:text-violet-300">
                                {formatBlockDuration(
                                  AI_DRAFT_DEMO.startH,
                                  AI_DRAFT_DEMO.startM,
                                  AI_DRAFT_DEMO.endH,
                                  AI_DRAFT_DEMO.endM,
                                )}
                              </span>
                              <span className="mt-0.5 block text-[9px] font-normal text-violet-600/90 dark:text-violet-400/90">
                                Draft — Confirm дарвал баталгаажна
                              </span>
                            </div>
                          ) : null}

                          {layerOn.ai_draft && suggested && colIdx === 2 ? (
                            <>
                              <div
                                className="absolute left-0.5 right-0.5 z-10 w-[calc(100%-4px)] -rotate-2 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 px-2 py-2 text-[10px] font-semibold leading-tight text-violet-950 shadow-md shadow-violet-200/60 ring-1 ring-violet-200/80 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100 dark:shadow-violet-900/40 dark:ring-violet-800/60"
                                style={{ top: "18%", minHeight: "72px" }}
                              >
                                AI Draft Slots
                                <span className="mt-0.5 block font-normal text-violet-700 dark:text-violet-300">
                                  AI-ийн оновчтой цаг · тасархай хүрээ
                                </span>
                                <span className="mt-1 block text-[9px] font-normal text-violet-600/90 dark:text-violet-400/90">
                                  Confirm дарвал ногоон (Confirmed) болно
                                </span>
                              </div>
                              <svg
                                className="pointer-events-none absolute left-[40%] top-[32%] z-5 h-16 w-24 text-violet-500 dark:text-violet-400"
                                viewBox="0 0 96 64"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M8 8 Q 48 40 88 52"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M82 46 L88 52 L80 54"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <div
                                className="absolute left-1 right-1 top-[58%] rounded-xl border-2 border-dashed border-violet-300/90 bg-violet-50/70 px-2 py-1.5 text-center text-[9px] font-medium text-violet-900 dark:border-violet-600 dark:bg-violet-950/35 dark:text-violet-200"
                                style={{ height: "44px" }}
                              >
                                Сул цонх
                              </div>
                            </>
                          ) : null}

                          {layerOn.confirmed_exam &&
                          showJob &&
                          sameDay &&
                          !suggested &&
                          showJob.status === "confirmed" ? (
                            <div
                              className={cn(
                                "absolute left-1 right-1 rounded-xl border px-2 py-1.5 text-[10px] font-medium leading-tight shadow-sm",
                                "border-emerald-200 bg-emerald-50 text-emerald-950",
                              )}
                              style={{
                                top: `${Math.min(top, 78)}%`,
                                minHeight: "56px",
                              }}
                            >
                              Баталгаажсан шалгалт
                              <span className="mt-0.5 block font-normal text-emerald-700">
                                Confirmed Exams · AI эсвэл гараар
                              </span>
                            </div>
                          ) : null}

                          {(layerOn.conflict ||
                            layerOn.ai_draft ||
                            layerOn.confirmed_exam) &&
                          showJob &&
                          sameDay &&
                          !suggested &&
                          showJob.status === "failed" ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-rose-950 shadow-sm ring-1 ring-rose-100"
                              style={{
                                top: `${Math.min(top, 78)}%`,
                                minHeight: "56px",
                              }}
                            >
                              Зөрчилтэй
                              <span className="mt-0.5 block font-normal text-rose-700">
                                Conflict
                              </span>
                            </div>
                          ) : null}

                          {layerOn.ai_draft &&
                          showJob &&
                          sameDay &&
                          showJob.status === "pending" ? (
                            <div
                              className="absolute left-1 right-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-900"
                              style={{
                                top: `${Math.min(top, 72)}%`,
                                minHeight: "44px",
                              }}
                            >
                              Хүлээгдэж буй…
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p
                  className={cn(
                    "mt-2 text-center text-[10px] leading-relaxed",
                    textDim,
                  )}
                >
                  AI-Powered Operations Center: хуанлийн тор{" "}
                  {CALENDAR_VIEW_CONFIG.dayVisible.start}–
                  {CALENDAR_VIEW_CONFIG.dayVisible.end}, critical{" "}
                  {CALENDAR_VIEW_CONFIG.criticalFocus.start}–
                  {CALENDAR_VIEW_CONFIG.criticalFocus.end}, улаан түгжрэлийн
                  overlay constants/calendar.ts-аас.                   Усан цэнхэр үндсэн хичээл
                  (I/II ээлж · {LESSON_MINUTES} мин/цаг, завсар 5–15 мин),
                  баталгаажсан шалгалт, AI Draft, хувийн синк. Сургуулийн эвент —
                  amber дэвсгэр (mock жилийн хуанли), read-only; хичээлтэй давхцвал
                  зөрчил. Жишээ + job; бүрэн sync биш.
                </p>
              </div>
            </main>

            {/* Баруун: AI панел */}
            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-[inset_1px_0_0_0_rgba(39,39,42,0.8)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/90">
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Square className="size-2.5 fill-current" />
                  <Circle className="size-2 fill-current" />
                  <Triangle className="size-2.5 fill-current" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  PineQuest AI
                </span>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setRightTab("ai")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "ai"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  AI хуваарь
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("form")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "form"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  Тохиргоо
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4 dark:bg-zinc-950/80">
                {rightTab === "form" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="scheduler-test-id"
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        testId
                      </Label>
                      <Input
                        id="scheduler-test-id"
                        value={testId}
                        onChange={(e) => setTestId(e.target.value)}
                        className="rounded-xl border-zinc-200 bg-white font-mono text-xs text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="scheduler-class-id"
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        classId
                      </Label>
                      <Input
                        id="scheduler-class-id"
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        placeholder="10A"
                        className="rounded-xl border-zinc-200 bg-white font-mono text-sm text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={queueLoading}
                      onClick={() => void handleQueueSchedule()}
                      className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                    >
                      {queueLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Тооцоолох
                          <ArrowRight className="size-4" />
                        </span>
                      )}
                    </Button>
                    {lastQueuedExamId ? (
                      <p className="break-all font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                        {lastQueuedExamId}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-3 py-2.5 dark:border-indigo-500/25 dark:bg-indigo-950/30">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
                        Intelligent Buffer · замын зураг
                      </p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px] leading-snug text-indigo-900/90 dark:text-indigo-100/85">
                        {INTELLIGENT_BUFFER_ROADMAP_MN.map((line, i) => (
                          <li key={`ib-${i}`}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    {pollExamId ? (
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <Loader2 className="size-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                        getAiExamSchedule…
                      </div>
                    ) : null}

                    {showJob ? (
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Төлөв
                          </span>
                          <Badge
                            variant="outline"
                            className="border-zinc-300 font-mono text-[10px] text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                          >
                            {showJob.status}
                          </Badge>
                        </div>
                        <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          {showJob.startTime}
                        </p>
                        {showJob.aiReasoning ? (
                          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {showJob.aiReasoning}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-8 text-center text-xs text-zinc-500 shadow-sm dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                        <PanelRight className="mx-auto mb-2 size-8 text-zinc-300 dark:text-zinc-600" />
                        Эхлээд «Тохиргоо»-оос тооцоолох товч дарна уу.
                      </div>
                    )}

                    {showJob?.status === "suggested" &&
                    showJob.aiVariants?.length ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Сонгох
                        </p>
                        {showJob.aiVariants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-2 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {v.label}
                              </p>
                              <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                                {formatVariantWhen(v.startTime)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={approveLoading}
                              onClick={() => void handleApproveVariant(v)}
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:shadow-blue-500/25 dark:hover:bg-blue-400"
                              aria-label="Батлах"
                            >
                              {approveLoading ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Play className="size-4 translate-x-0.5 fill-current" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() =>
                    setRightTab((t) => (t === "form" ? "ai" : "form"))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ChevronRight
                    className={cn(
                      "size-4 transition-transform",
                      rightTab === "form" && "-rotate-90",
                    )}
                  />
                  {rightTab === "form" ? "Төлөв рүү" : "Тохиргоо нээх"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
