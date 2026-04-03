import { desc, eq, inArray } from "drizzle-orm";
import type {
	AttemptReviewPayload,
	AttemptSummary,
	ExamResultSummary,
} from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAttemptMonitoringSummaries } from "./activity";
import {
	ATTEMPTS_SUMMARY_CACHE_KEY,
	ATTEMPTS_SUMMARY_CACHE_TTL_SECONDS,
	computeProgress,
	countAnsweredQuestions,
} from "./common";
import {
	buildCreateExamServiceResult,
	getExternalNewMathExam,
	hydrateCreateExamServiceAnswerReview,
	mergeCreateExamServiceResult,
} from "./external";
import {
	enrichResultWithQuestionFeedback,
	generateAttemptFeedback,
	parseAttemptFeedback,
	stringifyAttemptFeedback,
} from "./feedback";
import { parseStoredTeacherResult } from "./teacher-sync";
import {
	cacheAttemptState,
	deleteJsonFromKv,
	getAttemptStateFromKv,
	readJsonFromKv,
	resolveAttemptState,
	writeJsonToKv,
} from "./cache";
import {
	computeResult,
	getAttemptAnswerReviewFromRows,
	getAttemptResults,
	getAttemptResultsForAttempts,
} from "./results";

type ApproveAttemptOptions = {
	ai?: {
		run: (
			model: string,
			input: {
				messages: Array<{ role: "system" | "user"; content: string }>;
				response_format?: { type: "json_object" };
			},
		) => Promise<{ response?: string }>;
	};
	geminiApiKey?: string;
	geminiModel?: string;
	kv?: KVNamespace;
	ollamaApiKey?: string;
	ollamaBaseUrl?: string;
	ollamaModel?: string;
	review?: AttemptReviewPayload;
};

const clampPoints = (value: number, maxPoints: number) =>
	Math.max(0, Math.min(Math.round(value), maxPoints));

const MAX_OVERVIEW_ATTEMPTS = 240;
const MAX_ATTEMPTS_PER_TEST = 120;

const clampAttemptLimit = (value: number | undefined, scopedToTest: boolean) => {
	const fallback = scopedToTest ? MAX_ATTEMPTS_PER_TEST : MAX_OVERVIEW_ATTEMPTS;
	const rounded =
		typeof value === "number" && Number.isFinite(value)
			? Math.round(value)
			: fallback;

	return Math.min(
		Math.max(rounded, 1),
		scopedToTest ? MAX_ATTEMPTS_PER_TEST : MAX_OVERVIEW_ATTEMPTS,
	);
};

const isMissingExternalExamError = (error: unknown) =>
	error instanceof Error && error.message === "External exam олдсонгүй.";

