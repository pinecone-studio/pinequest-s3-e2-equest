import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import type { ExamAnswerInput } from "@/lib/exam-service/types";
import { submitExamAnswers } from "@/lib/exam-service/store";

type SubmitAnswersArgs = {
    attemptId: string;
    answers: ExamAnswerInput[];
    finalize: boolean;
};

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

export const submitAnswers = async (_: unknown, { attemptId, answers, finalize }: SubmitAnswersArgs) => {
    const { env } = getCloudflareContext() as unknown as { env: ResolverEnv };
    const db = createDb(env.DB);
    const geminiApiKey = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
    const geminiModel = env.GEMINI_MODEL ?? process.env.GEMINI_MODEL;
    const ollamaApiKey = env.OLLAMA_API_KEY ?? process.env.OLLAMA_API_KEY;
    const ollamaBaseUrl = env.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL;
    const ollamaModel = env.OLLAMA_MODEL ?? process.env.OLLAMA_MODEL;

    return submitExamAnswers(
        db,
        attemptId,
        answers,
        finalize,
        env.EXAM_SUBMISSION_QUEUE,
        env.EXAM_CACHE,
        env.TEACHER_SUBMISSION_WEBHOOK_URL,
        env.AI,
        geminiApiKey,
        geminiModel,
        ollamaApiKey,
        ollamaBaseUrl,
        ollamaModel,
    );
};
