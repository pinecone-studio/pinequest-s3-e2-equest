import { createDb } from "./lib/db";
import { processSubmissionQueueMessage } from "./lib/exam-service/store";
import type { SubmissionQueueMessage } from "./lib/exam-service/store/internal-types";
// @ts-ignore OpenNext generates this file during build/deploy.
import nextWorker from "../.open-next/worker.js";

type WorkerEnv = {
    DB: D1Database;
    EXAM_CACHE?: KVNamespace;
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

type QueueMessage = {
    body: SubmissionQueueMessage;
    ack: () => void;
};

type QueueBatch = {
    messages: QueueMessage[];
};

const worker = {
    async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
        return nextWorker.fetch(request, env, ctx);
    },

    async queue(batch: QueueBatch, env: WorkerEnv) {
        const db = createDb(env.DB);
        for (const message of batch.messages) {
            try {
                await processSubmissionQueueMessage(
                    db,
                    message.body,
                    env.EXAM_CACHE,
                    env.TEACHER_SUBMISSION_WEBHOOK_URL,
                    env.AI,
                    env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY,
                    env.GEMINI_MODEL ?? process.env.GEMINI_MODEL,
                    env.OLLAMA_API_KEY ?? process.env.OLLAMA_API_KEY,
                    env.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL,
                    env.OLLAMA_MODEL ?? process.env.OLLAMA_MODEL,
                );
                message.ack();
            } catch (err) {
                const attemptId = message.body?.attemptId ?? "unknown";
                console.error(`Failed to process queue message for ${attemptId}:`, err);
                // message will be retried automatically if not acked
            }
        }
    },
};

export default worker;
