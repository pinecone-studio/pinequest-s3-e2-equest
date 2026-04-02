/**
 * Багшийн хуанлийн цагийн муж (1-р сургуулийн жишээ).
 * UI render болон ирээдүйд Gemini / API-д дамжуулахад нэг эх үүсвэр.
 */

export function parseClockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

/** Багшийн ээлж (цагийн слот, scroll focus). */
export type TeacherShiftId = "I" | "II";

function clockRangeToParts(start: string, end: string) {
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10));
  return {
    startH: sh,
    startM: Number.isNaN(sm) ? 0 : sm,
    endH: eh,
    endM: Number.isNaN(em) ? 0 : em,
  };
}

/**
 * III хэсэг — албан цагийн Range (1–7-р цаг). AI / API / хуанлийн mock нэг эх үүсвэр.
 * I = өглөөний ээлж, II = өдрийн ээлж.
 */
export const SCHOOL_PERIOD_CLOCKS_BY_SHIFT = {
  I: [
    { start: "07:45", end: "08:25" },
    { start: "08:30", end: "09:10" },
    { start: "09:20", end: "10:00" },
    { start: "10:15", end: "10:55" },
    { start: "11:00", end: "11:40" },
    { start: "11:50", end: "12:30" },
    { start: "12:35", end: "13:15" },
  ],
  II: [
    { start: "13:20", end: "14:00" },
    { start: "14:05", end: "14:45" },
    { start: "14:55", end: "15:35" },
    { start: "15:50", end: "16:30" },
    { start: "16:35", end: "17:15" },
    { start: "17:25", end: "18:05" },
    { start: "18:10", end: "18:50" },
  ],
} as const;

/** Тор / mock хичээлийн мөр — `SCHOOL_PERIOD_CLOCKS_BY_SHIFT`-аас үүснэ. */
export type SchoolShiftPeriodSlotRow = {
  periodLabel: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
};

function buildSchoolShiftPeriodSlots(
  shift: TeacherShiftId,
): readonly SchoolShiftPeriodSlotRow[] {
  const clocks =
    shift === "I"
      ? SCHOOL_PERIOD_CLOCKS_BY_SHIFT.I
      : SCHOOL_PERIOD_CLOCKS_BY_SHIFT.II;
  const prefix = shift === "I" ? "I" : "II";
  return clocks.map((c, i) => ({
    periodLabel: `${prefix} · ${i + 1}-р цаг`,
    ...clockRangeToParts(c.start, c.end),
  }));
}

export const SCHOOL_SHIFT_PERIOD_SLOTS: Record<
  TeacherShiftId,
  readonly SchoolShiftPeriodSlotRow[]
> = {
  I: buildSchoolShiftPeriodSlots("I"),
  II: buildSchoolShiftPeriodSlots("II"),
};

export const CALENDAR_VIEW_CONFIG = {
  /** Концептуал scroll / zoom хүрээ (метадата). */
  scroll: { start: "07:00", end: "21:00" },
  /** Тор дээр бодитоор дүрслэх өдрийн хүрээ. */
  dayVisible: { start: "07:00", end: "20:30" },
  /** Идэвхтэй / critical үе (анхаарал төвлөрөх). */
  criticalFocus: { start: "07:30", end: "19:30" },
  viewport: {
    morningShift: { start: "07:15", end: "16:00" },
    afternoonShift: { start: "12:45", end: "19:30" },
  },
  overlays: [
    {
      id: "morning-block",
      start: "07:30",
      end: "07:45",
      kind: "red-zone" as const,
      label: "Өглөөний бэлтгэл / ирц",
      tooltip: "I ээлжийн бэлтгэл",
    },
    {
      id: "transition-block",
      start: "13:05",
      end: "13:20",
      kind: "red-zone" as const,
      label: "Ээлж солигдох түгжрэл",
      tooltip: "II ээлжийн шилжилт",
    },
  ],
  shiftMarkers: [
    { at: "07:45", label: "I ээлж эхлэх" },
    { at: "13:20", label: "II ээлж эхлэх" },
  ],
} as const;

/** Alias: шинэ код `CALENDAR_VIEW_CONFIG` ашиглахыг зөвлөж байна. */
export const SCHOOL_CALENDAR_CONFIG = CALENDAR_VIEW_CONFIG;

/**
 * I — өглөөний ээлж (ихэвчлэн 10–12, зарим 8–9).
 * II — өдрийн ээлж (ихэвчлэн 1–5, ~13:15-аас).
 */
export const TEACHER_SHIFT_INITIAL_FOCUS: Record<
  TeacherShiftId,
  { hour: number; minute: number }
> = {
  I: { hour: 7, minute: 45 },
  II: { hour: 12, minute: 0 },
};

export const DAY_VISIBLE_START_MIN = parseClockToMinutes(
  CALENDAR_VIEW_CONFIG.dayVisible.start,
);
export const DAY_VISIBLE_END_MIN = parseClockToMinutes(
  CALENDAR_VIEW_CONFIG.dayVisible.end,
);
export const DAY_VISIBLE_SPAN_MIN = DAY_VISIBLE_END_MIN - DAY_VISIBLE_START_MIN;

