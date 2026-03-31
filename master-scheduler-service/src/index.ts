import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as schema from "./db/schema";
import { getDb } from "./db";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeRateLimit(msg: unknown) {
  const s = String(msg ?? "");
  return s.includes("429") || s.toLowerCase().includes("quota exceeded") || s.toLowerCase().includes("rate limit");
}

/** English / Mongolian day names or 1..7 → weekday number (1=Mon … 7=Sun). School week uses 1–5. */
function normalizeDayOfWeek(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    if (n >= 1 && n <= 7) return n;
    return undefined;
  }
  const s = String(raw).trim();
  if (!s) return undefined;
  const u = s.toUpperCase();
  const en: Record<string, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
    SUNDAY: 7,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
    SUN: 7,
  };
  if (en[u] != null) return en[u];
  const compact = s.replace(/\s+/g, "").toUpperCase();
  const mn: Record<string, number> = {
    ДАВАА: 1,
    МЯГМАР: 2,
    ЛХАГВА: 3,
    ПҮРЭВ: 4,
    БААСАН: 5,
    БЯМБА: 6,
    НЯМ: 7,
  };
  if (mn[compact] != null) return mn[compact];
  for (const [k, v] of Object.entries(mn)) {
    if (compact.includes(k)) return v;
  }
  return undefined;
}

/** periodNumber (within shift) → period row id; only periods matching group.shift. */
function buildPeriodNumberMapForShift(allPeriods: any[], groupShift: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of allPeriods) {
    if (Number(p.shift) !== Number(groupShift)) continue;
    const n = Number(p.periodNumber);
    if (!Number.isNaN(n) && p.id != null) m.set(n, Number(p.id));
  }
  return m;
}

function resolvePeriodId(
  it: any,
  periodByNumber: Map<number, number>,
  allPeriods: any[],
  groupShift: number,
): number | undefined {
  if (it?.periodId != null) {
    const want = Number(it.periodId);
    const row = allPeriods.find((p) => Number(p.id) === want);
    if (row && Number(row.shift) === Number(groupShift)) return want;
  }
  if (it?.periodNumber != null) {
    return periodByNumber.get(Number(it.periodNumber));
  }
  return undefined;
}

/**
 * classroomId must exist in DB. If missing/invalid, fall back to group's homeClassroomId (FK-safe).
 * Бид хуурамч "Unknown" ID оноохгүй — FK алдаа гарна.
 */
function resolveClassroomId(
  it: any,
  homeClassroomId: string | null | undefined,
  validClassroomIds: Set<string>,
): string | undefined {
  const raw = it?.classroomId;
  let id: string | undefined =
    raw == null ? undefined : typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (id && validClassroomIds.has(id)) return id;
  if (homeClassroomId && validClassroomIds.has(homeClassroomId)) return homeClassroomId;
  return undefined;
}

type SanitizeCtx = {
  semesterId: string;
  allowedCurriculumIds: Set<string>;
  groupShift: number;
  allPeriods: any[];
  homeClassroomId: string | null | undefined;
  validClassroomIds: Set<string>;
};

function sanitizeScheduleItems(items: unknown, ctx: SanitizeCtx) {
  const periodByNumber = buildPeriodNumberMapForShift(ctx.allPeriods, ctx.groupShift);
  const arr = Array.isArray(items) ? items : [];
  const out: any[] = [];
  const invalid: any[] = [];

  for (const raw of arr) {
    const it = raw && typeof raw === "object" ? { ...raw } : raw;
    if (!it || typeof it !== "object") continue;
    const curriculumId = (it as any).curriculumId;
    if (!ctx.allowedCurriculumIds.has(curriculumId)) continue;
    const semesterId = String((it as any).semesterId ?? ctx.semesterId);
    if (semesterId !== ctx.semesterId) continue;

    const dayOfWeek = normalizeDayOfWeek((it as any).dayOfWeek);
    const periodId = resolvePeriodId(it, periodByNumber, ctx.allPeriods, ctx.groupShift);
    const classroomId = resolveClassroomId(it, ctx.homeClassroomId, ctx.validClassroomIds);

    const row = {
      ...it,
      curriculumId,
      semesterId: ctx.semesterId,
      dayOfWeek,
      periodId,
      classroomId,
    };

    const bad =
      dayOfWeek == null ||
      dayOfWeek < 1 ||
      dayOfWeek > 7 ||
      periodId == null ||
      classroomId == null;

    if (bad) invalid.push(row);
    else out.push(row);
  }

  return { items: out, invalid };
}

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
}

