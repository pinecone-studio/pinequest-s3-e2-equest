import type {
	AttemptAnswerReviewItem,
	ExamOption,
	ExamQuestion,
	ExamQuestionResult,
	ExamResultSummary,
	ExamTest,
} from "@/lib/exam-service/types";
import type { DbClient } from "@/lib/db";
import { normalizeFreeResponseAnswer } from "./common";
import { getAttemptResults } from "./results";
import { savePublishedTest } from "./tests";

const CREATE_EXAM_SERVICE_GRAPHQL_URL =
	process.env.CREATE_EXAM_SERVICE_GRAPHQL_URL ??
	"https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

const LIST_NEW_MATH_EXAMS_QUERY = /* GraphQL */ `
	query ListNewMathExams($limit: Int) {
		listNewMathExams(limit: $limit) {
			examId
			title
			updatedAt
		}
	}
`;

const GET_NEW_MATH_EXAM_QUERY = /* GraphQL */ `
	query GetNewMathExam($examId: ID!) {
		getNewMathExam(examId: $examId) {
			examId
			title
			mcqCount
			mathCount
			totalPoints
			generator {
				difficulty
				topics
				sourceContext
			}
			sessionMeta {
				grade
				groupClass
				examType
				subject
				topics
				examDate
				startTime
				endTime
				durationMinutes
				mixQuestions
				withVariants
				variantCount
				description
			}
			questions {
				id
				type
				prompt
				points
				imageAlt
				imageDataUrl
				options
				correctOption
				responseGuide
				answerLatex
			}
			createdAt
			updatedAt
		}
	}
`;

type GraphQlPayload<T> = {
	data?: T;
	errors?: Array<{ message?: string }>;
};

export type ExternalNewMathExamSummary = {
	examId: string;
	title: string;
	updatedAt: string;
};

export type ExternalNewMathExamQuestion = {
	answerLatex?: string | null;
	correctOption?: number | null;
	id: string;
	imageAlt?: string | null;
	imageDataUrl?: string | null;
	options?: string[] | null;
	points: number;
	prompt: string;
	responseGuide?: string | null;
	type: "MCQ" | "MATH";
};

export type ExternalNewMathExam = {
	createdAt: string;
	examId: string;
	generator?: {
		difficulty?: string | null;
		sourceContext?: string | null;
		topics?: string | null;
	} | null;
	mathCount: number;
	mcqCount: number;
	questions: ExternalNewMathExamQuestion[];
	sessionMeta?: {
		description?: string | null;
		durationMinutes?: number | null;
		examDate?: string | null;
		examType?: string | null;
		endTime?: string | null;
		grade?: number | null;
		groupClass?: string | null;
		mixQuestions?: boolean | null;
		startTime?: string | null;
		subject?: string | null;
		topics?: string[] | null;
		variantCount?: number | null;
		withVariants?: boolean | null;
	} | null;
	title: string;
	totalPoints: number;
	updatedAt: string;
};

type ListNewMathExamsResponse = {
	listNewMathExams: ExternalNewMathExamSummary[];
};

type GetNewMathExamResponse = {
	getNewMathExam: ExternalNewMathExam | null;
};

export type ImportedExternalExam = {
	examId: string;
	importedTestId: string;
	title: string;
};

const externalGraphqlRequest = async <TData, TVariables = Record<string, unknown>>(
	query: string,
	variables?: TVariables,
): Promise<TData> => {
	const response = await fetch(CREATE_EXAM_SERVICE_GRAPHQL_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query, variables }),
	});

	const payload = (await response.json()) as GraphQlPayload<TData>;

	if (!response.ok || payload.errors?.length || !payload.data) {
		throw new Error(
			payload.errors?.[0]?.message ||
				"External exam service-ээс өгөгдөл авч чадсангүй.",
		);
	}

	return payload.data;
};

export const listExternalNewMathExams = async (
	limit = 20,
): Promise<ExternalNewMathExamSummary[]> => {
	const data = await externalGraphqlRequest<
		ListNewMathExamsResponse,
		{ limit: number }
	>(LIST_NEW_MATH_EXAMS_QUERY, { limit });

	return data.listNewMathExams ?? [];
};

