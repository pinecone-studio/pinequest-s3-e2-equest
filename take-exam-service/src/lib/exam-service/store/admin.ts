import { desc, eq } from "drizzle-orm";
import type { AttemptSummary } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAttemptMonitoringSummaries } from "./activity";
import { cacheAttemptState, getAttemptStateFromKv } from "./cache";
import { computeResult, getAttemptResults } from "./results";

export const listAttempts = async (db: DbClient): Promise<AttemptSummary[]> => {
	const records = await db.query.attempts.findMany({
		orderBy: [desc(schema.attempts.startedAt)],
	});
	const monitoringByAttemptId = await getAttemptMonitoringSummaries(
		db,
		records.map((record) => record.id),
	);

	const summaries: AttemptSummary[] = [];

	for (const record of records) {
		const test = await db.query.tests.findFirst({
			where: eq(schema.tests.id, record.testId),
		});
		const isApproved = record.status === "approved";
		const resultRows = isApproved ? await getAttemptResults(db, record.id) : [];

		summaries.push({
			attemptId: record.id,
			testId: record.testId,
			title: test?.title || "Unknown Test",
			studentId: record.studentId,
			studentName: record.studentName,
			status: record.status,
			score: isApproved ? record.score ?? undefined : undefined,
			maxScore: isApproved ? record.maxScore ?? undefined : undefined,
			percentage: isApproved ? record.percentage ?? undefined : undefined,
			startedAt: record.startedAt,
			submittedAt: record.submittedAt ?? undefined,
			result: isApproved ? computeResult(resultRows) : undefined,
			monitoring: monitoringByAttemptId.get(record.id),
		});
	}

	return summaries;
};

export const approveAttempt = async (
	db: DbClient,
	attemptId: string,
	kv?: KVNamespace,
) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	if (attempt.status === "approved") return;
	if (attempt.status !== "submitted") {
		throw new Error("Зөвхөн илгээгдсэн шалгалтыг батлах боломжтой.");
	}

	const resultRows = await getAttemptResults(db, attemptId);
	const result = computeResult(resultRows);

	await db.update(schema.attempts)
		.set({
			status: "approved",
			score: result.score,
			maxScore: result.maxScore,
			percentage: result.percentage,
		})
		.where(eq(schema.attempts.id, attemptId));

	const cachedState = await getAttemptStateFromKv(kv, attemptId);
	if (cachedState) {
		await cacheAttemptState(kv, {
			...cachedState,
			status: "approved",
		});
	}
};
