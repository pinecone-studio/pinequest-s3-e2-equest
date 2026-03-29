"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  addDays,
  addMinutes,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { mn } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  Menu,
  PartyPopper,
  Square,
  Circle,
  Triangle,
} from "lucide-react";

const SCHEDULE_DAY_START = 8;
const SCHEDULE_DAY_END = 20;
const HOUR_COUNT = SCHEDULE_DAY_END - SCHEDULE_DAY_START;
const HOUR_PX = 40;
const GRID_BODY_MIN_H = HOUR_COUNT * HOUR_PX;

const DRAG_SNAP_MINUTES = 15;
const MIN_DRAG_PX = 10;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

function yPxToScheduleMinutes(yPx: number): number {
  const y = clamp(yPx, 0, GRID_BODY_MIN_H);
  const frac = y / GRID_BODY_MIN_H;
  const minsFloat = SCHEDULE_DAY_START * 60 + frac * HOUR_COUNT * 60;
  const snapped =
    Math.round(minsFloat / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
  return clamp(
    snapped,
    SCHEDULE_DAY_START * 60,
    SCHEDULE_DAY_END * 60,
  );
}

function dayWithMinutes(day: Date, minutesFromMidnight: number): Date {
  return addMinutes(startOfDay(day), minutesFromMidnight);
}

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40";
const textDim = "text-zinc-500";

function ReclaimLightBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-[#f4f5f7]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-15%,rgba(59,130,246,0.12),transparent_50%)]" />
    </div>
  );
}

type SchoolLayerId = "events" | "teacherExams";

const SCHOOL_LAYERS: {
  id: SchoolLayerId;
  label: string;
  role: string;
  swatch: string;
}[] = [
  {
    id: "events",
    label: "Сургуулийн эвент",
    role: "Sky / cyan — багшийн хуанлийн amber-аас тод ялгагдана",
    swatch: "bg-sky-500",
  },
  {
    id: "teacherExams",
    label: "Багшийн оруулсан шалгалт",
    role: "Emerald баталгаажсан, violet draft (тор дээр)",
    swatch: "bg-violet-500",
  },
];

