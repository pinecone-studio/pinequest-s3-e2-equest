import { sql, eq, and, desc } from "drizzle-orm";
import type {
	AttemptSummary,
	ExamAnswerInput,
	ExamProgress,
	ExamQuestionResult,
	ExamResultSummary,
	GetProgressResponse,
	MockTest,
	StartExamResponse,
	SubmitAnswersResponse,
	StudentInfo,
} from "@shared/contracts/mock-exam";
import { shuffleWithSeed } from "@/lib/exam-service/shuffle";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const TEST_CACHE_TTL_SECONDS = 60 * 60 * 24;
const ATTEMPT_CACHE_TTL_SECONDS = 60 * 60 * 12;
const TEST_CACHE_INDEX_KEY = "tests:index";
const testCacheKey = (testId: string) => `test:${testId}`;
const attemptStateCacheKey = (attemptId: string) => `attempt:${attemptId}:state`;

type AttemptStatus = SubmitAnswersResponse["status"];

type CachedAttemptState = {
	attemptId: string;
	testId: string;
	studentId: string;
	studentName: string;
	status: AttemptStatus;
	startedAt: string;
	expiresAt: string;
	submittedAt?: string;
	totalQuestions: number;
	answers: Record<string, string | null>;
};

type CachedTestSummary = {
	id: string;
	title: string;
	description: string;
	criteria: MockTest["criteria"];
	timeLimitMinutes: number;
	updatedAt: string;
};

type AttemptShuffleManifest = {
	version: 1;
	questionOrder: string[];
	optionOrderByQuestion: Record<string, string[]>;
};

type SubmissionQueueMessage =
	| {
		type: "UPSERT_ANSWERS";
		attemptId: string;
		answers: ExamAnswerInput[];
		finalize: boolean;
		submittedAt: string;
	}
	| {
		type: "ANSWER_UPDATE";
		attemptId: string;
		data: ExamAnswerInput;
	}
	| {
		type: "SUBMISSION";
		attemptId: string;
	};

// Internal helpers
const computeProgress = (answersCount: number, totalQuestions: number): ExamProgress => ({
	totalQuestions,
	answeredQuestions: answersCount,
	remainingQuestions: totalQuestions - answersCount,
	completionRate: totalQuestions === 0 ? 0 : Math.round((answersCount / totalQuestions) * 100),
});

const countAnsweredQuestions = (answers: Record<string, string | null>) =>
	Object.values(answers).filter((value) => value !== null && value !== "").length;

const isUniqueConstraintError = (error: unknown) =>
	error instanceof Error && error.message.toLowerCase().includes("unique");

const getQuestionId = (question: any) => (question as any).id || (question as any).questionId;
const getQuestionOptions = (question: any) =>
	typeof question.options === "string" ? JSON.parse(question.options) : question.options;
const getOptionId = (option: any) => option.id;

const readJsonFromKv = async <T>(kv: KVNamespace | undefined, key: string): Promise<T | null> => {
	if (!kv) return null;

	try {
		const cached = await kv.get(key);
		return cached ? JSON.parse(cached) as T : null;
	} catch (error) {
		console.error(`Failed to read KV key "${key}":`, error);
		return null;
	}
};

const writeJsonToKv = async (kv: KVNamespace | undefined, key: string, value: unknown, expirationTtl: number) => {
	if (!kv) return;

	try {
		await kv.put(key, JSON.stringify(value), { expirationTtl });
	} catch (error) {
		console.error(`Failed to write KV key "${key}":`, error);
	}
};

const syncPublishedTestCache = async (kv: KVNamespace | undefined, test: MockTest) => {
	if (!kv) return;

	const updatedAt = test.updatedAt || new Date().toISOString();

	await writeJsonToKv(kv, testCacheKey(test.id), test, TEST_CACHE_TTL_SECONDS);

	const cachedIndex = (await readJsonFromKv<CachedTestSummary[]>(kv, TEST_CACHE_INDEX_KEY)) ?? [];
	const nextEntry: CachedTestSummary = {
		id: test.id,
		title: test.title,
		description: test.description,
		criteria: test.criteria,
		timeLimitMinutes: test.timeLimitMinutes,
		updatedAt,
	};

	const nextIndex = [
		nextEntry,
		...cachedIndex.filter((entry) => entry.id !== test.id),
	].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

	await writeJsonToKv(kv, TEST_CACHE_INDEX_KEY, nextIndex, TEST_CACHE_TTL_SECONDS);
};

