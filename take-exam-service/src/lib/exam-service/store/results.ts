import { and, eq, inArray } from "drizzle-orm";
import type {
	AttemptAnswerReviewItem,
	ExamQuestionResult,
	ExamResultSummary,
} from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { areEquivalentFreeResponseAnswers, getQuestionOptions } from "./common";

const isLikelyInstructionText = (value: string) => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	return [
		"бодолтын алхмууд",
		"алхмуудаа бич",
		"эцсийн хариуг",
		"хэлбэрээр өг",
		"тайлбарла",
		"write your steps",
		"show your work",
	].some((phrase) => normalized.includes(phrase));
};

const getSanitizedMathAnswerText = (value: string | null | undefined) => {
	const normalized = value?.trim() || "";
	if (!normalized || isLikelyInstructionText(normalized)) {
		return null;
	}

	return normalized;
};

export type AttemptResultRow = {
	attemptId?: string;
	answerChangeCount: number | null;
	answerLatex: string | null;
	competency: string;
	dwellMs: number | null;
	questionId: string;
	prompt: string;
	questionType: string;
	selectedOptionId: string | null;
	correctOptionId: string;
	explanation: string;
	points: number;
	responseGuide: string | null;
	options: string;
};

export const getAttemptResults = async (
	db: DbClient,
	attemptId: string,
): Promise<AttemptResultRow[]> =>
	db.select({
		answerChangeCount: schema.attemptQuestionMetrics.answerChangeCount,
		answerLatex: schema.questions.answerLatex,
		competency: schema.questions.competency,
		dwellMs: schema.attemptQuestionMetrics.dwellMs,
		questionId: schema.questions.id,
		prompt: schema.questions.prompt,
		questionType: schema.questions.type,
		selectedOptionId: schema.answers.selectedOptionId,
		correctOptionId: schema.questions.correctOptionId,
		explanation: schema.questions.explanation,
		points: schema.questions.points,
		responseGuide: schema.questions.responseGuide,
		options: schema.questions.options,
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
		.leftJoin(
			schema.attemptQuestionMetrics,
			and(
				eq(schema.attemptQuestionMetrics.attemptId, schema.attempts.id),
				eq(schema.attemptQuestionMetrics.questionId, schema.questions.id),
			),
		)
		.where(eq(schema.attempts.id, attemptId));

export const getAttemptResultsForAttempts = async (
	db: DbClient,
	attemptIds: string[],
): Promise<Map<string, AttemptResultRow[]>> => {
	if (attemptIds.length === 0) {
		return new Map();
	}

	const rows = await db.select({
		attemptId: schema.attempts.id,
		answerChangeCount: schema.attemptQuestionMetrics.answerChangeCount,
		answerLatex: schema.questions.answerLatex,
		competency: schema.questions.competency,
		dwellMs: schema.attemptQuestionMetrics.dwellMs,
		questionId: schema.questions.id,
		prompt: schema.questions.prompt,
		questionType: schema.questions.type,
		selectedOptionId: schema.answers.selectedOptionId,
		correctOptionId: schema.questions.correctOptionId,
		explanation: schema.questions.explanation,
		points: schema.questions.points,
		responseGuide: schema.questions.responseGuide,
		options: schema.questions.options,
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
		.leftJoin(
			schema.attemptQuestionMetrics,
			and(
				eq(schema.attemptQuestionMetrics.attemptId, schema.attempts.id),
				eq(schema.attemptQuestionMetrics.questionId, schema.questions.id),
			),
		)
		.where(inArray(schema.attempts.id, attemptIds));

	const rowsByAttemptId = new Map<string, AttemptResultRow[]>();
	for (const row of rows) {
		const current = rowsByAttemptId.get(row.attemptId) ?? [];
		current.push(row);
		rowsByAttemptId.set(row.attemptId, current);
	}

	return rowsByAttemptId;
};

const getOptionTextById = (
	options: Array<{ id?: string; text?: string }> | string[],
	optionId: string | null,
) => {
	if (!optionId) {
		return null;
	}

	for (const option of options) {
		if (
			option &&
			typeof option === "object" &&
			"id" in option &&
			option.id === optionId
		) {
			return option.text ?? optionId;
		}

		if (typeof option === "string" && option === optionId) {
			return option;
		}
	}

	return optionId;
};

export const getAttemptAnswerReviewFromRows = (
	rows: AttemptResultRow[],
): AttemptAnswerReviewItem[] =>
	rows.map((row) => {
		const options = getQuestionOptions({ options: row.options }) as
			| Array<{ id?: string; text?: string }>
			| string[];
		const selectedAnswerText =
			row.questionType === "math"
				? row.selectedOptionId
				: Array.isArray(options)
					? getOptionTextById(options, row.selectedOptionId)
					: row.selectedOptionId;
		const correctAnswerText =
			row.questionType === "math"
				? getSanitizedMathAnswerText(row.answerLatex) ??
					getSanitizedMathAnswerText(row.responseGuide) ??
					getSanitizedMathAnswerText(row.correctOptionId) ??
					null
				: Array.isArray(options)
					? getOptionTextById(options, row.correctOptionId)
					: row.correctOptionId;

		return {
			answerChangeCount: row.answerChangeCount ?? 0,
			competency: row.competency,
			correctAnswerText,
			dwellMs: row.dwellMs ?? 0,
			points: row.points,
			prompt: row.prompt,
			questionId: row.questionId,
			questionType: (row.questionType as "single-choice" | "math") ?? "single-choice",
			responseGuide: row.responseGuide ?? null,
			selectedAnswerText: selectedAnswerText ?? null,
			selectedOptionId: row.selectedOptionId,
		};
	});

export const getAttemptAnswerReview = async (
	db: DbClient,
	attemptId: string,
): Promise<AttemptAnswerReviewItem[]> => {
	const rows = await getAttemptResults(db, attemptId);
	return getAttemptAnswerReviewFromRows(rows);
};

export const computeResult = (
	questions: AttemptResultRow[],
): ExamResultSummary => {
	const questionResults: ExamQuestionResult[] = questions.map((q) => {
		const questionType =
			(q.questionType as "single-choice" | "math") ?? "single-choice";
		const expectedMathAnswer =
			getSanitizedMathAnswerText(q.answerLatex) ??
			getSanitizedMathAnswerText(q.responseGuide) ??
			getSanitizedMathAnswerText(q.correctOptionId) ??
			"";
		const isCorrect =
			questionType === "math"
				? areEquivalentFreeResponseAnswers(q.selectedOptionId, expectedMathAnswer)
				: q.selectedOptionId === q.correctOptionId;

		return {
			answerChangeCount: q.answerChangeCount ?? 0,
			competency: q.competency,
			dwellMs: q.dwellMs ?? 0,
			prompt: q.prompt,
			questionId: q.questionId,
			questionType,
			selectedOptionId: q.selectedOptionId,
			correctOptionId:
				questionType === "math" ? expectedMathAnswer : q.correctOptionId,
			isCorrect,
			pointsAwarded: isCorrect ? q.points : 0,
			maxPoints: q.points,
			explanation: q.explanation,
		};
	});

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
