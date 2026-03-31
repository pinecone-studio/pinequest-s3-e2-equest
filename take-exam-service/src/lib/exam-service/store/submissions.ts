import { eq } from "drizzle-orm";
import type {
	AttemptStatus,
	ExamAnswerInput,
	SubmitAnswersResponse,
} from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
	cacheAttemptState,
	getAttemptStateFromKv,
	mergeAnswersIntoState,
	resolveAttemptState,
} from "./cache";
import { computeProgress, countAnsweredQuestions } from "./common";
import type { SubmissionQueueMessage } from "./internal-types";
import { persistAnswerUpdates } from "./persistence";
import {
	enrichResultWithQuestionFeedback,
	generateAttemptFeedback,
	stringifyAttemptFeedback,
} from "./feedback";
import { computeResult, getAttemptResults } from "./results";
import { parseStoredTeacherResult } from "./teacher-sync";
import { syncAttemptSubmissionToTeacherService } from "./teacher-sync";

type AiBinding = {
	run: (
		model: string,
		input: {
			messages: Array<{ role: "system" | "user"; content: string }>;
			response_format?: { type: "json_object" };
		},
	) => Promise<{ response?: string }>;
};

type SubmissionOptions = {
	queue?: Queue;
	kv?: KVNamespace;
	submissionWebhookUrl?: string;
	ai?: AiBinding;
	geminiApiKey?: string;
	geminiModel?: string;
	ollamaApiKey?: string;
	ollamaBaseUrl?: string;
	ollamaModel?: string;
};

const getAttemptAnswerKeySource = async (db: DbClient, attemptId: string) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
		columns: { testId: true },
	});
	if (!attempt) {
		throw new Error("Оролдлого олдсонгүй.");
	}

	const test = await db.query.tests.findFirst({
		where: eq(schema.tests.id, attempt.testId),
		columns: { answerKeySource: true },
	});

	return test?.answerKeySource ?? "local";
};

const finalizeLocalAttempt = async (
	db: DbClient,
	attemptId: string,
	inputAnswers: ExamAnswerInput[],
	attemptState: Awaited<ReturnType<typeof resolveAttemptState>>,
	submittedAt: string,
	options: SubmissionOptions,
): Promise<SubmitAnswersResponse> => {
	await persistAnswerUpdates(db, attemptId, inputAnswers);

	const finalizedState = mergeAnswersIntoState(
		attemptState,
		inputAnswers,
		true,
		submittedAt,
	);
	const resultRows = await getAttemptResults(db, attemptId);
	const result = await enrichResultWithQuestionFeedback(
		resultRows,
		computeResult(resultRows),
		{
			ai: options.ai,
			geminiApiKey: options.geminiApiKey,
			geminiModel: options.geminiModel,
			ollamaApiKey: options.ollamaApiKey,
			ollamaBaseUrl: options.ollamaBaseUrl,
			ollamaModel: options.ollamaModel,
		},
	);

	await db.update(schema.attempts).set({
		status: "approved",
		submittedAt,
		score: result.score,
		maxScore: result.maxScore,
		percentage: result.percentage,
		teacherResultJson: JSON.stringify(result),
	}).where(eq(schema.attempts.id, attemptId));

	await cacheAttemptState(options.kv, {
		...finalizedState,
		status: "approved",
	});

	const progress = computeProgress(
		countAnsweredQuestions(finalizedState.answers),
		attemptState.totalQuestions,
	);

	const feedback = await generateAttemptFeedback(
		db,
		{ attemptId, progress, result },
		{
			ai: options.ai,
			geminiApiKey: options.geminiApiKey,
			geminiModel: options.geminiModel,
			ollamaApiKey: options.ollamaApiKey,
			ollamaBaseUrl: options.ollamaBaseUrl,
			ollamaModel: options.ollamaModel,
		},
	);

	await db.update(schema.attempts).set({
		feedbackJson: stringifyAttemptFeedback(feedback),
	}).where(eq(schema.attempts.id, attemptId));

	return {
		attemptId,
		status: "approved",
		progress,
		result,
		feedback,
	};
};

