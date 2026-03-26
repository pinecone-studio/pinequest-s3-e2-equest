import { and, eq } from "drizzle-orm";
import type {
	ExamQuestionResult,
	ExamResultSummary,
} from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type AttemptResultRow = {
	questionId: string;
	selectedOptionId: string | null;
	correctOptionId: string;
	explanation: string;
	points: number;
};

export const getAttemptResults = async (
	db: DbClient,
	attemptId: string,
): Promise<AttemptResultRow[]> =>
	db.select({
		questionId: schema.questions.id,
		selectedOptionId: schema.answers.selectedOptionId,
		correctOptionId: schema.questions.correctOptionId,
		explanation: schema.questions.explanation,
		points: schema.questions.points,
	})
		.from(schema.attempts)
		.innerJoin(schema.questions, eq(schema.questions.testId, schema.attempts.testId))
		.leftJoin(
			schema.answers,
			and(
				eq(schema.answers.attemptId, schema.attempts.id),
				eq(schema.answers.questionId, schema.questions.id),
			),
		)
		.where(eq(schema.attempts.id, attemptId));

export const computeResult = (
	questions: AttemptResultRow[],
): ExamResultSummary => {
	const questionResults: ExamQuestionResult[] = questions.map((q) => ({
		questionId: q.questionId,
		selectedOptionId: q.selectedOptionId,
		correctOptionId: q.correctOptionId,
		isCorrect: q.selectedOptionId === q.correctOptionId,
		pointsAwarded: q.selectedOptionId === q.correctOptionId ? q.points : 0,
		maxPoints: q.points,
		explanation: q.explanation,
	}));

	const score = questionResults.reduce((total, result) => total + result.pointsAwarded, 0);
	const maxScore = questionResults.reduce((total, result) => total + result.maxPoints, 0);

	return {
		score,
		maxScore,
		percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
		correctCount: questionResults.filter((result) => result.isCorrect).length,
		incorrectCount: questionResults.filter(
			(result) => result.selectedOptionId !== null && !result.isCorrect,
		).length,
		unansweredCount: questionResults.filter(
			(result) => result.selectedOptionId === null,
		).length,
		questionResults,
	};
};
