import { desc, eq, inArray, ne } from "drizzle-orm";
import type {
	AttemptLiveFeedItem,
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
			infoCount: 0,
			warningCount: 0,
			dangerCount: 0,
			lastEventAt: undefined,
			recentEvents: [],
		};

		summary.totalEvents += 1;
		if (row.severity === "danger") {
			summary.dangerCount += 1;
		} else if (row.severity === "warning") {
			summary.warningCount += 1;
		} else {
			summary.infoCount = (summary.infoCount ?? 0) + 1;
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

export const listLiveMonitoringFeed = async (
	db: DbClient,
	limit = 40,
): Promise<AttemptLiveFeedItem[]> => {
	const rows = await db.query.proctoringEvents.findMany({
		where: ne(schema.proctoringEvents.severity, "info"),
		orderBy: [
			desc(schema.proctoringEvents.occurredAt),
			desc(schema.proctoringEvents.createdAt),
		],
		limit,
	});

	if (rows.length === 0) {
		return [];
	}

	const attemptIds = [...new Set(rows.map((row) => row.attemptId))];
	const monitoringByAttemptId = await getAttemptMonitoringSummaries(db, attemptIds);
	const attempts = await db.query.attempts.findMany({
		where: inArray(schema.attempts.id, attemptIds),
	});
	const tests = await db.query.tests.findMany({
		where: inArray(
			schema.tests.id,
			[...new Set(attempts.map((attempt) => attempt.testId))],
		),
	});

	const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
	const testById = new Map(tests.map((test) => [test.id, test]));

	return rows.flatMap((row) => {
		const attempt = attemptById.get(row.attemptId);
		if (
			!attempt ||
			(attempt.status !== "in_progress" && attempt.status !== "processing")
		) {
			return [];
		}

		return [
			{
				attemptId: attempt.id,
				testId: attempt.testId,
				title: testById.get(attempt.testId)?.title ?? "Unknown Test",
				studentId: attempt.studentId,
				studentName: attempt.studentName,
				status: attempt.status,
				startedAt: attempt.startedAt,
				submittedAt: attempt.submittedAt ?? undefined,
				monitoring: monitoringByAttemptId.get(attempt.id),
				latestEvent: toMonitoringEvent(row),
			},
		];
	});
};
