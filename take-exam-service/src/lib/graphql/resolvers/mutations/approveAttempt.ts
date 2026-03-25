import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { approveAttempt } from "@/lib/exam-service/store";

export const approveAttemptResolver = async (_: any, { attemptId }: any) => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    await approveAttempt(db, attemptId, env.EXAM_CACHE);
    return true;
};
