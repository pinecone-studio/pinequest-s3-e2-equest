import { and, desc, eq } from "drizzle-orm";
import type { ExamAnswerInput } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const persistAnswerUpdates = async (
	db: DbClient,
	attemptId: string,
	answers: ExamAnswerInput[],
) => {
	for (const answer of answers) {
		await db.insert(schema.answers)
			.values({
				attemptId,
				questionId: answer.questionId,
				selectedOptionId: answer.selectedOptionId,
			})
			.onConflictDoUpdate({
				target: [schema.answers.attemptId, schema.answers.questionId],
				set: { selectedOptionId: answer.selectedOptionId },
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
