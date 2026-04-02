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
	syncExternalNewMathExams,
} from "@/lib/exam-service/store";

type ResolverEnv = {
	DB: D1Database;
	EXAM_CACHE?: KVNamespace;
};

type ResolverContext = {
	env: ResolverEnv;
};

const getResolverEnv = () =>
	(getCloudflareContext() as unknown as ResolverContext).env;

export const queries = {
	students: async () => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		let all = await db.select().from(students);
		if (all.length === 0) {
			await seedStudents(db);
			all = await db.select().from(students);
		}
		return all;
	},
		availableTests: async (
			_: unknown,
			{ forceRefresh }: { forceRefresh?: boolean } = {},
		) => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			if (forceRefresh) {
				try {
					await syncExternalNewMathExams(db, env.EXAM_CACHE, 20, {
						force: true,
					});
				} catch (error) {
					console.error("Failed to sync external exams on availableTests refresh:", error);
				}
			}

			let tests = await listAvailableTests(db, env.EXAM_CACHE, {
				force: forceRefresh,
			});
			if (tests.length === 0) {
				try {
					await syncExternalNewMathExams(db, env.EXAM_CACHE, 20, {
						force: true,
					});
					tests = await listAvailableTests(db, env.EXAM_CACHE, {
						force: true,
					});
				} catch (error) {
					console.error("Failed to backfill external exams for availableTests:", error);
				}
			}
			return tests;
		},
		attempts: async (
			_: unknown,
			{ forceRefresh }: { forceRefresh?: boolean } = {},
		) => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			if (forceRefresh) {
				await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
			}
			return listAttempts(db, env.EXAM_CACHE);
		},
		testMaterial: async (
			_: unknown,
			{
				testId,
				forceRefresh,
			}: { forceRefresh?: boolean; testId: string },
		) => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			return getTestMaterial(
				db,
				testId,
				forceRefresh ? undefined : env.EXAM_CACHE,
			);
		},
		liveMonitoringFeed: async (
		_: unknown,
		{ limit }: { limit?: number },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return listLiveMonitoringFeed(db, limit ?? 40);
	},
	externalNewMathExams: async (_: unknown, { limit }: { limit?: number }) =>
		listExternalNewMathExams(limit ?? 20),
};
