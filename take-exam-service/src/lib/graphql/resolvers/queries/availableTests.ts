import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { listAvailableTests } from "@/lib/exam-service/store";

export const availableTests = async () => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    return listAvailableTests(db, env.EXAM_CACHE);
};
