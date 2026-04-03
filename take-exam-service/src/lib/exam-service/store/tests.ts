import { desc, eq, sql } from "drizzle-orm";
import type {
	ExamTest,
	TeacherExamQuestion,
	TeacherExamSession,
	TeacherTestSummary,
} from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getQuestionOptions } from "./common";
import {
	readCachedTest,
	readJsonFromKv,
	syncPublishedTestCache,
	writeJsonToKv,
} from "./cache";
import {
	AVAILABLE_TESTS_CACHE_KEY,
	AVAILABLE_TESTS_CACHE_TTL_SECONDS,
	TEST_CACHE_INDEX_KEY,
} from "./common";
import type { CachedTestSummary } from "./internal-types";
import type { ExamQuestion } from "@/lib/exam-service/types";

const hasMissingTeacherServiceAnswerKey = (
	questions: Array<
		Pick<ExamQuestion, "type" | "correctOptionId" | "answerLatex">
	>,
) =>
	questions.some((question) =>
		question.type === "math"
			? !(question.answerLatex?.trim() || "")
			: !(question.correctOptionId?.trim() || ""),
	);

const mapTeacherExamSessionQuestions = (questions: ExamQuestion[]) =>
	questions.map((question) => ({
		questionId: question.id,
		type: question.type,
		prompt: question.prompt,
		options: question.options,
		points: question.points,
		competency: question.competency,
		imageUrl: question.imageUrl,
		audioUrl: question.audioUrl,
		videoUrl: question.videoUrl,
		correctOptionId: question.correctOptionId,
		responseGuide: question.responseGuide,
		answerLatex: question.answerLatex,
	})) satisfies TeacherExamQuestion[];

const mapTeacherTestSummary = (
	test:
		| CachedTestSummary
		| Awaited<ReturnType<DbClient["query"]["tests"]["findMany"]>>[number],
): TeacherTestSummary => ({
	id: test.id,
	title: test.title,
	description: test.description,
	criteria:
		"criteria" in test
			? test.criteria
			: {
					gradeLevel: test.gradeLevel,
					className: test.className,
					subject: test.subject,
					topic: test.topic,
					difficulty: "medium",
					questionCount: 0,
				},
	answerKeySource:
		"answerKeySource" in test ? test.answerKeySource ?? "local" : "local",
	updatedAt: test.updatedAt ?? new Date().toISOString(),
});

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

export const listAvailableTests = async (
	db: DbClient,
	kv?: KVNamespace,
	options?: { force?: boolean },
): Promise<TeacherTestSummary[]> => {
	if (!options?.force) {
		const cachedAvailableTests = await readJsonFromKv<TeacherTestSummary[]>(
			kv,
			AVAILABLE_TESTS_CACHE_KEY,
		);
		if (cachedAvailableTests) {
			return cachedAvailableTests;
		}
	}

	const tests = await listTests(db, undefined);
	const nextAvailableTests = tests.map(mapTeacherTestSummary);

	await writeJsonToKv(
		kv,
		AVAILABLE_TESTS_CACHE_KEY,
		nextAvailableTests,
		AVAILABLE_TESTS_CACHE_TTL_SECONDS,
	);

	return nextAvailableTests;
};

export const getTestMaterial = async (
	db: DbClient,
	testId: string,
	kv?: KVNamespace,
): Promise<TeacherExamSession | null> => {
	const cachedTest = await readCachedTest(kv, testId);
	const shouldRefreshCachedTeacherServiceTest =
		cachedTest?.answerKeySource === "teacher_service" &&
		cachedTest?.sourceService === "create-exam-service" &&
		hasMissingTeacherServiceAnswerKey(cachedTest.questions);
	if (cachedTest && !shouldRefreshCachedTeacherServiceTest) {
		return {
			testId: cachedTest.id,
			title: cachedTest.title,
			description: cachedTest.description,
			criteria: cachedTest.criteria,
			timeLimitMinutes: cachedTest.timeLimitMinutes,
			questions: mapTeacherExamSessionQuestions(cachedTest.questions),
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

	const shouldHydrateTeacherServiceTest =
		test.answerKeySource === "teacher_service" &&
		test.sourceService === "create-exam-service" &&
		hasMissingTeacherServiceAnswerKey(
			questions.map((question) => ({
				type: (question.type as "single-choice" | "math") ?? "single-choice",
				correctOptionId: question.correctOptionId,
				answerLatex: question.answerLatex,
			})),
		);

	if (shouldHydrateTeacherServiceTest) {
		try {
			const {
				getExternalNewMathExam,
				mapExternalNewMathExamToExamTest,
			} = await import("./external");
			const externalExam = await getExternalNewMathExam(test.generatorTestId);
			const mappedExam = mapExternalNewMathExamToExamTest(externalExam);

			if (mappedExam.id === test.id) {
				await savePublishedTest(db, mappedExam, kv);
			}

			return {
				testId: test.id,
				title: mappedExam.title,
				description: mappedExam.description,
				criteria: mappedExam.criteria,
				timeLimitMinutes: mappedExam.timeLimitMinutes,
				questions: mapTeacherExamSessionQuestions(mappedExam.questions),
			};
		} catch (error) {
			console.warn(
				`Failed to hydrate teacher_service test "${test.id}" from create-exam-service:`,
				error,
			);
		}
	}

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
			correctOptionId: question.correctOptionId,
			responseGuide: question.responseGuide,
			answerLatex: question.answerLatex,
		})),
	};
};
