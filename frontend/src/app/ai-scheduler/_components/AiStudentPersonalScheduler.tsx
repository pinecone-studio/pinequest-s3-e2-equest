"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLazyQuery, useQuery } from "@apollo/client/react";
import { useTheme } from "next-themes";
import {
  addDays,
  format,
  getISODay,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { mn } from "date-fns/locale";
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
import {
  GetStudentMainLessonsListDocument,
  GetStudentsListDocument,
} from "@/gql/create-exam-documents";
import type { Student, StudentMainLesson } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
  CALENDAR_BUFFER_BANDS,
  CALENDAR_OVERLAY_LAYOUTS,
  CALENDAR_VIEW_CONFIG,
  GRID_BODY_MIN_H,
  HOUR_PX,
  TIME_SLOT_LABELS,
  TEACHER_SHIFT_INITIAL_FOCUS,
  blockHeightPercent,
  slotTopPercent,
  type TeacherShiftId,
} from "@/constants/calendar";
import {
  CalendarDays,
  CalendarClock,
  Circle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ClipboardList,
  GraduationCap,
  Menu,
  Monitor,
  Moon,
  Square,
  Sparkles,
  Sun,
  Target,
  Triangle,
} from "lucide-react";

const panelLight =
  "rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/40 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:shadow-black/40";
const textDim = "text-zinc-500 dark:text-zinc-400";

function formatMnMonthDay(d: Date) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}-р сарын ${day}`;
}

/** getISODay: 1=Даваа … 7=Ням */
const WEEKDAY_LETTER_MN: Record<number, string> = {
  1: "Да",
  2: "Мя",
  3: "Лха",
  4: "Пү",
  5: "Ба",
  6: "Бя",
  7: "Ня",
};

type StudentLayerId =
  | "class_schedule"
  | "repetition_confirmed"
  | "section"
  | "personal_plan";

type StudentBlock = {
  id: string;
  layer: StudentLayerId;
  title: string;
  subtitle?: string;
  roomLabel?: string;
  colIdx: number; // 0=Mon ... 6=Sun
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  /** Баталгаажсан эсэх (секц/давтлага дээр badge) */
  confirmed?: boolean;
};

function formatBlockDuration(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(startHour)}:${pad(startMinute)}–${pad(endHour)}:${pad(
    endMinute,
  )}`;
}

function SchedulerAppearanceMenu() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

const LAYER_META: Record<
  StudentLayerId,
  { label: string; swatch: string; cardClass: string; hint: string }
> = {
  class_schedule: {
    label: "Хичээлийн хуваарь",
    swatch: "bg-blue-500",
    cardClass:
      "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950/45 dark:text-blue-50",
    hint: "Сонгосон сурагчийн (анги) үндсэн хичээлийн хуваарь",
  },
  repetition_confirmed: {
    label: "Батлагдсан давтлага",
    swatch: "bg-emerald-500",
    cardClass:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-50",
    hint: "Тогтмол давтамжтай, баталгаажсан (locked) давтлага",
  },
  section: {
    label: "Секц",
    swatch: "bg-indigo-500",
    cardClass:
      "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-50",
    hint: "Дугуйлан/секцийн цагууд",
  },
  personal_plan: {
    label: "Personal төлөвлөгөө",
    swatch: "bg-slate-400",
    cardClass:
      "border-slate-300/80 bg-slate-100/95 text-slate-900 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100",
    hint: "Сурагчийн өөрийн зорилго, давтлага, даалгаврын блок (private)",
  },
};

function defaultLayerVisibility(): Record<StudentLayerId, boolean> {
  return {
    class_schedule: true,
    repetition_confirmed: true,
    section: true,
    personal_plan: true,
  };
}

function mockStudentBlocks(): StudentBlock[] {
  return [
    {
      id: "rep-math",
      layer: "repetition_confirmed",
      title: "Математик давтлага",
      subtitle: "Батлагдсан · 10А",
      colIdx: 1,
      startH: 16,
      startM: 5,
      endH: 16,
      endM: 45,
      confirmed: true,
    },
    {
      id: "rep-eng",
      layer: "repetition_confirmed",
      title: "Англи давтлага",
      subtitle: "Батлагдсан · 10А",
      colIdx: 3,
      startH: 15,
      startM: 50,
      endH: 16,
      endM: 30,
      confirmed: true,
    },
    {
      id: "sec-robot",
      layer: "section",
      title: "Роботик секц",
      subtitle: "Секц · Лаб 2",
      colIdx: 4,
      startH: 17,
      startM: 25,
      endH: 18,
      endM: 5,
      confirmed: true,
    },
    {
      id: "plan-focus",
      layer: "personal_plan",
      title: "Фокус: Алгебр",
      subtitle: "Pomodoro 2×25 (жишээ)",
      colIdx: 0,
      startH: 19,
      startM: 0,
      endH: 19,
      endM: 50,
    },
    {
      id: "plan-reading",
      layer: "personal_plan",
      title: "Уншлага",
      subtitle: "Ном · 20 хуудас",
      colIdx: 2,
      startH: 18,
      startM: 10,
      endH: 18,
      endM: 40,
    },
  ];
}

