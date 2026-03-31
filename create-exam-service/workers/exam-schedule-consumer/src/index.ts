import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "../../../src/db";
import {
  classrooms,
  curriculum,
  examSchedules,
  masterSchedules,
  periods,
  schoolEvents,
  users,
  groups,
} from "../../../src/db/schema";
import { parseAiVariantsJson } from "../../../src/lib/exam-schedule-variants";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  GEMINI_MODEL: string;
}

type SchedulerMessageBody = {
  examId: string;
  classId: string;
  testId: string;
};

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

function isoForWeekdayAndClock(
  preferredDate: Date,
  isoDay: number,
  hhmm: string,
): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;

  const base = new Date(preferredDate);
  const jsDay = base.getDay(); // 0=Sun .. 6=Sat
  const baseIsoDay = jsDay === 0 ? 7 : jsDay;
  const delta = isoDay - baseIsoDay;
  base.setDate(base.getDate() + delta);
  base.setHours(h, min, 0, 0);
  return base.toISOString();
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

  const rooms = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.status, "AVAILABLE"));

  if (rooms.length === 0) {
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning: "Танхимын мэдээлэл (classrooms) хоосон байна.",
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

  const modelName = env.GEMINI_MODEL?.trim() || "gemini-flash-latest";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.25,
    },
  });

  const roomIds = rooms.map((r) => r.id).join(", ");

  const [teacherRow] = await db
    .select({
      shortName: users.shortName,
      workLoadLimit: users.workLoadLimit,
    })
    .from(curriculum)
    .innerJoin(users, eq(users.id, curriculum.teacherId))
    .where(eq(curriculum.groupId, classId))
    .limit(1);

  const availableRooms = rooms.filter(
    (r) => Number(r.capacity ?? 0) >= Number(group?.studentCount ?? 30),
  );
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

  const prompt = `Чи 1-р сургуулийн сургалтын албаны хуваарь төлөвлөгч AI.

ОЛОН ДАВХАРГАТ ХУАНЛИ (Multi-Layer Calendar) — эдгээр давхаргыг хольж биш ДАВХАРЛАЖ үзнэ:

• Давхарга 1 — ҮНДСЭН ХУВААРЬ (Primary schedule): тогтмол хичээлийн цаг. Ерөнхийдөө conflict-оос зайлсхий.
• Давхарга 2 — ШАЛГАЛТЫН ХУВААРЬ (Exam calendar): чи зөвхөн энд OUTPUT өгнө — доорх JSON хариултын variants.
• Давхарга 3 — СУРГУУЛИЙН АРГА ХЭМЖЭЭ (School events): бүх анги/багшид хамаарах GLOBAL BLOCKER. Эдгээр цагуудыг тооцоололд ХАМГИЙН ТҮРҮҮНД хасна (одоогоор жагсаалт хоосон бол ч гэсэн ирээдүйд энд ирнэ).

Анги: ${classId}
Сурагчдын тоо: ${group?.studentCount ?? 30}
Багш: ${teacherRow?.shortName ?? "—"} (Өдөрт max ${teacherRow?.workLoadLimit ?? 6} цаг)

ДАВХАРГА 1 — master_schedules (JSON, constraint): ${JSON.stringify(timetable)}
ANCHOR SLOT-ууд (яг энэ ангийн өөрийн үндсэн хичээлийн slot-ууд): ${JSON.stringify(primaryAnchorSlots)}
ДАВХАРГА 3 — school_events blockers (JSON): ${JSON.stringify(schoolEventBlockers)}
Periods (JSON): ${JSON.stringify(allPeriods)}
Боломжит танхимууд (JSON): ${JSON.stringify(rooms)}

ДҮРЭМ:
1. Давхарга 3-д цаг орсон бол тэр хугацаанд шалгалтын startTime байх ёсгүй.
2. Шалгалт 90 минут.
3. roomId зөвхөн: [${roomIds}]
4. ТАНХИМ: capacity >= ${group?.studentCount ?? 30} байх өрөөг сонго.
5. СОФТ: сурагчид өдөрт олон шалгалт — боломжит бол өөр өдөр сонго.
6. ЗААВАЛ: 3 хувилбарын дор хаяж 1 нь ANCHOR SLOT-уудын НЭГ дээр яг таарсан байх ёстой.
7. Ялангуяа Variant A-г ANCHOR SLOT дээр тавь. Өөрөөр хэлбэл Variant A-ийн periodId / startTime нь дээрх anchor slot-ийн аль нэгтэй таарах ёстой.
8. Үлдсэн Variant B/C нь anchor slot байж болно, эсвэл өөр оновчтой хувилбар байж болно.

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
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    parsedRoot = extractJsonObject(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const now = new Date().toISOString();
    await db
      .update(examSchedules)
      .set({
        status: "failed",
        aiReasoning: `AI алдаа: ${msg.slice(0, 2000)}`,
        updatedAt: now,
      })
      .where(eq(examSchedules.id, examId));
    return;
  }

  const rawVariants = parsedRoot.variants;
  if (!Array.isArray(rawVariants) || rawVariants.length < 2) {
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
  let normalized = parseAiVariantsJson(jsonStr);
  if (normalized.length < 2) {
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

  const anchorKeys = new Set(
    primaryAnchorSlots.map((slot) => `${slot.dayOfWeek}:${slot.periodId}`),
  );
  const hasAnchorVariant = normalized.some((v) => {
    const t = new Date(v.startTime);
    if (Number.isNaN(t.getTime())) return false;
    const isoDay = t.getDay() === 0 ? 7 : t.getDay();
    const periodId =
      typeof (v as unknown as { periodId?: unknown }).periodId === "number"
        ? Number((v as unknown as { periodId?: unknown }).periodId)
        : null;
    return periodId != null && anchorKeys.has(`${isoDay}:${periodId}`);
  });

  if (!hasAnchorVariant && primaryAnchorSlots.length > 0 && availableRooms.length > 0) {
    const anchor = primaryAnchorSlots[0];
    const preferred = new Date(current.startTime);
    const anchorStartIso = isoForWeekdayAndClock(
      preferred,
      anchor.dayOfWeek,
      anchor.startTime,
    );
    const anchorRoom =
      (anchor.classroomId &&
      availableRooms.some((r) => String(r.id) === anchor.classroomId)
        ? anchor.classroomId
        : String(availableRooms[0].id));

    if (anchorStartIso) {
      normalized = [
        {
          ...normalized[0],
          id: normalized[0]?.id || "a",
          label: normalized[0]?.label || "Хувилбар A — үндсэн хичээлийн цаг дээр",
          startTime: anchorStartIso,
          roomId: anchorRoom,
          reason:
            "Тухайн ангийн үндсэн хичээлийн slot дээр суурилуулсан anchor хувилбар.",
        },
        ...normalized.slice(1),
      ];
    }
  }

  for (const v of normalized) {
    if (!rooms.some((r) => r.id === v.roomId)) {
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

  const summary =
    typeof parsedRoot.summary === "string"
      ? parsedRoot.summary.slice(0, 4000)
      : "AI 3 хувилбар санал болголоо. Багш нэгийг сонгож батална.";

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
