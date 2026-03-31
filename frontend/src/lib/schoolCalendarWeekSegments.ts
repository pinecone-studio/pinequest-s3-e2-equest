/**
 * Сургуулийн нийтийн эвентүүдийг долоо хоногийн тор дээр байрлуулах (багшийн хуанли + school-event хуудас).
 */
import { addDays, parseISO, startOfDay } from "date-fns";

import {
  blockHeightPercent,
  slotTopPercent,
} from "@/constants/calendar";

// NOTE: create-exam-service GraphQL schema-д school calendar type одоогоор байхгүй.
// UI layer дээр mock/өөр эх сурвалжаас ирэх event shape-ийг энд local type-оор барина.
export type SchoolCalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
};

export type SchoolCalendarWeekSegment = {
  eventId: string;
  title: string;
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

/**
 * `SchoolCalendarEvent[]`-ийг одоогийн 7 хоногийн багануудад хувиргана (торын %).
 */
export function buildSchoolCalendarSegmentsForWeek(
  events: readonly Pick<
    SchoolCalendarEvent,
    "id" | "title" | "startAt" | "endAt" | "allDay"
  >[],
  weekDays: readonly Date[],
): SchoolCalendarWeekSegment[] {
  const out: SchoolCalendarWeekSegment[] = [];
  for (const ev of events) {
    const start = parseISO(ev.startAt);
    const end = parseISO(ev.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    weekDays.forEach((day, colIdx) => {
      const seg = segmentForDay(day, start, end);
      if (!seg) return;
      if (ev.allDay) {
        out.push({
          eventId: ev.id,
          title: ev.title,
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
        colIdx,
        allDay: false,
        topPct: slotTopPercent(sh, sm),
        heightPct: blockHeightPercent(sh, sm, eh, em),
      });
    });
  }
  return out;
}

/** Торын % координатад [top, top+height] завсрууд давхцах эсэх. */
export function percentIntervalsOverlap(
  aTop: number,
  aHeight: number,
  bTop: number,
  bHeight: number,
): boolean {
  return aTop < bTop + bHeight && aTop + aHeight > bTop;
}
