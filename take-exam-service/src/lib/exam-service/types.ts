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

export type ExamQuestionType = "single-choice" | "math";
export type AnswerKeySource = "local" | "teacher_service";

export type ExamQuestion = {
	id: string;
	type: ExamQuestionType;
	prompt: string;
	options: ExamOption[];
	correctOptionId: string;
	explanation: string;
	points: number;
	competency: string;
	imageUrl?: string | null;
	audioUrl?: string | null;
	videoUrl?: string | null;
	responseGuide?: string | null;
	answerLatex?: string | null;
};

export type ExamTest = {
	id: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: ExamQuestion[];
	answerKeySource?: AnswerKeySource;
	sourceService?: string | null;
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
	answerKeySource?: AnswerKeySource;
	updatedAt: string;
};

export type ExamAnswerInput = {
	questionId: string;
	selectedOptionId: string | null;
};

export type AttemptQuestionMetricInput = {
	questionId: string;
	dwellMs?: number;
	answerChangeCount?: number;
};

export type ExamProgress = {
	totalQuestions: number;
	answeredQuestions: number;
	remainingQuestions: number;
	completionRate: number;
};

export type AttemptStatus = "in_progress" | "processing" | "submitted" | "approved";

export type ProctoringEventSeverity = "info" | "warning" | "danger";
export type AiContentSource = "ollama" | "gemini" | "cf-ai" | "fallback";
export type MonitoringMode =
	| "screen-capture-enabled"
	| "fallback-dom-capture"
	| "limited-monitoring";

export type AttemptMonitoringEvent = {
	id: string;
	code: string;
	severity: ProctoringEventSeverity;
	title: string;
	detail: string;
	occurredAt: string;
	mode: MonitoringMode;
	screenshotCapturedAt?: string;
	screenshotStorageKey?: string;
	screenshotUrl?: string;
};

export type AttemptMonitoringSummary = {
	totalEvents: number;
	infoCount?: number;
	warningCount: number;
	dangerCount: number;
	lastEventAt?: string;
	recentEvents: AttemptMonitoringEvent[];
};

export type AttemptFeedback = {
	headline: string;
	summary: string;
	strengths: string[];
	improvements: string[];
	source?: AiContentSource;
};

export type AttemptQuestionReviewInput = {
	questionId: string;
	correctOptionId?: string | null;
	explanation?: string | null;
	isCorrect?: boolean | null;
	maxPoints?: number | null;
	pointsAwarded?: number | null;
};

export type AttemptReviewPayload = {
	questionReviews: AttemptQuestionReviewInput[];
};

export type ExamQuestionResult = {
	questionId: string;
	prompt: string;
	competency: string;
	questionType: ExamQuestionType;
	selectedOptionId: string | null;
	correctOptionId: string;
	isCorrect: boolean;
	pointsAwarded: number;
	maxPoints: number;
	explanation: string;
	explanationSource?: AiContentSource;
	dwellMs?: number;
	answerChangeCount?: number;
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

export type AttemptAnswerReviewItem = {
	questionId: string;
	prompt: string;
	competency: string;
	questionType: ExamQuestionType;
	selectedOptionId: string | null;
	selectedAnswerText?: string | null;
	correctAnswerText?: string | null;
	points: number;
	responseGuide?: string | null;
	dwellMs?: number;
	answerChangeCount?: number;
};

export type StudentExamQuestion = {
	questionId: string;
	type: ExamQuestionType;
	prompt: string;
	options: ExamOption[];
	points: number;
	competency?: string;
	imageUrl?: string | null;
	audioUrl?: string | null;
	videoUrl?: string | null;
	responseGuide?: string | null;
};

export type ExamSession = {
	testId: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: StudentExamQuestion[];
};

export type TeacherExamQuestion = StudentExamQuestion & {
	correctOptionId?: string | null;
	answerLatex?: string | null;
};

export type TeacherExamSession = {
	testId: string;
	title: string;
	description: string;
	criteria: TestCriteria;
	timeLimitMinutes: number;
	questions: TeacherExamQuestion[];
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
	feedback?: AttemptFeedback;
};

export type SubmitAnswersResponse = GetProgressResponse;

export type AttemptLiveFeedItem = {
	attemptId: string;
	testId: string;
	title: string;
	studentId: string;
	studentName: string;
	status: AttemptStatus;
	startedAt: string;
	submittedAt?: string;
	monitoring?: AttemptMonitoringSummary;
	latestEvent?: AttemptMonitoringEvent;
};

export type TeacherSubmissionSync = {
	status: "pending" | "sent" | "failed";
	targetService: string;
	lastError?: string;
	sentAt?: string;
};

export type AttemptSummary = {
	attemptId: string;
	testId: string;
	title: string;
	studentId: string;
	studentName: string;
	status: AttemptStatus;
	criteria?: TestCriteria;
	answerKeySource?: AnswerKeySource;
	progress?: ExamProgress;
	score?: number;
	maxScore?: number;
	percentage?: number;
	startedAt: string;
	submittedAt?: string;
	result?: ExamResultSummary;
	monitoring?: AttemptMonitoringSummary;
	feedback?: AttemptFeedback;
	teacherSync?: TeacherSubmissionSync;
	answerReview?: AttemptAnswerReviewItem[];
};