const readCachedTest = async (kv: KVNamespace | undefined, testId: string) =>
	readJsonFromKv<MockTest>(kv, testCacheKey(testId));

const buildAttemptState = ({
	attemptId,
	testId,
	studentId,
	studentName,
	status,
	startedAt,
	expiresAt,
	submittedAt,
	totalQuestions,
	answers,
}: CachedAttemptState): CachedAttemptState => ({
	attemptId,
	testId,
	studentId,
	studentName,
	status,
	startedAt,
	expiresAt,
	submittedAt,
	totalQuestions,
	answers,
});

const cacheAttemptState = async (kv: KVNamespace | undefined, state: CachedAttemptState) => {
	await writeJsonToKv(kv, attemptStateCacheKey(state.attemptId), state, ATTEMPT_CACHE_TTL_SECONDS);
};

const getAttemptStateFromKv = async (kv: KVNamespace | undefined, attemptId: string) =>
	readJsonFromKv<CachedAttemptState>(kv, attemptStateCacheKey(attemptId));

const mergeAnswersIntoState = (
	state: CachedAttemptState,
	inputAnswers: ExamAnswerInput[],
	finalize: boolean,
	submittedAt = new Date().toISOString(),
): CachedAttemptState => {
	const nextAnswers = { ...state.answers };
	for (const answer of inputAnswers) {
		nextAnswers[answer.questionId] = answer.selectedOptionId;
	}

	return {
		...state,
		answers: nextAnswers,
		status: finalize ? "processing" : state.status,
		submittedAt: finalize ? submittedAt : state.submittedAt,
	};
};

const resolveAttemptState = async (db: DbClient, attemptId: string, kv?: KVNamespace): Promise<CachedAttemptState> => {
	const cachedState = await getAttemptStateFromKv(kv, attemptId);
	if (cachedState) return cachedState;

	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");

	const answerRows = await db.query.answers.findMany({
		where: eq(schema.answers.attemptId, attemptId),
	});

	const cachedTest = await readCachedTest(kv, attempt.testId);
	const totalQuestions = cachedTest?.questions.length ?? (
		await db.query.questions.findMany({
			where: eq(schema.questions.testId, attempt.testId),
			columns: { id: true },
		})
	).length;

	const state = buildAttemptState({
		attemptId: attempt.id,
		testId: attempt.testId,
		studentId: attempt.studentId,
		studentName: attempt.studentName,
		status: attempt.status as AttemptStatus,
		startedAt: attempt.startedAt,
		expiresAt: attempt.expiresAt,
		submittedAt: attempt.submittedAt ?? undefined,
		totalQuestions,
		answers: Object.fromEntries(answerRows.map((answer) => [answer.questionId, answer.selectedOptionId])),
	});

	await cacheAttemptState(kv, state);
	return state;
};

