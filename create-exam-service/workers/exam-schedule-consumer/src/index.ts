import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "../../../src/db";
import {
  classrooms,
  curriculum,
  examSchedules,
  masterSchedules,
  newExams,
  periods,
  schoolEvents,
  teacherAvailability,
  users,
  groups,
} from "../../../src/db/schema";
import {
  parseAiVariantsJson,
  type ExamVariantRow,
} from "../../../src/lib/exam-schedule-variants";
import {
  alignStartToPreferredSchoolYear,
  calendarYearUb,
  firstSlotOnOrAfterUb,
  isoDowMon1Sun7Ub,
  startOfTodayUbMs,
  ubYmdFromMs,
  ubYmdHmToUtcMs,
} from "./schoolTimezone";

const DEFAULT_EXAM_DURATION_MINUTES = 90;

/** ISO instant-ыг floor-оос хойш болгох: ижил UTC цагийг хадгалж 7 хоног нэмнэ. */
function bumpIsoUntilOnOrAfter(iso: string, floor: Date): string | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const d = new Date(t.getTime());
  for (let i = 0; i < 200; i++) {
    if (d.getTime() >= floor.getTime()) return d.toISOString();
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d.getTime() >= floor.getTime() ? d.toISOString() : null;
}

function clampVariantsToPreferredWindow(
  variants: ExamVariantRow[],
  floorDate: Date,
  preferredYear: number,
): { variants: ExamVariantRow[]; clampNotes: string[] } {
  const clampNotes: string[] = [];
  const out = variants.map((v) => {
    let startTime = v.startTime;
    let d = new Date(startTime);
    if (Number.isNaN(d.getTime())) return v;

    if (d.getTime() < floorDate.getTime()) {
      const bumped = bumpIsoUntilOnOrAfter(startTime, floorDate);
      if (bumped) {
        clampNotes.push(
          `${v.id}: доод хязгаараас өмнө (7 хоног алхам) → ${bumped}`,
        );
        startTime = bumped;
        d = new Date(startTime);
      }
    }

    if (calendarYearUb(d.getTime()) !== preferredYear) {
      const aligned = alignStartToPreferredSchoolYear(
        startTime,
        preferredYear,
        floorDate.getTime(),
      );
      if (aligned) {
        clampNotes.push(`${v.id}: он ${preferredYear} болгож тохируулсан`);
        startTime = aligned;
        d = new Date(startTime);
      }
    }

    if (d.getTime() < floorDate.getTime()) {
      const bumped2 = bumpIsoUntilOnOrAfter(startTime, floorDate);
      if (bumped2) {
        clampNotes.push(`${v.id}: давтан floor шалгалт → ${bumped2}`);
        startTime = bumped2;
      }
    }

    const changed = startTime !== v.startTime;
    const extra =
      "Сервер: доод хязгаар/он тохируулга (AI-ийн анхны цагаас өөрчлөгдсөн байж болно).";
    const reason = changed
      ? [v.reason, extra].filter(Boolean).join(" — ")
      : v.reason;

    return { ...v, startTime, reason: reason ?? v.reason };
  });

  return { variants: out, clampNotes };
}

function variantsViolatePreferredWindow(
  norm: ExamVariantRow[],
  floorDate: Date,
  preferredYear: number,
): boolean {
  return norm.some((v) => {
    const t = new Date(v.startTime);
    return (
      Number.isNaN(t.getTime()) ||
      t.getTime() < floorDate.getTime() ||
      calendarYearUb(t.getTime()) !== preferredYear
    );
  });
}

/**
 * AI + clamp заримдаа preferredDate/оноос өмнөх instant үлдээж болох тул эцсийн алхамд
 * заавал floor болон он дээр тааруулна (алдаа гаргахгүй).
 */
function hardEnsureVariantsOnPreferred(
  variants: ExamVariantRow[],
  floorDate: Date,
  preferredYear: number,
): { variants: ExamVariantRow[]; notes: string[] } {
  const notes: string[] = [];
  const out = variants.map((v) => {
    let startTime = v.startTime;
    let t = new Date(startTime);
    if (Number.isNaN(t.getTime())) return v;

    const patch = (nextIso: string, tag: string) => {
      if (nextIso !== startTime) notes.push(`${v.id}: ${tag}`);
      startTime = nextIso;
      t = new Date(startTime);
    };

    if (calendarYearUb(t.getTime()) !== preferredYear) {
      const al = alignStartToPreferredSchoolYear(
        startTime,
        preferredYear,
        floorDate.getTime(),
      );
      if (al) patch(al, `он ${preferredYear}`);
    }

    if (t.getTime() < floorDate.getTime()) {
      const bumped = bumpIsoUntilOnOrAfter(startTime, floorDate);
      if (bumped) patch(bumped, "доод хязгаараас хойш (7 хоног)");
      else patch(floorDate.toISOString(), "доод хязгаар мөрөн шууд");
    }

    if (calendarYearUb(t.getTime()) !== preferredYear) {
      const al2 = alignStartToPreferredSchoolYear(
        startTime,
        preferredYear,
        floorDate.getTime(),
      );
      if (al2) patch(al2, `он давтан ${preferredYear}`);
      else patch(floorDate.toISOString(), "он last-resort");
    }

    if (t.getTime() < floorDate.getTime()) {
      patch(floorDate.toISOString(), "доод хязгаар давтан шууд");
    }

    const changed = startTime !== v.startTime;
    const extra =
      "Сервер: доод хязгаар/он шаардлагад нийцүүлсэн (автомат).";
    return {
      ...v,
      startTime,
      reason: changed
        ? [v.reason, extra].filter(Boolean).join(" — ")
        : v.reason,
    };
  });
  return { variants: out, notes };
}

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  GEMINI_MODEL: string;
  /** Анхны загвар 503/429 өгвөл дараагийн оролдлогод ашиглана (ж: gemini-2.0-flash). */
  GEMINI_MODEL_FALLBACK?: string;
}

type SchedulerMessageBody = {
  examId: string;
  classId: string;
  testId: string;
};

