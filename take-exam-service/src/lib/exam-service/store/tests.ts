import { desc, eq, sql } from "drizzle-orm";
import type { ExamTest } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { readJsonFromKv, syncPublishedTestCache } from "./cache";
import { TEST_CACHE_INDEX_KEY } from "./common";
import type { CachedTestSummary } from "./internal-types";

export const savePublishedTest = async (
	db: DbClient,
	test: ExamTest,
	kv?: KVNamespace,
) => {
	await db.insert(schema.tests).values({
		id: test.id,
		generatorTestId: test.id,
		title: test.title,
		description: test.description,
		gradeLevel: test.criteria.gradeLevel,
		className: test.criteria.className,
		topic: test.criteria.topic,
		subject: test.criteria.subject,
		timeLimitMinutes: test.timeLimitMinutes,
		status: "published",
	}).onConflictDoUpdate({
		target: schema.tests.id,
		set: {
			generatorTestId: test.id,
			title: test.title,
			description: test.description,
			gradeLevel: test.criteria.gradeLevel,
			className: test.criteria.className,
			topic: test.criteria.topic,
			subject: test.criteria.subject,
			timeLimitMinutes: test.timeLimitMinutes,
			status: "published",
			updatedAt: sql`CURRENT_TIMESTAMP`,
		},
	});

	for (const [idx, question] of test.questions.entries()) {
		await db.insert(schema.questions).values({
			id: question.id,
			testId: test.id,
			prompt: question.prompt,
			options: JSON.stringify(question.options),
			correctOptionId: question.correctOptionId,
			explanation: question.explanation,
			points: question.points,
			competency: question.competency,
			imageUrl: question.imageUrl,
			audioUrl: question.audioUrl,
			videoUrl: question.videoUrl,
			orderSlot: idx,
		}).onConflictDoUpdate({
			target: schema.questions.id,
			set: {
				prompt: question.prompt,
				options: JSON.stringify(question.options),
				correctOptionId: question.correctOptionId,
				explanation: question.explanation,
				points: question.points,
				competency: question.competency,
				imageUrl: question.imageUrl,
				audioUrl: question.audioUrl,
				videoUrl: question.videoUrl,
				orderSlot: idx,
			},
		});
	}

	await syncPublishedTestCache(kv, test);
};

export const listTests = async (db: DbClient, kv?: KVNamespace) => {
	const cachedIndex = await readJsonFromKv<CachedTestSummary[]>(
		kv,
		TEST_CACHE_INDEX_KEY,
	);
	if (cachedIndex) return cachedIndex;

	return db.query.tests.findMany({
		where: eq(schema.tests.status, "published"),
		orderBy: [desc(schema.tests.updatedAt)],
	});
};
