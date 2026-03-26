import { eq } from "drizzle-orm";
import type { ExamAnswerInput, ExamTest } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
	ATTEMPT_CACHE_TTL_SECONDS,
	TEST_CACHE_INDEX_KEY,
	TEST_CACHE_TTL_SECONDS,
	attemptStateCacheKey,
	testCacheKey,
} from "./common";
import type { CachedAttemptState, CachedTestSummary } from "./internal-types";

export const readJsonFromKv = async <T>(
	kv: KVNamespace | undefined,
	key: string,
): Promise<T | null> => {
	if (!kv) return null;

	try {
		const cached = await kv.get(key);
		return cached ? (JSON.parse(cached) as T) : null;
	} catch (error) {
		console.error(`Failed to read KV key "${key}":`, error);
		return null;
	}
};

export const writeJsonToKv = async (
	kv: KVNamespace | undefined,
	key: string,
	value: unknown,
	expirationTtl: number,
) => {
	if (!kv) return;

	try {
		await kv.put(key, JSON.stringify(value), { expirationTtl });
	} catch (error) {
		console.error(`Failed to write KV key "${key}":`, error);
	}
};

export const syncPublishedTestCache = async (
	kv: KVNamespace | undefined,
	test: ExamTest,
) => {
	if (!kv) return;

	const updatedAt = test.updatedAt || new Date().toISOString();

	await writeJsonToKv(kv, testCacheKey(test.id), test, TEST_CACHE_TTL_SECONDS);

	const cachedIndex =
		(await readJsonFromKv<CachedTestSummary[]>(kv, TEST_CACHE_INDEX_KEY)) ?? [];
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

export const readCachedTest = async (
	kv: KVNamespace | undefined,
	testId: string,
) => readJsonFromKv<ExamTest>(kv, testCacheKey(testId));

export const buildAttemptState = ({
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

export const cacheAttemptState = async (
	kv: KVNamespace | undefined,
	state: CachedAttemptState,
) => {
	await writeJsonToKv(
		kv,
		attemptStateCacheKey(state.attemptId),
		state,
		ATTEMPT_CACHE_TTL_SECONDS,
	);
};

export const getAttemptStateFromKv = async (
	kv: KVNamespace | undefined,
	attemptId: string,
) => readJsonFromKv<CachedAttemptState>(kv, attemptStateCacheKey(attemptId));

export const mergeAnswersIntoState = (
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

export const resolveAttemptState = async (
	db: DbClient,
	attemptId: string,
	kv?: KVNamespace,
): Promise<CachedAttemptState> => {
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
	const totalQuestions =
		cachedTest?.questions.length ??
		(
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
		status: attempt.status,
		startedAt: attempt.startedAt,
		expiresAt: attempt.expiresAt,
		submittedAt: attempt.submittedAt ?? undefined,
		totalQuestions,
		answers: Object.fromEntries(
			answerRows.map((answer) => [answer.questionId, answer.selectedOptionId]),
		),
	});

	await cacheAttemptState(kv, state);
	return state;
};
