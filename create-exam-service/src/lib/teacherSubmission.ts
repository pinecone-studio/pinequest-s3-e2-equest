import { asc, eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { newExamQuestions, newExams } from "@/db/schema";
import { stripMathDelimitersForDb } from "./normalizeMathExamText";

type DbClient = ReturnType<typeof getDb>;

export type TeacherSubmissionPayload = {
	attemptId: string;
	externalExamId: string;
	submittedAt?: string;
	startedAt?: string;
	expiresAt?: string;
	sourceService?: string;
	student?: {
		id?: string;
		name?: string;
	} | null;
	shuffleManifest?: string | null;
	answers: Array<{
		questionId: string;
		selectedOptionId: string | null;
	}>;
};

export type TeacherCheckedQuestionPayload = {
	questionId: string;
	correctOptionId?: string | null;
	explanation?: string | null;
	isCorrect: boolean;
	maxPoints?: number | null;
	pointsAwarded?: number | null;
};

export type TeacherCheckedAttemptPayload = {
	attemptId: string;
	checkedAt: string;
	externalExamId: string;
	maxScore: number;
	percentage: number;
	questionResults: TeacherCheckedQuestionPayload[];
	score: number;
};

type CallbackOptions = {
	callbackSecret?: string;
	callbackUrl: string;
};

const normalizeMathAnswer = (value?: string | null) =>
	stripMathDelimitersForDb(value ?? "")
		.toLowerCase()
		.replace(/\\,/g, ",")
		.replace(/\$+/g, "")
		.replace(/\s+/g, "")
		.trim();

const extractOptionIndex = (selectedOptionId?: string | null) => {
	if (!selectedOptionId) {
		return null;
	}

	const match = selectedOptionId.match(/-option-(\d+)$/);
	if (!match) {
		return null;
	}

	const parsed = Number.parseInt(match[1] ?? "", 10);
	return Number.isFinite(parsed) ? parsed : null;
};

const ensureSubmissionPayload = (value: unknown): TeacherSubmissionPayload => {
	if (!value || typeof value !== "object") {
		throw new Error("Teacher submission payload буруу байна.");
	}

	const payload = value as Record<string, unknown>;
	const attemptId =
		typeof payload.attemptId === "string" ? payload.attemptId.trim() : "";
	const externalExamId =
		typeof payload.externalExamId === "string"
			? payload.externalExamId.trim()
			: "";
	const answers = Array.isArray(payload.answers)
		? payload.answers.map((answer) => {
				if (!answer || typeof answer !== "object") {
					throw new Error("answers доторх мөр буруу байна.");
				}
				const row = answer as Record<string, unknown>;
				return {
					questionId:
						typeof row.questionId === "string" ? row.questionId.trim() : "",
					selectedOptionId:
						typeof row.selectedOptionId === "string"
							? row.selectedOptionId
							: row.selectedOptionId == null
								? null
								: String(row.selectedOptionId),
				};
			})
		: [];

	if (!attemptId) {
		throw new Error("attemptId шаардлагатай.");
	}

	if (!externalExamId) {
		throw new Error("externalExamId шаардлагатай.");
	}

	if (answers.some((answer) => !answer.questionId)) {
		throw new Error("answers.questionId шаардлагатай.");
	}

	return {
		attemptId,
		externalExamId,
		submittedAt:
			typeof payload.submittedAt === "string" ? payload.submittedAt : undefined,
		startedAt:
			typeof payload.startedAt === "string" ? payload.startedAt : undefined,
		expiresAt:
			typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
		sourceService:
			typeof payload.sourceService === "string"
				? payload.sourceService
				: undefined,
		student:
			payload.student && typeof payload.student === "object"
				? {
						id:
							typeof (payload.student as Record<string, unknown>).id === "string"
								? ((payload.student as Record<string, unknown>).id as string)
								: undefined,
						name:
							typeof (payload.student as Record<string, unknown>).name === "string"
								? ((payload.student as Record<string, unknown>).name as string)
								: undefined,
					}
				: null,
		shuffleManifest:
			typeof payload.shuffleManifest === "string"
				? payload.shuffleManifest
				: null,
		answers,
	};
};

export const gradeTeacherSubmission = async (
	db: DbClient,
	rawPayload: unknown,
): Promise<TeacherCheckedAttemptPayload> => {
	const payload = ensureSubmissionPayload(rawPayload);
	const examId = payload.externalExamId;

	const exam = await db
		.select({ id: newExams.id, title: newExams.title })
		.from(newExams)
		.where(eq(newExams.id, examId))
		.limit(1);

	if (!exam[0]) {
		throw new Error(`Шалгалт олдсонгүй: ${examId}`);
	}

	const questions = await db
		.select({
			id: newExamQuestions.id,
			type: newExamQuestions.type,
			points: newExamQuestions.points,
			position: newExamQuestions.position,
			correctAnswer: newExamQuestions.correctAnswer,
			correctOption: newExamQuestions.correctOption,
			responseGuide: newExamQuestions.responseGuide,
			answerLatex: newExamQuestions.answerLatex,
		})
		.from(newExamQuestions)
		.where(eq(newExamQuestions.examId, examId))
		.orderBy(asc(newExamQuestions.position));

	if (questions.length === 0) {
		throw new Error(`"${exam[0].title}" шалгалтад асуулт олдсонгүй.`);
	}

	const answerByQuestionId = new Map(
		payload.answers.map((answer) => [answer.questionId, answer.selectedOptionId]),
	);

	const questionResults = questions.map((question) => {
		const selectedOptionId = answerByQuestionId.get(question.id) ?? null;
		const maxPoints = question.points;

		if (question.type === "mcq") {
			const selectedIndex = extractOptionIndex(selectedOptionId);
			const correctIndex =
				typeof question.correctOption === "number" ? question.correctOption : null;
			const correctOptionId =
				correctIndex == null ? null : `${question.id}-option-${correctIndex}`;
			const isCorrect =
				selectedIndex != null &&
				correctIndex != null &&
				selectedIndex === correctIndex;

			return {
				questionId: question.id,
				correctOptionId,
				explanation:
					question.correctAnswer != null && question.correctAnswer !== ""
						? `Зөв хариу: ${question.correctAnswer}`
						: null,
				isCorrect,
				maxPoints,
				pointsAwarded: isCorrect ? maxPoints : 0,
			} satisfies TeacherCheckedQuestionPayload;
		}

		const studentAnswer = normalizeMathAnswer(selectedOptionId);
		const expectedAnswer = normalizeMathAnswer(question.answerLatex);
		const isCorrect =
			studentAnswer !== "" &&
			expectedAnswer !== "" &&
			studentAnswer === expectedAnswer;

		return {
			questionId: question.id,
			correctOptionId: null,
			explanation:
				question.responseGuide ??
				(question.answerLatex ? `Хүлээгдэж буй хариу: ${question.answerLatex}` : null),
			isCorrect,
			maxPoints,
			pointsAwarded: isCorrect ? maxPoints : 0,
		} satisfies TeacherCheckedQuestionPayload;
	});

	const score = questionResults.reduce(
		(total, question) => total + (question.pointsAwarded ?? 0),
		0,
	);
	const maxScore = questionResults.reduce(
		(total, question) => total + (question.maxPoints ?? 0),
		0,
	);

	return {
		attemptId: payload.attemptId,
		checkedAt: new Date().toISOString(),
		externalExamId: payload.externalExamId,
		maxScore,
		percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
		questionResults,
		score,
	};
};

export const postTeacherCheckedAttempt = async (
	payload: TeacherCheckedAttemptPayload,
	options: CallbackOptions,
) => {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	if (options.callbackSecret?.trim()) {
		headers["x-teacher-result-secret"] = options.callbackSecret.trim();
	}

	const response = await fetch(options.callbackUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			`take-exam-service callback амжилтгүй (${response.status})${text ? `: ${text}` : ""}`,
		);
	}

	return response.json().catch(() => null);
};
