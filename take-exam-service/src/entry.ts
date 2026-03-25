import { createDb } from "./lib/db";
import { processSubmissionQueueMessage } from "./lib/exam-service/store";

// Use dynamic import for the built worker to avoid bundle issues before next build
// In production/deployment, this will point to the .open-next output
const getHandler = async () => {
    // @ts-ignore
    return await import("../.open-next/worker.js");
};

export default {
    async fetch(request: Request, env: any, ctx: any) {
        const handler = await getHandler();
        return handler.default.fetch(request, env, ctx);
    },

    async queue(batch: any, env: any, ctx: any) {
        const db = createDb(env.DB);
        for (const message of batch.messages) {
            try {
                await processSubmissionQueueMessage(db, message.body, env.EXAM_CACHE);
                message.ack();
            } catch (err) {
                const attemptId = message.body?.attemptId ?? "unknown";
                console.error(`Failed to process queue message for ${attemptId}:`, err);
                // message will be retried automatically if not acked
            }
        }
    },
};