export function SchoolEventScheduler() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  const [layerOn, setLayerOn] = useState<Record<SchoolLayerId, boolean>>({
    events: true,
    teacherExams: true,
  });
  const [rightTab, setRightTab] = useState<"list" | "about">("list");
  const [dragPreview, setDragPreview] = useState<{
    colIdx: number;
    topPx: number;
    heightPx: number;
  } | null>(null);
  const [preferredSlotRange, setPreferredSlotRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const dragSessionRef = useRef<{
    day: Date;
    colIdx: number;
    layer: HTMLDivElement;
    startY: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    if (!date) return;
    setPreferredSlotRange((prev) => {
      if (!prev) return null;
      if (!isSameDay(prev.start, date)) return null;
      return prev;
    });
  }, [date]);

  function toggleLayer(id: SchoolLayerId) {
    setLayerOn((p) => ({ ...p, [id]: !p[id] }));
  }

  const anchor = date ?? new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, "MMM d", { locale: mn })} – ${format(weekEnd, "MMM d, yyyy", { locale: mn })}`;

  const hourRows = Array.from(
    { length: HOUR_COUNT },
    (_, i) => SCHEDULE_DAY_START + i,
  );

  function shiftWeek(deltaWeeks: number) {
    setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
  }

  function handleSlotQuickPick(slotDay: Date, slotHour: number) {
    const h = clamp(
      slotHour,
      SCHEDULE_DAY_START,
      SCHEDULE_DAY_END - 1,
    );
    const startMin = h * 60;
    const endMin = startMin + 60;
    setDate(slotDay);
    setRightTab("list");
    setPreferredSlotRange({
      start: dayWithMinutes(slotDay, startMin),
      end: dayWithMinutes(slotDay, endMin),
    });
    toast.message("Цаг сонгогдлоо", {
      description: `${format(slotDay, "EEEE, MMM d", { locale: mn })} · ${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00`,
    });
  }

  function commitDragOrTap(
    slotDay: Date,
    startY: number,
    endY: number,
    wasDrag: boolean,
  ) {
    if (wasDrag) {
      let lo = yPxToScheduleMinutes(startY);
      let hi = yPxToScheduleMinutes(endY);
      if (hi < lo) [lo, hi] = [hi, lo];
      if (hi - lo < DRAG_SNAP_MINUTES) hi = lo + DRAG_SNAP_MINUTES;
      hi = Math.min(hi, SCHEDULE_DAY_END * 60);
      setDate(slotDay);
      setRightTab("list");
      const a = dayWithMinutes(slotDay, lo);
      const b = dayWithMinutes(slotDay, hi);
      setPreferredSlotRange({ start: a, end: b });
      toast.message("Завсар сонгогдлоо", {
        description: `${format(slotDay, "MMM d", { locale: mn })} · ${format(a, "HH:mm")}–${format(b, "HH:mm")}`,
      });
      return;
    }
    const frac = clamp(endY, 0, GRID_BODY_MIN_H) / GRID_BODY_MIN_H;
    const hourFloat = SCHEDULE_DAY_START + frac * HOUR_COUNT;
    const hour = clamp(
      Math.floor(hourFloat),
      SCHEDULE_DAY_START,
      SCHEDULE_DAY_END - 1,
    );
    handleSlotQuickPick(slotDay, hour);
  }

  function onDragLayerPointerDown(
    e: PointerEvent<HTMLDivElement>,
    slotDay: Date,
    colIdx: number,
  ) {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest("[data-school-skip-drag]")) return;
    const layer = e.currentTarget;
    const rect = layer.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, GRID_BODY_MIN_H);
    dragSessionRef.current = {
      day: slotDay,
      colIdx,
      layer,
      startY: y,
      pointerId: e.pointerId,
    };
    setDragPreview({ colIdx, topPx: y, heightPx: 0 });
    layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onDragLayerPointerMove(e: PointerEvent<HTMLDivElement>) {
    const s = dragSessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const rect = s.layer.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, GRID_BODY_MIN_H);
    const topPx = Math.min(s.startY, y);
    const heightPx = Math.max(Math.abs(y - s.startY), 1);
    setDragPreview({ colIdx: s.colIdx, topPx, heightPx });
  }

  function onDragLayerPointerUp(e: PointerEvent<HTMLDivElement>) {
    const s = dragSessionRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const rect = s.layer.getBoundingClientRect();
    const endY = clamp(e.clientY - rect.top, 0, GRID_BODY_MIN_H);
    if (s.layer.hasPointerCapture(e.pointerId)) {
      s.layer.releasePointerCapture(e.pointerId);
    }
    dragSessionRef.current = null;
    setDragPreview(null);
    const delta = Math.abs(endY - s.startY);
    const wasDrag = delta >= MIN_DRAG_PX;
    commitDragOrTap(s.day, s.startY, endY, wasDrag);
  }

  const selectedLabel = date
    ? format(date, "EEEE, MMMM d", { locale: mn })
    : "—";

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-[#f4f5f7] font-sans text-zinc-900 antialiased",
        "selection:bg-blue-500/20 selection:text-zinc-900",
      )}
    >
      <ReclaimLightBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:hidden"
              aria-expanded={calendarSidebarOpen}
              aria-controls="school-scheduler-sidebar"
              onClick={() => setCalendarSidebarOpen((o) => !o)}
            >
              <span className="sr-only">Хуанлын панел нээх, хаах</span>
              <Menu className="size-5" strokeWidth={1.5} aria-hidden />
            </button>
            <div className="min-w-0">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <Badge className="rounded-md border-0 bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Building2 className="mr-1 inline size-3" />
                  Сургууль
                </Badge>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <CalendarDays
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                  Сургуулийн хуанли
                </h1>
              </div>
              <p className={cn("truncate text-xs", textDim)}>
                Нийтлэг үйл явдал ·{" "}
                {format(anchor, "yyyy MMMM", { locale: mn })}
              </p>
            </div>
          </div>
          <Link
            href="/ai-scheduler-personal"
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            Багшийн хуваарь
          </Link>
        </header>

        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
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

          <aside
            id="school-scheduler-sidebar"
            className={cn(
              "shrink-0 overflow-hidden border-zinc-200/90 bg-white/50 transition-[width] duration-200 ease-out xl:bg-white/40",
              calendarSidebarOpen
                ? "w-full max-w-[min(100vw-68px,280px)] border-r sm:max-w-[272px]"
                : "w-14 border-r",
            )}
          >
            {calendarSidebarOpen ? (
              <div className="flex h-full w-full min-w-[min(100vw-68px,272px)] max-w-[272px] flex-col gap-4 overflow-y-auto p-4">
                <div className={cn(panelLight, "p-3")}>
                  <div className="mb-2 space-y-0.5 px-1">
                    <p className="text-xs font-semibold text-zinc-900">
                      Сургуулийн хуанли
                    </p>
                    <p className="text-[10px] font-medium text-zinc-500">
                      Өдөр сонгох
                    </p>
                  </div>
                  <p className="mb-2 px-1 text-[10px] text-zinc-500">
                    {selectedLabel}
                  </p>
                  <div
                    className={cn(
                      "flex justify-center rounded-xl border border-zinc-100 bg-zinc-50/90 p-1",
                      "[&_button[data-selected-single=true]]:rounded-full! [&_button[data-selected-single=true]]:bg-blue-600! [&_button[data-selected-single=true]]:text-white!",
                      "[&_button[data-selected-single=true]]:shadow-md [&_button[data-selected-single=true]]:shadow-blue-500/25",
                    )}
                    aria-label="Өдөр сонгох хуанли"
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      locale={mn}
                      buttonVariant="ghost"
                      className="text-zinc-800 [--cell-size:2rem] scale-[0.92] origin-top"
                      classNames={{
                        caption_label:
                          "text-[13px] font-semibold text-zinc-900",
                        button_previous:
                          "rounded-lg border border-zinc-200 bg-white text-zinc-700 size-8 hover:bg-zinc-50",
                        button_next:
                          "rounded-lg border border-zinc-200 bg-white text-zinc-700 size-8 hover:bg-zinc-50",
                        weekday:
                          "text-[10px] font-medium uppercase text-zinc-500",
                        day: "text-zinc-700",
                        today:
                          "text-blue-700 [&:not([data-selected])_button]:ring-2 [&:not([data-selected])_button]:ring-blue-400/50 [&:not([data-selected])_button]:rounded-full",
                        outside: "text-zinc-400 opacity-60",
                        disabled: "opacity-30",
                      }}
                    />
                  </div>
                </div>

                <div className={cn(panelLight, "divide-y divide-zinc-100")}>
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Харагдац
                  </p>
                  {SCHOOL_LAYERS.map((layer) => {
                    const on = layerOn[layer.id];
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleLayer(layer.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          on
                            ? "bg-blue-50/80 text-zinc-900"
                            : "text-zinc-500 hover:bg-zinc-50",
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
                          <span className="block truncate text-[10px] text-zinc-500">
                            {layer.role}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            on
                              ? "bg-blue-100 text-blue-800"
                              : "bg-zinc-100 text-zinc-500",
                          )}
                        >
                          {on ? "Идэвхтэй" : "Нуугдсан"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] flex-col items-center gap-3 border-zinc-200/80 py-4">
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-sm"
                  title="Сургуулийн хуанли"
                  aria-hidden
                >
                  <CalendarDays className="size-5" strokeWidth={1.75} />
                </span>
                <button
                  type="button"
                  onClick={() => setCalendarSidebarOpen(true)}
                  className="flex size-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
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
            <main className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-200/90 p-3 sm:p-4 xl:rounded-l-3xl xl:border-r xl:bg-zinc-50/30">
              <div
                className={cn(
                  panelLight,
                  "flex min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
                )}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Энэ 7 хоног
                    </p>
                    <p className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                      {weekRangeLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5">
                    <button
                      type="button"
                      onClick={() => shiftWeek(-1)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                      aria-label="Өмнөх долоо хоног"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(new Date())}
                      className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                    >
                      Өнөөдөр
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftWeek(1)}
                      className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                      aria-label="Дараагийн долоо хоног"
                    >
                      <ChevronRight className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 border-b border-zinc-200 pb-2 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
                  <div
                    className="text-[10px] font-medium uppercase tracking-wide text-zinc-400"
                    aria-hidden
                  >
                    Цаг
                  </div>
                  {weekDays.map((d) => {
                    const isSel = isSameDay(d, anchor);
                    return (
                      <div key={d.toISOString()} className="text-center">
                        <div
                          className={cn(
                            "mx-auto flex size-8 items-center justify-center rounded-full text-[11px] font-medium sm:size-9 sm:text-xs",
                            isSel
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                              : "border border-zinc-200 bg-zinc-100 text-zinc-500",
                          )}
                        >
                          {format(d, "EEEEE", { locale: mn })}
                        </div>
                        <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:mt-1 sm:text-[10px]">
                          {format(d, "EEE", { locale: mn })}
                        </p>
                        <p className="text-xs font-semibold text-zinc-800 sm:text-sm">
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
                      {hourRows.map((hour) => (
                        <div
                          key={hour}
                          className="flex items-start justify-end border-t border-zinc-100 pr-1 pt-0.5 text-[10px] tabular-nums text-zinc-400 first:border-t-0 first:pt-0 sm:pr-1.5 sm:text-[11px]"
                          style={{ height: HOUR_PX }}
                        >
                          {String(hour).padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>

                    {weekDays.map((d, colIdx) => (
                      <div
                        key={`col-${colIdx}`}
                        className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/80"
                        style={{ minHeight: GRID_BODY_MIN_H }}
                      >
                        <div
                          className="pointer-events-none absolute inset-0 rounded-[inherit]"
                          style={{
                            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${HOUR_PX - 1}px, rgb(228 228 231 / 0.9) ${HOUR_PX - 1}px, rgb(228 228 231 / 0.9) ${HOUR_PX}px)`,
                          }}
                          aria-hidden
                        />
                        {dragPreview?.colIdx === colIdx ? (
                          <div
                            className="pointer-events-none absolute right-1 left-1 z-[7] rounded-md border border-sky-600/45 bg-sky-400/25 shadow-sm ring-1 ring-sky-400/30"
                            style={{
                              top: dragPreview.topPx,
                              height: Math.max(dragPreview.heightPx, 4),
                            }}
                            aria-hidden
                          />
                        ) : null}
                        {layerOn.events && colIdx === 4 ? (
                          <div
                            className="pointer-events-none absolute left-0.5 right-0.5 top-[8%] z-[5] rounded-xl border-2 border-solid border-sky-500/90 bg-linear-to-b from-sky-50 to-cyan-50/95 px-2 pb-2 pt-1.5 text-[10px] font-semibold leading-tight text-sky-950 shadow-md shadow-sky-500/15"
                            style={{ height: "42%" }}
                          >
                            <div className="mb-1 flex items-center gap-1 border-b border-sky-200/80 pb-1">
                              <Globe
                                className="size-3 shrink-0 text-sky-700"
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span className="text-[8px] font-bold uppercase tracking-wider text-sky-800">
                                Global
                              </span>
                            </div>
                            Сургуулийн арга хэмжээ
                            <span className="mt-1 block font-normal text-sky-900/90">
                              Нийтийн эвент · бүх анги
                            </span>
                          </div>
                        ) : null}
                        {layerOn.events && colIdx === 3 ? (
                          <div
                            className="pointer-events-none absolute left-1 right-1 top-[34%] z-[5] flex items-start gap-1.5 rounded-xl bg-cyan-50/90 px-2 py-1.5 shadow-sm ring-1 ring-cyan-200/50"
                            style={{ height: "44px" }}
                            title="Тэмдэглэл — жижиг нийтийн сануулга"
                          >
                            <span
                              className="mt-1 size-2 shrink-0 rounded-full bg-cyan-500 shadow-sm ring-2 ring-cyan-200/80"
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center gap-0.5">
                                <Globe
                                  className="size-2.5 shrink-0 text-cyan-700"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                <span className="text-[7px] font-bold uppercase text-cyan-800">
                                  Global
                                </span>
                              </div>
                              <p className="text-[10px] font-medium text-sky-950">
                                Нийтийн завсарлага
                              </p>
                              <span className="mt-0.5 block text-[9px] font-normal text-sky-900/85">
                                Сургууль · бүх багш
                              </span>
                            </div>
                          </div>
                        ) : null}
                        {layerOn.teacherExams && colIdx === 0 ? (
                          <div
                            className="pointer-events-none absolute left-1 right-1 top-[22%] z-[5] rounded-xl border-2 border-dashed border-violet-500/60 bg-violet-500/20 px-2 py-1.5 text-[10px] font-semibold text-violet-950 shadow-sm"
                            style={{ minHeight: "48px", opacity: 0.5 }}
                          >
                            Санал (draft)
                            <span className="mt-0.5 block font-medium text-violet-900/90">
                              Жишээ · Даваа
                            </span>
                          </div>
                        ) : null}
                        {layerOn.teacherExams && colIdx === 2 ? (
                          <div
                            className="pointer-events-none absolute left-1 right-1 top-[18%] z-[5] rounded-xl border-2 border-solid border-emerald-600 bg-emerald-50 px-2 py-1.5 text-[10px] font-semibold text-emerald-950 shadow-md"
                            style={{ minHeight: "56px" }}
                          >
                            Баталгаажсан шалгалт
                            <span className="mt-0.5 block font-medium text-emerald-800">
                              Жишээ · Лхагва · 10А
                            </span>
                          </div>
                        ) : null}
                        {layerOn.teacherExams && colIdx === 5 ? (
                          <div
                            className="pointer-events-none absolute left-1 right-1 top-[40%] z-[5] rounded-xl border-2 border-dashed border-violet-500/55 bg-violet-500/15 px-2 py-1.5 text-[10px] font-semibold text-violet-950"
                            style={{ height: "44px", opacity: 0.5 }}
                          >
                            Санал (draft)
                            <span className="mt-0.5 block font-medium text-violet-900/85">
                              Бямба
                            </span>
                          </div>
                        ) : null}
                        <div
                          className="absolute inset-0 z-[6] cursor-crosshair touch-none rounded-[inherit] select-none"
                          style={{ touchAction: "none" }}
                          onPointerDown={(e) =>
                            onDragLayerPointerDown(e, d, colIdx)
                          }
                          onPointerMove={onDragLayerPointerMove}
                          onPointerUp={onDragLayerPointerUp}
                          onPointerCancel={onDragLayerPointerUp}
                          aria-label={`${format(d, "EEEE", { locale: mn })} — чирж эсвэл дарж цаг сонгоно`}
                        />
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
                  Өдрийн багана дээр чирж эсвэл дарж цаг сонгоно (15 мин наагуур). Сургуулийн эвент —
                  sky/cyan (багшийн хуанлид amber). Хүрээ: solid / dashed. GraphQL-ээр өгөгдөл татна.
                </p>
              </div>
            </main>

            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Building2 className="size-4" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900">
                  Сургуулийн мэдээлэл
                </span>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => setRightTab("list")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "list"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
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
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  Тайлбар
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4">
                {rightTab === "list" ? (
                  <div className="space-y-4">
                    {preferredSlotRange &&
                    date &&
                    isSameDay(preferredSlotRange.start, date) ? (
                      <div className="rounded-xl border border-sky-200/90 bg-sky-50/80 px-3 py-2.5 text-xs text-sky-950 shadow-sm">
                        <p className="font-semibold text-sky-900">
                          Сонгосон завсар (жишээ)
                        </p>
                        <p className="mt-1 font-medium">
                          {format(date, "EEEE, MMM d", { locale: mn })}
                        </p>
                        <p className="mt-0.5 tabular-nums text-sky-900/90">
                          {format(preferredSlotRange.start, "HH:mm")} –{" "}
                          {format(preferredSlotRange.end, "HH:mm")}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-sky-800/85">
                          Эвент эсвэл шалгалт нэмэх form холбогдохоор энд ашиглана.
                        </p>
                      </div>
                    ) : null}
                    <div className={cn(panelLight, "overflow-hidden p-0")}>
                      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
                        <PartyPopper className="size-4 text-sky-600" />
                        <span className="text-xs font-semibold text-zinc-900">
                          Сургуулийн үйл явдал
                        </span>
                      </div>
                      <div className="px-3 py-6 text-center">
                        <p className="text-xs font-medium text-zinc-700">
                          Одоогоор жагсаалт хоосон
                        </p>
                        <p
                          className={cn(
                            "mx-auto mt-2 max-w-[220px] text-[11px]",
                            textDim,
                          )}
                        >
                          School events GraphQL ирэхэд энд гарна.
                        </p>
                      </div>
                    </div>
                    <div className={cn(panelLight, "overflow-hidden p-0")}>
                      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
                        <GraduationCap className="size-4 text-violet-600" />
                        <span className="text-xs font-semibold text-zinc-900">
                          Багшаас оруулсан шалгалт
                        </span>
                      </div>
                      <div className="px-3 py-6 text-center">
                        <p className="text-xs font-medium text-zinc-700">
                          Одоогоор жагсаалт хоосон
                        </p>
                        <p
                          className={cn(
                            "mx-auto mt-2 max-w-[220px] text-[11px]",
                            textDim,
                          )}
                        >
                          Баталсан/товлосон шалгалтын хуваарь энд холбогдоно.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      panelLight,
                      "p-4 text-xs leading-relaxed text-zinc-600",
                    )}
                  >
                    <p>
                      <strong className="font-semibold text-zinc-800">
                        Даваа–нямын
                      </strong>{" "}
                      нийтлэг тор дээр сургуулийн{" "}
                      <strong className="font-semibold text-zinc-800">
                        эвент
                      </strong>{" "}
                      болон багш нарын{" "}
                      <strong className="font-semibold text-zinc-800">
                        оруулсан шалгалтын хуваарь
                      </strong>{" "}
                      давхаргаар сонгож харагдана. Багшийн AI хуваарь —{" "}
                      <Link
                        href="/ai-scheduler-personal"
                        className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                      >
                        Багшийн хуваарь
                      </Link>{" "}
                      — тэнд мөн чирж цаг сонгох боломжтой.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 bg-white p-3">
                <button
                  type="button"
                  onClick={() =>
                    setRightTab((t) => (t === "list" ? "about" : "list"))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
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
