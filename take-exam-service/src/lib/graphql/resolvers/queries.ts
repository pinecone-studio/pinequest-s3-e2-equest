import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { ensureExamSchema } from "@/lib/db/bootstrap";
import { students } from "@/lib/db/schema";
import { seedStudents } from "@/lib/db/seed";
import {
	invalidateAttemptsSummaryCache,
	listAvailableTests,
	listLiveMonitoringFeed,
	listAttempts,
	listExternalNewMathExams,
	getTestMaterial,
} from "@/lib/exam-service/store";

type ResolverEnv = {
	DB: D1Database;
	EXAM_CACHE?: KVNamespace;
};

type ResolverContext = {
	env: ResolverEnv;
};

const DEFAULT_AVAILABLE_TESTS_LIMIT = 80;
const DEFAULT_ATTEMPTS_LIMIT = 180;
const DEFAULT_ATTEMPTS_BY_TEST_LIMIT = 120;
const DEFAULT_LIVE_FEED_LIMIT = 24;

const getResolverEnv = () =>
	(getCloudflareContext() as unknown as ResolverContext).env;

const clampResolverLimit = (
	value: number | undefined,
	fallback: number,
	max: number,
) => {
	const rounded =
		typeof value === "number" && Number.isFinite(value)
			? Math.round(value)
			: fallback;

	return Math.min(Math.max(rounded, 1), max);
};

const readQuerySafely = async <T>(
	label: string,
	fallback: T,
	reader: () => Promise<T>,
) => {
	try {
		return await reader();
	} catch (error) {
		console.error(`Query "${label}" failed:`, error);
		return fallback;
	}
};

export const queries = {
	students: async () => {
		return readQuerySafely("students", [], async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			let all = await db.select().from(students);
			if (all.length === 0) {
				await seedStudents(db);
				all = await db.select().from(students);
			}
			return all;
		});
	},
	availableTests: async (
		_: unknown,
		{
			forceRefresh,
			limit,
		}: { forceRefresh?: boolean; limit?: number } = {},
	) =>
		readQuerySafely("availableTests", [], async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			return listAvailableTests(db, env.EXAM_CACHE, {
				force: forceRefresh,
				limit: clampResolverLimit(
					limit,
					DEFAULT_AVAILABLE_TESTS_LIMIT,
					DEFAULT_AVAILABLE_TESTS_LIMIT,
				),
			});
		}),
	attempts: async (
		_: unknown,
		{
			forceRefresh,
			limit,
		}: { forceRefresh?: boolean; limit?: number } = {},
	) =>
		readQuerySafely("attempts", [], async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			if (forceRefresh) {
				await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
			}
			return listAttempts(db, env.EXAM_CACHE, {
				limit: clampResolverLimit(
					limit,
					DEFAULT_ATTEMPTS_LIMIT,
					DEFAULT_ATTEMPTS_LIMIT,
				),
			});
		}),
	attemptsByTestId: async (
		_: unknown,
		{
			forceRefresh,
			limit,
			testId,
		}: { forceRefresh?: boolean; limit?: number; testId: string },
	) =>
		readQuerySafely("attemptsByTestId", [], async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			if (forceRefresh) {
				await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
			}
			return listAttempts(db, env.EXAM_CACHE, {
				includeProvisionalTeacherResults: true,
				limit: clampResolverLimit(
					limit,
					DEFAULT_ATTEMPTS_BY_TEST_LIMIT,
					DEFAULT_ATTEMPTS_BY_TEST_LIMIT,
				),
				testId,
			});
		}),
	testMaterial: async (
		_: unknown,
		{
			testId,
			forceRefresh,
		}: { forceRefresh?: boolean; testId: string },
	) =>
		readQuerySafely("testMaterial", null, async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			return getTestMaterial(
				db,
				testId,
				forceRefresh ? undefined : env.EXAM_CACHE,
			);
		}),
	liveMonitoringFeed: async (
		_: unknown,
		{ limit, testId }: { limit?: number; testId?: string } = {},
	) =>
		readQuerySafely("liveMonitoringFeed", [], async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			return listLiveMonitoringFeed(
				db,
				clampResolverLimit(
					limit,
					DEFAULT_LIVE_FEED_LIMIT,
					DEFAULT_LIVE_FEED_LIMIT,
				),
				{ testId },
			);
		}),
	externalNewMathExams: async (_: unknown, { limit }: { limit?: number }) =>
		readQuerySafely("externalNewMathExams", [], async () =>
			listExternalNewMathExams(
				clampResolverLimit(limit, 20, 40),
			),
		),
};
