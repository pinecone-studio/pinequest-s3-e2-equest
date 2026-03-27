import { desc, eq, inArray } from "drizzle-orm";
import type {
	AttemptMonitoringEvent,
	AttemptMonitoringSummary,
	ProctoringEventSeverity,
} from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createId } from "./common";

const MAX_RECENT_EVENTS = 8;

type LogAttemptActivityInput = {
	code: string;
	severity: ProctoringEventSeverity;
	title: string;
	detail: string;
	occurredAt?: string | null;
};

const toMonitoringEvent = (
	row: typeof schema.proctoringEvents.$inferSelect,
): AttemptMonitoringEvent => ({
	id: row.id,
	code: row.code,
	severity: row.severity,
	title: row.title,
	detail: row.detail,
	occurredAt: row.occurredAt,
});

export const logAttemptActivity = async (
	db: DbClient,
	attemptId: string,
	input: LogAttemptActivityInput,
) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) {
		throw new Error("Оролдлого олдсонгүй.");
	}

	const occurredAt =
		input.occurredAt && !Number.isNaN(new Date(input.occurredAt).getTime())
			? input.occurredAt
			: new Date().toISOString();

	await db.insert(schema.proctoringEvents).values({
		id: createId("evt"),
		attemptId,
		code: input.code.trim(),
		severity: input.severity,
		title: input.title.trim(),
		detail: input.detail.trim(),
		occurredAt,
	});
};

export const getAttemptMonitoringSummaries = async (
	db: DbClient,
	attemptIds: string[],
): Promise<Map<string, AttemptMonitoringSummary>> => {
	if (attemptIds.length === 0) {
		return new Map();
	}

	const rows = await db.query.proctoringEvents.findMany({
		where: inArray(schema.proctoringEvents.attemptId, attemptIds),
		orderBy: [
			desc(schema.proctoringEvents.occurredAt),
			desc(schema.proctoringEvents.createdAt),
		],
	});

	const grouped = new Map<string, AttemptMonitoringSummary>();

	for (const row of rows) {
		const summary = grouped.get(row.attemptId) ?? {
			totalEvents: 0,
			warningCount: 0,
			dangerCount: 0,
			lastEventAt: undefined,
			recentEvents: [],
		};

		summary.totalEvents += 1;
		if (row.severity === "danger") {
			summary.dangerCount += 1;
		} else {
			summary.warningCount += 1;
		}

		if (!summary.lastEventAt) {
			summary.lastEventAt = row.occurredAt;
		}

		if (summary.recentEvents.length < MAX_RECENT_EVENTS) {
			summary.recentEvents.push(toMonitoringEvent(row));
		}

		grouped.set(row.attemptId, summary);
	}

	return grouped;
};
