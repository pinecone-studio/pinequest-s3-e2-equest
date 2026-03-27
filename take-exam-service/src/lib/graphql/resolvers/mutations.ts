import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { ensureExamSchema } from "@/lib/db/bootstrap";
import type {
	ExamAnswerInput,
	ProctoringEventSeverity,
} from "@/lib/exam-service/types";
import {
	approveAttempt,
	logAttemptActivity,
	resumeExamAttempt,
	savePublishedTest,
	startExamAttempt,
	submitExamAnswers,
} from "@/lib/exam-service/store";

type ResolverEnv = {
	DB: D1Database;
	EXAM_CACHE?: KVNamespace;
	EXAM_SUBMISSION_QUEUE?: Queue<unknown>;
};

type ResolverContext = {
	env: ResolverEnv;
};

type AttemptActivityInput = {
	code: string;
	severity: ProctoringEventSeverity;
	title: string;
	detail: string;
	occurredAt?: string | null;
};

const getResolverEnv = () =>
	(getCloudflareContext() as unknown as ResolverContext).env;

export const mutations = {
	saveTest: async (_parent: unknown, { test }: { test: string }) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		const examTest = JSON.parse(test);
		await savePublishedTest(db, examTest, env.EXAM_CACHE);
		return true;
	},
	startExam: async (
		_parent: unknown,
		{
			testId,
			studentId,
			studentName,
		}: { testId: string; studentId: string; studentName: string },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return startExamAttempt(
			db,
			testId,
			studentId,
			studentName,
			env.EXAM_CACHE,
		);
	},
	resumeExam: async (
		_parent: unknown,
		{ attemptId }: { attemptId: string },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return resumeExamAttempt(db, attemptId, env.EXAM_CACHE);
	},
	submitAnswers: async (
		_parent: unknown,
		{
			attemptId,
			answers,
			finalize,
		}: {
			attemptId: string;
			answers: ExamAnswerInput[];
			finalize: boolean;
		},
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return submitExamAnswers(
			db,
			attemptId,
			answers,
			finalize,
			env.EXAM_SUBMISSION_QUEUE,
			env.EXAM_CACHE,
		);
	},
	approveAttempt: async (
		_parent: unknown,
		{ attemptId }: { attemptId: string },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		await approveAttempt(db, attemptId, env.EXAM_CACHE);
		return true;
	},
	logAttemptActivity: async (
		_parent: unknown,
		{
			attemptId,
			input,
		}: { attemptId: string; input: AttemptActivityInput },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		await logAttemptActivity(db, attemptId, input);
		return true;
	},
};
