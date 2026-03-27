import { and, desc, eq, sql } from "drizzle-orm";
import type { ExamAnswerInput } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const ANSWER_UPSERT_CHUNK_SIZE = 100;

function dedupeAnswerUpdates(answers: ExamAnswerInput[]) {
	const latestByQuestionId = new Map<string, ExamAnswerInput>();

	for (const answer of answers) {
		latestByQuestionId.set(answer.questionId, answer);
	}

	return Array.from(latestByQuestionId.values());
}

export const persistAnswerUpdates = async (
	db: DbClient,
	attemptId: string,
	answers: ExamAnswerInput[],
) => {
	const dedupedAnswers = dedupeAnswerUpdates(answers);

	if (dedupedAnswers.length === 0) {
		return;
	}

	for (let index = 0; index < dedupedAnswers.length; index += ANSWER_UPSERT_CHUNK_SIZE) {
		const chunk = dedupedAnswers.slice(index, index + ANSWER_UPSERT_CHUNK_SIZE);

		await db.insert(schema.answers)
			.values(
				chunk.map((answer) => ({
					attemptId,
					questionId: answer.questionId,
					selectedOptionId: answer.selectedOptionId,
				})),
			)
			.onConflictDoUpdate({
				target: [schema.answers.attemptId, schema.answers.questionId],
				set: {
					selectedOptionId: sql.raw(`excluded.${schema.answers.selectedOptionId.name}`),
				},
			});
	}
};

export const findExistingAttempt = async (
	db: DbClient,
	testId: string,
	studentId: string,
) =>
	db.query.attempts.findFirst({
		where: and(
			eq(schema.attempts.testId, testId),
			eq(schema.attempts.studentId, studentId),
		),
		orderBy: [desc(schema.attempts.startedAt)],
	});