export const getExternalNewMathExam = async (examId: string) => {
	const data = await externalGraphqlRequest<
		GetNewMathExamResponse,
		{ examId: string }
	>(GET_NEW_MATH_EXAM_QUERY, { examId });

	if (!data.getNewMathExam) {
		throw new Error("External exam олдсонгүй.");
	}

	return data.getNewMathExam;
};

const buildExternalQuestionMap = (externalExam: ExternalNewMathExam) =>
	new Map(
		externalExam.questions.map((question) => [question.id, question] as const),
	);

const getExternalCorrectOptionId = (
	question?: ExternalNewMathExamQuestion,
) => {
	if (!question || question.type !== "MCQ") {
		return "";
	}

	const correctIndex =
		typeof question.correctOption === "number" ? question.correctOption : null;
	if (correctIndex == null || correctIndex < 0) {
		return "";
	}

	return `${question.id}-option-${correctIndex}`;
};

const getExternalCorrectAnswerText = (
	question?: ExternalNewMathExamQuestion,
) => {
	if (!question) {
		return null;
	}

	if (question.type === "MATH") {
		return question.answerLatex?.trim() || question.responseGuide?.trim() || null;
	}

	const correctIndex =
		typeof question.correctOption === "number" ? question.correctOption : null;
	if (correctIndex == null || correctIndex < 0) {
		return null;
	}

	return question.options?.[correctIndex]?.trim() || null;
};

const getExternalExplanation = (
	question?: ExternalNewMathExamQuestion,
) => {
	if (!question) {
		return "";
	}

	const guide = question.responseGuide?.trim();
	if (guide) {
		return guide;
	}

	if (question.type === "MATH") {
		const answer = question.answerLatex?.trim();
		if (answer) {
			return `Хүлээгдэж буй хариу: ${answer}`;
		}
	}

	return "";
};

const recomputeResultTotals = (
	questionResults: ExamQuestionResult[],
): ExamResultSummary => {
	const score = questionResults.reduce(
		(total, question) => total + question.pointsAwarded,
		0,
	);
	const maxScore = questionResults.reduce(
		(total, question) => total + question.maxPoints,
		0,
	);

	return {
		score,
		maxScore,
		percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
		correctCount: questionResults.filter((question) => question.isCorrect).length,
		incorrectCount: questionResults.filter(
			(question) => question.selectedOptionId !== null && !question.isCorrect,
		).length,
		unansweredCount: questionResults.filter(
			(question) => question.selectedOptionId === null,
		).length,
		questionResults,
	};
};

export const hydrateCreateExamServiceAnswerReview = (
	answerReview: AttemptAnswerReviewItem[] | undefined,
	externalExam: ExternalNewMathExam,
): AttemptAnswerReviewItem[] => {
	const questionById = buildExternalQuestionMap(externalExam);

	return (answerReview ?? []).map((item) => {
		const externalQuestion = questionById.get(item.questionId);
		const hydratedCorrectAnswerText =
			item.correctAnswerText?.trim() ||
			getExternalCorrectAnswerText(externalQuestion) ||
			null;
		const hydratedResponseGuide =
			item.responseGuide?.trim() ||
			externalQuestion?.responseGuide?.trim() ||
			(externalQuestion?.type === "MATH"
				? externalQuestion.answerLatex?.trim() || null
				: null);

		return {
			...item,
			correctAnswerText: hydratedCorrectAnswerText,
			responseGuide: hydratedResponseGuide,
		};
	});
};