export const SLOT_MINUTES = 30;
export const SLOT_COUNT = DAY_VISIBLE_SPAN_MIN / SLOT_MINUTES;
/** Нэг 30 минутын мөрийн өндөр (px). `globals.css` `.scheduler-slot-grid-bg` → `--sched-slot-px`-тай ижил. */
export const HOUR_PX = 32;
export const GRID_BODY_MIN_H = SLOT_COUNT * HOUR_PX;

export function minutesToTopPercent(minuteOfDay: number): number {
  const p =
    ((minuteOfDay - DAY_VISIBLE_START_MIN) / DAY_VISIBLE_SPAN_MIN) * 100;
  return Math.min(Math.max(p, 0), 100);
}

export function slotTopPercent(hour: number, minute = 0): number {
  return minutesToTopPercent(hour * 60 + minute);
}

/** Торын баганын дээрхи Y хувь → өдрийн минут (даралт/чирэх). */
export function topPercentToMinuteOfDay(
  topPct: number,
  snapMinutes: number = 15,
): number {
  const p = Math.min(Math.max(topPct, 0), 100);
  const raw = DAY_VISIBLE_START_MIN + (p / 100) * DAY_VISIBLE_SPAN_MIN;
  const snapped = Math.round(raw / snapMinutes) * snapMinutes;
  const maxStart = Math.max(
    DAY_VISIBLE_END_MIN - snapMinutes,
    DAY_VISIBLE_START_MIN,
  );
  return Math.min(Math.max(snapped, DAY_VISIBLE_START_MIN), maxStart);
}

export function minuteOfDayToHourMinute(totalMin: number): {
  h: number;
  m: number;
} {
  const t = Math.max(0, Math.min(totalMin, 24 * 60 - 1));
  return { h: Math.floor(t / 60), m: t % 60 };
}

export function blockHeightPercentFromMinuteRange(
  startMin: number,
  endMin: number,
): number {
  const start = Math.max(
    DAY_VISIBLE_START_MIN,
    Math.min(startMin, DAY_VISIBLE_END_MIN),
  );
  const end = Math.max(
    start,
    Math.min(endMin, DAY_VISIBLE_END_MIN),
  );
  const sh = Math.floor(start / 60);
  const sm = start % 60;
  const eh = Math.floor(end / 60);
  const em = end % 60;
  return blockHeightPercent(sh, sm, eh, em);
}

export function slotTopPercentFromMinute(startMin: number): number {
  const { h, m } = minuteOfDayToHourMinute(startMin);
  return slotTopPercent(h, m);
}

export function blockHeightPercent(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): number {
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return Math.min(100, ((end - start) / DAY_VISIBLE_SPAN_MIN) * 100);
}

export const TIME_SLOT_LABELS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const start = DAY_VISIBLE_START_MIN + i * SLOT_MINUTES;
  const hh = Math.floor(start / 60);
  const mm = start % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    key: start,
    label: `${pad(hh)}:${pad(mm)}`,
    isHourMark: mm === 0,
  };
});

/** Critical-аас гадуурх буфер муж (саарал). */
export const CALENDAR_BUFFER_BANDS = (() => {
  const startC = parseClockToMinutes(CALENDAR_VIEW_CONFIG.criticalFocus.start);
  const endC = parseClockToMinutes(CALENDAR_VIEW_CONFIG.criticalFocus.end);
  const span = DAY_VISIBLE_SPAN_MIN;
  return {
    beforeTopPct: 0,
    beforeHeightPct: ((startC - DAY_VISIBLE_START_MIN) / span) * 100,
    afterTopPct: ((endC - DAY_VISIBLE_START_MIN) / span) * 100,
    afterHeightPct: ((DAY_VISIBLE_END_MIN - endC) / span) * 100,
  };
})();

export type CalendarOverlayKind = "red-zone";

export type CalendarOverlayLayout = {
  id: string;
  kind: CalendarOverlayKind;
  label: string;
  tooltip?: string;
  topPct: number;
  heightPct: number;
};

export const CALENDAR_OVERLAY_LAYOUTS: CalendarOverlayLayout[] =
  CALENDAR_VIEW_CONFIG.overlays.map((o) => {
    const topPct = minutesToTopPercent(parseClockToMinutes(o.start));
    const endPct = minutesToTopPercent(parseClockToMinutes(o.end));
    return {
      id: o.id,
      kind: o.kind,
      label: o.label,
      topPct,
      heightPct: Math.max(0, endPct - topPct),
      ...("tooltip" in o && typeof o.tooltip === "string"
        ? { tooltip: o.tooltip }
        : {}),
    };
  });

export const SHIFT_MARKER_LAYOUTS = CALENDAR_VIEW_CONFIG.shiftMarkers.map(
  (m) => ({
    at: m.at,
    label: m.label,
    topPct: minutesToTopPercent(parseClockToMinutes(m.at)),
  }),
);
