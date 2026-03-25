import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { submitExamAnswers } from "@/lib/exam-service/store";

export const submitAnswers = async (_: any, { attemptId, answers, finalize }: any) => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    return submitExamAnswers(db, attemptId, answers, finalize, env.EXAM_SUBMISSION_QUEUE, env.EXAM_CACHE);
};