export const submitExamAnswers = async (
	db: DbClient,
	attemptId: string,
	inputAnswers: ExamAnswerInput[],
	finalize = false,
	queue?: Queue,
	kv?: KVNamespace,
	submissionWebhookUrl?: string,
	ai?: AiBinding,
	geminiApiKey?: string,
	geminiModel?: string,
	ollamaApiKey?: string,
	ollamaBaseUrl?: string,
	ollamaModel?: string,
): Promise<SubmitAnswersResponse> => {
	const options: SubmissionOptions = {
		queue,
		kv,
		submissionWebhookUrl,
		ai,
		geminiApiKey,
		geminiModel,
		ollamaApiKey,
		ollamaBaseUrl,
		ollamaModel,
	};
	const attemptState = await resolveAttemptState(db, attemptId, kv);

	if (
		attemptState.status === "submitted" ||
		attemptState.status === "approved" ||
		attemptState.status === "processing"
	) {
		const attempt = await db.query.attempts.findFirst({
			where: eq(schema.attempts.id, attemptId),
			columns: { teacherResultJson: true },
		});
		const resultRows = await getAttemptResults(db, attemptId);
		const result =
			attemptState.status === "approved"
				? parseStoredTeacherResult(attempt?.teacherResultJson) ??
					computeResult(resultRows)
				: undefined;
		const progress = computeProgress(
			resultRows.filter((row) => row.selectedOptionId).length,
			resultRows.length,
		);
		return {
			attemptId,
			status: attemptState.status,
			progress,
			result,
			feedback: finalize
				? await generateAttemptFeedback(
						db,
						{ attemptId, progress, result },
						{
							ai,
							geminiApiKey,
							geminiModel,
							ollamaApiKey,
							ollamaBaseUrl,
							ollamaModel,
						},
					)
				: undefined,
		};
	}

	let status: AttemptStatus = attemptState.status;
	const submittedAt = finalize ? new Date().toISOString() : undefined;
	const answerKeySource = finalize
		? await getAttemptAnswerKeySource(db, attemptId)
		: "teacher_service";

	if (finalize && answerKeySource === "local") {
		return finalizeLocalAttempt(
			db,
			attemptId,
			inputAnswers,
			attemptState,
			submittedAt ?? new Date().toISOString(),
			options,
		);
	}

	if (queue) {
		await persistAnswerUpdates(db, attemptId, inputAnswers);

		const nextState = mergeAnswersIntoState(
			attemptState,
			inputAnswers,
			finalize,
			submittedAt,
		);
		status = finalize ? "submitted" : nextState.status;

		if (finalize) {
			await db.update(schema.attempts).set({
				status,
				submittedAt: submittedAt ?? new Date().toISOString(),
				score: null,
				maxScore: null,
				percentage: null,
			}).where(eq(schema.attempts.id, attemptId));
		}

		await cacheAttemptState(kv, {
			...nextState,
			status,
		});
		await queue.send({
			type: "UPSERT_ANSWERS",
			attemptId,
			answers: inputAnswers,
			finalize,
			submittedAt: submittedAt ?? new Date().toISOString(),
		} satisfies SubmissionQueueMessage);
	} else {
		await persistAnswerUpdates(db, attemptId, inputAnswers);

		if (finalize) {
			status = "submitted";

			await db.update(schema.attempts).set({
				status,
				submittedAt: new Date().toISOString(),
				score: null,
				maxScore: null,
				percentage: null,
			}).where(eq(schema.attempts.id, attemptId));

			const finalizedState = mergeAnswersIntoState(
				attemptState,
				inputAnswers,
				true,
				submittedAt,
			);
			await cacheAttemptState(kv, {
				...finalizedState,
				status: "submitted",
			});
			await syncAttemptSubmissionToTeacherService(
				db,
				attemptId,
				submittedAt ?? new Date().toISOString(),
				submissionWebhookUrl,
			);
			const progress = computeProgress(
				countAnsweredQuestions(finalizedState.answers),
				attemptState.totalQuestions,
			);

				const feedback = await generateAttemptFeedback(
					db,
					{ attemptId, progress },
					{
						ai,
						geminiApiKey,
						geminiModel,
						ollamaApiKey,
						ollamaBaseUrl,
						ollamaModel,
					},
				);

				await db.update(schema.attempts).set({
					feedbackJson: stringifyAttemptFeedback(feedback),
				}).where(eq(schema.attempts.id, attemptId));

				return {
					attemptId,
					status,
					progress,
					feedback,
				};
			}

		const nextState = mergeAnswersIntoState(attemptState, inputAnswers, false);
		await cacheAttemptState(kv, nextState);
	}

	const nextState = mergeAnswersIntoState(
		attemptState,
		inputAnswers,
		finalize,
		submittedAt,
	);
	const progress = computeProgress(
		countAnsweredQuestions(nextState.answers),
		attemptState.totalQuestions,
	);
	const feedback = finalize
		? await generateAttemptFeedback(
				db,
				{ attemptId, progress },
				{
					ai,
					geminiApiKey,
					geminiModel,
					ollamaApiKey,
					ollamaBaseUrl,
					ollamaModel,
				},
			)
		: undefined;

	if (feedback) {
		await db.update(schema.attempts).set({
			feedbackJson: stringifyAttemptFeedback(feedback),
		}).where(eq(schema.attempts.id, attemptId));
	}

	return {
		attemptId,
		status,
		progress,
		feedback,
	};
};

