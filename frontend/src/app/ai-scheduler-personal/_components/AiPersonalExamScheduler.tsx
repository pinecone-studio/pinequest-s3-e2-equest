"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  addDays,
  format,
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
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  PanelRight,
  Play,
  Target,
  Square,
  Circle,
  Triangle,
} from "lucide-react";

/** Тор дээрх цагийн хүрээ (08:00–20:00). */
const SCHEDULE_DAY_START = 8;
const SCHEDULE_DAY_END = 20;
const HOUR_COUNT = SCHEDULE_DAY_END - SCHEDULE_DAY_START;
const HOUR_PX = 40;
const GRID_BODY_MIN_H = HOUR_COUNT * HOUR_PX;

const DEFAULT_TEST_ID = "a1000000-0000-4000-8000-000000000001";
const DEFAULT_CLASS_ID = "10A";

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40";
const textDim = "text-zinc-500";

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
 * Дөрвөн давхаргын стратеги (Pro): үндсэн → эвент → хувийн (нууц) → шалгалт (AI).
 * Blocker төрөл + нууцлал AI-ийн scheduling-д ойлголтын загвар болно.
 */
type CalendarLayerId = "primary" | "school" | "personal" | "exam";

const CALENDAR_LAYERS: {
  id: CalendarLayerId;
  label: string;
  role: string;
  swatch: string;
}[] = [
  {
    id: "primary",
    label: "Үндсэн хуваарь",
    role: "Static Blocker — тойрч гарна · бүх хүнд харагдана",
    swatch: "bg-emerald-500",
  },
  {
    id: "school",
    label: "Сургуулийн эвент",
    role: "Global Blocker — цаг хаана · бүх хүнд харагдана",
    swatch: "bg-rose-500",
  },
  {
    id: "personal",
    label: "Хувийн хуанли",
    role: "Invisible Blocker — зөвхөн багш өөрөө харна",
    swatch: "bg-slate-500",
  },
  {
    id: "exam",
    label: "Шалгалтын хуанли",
    role: "AI идэвхтэй — багш + сурагч харна, засварлана",
    swatch: "bg-blue-500",
  },
];

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

export type AiPersonalExamSchedulerProps = {
  /** Үнэн бол гаднах hub rail нуугдана (зөвхөн /ai-scheduler дээр). */
  shellMode?: boolean;
};

