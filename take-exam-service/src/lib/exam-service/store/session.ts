import { and, eq } from "drizzle-orm";
import type { ExamTest, StartExamResponse } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
	buildAttemptState,
	cacheAttemptState,
	readCachedTest,
} from "./cache";
import {
	computeProgress,
	countAnsweredQuestions,
	createId,
	getQuestionId,
	getQuestionOptions,
	isUniqueConstraintError,
} from "./common";
import { findExistingAttempt } from "./persistence";
import {
	applyShuffleManifest,
	createShuffleManifest,
	resolveShuffleManifest,
} from "./shuffle";

type TestContext = {
	testData: {
		id: string;
		title: string;
		description: string;
		gradeLevel: number;
		className: string;
		subject: string;
		topic: string;
		timeLimitMinutes: number;
	};
	testQuestions: TestQuestion[];
};

type TestQuestion = (typeof schema.questions.$inferSelect) | ExamTest["questions"][number];

const mapCachedTest = (test: ExamTest): TestContext["testData"] => ({
	id: test.id,
	title: test.title,
	description: test.description,
	gradeLevel: test.criteria.gradeLevel,
	className: test.criteria.className,
	subject: test.criteria.subject,
	topic: test.criteria.topic,
	timeLimitMinutes: test.timeLimitMinutes,
});

const loadTestContext = async (
	db: DbClient,
	testId: string,
	kv: KVNamespace | undefined,
	requirePublished: boolean,
	notFoundMessage: string,
): Promise<TestContext> => {
	const cachedTest = await readCachedTest(kv, testId);
	if (cachedTest) {
		return {
			testData: mapCachedTest(cachedTest),
			testQuestions: cachedTest.questions,
		};
	}

	const test = await db.query.tests.findFirst({
		where: requirePublished
			? and(eq(schema.tests.id, testId), eq(schema.tests.status, "published"))
			: eq(schema.tests.id, testId),
	});

	if (!test) throw new Error(notFoundMessage);

	const testQuestions = await db.query.questions.findMany({
		where: eq(schema.questions.testId, testId),
		orderBy: [schema.questions.orderSlot],
	});

	return {
		testData: test,
		testQuestions,
	};
};

const formatExamResponse = (
	attemptId: string,
	studentId: string,
	studentName: string,
	startedAt: string,
	expiresAt: string,
	testId: string,
	testData: TestContext["testData"],
	testQuestions: TestQuestion[],
	answeredCount: number,
	manifest = createShuffleManifest(attemptId, studentId, testId, testQuestions),
): StartExamResponse => {
	const shuffledQuestions = applyShuffleManifest(testQuestions, manifest).map(
		(question) => ({
			questionId: getQuestionId(question),
			type: (question.type as "single-choice" | "math") ?? "single-choice",
			prompt: question.prompt,
			options: getQuestionOptions(question),
			points: question.points,
			competency: question.competency,
			imageUrl: question.imageUrl,
			audioUrl: question.audioUrl,
			videoUrl: question.videoUrl,
			responseGuide: question.responseGuide,
		}),
	);

	return {
		attemptId,
		status: "in_progress",
		studentId,
		studentName,
		startedAt,
		expiresAt,
		exam: {
			testId,
			title: testData.title,
			description: testData.description,
			criteria: {
				gradeLevel: testData.gradeLevel,
				className: testData.className,
				subject: testData.subject,
				topic: testData.topic,
				difficulty: "medium",
				questionCount: testQuestions.length,
			},
			timeLimitMinutes: testData.timeLimitMinutes,
			questions: shuffledQuestions,
		},
		progress: computeProgress(answeredCount, testQuestions.length),
	};
};

export const startExamAttempt = async (
	db: DbClient,
	testId: string,
	studentId: string,
	studentName: string,
	kv?: KVNamespace,
) => {
	const normalizedStudentId = studentId.trim();
	const normalizedStudentName = studentName.trim();

	const existingAttempt = await findExistingAttempt(db, testId, normalizedStudentId);
	if (existingAttempt) {
		if (existingAttempt.status === "in_progress") {
			return resumeExamAttempt(db, existingAttempt.id, kv);
		}

		throw new Error("Энэ сурагч энэ шалгалтыг аль хэдийн өгсөн байна.");
	}

	const { testData, testQuestions } = await loadTestContext(
		db,
		testId,
		kv,
		true,
		"Шалгалт олдсонгүй.",
	);

	const attemptId = createId("attempt");
	const startedAt = new Date().toISOString();
	const expiresAt = new Date(
		Date.now() + testData.timeLimitMinutes * 60_000,
	).toISOString();
	const shuffleManifest = createShuffleManifest(
		attemptId,
		normalizedStudentId,
		testId,
		testQuestions,
	);

	try {
		await db.insert(schema.attempts).values({
			id: attemptId,
			testId,
			studentId: normalizedStudentId,
			studentName: normalizedStudentName,
			shuffleManifest: JSON.stringify(shuffleManifest),
			status: "in_progress",
			startedAt,
			expiresAt,
		});
	} catch (error) {
		if (!isUniqueConstraintError(error)) throw error;

		const concurrentAttempt = await findExistingAttempt(
			db,
			testId,
			normalizedStudentId,
		);
		if (concurrentAttempt?.status === "in_progress") {
			return resumeExamAttempt(db, concurrentAttempt.id, kv);
		}

		throw new Error("Энэ сурагч энэ шалгалтыг аль хэдийн өгсөн байна.");
	}

	await cacheAttemptState(
		kv,
		buildAttemptState({
			attemptId,
			testId,
			studentId: normalizedStudentId,
			studentName: normalizedStudentName,
			status: "in_progress",
			startedAt,
			expiresAt,
			totalQuestions: testQuestions.length,
			answers: {},
		}),
	);

	return formatExamResponse(
		attemptId,
		normalizedStudentId,
		normalizedStudentName,
		startedAt,
		expiresAt,
		testId,
		testData,
		testQuestions,
		0,
		shuffleManifest,
	);
};

export const resumeExamAttempt = async (
	db: DbClient,
	attemptId: string,
	kv?: KVNamespace,
) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	if (attempt.status !== "in_progress") {
		throw new Error("Энэ оролдлого дууссан байна.");
	}

	const testId = attempt.testId;
	const { testData, testQuestions } = await loadTestContext(
		db,
		testId,
		kv,
		false,
		"Тест олдсонгүй.",
	);

	const answers = await db.query.answers.findMany({
		where: eq(schema.answers.attemptId, attemptId),
	});

	const answersMap = Object.fromEntries(
		answers.map((answer) => [answer.questionId, answer.selectedOptionId]),
	);
	const answeredCount = countAnsweredQuestions(answersMap);

	await cacheAttemptState(
		kv,
		buildAttemptState({
			attemptId,
			testId,
			studentId: attempt.studentId,
			studentName: attempt.studentName,
			status: attempt.status,
			startedAt: attempt.startedAt,
			expiresAt: attempt.expiresAt,
			submittedAt: attempt.submittedAt ?? undefined,
			totalQuestions: testQuestions.length,
			answers: answersMap,
		}),
	);

	return {
		...formatExamResponse(
			attemptId,
			attempt.studentId,
			attempt.studentName,
			attempt.startedAt,
			attempt.expiresAt,
			testId,
			testData,
			testQuestions,
			answeredCount,
			resolveShuffleManifest(
				attemptId,
				attempt.studentId,
				testId,
				testQuestions,
				attempt.shuffleManifest,
			),
		),
		existingAnswers: answersMap,
	};
};
