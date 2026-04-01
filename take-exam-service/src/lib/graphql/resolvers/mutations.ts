import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { ensureExamSchema } from "@/lib/db/bootstrap";
import { publishAttemptRealtimeUpdate } from "@/lib/exam-service/realtime";
import type {
	AttemptReviewPayload,
	AttemptQuestionMetricInput,
	ExamAnswerInput,
	MonitoringMode,
	ProctoringEventSeverity,
	StartExamResponse,
} from "@/lib/exam-service/types";
import {
	approveAttempt,
	importExternalNewMathExam,
	invalidateAttemptsSummaryCache,
	logAttemptActivity,
	resumeExamAttempt,
	savePublishedTest,
	syncExternalNewMathExams,
	startExamAttempt,
	submitExamAnswers,
	upsertAttemptQuestionMetrics,
} from "@/lib/exam-service/store";

type ResolverEnv = {
	DB: D1Database;
	EXAM_CACHE?: KVNamespace;
	EXAM_SUBMISSION_QUEUE?: Queue<unknown>;
	TEACHER_SUBMISSION_WEBHOOK_URL?: string;
	GEMINI_API_KEY?: string;
	GEMINI_MODEL?: string;
	OLLAMA_API_KEY?: string;
	OLLAMA_BASE_URL?: string;
	OLLAMA_MODEL?: string;
	ABLY_API_KEY?: string;
	ABLY_REST_URL?: string;
	ABLY_CHANNEL_PREFIX?: string;
	AI?: {
		run: (
			model: string,
			input: {
				messages: Array<{ role: "system" | "user"; content: string }>;
				response_format?: { type: "json_object" };
			},
		) => Promise<{ response?: string }>;
	};
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
	mode: MonitoringMode;
	screenshotCapturedAt?: string | null;
	screenshotStorageKey?: string | null;
	screenshotUrl?: string | null;
};

const getResolverEnv = () =>
	(getCloudflareContext() as unknown as ResolverContext).env;

const getGeminiApiKey = (env: ResolverEnv) =>
	env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

const getGeminiModel = (env: ResolverEnv) =>
	env.GEMINI_MODEL ?? process.env.GEMINI_MODEL;

const getOllamaApiKey = (env: ResolverEnv) =>
	env.OLLAMA_API_KEY ?? process.env.OLLAMA_API_KEY;

const getOllamaBaseUrl = (env: ResolverEnv) =>
	env.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL;

const getOllamaModel = (env: ResolverEnv) =>
	env.OLLAMA_MODEL ?? process.env.OLLAMA_MODEL;

const toGraphqlStartExamPayload = (payload: StartExamResponse) => ({
	...payload,
	existingAnswers: Object.entries(payload.existingAnswers ?? {}).map(
		([questionId, selectedOptionId]) => ({
			questionId,
			selectedOptionId,
		}),
	),
});

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
		const existingTest = await db.query.tests.findFirst({
			where: (table, { eq }) => eq(table.id, testId),
			columns: { id: true },
		});

		if (!existingTest) {
			await importExternalNewMathExam(db, testId, env.EXAM_CACHE);
		}

		const payload = await startExamAttempt(
			db,
			testId,
			studentId,
			studentName,
			env.EXAM_CACHE,
		);
		await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
		await publishAttemptRealtimeUpdate(db, env, payload.attemptId, "attempt.started", {
			source: "startExam",
		});
		return toGraphqlStartExamPayload(payload);
	},
	resumeExam: async (
		_parent: unknown,
		{ attemptId }: { attemptId: string },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return toGraphqlStartExamPayload(
			await resumeExamAttempt(db, attemptId, env.EXAM_CACHE),
		);
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
		const payload = await submitExamAnswers(
			db,
			attemptId,
			answers,
			finalize,
			env.EXAM_SUBMISSION_QUEUE,
			env.EXAM_CACHE,
			env.TEACHER_SUBMISSION_WEBHOOK_URL,
			env.AI,
			getGeminiApiKey(env),
			getGeminiModel(env),
			getOllamaApiKey(env),
			getOllamaBaseUrl(env),
			getOllamaModel(env),
		);
		await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
		await publishAttemptRealtimeUpdate(
			db,
			env,
			attemptId,
			finalize ? "attempt.submitted" : "attempt.saved",
			{
				answerCount: answers.length,
				finalize,
			},
		);
		return payload;
	},
	approveAttempt: async (
		_parent: unknown,
		{
			attemptId,
			review,
		}: { attemptId: string; review?: AttemptReviewPayload },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		await approveAttempt(db, attemptId, {
			ai: env.AI,
			geminiApiKey: getGeminiApiKey(env),
			geminiModel: getGeminiModel(env),
			kv: env.EXAM_CACHE,
			ollamaApiKey: getOllamaApiKey(env),
			ollamaBaseUrl: getOllamaBaseUrl(env),
			ollamaModel: getOllamaModel(env),
			review,
		});
		await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
		await publishAttemptRealtimeUpdate(db, env, attemptId, "attempt.approved", {
			source: "approveAttempt",
		});
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
		await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
		await publishAttemptRealtimeUpdate(db, env, attemptId, "monitoring.updated", {
			code: input.code,
			severity: input.severity,
			title: input.title,
		});
		return true;
	},
	logQuestionMetrics: async (
		_parent: unknown,
		{
			attemptId,
			input,
		}: { attemptId: string; input: AttemptQuestionMetricInput[] },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		await upsertAttemptQuestionMetrics(db, attemptId, input);
		return true;
	},
	importNewMathExam: async (
		_parent: unknown,
		{ examId }: { examId: string },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return importExternalNewMathExam(db, examId, env.EXAM_CACHE);
	},
	syncExternalNewMathExams: async (
		_parent: unknown,
		{ limit }: { limit?: number },
	) => {
		const env = getResolverEnv();
		const db = createDb(env.DB);
		await ensureExamSchema(env.DB);
		return syncExternalNewMathExams(db, env.EXAM_CACHE, limit ?? 20);
	},
};
