import type { ExamProgress } from "@/lib/exam-service/types";

export const TEST_CACHE_TTL_SECONDS = 60 * 60 * 24;
export const ATTEMPT_CACHE_TTL_SECONDS = 60 * 60 * 12;
export const TEST_CACHE_INDEX_KEY = "tests:index";

export const createId = (prefix: string) =>
	`${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export const testCacheKey = (testId: string) => `test:${testId}`;
export const attemptStateCacheKey = (attemptId: string) => `attempt:${attemptId}:state`;

export const computeProgress = (
	answersCount: number,
	totalQuestions: number,
): ExamProgress => ({
	totalQuestions,
	answeredQuestions: answersCount,
	remainingQuestions: totalQuestions - answersCount,
	completionRate: totalQuestions === 0 ? 0 : Math.round((answersCount / totalQuestions) * 100),
});

export const countAnsweredQuestions = (answers: Record<string, string | null>) =>
	Object.values(answers).filter((value) => value !== null && value !== "").length;

export const isUniqueConstraintError = (error: unknown) =>
	error instanceof Error && error.message.toLowerCase().includes("unique");

export const getQuestionId = (question: any) =>
	(question as any).id || (question as any).questionId;

export const getQuestionOptions = (question: any) =>
	typeof question.options === "string" ? JSON.parse(question.options) : question.options;

export const getOptionId = (option: any) => option.id;
