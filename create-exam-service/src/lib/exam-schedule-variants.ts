import { examSchedules } from "../db/schema";

export type ExamScheduleRow = typeof examSchedules.$inferSelect;

function isoDate(d: Date | null | undefined): string | null {
	if (d == null) return null;
	if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
	return null;
}

export function examScheduleRowToGql(row: ExamScheduleRow) {
	const start = row.startTime;
	const startIso =
		start instanceof Date && !Number.isNaN(start.getTime())
			? start.toISOString()
			: new Date(start as unknown as string).toISOString();

	const variants = parseAiVariantsJson(row.aiVariantsJson);

	return {
		id: row.id,
		testId: row.testId,
		classId: row.classId,
		startTime: startIso,
		endTime: isoDate(row.endTime ?? null),
		roomId: row.roomId ?? null,
		status: row.status,
		aiVariants: variants.map((v) => ({
			id: v.id,
			label: v.label,
			startTime: v.startTime,
			roomId: v.roomId,
			reason: v.reason ?? null,
		})),
		aiReasoning: row.aiReasoning ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export type ExamVariantRow = {
	id: string;
	label: string;
	startTime: string;
	roomId: string;
	reason?: string | null;
};

/**
 * D1 `ai_variants_json`: JSON array эсвэл `{ "variants": [...] }`
 */
export function parseAiVariantsJson(raw: string | null | undefined): ExamVariantRow[] {
	if (raw == null || raw === "") return [];
	try {
		const data = JSON.parse(raw) as unknown;
		const arr = Array.isArray(data)
			? data
			: data &&
					typeof data === "object" &&
					"variants" in data &&
					Array.isArray((data as { variants: unknown }).variants)
				? (data as { variants: unknown[] }).variants
				: null;
		if (!arr?.length) return [];
		const out: ExamVariantRow[] = [];
		for (const item of arr) {
			if (!item || typeof item !== "object") continue;
			const o = item as Record<string, unknown>;
			const id = typeof o.id === "string" ? o.id.trim() : "";
			const label = typeof o.label === "string" ? o.label.trim() : "";
			const startTime = typeof o.startTime === "string" ? o.startTime.trim() : "";
			const roomId = typeof o.roomId === "string" ? o.roomId.trim() : "";
			const reason = typeof o.reason === "string" ? o.reason : null;
			if (!id || !label || !startTime || !roomId) continue;
			out.push({ id, label, startTime, roomId, reason });
		}
		return out;
	} catch {
		return [];
	}
}
