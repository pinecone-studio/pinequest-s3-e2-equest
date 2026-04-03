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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  GetSchoolEventsDocument,
  GetTeachersListDocument,
  GetTeacherMainLessonsListDocument,
  GetTeacherAvailabilityDocument,
  ListTeacherConfirmedExamSchedulesDocument,
  ListNewMathExamsDocument,
  RejectAiExamScheduleVariantDocument,
  RequestAiExamScheduleDocument,
} from "@/gql/create-exam-documents";
import type {
  ExamSchedule,
  ExamScheduleVariant,
  NewMathExamSummary,
  SchoolEvent,
  Teacher,
  TeacherAvailabilitySlot,
  TeacherMainLesson,
  RequestExamSchedulePayload,
} from "@/gql/graphql";
import { schoolPreferredDateStartIsoUb } from "@/lib/schoolPreferredDate";
import { cn } from "@/lib/utils";
import { buildSchoolCalendarSegmentsForWeek } from "@/lib/schoolCalendarWeekSegments";
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
  blockHeightPercentFromMinuteRange,
  minuteOfDayToHourMinute,
  parseClockToMinutes,
  slotTopPercent,
  slotTopPercentFromMinute,
  type TeacherShiftId,
} from "@/constants/calendar";
import {
  CALENDAR_LAYER_CONSTRAINT,
  constraintLabelMn,
} from "@/constants/calendarLayerTaxonomy";
import { roomBadgeForPrimaryLesson } from "@/constants/teacherScheduleMock";
import { AiSchedulerExamLibraryDialog } from "./AiSchedulerExamLibraryDialog";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Menu,
  Monitor,
  Moon,
  Play,
  CheckCircle2,
  Sun,
  Target,
  Square,
  Circle,
  Triangle,
  Sparkles,
  WandSparklesIcon,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

/** I/II ээлж: хичээл 40 мин, завсар 5–15 мин (давхаргын тайлбарт дундаж). */
const LESSON_MINUTES = 40;
const BREAK_MINUTES = 10;
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
  lesson: {
    colIdx: number;
    title: string;
    periodLabel: string;
    startH: number;
    startM: number;
    endH: number;
    endM: number;
    slotVariant?: "default" | "free" | "duty";
    roomNumber?: string | null;
  },
  opts?: { cabinetRoom?: string; roomNumber?: string | null },
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

  const room =
    opts?.roomNumber?.trim?.() ||
    lesson.roomNumber?.trim?.() ||
    roomBadgeForPrimaryLesson(lesson.title, opts?.cabinetRoom);
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

/** Эхлэл–дуусах + нийт минут (шалгалтын санал гэх мэт). */
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
  1: "Да",
  2: "Мя",
  3: "Лха",
  4: "Пү",
  5: "Ба",
  6: "Бя",
  7: "Ня",
};

const DEFAULT_CLASS_ID = "10A";
const DEFAULT_SEMESTER_ID = "2026-SPRING";
const TEACHER_SELECTION_STORAGE_KEY = "ai-scheduler-teacher:selectedTeacherId";
const AI_SCHEDULING_PROGRESS_MN = [
  "Хүсэлтийг хүлээн авлаа",
  "Анги, багш, танхимын мэдээллийг шалгаж байна",
  "Тохиромжтой цагийн хувилбаруудыг тооцоолж байна",
] as const;

const AI_TOAST_STEPS = [
  {
    title: "📅 Сургуулийн нэгдсэн календарьтай синхрончилж байна...",
  },
  {
    title:
      "🔍 Анги танхимын хүчин чадал болон тоног төхөөрөмжийг шалгаж байна...",
  },
  {
    title: "📊 Бүлэг бүрийн сурагчдын сул цагийг нэгтгэн боловсруулж байна...",
  },
] as const;

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:shadow-black/40";
const textDim = "text-zinc-500 dark:text-zinc-400";