export const mergeCreateExamServiceResult = (
	storedResult: ExamResultSummary | undefined,
	externalResult: ExamResultSummary,
): ExamResultSummary => {
	if (!storedResult) {
		return externalResult;
	}

	const storedByQuestionId = new Map(
		storedResult.questionResults.map((question) => [question.questionId, question] as const),
	);
	const externalQuestionIds = new Set(
		externalResult.questionResults.map((question) => question.questionId),
	);

	const mergedQuestionResults = externalResult.questionResults.map((externalQuestion) => {
		const storedQuestion = storedByQuestionId.get(externalQuestion.questionId);
		if (!storedQuestion) {
			return externalQuestion;
		}

		const storedCorrectOptionId = storedQuestion.correctOptionId?.trim() || "";
		const storedExplanation = storedQuestion.explanation?.trim() || "";
		const hasStoredScoring =
			storedCorrectOptionId.length > 0 ||
			storedExplanation.length > 0 ||
			storedQuestion.pointsAwarded > 0 ||
			storedQuestion.isCorrect;

		return {
			...externalQuestion,
			...storedQuestion,
			correctOptionId: storedCorrectOptionId || externalQuestion.correctOptionId,
			explanation: storedExplanation || externalQuestion.explanation,
			isCorrect: hasStoredScoring
				? storedQuestion.isCorrect
				: externalQuestion.isCorrect,
			pointsAwarded: hasStoredScoring
				? storedQuestion.pointsAwarded
				: externalQuestion.pointsAwarded,
		};
	});

	for (const storedQuestion of storedResult.questionResults) {
		if (externalQuestionIds.has(storedQuestion.questionId)) {
			continue;
		}

		mergedQuestionResults.push(storedQuestion);
	}

	return recomputeResultTotals(mergedQuestionResults);
};

const mapExternalQuestionToOption = (
	question: ExternalNewMathExamQuestion,
	optionText: string,
	index: number,
): ExamOption => ({
	id: `${question.id}-option-${index}`,
	text: optionText,
});

const mapExternalQuestionToExamQuestion = (
	question: ExternalNewMathExamQuestion,
): ExamQuestion => {
	const options = (question.options ?? []).map((optionText, index) =>
		mapExternalQuestionToOption(question, optionText, index),
	);

	if (question.type === "MATH") {
		return {
			id: question.id,
			type: "math",
			prompt: question.prompt,
			options: [],
			correctOptionId: "",
			explanation:
				question.responseGuide ??
				(question.answerLatex ? `Хүлээгдэж буй хариу: ${question.answerLatex}` : ""),
			points: question.points,
			competency: "external-import",
			imageUrl: question.imageDataUrl ?? null,
			responseGuide: question.responseGuide ?? null,
			answerLatex: question.answerLatex ?? null,
		};
	}

	const correctOptionIndex = question.correctOption ?? -1;
	const correctOption = options[correctOptionIndex];

	if (!correctOption) {
		throw new Error(
			`External exam question "${question.id}" дээр зөв сонголтын индекс буруу байна.`,
		);
	}

		return {
			id: question.id,
			type: "single-choice",
			prompt: question.prompt,
			options,
			correctOptionId: correctOption.id,
			explanation: "",
			points: question.points,
			competency: "external-import",
			imageUrl: question.imageDataUrl ?? null,
			responseGuide: question.responseGuide ?? null,
			answerLatex: null,
		};
	};

