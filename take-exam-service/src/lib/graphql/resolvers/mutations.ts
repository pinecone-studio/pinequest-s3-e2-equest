import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { ensureExamSchema } from "@/lib/db/bootstrap";
import { savePublishedTest, startExamAttempt, resumeExamAttempt, submitExamAnswers, approveAttempt } from "@/lib/exam-service/store";

export const mutations = {
    saveTest: async (_: any, { test }: { test: string }) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        await ensureExamSchema(env.DB);
        const examTest = JSON.parse(test);
        await savePublishedTest(db, examTest, env.EXAM_CACHE);
        return true;
    },
    startExam: async (_: any, { testId, studentId, studentName }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        await ensureExamSchema(env.DB);
        return startExamAttempt(db, testId, studentId, studentName, env.EXAM_CACHE);
    },
    resumeExam: async (_: any, { attemptId }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        await ensureExamSchema(env.DB);
        return resumeExamAttempt(db, attemptId, env.EXAM_CACHE);
    },
    submitAnswers: async (_: any, { attemptId, answers, finalize }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        await ensureExamSchema(env.DB);
        return submitExamAnswers(db, attemptId, answers, finalize, env.EXAM_SUBMISSION_QUEUE, env.EXAM_CACHE);
    },
    approveAttempt: async (_: any, { attemptId }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        await ensureExamSchema(env.DB);
        await approveAttempt(db, attemptId, env.EXAM_CACHE);
        return true;
    },
};
