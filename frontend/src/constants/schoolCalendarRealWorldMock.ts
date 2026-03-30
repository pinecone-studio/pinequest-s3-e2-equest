/**
 * Сургуулийн нэгдсэн жилийн «реал» эвентүүд (жишээ жил: 2025–2026 хичээлийн жилийн хуанли).
 * DB/API-аас ирэхээс өмнө UX / демо — `SchoolEventScheduler`-д нэгтгэгдэнэ.
 */

import type {
  SchoolCalendarEvent,
  SchoolCalendarEventCategory,
  SchoolCalendarEventVisibility,
  SchoolEventLayerKind,
} from "@/types/schoolCalendar";

function dayRangeUtc(
  y: number,
  m: number,
  dStart: number,
  dEnd: number,
): { startAt: string; endAt: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    startAt: `${y}-${pad(m)}-${pad(dStart)}T00:00:00.000Z`,
    endAt: `${y}-${pad(m)}-${pad(dEnd)}T23:59:59.999Z`,
  };
}

function singleDayUtc(
  y: number,
  m: number,
  d: number,
): { startAt: string; endAt: string } {
  return dayRangeUtc(y, m, d, d);
}

/**
 * Жилийн туршид харагдах баримжаатай эвентүүд (constraint тайлбар metadata-д).
 */
export const REAL_WORLD_SCHOOL_CALENDAR_MOCK: SchoolCalendarEvent[] = [
  {
    id: "mock-real-2026-09-01-school-start",
    title: "Хичээлийн шинэ жил — Эхний хонх",
    description:
      "09.01: бүх ангийн хичээл 0-цаг. Зөвхөн нээлтийн / эхний хонхны арга хэмжээ (баримжаа).",
    category: "CAMPUS_LIFE" satisfies SchoolCalendarEventCategory,
    layerKind: "HOLIDAY" satisfies SchoolEventLayerKind,
    subcategory: "SCHOOL_START",
    ...singleDayUtc(2026, 9, 1),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "FIRST_BELL_ONLY",
      lessons: "none",
    }),
  },
  {
    id: "mock-real-2026-10-teachers-week",
    title: "Багш нарын баяр (10-р сарын эхний 7 хоног)",
    description:
      "10-р сарын эхний 7 хоног — баасан гарагийн хичээлүүд богиноссон цагаар (жишээ 30 мин) баримжаа.",
    category: "ADMIN" satisfies SchoolCalendarEventCategory,
    layerKind: "ADMIN_FIXED" satisfies SchoolEventLayerKind,
    subcategory: "TEACHERS_DAY_WEEK",
    ...dayRangeUtc(2026, 10, 1, 7),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "FRIDAY_SHORT_PERIODS",
      fridayPeriodDeltaMinutes: -30,
    }),
  },
  {
    id: "mock-real-2026-10-02-friday-short",
    title: "Баасан — хичээлийн цаг богиноссон (жишээ)",
    description:
      "Эхний 7 хоногийн баасан: хичээлүүд 30 мин-аар богиноссон гэж үзнэ (08:00–13:00 жишээ цонх).",
    category: "ADMIN" satisfies SchoolCalendarEventCategory,
    layerKind: "ADMIN_FIXED" satisfies SchoolEventLayerKind,
    subcategory: "SHORT_FRIDAY",
    startAt: "2026-10-02T00:00:00.000Z",
    endAt: "2026-10-02T05:00:00.000Z",
    allDay: false,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({ periodDeltaMinutes: -30 }),
  },
  {
    id: "mock-real-2026-11-olympiad",
    title: "Сургуулийн олимпиад",
    description:
      "11.15 – 11.20: High alert — бүх математикийн багш нар «засалтын ажил»-тай; бусад ажил 0 (системд өгөх жин 0) гэж тооцох баримжаа.",
    category: "ACADEMIC" satisfies SchoolCalendarEventCategory,
    layerKind: "ACADEMIC_MILESTONE" satisfies SchoolEventLayerKind,
    subcategory: "OLYMPIAD",
    ...dayRangeUtc(2026, 11, 15, 20),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "HIGH_ALERT",
      mathTeachersDuty: "repair_block",
      otherWorkWeight: 0,
    }),
  },
  {
    id: "mock-real-2026-12-new-year-events",
    title: "Шинэ жилийн арга хэмжээ",
    description:
      "12.20 – 12.30: спорт заал (Gym) blocked; урлагийн үзлэг — заал + тайз (баримжаа). Нэг эвентэд constraint нэгтгэсэн.",
    category: "CAMPUS_LIFE" satisfies SchoolCalendarEventCategory,
    layerKind: "HOLIDAY" satisfies SchoolEventLayerKind,
    subcategory: "NEW_YEAR_PROGRAM",
    ...dayRangeUtc(2026, 12, 20, 30),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "GYM_BLOCKED_ARTS",
      blockedResources: ["gym", "stage"],
      artsExhibition: true,
    }),
  },
  {
    id: "mock-real-2026-02-tsagaan-sar",
    title: "Цагаан сарын золголт",
    description:
      "Билгийн тооллоор 1–2 өдөр: багш, ажилчдын нэгдсэн золголт — сургууль сул (баримжаа; 2026 оны жишээ огноо).",
    category: "CAMPUS_LIFE" satisfies SchoolCalendarEventCategory,
    layerKind: "HOLIDAY" satisfies SchoolEventLayerKind,
    subcategory: "TSAGAAN_SAR",
    ...dayRangeUtc(2026, 2, 17, 18),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "SCHOOL_CLOSED",
      daysApprox: 2,
    }),
  },
  {
    id: "mock-real-2026-03-sports-golden-bell",
    title: "Спортын наадам / «Алтан хонх»",
    description:
      "03.15 – 03.25: заал болон актовын заал (Hall) бүрэн locked — шалгалтын цаг төлөвлөхгүй.",
    category: "RESOURCE_CONSTRAINT" satisfies SchoolCalendarEventCategory,
    layerKind: "RESOURCE_LOCK" satisfies SchoolEventLayerKind,
    subcategory: "HALL_GYM_LOCK",
    ...dayRangeUtc(2026, 3, 15, 25),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "FULL_LOCK",
      resources: ["gym", "assembly_hall"],
    }),
  },
  {
    id: "mock-real-2026-05-academic-bell",
    title: "Эрдмийн баяр / Хонхны баяр",
    description:
      "05.20 – 05.31: 12-р ангиуд «Exam only» горимд шилжинэ (баримжаа — AI-д өгөх constraint).",
    category: "ACADEMIC" satisfies SchoolCalendarEventCategory,
    layerKind: "ACADEMIC_MILESTONE" satisfies SchoolEventLayerKind,
    subcategory: "GRADE_12_EXAM_MODE",
    ...dayRangeUtc(2026, 5, 20, 31),
    allDay: true,
    visibility: "SCHOOL_WIDE" satisfies SchoolCalendarEventVisibility,
    metadataJson: JSON.stringify({
      aiConstraint: "GRADE_12_EXAM_ONLY",
      grades: [12],
    }),
  },
];