export type AiStudentPersonalSchedulerProps = {
  /** Үнэн бол гаднах hub rail нуугдана (future: /ai-scheduler?view=student) */
  shellMode?: boolean;
  /** Үнэн бол дотор header (гарчиг + theme/menu) нуугдана. */
  hideHeader?: boolean;
  /** Хуанлийн анхны scroll — student профайлаас ирж болно. */
  defaultShift?: TeacherShiftId;
};

export function AiStudentPersonalScheduler({
  shellMode = false,
  hideHeader = false,
  defaultShift = "II",
}: AiStudentPersonalSchedulerProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  const [layerOn, setLayerOn] = useState<Record<StudentLayerId, boolean>>(
    defaultLayerVisibility,
  );
  const [rightTab, setRightTab] = useState<"plan" | "about">("plan");
  const [shift, setShift] = useState<TeacherShiftId>(defaultShift);
  const [selectedGrade, setSelectedGrade] = useState<"9" | "10" | "11" | "12">(
    "9",
  );
  const [selectedGroup, setSelectedGroup] = useState<"A" | "B" | "C" | "D">(
    "A",
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const bootstrappedDefaultStudentRef = useRef(false);

  const calendarMainRef = useRef<HTMLElement>(null);
  const calendarFocusAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => setShift(defaultShift), [defaultShift]);

  useLayoutEffect(() => {
    const main = calendarMainRef.current;
    const anchor = calendarFocusAnchorRef.current;
    if (!main || !anchor) return;
    const st =
      anchor.getBoundingClientRect().top -
      main.getBoundingClientRect().top +
      main.scrollTop;
    main.scrollTo({ top: Math.max(0, st - 12), behavior: "auto" });
  }, [shift]);

  const anchor = date ?? new Date();
  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekRangeLabel = `${formatMnMonthDay(weekStart)} – ${formatMnMonthDay(weekEnd)}`;

  function toggleLayer(id: StudentLayerId) {
    setLayerOn((p) => ({ ...p, [id]: !p[id] }));
  }

  function shiftWeek(deltaWeeks: number) {
    setDate((d) => addDays(d ?? new Date(), deltaWeeks * 7));
  }

  const selectedLabel = date
    ? format(date, "EEEE, MMMM d", { locale: mn })
    : "—";

  type GetStudentsListData = { getStudentsList: Student[] };
  type GetStudentsListVars = { grade: number; group: string };

  const [loadStudents, { data: studentsData, loading: studentsLoading }] =
    useLazyQuery<GetStudentsListData, GetStudentsListVars>(
      GetStudentsListDocument,
      {
        fetchPolicy: "cache-first",
        notifyOnNetworkStatusChange: true,
      },
    );

  const fetchStudentsForSelectedGroup = useCallback(() => {
    loadStudents({
      variables: { grade: Number(selectedGrade), group: selectedGroup },
    });
  }, [loadStudents, selectedGrade, selectedGroup]);

  useEffect(() => {
    // Picker нээлттэй үед анги/бүлэг солигдвол шинэ жагсаалтаа татна.
    if (!studentPickerOpen) return;
    fetchStudentsForSelectedGroup();
  }, [fetchStudentsForSelectedGroup, studentPickerOpen]);

  const studentOptions = useMemo(() => {
    const rows: Student[] = studentsData?.getStudentsList ?? [];
    return rows.filter((s) => s.status === "active");
  }, [studentsData?.getStudentsList]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return studentOptions.find((s) => s.id === selectedStudentId) ?? null;
  }, [selectedStudentId, studentOptions]);

  const selectedStudentMeta = useMemo(() => {
    if (!selectedStudent) {
      return "Сурагч сонгоход байршил, ангийн мэдээлэл энд гарна.";
    }

    const location = selectedStudent.homeRoomNumber
      ? `${selectedStudent.homeRoomNumber} тоот`
      : "Тодорхойгүй";

    return `Байршил: ${location} · ${selectedStudent.gradeLevel}-р анги`;
  }, [selectedStudent]);

  useEffect(() => {
    // Refresh хийхэд default (9A) эхний сурагчийг автоматаар сонгоно.
    // getStudentsList нь page load дээр 1 удаа дуудагдана.
    if (bootstrappedDefaultStudentRef.current) return;
    bootstrappedDefaultStudentRef.current = true;
    fetchStudentsForSelectedGroup();
  }, [fetchStudentsForSelectedGroup]);

  useEffect(() => {
    // Default fetch-ийн дараа 1-р сурагчийг сонгоно (хэрэглэгч өөрөө сонгосон бол override хийхгүй).
    if (selectedStudentId) return;
    const first = studentOptions[0]?.id ?? "";
    if (first) setSelectedStudentId(first);
  }, [selectedStudentId, studentOptions]);

  useEffect(() => {
    // Анги/бүлэг солигдоход өмнөх сонголт үлдэхээс сэргийлнэ.
    setSelectedStudentId("");
  }, [selectedGrade, selectedGroup]);

  type GetStudentMainLessonsListData = {
    getStudentMainLessonsList: StudentMainLesson[];
  };
  type GetStudentMainLessonsListVars = {
    studentId: string;
    semesterId?: string;
    includeDraft?: boolean;
  };

  const { data: studentScheduleData, loading: studentScheduleLoading } =
    useQuery<GetStudentMainLessonsListData, GetStudentMainLessonsListVars>(
      GetStudentMainLessonsListDocument,
      {
        variables: {
          studentId: selectedStudentId,
          semesterId: "2026-SPRING",
          includeDraft: false,
        },
        skip: !selectedStudentId,
        fetchPolicy: "cache-first",
        notifyOnNetworkStatusChange: true,
      },
    );

  function parseHHMM(t: string): { h: number; m: number } {
    const [hh, mm] = String(t ?? "").split(":");
    const h = Number(hh);
    const m = Number(mm);
    return {
      h: Number.isFinite(h) ? h : 0,
      m: Number.isFinite(m) ? m : 0,
    };
  }

  const blocks = useMemo((): StudentBlock[] => {
    if (!selectedStudentId) {
      return mockStudentBlocks();
    }

    const rows: StudentMainLesson[] =
      studentScheduleData?.getStudentMainLessonsList ?? [];

    return rows.map((r) => {
      const s = parseHHMM(r.startTime);
      const e = parseHHMM(r.endTime);
      const teacher = r.teacherShortName ? String(r.teacherShortName) : "";
      return {
        id: r.id,
        layer: "class_schedule",
        title: r.subjectName,
        subtitle: teacher || undefined,
        roomLabel: r.classroomRoomNumber,
        colIdx: Math.max(0, Math.min(6, (r.dayOfWeek ?? 1) - 1)),
        startH: s.h,
        startM: s.m,
        endH: e.h,
        endM: e.m,
        confirmed: r.isDraft === false,
      };
    });
  }, [selectedStudentId, studentScheduleData?.getStudentMainLessonsList]);

  const visibleBlocks = useMemo(
    () => blocks.filter((b) => layerOn[b.layer]),
    [blocks, layerOn],
  );

  const planSummary = useMemo(() => {
    const rep = blocks.filter((b) => b.layer === "repetition_confirmed");
    const sec = blocks.filter((b) => b.layer === "section");
    const pln = blocks.filter((b) => b.layer === "personal_plan");
    return { rep, sec, pln };
  }, [blocks]);

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
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
                aria-expanded={calendarSidebarOpen}
                aria-controls="student-scheduler-sidebar"
                onClick={() => setCalendarSidebarOpen((o) => !o)}
              >
                <span className="sr-only">Хуанлын панел нээх, хаах</span>
                <Menu className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/80 dark:text-emerald-200 dark:ring-emerald-700/60">
                  <GraduationCap
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-base">
                    Сурагчийн хуанли
                  </h1>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <SchedulerAppearanceMenu />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-xl border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Анги сонгох"
                  >
                    <span className="max-w-[min(100%,10rem)] truncate">
                      {selectedGrade}-р анги
                    </span>
                    <ChevronDown
                      className="ml-2 size-4 opacity-70"
                      aria-hidden
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Анги</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedGrade}
                    onValueChange={(v) =>
                      setSelectedGrade(v as "9" | "10" | "11" | "12")
                    }
                  >
                    <DropdownMenuRadioItem value="9">
                      9-р анги
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="10">
                      10-р анги
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="11">
                      11-р анги
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="12">
                      12-р анги
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-xl border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Бүлэг сонгох"
                  >
                    <span className="max-w-[min(100%,8rem)] truncate">
                      {selectedGroup} бүлэг
                    </span>
                    <ChevronDown
                      className="ml-2 size-4 opacity-70"
                      aria-hidden
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Бүлэг</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedGroup}
                    onValueChange={(v) =>
                      setSelectedGroup(v as "A" | "B" | "C" | "D")
                    }
                  >
                    <DropdownMenuRadioItem value="A">
                      A бүлэг
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="B">
                      B бүлэг
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="C">
                      C бүлэг
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="D">
                      D бүлэг
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu
                open={studentPickerOpen}
                onOpenChange={(open) => {
                  setStudentPickerOpen(open);
                  if (open) fetchStudentsForSelectedGroup();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-xl border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Сурагч сонгох"
                  >
                    <span className="max-w-[min(100%,12rem)] truncate">
                      {selectedStudent
                        ? `${selectedStudent.lastName} ${selectedStudent.firstName}`
                        : studentsLoading || studentScheduleLoading
                          ? "Уншиж байна…"
                          : "Сурагч сонгох"}
                    </span>
                    <ChevronDown
                      className="ml-2 size-4 opacity-70"
                      aria-hidden
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>
                    {selectedGrade}
                    {selectedGroup} · Сурагч
                  </DropdownMenuLabel>
                  <div className="max-h-72 overflow-y-auto">
                    <DropdownMenuRadioGroup
                      value={selectedStudentId}
                      onValueChange={(v) => setSelectedStudentId(String(v))}
                    >
                      {studentOptions.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                          Сурагч олдсонгүй.
                        </div>
                      ) : (
                        studentOptions.map((s) => (
                          <DropdownMenuRadioItem key={s.id} value={s.id}>
                            <span className="truncate">
                              {s.lastName} {s.firstName}
                            </span>
                          </DropdownMenuRadioItem>
                        ))
                      )}
                    </DropdownMenuRadioGroup>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  <Square className="size-2 fill-emerald-300/75 text-emerald-300/75" />
                  <Circle className="size-2 fill-sky-400 text-sky-400" />
                  <Triangle className="size-2 fill-emerald-300/75 text-emerald-300/75" />
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
                  href="/ai-scheduler"
                  title="Багшийн хуанли"
                  aria-label="Багшийн хуанли руу очих"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-xl  text-zinc-200 shadow-sm  ring-white/10 transition-colors hover:bg-white/12 hover:text-sky-200"
                >
                  <CalendarClock
                    className="size-5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </Link>
                <button
                  type="button"
                  title="Сурагчийн хуанли"
                  aria-current="page"
                  aria-label="Сурагчийн хуанли (одоо)"
                  className="flex size-11 items-center justify-center rounded-xl bg-white/14 text-white shadow-sm ring-1 ring-white/12"
                >
                  <GraduationCap
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

          <aside
            id="student-scheduler-sidebar"
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
                "flex h-full w-full max-w-[272px] flex-col gap-4 overflow-y-auto p-8 bg-[#F1F4FA]",
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
                <div className="flex justify-center rounded-xl bg-white p-2 dark:bg-zinc-900">
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
                <div className="px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Эвент ({Object.keys(LAYER_META).length})
                  </p>
                </div>
                {(Object.keys(LAYER_META) as StudentLayerId[]).map((id) => {
                  const meta = LAYER_META[id];
                  const on = layerOn[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLayer(id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        on
                          ? "bg-blue-50/80 text-zinc-900 dark:bg-blue-950/50 dark:text-zinc-100"
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
                          {meta.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
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
                      onClick={() => setDate(startOfDay(new Date()))}
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
                            TEACHER_SHIFT_INITIAL_FOCUS[shift].hour,
                            TEACHER_SHIFT_INITIAL_FOCUS[shift].minute,
                          )}%`,
                        }}
                        aria-hidden
                      />
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
                    </div>

                    {weekDays.map((d, colIdx) => (
                      <div
                        key={`col-${colIdx}`}
                        className="relative rounded-xl border border-zinc-200/90 bg-zinc-50/80 dark:border-zinc-600/90 dark:bg-zinc-900/50"
                        style={{ minHeight: GRID_BODY_MIN_H }}
                        aria-label={format(d, "EEEE", { locale: mn })}
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

                        {visibleBlocks
                          .filter((b) => b.colIdx === colIdx)
                          .map((b) => {
                            const meta = LAYER_META[b.layer];
                            return (
                              <div
                                key={b.id}
                                className={cn(
                                  "absolute left-1 right-1 z-5 overflow-hidden rounded-xl border px-2 py-1.5 text-[10px] font-semibold leading-tight shadow-sm",
                                  meta.cardClass,
                                )}
                                style={{
                                  top: `${slotTopPercent(b.startH, b.startM)}%`,
                                  height: `${blockHeightPercent(
                                    b.startH,
                                    b.startM,
                                    b.endH,
                                    b.endM,
                                  )}%`,
                                  minHeight: "44px",
                                }}
                                title={`${b.title} · ${formatBlockDuration(
                                  b.startH,
                                  b.startM,
                                  b.endH,
                                  b.endM,
                                )}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="min-w-0 flex-1 truncate">
                                    {b.title}
                                  </span>
                                  {b.layer === "class_schedule" ? (
                                    <span className="shrink-0 rounded-md border border-zinc-200/70 bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-zinc-700 dark:border-zinc-600/70 dark:bg-zinc-900/60 dark:text-zinc-200">
                                      {b.roomLabel}
                                    </span>
                                  ) : null}
                                </div>
                                <span className="mt-0.5 block truncate text-[9px] font-normal opacity-90">
                                  {b.subtitle
                                    ? `${b.subtitle} · ${formatBlockDuration(
                                        b.startH,
                                        b.startM,
                                        b.endH,
                                        b.endM,
                                      )}`
                                    : formatBlockDuration(
                                        b.startH,
                                        b.startM,
                                        b.endH,
                                        b.endM,
                                      )}
                                </span>
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
                  {selectedStudentMeta}
                </p>
              </div>
            </main>

            <aside className="flex w-full shrink-0 flex-col border-zinc-200/90 bg-white shadow-[inset_1px_0_0_0_rgba(228,228,231,0.6)] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-[inset_1px_0_0_0_rgba(39,39,42,0.8)] xl:w-[320px] xl:border-l">
              <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/90">
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-4" strokeWidth={2} aria-hidden />
                </div>
                <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Сурагчийн туслах
                </span>
              </div>

              <div className="flex gap-1 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setRightTab("plan")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "plan"
                      ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  )}
                >
                  Төлөвлөгөө
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("about")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === "about"
                      ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  )}
                >
                  Тайлбар
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50/40 p-4 dark:bg-zinc-950/80">
                {rightTab === "plan" ? (
                  <div className="space-y-4">
                    <div className={cn(panelLight, "overflow-hidden p-0")}>
                      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                        <ClipboardList className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Энэ 7 хоног (mock)
                        </span>
                      </div>
                      <div className="space-y-3 px-3 py-3">
                        {(
                          [
                            ["Батлагдсан давтлага", planSummary.rep],
                            ["Секц", planSummary.sec],
                            ["Personal төлөвлөгөө", planSummary.pln],
                          ] as const
                        ).map(([label, items]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              {label} · {items.length}
                            </p>
                            {items.length === 0 ? (
                              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                Одоогоор хоосон
                              </p>
                            ) : (
                              <ul className="mt-2 space-y-2">
                                {items.map((b) => (
                                  <li
                                    key={b.id}
                                    className="flex items-start gap-2"
                                  >
                                    <span
                                      className={cn(
                                        "mt-0.5 inline-flex size-2.5 shrink-0 rounded-sm",
                                        LAYER_META[b.layer].swatch,
                                      )}
                                      aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {b.title}
                                      </span>
                                      <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                        {formatBlockDuration(
                                          b.startH,
                                          b.startM,
                                          b.endH,
                                          b.endM,
                                        )}
                                        {b.subtitle ? ` · ${b.subtitle}` : ""}
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
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
                      Энэ дэлгэц нь багшийн “Operations Center” хэв маягийг
                      сурагчийн хэрэгцээнд тааруулж хувиргасан хувилбар.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>
                        <strong className="font-semibold text-zinc-800 dark:text-zinc-100">
                          Батлагдсан давтлага
                        </strong>{" "}
                        — давтамжтай, баталгаажсан нэмэлт сургалт.
                      </li>
                      <li>
                        <strong className="font-semibold text-zinc-800 dark:text-zinc-100">
                          Секц
                        </strong>{" "}
                        — дугуйлан/клубийн цаг.
                      </li>
                      <li>
                        <strong className="font-semibold text-zinc-800 dark:text-zinc-100">
                          Personal төлөвлөгөө
                        </strong>{" "}
                        — сурагч өөрөө оруулсан фокус/даалгавар/давтлагын блок.
                      </li>
                    </ul>
                    <p className="mt-3">
                      Одоо mock. Дараагийн алхам: student-ийн “баталгаажсан
                      давтлага (recurrence)”, “секцийн бүртгэл”, “personal plan”
                      өгөгдлүүдийг API/GraphQL-оос авч календарийн блок болгоно.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
