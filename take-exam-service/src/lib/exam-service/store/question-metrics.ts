import { and, eq, inArray, sql } from "drizzle-orm";
import type { AttemptQuestionMetricInput } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const dedupeMetrics = (metrics: AttemptQuestionMetricInput[]) => {
	const aggregated = new Map<
		string,
		{ questionId: string; dwellMs: number; answerChangeCount: number }
	>();

	for (const metric of metrics) {
		const current = aggregated.get(metric.questionId) ?? {
			questionId: metric.questionId,
			dwellMs: 0,
			answerChangeCount: 0,
		};

		current.dwellMs += Math.max(0, Math.round(metric.dwellMs ?? 0));
		current.answerChangeCount += Math.max(
			0,
			Math.round(metric.answerChangeCount ?? 0),
		);
		aggregated.set(metric.questionId, current);
	}

	return Array.from(aggregated.values()).filter(
		(metric) => metric.dwellMs > 0 || metric.answerChangeCount > 0,
	);
};

export const upsertAttemptQuestionMetrics = async (
	db: DbClient,
	attemptId: string,
	metrics: AttemptQuestionMetricInput[],
) => {
	const deduped = dedupeMetrics(metrics);
	if (deduped.length === 0) {
		return;
	}

	await db
		.insert(schema.attemptQuestionMetrics)
		.values(
			deduped.map((metric) => ({
				attemptId,
				questionId: metric.questionId,
				dwellMs: metric.dwellMs,
				answerChangeCount: metric.answerChangeCount,
				updatedAt: new Date().toISOString(),
			})),
		)
		.onConflictDoUpdate({
			target: [
				schema.attemptQuestionMetrics.attemptId,
				schema.attemptQuestionMetrics.questionId,
			],
			set: {
				dwellMs: sql`${schema.attemptQuestionMetrics.dwellMs} + excluded.dwell_ms`,
				answerChangeCount: sql`${schema.attemptQuestionMetrics.answerChangeCount} + excluded.answer_change_count`,
				updatedAt: new Date().toISOString(),
			},
		});
};

export const getAttemptQuestionMetricMap = async (
	db: DbClient,
	attemptIds: string[],
) => {
	if (attemptIds.length === 0) {
		return new Map<string, Map<string, { dwellMs: number; answerChangeCount: number }>>();
	}

	const rows = await db.query.attemptQuestionMetrics.findMany({
		where: inArray(schema.attemptQuestionMetrics.attemptId, attemptIds),
	});

	const byAttemptId = new Map<
		string,
		Map<string, { dwellMs: number; answerChangeCount: number }>
	>();

	for (const row of rows) {
		const attemptMap = byAttemptId.get(row.attemptId) ?? new Map();
		attemptMap.set(row.questionId, {
			dwellMs: row.dwellMs,
			answerChangeCount: row.answerChangeCount,
		});
		byAttemptId.set(row.attemptId, attemptMap);
	}

	return byAttemptId;
};