const buildReviewedResult = (
	rows: Awaited<ReturnType<typeof getAttemptResults>>,
	review?: AttemptReviewPayload,
): ExamResultSummary => {
	const reviewByQuestionId = new Map(
		(review?.questionReviews ?? []).map((question) => [question.questionId, question] as const),
	);

	const questionResults = rows.map((row) => {
		const manualReview = reviewByQuestionId.get(row.questionId);
		const maxPoints = Math.max(
			0,
			Math.round(manualReview?.maxPoints ?? row.points),
		);
		const defaultPoints =
			row.selectedOptionId === row.correctOptionId ? maxPoints : 0;
		const pointsAwarded = clampPoints(
			manualReview?.pointsAwarded ?? defaultPoints,
			maxPoints,
		);
		const isCorrect =
			typeof manualReview?.isCorrect === "boolean"
				? manualReview.isCorrect
				: pointsAwarded >= maxPoints && maxPoints > 0;

		return {
			answerChangeCount: row.answerChangeCount ?? 0,
			competency: row.competency,
			correctOptionId: manualReview?.correctOptionId ?? row.correctOptionId,
			dwellMs: row.dwellMs ?? 0,
			explanation:
				manualReview?.explanation?.trim() ||
				row.explanation ||
				row.responseGuide ||
				"",
			isCorrect,
			maxPoints,
			pointsAwarded,
			prompt: row.prompt,
			questionId: row.questionId,
			questionType: (row.questionType as "single-choice" | "math") ?? "single-choice",
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

export const listAttempts = async (
	db: DbClient,
	kv?: KVNamespace,
	options?: {
		includeProvisionalTeacherResults?: boolean;
		limit?: number;
		testId?: string;
	},
): Promise<AttemptSummary[]> => {
	if (options?.testId) {
		const scopedLimit = clampAttemptLimit(options.limit, true);
		const records = await db.query.attempts.findMany({
			where: eq(schema.attempts.testId, options.testId),
			orderBy: [desc(schema.attempts.startedAt)],
			limit: scopedLimit,
		});
		return buildAttemptSummaries(db, records, kv, options);
	}

	const cachedSummaries = await readJsonFromKv<AttemptSummary[]>(
		kv,
		ATTEMPTS_SUMMARY_CACHE_KEY,
	);
	if (cachedSummaries) {
		return cachedSummaries;
	}

	const records = await db.query.attempts.findMany({
		orderBy: [desc(schema.attempts.startedAt)],
		limit: clampAttemptLimit(options?.limit, false),
	});
	const summaries = await buildAttemptSummaries(db, records, kv, options);

	await writeJsonToKv(
		kv,
		ATTEMPTS_SUMMARY_CACHE_KEY,
		summaries,
		ATTEMPTS_SUMMARY_CACHE_TTL_SECONDS,
	);

	return summaries;
};

const buildAttemptSummaries = async (
	db: DbClient,
	records: Awaited<ReturnType<DbClient["query"]["attempts"]["findMany"]>>,
	kv?: KVNamespace,
	options?: {
		includeProvisionalTeacherResults?: boolean;
	},
) => {
	if (records.length === 0) {
		return [];
	}

	const attemptIds = records.map((record) => record.id);
	const testIds = [...new Set(records.map((record) => record.testId))];
	const monitoringByAttemptId = await getAttemptMonitoringSummaries(
		db,
		attemptIds,
	);
	const tests =
		testIds.length > 0
			? await db.query.tests.findMany({
					where: inArray(schema.tests.id, testIds),
				})
			: [];
	const teacherSyncExports =
		attemptIds.length > 0
			? await db.query.teacherSubmissionExports.findMany({
					where: inArray(schema.teacherSubmissionExports.attemptId, attemptIds),
				})
			: [];
	const answerRows =
		attemptIds.length > 0
			? await db.query.answers.findMany({
					where: inArray(schema.answers.attemptId, attemptIds),
				})
			: [];
	const questions =
		testIds.length > 0
			? await db.query.questions.findMany({
					where: inArray(schema.questions.testId, testIds),
					columns: {
						testId: true,
					},
				})
			: [];
	const testsById = new Map(tests.map((test) => [test.id, test]));
	const teacherSyncByAttemptId = new Map(
		teacherSyncExports.map((item) => [item.attemptId, item] as const),
	);
	const questionCountsByTestId = new Map<string, number>();
	for (const question of questions) {
		questionCountsByTestId.set(
			question.testId,
			(questionCountsByTestId.get(question.testId) ?? 0) + 1,
		);
	}
	const answersByAttemptId = new Map<
		string,
		Array<(typeof answerRows)[number]>
	>();
	for (const answer of answerRows) {
		const current = answersByAttemptId.get(answer.attemptId) ?? [];
		current.push(answer);
		answersByAttemptId.set(answer.attemptId, current);
	}
	const attemptsNeedingQuestionRows = records
		.filter(
			(record) =>
				record.status === "processing" ||
				record.status === "submitted" ||
				record.status === "approved",
		)
		.map((record) => record.id);
	const resultRowsByAttemptId = await getAttemptResultsForAttempts(
		db,
		attemptsNeedingQuestionRows,
	);
	const answerReviewByAttemptId = new Map(
		attemptsNeedingQuestionRows.map((attemptId) => [
			attemptId,
			getAttemptAnswerReviewFromRows(resultRowsByAttemptId.get(attemptId) ?? []),
		] as const),
	);

	const summaries: AttemptSummary[] = [];
	const externalExamCache = new Map<
		string,
		Awaited<ReturnType<typeof getExternalNewMathExam>> | null
	>();

	for (const record of records) {
		const test = testsById.get(record.testId);
		const teacherSyncExport = teacherSyncByAttemptId.get(record.id);
		const attemptAnswerRows = answersByAttemptId.get(record.id) ?? [];
		const totalQuestions = questionCountsByTestId.get(record.testId) ?? 0;
		const attemptState = {
			answers: Object.fromEntries(
				attemptAnswerRows.map((answer) => [
					answer.questionId,
					answer.selectedOptionId,
				]),
			),
			attemptId: record.id,
			expiresAt: record.expiresAt,
			startedAt: record.startedAt,
			status: record.status,
			studentId: record.studentId,
			studentName: record.studentName,
			submittedAt: record.submittedAt ?? undefined,
			testId: record.testId,
			totalQuestions,
		};
		const answeredQuestions = Object.values(attemptState.answers).filter(Boolean).length;
		const answerKeySource = test?.answerKeySource ?? "local";
		const teacherCheckedResult = parseStoredTeacherResult(record.teacherResultJson);
		const hasReviewableAnswers =
			answerKeySource === "local" &&
			(record.status === "submitted" || record.status === "approved");
		const resultRows =
			hasReviewableAnswers ? resultRowsByAttemptId.get(record.id) ?? [] : [];
		let answerReview = answerReviewByAttemptId.get(record.id) ?? [];
		let provisionalTeacherResult = undefined;
		let externalExam = undefined;
		if (
			options?.includeProvisionalTeacherResults &&
			answerKeySource === "teacher_service" &&
			test?.sourceService === "create-exam-service" &&
			(record.status === "submitted" || record.status === "approved")
		) {
			const cachedExternalExam = externalExamCache.get(test.generatorTestId);
			if (cachedExternalExam !== undefined) {
				externalExam = cachedExternalExam ?? undefined;
			} else {
				try {
					externalExam = await getExternalNewMathExam(test.generatorTestId);
					externalExamCache.set(test.generatorTestId, externalExam);
				} catch (error) {
					if (isMissingExternalExamError(error)) {
						externalExamCache.set(test.generatorTestId, null);
						console.warn(
							`Skipping provisional teacher result for ${record.id}: external exam "${test.generatorTestId}" олдсонгүй.`,
						);
					} else {
						console.error(
							`Failed to load external exam "${test.generatorTestId}" for ${record.id}:`,
							error,
						);
					}
				}
			}

			if (externalExam) {
				try {
					answerReview = hydrateCreateExamServiceAnswerReview(
						answerReview,
						externalExam,
					);
					provisionalTeacherResult =
						(await buildCreateExamServiceResult(
							db,
							record.id,
							test.generatorTestId,
							externalExam,
						)) ?? undefined;
				} catch (error) {
					console.error(
						`Failed to build provisional teacher result for ${record.id}:`,
						error,
					);
				}
			}
		}
		const result =
			answerKeySource === "teacher_service"
				? provisionalTeacherResult
					? mergeCreateExamServiceResult(
							teacherCheckedResult,
							provisionalTeacherResult,
						)
					: teacherCheckedResult
				: teacherCheckedResult ??
					(hasReviewableAnswers
						? computeResult(resultRows)
						: undefined);
			const isApproved = record.status === "approved";

			summaries.push({
			attemptId: record.id,
			testId: record.testId,
			title: test?.title || "Unknown Test",
			studentId: record.studentId,
			studentName: record.studentName,
			status: record.status,
			answerKeySource,
			criteria: test
				? {
					gradeLevel: test.gradeLevel,
					className: test.className,
					subject: test.subject,
					topic: test.topic,
					difficulty: "medium",
					questionCount: attemptState.totalQuestions,
				}
				: undefined,
			progress: computeProgress(answeredQuestions, attemptState.totalQuestions),
			score: isApproved ? record.score ?? undefined : undefined,
			maxScore: isApproved ? record.maxScore ?? undefined : undefined,
			percentage: isApproved ? record.percentage ?? undefined : undefined,
			startedAt: record.startedAt,
				submittedAt: record.submittedAt ?? undefined,
				result,
				answerReview,
				feedback: parseAttemptFeedback(record.feedbackJson),
				monitoring: monitoringByAttemptId.get(record.id),
				teacherSync: teacherSyncExport
					? {
							status: teacherSyncExport.status,
							targetService: teacherSyncExport.targetService,
							lastError: teacherSyncExport.lastError ?? undefined,
							sentAt: teacherSyncExport.sentAt ?? undefined,
						}
						: undefined,
			});
	}
	return summaries;
};

export const invalidateAttemptsSummaryCache = async (kv?: KVNamespace) => {
	await deleteJsonFromKv(kv, ATTEMPTS_SUMMARY_CACHE_KEY);
};

export const approveAttempt = async (
	db: DbClient,
	attemptId: string,
	options: ApproveAttemptOptions = {},
) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	const hasManualReview = (options.review?.questionReviews?.length ?? 0) > 0;
	if (attempt.status === "approved" && !hasManualReview) return;
	if (
		attempt.status !== "submitted" &&
		attempt.status !== "processing" &&
		attempt.status !== "approved"
	) {
		throw new Error("Зөвхөн илгээгдсэн шалгалтыг батлах боломжтой.");
	}

	const test = await db.query.tests.findFirst({
		where: eq(schema.tests.id, attempt.testId),
	});
	const storedReviewedResult = parseStoredTeacherResult(attempt.teacherResultJson);
	if (test?.answerKeySource === "teacher_service" && !hasManualReview && !storedReviewedResult) {
		throw new Error(
			"Энэ шалгалтын зөв хариулт багшийн талд байгаа тул эндээс approve хийхгүй.",
		);
	}

	const resultRows = await getAttemptResults(db, attemptId);
	const result = await enrichResultWithQuestionFeedback(
		resultRows,
		hasManualReview
		? buildReviewedResult(resultRows, options.review)
		: storedReviewedResult ??
			(test?.answerKeySource === "teacher_service"
				? (() => {
						throw new Error("Батлах review мэдээлэл дутуу байна.");
					})()
				: computeResult(resultRows)),
		{
			ai: options.ai,
			geminiApiKey: options.geminiApiKey,
			geminiModel: options.geminiModel,
			ollamaApiKey: options.ollamaApiKey,
			ollamaBaseUrl: options.ollamaBaseUrl,
			ollamaModel: options.ollamaModel,
		},
	);
	const attemptState = await resolveAttemptState(db, attemptId, options.kv);
	const progress = computeProgress(
		countAnsweredQuestions(attemptState.answers),
		attemptState.totalQuestions,
	);
	const feedback = await generateAttemptFeedback(
		db,
		{ attemptId, progress, result },
		{
			ai: options.ai,
			geminiApiKey: options.geminiApiKey,
			geminiModel: options.geminiModel,
			ollamaApiKey: options.ollamaApiKey,
			ollamaBaseUrl: options.ollamaBaseUrl,
			ollamaModel: options.ollamaModel,
		},
	);

	await db.update(schema.attempts)
		.set({
			feedbackJson: stringifyAttemptFeedback(feedback),
			status: "approved",
			score: result.score,
			maxScore: result.maxScore,
			percentage: result.percentage,
			teacherResultJson: JSON.stringify(result),
		})
		.where(eq(schema.attempts.id, attemptId));

	const cachedState = await getAttemptStateFromKv(options.kv, attemptId);
	if (cachedState) {
		await cacheAttemptState(options.kv, {
			...cachedState,
			status: "approved",
		});
	}
};
