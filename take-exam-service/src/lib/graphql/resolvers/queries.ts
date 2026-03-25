import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { seedStudents } from "@/lib/db/seed";
import { listTests, listAttempts } from "@/lib/exam-service/store";

export const queries = {
    students: async () => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        let all = await db.select().from(students);
        if (all.length === 0) {
            await seedStudents(db);
            all = await db.select().from(students);
        }
        return all;
    },
    availableTests: async () => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        const tests = await listTests(db, env.EXAM_CACHE);
        return tests.map(t => ({
            ...t,
            criteria: {
                gradeLevel: "criteria" in t ? t.criteria.gradeLevel : t.gradeLevel,
                className: "criteria" in t ? t.criteria.className : t.className,
                subject: "criteria" in t ? t.criteria.subject : t.subject,
                topic: "criteria" in t ? t.criteria.topic : t.topic,
                difficulty: "criteria" in t ? t.criteria.difficulty : "medium",
                questionCount: "criteria" in t ? t.criteria.questionCount : 0,
            }
        }));
    },
    attempts: async () => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        return listAttempts(db);
    },
};