type PeriodRow = {
  id: number;
  startTime: string;
  endTime: string;
  periodNumber?: number | null;
};

type TeacherAvailabilityConstraint = {
  dayOfWeek: number;
  periodId: number;
  status: string;
  reason: string | null;
  startTime: string;
  endTime: string;
};

type TeacherScheduleConstraint = {
  classroomId: string | null;
  dayOfWeek: number;
  endTime: string;
  groupId: string;
  periodId: number;
  startTime: string;
  subjectId: string | null;
};

type ConfirmedExamConstraint = {
  classId: string;
  endTime: Date | null;
  id: string;
  roomId: string | null;
  startTime: Date;
  teacherId: string | null;
};

type VariantValidationContext = {
  availableRoomIds: Set<string>;
  classId: string;
  confirmedExams: ConfirmedExamConstraint[];
  examDurationMinutes: number;
  periods: PeriodRow[];
  schoolEventBlockers: Array<{
    endDate: Date;
    id: string;
    repeatPattern: string | null;
    startDate: Date;
    title: string;
  }>;
  teacherAvailabilityBusy: TeacherAvailabilityConstraint[];
  teacherOtherSchedules: TeacherScheduleConstraint[];
  teacherPreferred: TeacherAvailabilityConstraint[];
  teacherId: string | null;
};

function isExamEligibleRoom(room: {
  id?: string | null;
  name?: string | null;
  roomNumber?: string | null;
}) {
  const id = String(room.id ?? "")
    .trim()
    .toUpperCase();
  const name = String(room.name ?? "")
    .trim()
    .toLowerCase();
  const roomNumber = String(room.roomNumber ?? "")
    .trim()
    .toUpperCase();

  if (id.startsWith("CLOAK_") || roomNumber.startsWith("CLOAK_")) {
    return false;
  }

  if (name.includes("өлгүүр")) {
    return false;
  }

  return true;
}

function parseClockParts(hhmm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

function buildUbWindowForDate(
  anchorMs: number,
  startClock: string,
  endClock: string,
): { end: Date; start: Date } | null {
  const startParts = parseClockParts(startClock);
  const endParts = parseClockParts(endClock);
  if (!startParts || !endParts) return null;
  const { y, M, D } = ubYmdFromMs(anchorMs);
  const startMs = ubYmdHmToUtcMs(y, M, D, startParts.h, startParts.m);
  const endMs = ubYmdHmToUtcMs(y, M, D, endParts.h, endParts.m);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return null;
  }
  return {
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

function eventOverlapsVariant(
  event: { endDate: Date; repeatPattern: string | null; startDate: Date },
  variantStart: Date,
  variantEnd: Date,
): boolean {
  if (Number.isNaN(event.startDate.getTime()) || Number.isNaN(event.endDate.getTime())) {
    return false;
  }
  const repeat = String(event.repeatPattern ?? "NONE").toUpperCase();
  const durationMs = event.endDate.getTime() - event.startDate.getTime();
  if (durationMs <= 0) return false;

  if (repeat === "NONE") {
    return rangesOverlap(variantStart, variantEnd, event.startDate, event.endDate);
  }

  let cursor = new Date(event.startDate.getTime());
  for (let i = 0; i < 400; i += 1) {
    const occurrenceEnd = new Date(cursor.getTime() + durationMs);
    if (rangesOverlap(variantStart, variantEnd, cursor, occurrenceEnd)) {
      return true;
    }
    if (cursor.getTime() > variantEnd.getTime()) {
      return false;
    }
    if (repeat === "DAILY") {
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    } else if (repeat === "WEEKLY") {
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (repeat === "MONTHLY") {
      const next = new Date(cursor.getTime());
      next.setUTCMonth(next.getUTCMonth() + 1);
      cursor = next;
    } else {
      return false;
    }
  }
  return false;
}

function collectVariantConflictReasons(
  variant: ExamVariantRow,
  ctx: VariantValidationContext,
): string[] {
  const reasons: string[] = [];
  const start = new Date(variant.startTime);
  if (Number.isNaN(start.getTime())) {
    return ["Эхлэх цаг буруу байна."];
  }
  const end = new Date(start.getTime() + ctx.examDurationMinutes * 60 * 1000);
  const isoDay = isoDowMon1Sun7Ub(start.getTime());

  if (!ctx.availableRoomIds.has(variant.roomId)) {
    reasons.push(`Өрөө тохирохгүй: ${variant.roomId}`);
  }

  for (const slot of ctx.teacherAvailabilityBusy) {
    if (slot.dayOfWeek !== isoDay) continue;
    const window = buildUbWindowForDate(
      start.getTime(),
      slot.startTime,
      slot.endTime,
    );
    if (!window) continue;
    if (rangesOverlap(start, end, window.start, window.end)) {
      reasons.push(
        `Багш завгүй цагтай давхцаж байна${
          slot.reason ? ` (${slot.reason})` : ""
        }`,
      );
      break;
    }
  }

  for (const row of ctx.teacherOtherSchedules) {
    if (row.dayOfWeek !== isoDay) continue;
    const window = buildUbWindowForDate(
      start.getTime(),
      row.startTime,
      row.endTime,
    );
    if (!window) continue;
    if (rangesOverlap(start, end, window.start, window.end)) {
      reasons.push(`Багшийн өөр ангийн хичээлтэй давхцаж байна (${row.groupId})`);
      break;
    }
  }

  for (const exam of ctx.confirmedExams) {
    if (!exam.endTime || Number.isNaN(exam.endTime.getTime())) continue;
    if (!rangesOverlap(start, end, exam.startTime, exam.endTime)) continue;
    if (exam.classId === ctx.classId) {
      reasons.push(`Энэ ангийн баталгаажсан шалгалттай давхцаж байна (${exam.id})`);
      break;
    }
    if (exam.roomId && exam.roomId === variant.roomId) {
      reasons.push(`Өрөө давхцаж байна (${variant.roomId})`);
      break;
    }
    if (ctx.teacherId && exam.teacherId === ctx.teacherId) {
      reasons.push(`Багшийн баталгаажсан өөр шалгалттай давхцаж байна (${exam.classId})`);
      break;
    }
  }

  return reasons;
}

function sanitizeVariantsAgainstConstraints(
  variants: ExamVariantRow[],
  ctx: VariantValidationContext,
): { rejected: string[]; valid: ExamVariantRow[] } {
  const valid: ExamVariantRow[] = [];
  const rejected: string[] = [];

  for (const variant of variants) {
    const reasons = collectVariantConflictReasons(variant, ctx);
    if (reasons.length === 0) {
      valid.push(variant);
      continue;
    }
    rejected.push(`${variant.id}: ${reasons.join("; ")}`);
  }

  return { valid, rejected };
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  if (start === -1) {
    throw new Error("JSON объект олдсонгүй");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i += 1) {
    const ch = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch !== "}") continue;

    depth -= 1;
    if (depth === 0) {
      const raw = trimmed.slice(start, i + 1);
      return JSON.parse(raw) as Record<string, unknown>;
    }
  }

  throw new Error("JSON объект бүрэн хаагдсангүй");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Алдааны мессежийг текстээр шалгана (Google SDK + HTTP). */
function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("Service Unavailable") ||
    msg.includes("Resource exhausted") ||
    msg.includes("overloaded") ||
    msg.includes("UNAVAILABLE") ||
    /try again later/i.test(msg)
  );
}

function formatGeminiFailureMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("api key") &&
    (lower.includes("not valid") ||
      lower.includes("invalid") ||
      lower.includes("not found") ||
      lower.includes("configured") ||
      lower.includes("unauthorized"))
  ) {
    return `Gemini API түлхүүр буруу эсвэл тохируулагдаагүй байна. exam-schedule-consumer worker дээрх GOOGLE_AI_API_KEY / GEMINI_API_KEY secret-ээ шалгана уу. Техникийн дэлгэрэнгүй: ${raw.slice(0, 1200)}`;
  }

  if (lower.includes("reported as leaked") || lower.includes("api key was reported as leaked")) {
    return `Gemini API түлхүүрийг Google блоклосон байна. Шинэ API key үүсгээд exam-schedule-consumer worker-ийн secret-ийг шинэчилнэ үү. Техникийн дэлгэрэнгүй: ${raw.slice(0, 1200)}`;
  }

  if (
    lower.includes("model not found") ||
    (lower.includes("404") && lower.includes("models/")) ||
    lower.includes("not found for api version")
  ) {
    return `Gemini model тохирохгүй байна. exam-schedule-consumer-ийн GEMINI_MODEL-ийг шалгана уу. Техникийн дэлгэрэнгүй: ${raw.slice(0, 1200)}`;
  }

  if (lower.includes("403") || lower.includes("permission denied")) {
    return `Gemini руу хандах эрхгүй байна. API key, project permission, billing-ээ шалгана уу. Техникийн дэлгэрэнгүй: ${raw.slice(0, 1200)}`;
  }

  if (
    raw.includes("503") ||
    raw.includes("Service Unavailable") ||
    /high demand/i.test(raw)
  ) {
    return `Gemini түр завсарлагаатай (их ачаалал). Хэдэн секундын дараа дахин «Товлох» дарна уу. Техникийн дэлгэрэнгүй: ${raw.slice(0, 1200)}`;
  }
  if (raw.includes("429") || raw.includes("Resource exhausted")) {
    return `Gemini хэт олон хүсэлт. Түр хүлээгээд дахин оролдоно уу. ${raw.slice(0, 1200)}`;
  }
  return `AI алдаа: ${raw.slice(0, 2000)}`;
}

