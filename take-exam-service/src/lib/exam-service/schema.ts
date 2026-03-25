import type { ExamResultSummary, MockTest, StudentQuestion } from "@shared/contracts/mock-exam";

export type AttemptQuestionRecord = StudentQuestion & {
	correctOptionId: string;
	explanation: string;
	selectedOptionId: string | null;
};

export type ExamAttemptRecord = {
	attemptId: string;
	testId: string;
	testVersion: number;
	title: string;
	description: string;
	criteria: MockTest["criteria"];
	timeLimitMinutes: number;
	studentId: string;
	studentName: string;
	status: "in_progress" | "processing" | "submitted" | "approved";
	startedAt: string;
	expiresAt: string;
	submittedAt?: string;
	questions: AttemptQuestionRecord[];
	result?: ExamResultSummary;
};
