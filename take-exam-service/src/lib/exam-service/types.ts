export type TestCriteria = {
	gradeLevel: number;
	className: string;
	subject: string;
	topic: string;
	difficulty: string;
	questionCount: number;
};

export type StudentInfo = {
	id: string;
	name: string;
	className: string;
};

export type ExamOption = {
	id: string;
	text: string;
};

export type ExamQuestion = {
	id: string;
	prompt: string;
	options: ExamOption[];
	correctOptionId: string;
	explanation: string;
	points: number;
	competency: string;
	imageUrl?: string | null;
	audioUrl?: string | null;
	videoUrl?: string | null;
};

export type ExamTest = {
	id: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: ExamQuestion[];
	updatedAt?: string;
	status?: "draft" | "published" | "archived";
};

export type GetTestByIdResponse = {
	test: ExamTest;
};

export type TeacherTestSummary = {
	id: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	updatedAt: string;
};

export type ExamAnswerInput = {
	questionId: string;
	selectedOptionId: string | null;
};

export type ExamProgress = {
	totalQuestions: number;
	answeredQuestions: number;
	remainingQuestions: number;
	completionRate: number;
};

export type AttemptStatus = "in_progress" | "processing" | "submitted" | "approved";

export type ProctoringEventSeverity = "warning" | "danger";

export type AttemptMonitoringEvent = {
	id: string;
	code: string;
	severity: ProctoringEventSeverity;
	title: string;
	detail: string;
	occurredAt: string;
};

export type AttemptMonitoringSummary = {
	totalEvents: number;
	warningCount: number;
	dangerCount: number;
	lastEventAt?: string;
	recentEvents: AttemptMonitoringEvent[];
};

export type ExamQuestionResult = {
	questionId: string;
	selectedOptionId: string | null;
	correctOptionId: string;
	isCorrect: boolean;
	pointsAwarded: number;
	maxPoints: number;
	explanation: string;
};

export type ExamResultSummary = {
	score: number;
	maxScore: number;
	percentage: number;
	correctCount: number;
	incorrectCount: number;
	unansweredCount: number;
	questionResults: ExamQuestionResult[];
};

export type StudentExamQuestion = {
	questionId: string;
	type: "single-choice";
	prompt: string;
	options: ExamOption[];
	points: number;
	competency?: string;
	imageUrl?: string | null;
	audioUrl?: string | null;
	videoUrl?: string | null;
};

export type ExamSession = {
	testId: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: StudentExamQuestion[];
};

export type StartExamResponse = {
	attemptId: string;
	status: "in_progress";
	studentId: string;
	studentName: string;
	startedAt: string;
	expiresAt: string;
	exam: ExamSession;
	progress: ExamProgress;
	existingAnswers?: Record<string, string | null>;
};

export type GetProgressResponse = {
	attemptId: string;
	status: AttemptStatus;
	progress: ExamProgress;
	result?: ExamResultSummary;
};

export type SubmitAnswersResponse = GetProgressResponse;

export type AttemptSummary = {
	attemptId: string;
	testId: string;
	title: string;
	studentId: string;
	studentName: string;
	status: AttemptStatus;
	score?: number;
	maxScore?: number;
	percentage?: number;
	startedAt: string;
	submittedAt?: string;
	result?: ExamResultSummary;
	monitoring?: AttemptMonitoringSummary;
};
