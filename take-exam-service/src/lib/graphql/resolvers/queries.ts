import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { ensureExamSchema } from "@/lib/db/bootstrap";
import { students } from "@/lib/db/schema";
import { seedStudents } from "@/lib/db/seed";
import {
	listLiveMonitoringFeed,
	listAttempts,
	listExternalNewMathExams,
	listTests,
	getTestMaterial,
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
		availableTests: async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			const tests = await listTests(db, env.EXAM_CACHE);
			return tests.map((t) => ({
				...t,
				answerKeySource:
					"answerKeySource" in t ? t.answerKeySource ?? "local" : "local",
				criteria: {
				gradeLevel: "criteria" in t ? t.criteria.gradeLevel : t.gradeLevel,
				className: "criteria" in t ? t.criteria.className : t.className,
				subject: "criteria" in t ? t.criteria.subject : t.subject,
				topic: "criteria" in t ? t.criteria.topic : t.topic,
				difficulty: "criteria" in t ? t.criteria.difficulty : "medium",
				questionCount: "criteria" in t ? t.criteria.questionCount : 0,
			},
			}));
		},
		attempts: async () => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			return listAttempts(db, env.EXAM_CACHE);
		},
		testMaterial: async (_: unknown, { testId }: { testId: string }) => {
			const env = getResolverEnv();
			const db = createDb(env.DB);
			await ensureExamSchema(env.DB);
			return getTestMaterial(db, testId, env.EXAM_CACHE);
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
