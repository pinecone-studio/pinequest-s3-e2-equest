/**
 * Mock багшийн хуваарь (I / II ээлж).
 * TODO: DB / GraphQL-аас `teacherId`-аар ачаалж солих.
 */

import type { TeacherShiftId } from "./calendar";
import { SCHOOL_SHIFT_PERIOD_SLOTS } from "./calendar";

export type MockPrimaryLesson = {
  colIdx: number;
  title: string;
  periodLabel: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  /** Сул / зөвлөх / хурал гэх мэт — тор дээр өөр өнгө */
  slotVariant?: "default" | "free" | "duty";
};

export type MockTeacherProfile = {
  id: string;
  displayName: string;
  /** Жижиг тайлбар (тархив, тэнхим гэх мэт) */
  roleNote: string;
  shift: TeacherShiftId;
  lessons: readonly MockPrimaryLesson[];
  /** Үндсэн кабинет — ангийн картын badge (байхгүй бол ангиас map-аас). */
  cabinetRoom?: string;
};

/** III хэсгийн `SCHOOL_SHIFT_PERIOD_SLOTS` — I / II ээлжийн албан цонх. */
const I_SHIFT_PERIOD_SLOTS = SCHOOL_SHIFT_PERIOD_SLOTS.I;
const II_SHIFT_PERIOD_SLOTS = SCHOOL_SHIFT_PERIOD_SLOTS.II;

type PeriodSlotRow = Omit<
  MockPrimaryLesson,
  "title" | "colIdx" | "slotVariant"
>;

function slotVariantForTitle(title: string): MockPrimaryLesson["slotVariant"] {
  const t = title.trim();
  if (t === "Сул" || t.startsWith("Сул ")) return "free";
  if (
    t.startsWith("Зөвлөх") ||
    t.startsWith("Анги уд") ||
    t.includes("Секц") ||
    t === "Давтлага" ||
    t.startsWith("Давтлага") ||
    t === "Хурал" ||
    t.startsWith("Хурал") ||
    t === "Дугуйлан" ||
    t.startsWith("Дугуйлан") ||
    t === "Цэвэрлэгээ" ||
    t.startsWith("Цэвэрлэгээ")
  ) {
    return "duty";
  }
  return "default";
}

/** Мөрийн дараалал: 1–7-р цаг; багана: Даваа … Баасан. */
function buildFullWeekLessons(
  periodSlots: readonly PeriodSlotRow[],
  rowTitles: readonly (readonly string[])[],
): MockPrimaryLesson[] {
  const out: MockPrimaryLesson[] = [];
  rowTitles.forEach((dayTitles, periodIdx) => {
    const slot = periodSlots[periodIdx];
    if (!slot) return;
    dayTitles.forEach((title, colIdx) => {
      out.push({
        colIdx,
        title,
        periodLabel: slot.periodLabel,
        startH: slot.startH,
        startM: slot.startM,
        endH: slot.endH,
        endM: slot.endM,
        slotVariant: slotVariantForTitle(title),
      });
    });
  });
  return out;
}

/**
 * I хэсэг — ахлах анги: хүснэгтэд зөвхөн Дав–Лхаг (1–6 цаг). Пүрэв/Баасан болон
 * 7-р цагийн өгөгдөл албан жагсаалтад байхгүй тул бүгдийг `Сул` (календарь дээр харагдахгүй).
 */
function buildSeniorIShiftWeekFromMTW(
  mon: readonly string[],
  tue: readonly string[],
  wed: readonly string[],
): readonly (readonly string[])[] {
  if (mon.length !== 6 || tue.length !== 6 || wed.length !== 6) {
    throw new Error("buildSeniorIShiftWeekFromMTW: 6 мөрийн өгөгдөл шаардлагатай");
  }
  const rows: string[][] = [];
  for (let i = 0; i < 6; i++) {
    rows.push([mon[i]!, tue[i]!, wed[i]!, "Сул", "Сул"]);
  }
  rows.push(["Сул", "Сул", "Сул", "Сул", "Сул"]);
  return rows;
}

/**
 * II хэсэг — дунд анги: хүснэгтэд зөвхөн Пүрэв/Баасан (1–6 цаг). Дав–Лхаг болон
 * 7-р цагийг `Сул` (календарь дээр харагдахгүй).
 */
function buildMiddleIIShiftWeekFromThFri(
  thu: readonly string[],
  fri: readonly string[],
): readonly (readonly string[])[] {
  if (thu.length !== 6 || fri.length !== 6) {
    throw new Error(
      "buildMiddleIIShiftWeekFromThFri: 6 мөрийн өгөгдөл шаардлагатай",
    );
  }
  const rows: string[][] = [];
  for (let i = 0; i < 6; i++) {
    rows.push(["Сул", "Сул", "Сул", thu[i]!, fri[i]!]);
  }
  rows.push(["Сул", "Сул", "Сул", "Сул", "Сул"]);
  return rows;
}

