"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { useTheme } from "next-themes";
import {
  addDays,
  addMonths,
  endOfDay,
  format,
  getISODay,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { mn } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GetSchoolEventsDocument } from "@/gql/create-exam-documents";
import type { SchoolEvent } from "@/gql/graphql";
import {
  CALENDAR_BUFFER_BANDS,
  CALENDAR_OVERLAY_LAYOUTS,
  CALENDAR_VIEW_CONFIG,
  GRID_BODY_MIN_H,
  HOUR_PX,
  SHIFT_MARKER_LAYOUTS,
  TIME_SLOT_LABELS,
  blockHeightPercent,
  slotTopPercent,
} from "@/constants/calendar";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  Menu,
  Monitor,
  Moon,
  PartyPopper,
  Square,
  Circle,
  Triangle,
  Sun,
} from "lucide-react";

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:shadow-black/40";
const textDim = "text-zinc-500 dark:text-zinc-400";

/** getISODay: 1=Даваа … 7=Ням */
const WEEKDAY_LETTER_MN: Record<number, string> = {
  1: "Д",
  2: "М",
  3: "Л",
  4: "П",
  5: "Б",
  6: "Б",
  7: "Н",
};

function formatMnMonthDay(d: Date) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}-р сарын ${day}`;
}

type SchoolEventType =
  | "HOLIDAY"
  | "EXAM"
  | "TEACHER_DEVELOPMENT"
  | "EXTRACURRICULAR"
  | "PARENT_MEETING"
  | "MAINTENANCE"
  | "TRIP"
  | "EVENT";

const SCHOOL_EVENT_TYPE_META: Record<
  SchoolEventType,
  {
    labelMn: string;
    examplesMn: string;
    impactMn: string;
    swatch: string;
    cardClass: string;
  }
> = {
  HOLIDAY: {
    labelMn: "Амралт/ Баяр",
    examplesMn: "Нийтийн амралт, баярын өдөр",
    impactMn: "Хичээл төлөвлөхгүй (ихэвчлэн)",
    swatch: "bg-rose-600",
    cardClass:
      "border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/70 dark:text-rose-50",
  },
  EXAM: {
    labelMn: "Шалгалт",
    examplesMn: "Улсын/улирлын шалгалт, олимпиад",
    impactMn: "Hard lock (EXAM)",
    swatch: "bg-red-700",
    cardClass:
      "border-red-300 bg-red-100 text-red-950 dark:border-red-700 dark:bg-red-950/70 dark:text-red-50",
  },
  TEACHER_DEVELOPMENT: {
    labelMn: "Багш нар",
    examplesMn: "Сургалт, заах арга зүй, шуурхай",
    impactMn: "Teacher lock",
    swatch: "bg-sky-600",
    cardClass:
      "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/70 dark:text-sky-50",
  },
  EXTRACURRICULAR: {
    labelMn: "Дугуйлан/секц",
    examplesMn: "Спорт, секц, тэмцээн",
    impactMn: "Partial lock (сонгосон анги)",
    swatch: "bg-emerald-600",
    cardClass:
      "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-50",
  },
  PARENT_MEETING: {
    labelMn: "Эцэг эх",
    examplesMn: "Эцэг эхийн хурал, уулзалт",
    impactMn: "Ихэвчлэн мэдээллийн",
    swatch: "bg-amber-600",
    cardClass:
      "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-50",
  },
  MAINTENANCE: {
    labelMn: "Засвар/Ариутгал",
    examplesMn: "Ариутгал, засвар, цэвэрлэгээ",
    impactMn: "Нөөцийн түгжээ",
    swatch: "bg-zinc-600",
    cardClass:
      "border-zinc-300 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-50",
  },
  TRIP: {
    labelMn: "Аялал",
    examplesMn: "Музей, аялал арга хэмжээ",
    impactMn: "Full/partial lock (анги)",
    swatch: "bg-pink-600",
    cardClass:
      "border-pink-300 bg-pink-100 text-pink-950 dark:border-pink-700 dark:bg-pink-950/70 dark:text-pink-50",
  },
  EVENT: {
    labelMn: "Арга хэмжээ",
    examplesMn: "Хичээлийн шинэ жил, Төгсөлтийн баяр",
    impactMn: "Soft/Flexible байж болно",
    swatch: "bg-blue-600",
    cardClass:
      "border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-700 dark:bg-blue-950/70 dark:text-blue-50",
  },
};

const SCHOOL_EVENT_TYPES: SchoolEventType[] = [
  "EXAM",
  "HOLIDAY",
  "TEACHER_DEVELOPMENT",
  "EXTRACURRICULAR",
  "PARENT_MEETING",
  "MAINTENANCE",
  "TRIP",
  "EVENT",
];

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

type SchoolSidebarLayerKey = SchoolEventType;

function defaultSchoolLayerVisibility(): Record<
  SchoolSidebarLayerKey,
  boolean
> {
  return {
    HOLIDAY: true,
    EXAM: true,
    TEACHER_DEVELOPMENT: true,
    EXTRACURRICULAR: true,
    PARENT_MEETING: true,
    MAINTENANCE: true,
    TRIP: true,
    EVENT: true,
  };
}

type DaySegment = {
  eventId: string;
  title: string;
  eventType: SchoolEventType;
  subcategory?: string | null;
  colIdx: number;
  allDay: boolean;
  topPct: number;
  heightPct: number;
};

type CalendarSchoolEvent = SchoolEvent & {
  occurrenceId: string;
};

function segmentForDay(
  day: Date,
  start: Date,
  end: Date,
): { start: Date; end: Date } | null {
  const d0 = startOfDay(day);
  const d1 = addDays(d0, 1);
  const segStart = start > d0 ? start : d0;
  const segEnd = end < d1 ? end : d1;
  if (segStart >= segEnd) return null;
  return { start: segStart, end: segEnd };
}

export type SchoolEventSchedulerProps = {
  shellMode?: boolean;
  /** Үнэн бол дотор header (гарчиг + theme/menu) нуугдана. */
  hideHeader?: boolean;
};

export function SchoolEventScheduler({
  shellMode = false,
  hideHeader = false,
}: SchoolEventSchedulerProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  const [layerOn, setLayerOn] = useState<
    Record<SchoolSidebarLayerKey, boolean>
  >(defaultSchoolLayerVisibility);
  const [rightTab, setRightTab] = useState<"list" | "about">("list");

  const anchor = date ?? new Date();
  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekRangeLabel = `${formatMnMonthDay(weekStart)} – ${formatMnMonthDay(weekEnd)}`;
  const yearStart = useMemo(
    () => startOfDay(new Date(anchor.getFullYear(), 0, 1)),
    [anchor],
  );
  const yearEnd = useMemo(
    () => endOfDay(new Date(anchor.getFullYear(), 11, 31)),
    [anchor],
  );

  type GetSchoolEventsData = { getSchoolEvents: SchoolEvent[] };
  type GetSchoolEventsVars = { startDate: string; endDate: string };

  const { data: schoolData } = useQuery<
    GetSchoolEventsData,
    GetSchoolEventsVars
  >(GetSchoolEventsDocument, {
    variables: {
      startDate: yearStart.toISOString(),
      endDate: yearEnd.toISOString(),
    },
    fetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const allSchoolCalendarEvents = useMemo(() => {
    const rows = schoolData?.getSchoolEvents ?? [];
    return rows;
  }, [schoolData?.getSchoolEvents]);

  const schoolEventsList = useMemo((): CalendarSchoolEvent[] => {
    const ws = startOfDay(weekStart);
    const we = endOfDay(weekEnd);
    const out: CalendarSchoolEvent[] = [];

    const overlaps = (start: Date, end: Date) =>
      start.getTime() < we.getTime() && end.getTime() > ws.getTime();

    const holidayWindows = allSchoolCalendarEvents
      .filter(
        (ev) =>
          String(ev.eventType).toUpperCase() === "HOLIDAY" &&
          String(ev.repeatPattern ?? "NONE").toUpperCase() === "NONE",
      )
      .map((ev) => {
        const start = parseISO(ev.startDate);
        const end = parseISO(ev.endDate);
        return { start, end };
      })
      .filter(
        (w) =>
          !Number.isNaN(w.start.getTime()) &&
          !Number.isNaN(w.end.getTime()) &&
          w.end > w.start,
      );

    const overlapsHoliday = (start: Date, end: Date) =>
      holidayWindows.some(
        (w) =>
          start.getTime() < w.end.getTime() &&
          end.getTime() > w.start.getTime(),
      );

    const pushOccurrence = (
      ev: SchoolEvent,
      start: Date,
      end: Date,
      key: string,
    ) => {
      if (!overlaps(start, end)) return;
      if (
        String(ev.repeatPattern ?? "NONE").toUpperCase() !== "NONE" &&
        overlapsHoliday(start, end)
      ) {
        return;
      }
      out.push({
        ...ev,
        occurrenceId: `${ev.id}:${key}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
    };

    for (const ev of allSchoolCalendarEvents) {
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

      if (repeat === "NONE") {
        pushOccurrence(ev, start, end, "base");
        continue;
      }

      let cursor = new Date(start);
      let guard = 0;
      while (cursor.getTime() < we.getTime() && guard < 400) {
        const cursorEnd = new Date(cursor.getTime() + durationMs);
        pushOccurrence(ev, cursor, cursorEnd, cursor.toISOString());

        if (repeat === "DAILY") {
          cursor = addDays(cursor, 1);
        } else if (repeat === "WEEKLY") {
          cursor = addDays(cursor, 7);
        } else if (repeat === "MONTHLY") {
          cursor = addMonths(cursor, 1);
        } else {
          break;
        }
        guard += 1;
      }
    }

    return out.sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
    );
  }, [allSchoolCalendarEvents, weekStart, weekEnd]);

  const eventSegments = useMemo((): DaySegment[] => {
    const events = schoolEventsList;
    const out: DaySegment[] = [];
    for (const ev of events) {
      const start = parseISO(ev.startDate);
      const end = parseISO(ev.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        continue;

      weekDays.forEach((day, colIdx) => {
        const seg = segmentForDay(day, start, end);
        if (!seg) return;
        const type = String(ev.eventType) as SchoolEventType;
        const allDay =
          ev.isFullLock &&
          (type === "HOLIDAY" || type === "TRIP") &&
          end.getTime() - start.getTime() >= 20 * 60 * 60 * 1000;

        if (allDay) {
          out.push({
            eventId: ev.occurrenceId,
            title: ev.title,
            eventType: type,
            subcategory: ev.description,
            colIdx,
            allDay: true,
            topPct: 0,
            heightPct: 100,
          });
          return;
        }
        const sh = seg.start.getHours();
        const sm = seg.start.getMinutes();
        const eh = seg.end.getHours();
        const em = seg.end.getMinutes();
        out.push({
          eventId: ev.occurrenceId,
          title: ev.title,
          eventType: type,
          subcategory: ev.description,
          colIdx,
          allDay: false,
          topPct: slotTopPercent(sh, sm),
          heightPct: blockHeightPercent(sh, sm, eh, em),
        });
      });
    }
    return out;
  }, [schoolEventsList, weekDays]);

  function toggleLayer(id: SchoolSidebarLayerKey) {
    setLayerOn((p) => ({ ...p, [id]: !p[id] }));
  }

  function shiftWeek(deltaWeeks: number) {
    setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
  }

  const selectedLabel = date
    ? format(date, "EEEE, MMMM d", { locale: mn })
    : "—";

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-[#f4f5f7] font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100",
        "selection:bg-blue-500/20 selection:text-zinc-900 dark:selection:bg-blue-400/25 dark:selection:text-zinc-100",
      )}
    >
      <ReclaimLightBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        {hideHeader ? null : (
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-700/90 dark:bg-zinc-950/90 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {shellMode ? (
              <>
                <button
                  type="button"
                  className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:flex"
                  aria-expanded={calendarSidebarOpen}
                  aria-controls="school-scheduler-sidebar"
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
                  aria-controls="school-scheduler-sidebar"
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
                aria-controls="school-scheduler-sidebar"
                onClick={() => setCalendarSidebarOpen((o) => !o)}
              >
                <span className="sr-only">Хуанлын панел нээх, хаах</span>
                <Menu className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                  <CalendarClock
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <div>
                  <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                    Сургуулийн хуанли
                  </h1>
                </div>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <SchedulerAppearanceMenu />
            <Link
              href="/ai-scheduler"
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Багшийн хуваарь
            </Link>
          </div>
          </header>
        )}

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          {!shellMode ? (
            <nav
              className="flex w-[68px] shrink-0 flex-col border-r border-zinc-600/25 bg-[#3a3a42] text-zinc-200"
              aria-label="Үндсэн навигаци"
            >
              <div className="flex h-[52px] items-center justify-center border-b border-zinc-500/20">
                <div className="flex items-center gap-0.5" aria-hidden>
                  <Square className="size-2 fill-rose-400 text-rose-400" />
                  <Circle className="size-2 fill-sky-400 text-sky-400" />
                  <Triangle className="size-2 fill-amber-400 text-amber-400" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 px-2 py-3">
                <div
                  className="flex size-11 cursor-pointer items-center justify-center rounded-xl bg-white/14 text-white shadow-sm ring-1 ring-white/12"
                  title="Сургуулийн хуанли"
                  aria-current="page"
                  aria-label="Сургуулийн хуанли"
                >
                  <CalendarDays
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>
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

          <aside
            id="school-scheduler-sidebar"
            className={cn(
              "shrink-0 overflow-hidden border-zinc-200/90 bg-white/50 transition-[width] duration-200 ease-out dark:border-zinc-700/80 dark:bg-zinc-950/40 xl:bg-white/40",
              calendarSidebarOpen
                ? shellMode
                  ? "w-full max-w-[min(100vw,280px)] border-r sm:max-w-[272px]"
                  : "w-full max-w-[min(100vw-68px,280px)] border-r sm:max-w-[272px]"
                : "w-14 border-r",
            )}
          >
            {calendarSidebarOpen ? (
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
                  <div
                    className="flex justify-center rounded-xl bg-white p-2 dark:bg-zinc-900"
                    aria-label="Өдөр сонгох хуанли"
                  >
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
                    "divide-y divide-white/30 border-white/40 bg-white/55 backdrop-blur-md dark:divide-white/10 dark:border-white/10 dark:bg-zinc-950/40",
                  )}
                >
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Эвент
                  </p>
                  {SCHOOL_EVENT_TYPES.map((kind) => {
                    const meta = SCHOOL_EVENT_TYPE_META[kind];
                    const on = layerOn[kind];
                    return (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleLayer(kind)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          on
                            ? "bg-blue-50/80 text-zinc-900 dark:bg-blue-950/40 dark:text-zinc-100"
                            : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-md border p-1 transition-colors",
                            on
                              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                              : "border-zinc-300 bg-white text-transparent dark:border-zinc-700 dark:bg-zinc-950",
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-sm",
                            meta.swatch,
                            !on && "opacity-35",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {meta.labelMn}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center gap-3 border-zinc-200/80 py-4 dark:border-zinc-700/80">
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-950/80 dark:text-blue-300"
                  title="Сургуулийн хуанли"
                  aria-hidden
                >
                  <CalendarDays className="size-5" strokeWidth={1.75} />
                </span>
                <button
                  type="button"
                  onClick={() => setCalendarSidebarOpen(true)}
                  className="flex size-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  aria-expanded={false}
                  aria-controls="school-scheduler-sidebar"
                  title="Сургуулийн хуанли дэлгэх"
                >
                  <span className="sr-only">Сургуулийн хуанли дэлгэх</span>
                  <ChevronRight
                    className="size-5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
              </div>
            )}
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
            <main className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-200/90 p-3 sm:p-4 xl:rounded-l-3xl xl:border-r xl:bg-zinc-50/30 dark:border-zinc-700/90 dark:xl:bg-zinc-950/40">
              <div
                className={cn(
                  panelLight,
                  "flex min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
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

                <div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 border-b border-zinc-200 pb-2 dark:border-zinc-700 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
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

                <div className="relative min-h-0 flex-1 select-none">
                  <div className="grid min-h-0 flex-1 grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
                    <div
                      className="relative shrink-0 text-right"
                      style={{ minHeight: GRID_BODY_MIN_H }}
                    >
                      {TIME_SLOT_LABELS.map((row, idx) => (
                        <div
                          key={row.key}
                          className={cn(
                            "flex items-start justify-end border-t pr-1 pt-0.5 text-[10px] tabular-nums sm:pr-1.5",
                            idx === 0 && "border-t-0 pt-0",
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
                          className="pointer-events-none absolute right-0 z-2 max-w-[2.85rem] -translate-y-1/2 text-right sm:max-w-13"
                          style={{ top: `${mk.topPct}%` }}
                        >
                          <span className="inline-block rounded border border-indigo-200 bg-indigo-50/95 px-0.5 py-px text-[7px] font-bold leading-tight text-indigo-700 shadow-sm dark:border-indigo-500/50 dark:bg-indigo-950/80 dark:text-indigo-200 sm:text-[8px]">
                            {mk.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {weekDays.map((d, colIdx) => (
                      <div
                        key={`col-${colIdx}`}
                        className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/80 dark:border-zinc-600/90 dark:bg-zinc-900/50"
                        style={{ minHeight: GRID_BODY_MIN_H }}
                      >
                        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
                          <div
                            className="absolute inset-x-0 bg-zinc-200/55 dark:bg-zinc-800/25"
                            style={{
                              top: `${CALENDAR_BUFFER_BANDS.beforeTopPct}%`,
                              height: `${CALENDAR_BUFFER_BANDS.beforeHeightPct}%`,
                            }}
                          />
                          <div
                            className="absolute inset-x-0 bg-zinc-200/55 dark:bg-zinc-800/25"
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
                        {eventSegments
                          .filter(
                            (seg) =>
                              seg.colIdx === colIdx && layerOn[seg.eventType],
                          )
                          .map((seg) => {
                            const meta = SCHOOL_EVENT_TYPE_META[seg.eventType];
                            return (
                              <div
                                key={`${seg.eventId}-${colIdx}-${seg.topPct}`}
                                data-school-skip-drag
                                className={cn(
                                  "pointer-events-none absolute left-1 right-1 z-5 overflow-hidden rounded-xl border px-2 py-1.5 text-[10px] font-semibold leading-tight shadow-sm",
                                  meta.cardClass,
                                )}
                                style={{
                                  top: `${seg.topPct}%`,
                                  height: `${seg.heightPct}%`,
                                  minHeight: seg.allDay ? "48px" : "36px",
                                }}
                              >
                                <div className="mb-0.5 flex items-center gap-1 border-b border-black/5 pb-0.5 dark:border-white/10">
                                  <Globe
                                    className="size-3 shrink-0 opacity-80"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  <span className="text-[8px] font-bold uppercase tracking-wider opacity-90">
                                    {meta.labelMn}
                                  </span>
                                </div>
                                <span className="line-clamp-3 font-semibold">
                                  {seg.title}
                                </span>
                                {seg.subcategory ? (
                                  <span className="mt-0.5 block text-[9px] font-normal opacity-90">
                                    {seg.subcategory}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>

                <p
                  className={cn(
                    "mt-2 text-center text-[10px] leading-relaxed",
                    textDim,
                  )}
                >
                  @ Copyright 2026 TeamOne LLC. All rights reserved.
                </p>
              </div>
            </main>

            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-[inset_1px_0_0_0_rgba(63,63,70,0.5)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Building2 className="size-4" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Таны туслах
                </span>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setRightTab("list")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "list"
                      ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  )}
                >
                  Жагсаалт
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("about")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "about"
                      ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  )}
                >
                  Тайлбар
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4 dark:bg-zinc-950/60">
                {rightTab === "list" ? (
                  <div className="space-y-4">
                    <div className={cn(panelLight, "overflow-hidden p-0")}>
                      <div className="flex flex-col gap-0.5 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <PartyPopper className="size-4 text-sky-600 dark:text-sky-400" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Сургуулийн үйл явдал
                          </span>
                        </div>
                        <p className="pl-6 text-[9px] leading-snug text-zinc-500 dark:text-zinc-400">
                          Жилийн mock (2026) — энэ 7 хоногт давхцах эвент
                          (GraphQL түр унтраасан)
                        </p>
                      </div>
                      <div className="max-h-[280px] space-y-2 overflow-y-auto px-3 py-3">
                        {schoolEventsList.length === 0 ? (
                          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                            Энэ долоо хоногт mock эвенттай давхцахгүй байна —
                            долоо хоногийг шилжүүл.
                          </p>
                        ) : (
                          schoolEventsList.map((ev) => {
                            const meta =
                              SCHOOL_EVENT_TYPE_META[
                                String(ev.eventType) as SchoolEventType
                              ];
                            return (
                              <div
                                key={ev.id}
                                className={cn(
                                  "rounded-lg border px-2.5 py-2 text-left text-[11px] leading-snug",
                                  meta.cardClass,
                                )}
                              >
                                <p className="font-semibold">{ev.title}</p>
                                <p className="mt-0.5 text-[10px] opacity-90">
                                  {meta.labelMn}
                                  {ev.description ? ` · ${ev.description}` : ""}
                                </p>
                                <p className="mt-1 tabular-nums text-[10px] opacity-90">
                                  {format(
                                    parseISO(ev.startDate),
                                    "MMM d HH:mm",
                                    {
                                      locale: mn,
                                    },
                                  )}{" "}
                                  –{" "}
                                  {format(parseISO(ev.endDate), "MMM d HH:mm", {
                                    locale: mn,
                                  })}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className={cn(panelLight, "overflow-hidden p-0")}>
                      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                        <GraduationCap className="size-4 text-violet-600 dark:text-violet-400" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Багшаас оруулсан шалгалт
                        </span>
                      </div>
                      <div className="px-3 py-6 text-center">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Одоогоор жагсаалт хоосон
                        </p>
                        <p
                          className={cn(
                            "mx-auto mt-2 max-w-[220px] text-[11px]",
                            textDim,
                          )}
                        >
                          exam_schedules холбогдохоор энд гарна.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      panelLight,
                      "p-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300",
                    )}
                  >
                    <p>
                      Сургуулийн эвент нь{" "}
                      <strong className="font-semibold text-zinc-800 dark:text-zinc-100">
                        дөрвөн дэд давхарга
                      </strong>
                      : амралт/баяр (ягаан), захиргаа/хурал (шар), нөөцийн
                      түгжээ (саарал), deadline/академик (улбар шар). Нэг өнгөөр
                      бүгдийг харуулахгүй.{" "}
                      <strong className="font-semibold text-zinc-800 dark:text-zinc-100">
                        Даваа–нямын
                      </strong>{" "}
                      тор дээр эвент болон багш нарын{" "}
                      <strong className="font-semibold text-zinc-800 dark:text-zinc-100">
                        оруулсан шалгалт
                      </strong>{" "}
                      тусдаа давхаргаар сонгогдоно. Багшийн хуанли —{" "}
                      <Link
                        href="/ai-scheduler"
                        className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Багшийн хуваарь
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() =>
                    setRightTab((t) => (t === "list" ? "about" : "list"))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <ChevronRight
                    className={cn(
                      "size-4 transition-transform",
                      rightTab === "about" && "-rotate-90",
                    )}
                  />
                  {rightTab === "list" ? "Тайлбар руу" : "Жагсаалт руу"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