type PrimaryAnchorSlot = {
  dayOfWeek: number;
  periodId: number;
  periodNumber: number;
  startTime: string;
  classroomId: string | null;
};

/**
 * AI ажиллахгүй / JSON буруу үед: 3 санал.
 * A — ангийн master_schedules anchor slot; B — created_at + 1 цаг; C — сонгосон UB өдрийн эхний period-ийн эхлэл.
 */
function buildHeuristicThreeVariants(params: {
  /** max(сонгосон өдөр, өнөөдөр UB 00:00) */
  floor: Date;
  primaryAnchorSlots: PrimaryAnchorSlot[];
  allPeriods: { startTime: string }[];
  createdAtIso: string;
  defaultRoomId: string;
  anchorRoomId: string | null;
}): ExamVariantRow[] {
  const {
    floor,
    primaryAnchorSlots,
    allPeriods,
    createdAtIso,
    defaultRoomId,
    anchorRoomId,
  } = params;
  const roomA = anchorRoomId ?? defaultRoomId;

  let startA = floor.toISOString();
  if (primaryAnchorSlots.length > 0) {
    const anchor = primaryAnchorSlots[0];
    const iso = firstSlotOnOrAfterUb(
      floor.getTime(),
      anchor.dayOfWeek,
      anchor.startTime,
    );
    if (iso) {
      startA = iso;
      const t = new Date(startA);
      if (!Number.isNaN(t.getTime()) && t.getTime() < floor.getTime()) {
        const bumped = bumpIsoUntilOnOrAfter(startA, floor);
        if (bumped) startA = bumped;
      }
    }
  }

  const createdMs = new Date(createdAtIso).getTime();
  const startBMs = Number.isNaN(createdMs)
    ? floor.getTime() + 3_600_000
    : createdMs + 3_600_000;
  const startB = new Date(startBMs).toISOString();

  const { y, M, D } = ubYmdFromMs(floor.getTime());
  const sortedPeriods = [...allPeriods].sort((a, b) =>
    String(a.startTime).localeCompare(String(b.startTime), "en"),
  );
  let startC = floor.toISOString();
  const firstP = sortedPeriods[0];
  if (firstP?.startTime) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(firstP.startTime).trim());
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      const ms = ubYmdHmToUtcMs(y, M, D, h, min);
      if (!Number.isNaN(ms)) startC = new Date(ms).toISOString();
    }
  }

  return [
    {
      id: "a",
      label: "Хувилбар A — ангийн үндсэн хичээлийн цаг",
      startTime: startA,
      roomId: roomA,
      reason: "Серверийн эвэр: тухайн ангийн anchor slot (master_schedules).",
    },
    {
      id: "b",
      label: "Хувилбар B — хүсэлт үүсгэснээс 1 цагийн дараа",
      startTime: startB,
      roomId: defaultRoomId,
      reason: "Серверийн эвэр: exam_schedules.created_at + 1 цаг.",
    },
    {
      id: "c",
      label: "Хувилбар C — тухайн өдрийн эхний цагийн үе",
      startTime: startC,
      roomId: defaultRoomId,
      reason: "Серверийн эвэр: сонгосон өдрийн хамгийн эрт period.start_time (UB).",
    },
  ];
}

