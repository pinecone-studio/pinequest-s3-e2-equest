"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  addDays,
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
import type { SchoolEventLayerKind } from "@/types/schoolCalendar";
import { cn } from "@/lib/utils";
import {
  SCHOOL_EVENT_LAYER_ORDER,
  SCHOOL_EVENT_LAYER_UI,
  constraintLabelMn,
} from "@/constants/calendarLayerTaxonomy";
import { REAL_WORLD_SCHOOL_CALENDAR_MOCK } from "@/constants/schoolCalendarRealWorldMock";
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

type SchoolSidebarLayerKey = SchoolEventLayerKind | "teacherExams";

function defaultSchoolLayerVisibility(): Record<
  SchoolSidebarLayerKey,
  boolean
> {
  return {
    HOLIDAY: true,
    ADMIN_FIXED: true,
    RESOURCE_LOCK: true,
    ACADEMIC_MILESTONE: true,
    teacherExams: true,
  };
}

type DaySegment = {
  eventId: string;
  title: string;
  layerKind: SchoolEventLayerKind;
  subcategory?: string | null;
  colIdx: number;
  allDay: boolean;
  topPct: number;
  heightPct: number;
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
};

export function SchoolEventScheduler({
  shellMode = false,
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
  const weekRangeLabel = `${format(weekStart, "MMM d", { locale: mn })} – ${format(weekEnd, "MMM d, yyyy", { locale: mn })}`;

  /** D1 хоосон үед GraphQL `schoolCalendarEvents` түр хаасан — зөвхөн mock. Дахин асаахад нэгтгэнэ. */
  const mergedSchoolCalendarEvents = useMemo(
    () => REAL_WORLD_SCHOOL_CALENDAR_MOCK,
    [],
  );

  const schoolEventsList = useMemo(() => {
    const ws = startOfDay(weekStart);
    const we = endOfDay(weekEnd);
    return mergedSchoolCalendarEvents
      .filter((ev) => {
        const s = parseISO(ev.startAt);
        const e = parseISO(ev.endAt);
        return s.getTime() < we.getTime() && e.getTime() > ws.getTime();
      })
      .sort(
        (a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime(),
      );
  }, [mergedSchoolCalendarEvents, weekStart, weekEnd]);

  const eventSegments = useMemo((): DaySegment[] => {
    const events = mergedSchoolCalendarEvents;
    const out: DaySegment[] = [];
    for (const ev of events) {
      const start = parseISO(ev.startAt);
      const end = parseISO(ev.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        continue;

      weekDays.forEach((day, colIdx) => {
        const seg = segmentForDay(day, start, end);
        if (!seg) return;
        if (ev.allDay) {
          out.push({
            eventId: ev.id,
            title: ev.title,
            layerKind: ev.layerKind,
            subcategory: ev.subcategory,
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
          eventId: ev.id,
          title: ev.title,
          layerKind: ev.layerKind,
          subcategory: ev.subcategory,
          colIdx,
          allDay: false,
          topPct: slotTopPercent(sh, sm),
          heightPct: blockHeightPercent(sh, sm, eh, em),
        });
      });
    }
    return out;
  }, [mergedSchoolCalendarEvents, weekDays]);

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
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <Badge className="rounded-md border-0 bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-blue-500">
                  <Building2 className="mr-1 inline size-3" />
                  Сургууль
                </Badge>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                  <CalendarClock
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                  Сургуулийн хуанли
                </h1>
              </div>
              <p className={cn("truncate text-xs", textDim)}>
                Нийтлэг үйл явдал ·{" "}
                {format(anchor, "yyyy MMMM", { locale: mn })}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <SchedulerAppearanceMenu />
            <Link
              href={shellMode ? "/ai-scheduler" : "/ai-scheduler-teacher"}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Багшийн хуваарь
            </Link>
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
                      Сургуулийн хуанли
                    </p>
                  </div>
                  <div className="flex justify-center" aria-label="Өдөр сонгох хуанли">
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
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Харагдац
                  </p>
                  <div className="px-3 pt-1 pb-0.5">
                    <p className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                      Сургуулийн эвент
                    </p>
                    <p className="mt-0.5 text-[9px] leading-snug text-zinc-500 dark:text-zinc-500">
                      Дэд давхарга — ачааллын эрэмбэ (өөр өнгө)
                    </p>
                  </div>
                  {SCHOOL_EVENT_LAYER_ORDER.map((kind) => {
                    const meta = SCHOOL_EVENT_LAYER_UI[kind];
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
                            "size-2.5 shrink-0 rounded-sm",
                            meta.swatch,
                            !on && "opacity-35",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {meta.labelMn}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                            {meta.examplesMn}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-[9px] text-zinc-400 dark:text-zinc-500"
                            title={meta.impactMn}
                          >
                            {constraintLabelMn(meta.constraint)} ·{" "}
                            {meta.impactMn}
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
                  {(() => {
                    const layer = {
                      id: "teacherExams" as const,
                      label: "Багшийн оруулсан шалгалт",
                      role: "Ирээдүйд exam_schedules / баталгаажсан хуваарь",
                      swatch: "bg-violet-500",
                    };
                    const on = layerOn.teacherExams;
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleLayer("teacherExams")}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          on
                            ? "bg-blue-50/80 text-zinc-900 dark:bg-blue-950/40 dark:text-zinc-100"
                            : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-sm",
                            layer.swatch,
                            !on && "opacity-35",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {layer.label}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                            {layer.role}
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
                  })()}
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
                              className="calendar-red-zone-stripes pointer-events-auto absolute inset-x-0 z-1 cursor-help border-y border-rose-300/35 dark:border-rose-800/45"
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
                              seg.colIdx === colIdx && layerOn[seg.layerKind],
                          )
                          .map((seg) => {
                            const meta = SCHOOL_EVENT_LAYER_UI[seg.layerKind];
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
                        {layerOn.teacherExams ? (
                          <div
                            className="pointer-events-none absolute bottom-2 left-1 right-1 z-4 rounded-lg border border-dashed border-violet-400/60 bg-violet-500/10 px-2 py-1 text-center text-[9px] font-medium text-violet-900/80 dark:border-violet-500/50 dark:bg-violet-950/30 dark:text-violet-200"
                            data-school-skip-drag
                          >
                            Багшийн шалгалт — ирээдүйд GraphQL
                          </div>
                        ) : null}
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
                  Зөвхөн mock:{" "}
                  <code className="text-zinc-600 dark:text-zinc-300">
                    schoolCalendarRealWorldMock.ts
                  </code>{" "}
                  · D1 бэлэн болоход GraphQL query дахин нээнэ.
                </p>
              </div>
            </main>

            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-[inset_1px_0_0_0_rgba(63,63,70,0.5)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/80">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Building2 className="size-4" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Сургуулийн мэдээлэл
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
                            const meta = SCHOOL_EVENT_LAYER_UI[ev.layerKind];
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
                                  {ev.subcategory ? ` · ${ev.subcategory}` : ""}
                                </p>
                                <p className="mt-1 tabular-nums text-[10px] opacity-90">
                                  {format(parseISO(ev.startAt), "MMM d HH:mm", {
                                    locale: mn,
                                  })}{" "}
                                  –{" "}
                                  {format(parseISO(ev.endAt), "MMM d HH:mm", {
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
                        href="/ai-scheduler-teacher"
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
