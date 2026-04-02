/**
 * Сургуулийн хуваарь: цагийн бүсийг нэг мөр болгож (Asia/Ulaanbaatar),
 * ISO string-уудыг зөвхөн getTime()-аар харьцуулна.
 *
 * periods.start_time нь "13:20" гэх мэт ханын цаг — UTC биш.
 */

export const SCHOOL_TIMEZONE = "Asia/Ulaanbaatar";

/** Mongolia: UTC+8 (DST байхгүй). */
const UB_OFFSET = "+08:00";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Сургуулийн календарийн он (UB). */
export function calendarYearUb(ms: number): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SCHOOL_TIMEZONE,
      year: "numeric",
    }).format(new Date(ms)),
  );
}

const WEEKDAY_SHORT_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** ISO: Даваа=1 … Ням=7 (UB хуанлийн өдөр). */
export function isoDowMon1Sun7Ub(ms: number): number {
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "short",
  }).format(new Date(ms));
  return WEEKDAY_SHORT_TO_ISO[w] ?? 0;
}

export function ubYmdFromMs(ms: number): { y: number; M: number; D: number } {
  const s = new Date(ms).toLocaleString("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, M, D] = s.split("-").map(Number);
  return { y, M, D };
}

/** Asia/Ulaanbaatar-ийн тухайн өдрийн 00:00 → UTC instant (ms). */
export function startOfTodayUbMs(nowMs: number = Date.now()): number {
  const { y, M, D } = ubYmdFromMs(nowMs);
  return ubYmdHmToUtcMs(y, M, D, 0, 0);
}

export function ubHmFromMs(ms: number): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "NaN");
  const minute = Number(
    parts.find((p) => p.type === "minute")?.value ?? "NaN",
  );
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return { h: 0, m: 0 };
  return { h: hour, m: minute };
}

/** UB ханын цаг → UTC instant (+08:00). */
export function ubYmdHmToUtcMs(
  y: number,
  M: number,
  D: number,
  h: number,
  m: number,
): number {
  return Date.parse(
    `${y}-${pad2(M)}-${pad2(D)}T${pad2(h)}:${pad2(m)}:00${UB_OFFSET}`,
  );
}

export function ubAddCalendarDays(
  y: number,
  M: number,
  D: number,
  deltaDays: number,
): { y: number; M: number; D: number } {
  const noon = ubYmdHmToUtcMs(y, M, D, 12, 0);
  if (Number.isNaN(noon)) {
    const fb = ubYmdHmToUtcMs(y, M, Math.min(D, 28), 12, 0);
    return ubYmdFromMs(fb + deltaDays * 86400000);
  }
  return ubYmdFromMs(noon + deltaDays * 86400000);
}

/**
 * floorMs-оос хойшх эхний `schoolDowMon1Sun7` гарагийн hh:mm (UB) цагийн ISO.
 * Хайлт нь preferred өдрөөс эхлэн 4 долоо хоног хүртэл үргэлжилнэ.
 */
export function firstSlotOnOrAfterUb(
  floorMs: number,
  schoolDowMon1Sun7: number,
  hhmm: string,
): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;

  const base = ubYmdFromMs(floorMs);
  for (let i = 0; i < 28; i++) {
    const { y, M, D } = ubAddCalendarDays(base.y, base.M, base.D, i);
    const candMs = ubYmdHmToUtcMs(y, M, D, h, min);
    if (Number.isNaN(candMs)) continue;
    if (candMs < floorMs) continue;
    if (isoDowMon1Sun7Ub(candMs) === schoolDowMon1Sun7) {
      return new Date(candMs).toISOString();
    }
  }
  return null;
}

/**
 * AI-ийн буруу он → сонгосон сургуулийн он дотор ижил сар/өдөр/цаг (UB) болгож,
 * floor-оос хойш 7 хоногийн алхмаар тохируулна.
 */
export function alignStartToPreferredSchoolYear(
  iso: string,
  preferredYearUb: number,
  floorMs: number,
): string | null {
  const orig = new Date(iso);
  if (Number.isNaN(orig.getTime())) return null;
  const { M, D } = ubYmdFromMs(orig.getTime());
  const { h, m } = ubHmFromMs(orig.getTime());
  let t = ubYmdHmToUtcMs(preferredYearUb, M, D, h, m);
  if (Number.isNaN(t)) {
    t = ubYmdHmToUtcMs(preferredYearUb, M, Math.min(D, 28), h, m);
    if (Number.isNaN(t)) return null;
  }
  let d = new Date(t);
  for (let i = 0; i < 60; i++) {
    if (
      calendarYearUb(d.getTime()) === preferredYearUb &&
      d.getTime() >= floorMs
    ) {
      return d.toISOString();
    }
    d = new Date(d.getTime() + 7 * 86400000);
  }
  return d.getTime() >= floorMs ? d.toISOString() : null;
}