async function listGeminiModels(apiKey: string) {
  const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { "content-type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ListModels failed (${res.status} ${res.statusText}) ${text}`.trim()
    );
  }

  return (await res.json()) as unknown;
}

function extractModelIdsFromListModelsResponse(data: any): string[] {
  const models = Array.isArray(data?.models) ? data.models : [];
  const ids = models
    .filter(
      (m: any) =>
        Array.isArray(m?.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent"),
    )
    .map((m: any) => String(m?.name ?? ""))
    .filter(Boolean)
    .map((name: string) => name.replace(/^models\//, ""));
  return Array.from(new Set(ids));
}

function extractJsonArray(text: string): string {
  const unfenced = (text ?? "").replace(/```json|```/g, "").trim();
  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  return start >= 0 && end >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
}

async function parseJsonArrayWithRepair(model: any, rawText: string): Promise<any[]> {
  const jsonText = extractJsonArray(rawText);
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const repairPrompt =
      `Fix the following into STRICT valid JSON (no markdown, no trailing commas). ` +
      `Output ONLY the JSON array.\n\n${jsonText}`;
    const repaired = await model.generateContent(repairPrompt);
    const repairedJson = extractJsonArray(repaired.response.text());
    const parsed2 = JSON.parse(repairedJson);
    return Array.isArray(parsed2) ? parsed2 : [];
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Fail fast with a clear message if GEMINI is not configured.
    const apiKey = (env.GEMINI_API_KEY ?? "").trim();

    if (url.pathname === "/models" && request.method === "GET") {
      try {
        if (!apiKey) {
          return Response.json(
            { error: "Missing GEMINI_API_KEY. Put it in master-scheduler-service/.dev.vars for local dev." },
            { status: 400 },
          );
        }
        const data = await listGeminiModels(apiKey);
        return Response.json(data);
      } catch (error: any) {
        return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
      }
    }

    if (url.pathname === "/test-ai" && request.method === "GET") {
      try {
        if (!apiKey) {
          return Response.json(
            { error: "Missing GEMINI_API_KEY. Put it in master-scheduler-service/.dev.vars for local dev." },
            { status: 400 },
          );
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
        });
        const result = await model.generateContent("Say only: OK");
        return Response.json({
          model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
          text: result.response.text(),
        });
      } catch (error: any) {
        return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
      }
    }

    if (url.pathname === "/test-db" && request.method === "GET") {
      try {
        const db = getDb(env.DB);
        const [c, g, r, p] = await Promise.all([
          db.query.curriculum.findMany({ columns: { id: true } }),
          db.query.groups.findMany({ columns: { id: true } }),
          db.query.classrooms.findMany({ columns: { id: true } }),
          db.query.periods.findMany({ columns: { id: true } }),
        ]);
        return Response.json({
          curriculum: c.length,
          groups: g.length,
          classrooms: r.length,
          periods: p.length,
        });
      } catch (error: any) {
        return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
      }
    }

    // POST /generate-all?semesterId=2026-SPRING&delayMs=2500
    if (url.pathname === "/generate-all" && request.method === "POST") {
      if (!apiKey) {
        return Response.json(
          { error: "Missing GEMINI_API_KEY. Put it in master-scheduler-service/.dev.vars for local dev." },
          { status: 400 },
        );
      }
      const semesterId = url.searchParams.get("semesterId") ?? "2026-SPRING";
      const delayMs = Number(url.searchParams.get("delayMs") ?? "2500");
      const retryDelayMs = Number(url.searchParams.get("retryDelayMs") ?? "10000");
      const maxRetries = Number(url.searchParams.get("maxRetries") ?? "2");
      const modelsParam = url.searchParams.get("models"); // comma-separated overrides

      const db = getDb(env.DB);
      const groups = await db.query.groups.findMany({ columns: { id: true } });
      const groupIds = groups.map((g) => g.id);

      const fallbackModels = [
        env.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-2.0-flash-lite",
      ].filter(Boolean) as string[];

      let discoveredModels: string[] = [];
      try {
        const data: any = await listGeminiModels(apiKey);
        discoveredModels = extractModelIdsFromListModelsResponse(data);
      } catch {
        discoveredModels = [];
      }

      const models = (
        modelsParam
          ? modelsParam.split(",")
          : discoveredModels.length > 0
            ? discoveredModels
            : fallbackModels
      )
        .map((m) => m.trim())
        .filter(Boolean);
      const uniqueModels = Array.from(new Set(models));
      let modelIdx = 0;
      const results: Array<{
        groupId: string;
        ok: boolean;
        status: number;
        model?: string;
        count?: number;
        inserted?: number;
        error?: string;
        attempts: number;
      }> = [];

      for (const groupId of groupIds) {
        let attempts = 0;
        while (true) {
          attempts += 1;
          const model = uniqueModels[modelIdx];
          if (!model) {
            const ok = results.filter((r) => r.ok).length;
            const failed = results.length - ok;
            const inserted = results.reduce((sum, r) => sum + (r.inserted ?? 0), 0);
            return Response.json(
              {
                success: false,
                semesterId,
                groupsAttempted: results.length,
                ok,
                failed,
                inserted,
                error:
                  "Out of models to rotate. Wait for quota reset or provide ?models=... to /generate-all.",
                results,
              },
              { status: 429 }
            );
          }
          // Internal-call: avoid self-HTTP with dev origin/port drift (prevents 404s).
          const res = await this.fetch(
            new Request(
              `http://internal/generate?groupId=${encodeURIComponent(groupId)}&semesterId=${encodeURIComponent(semesterId)}&model=${encodeURIComponent(model)}`,
              { method: "POST" },
            ),
            env,
          );
          const body: any = await res
            .json()
            .catch(async () => ({ error: await res.text().catch(() => "") }));

          const errMsg = body?.error;
          const rateLimited = res.status === 429 || looksLikeRateLimit(errMsg);

          if (rateLimited) {
            // Rotation strategy:
            // - First: retry same model a few times (short hiccup)
            // - Then: rotate to next model (daily per-model quota)
            if (attempts <= maxRetries) {
              await sleep(retryDelayMs);
              continue;
            }
            modelIdx += 1;
            attempts = 0;
            await sleep(retryDelayMs);
            continue;
          }

          if (res.ok) {
            results.push({
              groupId,
              ok: true,
              status: res.status,
              model,
              count: body?.count,
              inserted: body?.inserted,
              attempts,
            });
          } else {
            results.push({
              groupId,
              ok: false,
              status: res.status,
              model,
              error: errMsg ?? JSON.stringify(body),
              attempts,
            });

          }
          break;
        }

        if (delayMs > 0) await sleep(delayMs);
      }

      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      const inserted = results.reduce((sum, r) => sum + (r.inserted ?? 0), 0);
      return Response.json({
        success: true,
        semesterId,
        groups: results.length,
        ok,
        failed,
        inserted,
        results,
      });
    }

    // Зөвхөн POST /generate хүснэгтээр хандана
    if (url.pathname === "/generate" && request.method === "POST") {
      const semesterId = url.searchParams.get("semesterId") ?? "2026-SPRING";
      const groupId = url.searchParams.get("groupId");
      const modelOverride = url.searchParams.get("model")?.trim();
      if (!groupId) {
        return Response.json(
          {
            error:
              "Missing groupId. Use POST /generate?groupId=1A (optionally &semesterId=2026-SPRING). Batch generation is required to avoid timeouts.",
          },
          { status: 400 }
        );
      }

      const db = getDb(env.DB);
      if (!apiKey) {
        return Response.json(
          { error: "Missing GEMINI_API_KEY. Put it in master-scheduler-service/.dev.vars for local dev." },
          { status: 400 },
        );
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        // Default to a commonly supported model; override via GEMINI_MODEL.
        model: modelOverride ?? env.GEMINI_MODEL ?? "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      });

      try {
        // 1) ӨГӨГДӨЛ ТАТАХ (Batch: зөвхөн нэг анги)
        const [group, groupCurriculum, allRooms, allPeriods] = await Promise.all([
          db.query.groups.findFirst({
            where: (g, { eq }) => eq(g.id, groupId),
          }),
          db.query.curriculum.findMany({
            where: (c, { and, eq }) => and(eq(c.groupId, groupId), eq(c.semesterId, semesterId)),
          }),
          db.query.classrooms.findMany(),
          db.query.periods.findMany(),
        ]);

        if (!group) {
          return Response.json({ error: `Unknown groupId: ${groupId}` }, { status: 404 });
        }
        if (groupCurriculum.length === 0) {
          return Response.json(
            { error: `No curriculum for groupId=${groupId} semesterId=${semesterId}` },
            { status: 404 }
          );
        }

        // 2) Conflict data (teacher/room) from already-scheduled items this semester
        const existingSchedules = await db.query.masterSchedules.findMany({
          where: (ms, { eq }) => eq(ms.semesterId, semesterId),
          columns: {
            curriculumId: true,
            classroomId: true,
            dayOfWeek: true,
            periodId: true,
          },
        });

        const existingCurriculumIds = Array.from(
          new Set(existingSchedules.map((s) => s.curriculumId).filter(Boolean))
        ) as string[];
        const existingCurriculum =
          existingCurriculumIds.length === 0
            ? []
            : await db.query.curriculum.findMany({
                where: (c, { inArray }) => inArray(c.id, existingCurriculumIds),
                columns: { id: true, teacherId: true, groupId: true },
              });
        const teacherByCurriculumId = new Map(existingCurriculum.map((c) => [c.id, c.teacherId]));
        const groupByCurriculumId = new Map(existingCurriculum.map((c) => [c.id, c.groupId]));

        const occupiedTeacherSlots = existingSchedules
          .map((s) => ({
            teacherId: teacherByCurriculumId.get(s.curriculumId),
            dayOfWeek: s.dayOfWeek,
            periodId: s.periodId,
            groupId: groupByCurriculumId.get(s.curriculumId),
          }))
          .filter((x) => x.teacherId && x.groupId !== groupId);

        const occupiedRoomSlots = existingSchedules.map((s) => ({
          classroomId: s.classroomId,
          dayOfWeek: s.dayOfWeek,
          periodId: s.periodId,
        }));

        // Prompt-ыг жижиг/тоон байлгах
        const curriculum = groupCurriculum.map((c: any) => ({
          id: c.id,
          groupId: c.groupId,
          subjectId: c.subjectId,
          teacherId: c.teacherId,
          weeklyHours: c.weeklyHours,
          hoursPerSession: c.hoursPerSession,
          semesterId: c.semesterId,
        }));
        const teacherIdsThisGroup = new Set(curriculum.map((c: any) => c.teacherId).filter(Boolean));
        const groups = [
          {
            id: group.id,
            gradeLevel: group.gradeLevel,
            studentCount: group.studentCount,
            shift: group.shift,
            isAdvanced: group.isAdvanced,
            homeClassroomId: group.homeClassroomId,
          },
        ];
        // Reduce payload size: we mainly need valid IDs + types.
        const classrooms = allRooms.map((r: any) => ({
          id: r.id,
          type: r.type,
          capacity: r.capacity,
        }));
        const shiftPeriods = allPeriods
          .filter((p: any) => Number(p.shift) === Number(group.shift))
          .map((p: any) => ({
            id: p.id,
            shift: p.shift,
            periodNumber: p.periodNumber,
          }));
        // Keep legacy variable name used in retry prompts.
        const periods = shiftPeriods;

        const occupiedTeacherSlotsSmall = occupiedTeacherSlots.filter((s: any) =>
          teacherIdsThisGroup.has(s.teacherId),
        );
        // Room conflicts are the most common reason for silent drops (ON CONFLICT DO NOTHING).
        // Provide the full room occupancy so the model can avoid conflicts up-front.
        const occupiedRoomSlotsFull = occupiedRoomSlots;
        // Room conflicts can be enforced by DB unique index; keep a small hint set (LAB + home room only).
        const candidateRoomIds = new Set<string>();
        if (group.homeClassroomId) candidateRoomIds.add(String(group.homeClassroomId));
        for (const r of classrooms) if (String(r.type).toUpperCase() === "LAB") candidateRoomIds.add(String(r.id));
        const occupiedRoomSlotsSmall = occupiedRoomSlots.filter((s: any) => candidateRoomIds.has(String(s.classroomId)));

        // 3) AI PROMPT БЭЛДЭХ
        const prompt = `
          Чи бол Сургуулийн Хичээлийн Хуваарь Төлөвлөгч AI систем.
          Одоо зөвхөн нэг анги (groupId=${groupId}) болон semesterId=${semesterId}-ийн хуваарь гаргана.

          ӨГӨГДӨЛ (JSON):
          - Төлөвлөгөө (Curriculum): ${JSON.stringify(curriculum)}
          - Ангиуд (Groups): ${JSON.stringify(groups)}
          - Өрөөнүүд (Classrooms): ${JSON.stringify(classrooms)}
          - Цаг (Periods): ${JSON.stringify(shiftPeriods)}
          - Бөглөрсөн багшийн слот (This group's teachers): ${JSON.stringify(occupiedTeacherSlotsSmall)}
          - Бөглөрсөн өрөөний слот (All): ${JSON.stringify(occupiedRoomSlotsFull)}
          - Бөглөрсөн өрөөний слот (Hints only): ${JSON.stringify(occupiedRoomSlotsSmall)}

          ХАТУУ ДҮРЭМ:
          1. Энэ ангийн curriculum бүрийн weeklyHours-г бүрэн гүйцэт төлөвлө.
             - Жишээ: weeklyHours=4 бол 7 хоногт нийт 4 удаа (4 slot) байрлуул.
             - hoursPerSession=2 бол 1 “оролт” нь 2 period эзэлнэ.
               Үүнийг periods хүснэгтийн periodNumber-оор тодорхойлно:
               - Нэг өдөр (dayOfWeek) дээр **дараалсан periodNumber** (ж: 3 ба 4)-ийг сонго.
               - periods.shift === groups[0].shift байх ёстой.
               - Block (2 period) хийхдээ 2 item буцаа: эхний periodId нь periodNumber=3-ийнх, дараагийн item нь periodNumber=4-ийнх.
          2. Нэг багш нэг dayOfWeek+periodId дээр давхцах ёсгүй (occupiedTeacherSlots-ыг мөрдөнө).
          3. Нэг өрөө нэг dayOfWeek+periodId дээр давхцах ёсгүй (occupiedRoomSlots-ыг мөрдөнө).
          4. Анги 'shift'-тэй таарсан period-уудыг сонго (periods.shift === groups[0].shift).
          5. Хариуг “боломжит дээд хэмжээгээр” гарга. Зөвхөн JSON массив буцаа (Markdown/тайлбар хориглоно).
          6. JSON STRICT: double-quote, trailing comma байхгүй.
          7. Curriculum бүрийг ОРХИГДУУЛЖ БОЛОХГҮЙ. Curriculum бүр дээр weeklyHours-т яг тэнцүү тооны item буцаа.
             - Жишээ: weeklyHours=8 бол тухайн curriculumId дээр 8 item байна.
          8. 500 item хүртэл гаргаж болно. JSON-оо бүрэн хааж дуусга.

          ГАРГАХ ҮР ДҮН (Format):
          [
            {
              "curriculumId": "uuid",
              "dayOfWeek": 1,
              "periodId": "<энэ ээлжийн жинхэнэ period id>",
              "periodNumber": "<эсвэл ээлж доторх 1..7 — сервер periodId руу хөрвүүлнэ>",
              "classroomId": "<classrooms.id — заавал жагсаалтаас>",
              "semesterId": "${semesterId}"
            }
          ]
          Тэмдэглэл: dayOfWeek нь 1..7 эсвэл Monday / Даваа гэх мэт байж болно (сервер 1..7 болгоно).
        `;

        // 4) AI-аас хариу авах
        const result = await model.generateContent(prompt);
        let scheduleItems: any[];
        try {
          scheduleItems = await parseJsonArrayWithRepair(model, result.response.text());
        } catch (e2: any) {
          const raw = extractJsonArray(result.response.text());
          return Response.json(
            {
              error: `AI returned invalid JSON: ${e2?.message ?? String(e2)}`,
              model: modelOverride ?? env.GEMINI_MODEL ?? "gemini-2.5-flash",
              rawHead: raw.slice(0, 2000),
              rawTail: raw.slice(Math.max(0, raw.length - 2000)),
            },
            { status: 500 },
          );
        }

        // 4.5) Validate completeness (weeklyHours) and retry once if needed
        const requiredByCurriculumId = new Map<string, number>();
        for (const c of curriculum) requiredByCurriculumId.set(c.id, Number(c.weeklyHours) || 0);

        const allowedCurriculumIds = new Set(curriculum.map((c: any) => c.id));
        const normalizeForCounting = (items: any[]) =>
          items
            .filter((it) => it && typeof it === "object")
            .map((it) => ({
              ...it,
              curriculumId: (it as any).curriculumId,
              // If model omitted semesterId, default it (we enforce later anyway).
              semesterId: String((it as any).semesterId ?? semesterId),
            }))
            .filter((it) => allowedCurriculumIds.has(it.curriculumId) && it.semesterId === semesterId);

        const computeMissing = (items: any[]) => {
          const countByCurriculumId = new Map<string, number>();
          for (const it of items) {
            const k = String(it.curriculumId);
            countByCurriculumId.set(k, (countByCurriculumId.get(k) ?? 0) + 1);
          }
          const missing: Array<{ curriculumId: string; required: number; got: number }> = [];
          for (const [cid, required] of requiredByCurriculumId.entries()) {
            const got = countByCurriculumId.get(cid) ?? 0;
            if (required > 0 && got !== required) missing.push({ curriculumId: cid, required, got });
          }
          return missing;
        };

        // Retry a few times until weeklyHours counts match exactly.
        let lastMissing: Array<{ curriculumId: string; required: number; got: number }> = [];
        for (let attempt = 0; attempt < 3; attempt += 1) {
          scheduleItems = normalizeForCounting(Array.isArray(scheduleItems) ? scheduleItems : []);
          const missing = computeMissing(scheduleItems);
          lastMissing = missing;
          if (missing.length === 0) break;

          const retryPrompt = `
You MUST return STRICT JSON array only.
Goal: fix/extend the schedule for groupId=${groupId} semesterId=${semesterId}.
You MUST satisfy: for each curriculumId, number of items equals weeklyHours exactly.

Missing summary: ${JSON.stringify(missing)}
Curriculum: ${JSON.stringify(curriculum)}
Groups: ${JSON.stringify(groups)}
Classrooms: ${JSON.stringify(classrooms)}
Periods: ${JSON.stringify(periods)}
OccupiedTeacherSlots: ${JSON.stringify(occupiedTeacherSlots)}
OccupiedRoomSlots: ${JSON.stringify(occupiedRoomSlots)}

Return FULL corrected schedule array (not just diffs).
`;
          const retry = await model.generateContent(retryPrompt);
          scheduleItems = await parseJsonArrayWithRepair(model, retry.response.text());
        }

        // If still incomplete after retries, fail clearly (avoid inserting partial schedules).
        scheduleItems = normalizeForCounting(Array.isArray(scheduleItems) ? scheduleItems : []);
        lastMissing = computeMissing(scheduleItems);
        if (lastMissing.length > 0) {
          // Fallback: greedy scheduler (no AI) to guarantee completeness.
          const subjectIds = Array.from(new Set(groupCurriculum.map((c: any) => c.subjectId).filter(Boolean)));
          const subjects = subjectIds.length
            ? await db.query.subjects.findMany({
                where: (s, { inArray }) => inArray(s.id, subjectIds as string[]),
                columns: { id: true, requiresLab: true },
              })
            : [];
          const requiresLabBySubjectId = new Map(subjects.map((s: any) => [s.id, Number(s.requiresLab) === 1]));

          const shiftPeriodsSorted = allPeriods
            .filter((p: any) => Number(p.shift) === Number(group.shift))
            .slice()
            .sort((a: any, b: any) => Number(a.periodNumber) - Number(b.periodNumber));

          const teacherBusy = new Set<string>();
          const roomBusy = new Set<string>();
          for (const s of occupiedTeacherSlots) {
            teacherBusy.add(`${s.teacherId}|${s.dayOfWeek}|${s.periodId}`);
          }
          for (const s of occupiedRoomSlots) {
            roomBusy.add(`${s.classroomId}|${s.dayOfWeek}|${s.periodId}`);
          }

          const homeRoomId = group.homeClassroomId ? String(group.homeClassroomId) : undefined;
          const labRoomIds = allRooms
            .filter((r: any) => String(r.type).toUpperCase() === "LAB")
            .map((r: any) => String(r.id));

          const pickRoom = (subjectId: string) => {
            const needsLab = requiresLabBySubjectId.get(subjectId) === true;
            if (needsLab && labRoomIds.length > 0) return labRoomIds[0];
            if (homeRoomId) return homeRoomId;
            return allRooms[0] ? String(allRooms[0].id) : undefined;
          };

          const planned: any[] = [];
          const days = [1, 2, 3, 4, 5];

          const curriculaSorted = curriculum
            .slice()
            .sort((a: any, b: any) => Number(b.weeklyHours) - Number(a.weeklyHours));

          const canPlace = (teacherId: string, roomId: string, day: number, periodId: number) =>
            !teacherBusy.has(`${teacherId}|${day}|${periodId}`) && !roomBusy.has(`${roomId}|${day}|${periodId}`);

          for (const c of curriculaSorted) {
            const teacherId = String(c.teacherId);
            const subjectId = String(c.subjectId);
            const roomId = pickRoom(subjectId);
            if (!roomId) continue;

            const hoursPerSession = Math.max(1, Number(c.hoursPerSession) || 1);
            const requiredSlots = Math.max(0, Number(c.weeklyHours) || 0);

            if (hoursPerSession === 1) {
              for (let k = 0; k < requiredSlots; k += 1) {
                let placed = false;
                for (const day of days) {
                  for (const p of shiftPeriodsSorted) {
                    if (canPlace(teacherId, roomId, day, Number(p.id))) {
                      planned.push({
                        curriculumId: c.id,
                        dayOfWeek: day,
                        periodId: Number(p.id),
                        classroomId: roomId,
                        semesterId,
                      });
                      teacherBusy.add(`${teacherId}|${day}|${p.id}`);
                      roomBusy.add(`${roomId}|${day}|${p.id}`);
                      placed = true;
                      break;
                    }
                  }
                  if (placed) break;
                }
                if (!placed) break;
              }
            } else {
              // hoursPerSession=2 → place consecutive periodNumbers, counting as 2 slots.
              const sessions = Math.floor(requiredSlots / 2);
              for (let sIdx = 0; sIdx < sessions; sIdx += 1) {
                let placed = false;
                for (const day of days) {
                  for (let i = 0; i < shiftPeriodsSorted.length - 1; i += 1) {
                    const p1 = shiftPeriodsSorted[i];
                    const p2 = shiftPeriodsSorted[i + 1];
                    if (!p1 || !p2) continue;
                    if (Number(p2.periodNumber) !== Number(p1.periodNumber) + 1) continue;
                    const ok =
                      canPlace(teacherId, roomId, day, Number(p1.id)) &&
                      canPlace(teacherId, roomId, day, Number(p2.id));
                    if (!ok) continue;
                    planned.push(
                      {
                        curriculumId: c.id,
                        dayOfWeek: day,
                        periodId: Number(p1.id),
                        classroomId: roomId,
                        semesterId,
                      },
                      {
                        curriculumId: c.id,
                        dayOfWeek: day,
                        periodId: Number(p2.id),
                        classroomId: roomId,
                        semesterId,
                      },
                    );
                    teacherBusy.add(`${teacherId}|${day}|${p1.id}`);
                    teacherBusy.add(`${teacherId}|${day}|${p2.id}`);
                    roomBusy.add(`${roomId}|${day}|${p1.id}`);
                    roomBusy.add(`${roomId}|${day}|${p2.id}`);
                    placed = true;
                    break;
                  }
                  if (placed) break;
                }
                if (!placed) break;
              }
            }
          }

          scheduleItems = planned;
          return Response.json(
            {
              error: "AI could not generate a complete schedule after retries.",
              missing: lastMissing,
              count: scheduleItems.length,
              groupId,
              semesterId,
            },
            { status: 422 },
          );
        }

        // 4.6) Validation + sanitization before DB (өдөр/цаг/өрөө)
        const validClassroomIds = new Set(allRooms.map((r: any) => String(r.id)));
        const sanitizeCtx: SanitizeCtx = {
          semesterId,
          allowedCurriculumIds,
          groupShift: Number(group.shift),
          allPeriods,
          homeClassroomId: group.homeClassroomId,
          validClassroomIds,
        };

        let sanitized = sanitizeScheduleItems(scheduleItems, sanitizeCtx);
        scheduleItems = sanitized.items;

        if (sanitized.invalid.length > 0) {
          const retryPrompt2 = `
You MUST return STRICT JSON array only.
Goal: generate a FULL valid schedule for groupId=${groupId} semesterId=${semesterId}.

HARD REQUIREMENTS:
- Each item MUST have "classroomId" from Classrooms list (real id) and "periodId" OR "periodNumber" for this group's shift (${group.shift}).
- This group's periods use shift=${group.shift}: only use period rows where periods.shift matches.
- "dayOfWeek" may be 1..7 OR English (Monday) OR Mongolian (Даваа). Our server normalizes them.
- If classroom is missing, you may use the group's homeClassroomId if listed: ${group.homeClassroomId ?? "null"}.
- "semesterId" MUST be "${semesterId}" for every item.
- For each curriculumId, number of items MUST equal weeklyHours exactly.

Previous sanitize found ${sanitized.invalid.length} rows that could not be mapped (null period/classroom or wrong curriculum/semester). Fix ALL rows.

Curriculum: ${JSON.stringify(curriculum)}
Groups: ${JSON.stringify(groups)}
Classrooms: ${JSON.stringify(classrooms)}
Periods: ${JSON.stringify(periods)}
OccupiedTeacherSlots: ${JSON.stringify(occupiedTeacherSlots)}
OccupiedRoomSlots: ${JSON.stringify(occupiedRoomSlots)}

Return FULL corrected schedule array (not just diffs).
`;
          const retry2 = await model.generateContent(retryPrompt2);
          scheduleItems = await parseJsonArrayWithRepair(model, retry2.response.text());
        }

        sanitized = sanitizeScheduleItems(scheduleItems, sanitizeCtx);
        scheduleItems = sanitized.items;
        if (sanitized.invalid.length > 0) {
          return Response.json(
            {
              error:
                "AI-аас ирсэн зарим мөрөнд classroomId/periodId/dayOfWeek зөв тодорхойлогдохгүй байна (sanitize дууссаны дараа).",
              invalidCount: sanitized.invalid.length,
              invalidSample: sanitized.invalid.slice(0, 10),
            },
            { status: 500 },
          );
        }

        // 5) БААЗ РУУ ХАДГАЛАХ (Upsert semantics by group+semester)
        const curriculumIds = curriculum.map((c: any) => c.id) as string[];
        if (curriculumIds.length > 0) {
          await db
            .delete(schema.masterSchedules)
            .where(
              and(
                eq(schema.masterSchedules.semesterId, semesterId),
                inArray(schema.masterSchedules.curriculumId, curriculumIds),
              ),
            );
        }

        // Маш олон өгөгдлийг нэг дор хадгалах (Batch Insert)
        let inserted = 0;
        if (scheduleItems.length > 0) {
          // D1/SQLite variable limits vary; keep chunks small to avoid "too many SQL variables"
          const chunkSize = 10;
          for (let i = 0; i < scheduleItems.length; i += chunkSize) {
            const chunk = scheduleItems.slice(i, i + chunkSize);
            const rows = chunk.map((item: any) => ({
              curriculumId: item.curriculumId,
              dayOfWeek: Number(item.dayOfWeek),
              periodId: item.periodId,
              classroomId: String(item.classroomId),
              semesterId: item.semesterId ?? semesterId,
              isDraft: false,
            }));

            // Room conflict is enforced by unique index; skip conflicting rows instead of failing whole run.
            const res = await db
              .insert(schema.masterSchedules)
              .values(rows)
              .onConflictDoNothing({
                target: [
                  schema.masterSchedules.classroomId,
                  schema.masterSchedules.dayOfWeek,
                  schema.masterSchedules.periodId,
                  schema.masterSchedules.semesterId,
                ],
              });

            // D1 returns write meta; Drizzle may not return inserted rows. Count requested rows as "attempted",
            // and compare with final DB counts if needed.
            inserted += rows.length;
          }
        }

        // Compute actual inserted rows (after ON CONFLICT DO NOTHING) for accurate reporting.
        const insertedActualRow = await db
          .select({ n: sql<number>`count(*)` })
          .from(schema.masterSchedules)
          .where(
            and(
              eq(schema.masterSchedules.semesterId, semesterId),
              inArray(schema.masterSchedules.curriculumId, curriculumIds),
            ),
          );
        const insertedActual = Number(insertedActualRow?.[0]?.n ?? 0);

        if (insertedActual !== scheduleItems.length) {
        if (inserted !== scheduleItems.length) {
          return Response.json(
            {
              success: false,
              error:
                "Schedule generation produced rows but not all could be inserted (likely room/time conflicts or DB constraints).",
              count: scheduleItems.length,
              inserted: insertedActual,
              inserted,
              groupId,
              semesterId,
            },
            { status: 409 },
          );
        }

        return Response.json({
          success: true,
          message: "Хуваарь амжилттай үүсэж хадгалагдлаа.",
          count: scheduleItems.length,
          inserted: insertedActual,
          groupId,
          semesterId,
        });

      } catch (error: any) {
        console.error("Error generating schedule:", error);
        const msg = error?.message ?? String(error);
        const status = looksLikeRateLimit(msg) ? 429 : 500;
        return Response.json({ error: msg }, { status });
      }
    }

    return new Response("Master Scheduler Service is running. POST to /generate to start.");
  },
};