const persistAnswerUpdates = async (db: DbClient, attemptId: string, answers: ExamAnswerInput[]) => {
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

const findExistingAttempt = async (db: DbClient, testId: string, studentId: string) =>
	db.query.attempts.findFirst({
		where: and(eq(schema.attempts.testId, testId), eq(schema.attempts.studentId, studentId)),
		orderBy: [desc(schema.attempts.startedAt)],
	});

const createShuffleManifest = (
	attemptId: string,
	studentId: string,
	testId: string,
	testQuestions: any[],
): AttemptShuffleManifest => {
	const questionSeed = `${testId}:${studentId}:${attemptId}:questions`;
	const shuffledQuestionIds = shuffleWithSeed(
		testQuestions.map((question) => getQuestionId(question)),
		questionSeed,
	);

	const optionOrderByQuestion = Object.fromEntries(
		testQuestions.map((question, index) => {
			const questionId = getQuestionId(question);
			const shuffledOptionIds = shuffleWithSeed(
				getQuestionOptions(question).map((option: any) => getOptionId(option)),
				`${attemptId}:${questionId}:options:${index}`,
			);

			return [questionId, shuffledOptionIds];
		}),
	);

	return {
		version: 1,
		questionOrder: shuffledQuestionIds,
		optionOrderByQuestion,
	};
};

const parseShuffleManifest = (rawManifest?: string | null): AttemptShuffleManifest | null => {
	if (!rawManifest) return null;

	try {
		const parsed = JSON.parse(rawManifest) as AttemptShuffleManifest;
		if (parsed.version !== 1 || !Array.isArray(parsed.questionOrder) || !parsed.optionOrderByQuestion) {
			return null;
		}

		return parsed;
	} catch (error) {
		console.error("Failed to parse shuffle manifest:", error);
		return null;
	}
};

const resolveShuffleManifest = (
	attemptId: string,
	studentId: string,
	testId: string,
	testQuestions: any[],
	rawManifest?: string | null,
) => parseShuffleManifest(rawManifest) ?? createShuffleManifest(attemptId, studentId, testId, testQuestions);

const applyShuffleManifest = (testQuestions: any[], manifest: AttemptShuffleManifest) => {
	const questionMap = new Map(testQuestions.map((question) => [getQuestionId(question), question]));

	const orderedQuestions = manifest.questionOrder
		.map((questionId) => questionMap.get(questionId))
		.filter(Boolean);

	for (const question of testQuestions) {
		const questionId = getQuestionId(question);
		if (!manifest.questionOrder.includes(questionId)) {
			orderedQuestions.push(question);
		}
	}

	return orderedQuestions.map((question) => {
		const questionId = getQuestionId(question);
		const options = getQuestionOptions(question);
		const optionOrder = manifest.optionOrderByQuestion[questionId];

		if (!optionOrder) {
			return {
				...question,
				options,
			};
		}

		const optionMap = new Map(options.map((option: any) => [getOptionId(option), option]));
		const orderedOptions = optionOrder
			.map((optionId) => optionMap.get(optionId))
			.filter(Boolean);

		for (const option of options) {
			if (!optionOrder.includes(getOptionId(option))) {
				orderedOptions.push(option);
			}
		}

		return {
			...question,
			options: orderedOptions,
		};
	});
};

export const savePublishedTest = async (db: DbClient, test: MockTest, kv?: KVNamespace) => {
	await db.insert(schema.tests).values({
		id: test.id,
		generatorTestId: test.id,
		title: test.title,
		description: test.description,
		gradeLevel: test.criteria.gradeLevel,
		className: test.criteria.className,
		topic: test.criteria.topic,
		subject: test.criteria.subject,
		timeLimitMinutes: test.timeLimitMinutes,
		status: "published",
	}).onConflictDoUpdate({
		target: schema.tests.id,
		set: {
			title: test.title,
			description: test.description,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		}
	});

	// Save questions
	for (const [idx, q] of test.questions.entries()) {
		await db.insert(schema.questions).values({
			id: q.id,
			testId: test.id,
			prompt: q.prompt,
			options: JSON.stringify(q.options),
			correctOptionId: q.correctOptionId,
			explanation: q.explanation,
			points: q.points,
			competency: q.competency,
			imageUrl: q.imageUrl,
			audioUrl: q.audioUrl,
			videoUrl: q.videoUrl,
			orderSlot: idx,
		}).onConflictDoUpdate({
			target: schema.questions.id,
			set: {
				prompt: q.prompt,
				options: JSON.stringify(q.options),
				correctOptionId: q.correctOptionId,
				imageUrl: q.imageUrl,
				audioUrl: q.audioUrl,
				videoUrl: q.videoUrl,
			}
		});
	}

	await syncPublishedTestCache(kv, test);
};

export const startExamAttempt = async (db: DbClient, testId: string, studentId: string, studentName: string, kv?: KVNamespace) => {
	const normalizedStudentId = studentId.trim();
	const normalizedStudentName = studentName.trim();

	const existingAttempt = await findExistingAttempt(db, testId, normalizedStudentId);
	if (existingAttempt) {
		if (existingAttempt.status === "in_progress") {
			return resumeExamAttempt(db, existingAttempt.id, kv);
		}

		throw new Error("Энэ сурагч энэ шалгалтыг аль хэдийн өгсөн байна.");
	}

	let testData: any;
	let testQuestions: any[] = [];

	const cachedTest = await readCachedTest(kv, testId);
	if (cachedTest) {
		testData = {
			id: cachedTest.id,
			title: cachedTest.title,
			description: cachedTest.description,
			gradeLevel: cachedTest.criteria.gradeLevel,
			className: cachedTest.criteria.className,
			subject: cachedTest.criteria.subject,
			topic: cachedTest.criteria.topic,
			timeLimitMinutes: cachedTest.timeLimitMinutes,
		};
		testQuestions = cachedTest.questions;
	}

	if (!testData) {
		const test = await db.query.tests.findFirst({
			where: eq(schema.tests.id, testId),
		});
		if (!test) throw new Error("Шалгалт олдсонгүй.");
		testData = test;

		testQuestions = await db.query.questions.findMany({
			where: eq(schema.questions.testId, testId),
			orderBy: [schema.questions.orderSlot],
		});
	}

	const attemptId = createId("attempt");
	const startedAt = new Date().toISOString();
	const expiresAt = new Date(Date.now() + testData.timeLimitMinutes * 60_000).toISOString();
	const shuffleManifest = createShuffleManifest(attemptId, normalizedStudentId, testId, testQuestions);

	// Create attempt record
	try {
		await db.insert(schema.attempts).values({
			id: attemptId,
			testId,
			studentId: normalizedStudentId,
			studentName: normalizedStudentName,
			shuffleManifest: JSON.stringify(shuffleManifest),
			status: "in_progress",
			startedAt,
			expiresAt,
		});
	} catch (error) {
		if (!isUniqueConstraintError(error)) throw error;

		const concurrentAttempt = await findExistingAttempt(db, testId, normalizedStudentId);
		if (concurrentAttempt?.status === "in_progress") {
			return resumeExamAttempt(db, concurrentAttempt.id, kv);
		}

		throw new Error("Энэ сурагч энэ шалгалтыг аль хэдийн өгсөн байна.");
	}

	await cacheAttemptState(kv, buildAttemptState({
		attemptId,
		testId,
		studentId: normalizedStudentId,
		studentName: normalizedStudentName,
		status: "in_progress",
		startedAt,
		expiresAt,
		totalQuestions: testQuestions.length,
		answers: {},
	}));

	return formatExamResponse(
		attemptId,
		normalizedStudentId,
		normalizedStudentName,
		startedAt,
		expiresAt,
		testId,
		testData,
		testQuestions,
		0,
		shuffleManifest,
	);
};

export const resumeExamAttempt = async (db: DbClient, attemptId: string, kv?: KVNamespace) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	if (attempt.status !== "in_progress") throw new Error("Энэ оролдлого дууссан байна.");

	const testId = attempt.testId;
	let testData: any;
	let testQuestions: any[] = [];

	const cachedTest = await readCachedTest(kv, testId);
	if (cachedTest) {
		testData = {
			id: cachedTest.id,
			title: cachedTest.title,
			description: cachedTest.description,
			gradeLevel: cachedTest.criteria.gradeLevel,
			className: cachedTest.criteria.className,
			subject: cachedTest.criteria.subject,
			topic: cachedTest.criteria.topic,
			timeLimitMinutes: cachedTest.timeLimitMinutes,
		};
		testQuestions = cachedTest.questions;
	}

	if (!testData) {
		const test = await db.query.tests.findFirst({ where: eq(schema.tests.id, testId) });
		if (!test) throw new Error("Тест олдсонгүй.");
		testData = test;
		testQuestions = await db.query.questions.findMany({
			where: eq(schema.questions.testId, testId),
			orderBy: [schema.questions.orderSlot],
		});
	}

	const answers = await db.query.answers.findMany({
		where: eq(schema.answers.attemptId, attemptId),
	});

	const answersMap = Object.fromEntries(answers.map((answer) => [answer.questionId, answer.selectedOptionId]));
	const answeredCount = countAnsweredQuestions(answersMap);

	await cacheAttemptState(kv, buildAttemptState({
		attemptId,
		testId,
		studentId: attempt.studentId,
		studentName: attempt.studentName,
		status: attempt.status as AttemptStatus,
		startedAt: attempt.startedAt,
		expiresAt: attempt.expiresAt,
		submittedAt: attempt.submittedAt ?? undefined,
		totalQuestions: testQuestions.length,
		answers: answersMap,
	}));

	return {
		...formatExamResponse(
			attemptId,
			attempt.studentId,
			attempt.studentName,
			attempt.startedAt,
			attempt.expiresAt,
			testId,
			testData,
			testQuestions,
			answeredCount,
			resolveShuffleManifest(attemptId, attempt.studentId, testId, testQuestions, attempt.shuffleManifest),
		),
		existingAnswers: answersMap,
	};
};

