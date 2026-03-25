import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { startExamAttempt } from "@/lib/exam-service/store";

export const startExam = async (_: any, { testId, studentId, studentName }: any) => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    return startExamAttempt(db, testId, studentId, studentName, env.EXAM_CACHE);
};
