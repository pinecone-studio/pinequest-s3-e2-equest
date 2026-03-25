import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { students as studentTable } from "@/lib/db/schema";
import { seedStudents } from "@/lib/db/seed";

export const students = async () => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    let all = await db.select().from(studentTable);
    if (all.length === 0) {
        await seedStudents(db);
        all = await db.select().from(studentTable);
    }
    return all;
};