function formatMnMonthDay(d: Date) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}-р сарын ${day}`;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  MATH: "Математик",
  PHYSICS: "Физик",
  CHEMISTRY: "Хими",
  BIOLOGY: "Биологи",
  HISTORY: "Түүх",
  GEOGRAPHY: "Газарзүй",
  LANGUAGE: "Хэл",
  ENGLISH: "Англи хэл",
  IT: "Мэдээлэл зүй",
  ART: "Урлаг",
  MUSIC: "Хөгжим",
  SPORTS: "Биеийн тамир",
  PRIMARY: "Бага анги",
};

const TEACHING_LEVEL_LABELS: Record<string, string> = {
  PRIMARY: "Бага",
  MIDDLE: "Дунд",
  HIGH: "Ахлах",
  ALL: "Бүх түвшин",
};

function teacherDepartmentLabel(value?: string | null) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();
  return DEPARTMENT_LABELS[key] ?? value ?? "Тэнхим";
}

function teacherTeachingLevelLabel(value?: string | null) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase();
  return TEACHING_LEVEL_LABELS[key] ?? value ?? "Түвшин";
}

function parseClockHHMM(s: string): { h: number; m: number } | null {
  const v = String(s ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return { h, m: mm };
}

function normalizeAvailabilityReason(reason: string | null | undefined): string {
  return (reason ?? "").trim();
}

function teacherAvailabilityStatusLabel(status: string): string {
  if (status === "BUSY") return "Завгүй";
  if (status === "PREFERENCE") return "Дуртай цаг";
  if (status === "AVAILABLE") return "Боломжтой";
  return status;
}

function teacherAvailabilityBlockTitle(
  reason: string | null | undefined,
  status: string,
): string {
  const r = normalizeAvailabilityReason(reason);
  if (r) {
    const paren = r.indexOf("(");
    const head = (paren > 0 ? r.slice(0, paren) : r).trim();
    if (head) return head;
  }
  return teacherAvailabilityStatusLabel(status);
}

/** Ижил өдөр, ижил шалтгаан/төлөв, дараалан орсон period-уудыг нэг хуанлийн блок болгоно. */
function mergeTeacherAvailabilityForCalendar(slots: TeacherAvailabilitySlot[]) {
  if (!slots.length) {
    return [] as Array<{
      key: string;
      colIdx: number;
      startMin: number;
      endMin: number;
      status: string;
      title: string;
    }>;
  }
  const sorted = [...slots].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.periodId - b.periodId,
  );
  type Acc = {
    dayOfWeek: number;
    status: string;
    reasonNorm: string;
    firstReason: string | null;
    lastPeriodId: number;
    startTime: string;
    endTime: string;
    ids: string[];
  };
  const merged: Acc[] = [];
  let cur: Acc | null = null;
  for (const s of sorted) {
    const reasonNorm = normalizeAvailabilityReason(s.reason);
    const canMerge =
      cur &&
      cur.dayOfWeek === s.dayOfWeek &&
      cur.status === s.status &&
      cur.reasonNorm === reasonNorm &&
      s.periodId === cur.lastPeriodId + 1;
    if (canMerge && cur) {
      cur.endTime = s.endTime;
      cur.lastPeriodId = s.periodId;
      cur.ids.push(s.id);
    } else {
      if (cur) merged.push(cur);
      cur = {
        dayOfWeek: s.dayOfWeek,
        status: s.status,
        reasonNorm,
        firstReason: s.reason ?? null,
        lastPeriodId: s.periodId,
        startTime: s.startTime,
        endTime: s.endTime,
        ids: [s.id],
      };
    }
  }
  if (cur) merged.push(cur);

  return merged
    .map((m) => {
      const startMin = parseClockToMinutes(m.startTime);
      const endMin = parseClockToMinutes(m.endTime);
      const colIdx = Math.max(0, Math.min(6, m.dayOfWeek - 1));
      const title = teacherAvailabilityBlockTitle(m.firstReason, m.status);
      return {
        key: m.ids.join(":"),
        colIdx,
        startMin,
        endMin,
        status: m.status,
        title,
      };
    })
    .filter((row) => row.endMin > row.startMin);
}

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

type ListTeacherConfirmedExamSchedulesData = {
  listTeacherConfirmedExamSchedules: ExamSchedule[];
};

type ListTeacherConfirmedExamSchedulesVars = {
  teacherId: string;
  startDate: string;
  endDate: string;
};

type ApproveAiExamScheduleData = {
  approveAiExamSchedule: ExamSchedule;
};

type ApproveAiExamScheduleVars = {
  examId: string;
  variantId: string;
};

type RejectAiExamScheduleVariantData = {
  rejectAiExamScheduleVariant: ExamSchedule;
};

type RejectAiExamScheduleVariantVars = {
  examId: string;
  variantId: string;
  reason?: string;
};

type ListNewMathExamsData = {
  listNewMathExams: NewMathExamSummary[];
};

type ListNewMathExamsVars = {
  limit?: number;
};

type GetSchoolEventsData = {
  getSchoolEvents: SchoolEvent[];
};

type GetSchoolEventsVars = {
  startDate: string;
  endDate: string;
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

type AiVariantCalendarLayout = {
  id: string;
  colIdx: number;
  topPct: number;
  heightPct: number;
  lane: number;
  laneCount: number;
};

function buildAiVariantLayouts(
  variants: readonly ExamScheduleVariant[],
  durationMinutes: number,
): AiVariantCalendarLayout[] {
  const blocks = variants
    .map((v) => {
      const startAt = parseStart(v.startTime);
      if (!startAt) return null;
      const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
      return {
        id: v.id,
        colIdx: Math.max(0, Math.min(6, getISODay(startAt) - 1)),
        startMin: startAt.getHours() * 60 + startAt.getMinutes(),
        endMin: endAt.getHours() * 60 + endAt.getMinutes(),
        topPct: slotTopPercent(startAt.getHours(), startAt.getMinutes()),
        heightPct: blockHeightPercent(
          startAt.getHours(),
          startAt.getMinutes(),
          endAt.getHours(),
          endAt.getMinutes(),
        ),
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const byDay = new Map<number, typeof blocks>();
  for (const block of blocks) {
    const arr = byDay.get(block.colIdx) ?? [];
    arr.push(block);
    byDay.set(block.colIdx, arr);
  }

  const layouts: AiVariantCalendarLayout[] = [];
  for (const [colIdx, dayBlocks] of byDay.entries()) {
    dayBlocks.sort((a, b) => a.startMin - b.startMin);
    const laneEndMins: number[] = [];
    for (const block of dayBlocks) {
      let lane = laneEndMins.findIndex((endMin) => endMin <= block.startMin);
      if (lane === -1) {
        lane = laneEndMins.length;
        laneEndMins.push(block.endMin);
      } else {
        laneEndMins[lane] = block.endMin;
      }
      layouts.push({
        id: block.id,
        colIdx,
        topPct: block.topPct,
        heightPct: block.heightPct,
        lane,
        laneCount: 0,
      });
    }
    const laneCount = Math.max(1, laneEndMins.length);
    for (const layout of layouts) {
      if (layout.colIdx === colIdx) layout.laneCount = laneCount;
    }
  }

  return layouts;
}

/**
 * Багшийн хуанли = зөвхөн цаг харах биш, AI-Powered Operations Center.
 * Cron / Linear / Reclaim-ийн урсгал + ирээдүйн шийдлүүдийг нэг дэлгэцэнд.
 */
type CalendarLayerId =
  | "primary"
  | "ancillary_confirmed"
  | "confirmed_exam"
  | "ai_draft"
  | "school_event"
  | "personal"
  | "conflict";

const LAYER_CHECK_BG: Record<CalendarLayerId, string> = {
  primary: "bg-sky-200",
  confirmed_exam: "bg-indigo-200",
  school_event: "bg-slate-300",
  ancillary_confirmed: "bg-blue-200",
  personal: "bg-gray-200",
  ai_draft: "bg-violet-200",
  conflict: "bg-rose-200",
};

const LAYER_CHECK_FG: Record<CalendarLayerId, string> = {
  primary: "text-sky-900",
  confirmed_exam: "text-indigo-900",
  school_event: "text-slate-950",
  ancillary_confirmed: "text-blue-950",
  personal: "text-gray-900",
  ai_draft: "text-violet-950",
  conflict: "text-rose-950",
};

const LAYER_ROW_ON: Record<CalendarLayerId, string> = {
  primary: "bg-sky-50 text-sky-950 dark:bg-sky-950/35 dark:text-sky-50 ",
  confirmed_exam:
    "bg-indigo-50 text-indigo-950 dark:bg-indigo-950/35 dark:text-indigo-50 ",
  school_event:
    "bg-slate-100 text-slate-950 dark:bg-slate-950/25 dark:text-slate-50 ",
  ancillary_confirmed:
    "bg-blue-50 text-blue-950 dark:bg-blue-950/25 dark:text-blue-50 ",
  personal: "bg-gray-100 text-gray-950 dark:bg-gray-900/35 dark:text-gray-50 ",
  ai_draft:
    "bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50 rounded-br-2xl rounded-bl-2xl ",
  conflict: "bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50 ",
};

const CALENDAR_LAYERS: {
  id: CalendarLayerId;
  label: string;
  role: string;
  swatch: string;
  style?: string;
}[] = [
  {
    id: "primary",
    label: "Хичээлийн хуваарь",
    role: `I/II ээлж · ${LESSON_MINUTES} мин цаг · завсар 5–15 мин (жишээ)`,
    swatch: "bg-sky-200",
    style: "pointer-events-none",
  },
  {
    id: "confirmed_exam",
    label: "Шалгалтын хуваарь",
    role: "Сурагчдад зарлагдсан албан ёсны шалгалтууд (Locked / Double confirmation нүдлэнэ).",
    swatch: "bg-indigo-100",
  },
  {
    id: "school_event",
    label: "Сургуулийн эвент",
    role: "Сургуулийн нэгдсэн календарийн (School Event Calendar) read-only давхарга.",
    swatch: "bg-slate-300",
  },
  {
    id: "ancillary_confirmed",
    label: "Нэмэлт үйл ажиллагаа",
    role: "Багшийн teacher_availability (BUSY/PREFERENCE) — цагийн тороор.",
    swatch: "bg-blue-300",
    style:
      "ring-1 ring-indigo-300/80 dark:bg-indigo-800/40 dark:ring-indigo-600/60",
  },
  {
    id: "personal",
    label: "Гадуур ажил",
    role: "Google Calendar-аас татсан хувийн завгүй цагууд (Private).",
    swatch: "bg-gray-300",
    style: "ring-1 ring-slate-300/80 dark:bg-slate-800 dark:ring-slate-600/80",
  },
  {
    id: "ai_draft",
    label: "AI-ийн санал",
    role: "AI-аас санал болгож буй ноорог цагууд (Exam / Extra / Guidance Intent-тай).",
    swatch: "bg-violet-200",
    style: "border-2 border-dashed border-violet-400 opacity-80",
  },
  {
    id: "conflict",
    label: "Зөрчил & Санамж (Alert)",
    role: "Давхцал үүссэн эсвэл сурагчийн ачаалал хэтэрсэн үеийн анхааруулга (Critical).",
    swatch: "bg-rose-500",
    style: "animate-pulse",
  },
];

type AiDraftIntentKind =
  | "exam_intent"
  | "extra_activity_support_intent"
  | "extra_activity_club_intent"
  | "guidance_intent";

const AI_DRAFT_INTENT_META: Record<
  AiDraftIntentKind,
  {
    draftTitle: string;
    draftSubtitle: string;
    confirmTarget: "confirmed_exam" | "ancillary_confirmed";
    ancillarySubtypeLabel:
      | "Баталгаажсан давтлага"
      | "Секц"
      | "Зөвлөх цаг + Анги удирдсан";
  }
> = {
  exam_intent: {
    draftTitle: "[Exam Draft]",
    draftSubtitle: "Шалгалт товлох — Confirm дарвал confirmed_exam рүү орно.",
    confirmTarget: "confirmed_exam",
    ancillarySubtypeLabel: "Зөвлөх цаг + Анги удирдсан",
  },
  extra_activity_support_intent: {
    draftTitle: "[Support Draft]",
    draftSubtitle:
      "Давтлага / баталгаатай нэмэлт — Confirm дарвал ancillary_confirmed рүү орно.",
    confirmTarget: "ancillary_confirmed",
    ancillarySubtypeLabel: "Баталгаажсан давтлага",
  },
  extra_activity_club_intent: {
    draftTitle: "[Club Draft]",
    draftSubtitle:
      "Секц / дугуйлан маягийн нэмэлт — Confirm дарвал ancillary_confirmed рүү орно.",
    confirmTarget: "ancillary_confirmed",
    ancillarySubtypeLabel: "Секц",
  },
  guidance_intent: {
    draftTitle: "[Guidance Draft]",
    draftSubtitle:
      "Зөвлөх цаг + Анги удирдсан — Confirm дарвал ancillary_confirmed рүү орно.",
    confirmTarget: "ancillary_confirmed",
    ancillarySubtypeLabel: "Зөвлөх цаг + Анги удирдсан",
  },
};

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

export type AiTeacherPersonalSchedulerProps = {
  /** Үнэн бол гаднах hub rail нуугдана (зөвхөн /ai-scheduler дээр). */
  shellMode?: boolean;
  /** Үнэн бол дотор header (гарчиг + theme/teacher picker) нуугдана. */
  hideHeader?: boolean;
  /** Хуанлийн анхны scroll: I → 07:00, II → 12:00 (профайлаас дамжуулж болно). */
  defaultTeacherShift?: TeacherShiftId;
};

/** Эвент товлох таб: серверт одоогоор зөвхөн `exam` холбогдоно. */
const AI_SCHEDULER_QUEUE_EVENT_KINDS = [
  { value: "exam", label: "Шалгалт товлох" },
  { value: "drill", label: "Давтлага" },
  { value: "classwork", label: "Ангийн ажил" },
  { value: "consultation", label: "Зөвлөгөө" },
] as const;

type AiSchedulerQueueEventKind =
  (typeof AI_SCHEDULER_QUEUE_EVENT_KINDS)[number]["value"];

/** Gemini/API-ийн урт техникийн алдааг UI-д шууд битгий гэж үзээд ойлгомжтой мессеж өгнө. */
function userFacingAiSchedulerReasoning(
  raw: string | null | undefined,
): string {
  const s = (raw ?? "").trim();
  if (!s) {
    return "Хуваарь товлоход алдаа гарлаа. Дахин оролдоно уу.";
  }
  if (
    s.includes("GoogleGenerativeAI") ||
    s.includes("generativelanguage.googleapis.com") ||
    s.includes("Error fetching from") ||
    s.includes("503 Service Unavailable") ||
    s.includes("[503") ||
    /service unavailable/i.test(s) ||
    /high demand/i.test(s) ||
    s.includes("429") ||
    /resource exhausted/i.test(s) ||
    s.includes("generateContent")
  ) {
    return "AI үйлчилгээ түр ачаалалтай байна. Түр хүлээгээд дахин «Товлох» дарна уу.";
  }
  const techIdx = s.search(/Техникийн дэлгэрэнгүй:/i);
  if (techIdx !== -1) {
    const head = s.slice(0, techIdx).trim();
    return head || "Хуваарь товлоход алдаа гарлаа. Дахин оролдоно уу.";
  }
  return s;
}

/** `exam_schedules.status` → UI (албан API нэр биш, зөвхөн харагдах текст). */
function examScheduleStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Хүлээгдэж байна";
    case "suggested":
      return "Санал гарсан";
    case "confirmed":
      return "Баталгаажсан";
    case "failed":
      return "Амжилтгүй (AI/сервер)";
    default:
      return status;
  }
}

export function AiTeacherPersonalScheduler({
  shellMode = false,
  hideHeader = false,
  defaultTeacherShift = "I",
}: AiTeacherPersonalSchedulerProps) {
  const router = useRouter();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [testId, setTestId] = useState("");
  /** Диалогоос сонгосон нэр (50-ийн жагсаалтад байхгүй тест сонгосон ч харагдана). */
  const [pickedExamTitle, setPickedExamTitle] = useState("");
  const [queueEventKind, setQueueEventKind] =
    useState<AiSchedulerQueueEventKind>("exam");
  const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
  const [lastQueuedExamId, setLastQueuedExamId] = useState<string | null>(null);
  const [pollExamId, setPollExamId] = useState<string | null>(null);
  const [liveSchedule, setLiveSchedule] = useState<ExamSchedule | null>(null);
  const [variantActionKey, setVariantActionKey] = useState<string | null>(null);
  const [aiProgressStep, setAiProgressStep] = useState(0);
  const [rightTab, setRightTab] = useState<"ai" | "form">("form");
  const [examLibraryDialogOpen, setExamLibraryDialogOpen] = useState(false);
  const [layerOn, setLayerOn] = useState<Record<CalendarLayerId, boolean>>({
    primary: true,
    ancillary_confirmed: true,
    confirmed_exam: true,
    ai_draft: true,
    school_event: true,
    personal: true,
    conflict: true,
  });
  const [aiDraftIntent, setAiDraftIntent] =
    useState<AiDraftIntentKind>("exam_intent");
  /** Хуанли + давхаргын зүүн панел нээгдсэн эсэх (rail-аас сэлгэнэ). */
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  /** Баруун AI ("Багшийн туслах") панел нээгдсэн эсэх. */
  const [assistantSidebarOpen, setAssistantSidebarOpen] = useState(true);
  /** I = өглөөний ээлж (ахлах), II = өдрийн ээлж (бага анги) — анхны scroll төвлөрөлт. */
  const [teacherShift, setTeacherShift] =
    useState<TeacherShiftId>(defaultTeacherShift);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TEACHER_SELECTION_STORAGE_KEY) ?? "";
  });
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const calendarMainRef = useRef<HTMLElement>(null);
  const calendarFocusAnchorRef = useRef<HTMLDivElement>(null);
  const toastKeyRef = useRef<string>("");
  const aiProgressToastIdRef = useRef<string | number | null>(null);
  const aiProgressStepRef = useRef(0);
  const lastAutoFocusedSuggestionIdRef = useRef<string | null>(null);
  /** Polling: эвэрүүдлийн санал / failed төлөвийг console-д нэг удаа логлох */
  const aiSchedulerConsoleOnceRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setTeacherShift(defaultTeacherShift);
  }, [defaultTeacherShift]);

  useEffect(() => {
    if (!pollExamId) {
      aiProgressToastIdRef.current = null;
      aiProgressStepRef.current = 0;
      setAiProgressStep(0);
      return;
    }

    // Step-by-step toast while polling (simulated progress).
    const toastId =
      aiProgressToastIdRef.current ??
      toast.custom(() => <div />, { duration: Infinity });
    aiProgressToastIdRef.current = toastId;

    const render = () => {
      const stepIdx = Math.max(0, Math.min(2, aiProgressStepRef.current));
      toast.custom(
        (id) => (
          <div className="w-[min(92vw,26rem)] rounded-2xl border border-blue-100 bg-white px-4 py-3 font-sans shadow-lg shadow-blue-100/40 dark:border-blue-500/20 dark:bg-zinc-900 dark:shadow-black/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  AI Тооцоолол: [Step {stepIdx + 1}/3]
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {AI_TOAST_STEPS[stepIdx]?.title ?? "Тооцоолж байна..."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(id)}
                className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200"
                aria-label="Мэдэгдэл хаах"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {AI_TOAST_STEPS.map((s, i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                return (
                  <div key={s.title} className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                    ) : active ? (
                      <span className="inline-flex size-4 shrink-0 items-center justify-center">
                        <span className="inline-block size-2.5 rounded-full bg-blue-500 animate-pulse dark:bg-blue-400" />
                      </span>
                    ) : (
                      <span className="inline-flex size-4 shrink-0 items-center justify-center">
                        <span className="inline-block size-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[11px] leading-snug",
                        done
                          ? "text-emerald-700 dark:text-emerald-300"
                          : active
                            ? "text-zinc-800 dark:text-zinc-100"
                            : "text-zinc-500 dark:text-zinc-400",
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ),
        { id: toastId, duration: Infinity },
      );
    };

    render();
    const t = setInterval(() => {
      aiProgressStepRef.current = (aiProgressStepRef.current + 1) % 3;
      setAiProgressStep(aiProgressStepRef.current);
      render();
    }, 2200);

    return () => clearInterval(t);
  }, [pollExamId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedTeacherId) {
      window.localStorage.setItem(
        TEACHER_SELECTION_STORAGE_KEY,
        selectedTeacherId,
      );
      return;
    }
    window.localStorage.removeItem(TEACHER_SELECTION_STORAGE_KEY);
  }, [selectedTeacherId]);

  type GetTeachersListData = { getTeachersList: Teacher[] };
  type GetTeachersListVars = { grades?: number[] };

  const {
    data: teacherData,
    loading: teacherLoading,
    error: teacherError,
  } = useQuery<GetTeachersListData, GetTeachersListVars>(
    GetTeachersListDocument,
    {
      variables: { grades: [9, 10, 11, 12] },
      fetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
    },
  );

  const teacherOptions = useMemo(() => {
    const rows = teacherData?.getTeachersList ?? [];
    return rows.filter((t) => t.role === "TEACHER");
  }, [teacherData?.getTeachersList]);

  useEffect(() => {
    // Teachers query дуусаагүй үед fallback руу бүү үсэр — header дээр hardcode мэт харагддаг.
    if (teacherLoading) return;

    const first = teacherOptions[0]?.id ?? "";
    if (first) {
      if (teacherOptions.some((t) => t.id === selectedTeacherId)) {
        return;
      }
      if (!selectedTeacherId) {
        setSelectedTeacherId(first);
      }
      return;
    }
  }, [selectedTeacherId, teacherOptions, teacherLoading]);

  const selectedTeacherRow = useMemo(() => {
    if (!selectedTeacherId) return null;
    return teacherOptions.find((t) => t.id === selectedTeacherId) ?? null;
  }, [teacherOptions, selectedTeacherId]);

  type ListTeacherMainLessonsData = {
    getTeacherMainLessonsList: TeacherMainLesson[];
  };
  type ListTeacherMainLessonsVars = {
    teacherId: string;
    semesterId?: string;
    includeDraft?: boolean;
  };

  const { data: mainLessonsData, error: mainLessonsError } = useQuery<
    ListTeacherMainLessonsData,
    ListTeacherMainLessonsVars
  >(GetTeacherMainLessonsListDocument, {
    variables: {
      teacherId: selectedTeacherId,
      semesterId: DEFAULT_SEMESTER_ID,
      includeDraft: false,
    },
    skip: !selectedTeacherId,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  type GetTeacherAvailabilityData = {
    getTeacherAvailability: TeacherAvailabilitySlot[];
  };
  type GetTeacherAvailabilityVars = { teacherId: string };

  const { data: teacherAvailabilityData } = useQuery<
    GetTeacherAvailabilityData,
    GetTeacherAvailabilityVars
  >(GetTeacherAvailabilityDocument, {
    variables: { teacherId: selectedTeacherId },
    skip: !selectedTeacherId,
    fetchPolicy: "network-only",
  });

  const teacherAvailabilityCalendarBlocks = useMemo(() => {
    const raw = teacherAvailabilityData?.getTeacherAvailability ?? [];
    const relevant = raw.filter(
      (s) => s.status === "BUSY" || s.status === "PREFERENCE",
    );
    return mergeTeacherAvailabilityForCalendar(relevant);
  }, [teacherAvailabilityData?.getTeacherAvailability]);

  const {
    data: examTemplateData,
    loading: examTemplateLoading,
    error: examTemplateError,
  } = useQuery<ListNewMathExamsData, ListNewMathExamsVars>(
    ListNewMathExamsDocument,
    {
      variables: { limit: 50 },
      fetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
    },
  );

  const examTemplateOptions = useMemo(
    () => examTemplateData?.listNewMathExams ?? [],
    [examTemplateData?.listNewMathExams],
  );
  const selectedExamTemplate = useMemo(
    () => examTemplateOptions.find((row) => row.examId === testId) ?? null,
    [examTemplateOptions, testId],
  );
  const selectedTestDisplayName = (
    selectedExamTemplate?.title?.trim() ||
    pickedExamTitle.trim() ||
    ""
  ).trim();
  const selectedExamDurationMinutes =
    typeof selectedExamTemplate?.durationMinutes === "number" &&
    Number.isFinite(selectedExamTemplate.durationMinutes) &&
    selectedExamTemplate.durationMinutes > 0
      ? Math.floor(selectedExamTemplate.durationMinutes)
      : 90;

  useEffect(() => {
    if (examTemplateLoading) return;
    const opts = examTemplateOptions;
    if (opts.length === 0) {
      setTestId("");
      setPickedExamTitle("");
      return;
    }
    setTestId((prev) => {
      const trimmed = prev.trim();
      if (trimmed && opts.some((o) => o.examId === trimmed)) return prev;
      return opts[0].examId;
    });
  }, [examTemplateLoading, examTemplateOptions]);

  const teacherClassOptions = useMemo(() => {
    const fromLive = Array.from(
      new Set(
        (mainLessonsData?.getTeacherMainLessonsList ?? [])
          .map((row) => row.groupId?.trim())
          .filter((v): v is string => Boolean(v)),
      ),
    ).sort((a, b) => a.localeCompare(b, "mn"));

    return fromLive;
  }, [mainLessonsData?.getTeacherMainLessonsList, selectedTeacherId]);

  useEffect(() => {
    if (!teacherClassOptions.length) return;
    if (teacherClassOptions.includes(classId)) return;
    setClassId(teacherClassOptions[0]);
  }, [classId, teacherClassOptions]);

  const selectedTeacher = useMemo(() => {
    const fallbackRealTeacher = teacherOptions[0] ?? null;
    const baseTeacher = selectedTeacherRow ?? fallbackRealTeacher;
    const displayName = baseTeacher?.shortName?.trim()
      ? baseTeacher.shortName
      : baseTeacher
        ? `${baseTeacher.lastName} ${baseTeacher.firstName}`
        : "—";
    const roleNote = baseTeacher
      ? `${teacherDepartmentLabel(baseTeacher.department)} · ${teacherTeachingLevelLabel(baseTeacher.teachingLevel)} · ${baseTeacher.workLoadLimit}/өдөр`
      : "Өгөгдөл олдсонгүй.";

    return {
      id: baseTeacher?.id ?? "",
      displayName,
      roleNote,
      lessons: [],
    } as const;
  }, [selectedTeacherRow, teacherOptions]);

  type PrimaryLesson = {
    colIdx: number;
    title: string;
    periodLabel: string;
    startH: number;
    startM: number;
    endH: number;
    endM: number;
    slotVariant?: "default" | "free" | "duty";
    roomNumber?: string | null;
  };

  const activePrimaryLessons = useMemo(() => {
    const rows = mainLessonsData?.getTeacherMainLessonsList ?? [];
    if (!rows.length) {
      return [] as PrimaryLesson[];
    }
    const lessons: PrimaryLesson[] = [];
    for (const r of rows) {
      const start = parseClockHHMM(r.startTime);
      const end = parseClockHHMM(r.endTime);
      if (!start || !end) continue;
      const colIdxRaw = (r.dayOfWeek ?? 1) - 1;
      const colIdx = Number.isFinite(colIdxRaw)
        ? Math.max(0, Math.min(6, Math.floor(colIdxRaw)))
        : 0;
      lessons.push({
        colIdx,
        title: r.groupId,
        periodLabel: `${r.periodNumber}-р цаг`,
        startH: start.h,
        startM: start.m,
        endH: end.h,
        endM: end.m,
        slotVariant: "default",
        roomNumber: r.classroomRoomNumber ?? null,
      });
    }
    return lessons;
  }, [mainLessonsData?.getTeacherMainLessonsList, selectedTeacher.lessons]);

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

  const [rejectVariant, { loading: rejectLoading }] = useMutation<
    RejectAiExamScheduleVariantData,
    RejectAiExamScheduleVariantVars
  >(RejectAiExamScheduleVariantDocument);

  const { data: pollData, error: pollError } = useQuery<
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

  /** AI уналаа үед backend эвэрүүдлийн 3 хувилбар өгвөл / failed бол тусад нь console.log */
  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (!row) return;

    const reasoning = row.aiReasoning ?? "";
    const looksHeuristic =
      row.status === "suggested" &&
      (reasoning.includes("эвэрүүдээр") ||
        reasoning.includes("AI түр ажиллаагүй")) &&
      (row.aiVariants?.length ?? 0) >= 1;

    if (looksHeuristic) {
      const k = `heuristic:${row.id}`;
      if (!aiSchedulerConsoleOnceRef.current.has(k)) {
        aiSchedulerConsoleOnceRef.current.add(k);
        console.log(
          "[ai-scheduler] Backend: AI амжилтгүй → эвэрүүдлийн 3 хувилбар (getAiExamSchedule)",
          {
            examId: row.id,
            status: row.status,
            aiReasoning: row.aiReasoning,
            aiVariants: row.aiVariants,
          },
        );
      }
      return;
    }

    if (row.status === "failed") {
      const k = `failed:${row.id}`;
      if (!aiSchedulerConsoleOnceRef.current.has(k)) {
        aiSchedulerConsoleOnceRef.current.add(k);
        console.log(
          "[ai-scheduler] Backend: AI амжилтгүй, эвэрүүдлийн санал ашиглаагүй (failed)",
          {
            examId: row.id,
            aiReasoning: row.aiReasoning,
          },
        );
      }
    }
  }, [pollData?.getAiExamSchedule]);

  useEffect(() => {
    if (!teacherError) return;
    toast.error(teacherError.message || "Багшийн жагсаалт ачааллахад алдаа.");
  }, [teacherError]);

  useEffect(() => {
    if (!mainLessonsError) return;
    toast.error(
      mainLessonsError.message || "Хичээлийн хуваарь ачааллахад алдаа.",
    );
  }, [mainLessonsError]);

  useEffect(() => {
    if (!examTemplateError) return;
    toast.error(
      examTemplateError.message ||
        "Шалгалтын материалын жагсаалт ачааллахад алдаа.",
    );
  }, [examTemplateError]);

  useEffect(() => {
    if (!pollError) return;
    // poll алдаа байвал polling зогсоож, toast-ийг нэг удаа үзүүлнэ.
    if (pollExamId) setPollExamId(null);
    if (aiProgressToastIdRef.current != null) {
      toast.dismiss(aiProgressToastIdRef.current);
      aiProgressToastIdRef.current = null;
    }
    toast.error(pollError.message || "AI scheduler polling алдаа.");
  }, [pollError, pollExamId]);

  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (!row || row.status !== "suggested") return;
    if (lastAutoFocusedSuggestionIdRef.current === row.id) return;

    const firstVariantDay = (row.aiVariants ?? [])
      .map((v) => parseStart(v.startTime))
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (!firstVariantDay) return;

    lastAutoFocusedSuggestionIdRef.current = row.id;
    setDate(startOfDay(firstVariantDay));
  }, [pollData?.getAiExamSchedule]);

  useEffect(() => {
    const row = pollData?.getAiExamSchedule;
    if (!row || !pollExamId) return;
    const st = row.status;
    if (st === "suggested") {
      setPollExamId(null);
      if (aiProgressToastIdRef.current != null) {
        toast.dismiss(aiProgressToastIdRef.current);
        aiProgressToastIdRef.current = null;
      }
      const key = `${row.id}:suggested`;
      if (toastKeyRef.current === key) return;
      toastKeyRef.current = key;
      toast.message("Саналууд бэлэн", {
        description: "Баруун панелаас хувилбар сонгоно уу.",
      });
      return;
    }
    if (st !== "confirmed" && st !== "failed" && st !== "rejected") return;
    const key = `${row.id}:${st}`;
    if (toastKeyRef.current === key) return;
    toastKeyRef.current = key;
    if (aiProgressToastIdRef.current != null) {
      toast.dismiss(aiProgressToastIdRef.current);
      aiProgressToastIdRef.current = null;
    }
    if (st === "confirmed") {
      toast.success("Хуваарь баталгаажлаа.");
    } else if (st === "rejected") {
      toast.message("Саналууд татгалзагдлаа.", {
        description: row.aiReasoning
          ? userFacingAiSchedulerReasoning(row.aiReasoning)
          : undefined,
      });
    } else {
      toast.error(
        userFacingAiSchedulerReasoning(row.aiReasoning) ||
          "AI scheduler алдаатай дууслаа.",
      );
    }
    setPollExamId(null);
  }, [pollData?.getAiExamSchedule, pollExamId]);

  async function handleApproveVariant(v: ExamScheduleVariant) {
    const examId = liveSchedule?.id ?? lastQueuedExamId;
    if (!examId) {
      toast.error("examId олдсонгүй.");
      return;
    }
    setVariantActionKey(`approve:${v.id}`);
    try {
      const { data } = await approveSchedule({
        variables: { examId, variantId: v.id },
      });
      const next = data?.approveAiExamSchedule;
      if (next) {
        setLiveSchedule(next);
        void refetchConfirmedSchedules();
        toastKeyRef.current = `${next.id}:confirmed`;
        toast.success("Сонгосон хувилбар баталгаажлаа.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Батлахад алдаа гарлаа.";
      toast.error(msg);
    } finally {
      setVariantActionKey(null);
    }
  }

  async function handleRejectVariant(v: ExamScheduleVariant) {
    const examId = liveSchedule?.id ?? lastQueuedExamId;
    if (!examId) {
      toast.error("examId олдсонгүй.");
      return;
    }
    setVariantActionKey(`reject:${v.id}`);
    try {
      const { data } = await rejectVariant({
        variables: {
          examId,
          variantId: v.id,
          reason: v.reason ?? undefined,
        },
      });
      const next = data?.rejectAiExamScheduleVariant;
      if (next) {
        setLiveSchedule(next);
        toast.success("Татгалзлаа.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Татгалзахад алдаа гарлаа.";
      toast.error(msg);
    } finally {
      setVariantActionKey(null);
    }
  }

  async function handleQueueSchedule() {
    const cid = classId.trim();
    if (!cid) {
      toast.error("Ангиа сонгоно уу.");
      return;
    }
    if (queueEventKind !== "exam") {
      toast.info(
        "Давтлага, ангийн ажил, зөвлөгөөгийн автомат товлох удахгүй нэмэгдэнэ. Одоогоор зөвхөн «Шалгалт товлох» ажиллана.",
      );
      return;
    }
    const tid = testId.trim();
    if (!tid) {
      toast.error("Шалгалтын материал олдсонгүй. Дахин ачаална уу.");
      return;
    }
    const day = date ?? new Date();
    // Сонгосон хуанлийн өдрийг UB (UTC+8) шөнө гэж тодорхойлох — startOfDay(local).toISOString() timezone алдааг засна.
    const preferredDate = schoolPreferredDateStartIsoUb(day);

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
          setAiDraftIntent("exam_intent");
          setLiveSchedule(null);
          setLastQueuedExamId(payload.examId);
          setPollExamId(payload.examId);
          setRightTab("ai");
        }
        // Step-by-step toast will be shown while pollExamId is active.
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
  const yearStart = useMemo(
    () => startOfDay(new Date(anchor.getFullYear(), 0, 1)),
    [anchor],
  );
  const yearEnd = useMemo(
    () => new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999),
    [anchor],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekQueryEnd = useMemo(
    () => new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
    [weekStart],
  );
  const {
    data: confirmedSchedulesData,
    refetch: refetchConfirmedSchedules,
    error: confirmedSchedulesError,
  } = useQuery<
    ListTeacherConfirmedExamSchedulesData,
    ListTeacherConfirmedExamSchedulesVars
  >(ListTeacherConfirmedExamSchedulesDocument, {
    variables: {
      teacherId: selectedTeacherId,
      startDate: weekStart.toISOString(),
      endDate: weekQueryEnd.toISOString(),
    },
    skip: !selectedTeacherId,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (!confirmedSchedulesError) return;
    toast.error(
      confirmedSchedulesError.message ||
        "Баталгаажсан шалгалтын хуваарь ачааллахад алдаа.",
    );
  }, [confirmedSchedulesError]);

  const { data: teacherSchoolEventData, error: teacherSchoolEventError } =
    useQuery<GetSchoolEventsData, GetSchoolEventsVars>(
      GetSchoolEventsDocument,
      {
        variables: {
          startDate: yearStart.toISOString(),
          endDate: yearEnd.toISOString(),
        },
        fetchPolicy: "cache-first",
        notifyOnNetworkStatusChange: true,
      },
    );

  useEffect(() => {
    if (!teacherSchoolEventError) return;
    toast.error(
      teacherSchoolEventError.message || "Сургуулийн эвент ачааллахад алдаа.",
    );
  }, [teacherSchoolEventError]);

  const teacherSchoolCalendarEvents = useMemo(() => {
    const rows = teacherSchoolEventData?.getSchoolEvents ?? [];
    const ws = startOfDay(weekStart);
    const we = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const out: {
      id: string;
      title: string;
      startAt: string;
      endAt: string;
      allDay: boolean;
    }[] = [];

    const holidayWindows = rows
      .filter(
        (ev) =>
          String(ev.eventType).toUpperCase() === "HOLIDAY" &&
          String(ev.repeatPattern ?? "NONE").toUpperCase() === "NONE",
      )
      .map((ev) => ({
        start: parseISO(ev.startDate),
        end: parseISO(ev.endDate),
      }))
      .filter(
        (w) =>
          !Number.isNaN(w.start.getTime()) &&
          !Number.isNaN(w.end.getTime()) &&
          w.end > w.start,
      );

    const overlaps = (start: Date, end: Date) =>
      start.getTime() < we.getTime() && end.getTime() > ws.getTime();

    const overlapsHoliday = (start: Date, end: Date) =>
      holidayWindows.some(
        (w) =>
          start.getTime() < w.end.getTime() &&
          end.getTime() > w.start.getTime(),
      );

    for (const ev of rows) {
      const start = parseISO(ev.startDate);
      const end = parseISO(ev.endDate);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        continue;
      }

      const durationMs = end.getTime() - start.getTime();
      const repeat = String(ev.repeatPattern ?? "NONE").toUpperCase();

      const pushEvent = (
        occurrenceStart: Date,
        occurrenceEnd: Date,
        suffix: string,
      ) => {
        if (!overlaps(occurrenceStart, occurrenceEnd)) return;
        if (
          repeat !== "NONE" &&
          overlapsHoliday(occurrenceStart, occurrenceEnd)
        )
          return;
        const type = String(ev.eventType).toUpperCase();
        const allDay =
          Boolean(ev.isFullLock) &&
          (type === "HOLIDAY" || type === "TRIP") &&
          occurrenceEnd.getTime() - occurrenceStart.getTime() >=
            20 * 60 * 60 * 1000;

        out.push({
          id: `${ev.id}:${suffix}`,
          title: ev.title,
          startAt: occurrenceStart.toISOString(),
          endAt: occurrenceEnd.toISOString(),
          allDay,
        });
      };

      if (repeat === "NONE") {
        pushEvent(start, end, "base");
        continue;
      }

      let cursor = new Date(start);
      let guard = 0;
      while (cursor.getTime() < we.getTime() && guard < 400) {
        const cursorEnd = new Date(cursor.getTime() + durationMs);
        pushEvent(cursor, cursorEnd, cursor.toISOString());

        if (repeat === "DAILY") {
          cursor = addDays(cursor, 1);
        } else if (repeat === "WEEKLY") {
          cursor = addDays(cursor, 7);
        } else if (repeat === "MONTHLY") {
          cursor = new Date(
            cursor.getFullYear(),
            cursor.getMonth() + 1,
            cursor.getDate(),
            cursor.getHours(),
            cursor.getMinutes(),
            cursor.getSeconds(),
            cursor.getMilliseconds(),
          );
        } else {
          break;
        }
        guard += 1;
      }
    }

    /** Mock: энэ 7 хоногийн баасан (5-р өдөр) 14:00–16:00 сурагчдын зөвлөлийн хурал */
    const friday = addDays(ws, 4);
    const mockCouncilStart = new Date(friday);
    mockCouncilStart.setHours(14, 0, 0, 0);
    const mockCouncilEnd = new Date(friday);
    mockCouncilEnd.setHours(16, 0, 0, 0);
    if (
      mockCouncilStart.getTime() < we.getTime() &&
      mockCouncilEnd.getTime() > ws.getTime()
    ) {
      out.push({
        id: "mock-student-council-friday",
        title: "Сурагчдын зөвлөлийн хурал",
        startAt: mockCouncilStart.toISOString(),
        endAt: mockCouncilEnd.toISOString(),
        allDay: false,
      });
    }

    return out;
  }, [teacherSchoolEventData?.getSchoolEvents, weekStart]);

  const teacherSchoolEventSegments = useMemo(
    () =>
      buildSchoolCalendarSegmentsForWeek(teacherSchoolCalendarEvents, weekDays),
    [teacherSchoolCalendarEvents, weekDays],
  );

  const scheduleStart = liveSchedule
    ? parseStart(liveSchedule.startTime)
    : null;
  const scheduleEnd = liveSchedule?.endTime
    ? parseStart(liveSchedule.endTime)
    : null;
  const suggested = liveSchedule?.status === "suggested";
  const showJob =
    liveSchedule && liveSchedule.id === lastQueuedExamId ? liveSchedule : null;
  const confirmedExamSchedules = useMemo(() => {
    const persisted =
      confirmedSchedulesData?.listTeacherConfirmedExamSchedules ?? [];
    const merged = new Map<string, ExamSchedule>();

    for (const row of persisted) {
      merged.set(row.id, row);
    }

    if (liveSchedule?.status === "confirmed") {
      merged.set(liveSchedule.id, liveSchedule);
    }

    return Array.from(merged.values());
  }, [confirmedSchedulesData?.listTeacherConfirmedExamSchedules, liveSchedule]);
  const confirmedExamBlocks = useMemo(
    () =>
      confirmedExamSchedules
        .map((row) => {
          const startAt = parseStart(row.startTime);
          const endAt = row.endTime ? parseStart(row.endTime) : null;
          if (!startAt || !endAt) return null;
          const colIdx = weekDays.findIndex((d) => isSameDay(startAt, d));
          if (colIdx < 0) return null;

          return {
            id: row.id,
            classId: row.classId,
            roomId: row.roomId,
            startAt,
            endAt,
            colIdx,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [confirmedExamSchedules, weekDays],
  );
  const aiVariantLayouts = useMemo(
    () =>
      showJob?.status === "suggested" && showJob.aiVariants?.length
        ? buildAiVariantLayouts(showJob.aiVariants, selectedExamDurationMinutes)
        : [],
    [showJob, selectedExamDurationMinutes],
  );

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
  const weekRangeLabel = `${formatMnMonthDay(weekStart)} – ${formatMnMonthDay(weekEnd)}`;

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
        {hideHeader ? null : (
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-950/90 sm:px-5 rounded-2xl">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-950/80 dark:text-sky-200 dark:ring-sky-700/60">
                  <CalendarClock
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                    Багшийн хуанли
                  </h1>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <SchedulerAppearanceMenu />
              <Popover
                open={teacherPickerOpen}
                onOpenChange={setTeacherPickerOpen}
              >
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
                    <ChevronDown
                      className="size-4 shrink-0 opacity-60"
                      aria-hidden
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(100vw-2rem,20rem)] border-zinc-200 p-2 font-sans shadow-lg dark:border-zinc-600"
                >
                  <p className="mb-2 px-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                    {teacherLoading
                      ? "Ачааллаж байна…"
                      : teacherOptions.length
                        ? `Нийт ${teacherOptions.length} багш`
                        : "Багш олдсонгүй."}
                  </p>
                  <ul className="max-h-[min(60vh,16rem)] space-y-0.5 overflow-y-auto">
                    {teacherOptions
                      .map((t) => ({
                        id: t.id,
                        displayName: (t.shortName?.trim()
                          ? t.shortName
                          : `${t.lastName} ${t.firstName}`) as string,
                        roleNote: `${teacherDepartmentLabel(t.department)} · ${teacherTeachingLevelLabel(t.teachingLevel)}`,
                        shift: teacherShift,
                      }))
                      .map((t) => {
                        const on = t.id === selectedTeacherId;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTeacherId(t.id);
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
                  AI туслах ажиллаж байна
                </span>
              ) : null}
            </div>
          </header>
        )}

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden bg-[#F1F4FA]">
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
                  href="/ai-scheduler?view=school"
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
                <Link
                  href="/ai-scheduler?view=student"
                  title="хуанли"
                  aria-label="Сурагчийн хуанли руу очих"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/10 hover:text-blue-200"
                >
                  <GraduationCap
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

          {/* Хураагддаг: жижиг хуанли + давхарга — дотоод min-w нь width анимацтай зөрчилдөхгүй */}
          <aside
            id="scheduler-calendar-sidebar"
            className={cn(
              "shrink-0 overflow-hidden  bg-white/50 transition-[width] duration-300 ease-in-out will-change-[width] xl:bg-white/40 dark:bg-zinc-950/60 xl:dark:bg-zinc-950/50",
              calendarSidebarOpen
                ? shellMode
                  ? "w-[min(100vw,272px)] sm:w-[272px]"
                  : "w-[min(calc(100vw-68px),272px)] sm:w-[272px]"
                : "w-0 min-w-0 ",
            )}
          >
            <div
              className={cn(
                "flex h-full w-full max-w-[272px] flex-col gap-4 overflow-y-auto bg-[#F1F4FA] p-4 py-8",
                calendarSidebarOpen
                  ? shellMode
                    ? "min-w-[min(100vw,272px)] sm:min-w-[272px]"
                    : "min-w-[min(calc(100vw-68px),272px)] sm:min-w-[272px]"
                  : "min-w-0 overflow-hidden",
              )}
            >
              <div className="flex justify-center rounded-xl bg-white p-2 dark:bg-zinc-900">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={mn}
                  className="w-fit"
                />
              </div>

              <div
                className={cn(
                  panelLight,
                  "divide-y divide-white/30 border-white/40 bg-white/55 backdrop-blur-md dark:divide-white/10 dark:border-white/10 dark:bg-zinc-950/40",
                )}
              >
                <div className="px-3 py-2">
                  {" "}
                  <p className="text-[14px] font-semibold tracking-wider text-black dark:text-zinc-400">
                    Багшийн хуваарь
                  </p>
                </div>
                {CALENDAR_LAYERS.filter((x) => x.id !== "conflict").map(
                  (layer) => {
                    const on = layerOn[layer.id];
                    const constraintKind = CALENDAR_LAYER_CONSTRAINT[layer.id];
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleLayer(layer.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-[background-color,color,box-shadow,transform] hover:-translate-y-px hover:shadow-sm active:translate-y-0",
                          on ? LAYER_ROW_ON[layer.id] : undefined,
                          !on &&
                            "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
                          on &&
                            "hover:brightness-[0.985] dark:hover:brightness-110",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-md p-1 transition-colors",
                            on
                              ? cn(
                                  LAYER_CHECK_BG[layer.id],
                                  LAYER_CHECK_FG[layer.id],
                                )
                              : "border border-slate-300 bg-transparent text-transparent dark:border-slate-600",
                          )}
                          aria-hidden
                        >
                          <Check
                            className={cn(
                              "size-3.5",
                              on
                                ? LAYER_CHECK_FG[layer.id]
                                : "text-transparent",
                            )}
                            strokeWidth={3}
                          />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block text-[13px] font-normal leading-snug wrap-break-word">
                            {layer.label}
                          </span>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
            {/* Төв: цагийн багана + 7 хоногийн тор */}
            <main
              ref={calendarMainRef}
              className="min-h-[480px] my-4 min-w-0 flex-1 overflow-auto p-3 sm:p-4 xl:rounded-l-3xl bg-[#F1F4FA]"
            >
              <div
                className={cn(
                  panelLight,
                  "flex h-full min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="flex shrink-0 items-center gap-2">
                      {shellMode ? (
                        <button
                          type="button"
                          className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-white hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 xl:inline-flex"
                          aria-expanded={calendarSidebarOpen}
                          aria-controls="scheduler-calendar-sidebar"
                          onClick={() => setCalendarSidebarOpen((o) => !o)}
                          title={
                            calendarSidebarOpen
                              ? "Жижиг хуанли хураах"
                              : "Жижиг хуанли дэлгэх"
                          }
                        >
                          <span className="sr-only">
                            Жижиг хуанли нээх, хаах
                          </span>
                          {calendarSidebarOpen ? (
                            <ChevronLeft
                              className="size-4"
                              strokeWidth={2}
                              aria-hidden
                            />
                          ) : (
                            <ChevronRight
                              className="size-4"
                              strokeWidth={2}
                              aria-hidden
                            />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setAssistantSidebarOpen((o) => !o)}
                        aria-expanded={assistantSidebarOpen}
                        title={
                          assistantSidebarOpen
                            ? "Багшийн туслах хураах"
                            : "Багшийн туслах дэлгэх"
                        }
                        className="cursor-pointer inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-white hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        {assistantSidebarOpen ? (
                          <ChevronRight className="size-4" strokeWidth={2} />
                        ) : (
                          <ChevronLeft className="size-4" strokeWidth={2} />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push("/ai-scheduler?view=student")}
                      className="opacity-10 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-zinc-100 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <GraduationCap
                        className="size-3.5 shrink-0"
                        strokeWidth={2}
                        aria-hidden
                      />
                      Сурагчийн хуанли
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/ai-scheduler?view=school")}
                      className="opacity-10 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-zinc-100 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <CalendarDays
                        className="size-3.5 shrink-0"
                        strokeWidth={2}
                        aria-hidden
                      />
                      Сургуулийн хуанли
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5 dark:border-zinc-600 dark:bg-zinc-900/80">
                    <button
                      type="button"
                      onClick={() => shiftWeek(-1)}
                      className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Өмнөх долоо хоног"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(new Date())}
                      className="cursor-pointer rounded-lg px-2 py-1.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      Өнөөдөр
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftWeek(1)}
                      className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label="Дараагийн долоо хоног"
                    >
                      <ChevronRight className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-0 border-b border-zinc-200 pb-2 dark:border-zinc-700 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
                  <div
                    className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
                    aria-hidden
                  >
                    {""}
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
                              ? "bg-sky-700 text-white shadow-md shadow-sky-500/20 dark:bg-sky-400 dark:shadow-sky-400/25"
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
                      {/* shift marker labels removed */}
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
                              className="absolute inset-x-0 bg-zinc-200/90 dark:bg-zinc-800/25"
                              style={{
                                top: `${CALENDAR_BUFFER_BANDS.beforeTopPct}%`,
                                height: `${CALENDAR_BUFFER_BANDS.beforeHeightPct}%`,
                              }}
                            />
                            <div
                              className="absolute inset-x-0 bg-zinc-100/25 dark:bg-zinc-950/12"
                              style={{
                                top: `${CALENDAR_BUFFER_BANDS.afterTopPct}%`,
                                height: `${CALENDAR_BUFFER_BANDS.afterHeightPct}%`,
                              }}
                            />
                            {CALENDAR_OVERLAY_LAYOUTS.map((z) => (
                              <div
                                key={z.id}
                                className="calendar-blue-zone-stripes pointer-events-auto absolute inset-x-0 z-1 cursor-help border-y border-blue-300/35 dark:border-blue-800/45"
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
                                    className="pointer-events-none absolute left-0.5 right-0.5 z-1 select-none rounded-xl border-0 bg-slate-50/95 px-2 py-1.5 text-[10px] font-normal leading-tight text-slate-950 shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:bg-slate-900/55 dark:text-slate-50 dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                                    style={{
                                      top: `${seg.topPct}%`,
                                      height: `${seg.heightPct}%`,
                                      minHeight: seg.allDay ? "48px" : "40px",
                                    }}
                                    title="Сургуулийн нийтийн эвент (read-only) — зөөх боломжгүй"
                                    aria-readonly
                                  >
                                    <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden p-0.5 text-center">
                                      <span className="w-full min-w-0 text-[10px] font-normal leading-snug wrap-break-word line-clamp-6">
                                        {seg.title}
                                      </span>
                                    </div>
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
                                cabinetRoom: undefined,
                                roomNumber: lesson.roomNumber ?? null,
                              });
                              return (
                                <div
                                  key={`${selectedTeacherId}-${lesson.colIdx}-${lesson.periodLabel}-${lesson.startH}-${lesson.startM}`}
                                  title={card.tooltip}
                                  className={cn(
                                    "absolute left-1 right-1 z-3 overflow-hidden rounded-xl border shadow-sm",
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
                                    height: `${blockHeightPercent(
                                      lesson.startH,
                                      lesson.startM,
                                      lesson.endH,
                                      lesson.endM,
                                    )}%`,
                                    /* minHeight бүү тавь: % өндөрөөс их болж цагийн цонхоос зөрөхөөс сэргийлнэ */
                                    minHeight: 0,
                                  }}
                                >
                                  <div className="relative flex min-h-full flex-col">
                                    {card.room ? (
                                      <span
                                        className={cn(
                                          "pointer-events-none absolute right-0 top-0 z-1 max-w-[46%] truncate rounded-md border px-1 py-px text-[7px] font-bold tabular-nums leading-none tracking-wide",
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

                          {layerOn.ancillary_confirmed
                            ? teacherAvailabilityCalendarBlocks
                                .filter((b) => b.colIdx === colIdx)
                                .map((b) => {
                                  const isBusy = b.status === "BUSY";
                                  return (
                                    <div
                                      key={`ta-${b.key}`}
                                      className={cn(
                                        "absolute left-1 right-1 z-3 flex min-h-[44px] flex-col items-center justify-center overflow-hidden rounded-xl border-0 px-2 py-1.5 text-center text-[10px] shadow-[0_1px_4px_rgba(15,23,42,0.1)]",
                                        isBusy
                                          ? "bg-blue-50 text-blue-950 dark:bg-blue-950/45 dark:text-blue-50 dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                                          : "bg-teal-50/95 text-teal-950 dark:bg-teal-950/45 dark:text-teal-50 dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)]",
                                      )}
                                      style={{
                                        top: `${slotTopPercentFromMinute(b.startMin)}%`,
                                        height: `${blockHeightPercentFromMinuteRange(b.startMin, b.endMin)}%`,
                                        minHeight: "44px",
                                      }}
                                      title={b.title}
                                    >
                                      <span className="w-full min-w-0 font-normal leading-snug wrap-break-word line-clamp-8">
                                        {b.title}
                                      </span>
                                    </div>
                                  );
                                })
                            : null}

                          {layerOn.ai_draft && suggested ? (
                            <>
                              {showJob?.aiVariants?.map((v) => {
                                const startAt = parseStart(v.startTime);
                                if (!startAt) return null;
                                const endAt = new Date(
                                  startAt.getTime() +
                                    selectedExamDurationMinutes * 60 * 1000,
                                );
                                const layout = aiVariantLayouts.find(
                                  (row) =>
                                    row.id === v.id && row.colIdx === colIdx,
                                );
                                if (!layout || !isSameDay(startAt, d))
                                  return null;
                                const laneGap = 4;
                                const totalGap =
                                  laneGap * (layout.laneCount - 1);
                                const widthCalc = `calc((100% - ${totalGap}px) / ${layout.laneCount})`;
                                const leftCalc =
                                  layout.lane === 0
                                    ? "4px"
                                    : `calc(4px + (${widthCalc} + ${laneGap}px) * ${layout.lane})`;
                                return (
                                  <div
                                    key={`ai-variant-${v.id}`}
                                    className="absolute left-1 right-1 z-10 rounded-xl border-2 border-dashed border-violet-400/90 bg-violet-50/95 px-2 py-1.5 text-[10px] font-semibold leading-tight text-violet-950 shadow-sm ring-1 ring-violet-200/70 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50"
                                    style={{
                                      top: `${layout.topPct}%`,
                                      height: `${layout.heightPct}%`,
                                      left: leftCalc,
                                      right: "auto",
                                      width: widthCalc,
                                      minHeight: "52px",
                                    }}
                                  >
                                    {v.label}
                                    <span className="mt-0.5 block font-normal text-violet-700 dark:text-violet-300">
                                      {formatBlockDuration(
                                        startAt.getHours(),
                                        startAt.getMinutes(),
                                        endAt.getHours(),
                                        endAt.getMinutes(),
                                      )}
                                      {v.roomId ? ` · Өрөө ${v.roomId}` : ""}
                                    </span>
                                  </div>
                                );
                              })}
                            </>
                          ) : null}

                          {layerOn.confirmed_exam
                            ? confirmedExamBlocks
                                .filter((row) => row.colIdx === colIdx)
                                .map((row) => (
                                  <div
                                    key={`confirmed-exam-${row.id}`}
                                    className={cn(
                                      "absolute left-1 right-1 rounded-xl border px-2 py-1.5 text-[10px] font-medium leading-tight shadow-sm",
                                      "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-700/60 dark:bg-indigo-950/35 dark:text-indigo-50",
                                    )}
                                    style={{
                                      top: `${blockTopPercent(row.startAt)}%`,
                                      height: `${blockHeightPercent(
                                        row.startAt.getHours(),
                                        row.startAt.getMinutes(),
                                        row.endAt.getHours(),
                                        row.endAt.getMinutes(),
                                      )}%`,
                                      minHeight: "56px",
                                    }}
                                  >
                                    Баталгаажсан шалгалт
                                    <span className="mt-0.5 block font-normal text-indigo-700 dark:text-indigo-200">
                                      {formatBlockDuration(
                                        row.startAt.getHours(),
                                        row.startAt.getMinutes(),
                                        row.endAt.getHours(),
                                        row.endAt.getMinutes(),
                                      )}
                                      {row.roomId
                                        ? ` · Өрөө ${row.roomId}`
                                        : ""}
                                    </span>
                                    <span className="mt-0.5 block text-[9px] font-normal text-indigo-600/90 dark:text-indigo-200/70">
                                      {row.classId} · Баталгаажсан
                                    </span>
                                  </div>
                                ))
                            : null}

                          {layerOn.ancillary_confirmed &&
                          aiDraftIntent !== "exam_intent" &&
                          showJob &&
                          sameDay &&
                          !suggested &&
                          showJob.status === "confirmed" ? (
                            <div
                              className={cn(
                                "absolute left-1 right-1 z-1 rounded-xl border-0 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-950 shadow-[0_1px_4px_rgba(15,23,42,0.1)] dark:bg-emerald-950/40 dark:text-emerald-50 dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)]",
                              )}
                              style={{
                                top: `${Math.min(top, 78)}%`,
                                minHeight: "56px",
                              }}
                            >
                              Баталгаажсан давтлага/удирдлага
                              <span className="mt-0.5 block font-normal text-emerald-700 dark:text-emerald-200">
                                {
                                  AI_DRAFT_INTENT_META[aiDraftIntent]
                                    .ancillarySubtypeLabel
                                }
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </main>

            {/* Баруун: AI панел — жижиг хуанлын адил width transition */}
            <div
              className={cn(
                "shrink-0 overflow-hidden transition-[width,max-width] duration-300 ease-in-out will-change-[width]",
                assistantSidebarOpen
                  ? "w-full max-w-[min(100vw,352px)] xl:max-w-[352px]"
                  : "pointer-events-none w-0 min-w-0 max-w-0 select-none xl:max-w-0",
              )}
              aria-hidden={!assistantSidebarOpen}
            >
              <aside className="m-4 mt-8 flex w-full max-w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-950 dark:ring-zinc-800/80 dark:shadow-[inset_1px_0_0_0_rgba(39,39,42,0.8)] xl:w-[320px]">
                <div className="flex items-center gap-2 rounded-t-2xl border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                    <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                  </div>
                  <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Багшийн туслах
                  </span>
                </div>

                <div className="border-zinc-200 bg-white px-3 pb-3 pt-2 dark:border-zinc-800 dark:bg-zinc-950">
                  <div
                    className="flex rounded-xl bg-zinc-100/95 p-1 shadow-inner dark:bg-zinc-900/90"
                    role="tablist"
                    aria-label="Туслах хэсэг"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={rightTab === "ai"}
                      onClick={() => setRightTab("ai")}
                      className={cn(
                        "flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
                        rightTab === "ai"
                          ? "bg-white text-sky-700 shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:text-sky-300 dark:ring-zinc-700/80"
                          : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
                      )}
                    >
                      <WandSparklesIcon
                        className="size-3.5 shrink-0 opacity-90"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="truncate">AI хуваарь</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={rightTab === "form"}
                      onClick={() => setRightTab("form")}
                      className={cn(
                        "flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
                        rightTab === "form"
                          ? "bg-white text-[#0b5cab] shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:text-sky-300 dark:ring-zinc-700/80"
                          : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
                      )}
                    >
                      <CalendarClock
                        className="size-3.5 shrink-0 opacity-90"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="truncate">Эвент товлох</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white p-4 dark:bg-zinc-950">
                  {rightTab === "form" ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-600 dark:text-zinc-400">
                          Эвентийн төрөл
                        </Label>
                        <Select
                          value={queueEventKind}
                          onValueChange={(v) =>
                            setQueueEventKind(v as AiSchedulerQueueEventKind)
                          }
                        >
                          <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 [&]:data-[size=default]:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AI_SCHEDULER_QUEUE_EVENT_KINDS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-600 dark:text-zinc-400">
                          Анги
                        </Label>
                        <Select
                          value={
                            teacherClassOptions.length > 0 ? classId : undefined
                          }
                          onValueChange={setClassId}
                          disabled={teacherClassOptions.length === 0}
                        >
                          <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 [&]:data-[size=default]:h-10">
                            <SelectValue placeholder="Ангийн мэдээлэл олдсонгүй" />
                          </SelectTrigger>
                          <SelectContent>
                            {teacherClassOptions.map((groupId) => (
                              <SelectItem key={groupId} value={groupId}>
                                {groupId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {queueEventKind === "exam" ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setExamLibraryDialogOpen(true)}
                            className="h-10 w-full cursor-pointer rounded-xl border-zinc-200 bg-white text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          >
                            Тест сонгох
                          </Button>
                          {selectedTestDisplayName ? (
                            <p
                              className="text-sm leading-snug text-zinc-800 dark:text-zinc-100"
                              title={selectedTestDisplayName}
                            >
                              {selectedTestDisplayName}
                            </p>
                          ) : null}
                          <AiSchedulerExamLibraryDialog
                            open={examLibraryDialogOpen}
                            onOpenChange={setExamLibraryDialogOpen}
                            onPick={(exam) => {
                              setTestId(exam.examId);
                              setPickedExamTitle(exam.title?.trim() ?? "");
                              toast.success("Тест сонгогдлоо.");
                            }}
                          />
                        </>
                      ) : null}
                      <Button
                        type="button"
                        disabled={
                          queueLoading ||
                          !classId.trim() ||
                          (queueEventKind === "exam" &&
                            (examTemplateLoading || !testId.trim()))
                        }
                        onClick={() => void handleQueueSchedule()}
                        className="h-11 w-full rounded-xl bg-sky-700 font-semibold text-white hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                      >
                        {queueLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Товлох
                          </span>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {showJob ? (
                        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              Төлөв
                            </span>
                            <Badge
                              variant="outline"
                              className="border-zinc-300 text-[10px] text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                            >
                              {examScheduleStatusLabel(showJob.status)}
                            </Badge>
                          </div>
                          {pollExamId ? (
                            <div className="mb-3 rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2.5 dark:border-sky-500/25 dark:bg-sky-950/20">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                                AI хуваарийн лог
                              </p>
                              <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-sky-950/90 dark:text-sky-100/85">
                                {AI_SCHEDULING_PROGRESS_MN.map((line, i) => {
                                  const done = i < aiProgressStep;
                                  const active = i === aiProgressStep;
                                  return (
                                    <li
                                      key={`ai-log-${i}`}
                                      className="flex gap-2"
                                    >
                                      <span
                                        className={cn(
                                          "mt-[3px] inline-block size-1.5 shrink-0 rounded-full",
                                          done &&
                                            "bg-emerald-500 dark:bg-emerald-400",
                                          active &&
                                            "animate-pulse bg-sky-500 dark:bg-sky-300",
                                          !done &&
                                            !active &&
                                            "bg-sky-200 dark:bg-sky-800",
                                        )}
                                      />
                                      <span>
                                        {done
                                          ? "Дууссан"
                                          : active
                                            ? "Явж байна"
                                            : "Хүлээгдэж байна"}{" "}
                                        · {line}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                          {showJob.aiReasoning ? (
                            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                              {userFacingAiSchedulerReasoning(
                                showJob.aiReasoning,
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {showJob?.status === "suggested" &&
                      showJob.aiVariants?.length ? (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            AI хуваарийн хувилбарууд
                          </p>
                          {showJob.aiVariants.map((v) => (
                            <div
                              key={v.id}
                              className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {v.label}
                                </p>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {formatVariantWhen(v.startTime)}
                                </p>
                                {v.reason ? (
                                  <p className="mt-1 text-[11px] leading-snug text-zinc-700 dark:text-zinc-300">
                                    {v.reason}
                                  </p>
                                ) : null}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                {(() => {
                                  const isApproving =
                                    variantActionKey === `approve:${v.id}`;
                                  const isRejecting =
                                    variantActionKey === `reject:${v.id}`;
                                  const isBusy = Boolean(variantActionKey);
                                  return (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          void handleApproveVariant(v)
                                        }
                                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
                                      >
                                        {isApproving ? (
                                          <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                          <Play className="size-4 translate-x-0.5 fill-current" />
                                        )}
                                        Батлах
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          void handleRejectVariant(v)
                                        }
                                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-900 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/45"
                                      >
                                        {isRejecting ? (
                                          <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                          <Square
                                            className="size-4"
                                            aria-hidden
                                          />
                                        )}
                                        Татгалзах
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