/** Г. Бат-Эрдэнэ — I хэсэг (Дав–Лхаг 1–6 цаг). */
const BAT_ERDEN_WEEK_ROWS = buildSeniorIShiftWeekFromMTW(
  ["12А", "12А", "12Б", "12Б", "Сул", "10А"],
  ["12Б", "12Б", "Сул", "12А", "12А", "Сул"],
  ["12А", "12А", "10А", "10А", "Сул", "12Б"],
);

/** Д. Болд — I хэсэг. */
const BOLD_WEEK_ROWS = buildSeniorIShiftWeekFromMTW(
  ["11В", "11В", "10Г", "10Г", "11А", "11А"],
  ["10Г", "10Г", "11В", "11В", "Сул", "11А"],
  ["11В", "11В", "Сул", "11В", "10Г", "10Г"],
);

/** Ж. Даваа — I хэсэг. */
const DAVA_WEEK_ROWS = buildSeniorIShiftWeekFromMTW(
  ["Сул", "Сул", "12В", "12В", "12А", "12А"],
  ["11Б", "11Б", "10А", "10А", "Сул", "Сул"],
  ["12В", "12В", "Сул", "Сул", "12А", "12А"],
);

/** Б. Тулга — I хэсэг. */
const TULGA_WEEK_ROWS = buildSeniorIShiftWeekFromMTW(
  ["10Б", "10Б", "Сул", "11В", "11В", "12Б"],
  ["12В", "12В", "11А", "11А", "10Б", "10Б"],
  ["Сул", "Сул", "12Б", "12Б", "11В", "11В"],
);

/** М. Оюун — I хэсэг. */
const OYU_WEEK_ROWS = buildSeniorIShiftWeekFromMTW(
  ["11А", "11А", "11Б", "11Б", "Сул", "Сул"],
  ["Сул", "Сул", "12Б", "12Б", "11Б", "11Б"],
  ["11Б", "11Б", "11А", "11А", "10Б", "10Б"],
);

/** С. Сарантуяа — II хэсэг (Пүр–Баас 1–6 цаг). */
const SARANTUYA_WEEK_ROWS = buildMiddleIIShiftWeekFromThFri(
  ["Сул", "8В", "8В", "7А", "9Б", "9Б"],
  ["9Б", "9Б", "7А", "7А", "8В", "8В"],
);

/** Ц. Энхээ — II хэсэг. */
const ENKHEE_WEEK_ROWS = buildMiddleIIShiftWeekFromThFri(
  ["6А", "6А", "7Г", "7Г", "6Б", "6Б"],
  ["6Б", "6Б", "Сул", "Сул", "7Г", "7Г"],
);

/** Р. Гэрэл — II хэсэг. */
const GEREEL_WEEK_ROWS = buildMiddleIIShiftWeekFromThFri(
  ["9А", "9А", "8Б", "8Б", "Сул", "8А"],
  ["8А", "8А", "9А", "9А", "8Б", "8Б"],
);

/** Т. Баяр — II хэсэг. */
const BAYAR_WEEK_ROWS = buildMiddleIIShiftWeekFromThFri(
  ["7Б", "7Б", "6В", "6В", "7В", "7В"],
  ["Сул", "Сул", "7Б", "7Б", "6В", "6В"],
);

/** Л. Наран — II хэсэг. */
const NARAN_WEEK_ROWS = buildMiddleIIShiftWeekFromThFri(
  ["8Г", "8Г", "9В", "9В", "9Г", "9Г"],
  ["9Г", "9Г", "8Г", "8Г", "Сул", "Сул"],
);