export function AiPersonalExamScheduler({
  shellMode = false,
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
    school: true,
    personal: true,
    exam: true,
  });
  /** Хуанли + давхаргын зүүн панел нээгдсэн эсэх (rail-аас сэлгэнэ). */
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  const toastKeyRef = useRef<string>("");

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
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const scheduleStart = liveSchedule
    ? parseStart(liveSchedule.startTime)
    : null;
  const suggested = liveSchedule?.status === "suggested";
  const showJob =
    liveSchedule && liveSchedule.id === lastQueuedExamId ? liveSchedule : null;

  /** 08:00–20:00 хүрээнд блокын байрлал (%) */
  function blockTopPercent(d: Date) {
    const h = d.getHours() + d.getMinutes() / 60;
    const t = Math.min(Math.max((h - SCHEDULE_DAY_START) / HOUR_COUNT, 0), 1);
    return t * 100;
  }

  const hourRows = Array.from(
    { length: HOUR_COUNT },
    (_, i) => SCHEDULE_DAY_START + i,
  );

  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, "MMM d", { locale: mn })} – ${format(weekEnd, "MMM d, yyyy", { locale: mn })}`;

  function shiftWeek(deltaWeeks: number) {
    setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
  }

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-[#f4f5f7] font-sans text-zinc-900 antialiased",
        "selection:bg-blue-500/20 selection:text-zinc-900",
      )}
    >
      <ReclaimLightBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Дээд мөр */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {shellMode ? (
              <>
                <button
                  type="button"
                  className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:flex"
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
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:hidden"
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
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 xl:hidden"
                aria-expanded={calendarSidebarOpen}
                aria-controls="scheduler-calendar-sidebar"
                onClick={() => setCalendarSidebarOpen((o) => !o)}
              >
                <span className="sr-only">Хуанлын панел нээх, хаах</span>
                <Menu className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80">
                <CalendarClock className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                  Багшийн хуваарь
                </h1>
                <p className={cn("truncate text-xs", textDim)}>
                  {format(anchor, "yyyy MMMM", { locale: mn })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pollExamId ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm">
                <Loader2 className="size-3.5 animate-spin text-blue-600" />
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
                  <Square className="size-2 fill-rose-400 text-rose-400" />
                  <Circle className="size-2 fill-sky-400 text-sky-400" />
                  <Triangle className="size-2 fill-amber-400 text-amber-400" />
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
                  title="Багшийн хувийн хуваарь"
                  aria-current="page"
                  aria-label="Багшийн хувийн хуваарь"
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
              "shrink-0 overflow-hidden border-zinc-200/90 bg-white/50 transition-[width] duration-200 ease-out xl:bg-white/40",
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
                  <p className="text-xs font-semibold text-zinc-900">
                    Календарь
                  </p>
                </div>
                <div
                  className={cn(
                    "flex justify-center rounded-xl border border-zinc-100 bg-zinc-50/90 p-1",
                    "[&_button[data-selected-single=true]]:rounded-full! [&_button[data-selected-single=true]]:bg-blue-600! [&_button[data-selected-single=true]]:text-white!",
                    "[&_button[data-selected-single=true]]:shadow-md [&_button[data-selected-single=true]]:shadow-blue-500/25",
                  )}
                >
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={mn}
                    buttonVariant="ghost"
                    className="text-zinc-800 [--cell-size:2rem] scale-[0.92] origin-top"
                    classNames={{
                      caption_label: "text-[13px] font-semibold text-zinc-900",
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
                <div className="px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Давхарга · Pro (4)
                  </p>
                  <p className="mt-1 text-[9px] leading-snug text-zinc-400">
                    Үндсэн, эвент, хувийн (нууц), шалгалт — blocker + нууцлал өөр
                  </p>
                </div>
                {CALENDAR_LAYERS.map((layer) => {
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
                        <span className="line-clamp-2 text-[10px] text-zinc-500">
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
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
            {/* Төв: цагийн багана + 7 хоногийн тор */}
            <main className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-200/90 p-3 sm:p-4 xl:rounded-l-3xl xl:border-r xl:bg-zinc-50/30">
              <div
                className={cn(
                  panelLight,
                  "flex h-full min-h-[440px] flex-col overflow-hidden p-3 xl:rounded-l-3xl xl:shadow-md",
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

                <div className="mb-3 rounded-xl border border-emerald-100/90 bg-linear-to-r from-emerald-50/90 to-white px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <Target className="size-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900">
                          Фокус цаг (жишээ)
                        </p>
                        <p className="text-[10px] leading-snug text-zinc-500">
                          Reclaim-ийн Focus Time шиг долоо хоногийн зорилт —
                          ирээдүйд бодит өгөгдөл холбоно.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-[10px] font-semibold text-emerald-700">
                      6ц / 10ц
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100/80"
                    role="progressbar"
                    aria-valuenow={60}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Фокус цагийн явц (жишээ)"
                  >
                    <div className="h-full w-[60%] rounded-full bg-emerald-500" />
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-0 border-b border-zinc-200 pb-2 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
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

                <div className="relative min-h-0 flex-1">
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

                    {weekDays.map((d, colIdx) => {
                      const sameDay =
                        scheduleStart && isSameDay(scheduleStart, d);
                      const top = scheduleStart
                        ? blockTopPercent(scheduleStart)
                        : 28;

                      return (
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
                          {layerOn.school && colIdx === 4 ? (
                            <div
                              className="absolute left-0.5 right-0.5 top-[8%] z-1 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50 px-2 py-2 text-[10px] font-semibold leading-tight text-rose-900 shadow-sm"
                              style={{ height: "42%" }}
                            >
                              Сургуулийн арга хэмжээ
                              <span className="mt-1 block font-normal text-rose-700">
                                Global Blocker · бүх анги · цаг хаагч
                              </span>
                            </div>
                          ) : null}

                          {layerOn.primary && colIdx === 0 ? (
                            <div
                              className="absolute left-1 right-1 top-[8%] rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-900 shadow-sm"
                              style={{ height: "52px" }}
                            >
                              Математик · 10А
                              <span className="mt-0.5 block font-normal text-emerald-700">
                                Static Blocker · үндсэн хичээл
                              </span>
                            </div>
                          ) : null}
                          {layerOn.primary && colIdx === 1 ? (
                            <div
                              className="absolute left-1 right-1 top-[22%] rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-900 shadow-sm"
                              style={{ height: "48px" }}
                            >
                              Физик · 10А
                            </div>
                          ) : null}
                          {layerOn.primary && colIdx === 5 ? (
                            <div
                              className="absolute left-1 right-1 top-[18%] rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-900 shadow-sm"
                              style={{ height: "48px" }}
                            >
                              Түүх · 10А
                            </div>
                          ) : null}
                          {layerOn.personal && colIdx === 6 ? (
                            <div
                              className="absolute left-1 right-1 top-[48%] z-[1] rounded-xl border border-slate-300/80 bg-slate-100/95 px-2 py-1.5 text-[10px] text-slate-800 shadow-sm ring-1 ring-slate-200/70"
                              style={{ minHeight: "40px" }}
                              title="Зөвхөн багшид харагдана"
                            >
                              <span className="font-medium">Хувийн · бэлтгэл</span>
                              <span className="mt-0.5 block text-[9px] font-normal text-slate-500">
                                Invisible Blocker
                              </span>
                            </div>
                          ) : null}

                          {layerOn.exam && suggested && colIdx === 2 ? (
                            <>
                              <div
                                className="absolute left-0.5 right-0.5 z-10 w-[calc(100%-4px)] -rotate-2 rounded-xl border-2 border-blue-400/60 bg-blue-600 px-2 py-2 text-[10px] font-semibold leading-tight text-white shadow-xl shadow-blue-600/40"
                                style={{ top: "18%", minHeight: "56px" }}
                              >
                                AI санал
                                <span className="mt-0.5 block font-normal opacity-90">
                                  Шалгалт · идэвхтэй засвар
                                </span>
                              </div>
                              <svg
                                className="pointer-events-none absolute left-[40%] top-[32%] z-5 h-16 w-24 text-amber-600"
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
                                className="absolute left-1 right-1 top-[58%] rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/90 px-2 py-1.5 text-center text-[9px] font-medium text-amber-900"
                                style={{ height: "44px" }}
                              >
                                Сул цонх
                              </div>
                            </>
                          ) : null}

                          {layerOn.exam &&
                          showJob &&
                          sameDay &&
                          !suggested &&
                          showJob.status !== "pending" ? (
                            <div
                              className={cn(
                                "absolute left-1 right-1 rounded-xl border px-2 py-1.5 text-[10px] font-medium leading-tight shadow-sm",
                                showJob.status === "confirmed" &&
                                  "border-emerald-200 bg-emerald-50 text-emerald-900",
                                showJob.status === "failed" &&
                                  "border-red-200 bg-red-50 text-red-900",
                              )}
                              style={{
                                top: `${Math.min(top, 78)}%`,
                                minHeight: "48px",
                              }}
                            >
                              {showJob.status === "confirmed"
                                ? "Баталсан шалгалт"
                                : "Алдаа"}
                            </div>
                          ) : null}

                          {layerOn.exam &&
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
                  Цаг {SCHEDULE_DAY_START}:00–{SCHEDULE_DAY_END}:00. Дөрвөн давхарга:
                  ногоон үндсэн (static), улаан эвент (global), саарал хувийн
                  (invisible), цэнхэр шалгалт (AI). Жишээ + job; бүрэн sync биш.
                </p>
              </div>
            </main>

            {/* Баруун: AI панел (light) */}
            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3">
                <div className="flex items-center gap-1 text-blue-600">
                  <Square className="size-2.5 fill-current" />
                  <Circle className="size-2 fill-current" />
                  <Triangle className="size-2.5 fill-current" />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900">
                  PineQuest AI
                </span>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2">
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

              <div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4">
                {rightTab === "form" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="scheduler-test-id"
                        className="text-xs text-zinc-600"
                      >
                        testId
                      </Label>
                      <Input
                        id="scheduler-test-id"
                        value={testId}
                        onChange={(e) => setTestId(e.target.value)}
                        className="rounded-xl border-zinc-200 bg-white font-mono text-xs text-zinc-900 shadow-sm"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="scheduler-class-id"
                        className="text-xs text-zinc-600"
                      >
                        classId
                      </Label>
                      <Input
                        id="scheduler-class-id"
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                        placeholder="10A"
                        className="rounded-xl border-zinc-200 bg-white font-mono text-sm text-zinc-900 shadow-sm"
                        autoComplete="off"
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={queueLoading}
                      onClick={() => void handleQueueSchedule()}
                      className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
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
                      <p className="break-all font-mono text-[10px] text-zinc-500">
                        {lastQueuedExamId}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pollExamId ? (
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-sm">
                        <Loader2 className="size-3.5 animate-spin text-blue-600" />
                        getAiExamSchedule…
                      </div>
                    ) : null}

                    {showJob ? (
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Төлөв</span>
                          <Badge
                            variant="outline"
                            className="border-zinc-300 font-mono text-[10px] text-zinc-700"
                          >
                            {showJob.status}
                          </Badge>
                        </div>
                        <p className="font-mono text-[11px] text-zinc-600">
                          {showJob.startTime}
                        </p>
                        {showJob.aiReasoning ? (
                          <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                            {showJob.aiReasoning}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-8 text-center text-xs text-zinc-500 shadow-sm">
                        <PanelRight className="mx-auto mb-2 size-8 text-zinc-300" />
                        Эхлээд «Тохиргоо»-оос тооцоолох товч дарна уу.
                      </div>
                    )}

                    {showJob?.status === "suggested" &&
                    showJob.aiVariants?.length ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Сонгох
                        </p>
                        {showJob.aiVariants.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-2 shadow-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900">
                                {v.label}
                              </p>
                              <p className="font-mono text-[10px] text-zinc-500">
                                {formatVariantWhen(v.startTime)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={approveLoading}
                              onClick={() => void handleApproveVariant(v)}
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50"
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

              <div className="border-t border-zinc-200 bg-white p-3">
                <button
                  type="button"
                  onClick={() =>
                    setRightTab((t) => (t === "form" ? "ai" : "form"))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
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
