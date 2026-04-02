/**
 * AI scheduler / шалгалтын `preferredDate`: сургуулийн өдрийн эхлэлийг
 * **Монгол (Asia/Ulaanbaatar, UTC+8, DST байхгүй)** гэж тодорхойлох.
 *
 * `startOfDay(day).toISOString()`-аас ялгаатай нь хөтөчийн timezone-оос хамаарч
 * «сонгосон огнооны» UB шөнө буруу болохоос сэргийлнэ.
 */
export function schoolPreferredDateStartIsoUb(calendarDay: Date): string {
  const y = calendarDay.getFullYear();
  const m = calendarDay.getMonth() + 1;
  const d = calendarDay.getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  const ms = Date.parse(`${y}-${p(m)}-${p(d)}T00:00:00+08:00`);
  if (Number.isNaN(ms)) {
    return new Date(
      calendarDay.getFullYear(),
      calendarDay.getMonth(),
      calendarDay.getDate(),
    ).toISOString();
  }
  return new Date(ms).toISOString();
}
