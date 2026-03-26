import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { savePublishedTest } from "@/lib/exam-service/store";

export const saveTest = async (_: any, { test }: { test: string }) => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    const examTest = JSON.parse(test);
    await savePublishedTest(db, examTest, env.EXAM_CACHE);
    return true;
};
