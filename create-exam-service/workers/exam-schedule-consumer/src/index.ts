import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";

import { getDb } from "../../../src/db";
import {
	classrooms,
	examSchedules,
	masterTimetable,
} from "../../../src/db/schema";

export interface Env {
	DB: D1Database;
	GEMINI_API_KEY: string;
	GEMINI_MODEL: string;
}

type SchedulerMessageBody = {
	examId: string;
	classId: string;
	testId: string;
};

const EXAM_DURATION_MS = 90 * 60 * 1000;

function extractJsonObject(text: string): Record<string, unknown> {
	const trimmed = text.trim();
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error("JSON объект олдсонгүй");
	}
	const raw = trimmed.slice(start, end + 1);
	return JSON.parse(raw) as Record<string, unknown>;
}

async function runScheduler(
	env: Env,
	body: SchedulerMessageBody,
): Promise<void> {
	const db = getDb(env.DB);
	const { examId, classId } = body;

	const [current] = await db
		.select({
			id: examSchedules.id,
			status: examSchedules.status,
		})
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

	const timetable = await db
		.select()
		.from(masterTimetable)
		.where(eq(masterTimetable.classId, classId));

	const rooms = await db.select().from(classrooms);

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

	const apiKey = env.GEMINI_API_KEY?.trim();
	if (!apiKey) {
		const now = new Date().toISOString();
		await db
			.update(examSchedules)
			.set({
				status: "failed",
				aiReasoning: "GEMINI_API_KEY тохируулаагүй.",
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
			temperature: 0.2,
		},
	});

	const roomIds = rooms.map((r) => r.id).join(", ");
	const prompt = `Чи 1-р сургуулийн сургалтын албаны хуваарь төлөвлөгч AI.
Анги: ${classId}
Үндсэн хичээлийн хуваарь (JSON): ${JSON.stringify(timetable)}
Боломжит танхимууд (JSON): ${JSON.stringify(rooms)}

ДҮРЭМ:
1. Энэ ангийн хичээлийн хуваарьтай цагийн хувьд давхцуулж болохгүй (өдөр/цагийг ISO 8601-ээр тооц).
2. Шалгалт яг 90 минут үргэлжилнэ.
3. Танхимын id-г зөвхөн дараах жагсаалтаас сонго: [${roomIds}]

Хариултыг ЗӨВХӨН нэг JSON объектоор өг (өөр тайлбар битгий бич):
{"startTime":"ISO8601","roomId":"танхимын id","reason":"ямар шалтгаанаар энэ цаг/өрөө сонгогдов"}`;

	let suggestion: { startTime?: string; roomId?: string; reason?: string };
	try {
		const result = await model.generateContent(prompt);
		const text = result.response.text();
		const parsed = extractJsonObject(text);
		suggestion = {
			startTime:
				typeof parsed.startTime === "string" ? parsed.startTime : undefined,
			roomId: typeof parsed.roomId === "string" ? parsed.roomId : undefined,
			reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
		};
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

	if (!suggestion.startTime || !suggestion.roomId) {
		const now = new Date().toISOString();
		await db
			.update(examSchedules)
			.set({
				status: "failed",
				aiReasoning: "AI хариу startTime эсвэл roomId агуулаагүй.",
				updatedAt: now,
			})
			.where(eq(examSchedules.id, examId));
		return;
	}

	const validRoom = rooms.some((r) => r.id === suggestion.roomId);
	if (!validRoom) {
		const now = new Date().toISOString();
		await db
			.update(examSchedules)
			.set({
				status: "failed",
				aiReasoning: `AI-ийн roomId буруу: ${suggestion.roomId}`,
				updatedAt: now,
			})
			.where(eq(examSchedules.id, examId));
		return;
	}

	const start = new Date(suggestion.startTime);
	if (Number.isNaN(start.getTime())) {
		const now = new Date().toISOString();
		await db
			.update(examSchedules)
			.set({
				status: "failed",
				aiReasoning: "AI-ийн startTime ISO огноо биш байна.",
				updatedAt: now,
			})
			.where(eq(examSchedules.id, examId));
		return;
	}

	const end = new Date(start.getTime() + EXAM_DURATION_MS);
	const now = new Date().toISOString();

	await db
		.update(examSchedules)
		.set({
			startTime: start,
			endTime: end,
			roomId: suggestion.roomId,
			aiReasoning: suggestion.reason ?? null,
			status: "confirmed",
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