const formatExamResponse = (
	attemptId: string,
	studentId: string,
	studentName: string,
	startedAt: string,
	expiresAt: string,
	testId: string,
	testData: any,
	testQuestions: any[],
	answeredCount: number,
	manifest = createShuffleManifest(attemptId, studentId, testId, testQuestions),
) => {
	const shuffledQuestions = applyShuffleManifest(testQuestions, manifest).map((question) => ({
		questionId: getQuestionId(question),
		type: "single-choice" as const,
		prompt: question.prompt,
		options: getQuestionOptions(question),
		points: question.points,
		competency: question.competency,
		imageUrl: question.imageUrl,
		audioUrl: question.audioUrl,
		videoUrl: question.videoUrl,
	}));

	return {
		attemptId,
		status: "in_progress" as const,
		studentId,
		studentName,
		startedAt,
		expiresAt,
		exam: {
			testId,
			title: testData.title,
			description: testData.description,
			criteria: {
				gradeLevel: testData.gradeLevel,
				className: testData.className,
				subject: testData.subject,
				topic: testData.topic,
				difficulty: "medium" as any, // fallback
				questionCount: testQuestions.length,
			},
			timeLimitMinutes: testData.timeLimitMinutes,
			questions: shuffledQuestions,
		},
		progress: computeProgress(answeredCount, testQuestions.length),
	};
};

