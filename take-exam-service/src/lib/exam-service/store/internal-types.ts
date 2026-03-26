import type { AttemptStatus, ExamAnswerInput, ExamTest } from "@/lib/exam-service/types";

export type CachedAttemptState = {
	attemptId: string;
	testId: string;
	studentId: string;
	studentName: string;
	status: AttemptStatus;
	startedAt: string;
	expiresAt: string;
	submittedAt?: string;
	totalQuestions: number;
	answers: Record<string, string | null>;
};

export type CachedTestSummary = {
	id: string;
	title: string;
	description: string;
	criteria: ExamTest["criteria"];
	timeLimitMinutes: number;
	updatedAt: string;
};

export type AttemptShuffleManifest = {
	version: 1;
	questionOrder: string[];
	optionOrderByQuestion: Record<string, string[]>;
};

export type SubmissionQueueMessage =
	| {
		type: "UPSERT_ANSWERS";
		attemptId: string;
		answers: ExamAnswerInput[];
		finalize: boolean;
		submittedAt: string;
	}
	| {
		type: "ANSWER_UPDATE";
		attemptId: string;
		data: ExamAnswerInput;
	}
	| {
		type: "SUBMISSION";
		attemptId: string;
	};