export const processSubmissionQueueMessage = async (
	db: DbClient,
	message: SubmissionQueueMessage,
	kv?: KVNamespace,
	submissionWebhookUrl?: string,
	ai?: AiBinding,
	geminiApiKey?: string,
	geminiModel?: string,
	ollamaApiKey?: string,
	ollamaBaseUrl?: string,
	ollamaModel?: string,
) => {
	if (message.type === "ANSWER_UPDATE") {
		await persistAnswerUpdates(db, message.attemptId, [message.data]);
		return;
	}

	if (message.type === "SUBMISSION") {
		const submittedAt = new Date().toISOString();
		const answerKeySource = await getAttemptAnswerKeySource(db, message.attemptId);

		if (answerKeySource === "local") {
			const cachedState = await getAttemptStateFromKv(kv, message.attemptId);
			if (!cachedState) {
				throw new Error("Оролдлогын cache төлөв олдсонгүй.");
			}

			await finalizeLocalAttempt(
				db,
				message.attemptId,
				[],
				cachedState,
				submittedAt,
				{
					ai,
					geminiApiKey,
					geminiModel,
					kv,
					ollamaApiKey,
					ollamaBaseUrl,
					ollamaModel,
				},
			);
			return;
		}

		await db.update(schema.attempts)
			.set({
				status: "submitted",
				submittedAt,
				score: null,
				maxScore: null,
				percentage: null,
			})
			.where(eq(schema.attempts.id, message.attemptId));

		const cachedState = await getAttemptStateFromKv(kv, message.attemptId);
		if (cachedState) {
		await cacheAttemptState(kv, {
			...cachedState,
			status: "submitted",
			submittedAt,
		});
	}
	await syncAttemptSubmissionToTeacherService(
		db,
		message.attemptId,
		submittedAt,
		submissionWebhookUrl,
	);
	return;
}

	await persistAnswerUpdates(db, message.attemptId, message.answers);

	if (!message.finalize) return;

	const answerKeySource = await getAttemptAnswerKeySource(db, message.attemptId);
	if (answerKeySource === "local") {
		const cachedState = await getAttemptStateFromKv(kv, message.attemptId);
		if (!cachedState) {
			throw new Error("Оролдлогын cache төлөв олдсонгүй.");
		}

		await finalizeLocalAttempt(
			db,
			message.attemptId,
			message.answers,
			cachedState,
			message.submittedAt,
			{ kv },
		);
		return;
	}

	await db.update(schema.attempts)
		.set({
			status: "submitted",
			submittedAt: message.submittedAt,
			score: null,
			maxScore: null,
			percentage: null,
		})
		.where(eq(schema.attempts.id, message.attemptId));

	const cachedState = await getAttemptStateFromKv(kv, message.attemptId);
	if (cachedState) {
		await cacheAttemptState(kv, {
			...cachedState,
			status: "submitted",
			submittedAt: message.submittedAt,
		});
	}
	await syncAttemptSubmissionToTeacherService(
		db,
		message.attemptId,
		message.submittedAt,
		submissionWebhookUrl,
	);
};
