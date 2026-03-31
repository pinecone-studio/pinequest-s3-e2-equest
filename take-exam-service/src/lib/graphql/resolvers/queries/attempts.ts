import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { listAttempts } from "@/lib/exam-service/store";

export const attempts = async () => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    return listAttempts(db, env.EXAM_CACHE);
};