export const buildCreateExamServiceResult = async (
	db: DbClient,
	attemptId: string,
	externalExamId: string,
	externalExamInput?: ExternalNewMathExam,
): Promise<ExamResultSummary | null> => {
	const externalExam =
		externalExamInput ?? (await getExternalNewMathExam(externalExamId));
	const questionById = buildExternalQuestionMap(externalExam);
	const rows = await getAttemptResults(db, attemptId);

	if (rows.length === 0) {
		return null;
	}

	const questionResults = rows.map((row) => {
		const externalQuestion = questionById.get(row.questionId);
		const maxPoints = externalQuestion?.points ?? row.points;

		if (externalQuestion?.type === "MCQ") {
			const correctIndex =
				typeof externalQuestion.correctOption === "number"
					? externalQuestion.correctOption
					: null;
			const correctOptionId =
				correctIndex == null
					? ""
					: `${externalQuestion.id}-option-${correctIndex}`;
			const isCorrect =
				Boolean(correctOptionId) && row.selectedOptionId === correctOptionId;

			return {
				answerChangeCount: row.answerChangeCount ?? 0,
				competency: row.competency,
				correctOptionId,
				dwellMs: row.dwellMs ?? 0,
				explanation:
					externalQuestion.responseGuide ??
					row.explanation,
				isCorrect,
				maxPoints,
				pointsAwarded: isCorrect ? maxPoints : 0,
				prompt: row.prompt,
				questionId: row.questionId,
				questionType: "single-choice" as const,
				selectedOptionId: row.selectedOptionId,
			};
		}

		const studentAnswer = normalizeFreeResponseAnswer(row.selectedOptionId);
		const expectedAnswer = normalizeFreeResponseAnswer(
			externalQuestion?.answerLatex ?? null,
		);
		const isCorrect =
			studentAnswer !== "" &&
			expectedAnswer !== "" &&
			studentAnswer === expectedAnswer;

		return {
			answerChangeCount: row.answerChangeCount ?? 0,
			competency: row.competency,
			correctOptionId: "",
			dwellMs: row.dwellMs ?? 0,
			explanation:
				externalQuestion?.responseGuide ??
				(externalQuestion?.answerLatex
					? `Хүлээгдэж буй хариу: ${externalQuestion.answerLatex}`
					: row.responseGuide ?? row.explanation),
			isCorrect,
			maxPoints,
			pointsAwarded: isCorrect ? maxPoints : 0,
			prompt: row.prompt,
			questionId: row.questionId,
			questionType: "math" as const,
			selectedOptionId: row.selectedOptionId,
		};
	});

	const score = questionResults.reduce(
		(total, question) => total + question.pointsAwarded,
		0,
	);
	const maxScore = questionResults.reduce(
		(total, question) => total + question.maxPoints,
		0,
	);

	return {
		score,
		maxScore,
		percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
		correctCount: questionResults.filter((question) => question.isCorrect).length,
		incorrectCount: questionResults.filter(
			(question) => question.selectedOptionId !== null && !question.isCorrect,
		).length,
		unansweredCount: questionResults.filter(
			(question) => question.selectedOptionId === null,
		).length,
		questionResults,
	};
};

export const mapExternalNewMathExamToExamTest = (
	exam: ExternalNewMathExam,
): ExamTest => {
	const topicText =
		exam.sessionMeta?.topics?.join(", ") ||
		exam.generator?.topics ||
		"External import";
	const description =
		exam.sessionMeta?.description ||
		exam.generator?.sourceContext ||
		`${exam.title} - create-exam-service import`;

	return {
		id: exam.examId,
		title: exam.title,
		description,
		criteria: {
			gradeLevel: exam.sessionMeta?.grade ?? 0,
			className: exam.sessionMeta?.groupClass ?? "",
			subject: exam.sessionMeta?.subject ?? "math",
			topic: topicText,
			difficulty: exam.generator?.difficulty ?? "medium",
			questionCount: exam.questions.length,
		},
		timeLimitMinutes: exam.sessionMeta?.durationMinutes ?? 40,
		questions: exam.questions.map(mapExternalQuestionToExamQuestion),
		answerKeySource: "teacher_service",
		sourceService: "create-exam-service",
		updatedAt: exam.updatedAt,
		status: "published",
	};
};

export const importExternalNewMathExam = async (
	db: DbClient,
	examId: string,
	kv?: KVNamespace,
): Promise<ImportedExternalExam> => {
	const externalExam = await getExternalNewMathExam(examId);
	const mappedExam = mapExternalNewMathExamToExamTest(externalExam);

	await savePublishedTest(db, mappedExam, kv);

	return {
		examId: externalExam.examId,
		importedTestId: mappedExam.id,
		title: mappedExam.title,
	};
};

export const syncExternalNewMathExams = async (
	db: DbClient,
	kv?: KVNamespace,
	limit = 20,
) => {
	const exams = await listExternalNewMathExams(limit);
	const imported: ImportedExternalExam[] = [];

	for (const exam of exams) {
		try {
			imported.push(await importExternalNewMathExam(db, exam.examId, kv));
		} catch (error) {
			console.error(`Failed to sync external exam "${exam.examId}":`, error);
		}
	}

	return imported;
};
