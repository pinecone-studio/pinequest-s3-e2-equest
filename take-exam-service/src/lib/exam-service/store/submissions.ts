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
import { computeResult, getAttemptResults } from "./results";

export const submitExamAnswers = async (
	db: DbClient,
	attemptId: string,
	inputAnswers: ExamAnswerInput[],
	finalize = false,
	queue?: Queue,
	kv?: KVNamespace,
): Promise<SubmitAnswersResponse> => {
	const attemptState = await resolveAttemptState(db, attemptId, kv);

	if (
		attemptState.status === "submitted" ||
		attemptState.status === "approved" ||
		attemptState.status === "processing"
	) {
		const resultRows = await getAttemptResults(db, attemptId);
		return {
			attemptId,
			status: attemptState.status,
			progress: computeProgress(
				resultRows.filter((row) => row.selectedOptionId).length,
				resultRows.length,
			),
			result:
				attemptState.status === "approved"
					? computeResult(resultRows)
					: undefined,
		};
	}

	let status: AttemptStatus = attemptState.status;
	const submittedAt = finalize ? new Date().toISOString() : undefined;

	if (queue) {
		const nextState = mergeAnswersIntoState(
			attemptState,
			inputAnswers,
			finalize,
			submittedAt,
		);
		status = nextState.status;
		await cacheAttemptState(kv, nextState);
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

			return {
				attemptId,
				status,
				progress: computeProgress(
					countAnsweredQuestions(finalizedState.answers),
					attemptState.totalQuestions,
				),
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

	return {
		attemptId,
		status,
		progress: computeProgress(
			countAnsweredQuestions(nextState.answers),
			attemptState.totalQuestions,
		),
	};
};

export const processSubmissionQueueMessage = async (
	db: DbClient,
	message: SubmissionQueueMessage,
	kv?: KVNamespace,
) => {
	if (message.type === "ANSWER_UPDATE") {
		await persistAnswerUpdates(db, message.attemptId, [message.data]);
		return;
	}

	if (message.type === "SUBMISSION") {
		const submittedAt = new Date().toISOString();

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
		return;
	}

	await persistAnswerUpdates(db, message.attemptId, message.answers);

	if (!message.finalize) return;

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
};