/**
 * generateContent дээр 503/429 гэх мэт түр зуурын алдаанд exponential backoff + fallback model.
 */
async function generateContentTextWithRetry(
  genAI: GoogleGenerativeAI,
  primaryModel: string,
  fallbackModel: string | undefined,
  prompt: string,
): Promise<string> {
  const candidates = [primaryModel, fallbackModel?.trim()]
    .filter((m): m is string => Boolean(m))
    .filter((m, i, arr) => arr.indexOf(m) === i);

  const maxAttemptsPerModel = 5;
  let lastErr: unknown;

  for (const modelName of candidates) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.25,
      },
    });
    for (let attempt = 0; attempt < maxAttemptsPerModel; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (e) {
        lastErr = e;
        const retryable = isRetryableGeminiError(e);
        if (!retryable) throw e;
        if (attempt < maxAttemptsPerModel - 1) {
          const delayMs = Math.min(10_000, 800 * 2 ** attempt);
          await sleep(delayMs);
        }
      }
    }
  }

  throw lastErr;
}

async function runScheduler(
  env: Env,
  body: SchedulerMessageBody,
): Promise<void> {
  const db = getDb(env.DB);
  const { examId, classId } = body;

  const [current] = await db
    .select()
    .from(examSchedules)
    .where(eq(examSchedules.id, examId))
    .limit(1);

  if (!current) {
    console.warn(`exam_schedules олдсонгүй: ${examId}`);
    return;
  }
  if (current.status !== "pending") {
    console.warn(`Алгаслаа (pending биш): ${examId} → ${current.status}`);
    return;
  }

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, classId))
    .limit(1);

  const timetable = await db
    .select({
      id: masterSchedules.id,
      curriculumId: masterSchedules.curriculumId,
      classroomId: masterSchedules.classroomId,
      dayOfWeek: masterSchedules.dayOfWeek,
      periodId: masterSchedules.periodId,
      semesterId: masterSchedules.semesterId,
      isDraft: masterSchedules.isDraft,
      groupId: curriculum.groupId,
      subjectId: curriculum.subjectId,
      teacherId: curriculum.teacherId,
    })
    .from(masterSchedules)
    .innerJoin(curriculum, eq(curriculum.id, masterSchedules.curriculumId))
    .where(
      and(eq(curriculum.groupId, classId), eq(masterSchedules.isDraft, false)),
    );

  const schoolEventBlockers = await db
    .select()
    .from(schoolEvents)
    .where(eq(schoolEvents.isFullLock, true));

  const allPeriods = await db.select().from(periods).orderBy(asc(periods.id));

  const rooms = (await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.status, "AVAILABLE"))).filter(isExamEligibleRoom);

  if (rooms.length === 0) {
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning:
          "Шалгалтад тохирох танхим олдсонгүй (өлгүүр зэрэг шалгалтын бус өрөөнүүдийг хассан).",
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));
    return;
  }

  const apiKey = env.GOOGLE_AI_API_KEY?.trim() || env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning:
          "GOOGLE_AI_API_KEY эсвэл GEMINI_API_KEY тохируулаагүй.",
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));
    return;
  }

  const primaryModel = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const fallbackModel = env.GEMINI_MODEL_FALLBACK?.trim() || "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(apiKey);

  const roomIds = rooms.map((r) => r.id).join(", ");
  const preferredStart = new Date(current.startTime);
  const preferredStartIso = preferredStart.toISOString();
  /** Сургуулийн календарийн он (Asia/Ulaanbaatar) — UTC онтой хольж болохгүй. */
  const preferredYear = calendarYearUb(preferredStart.getTime());

  /** Хайлт/clamp-ийн доод хязгаар: сонгосон өдөр ба өнөөдөр UB-ийн хамгийн ихийг авна (дулаан хуанлиар ухрахгүй). */
  const todayStartUbMs = startOfTodayUbMs();
  const scheduleFloorMs = Math.max(preferredStart.getTime(), todayStartUbMs);
  const scheduleFloor = new Date(scheduleFloorMs);
  const scheduleFloorIso = scheduleFloor.toISOString();

  const [teacherRow] = await db
    .select({
      id: users.id,
      shortName: users.shortName,
      workLoadLimit: users.workLoadLimit,
    })
    .from(curriculum)
    .innerJoin(users, eq(users.id, curriculum.teacherId))
    .where(eq(curriculum.groupId, classId))
    .limit(1);
  const teacherId = teacherRow?.id ? String(teacherRow.id) : null;

  const availableRooms = rooms.filter(
    (r) => Number(r.capacity ?? 0) >= Number(group?.studentCount ?? 30),
  );
  const [examRow] = await db
    .select({
      title: newExams.title,
      durationMinutes: newExams.durationMinutes,
    })
    .from(newExams)
    .where(eq(newExams.id, body.testId))
    .limit(1);
  const examDurationMinutes =
    typeof examRow?.durationMinutes === "number" &&
    Number.isFinite(examRow.durationMinutes) &&
    examRow.durationMinutes > 0
      ? Math.floor(examRow.durationMinutes)
      : DEFAULT_EXAM_DURATION_MINUTES;
  const periodById = new Map(allPeriods.map((p) => [Number(p.id), p]));
  const primaryAnchorSlots = timetable
    .map((row) => {
      const period = periodById.get(Number(row.periodId));
      if (!period) return null;
      return {
        dayOfWeek: Number(row.dayOfWeek),
        periodId: Number(row.periodId),
        periodNumber: Number(period.periodNumber),
        startTime: String(period.startTime),
        classroomId: row.classroomId ? String(row.classroomId) : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber,
    );

  const teacherAvailabilityRows = teacherId
    ? await db
        .select({
          dayOfWeek: teacherAvailability.dayOfWeek,
          periodId: teacherAvailability.periodId,
          reason: teacherAvailability.reason,
          startTime: periods.startTime,
          endTime: periods.endTime,
          status: teacherAvailability.status,
        })
        .from(teacherAvailability)
        .innerJoin(periods, eq(periods.id, teacherAvailability.periodId))
        .where(eq(teacherAvailability.teacherId, teacherId))
    : [];

  const teacherOtherSchedules = teacherId
    ? await db
        .select({
          classroomId: masterSchedules.classroomId,
          dayOfWeek: masterSchedules.dayOfWeek,
          endTime: periods.endTime,
          groupId: curriculum.groupId,
          periodId: masterSchedules.periodId,
          startTime: periods.startTime,
          subjectId: curriculum.subjectId,
        })
        .from(masterSchedules)
        .innerJoin(curriculum, eq(curriculum.id, masterSchedules.curriculumId))
        .innerJoin(periods, eq(periods.id, masterSchedules.periodId))
        .where(
          and(
            eq(curriculum.teacherId, teacherId),
            eq(masterSchedules.isDraft, false),
          ),
        )
    : [];

  const confirmedExamRows = await db
    .select({
      classId: examSchedules.classId,
      endTime: examSchedules.endTime,
      id: examSchedules.id,
      roomId: examSchedules.roomId,
      startTime: examSchedules.startTime,
      teacherId: curriculum.teacherId,
    })
    .from(examSchedules)
    .leftJoin(curriculum, eq(curriculum.groupId, examSchedules.classId))
    .where(eq(examSchedules.status, "confirmed"));

  const validationContext: VariantValidationContext = {
    availableRoomIds: new Set(rooms.map((room) => String(room.id))),
    classId,
    confirmedExams: confirmedExamRows
      .filter((row) => row.id !== examId)
      .map((row) => ({
        classId: String(row.classId),
        endTime: row.endTime instanceof Date ? row.endTime : row.endTime ? new Date(row.endTime as unknown as string) : null,
        id: String(row.id),
        roomId: row.roomId ? String(row.roomId) : null,
        startTime:
          row.startTime instanceof Date
            ? row.startTime
            : new Date(row.startTime as unknown as string),
        teacherId: row.teacherId ? String(row.teacherId) : null,
      }))
      .filter((row) => !Number.isNaN(row.startTime.getTime())),
    examDurationMinutes,
    periods: allPeriods.map((row) => ({
      id: Number(row.id),
      startTime: String(row.startTime),
      endTime: String(row.endTime),
      periodNumber: Number(row.periodNumber),
    })),
    schoolEventBlockers: schoolEventBlockers
      .map((row) => ({
        endDate:
          row.endDate instanceof Date
            ? row.endDate
            : new Date(row.endDate as unknown as string),
        id: String(row.id),
        repeatPattern: row.repeatPattern ?? null,
        startDate:
          row.startDate instanceof Date
            ? row.startDate
            : new Date(row.startDate as unknown as string),
        title: String(row.title ?? "Эвент"),
      }))
      .filter(
        (row) =>
          !Number.isNaN(row.startDate.getTime()) &&
          !Number.isNaN(row.endDate.getTime()) &&
          row.endDate.getTime() > row.startDate.getTime(),
      ),
    teacherAvailabilityBusy: teacherAvailabilityRows
      .filter((row) => String(row.status).toUpperCase() === "BUSY")
      .map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        periodId: Number(row.periodId),
        reason: row.reason ? String(row.reason) : null,
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        status: String(row.status),
      })),
    teacherOtherSchedules: teacherOtherSchedules
      .filter((row) => String(row.groupId) !== classId)
      .map((row) => ({
        classroomId: row.classroomId ? String(row.classroomId) : null,
        dayOfWeek: Number(row.dayOfWeek),
        endTime: String(row.endTime),
        groupId: String(row.groupId),
        periodId: Number(row.periodId),
        startTime: String(row.startTime),
        subjectId: row.subjectId ? String(row.subjectId) : null,
      })),
    teacherPreferred: teacherAvailabilityRows
      .filter((row) => String(row.status).toUpperCase() === "PREFERENCE")
      .map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        periodId: Number(row.periodId),
        reason: row.reason ? String(row.reason) : null,
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        status: String(row.status),
      })),
    teacherId,
  };

  /** AI алдаа / буруу JSON үед 3 хувилбарыг эвэрүүдээр хадгална. Амжилтгүй бол false. */
  const saveHeuristicFallback = async (failureDetail: string): Promise<boolean> => {
    const defaultRoomRow = availableRooms[0] ?? rooms[0];
    if (!defaultRoomRow) return false;
    const defaultRoomId = String(defaultRoomRow.id);

    let anchorRoomId: string | null = null;
    if (primaryAnchorSlots.length > 0) {
      const cid = primaryAnchorSlots[0].classroomId;
      if (cid && availableRooms.some((r) => String(r.id) === cid)) {
        anchorRoomId = cid;
      }
    }

    const raw = buildHeuristicThreeVariants({
      floor: scheduleFloor,
      primaryAnchorSlots,
      allPeriods,
      createdAtIso: String(current.createdAt),
      defaultRoomId,
      anchorRoomId,
    });

    let normalized = raw;
    const c1 = clampVariantsToPreferredWindow(
      normalized,
      scheduleFloor,
      preferredYear,
    );
    normalized = c1.variants;
    const hard = hardEnsureVariantsOnPreferred(
      normalized,
      scheduleFloor,
      preferredYear,
    );
    normalized = hard.variants;
    const clampNotes = [...c1.clampNotes, ...hard.notes];

    const validated = sanitizeVariantsAgainstConstraints(
      normalized,
      validationContext,
    );
    normalized = validated.valid;
    const validationNotes =
      validated.rejected.length > 0
        ? [`[Сервер: зөрчилтэй хувилбар хасагдсан] ${validated.rejected.join("; ")}`]
        : [];

    if (normalized.length < 2) {
      return false;
    }

    for (const v of normalized) {
      if (!rooms.some((r) => r.id === v.roomId)) return false;
      if (Number.isNaN(new Date(v.startTime).getTime())) return false;
    }

    const summary =
      `AI түр ажиллаагүй эсвэл хариу хангалтгүй байсан тул сервер 3 хувилбарыг эвэрүүдээр үүсгэв.\n${failureDetail}\n\n` +
      (clampNotes.length > 0
        ? `[Сервер: доод хязгаар/он тохируулга] ${clampNotes.join("; ")}\n\n`
        : "") +
      (validationNotes.length > 0 ? `${validationNotes.join("\n")}\n\n` : "") +
      `A — ангийн үндсэн хичээлийн slot; B — хүсэлт үүсгэснээс 1 цагийн дараа; C — сонгосон өдрийн эхний period-ийн эхлэл (UB).`;

    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "suggested",
        aiVariantsJson: JSON.stringify(normalized),
        aiReasoning: summary.slice(0, 4000),
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));

    console.log(
      "[exam-schedule-consumer] AI амжилтгүй → эвэрүүдлийн 3 хувилбар хадгалагдлаа",
      JSON.stringify({
        examId,
        failureDetail: failureDetail.slice(0, 1200),
        variants: normalized.map((v) => ({
          id: v.id,
          label: v.label,
          startTime: v.startTime,
          roomId: v.roomId,
        })),
      }),
    );
    return true;
  };

  const applyAnchorFix = (norm: ExamVariantRow[]): ExamVariantRow[] => {
    const anchorKeys = new Set(
      primaryAnchorSlots.map((slot) => `${slot.dayOfWeek}:${slot.periodId}`),
    );
    const hasAnchorVariant = norm.some((v) => {
      const t = new Date(v.startTime);
      if (Number.isNaN(t.getTime())) return false;
      const isoDay = isoDowMon1Sun7Ub(t.getTime());
      const periodId =
        typeof (v as unknown as { periodId?: unknown }).periodId === "number"
          ? Number((v as unknown as { periodId?: unknown }).periodId)
          : null;
      return periodId != null && anchorKeys.has(`${isoDay}:${periodId}`);
    });

    if (!hasAnchorVariant && primaryAnchorSlots.length > 0 && availableRooms.length > 0) {
      const anchor = primaryAnchorSlots[0];
      const anchorStartIso = firstSlotOnOrAfterUb(
        scheduleFloor.getTime(),
        anchor.dayOfWeek,
        anchor.startTime,
      );
      const anchorRoom =
        anchor.classroomId &&
        availableRooms.some((r) => String(r.id) === anchor.classroomId)
          ? anchor.classroomId
          : String(availableRooms[0].id);

      if (anchorStartIso) {
        let anchorStart = anchorStartIso;
        const anchorT = new Date(anchorStart);
        if (
          !Number.isNaN(anchorT.getTime()) &&
          anchorT.getTime() < scheduleFloor.getTime()
        ) {
          const bumped = bumpIsoUntilOnOrAfter(anchorStart, scheduleFloor);
          if (bumped) anchorStart = bumped;
        }
        return [
          {
            ...norm[0],
            id: norm[0]?.id || "a",
            label: norm[0]?.label || "Хувилбар A — үндсэн хичээлийн цаг дээр",
            startTime: anchorStart,
            roomId: anchorRoom,
            reason:
              "Тухайн ангийн үндсэн хичээлийн slot дээр суурилуулсан anchor хувилбар.",
          },
          ...norm.slice(1),
        ];
      }
    }
    return norm;
  };

  const prompt = `Чи 1-р сургуулийн сургалтын албаны хуваарь төлөвлөгч AI.

ОЛОН ДАВХАРГАТ ХУАНЛИ (Multi-Layer Calendar) — эдгээр давхаргыг хольж биш ДАВХАРЛАЖ үзнэ:

• Давхарга 1 — ҮНДСЭН ХУВААРЬ (Primary schedule): тогтмол хичээлийн цаг. Ерөнхийдөө conflict-оос зайлсхий.
• Давхарга 2 — ШАЛГАЛТЫН ХУВААРЬ (Exam calendar): чи зөвхөн энд OUTPUT өгнө — доорх JSON хариултын variants.
• Давхарга 3 — СУРГУУЛИЙН АРГА ХЭМЖЭЭ (School events): бүх анги/багшид хамаарах GLOBAL BLOCKER. Эдгээр цагуудыг тооцоололд ХАМГИЙН ТҮРҮҮНД хасна (одоогоор жагсаалт хоосон бол ч гэсэн ирээдүйд энд ирнэ).

Анги: ${classId}
Сурагчдын тоо: ${group?.studentCount ?? 30}
Багш: ${teacherRow?.shortName ?? "—"} (Өдөрт max ${teacherRow?.workLoadLimit ?? 6} цаг)
Шалгалтын нэр: ${examRow?.title ?? body.testId}
Шалгалтын үргэлжлэх хугацаа: ${examDurationMinutes} минут
Багшийн хүссэн эхлэх огноо (preferredDate, сонгосон өдрийн UB шөнө): ${preferredStartIso}
Хамгийн эрт эхлэх боломжит цаг — доод хязгаар (max(сонгосон өдөр, өнөөдөр UB 00:00), ISO): ${scheduleFloorIso}
Зөвшөөрөгдөх он: ${preferredYear}

ДАВХАРГА 1 — master_schedules (JSON, constraint): ${JSON.stringify(timetable)}
ANCHOR SLOT-ууд (яг энэ ангийн өөрийн үндсэн хичээлийн slot-ууд): ${JSON.stringify(primaryAnchorSlots)}
БАГШИЙН ЗАВГҮЙ ЦАГ (teacher_availability BUSY, hard block): ${JSON.stringify(
    validationContext.teacherAvailabilityBusy,
  )}
БАГШИЙН ДУРТАЙ ЦАГ (teacher_availability PREFERENCE, soft signal): ${JSON.stringify(
    validationContext.teacherPreferred,
  )}
БАГШИЙН БУСАД АНГИЙН ХУВААРЬ (teacher other classes, hard block): ${JSON.stringify(
    validationContext.teacherOtherSchedules,
  )}
БАТАЛГААЖСАН ШАЛГАЛТУУД (room/class/teacher conflict шалгана): ${JSON.stringify(
    validationContext.confirmedExams.map((row) => ({
      id: row.id,
      classId: row.classId,
      roomId: row.roomId,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime?.toISOString() ?? null,
      teacherId: row.teacherId,
    })),
  )}
ДАВХАРГА 3 — school_events blockers (JSON): ${JSON.stringify(schoolEventBlockers)}
Periods (JSON): ${JSON.stringify(allPeriods)}
Боломжит танхимууд (JSON): ${JSON.stringify(rooms)}

ДҮРЭМ:
1. Давхарга 3-д цаг орсон бол тэр хугацаанд шалгалтын startTime байх ёсгүй.
2. Шалгалт ${examDurationMinutes} минут.
3. roomId зөвхөн: [${roomIds}]
4. ТАНХИМ: capacity >= ${group?.studentCount ?? 30} байх өрөөг сонго.
5. СОФТ: сурагчид өдөрт олон шалгалт — боломжит бол өөр өдөр сонго.
6. ЗААВАЛ: 3 хувилбарын дор хаяж 1 нь ANCHOR SLOT-уудын НЭГ дээр яг таарсан байх ёстой.
7. Ялангуяа Variant A-г ANCHOR SLOT дээр тавь. Өөрөөр хэлбэл Variant A-ийн periodId / startTime нь дээрх anchor slot-ийн аль нэгтэй таарах ёстой.
8. Үлдсэн Variant B/C нь anchor slot байж болно, эсвэл өөр оновчтой хувилбар байж болно.
8.1. Тухайн ангийн өөрийн ХИЧЭЭЛИЙН ӨРӨӨ болон өөрийн ХИЧЭЭЛИЙН ЦАГ дээр шалгалт авах нь ЗӨВШӨӨРӨГДӨНӨ, боломжтой бол үүнийг давуу сонго.
9. startTime нь ДЭЭРХ ДООД ХЯЗГААРААС (${scheduleFloorIso}) ӨМНӨ байж БОЛОХГҮЙ. Долоо хоногийн Даваагаас автоматаар бүү эхлэ — зөвхөн энэ доод хязгаараас хойш slot сонго.
10. startTime нь ЗААВАЛ ${preferredYear} он дотор байх ёстой. 2024/2025 гэх мэт өөр он руу БИТГИЙ төлөвлө.
11. Хэрэв эргэлзээтэй бол доод хязгаартай хамгийн ойр, түүнээс хойших боломжит slot-уудыг сонго.
12. teacher_availability.status = "BUSY" мөрүүдтэй давхцахыг ХАТУУ ХОРИГЛО.
13. Багшийн бусад ангийн үндсэн хичээлтэй давхцахыг ХАТУУ ХОРИГЛО.
14. Баталгаажсан шалгалтын room/class/teacher overlap-оос ХАТУУ зайлсхий.
15. teacher_availability.status = "PREFERENCE" байвал тэдгээрийг боломжит хувилбаруудад давуу үз.

Хариултыг ЗӨВХӨН нэг JSON объектоор:
{
  "summary": "Нийт товч дүгнэлт (монгол)",
  "variants": [
    { "id": "a", "label": "Хувилбар A — товч нэр", "startTime": "ISO8601", "periodId": number, "roomId": "id", "reason": "яагаад" },
    { "id": "b", "label": "Хувилбар B — ...", "startTime": "ISO8601", "periodId": number, "roomId": "id", "reason": "..." },
    { "id": "c", "label": "Хувилбар В — ...", "startTime": "ISO8601", "periodId": number, "roomId": "id", "reason": "..." }
  ]
}`;

  let parsedRoot: Record<string, unknown>;
  try {
    const text = await generateContentTextWithRetry(
      genAI,
      primaryModel,
      fallbackModel,
      prompt,
    );
    parsedRoot = extractJsonObject(text);
  } catch (e) {
    if (await saveHeuristicFallback(formatGeminiFailureMessage(e))) return;
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning: formatGeminiFailureMessage(e),
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));
    return;
  }

  let normalized: ExamVariantRow[] = [];
  let clampNotesForSummary: string[] = [];

  for (let repairPass = 0; repairPass < 2; repairPass++) {
    const rawVariants = parsedRoot.variants;
    if (!Array.isArray(rawVariants) || rawVariants.length < 2) {
      if (
        await saveHeuristicFallback(
          "AI хариу variants массив 2+ элементгүй (эсвэл variants байхгүй).",
        )
      )
        return;
      const now = new Date().toISOString();
      await db
        .update(examSchedules)
        .set({
          status: "failed",
          aiReasoning: "AI хариу variants массив 2+ элементгүй.",
          updatedAt: now,
        })
        .where(eq(examSchedules.id, examId));
      return;
    }

    const jsonStr = JSON.stringify(rawVariants);
    let next = parseAiVariantsJson(jsonStr);
    if (next.length < 2) {
      if (
        await saveHeuristicFallback(
          "AI variants баталгаажуулахад шаардлага хангасангүй (id/label/startTime/roomId дутуу).",
        )
      )
        return;
      const now = new Date().toISOString();
      await db
        .update(examSchedules)
        .set({
          status: "failed",
          aiReasoning: "AI variants баталгаажуулахад шаардлага хангасангүй.",
          updatedAt: now,
        })
        .where(eq(examSchedules.id, examId));
      return;
    }

    next = applyAnchorFix(next);
    const clamped = clampVariantsToPreferredWindow(next, scheduleFloor, preferredYear);
    next = clamped.variants;
    clampNotesForSummary = clamped.clampNotes;

    if (!variantsViolatePreferredWindow(next, scheduleFloor, preferredYear)) {
      normalized = next;
      break;
    }

    if (repairPass === 1) {
      if (
        await saveHeuristicFallback(
          `доод хязгаар (${scheduleFloorIso}) / он ${preferredYear} засварлахад хангалтгүй (clamp + retry).`,
        )
      )
        return;
      const now = new Date().toISOString();
      await db
        .update(examSchedules)
        .set({
          status: "failed",
          aiReasoning: `доод хязгаар (${scheduleFloorIso}) / он ${preferredYear} засварлахад хангалтгүй (clamp + retry).`,
          updatedAt: now,
        })
        .where(eq(examSchedules.id, examId));
      return;
    }

    try {
      const repairPrompt = `Өмнөх JSON хариу буруу: variants[].startTime нь заавал ${scheduleFloorIso} (доод хязгаар)-аас хойш эсвэл тэнцүү, мөн он ${preferredYear} байх ёстой.

ЗӨВХӨН нэг JSON объект буцаа: "summary" (монгол) + "variants" массив (дор хаяж 2 элемент), бүх startTime нь ISO8601.

Өмнөх буруу/эргэлзээтэй хариу:
${JSON.stringify(parsedRoot).slice(0, 12000)}`;

      const repairText = await generateContentTextWithRetry(
        genAI,
        primaryModel,
        fallbackModel,
        repairPrompt,
      );
      parsedRoot = extractJsonObject(repairText);
    } catch (e) {
      if (
        await saveHeuristicFallback(
          `AI засварлах дуудлага: ${formatGeminiFailureMessage(e)}`,
        )
      )
        return;
      const now = new Date().toISOString();
      await db
        .update(examSchedules)
        .set({
          status: "failed",
          aiReasoning: `AI засварлах дуудлага: ${formatGeminiFailureMessage(e)}`,
          updatedAt: now,
        })
        .where(eq(examSchedules.id, examId));
      return;
    }
  }

  if (normalized.length < 2) {
    if (
      await saveHeuristicFallback(
        "preferredDate / он шаардлагыг хангасан хувилбар үүсгэж чадсангүй (2+ санал шаардлагатай).",
      )
    )
      return;
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning:
          "preferredDate / он шаардлагыг хангасан хувилбар үүсгэж чадсангүй (2+ санал шаардлагатай).",
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));
    return;
  }

  const finalClamp = clampVariantsToPreferredWindow(
    normalized,
    scheduleFloor,
    preferredYear,
  );
  normalized = finalClamp.variants;
  clampNotesForSummary = [
    ...clampNotesForSummary,
    ...finalClamp.clampNotes,
  ];

  const hard = hardEnsureVariantsOnPreferred(
    normalized,
    scheduleFloor,
    preferredYear,
  );
  normalized = hard.variants;
  if (hard.notes.length > 0) {
    clampNotesForSummary = [...clampNotesForSummary, ...hard.notes];
  }

  for (const v of normalized) {
    if (!rooms.some((r) => r.id === v.roomId)) {
      if (
        await saveHeuristicFallback(
          `AI саналд буруу roomId: ${v.roomId} (эвэрүүдээр дахин үүсгэв).`,
        )
      )
        return;
      const now = new Date().toISOString();
      await db
        .update(examSchedules)
        .set({
          status: "failed",
          aiReasoning: `Буруу roomId саналд: ${v.roomId}`,
          updatedAt: now,
        })
        .where(eq(examSchedules.id, examId));
      return;
    }
    const t = new Date(v.startTime);
    if (Number.isNaN(t.getTime())) {
      if (
        await saveHeuristicFallback(
          `AI саналд буруу startTime: ${v.id} (эвэрүүдээр дахин үүсгэв).`,
        )
      )
        return;
      const now = new Date().toISOString();
      await db
        .update(examSchedules)
        .set({
          status: "failed",
          aiReasoning: `Буруу startTime: ${v.id}`,
          updatedAt: now,
        })
        .where(eq(examSchedules.id, examId));
      return;
    }
  }

  const validated = sanitizeVariantsAgainstConstraints(
    normalized,
    validationContext,
  );
  normalized = validated.valid;
  if (normalized.length < 2) {
    if (
      await saveHeuristicFallback(
        `AI санал серверийн conflict шалгалтаар унасан: ${validated.rejected.join("; ")}`,
      )
    )
      return;
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning: `AI санал серверийн conflict шалгалтаар унасан: ${validated.rejected.join("; ")}`.slice(
          0,
          4000,
        ),
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));
    return;
  }

  const summaryBase =
    typeof parsedRoot.summary === "string"
      ? parsedRoot.summary.slice(0, 4000)
      : "AI 3 хувилбар санал болголоо. Багш нэгийг сонгож батална.";
  const summary =
    [
      clampNotesForSummary.length > 0
        ? `[Сервер: доод хязгаар/он тохируулга] ${clampNotesForSummary.join("; ")}`
        : null,
      validated.rejected.length > 0
        ? `[Сервер: зөрчилтэй хувилбар хасагдсан] ${validated.rejected.join("; ")}`
        : null,
      summaryBase,
    ]
      .filter(Boolean)
      .join("\n\n");

  const now = new Date().toISOString();

  await db
    .update(examSchedules)
    .set({
      status: "suggested",
      aiVariantsJson: JSON.stringify(normalized),
      aiReasoning: summary,
      updatedAt: now,
    })
    .where(eq(examSchedules.id, examId));
}

export default {
  async queue(
    batch: MessageBatch<SchedulerMessageBody>,
    env: Env,
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await runScheduler(env, message.body);
      } catch (e) {
        console.error("exam-schedule-consumer:", e);
        throw e;
      }
    }
  },
};