export const submitExamAnswers = async (
	db: DbClient,
	attemptId: string,
	inputAnswers: ExamAnswerInput[],
	finalize = false,
	queue?: Queue,
	kv?: KVNamespace,
): Promise<SubmitAnswersResponse> => {
	const attemptState = await resolveAttemptState(db, attemptId, kv);

	if (attemptState.status === "submitted" || attemptState.status === "approved" || attemptState.status === "processing") {
		const qResults = await getAttemptResults(db, attemptId);
		return {
			attemptId,
			status: attemptState.status,
			progress: computeProgress(qResults.filter(r => r.selectedOptionId).length, qResults.length),
			result: attemptState.status === "approved" ? computeResult(qResults) : undefined,
		};
	}

	let status: AttemptStatus = attemptState.status;
	const submittedAt = finalize ? new Date().toISOString() : undefined;

	if (queue) {
		const nextState = mergeAnswersIntoState(attemptState, inputAnswers, finalize, submittedAt);
		status = nextState.status;
		await cacheAttemptState(kv, nextState);
		await queue.send({
			type: "UPSERT_ANSWERS",
			attemptId,
			answers: inputAnswers,
			finalize,
			submittedAt: submittedAt ?? new Date().toISOString(),
		} satisfies SubmissionQueueMessage);
	} else {
		await persistAnswerUpdates(db, attemptId, inputAnswers);

		if (finalize) {
			status = "submitted";

			await db.update(schema.attempts).set({
				status,
				submittedAt: new Date().toISOString(),
				score: null,
				maxScore: null,
				percentage: null,
			}).where(eq(schema.attempts.id, attemptId));

			await cacheAttemptState(kv, {
				...mergeAnswersIntoState(attemptState, inputAnswers, true, submittedAt),
				status: "submitted",
			});
			return {
				attemptId,
				status,
				progress: computeProgress(
					countAnsweredQuestions(mergeAnswersIntoState(attemptState, inputAnswers, true, submittedAt).answers),
					attemptState.totalQuestions,
				),
			};
		}

		const nextState = mergeAnswersIntoState(attemptState, inputAnswers, false);
		await cacheAttemptState(kv, nextState);
	}

	return {
		attemptId,
		status,
		progress: computeProgress(
			countAnsweredQuestions(mergeAnswersIntoState(attemptState, inputAnswers, finalize, submittedAt).answers),
			attemptState.totalQuestions,
		),
	};
};

