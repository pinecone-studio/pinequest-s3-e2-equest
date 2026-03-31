import { desc, eq, sql } from "drizzle-orm";
import type { ExamSession, ExamTest } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getQuestionOptions } from "./common";
import { readCachedTest, readJsonFromKv, syncPublishedTestCache } from "./cache";
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
		answerKeySource: test.answerKeySource ?? "local",
		sourceService: test.sourceService ?? null,
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
				answerKeySource: test.answerKeySource ?? "local",
				sourceService: test.sourceService ?? null,
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
			type: question.type,
			prompt: question.prompt,
			options: JSON.stringify(question.options),
			correctOptionId: question.correctOptionId,
			explanation: question.explanation,
			points: question.points,
			competency: question.competency,
			responseGuide: question.responseGuide,
			answerLatex: question.answerLatex,
			imageUrl: question.imageUrl,
			audioUrl: question.audioUrl,
			videoUrl: question.videoUrl,
			orderSlot: idx,
		}).onConflictDoUpdate({
			target: schema.questions.id,
			set: {
				type: question.type,
				prompt: question.prompt,
				options: JSON.stringify(question.options),
				correctOptionId: question.correctOptionId,
				explanation: question.explanation,
				points: question.points,
				competency: question.competency,
				responseGuide: question.responseGuide,
				answerLatex: question.answerLatex,
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

export const getTestMaterial = async (
	db: DbClient,
	testId: string,
	kv?: KVNamespace,
): Promise<ExamSession | null> => {
	const cachedTest = await readCachedTest(kv, testId);
	if (cachedTest) {
		return {
			testId: cachedTest.id,
			title: cachedTest.title,
			description: cachedTest.description,
			criteria: cachedTest.criteria,
			timeLimitMinutes: cachedTest.timeLimitMinutes,
			questions: cachedTest.questions.map((question) => ({
				questionId: question.id,
				type: question.type,
				prompt: question.prompt,
				options: question.options,
				points: question.points,
				competency: question.competency,
				imageUrl: question.imageUrl,
				audioUrl: question.audioUrl,
				videoUrl: question.videoUrl,
				responseGuide: question.responseGuide,
			})),
		};
	}

	const test = await db.query.tests.findFirst({
		where: eq(schema.tests.id, testId),
	});
	if (!test) return null;

	const questions = await db.query.questions.findMany({
		where: eq(schema.questions.testId, testId),
		orderBy: [schema.questions.orderSlot],
	});

	return {
		testId: test.id,
		title: test.title,
		description: test.description,
		criteria: {
			gradeLevel: test.gradeLevel,
			className: test.className,
			subject: test.subject,
			topic: test.topic,
			difficulty: "medium",
			questionCount: questions.length,
		},
		timeLimitMinutes: test.timeLimitMinutes,
		questions: questions.map((question) => ({
			questionId: question.id,
			type: (question.type as "single-choice" | "math") ?? "single-choice",
			prompt: question.prompt,
			options: getQuestionOptions(question),
			points: question.points,
			competency: question.competency,
			imageUrl: question.imageUrl,
			audioUrl: question.audioUrl,
			videoUrl: question.videoUrl,
			responseGuide: question.responseGuide,
		})),
	};
};
