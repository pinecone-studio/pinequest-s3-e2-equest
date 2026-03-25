import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { listTests } from "@/lib/exam-service/store";

export const availableTests = async () => {
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
};