export const MOCK_I_SHIFT_TEACHERS: readonly MockTeacherProfile[] = [
  {
    id: "t-bat-erden",
    displayName: "Г. Бат-Эрдэнэ",
    roleNote:
      "Ахлах анги · Алгебр · I ээлж 07:45–13:15 · каб. 304 (математикийн кабинет)",
    shift: "I",
    cabinetRoom: "304",
    lessons: buildFullWeekLessons(I_SHIFT_PERIOD_SLOTS, BAT_ERDEN_WEEK_ROWS),
  },
  {
    id: "t-bold",
    displayName: "Д. Болд",
    roleNote:
      "Ахлах анги · Геометр · I ээлж 07:45–13:15 · каб. 305 (геометрийн кабинет)",
    shift: "I",
    cabinetRoom: "305",
    lessons: buildFullWeekLessons(I_SHIFT_PERIOD_SLOTS, BOLD_WEEK_ROWS),
  },
  {
    id: "t-davaa",
    displayName: "Ж. Даваа",
    roleNote:
      "Ахлах анги · Магадлал · I ээлж 07:45–13:15 · каб. 308 (магадлалын кабинет)",
    shift: "I",
    cabinetRoom: "308",
    lessons: buildFullWeekLessons(I_SHIFT_PERIOD_SLOTS, DAVA_WEEK_ROWS),
  },
  {
    id: "t-tulga",
    displayName: "Б. Тулга",
    roleNote:
      "Ахлах анги · Олимпиад · I ээлж 07:45–13:15 · каб. 301 (олимпиадын кабинет)",
    shift: "I",
    cabinetRoom: "301",
    lessons: buildFullWeekLessons(I_SHIFT_PERIOD_SLOTS, TULGA_WEEK_ROWS),
  },
  {
    id: "t-oyun",
    displayName: "М. Оюун",
    roleNote:
      "Ахлах анги · Алгебр · I ээлж 07:45–13:15 · каб. 302 (математикийн кабинет)",
    shift: "I",
    cabinetRoom: "302",
    lessons: buildFullWeekLessons(I_SHIFT_PERIOD_SLOTS, OYU_WEEK_ROWS),
  },
  {
    id: "t-sarantuya",
    displayName: "С. Сарантуяа",
    roleNote:
      "Дунд анги · 7А, 8В, 9Б · II ээлж 13:20–18:50 · каб. 208 (дунд ангийн кабинет)",
    shift: "II",
    cabinetRoom: "208",
    lessons: buildFullWeekLessons(II_SHIFT_PERIOD_SLOTS, SARANTUYA_WEEK_ROWS),
  },
  {
    id: "t-enkhee",
    displayName: "Ц. Энхээ",
    roleNote:
      "Дунд анги · 6А, 6Б, 7Г · II ээлж 13:20–18:50 · каб. 204 (дунд ангийн кабинет)",
    shift: "II",
    cabinetRoom: "204",
    lessons: buildFullWeekLessons(II_SHIFT_PERIOD_SLOTS, ENKHEE_WEEK_ROWS),
  },
  {
    id: "t-gereel",
    displayName: "Р. Гэрэл",
    roleNote:
      "Дунд анги · 8А, 8Б, 9А · II ээлж 13:20–18:50 · каб. 210 (дунд ангийн кабинет)",
    shift: "II",
    cabinetRoom: "210",
    lessons: buildFullWeekLessons(II_SHIFT_PERIOD_SLOTS, GEREEL_WEEK_ROWS),
  },
  {
    id: "t-bayar",
    displayName: "Т. Баяр",
    roleNote:
      "Дунд анги · 7Б, 7В, 6В · II ээлж 13:20–18:50 · каб. 205 (дунд ангийн кабинет)",
    shift: "II",
    cabinetRoom: "205",
    lessons: buildFullWeekLessons(II_SHIFT_PERIOD_SLOTS, BAYAR_WEEK_ROWS),
  },
  {
    id: "t-naran",
    displayName: "Л. Наран",
    roleNote:
      "Дунд анги · 9В, 9Г, 8Г · II ээлж 13:20–18:50 · каб. 212 (дунд ангийн кабинет)",
    shift: "II",
    cabinetRoom: "212",
    lessons: buildFullWeekLessons(II_SHIFT_PERIOD_SLOTS, NARAN_WEEK_ROWS),
  },
] as const;

export const DEFAULT_MOCK_TEACHER_ID = MOCK_I_SHIFT_TEACHERS[0].id;

export function getMockTeacherById(
  id: string,
): MockTeacherProfile | undefined {
  return MOCK_I_SHIFT_TEACHERS.find((t) => t.id === id);
}

/** Mock: ангийн код → өрөөний дугаар (картын баруун дээд badge). */
const MOCK_CLASS_ROOM: Record<string, string> = {
  "6А": "200",
  "6Б": "101",
  "6В": "102",
  "7А": "205",
  "7Б": "206",
  "7В": "207",
  "7Г": "203",
  "8А": "208",
  "8Б": "211",
  "8В": "210",
  "8Г": "209",
  "9А": "212",
  "9Б": "214",
  "9В": "213",
  "9Г": "215",
  "10А": "215",
  "10Б": "216",
  "10В": "217",
  "10Г": "218",
  "11А": "311",
  "11Б": "313",
  "11В": "312",
  "12А": "301",
  "12Б": "302",
  "12В": "303",
};

export function mockRoomForClassCode(classCode: string): string | null {
  return MOCK_CLASS_ROOM[classCode] ?? null;
}

/**
 * "12А (Алгебр)" гэх мэт эхний токеноос ангийн код (өрөөний map-д зориулсан).
 */
export function extractClassCodeFromCellTitle(title: string): string | null {
  const first = title.trim().split(/\s+/)[0] ?? "";
  if (!first || !/^\d+/.test(first)) return null;
  return MOCK_CLASS_ROOM[first] ? first : null;
}

/** Картын badge: эхлээд багшийн үндсэн кабинет, эсвэл ангийн кодоор map. */
export function roomBadgeForPrimaryLesson(
  cellTitle: string,
  cabinetRoom?: string | null,
): string | null {
  if (cabinetRoom) return cabinetRoom;
  const code = extractClassCodeFromCellTitle(cellTitle);
  return code ? mockRoomForClassCode(code) : null;
}