export const processSubmissionQueueMessage = async (
	db: DbClient,
	message: SubmissionQueueMessage,
	kv?: KVNamespace,
) => {
	if (message.type === "ANSWER_UPDATE") {
		await persistAnswerUpdates(db, message.attemptId, [message.data]);
		return;
	}

	if (message.type === "SUBMISSION") {
		const submittedAt = new Date().toISOString();

		await db.update(schema.attempts)
			.set({
				status: "submitted",
				submittedAt,
				score: null,
				maxScore: null,
				percentage: null,
			})
			.where(eq(schema.attempts.id, message.attemptId));

		const cachedState = await getAttemptStateFromKv(kv, message.attemptId);
		if (cachedState) {
			await cacheAttemptState(kv, {
				...cachedState,
				status: "submitted",
				submittedAt,
			});
		}
		return;
	}

	await persistAnswerUpdates(db, message.attemptId, message.answers);

	if (!message.finalize) return;

	await db.update(schema.attempts)
		.set({
			status: "submitted",
			submittedAt: message.submittedAt,
			score: null,
			maxScore: null,
			percentage: null,
		})
		.where(eq(schema.attempts.id, message.attemptId));

	const cachedState = await getAttemptStateFromKv(kv, message.attemptId);
	if (cachedState) {
		await cacheAttemptState(kv, {
			...cachedState,
			status: "submitted",
			submittedAt: message.submittedAt,
		});
	}
};

const getAttemptResults = async (db: DbClient, attemptId: string) => {
	const data = await db.select({
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

	return data;
};

const computeResult = (questions: any[]): ExamResultSummary => {
	const questionResults: ExamQuestionResult[] = questions.map(q => ({
		questionId: q.questionId,
		selectedOptionId: q.selectedOptionId,
		correctOptionId: q.correctOptionId,
		isCorrect: q.selectedOptionId === q.correctOptionId,
		pointsAwarded: q.selectedOptionId === q.correctOptionId ? q.points : 0,
		maxPoints: q.points,
		explanation: q.explanation,
	}));

	const score = questionResults.reduce((t, r) => t + r.pointsAwarded, 0);
	const maxScore = questionResults.reduce((t, r) => t + r.maxPoints, 0);

	return {
		score,
		maxScore,
		percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
		correctCount: questionResults.filter(r => r.isCorrect).length,
		incorrectCount: questionResults.filter(r => r.selectedOptionId !== null && !r.isCorrect).length,
		unansweredCount: questionResults.filter(r => r.selectedOptionId === null).length,
		questionResults,
	};
};

export const listAttempts = async (db: DbClient): Promise<AttemptSummary[]> => {
	const records = await db.query.attempts.findMany({
		orderBy: [desc(schema.attempts.startedAt)],
	});

	const summaries: AttemptSummary[] = [];

	for (const r of records) {
		const test = await db.query.tests.findFirst({ where: eq(schema.tests.id, r.testId) });
		const isApproved = r.status === "approved";
		const qResults = isApproved ? await getAttemptResults(db, r.id) : [];

		summaries.push({
			attemptId: r.id,
			testId: r.testId,
			title: test?.title || "Unknown Test",
			studentId: r.studentId,
			studentName: r.studentName,
			status: r.status as any,
			score: isApproved ? r.score ?? undefined : undefined,
			maxScore: isApproved ? r.maxScore ?? undefined : undefined,
			percentage: isApproved ? r.percentage ?? undefined : undefined,
			startedAt: r.startedAt,
			submittedAt: r.submittedAt ?? undefined,
			result: isApproved ? computeResult(qResults) : undefined,
		});
	}

	return summaries;
};

export const approveAttempt = async (db: DbClient, attemptId: string, kv?: KVNamespace) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	if (attempt.status === "approved") return;
	if (attempt.status !== "submitted") {
		throw new Error("Зөвхөн илгээгдсэн шалгалтыг батлах боломжтой.");
	}

	const qResults = await getAttemptResults(db, attemptId);
	const result = computeResult(qResults);

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

export const listTests = async (db: DbClient, kv?: KVNamespace) => {
	const cachedIndex = await readJsonFromKv<CachedTestSummary[]>(kv, TEST_CACHE_INDEX_KEY);
	if (cachedIndex) return cachedIndex;

	return db.query.tests.findMany({
		orderBy: [desc(schema.tests.updatedAt)],
	});
};
