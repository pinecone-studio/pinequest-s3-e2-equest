import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AnswerInput = {
  questionId: Scalars['ID']['input'];
  selectedOptionId?: InputMaybe<Scalars['String']['input']>;
};

export type AttemptActivityInput = {
  code: Scalars['String']['input'];
  detail: Scalars['String']['input'];
  occurredAt?: InputMaybe<Scalars['String']['input']>;
  severity: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type AttemptAnswerReviewItem = {
  __typename?: 'AttemptAnswerReviewItem';
  answerChangeCount?: Maybe<Scalars['Int']['output']>;
  competency: Scalars['String']['output'];
  correctAnswerText?: Maybe<Scalars['String']['output']>;
  dwellMs?: Maybe<Scalars['Int']['output']>;
  points: Scalars['Int']['output'];
  prompt: Scalars['String']['output'];
  questionId: Scalars['ID']['output'];
  questionType: Scalars['String']['output'];
  responseGuide?: Maybe<Scalars['String']['output']>;
  selectedAnswerText?: Maybe<Scalars['String']['output']>;
  selectedOptionId?: Maybe<Scalars['String']['output']>;
};

export type AttemptFeedback = {
  __typename?: 'AttemptFeedback';
  headline: Scalars['String']['output'];
  improvements: Array<Scalars['String']['output']>;
  source?: Maybe<Scalars['String']['output']>;
  strengths: Array<Scalars['String']['output']>;
  summary: Scalars['String']['output'];
};

export type AttemptLiveFeedItem = {
  __typename?: 'AttemptLiveFeedItem';
  attemptId: Scalars['ID']['output'];
  latestEvent?: Maybe<AttemptMonitoringEvent>;
  monitoring?: Maybe<AttemptMonitoringSummary>;
  startedAt: Scalars['String']['output'];
  status: Scalars['String']['output'];
  studentId: Scalars['String']['output'];
  studentName: Scalars['String']['output'];
  submittedAt?: Maybe<Scalars['String']['output']>;
  testId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
};

export type AttemptMonitoringEvent = {
  __typename?: 'AttemptMonitoringEvent';
  code: Scalars['String']['output'];
  detail: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  occurredAt: Scalars['String']['output'];
  severity: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type AttemptMonitoringSummary = {
  __typename?: 'AttemptMonitoringSummary';
  dangerCount: Scalars['Int']['output'];
  infoCount?: Maybe<Scalars['Int']['output']>;
  lastEventAt?: Maybe<Scalars['String']['output']>;
  recentEvents: Array<AttemptMonitoringEvent>;
  totalEvents: Scalars['Int']['output'];
  warningCount: Scalars['Int']['output'];
};

export type AttemptQuestionReviewInput = {
  correctOptionId?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  isCorrect?: InputMaybe<Scalars['Boolean']['input']>;
  maxPoints?: InputMaybe<Scalars['Int']['input']>;
  pointsAwarded?: InputMaybe<Scalars['Int']['input']>;
  questionId: Scalars['ID']['input'];
};

export type AttemptResultSummary = {
  __typename?: 'AttemptResultSummary';
  correctCount: Scalars['Int']['output'];
  incorrectCount: Scalars['Int']['output'];
  maxScore: Scalars['Int']['output'];
  percentage: Scalars['Int']['output'];
  questionResults: Array<QuestionResult>;
  score: Scalars['Int']['output'];
  unansweredCount: Scalars['Int']['output'];
};

export type AttemptReviewInput = {
  questionReviews: Array<AttemptQuestionReviewInput>;
};

export type AttemptSummary = {
  __typename?: 'AttemptSummary';
  answerKeySource: Scalars['String']['output'];
  answerReview?: Maybe<Array<AttemptAnswerReviewItem>>;
  attemptId: Scalars['ID']['output'];
  criteria?: Maybe<TestCriteria>;
  feedback?: Maybe<AttemptFeedback>;
  maxScore?: Maybe<Scalars['Int']['output']>;
  monitoring?: Maybe<AttemptMonitoringSummary>;
  percentage?: Maybe<Scalars['Int']['output']>;
  progress: ExamProgress;
  result?: Maybe<AttemptResultSummary>;
  score?: Maybe<Scalars['Int']['output']>;
  startedAt: Scalars['String']['output'];
  status: Scalars['String']['output'];
  studentId: Scalars['String']['output'];
  studentName: Scalars['String']['output'];
  submittedAt?: Maybe<Scalars['String']['output']>;
  teacherSync?: Maybe<TeacherSubmissionSync>;
  testId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
};

export type ExamOption = {
  __typename?: 'ExamOption';
  id: Scalars['ID']['output'];
  text: Scalars['String']['output'];
};

export type ExamProgress = {
  __typename?: 'ExamProgress';
  answeredQuestions: Scalars['Int']['output'];
  completionRate: Scalars['Int']['output'];
  remainingQuestions: Scalars['Int']['output'];
  totalQuestions: Scalars['Int']['output'];
};

export type ExamSession = {
  __typename?: 'ExamSession';
  criteria: TestCriteria;
  description: Scalars['String']['output'];
  questions: Array<StudentExamQuestion>;
  testId: Scalars['ID']['output'];
  timeLimitMinutes: Scalars['Int']['output'];
  title: Scalars['String']['output'];
};

export type ExistingAnswer = {
  __typename?: 'ExistingAnswer';
  questionId: Scalars['ID']['output'];
  selectedOptionId?: Maybe<Scalars['String']['output']>;
};

export type ExternalExamImportResult = {
  __typename?: 'ExternalExamImportResult';
  examId: Scalars['ID']['output'];
  importedTestId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
};

export type ExternalExamSummary = {
  __typename?: 'ExternalExamSummary';
  examId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  approveAttempt: Scalars['Boolean']['output'];
  importNewMathExam: ExternalExamImportResult;
  logAttemptActivity: Scalars['Boolean']['output'];
  logQuestionMetrics: Scalars['Boolean']['output'];
  resumeExam: StartExamPayload;
  saveTest: Scalars['Boolean']['output'];
  startExam: StartExamPayload;
  submitAnswers: SubmitAnswersPayload;
  syncExternalNewMathExams: Array<ExternalExamImportResult>;
};


export type MutationApproveAttemptArgs = {
  attemptId: Scalars['String']['input'];
  review?: InputMaybe<AttemptReviewInput>;
};


export type MutationImportNewMathExamArgs = {
  examId: Scalars['ID']['input'];
};


export type MutationLogAttemptActivityArgs = {
  attemptId: Scalars['String']['input'];
  input: AttemptActivityInput;
};


export type MutationLogQuestionMetricsArgs = {
  attemptId: Scalars['String']['input'];
  input: Array<QuestionMetricInput>;
};


export type MutationResumeExamArgs = {
  attemptId: Scalars['String']['input'];
};


export type MutationSaveTestArgs = {
  test: Scalars['String']['input'];
};


export type MutationStartExamArgs = {
  studentId: Scalars['String']['input'];
  studentName: Scalars['String']['input'];
  testId: Scalars['String']['input'];
};


export type MutationSubmitAnswersArgs = {
  answers: Array<AnswerInput>;
  attemptId: Scalars['String']['input'];
  finalize: Scalars['Boolean']['input'];
};


export type MutationSyncExternalNewMathExamsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type Query = {
  __typename?: 'Query';
  attempts: Array<AttemptSummary>;
  availableTests: Array<Test>;
  externalNewMathExams: Array<ExternalExamSummary>;
  liveMonitoringFeed: Array<AttemptLiveFeedItem>;
  students: Array<Student>;
  testMaterial?: Maybe<ExamSession>;
};


export type QueryExternalNewMathExamsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLiveMonitoringFeedArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTestMaterialArgs = {
  testId: Scalars['ID']['input'];
};

export type QuestionMetricInput = {
  answerChangeCount?: InputMaybe<Scalars['Int']['input']>;
  dwellMs?: InputMaybe<Scalars['Int']['input']>;
  questionId: Scalars['ID']['input'];
};

export type QuestionResult = {
  __typename?: 'QuestionResult';
  answerChangeCount?: Maybe<Scalars['Int']['output']>;
  competency: Scalars['String']['output'];
  correctOptionId: Scalars['String']['output'];
  dwellMs?: Maybe<Scalars['Int']['output']>;
  explanation?: Maybe<Scalars['String']['output']>;
  explanationSource?: Maybe<Scalars['String']['output']>;
  isCorrect: Scalars['Boolean']['output'];
  maxPoints: Scalars['Int']['output'];
  pointsAwarded: Scalars['Int']['output'];
  prompt: Scalars['String']['output'];
  questionId: Scalars['ID']['output'];
  questionType: Scalars['String']['output'];
  selectedOptionId?: Maybe<Scalars['String']['output']>;
};

export type StartExamPayload = {
  __typename?: 'StartExamPayload';
  attemptId: Scalars['ID']['output'];
  exam: ExamSession;
  existingAnswers?: Maybe<Array<ExistingAnswer>>;
  expiresAt: Scalars['String']['output'];
  progress: ExamProgress;
  startedAt: Scalars['String']['output'];
  status: Scalars['String']['output'];
  studentId: Scalars['String']['output'];
  studentName: Scalars['String']['output'];
};

export type Student = {
  __typename?: 'Student';
  className: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type StudentExamQuestion = {
  __typename?: 'StudentExamQuestion';
  audioUrl?: Maybe<Scalars['String']['output']>;
  competency?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  options: Array<ExamOption>;
  points: Scalars['Int']['output'];
  prompt: Scalars['String']['output'];
  questionId: Scalars['ID']['output'];
  responseGuide?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  videoUrl?: Maybe<Scalars['String']['output']>;
};

export type SubmitAnswersPayload = {
  __typename?: 'SubmitAnswersPayload';
  attemptId: Scalars['ID']['output'];
  feedback?: Maybe<AttemptFeedback>;
  progress: ExamProgress;
  result?: Maybe<AttemptResultSummary>;
  status: Scalars['String']['output'];
};

export type TeacherSubmissionSync = {
  __typename?: 'TeacherSubmissionSync';
  lastError?: Maybe<Scalars['String']['output']>;
  sentAt?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  targetService: Scalars['String']['output'];
};

export type Test = {
  __typename?: 'Test';
  answerKeySource: Scalars['String']['output'];
  criteria: TestCriteria;
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type TestCriteria = {
  __typename?: 'TestCriteria';
  className: Scalars['String']['output'];
  difficulty: Scalars['String']['output'];
  gradeLevel: Scalars['Int']['output'];
  questionCount: Scalars['Int']['output'];
  subject: Scalars['String']['output'];
  topic: Scalars['String']['output'];
};

export type AttemptFeedbackFieldsFragment = { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null };

export type AttemptMonitoringEventFieldsFragment = { __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string };

export type AttemptMonitoringSummaryFieldsFragment = { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> };

export type AttemptResultSummaryFieldsFragment = { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null }> };

export type AttemptSummaryFieldsFragment = { __typename?: 'AttemptSummary', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, score?: number | null, maxScore?: number | null, percentage?: number | null, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> } | null, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null }> } | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null, answerReview?: Array<{ __typename?: 'AttemptAnswerReviewItem', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, selectedAnswerText?: string | null, correctAnswerText?: string | null, points: number, responseGuide?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> | null };

export type ExamOptionFieldsFragment = { __typename?: 'ExamOption', id: string, text: string };

export type ExamProgressFieldsFragment = { __typename?: 'ExamProgress', totalQuestions: number, answeredQuestions: number, remainingQuestions: number, completionRate: number };

export type ExamSessionFieldsFragment = { __typename?: 'ExamSession', testId: string, title: string, description: string, timeLimitMinutes: number, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number }, questions: Array<{ __typename?: 'StudentExamQuestion', questionId: string, type: string, prompt: string, points: number, competency?: string | null, imageUrl?: string | null, audioUrl?: string | null, videoUrl?: string | null, responseGuide?: string | null, options: Array<{ __typename?: 'ExamOption', id: string, text: string }> }> };

export type QuestionResultFieldsFragment = { __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null };

export type StartExamPayloadFieldsFragment = { __typename?: 'StartExamPayload', attemptId: string, status: string, studentId: string, studentName: string, startedAt: string, expiresAt: string, existingAnswers?: Array<{ __typename?: 'ExistingAnswer', questionId: string, selectedOptionId?: string | null }> | null, exam: { __typename?: 'ExamSession', testId: string, title: string, description: string, timeLimitMinutes: number, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number }, questions: Array<{ __typename?: 'StudentExamQuestion', questionId: string, type: string, prompt: string, points: number, competency?: string | null, imageUrl?: string | null, audioUrl?: string | null, videoUrl?: string | null, responseGuide?: string | null, options: Array<{ __typename?: 'ExamOption', id: string, text: string }> }> }, progress: { __typename?: 'ExamProgress', totalQuestions: number, answeredQuestions: number, remainingQuestions: number, completionRate: number } };

export type StudentExamQuestionFieldsFragment = { __typename?: 'StudentExamQuestion', questionId: string, type: string, prompt: string, points: number, competency?: string | null, imageUrl?: string | null, audioUrl?: string | null, videoUrl?: string | null, responseGuide?: string | null, options: Array<{ __typename?: 'ExamOption', id: string, text: string }> };

export type StudentFieldsFragment = { __typename?: 'Student', id: string, name: string, className: string };

export type SubmitAnswersPayloadFieldsFragment = { __typename?: 'SubmitAnswersPayload', attemptId: string, status: string, progress: { __typename?: 'ExamProgress', totalQuestions: number, answeredQuestions: number, remainingQuestions: number, completionRate: number }, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null }> } | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null };

export type TestCriteriaFieldsFragment = { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number };

export type TestFieldsFragment = { __typename?: 'Test', id: string, title: string, description: string, updatedAt: string, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number } };

export type ApproveAttemptMutationVariables = Exact<{
  attemptId: Scalars['String']['input'];
}>;


export type ApproveAttemptMutation = { __typename?: 'Mutation', approveAttempt: boolean };

export type LogAttemptActivityMutationVariables = Exact<{
  attemptId: Scalars['String']['input'];
  input: AttemptActivityInput;
}>;


export type LogAttemptActivityMutation = { __typename?: 'Mutation', logAttemptActivity: boolean };

export type ResumeExamMutationVariables = Exact<{
  attemptId: Scalars['String']['input'];
}>;


export type ResumeExamMutation = { __typename?: 'Mutation', resumeExam: { __typename?: 'StartExamPayload', attemptId: string, status: string, studentId: string, studentName: string, startedAt: string, expiresAt: string, existingAnswers?: Array<{ __typename?: 'ExistingAnswer', questionId: string, selectedOptionId?: string | null }> | null, exam: { __typename?: 'ExamSession', testId: string, title: string, description: string, timeLimitMinutes: number, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number }, questions: Array<{ __typename?: 'StudentExamQuestion', questionId: string, type: string, prompt: string, points: number, competency?: string | null, imageUrl?: string | null, audioUrl?: string | null, videoUrl?: string | null, responseGuide?: string | null, options: Array<{ __typename?: 'ExamOption', id: string, text: string }> }> }, progress: { __typename?: 'ExamProgress', totalQuestions: number, answeredQuestions: number, remainingQuestions: number, completionRate: number } } };

export type SaveTestMutationVariables = Exact<{
  test: Scalars['String']['input'];
}>;


export type SaveTestMutation = { __typename?: 'Mutation', saveTest: boolean };

export type StartExamMutationVariables = Exact<{
  testId: Scalars['String']['input'];
  studentId: Scalars['String']['input'];
  studentName: Scalars['String']['input'];
}>;


export type StartExamMutation = { __typename?: 'Mutation', startExam: { __typename?: 'StartExamPayload', attemptId: string, status: string, studentId: string, studentName: string, startedAt: string, expiresAt: string, existingAnswers?: Array<{ __typename?: 'ExistingAnswer', questionId: string, selectedOptionId?: string | null }> | null, exam: { __typename?: 'ExamSession', testId: string, title: string, description: string, timeLimitMinutes: number, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number }, questions: Array<{ __typename?: 'StudentExamQuestion', questionId: string, type: string, prompt: string, points: number, competency?: string | null, imageUrl?: string | null, audioUrl?: string | null, videoUrl?: string | null, responseGuide?: string | null, options: Array<{ __typename?: 'ExamOption', id: string, text: string }> }> }, progress: { __typename?: 'ExamProgress', totalQuestions: number, answeredQuestions: number, remainingQuestions: number, completionRate: number } } };

export type SubmitAnswersMutationVariables = Exact<{
  attemptId: Scalars['String']['input'];
  answers: Array<AnswerInput> | AnswerInput;
  finalize: Scalars['Boolean']['input'];
}>;


export type SubmitAnswersMutation = { __typename?: 'Mutation', submitAnswers: { __typename?: 'SubmitAnswersPayload', attemptId: string, status: string, progress: { __typename?: 'ExamProgress', totalQuestions: number, answeredQuestions: number, remainingQuestions: number, completionRate: number }, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null }> } | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null } };

export type SyncExternalNewMathExamsMutationVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SyncExternalNewMathExamsMutation = { __typename?: 'Mutation', syncExternalNewMathExams: Array<{ __typename?: 'ExternalExamImportResult', examId: string, importedTestId: string, title: string }> };

export type GetAttemptsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAttemptsQuery = { __typename?: 'Query', attempts: Array<{ __typename?: 'AttemptSummary', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, score?: number | null, maxScore?: number | null, percentage?: number | null, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> } | null, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null }> } | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null, answerReview?: Array<{ __typename?: 'AttemptAnswerReviewItem', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, selectedAnswerText?: string | null, correctAnswerText?: string | null, points: number, responseGuide?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> | null }> };

export type GetAvailableTestsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAvailableTestsQuery = { __typename?: 'Query', availableTests: Array<{ __typename?: 'Test', id: string, title: string, description: string, updatedAt: string, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number } }> };

export type GetStudentDashboardQueryVariables = Exact<{ [key: string]: never; }>;


export type GetStudentDashboardQuery = { __typename?: 'Query', availableTests: Array<{ __typename?: 'Test', id: string, title: string, description: string, updatedAt: string, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number } }>, attempts: Array<{ __typename?: 'AttemptSummary', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, score?: number | null, maxScore?: number | null, percentage?: number | null, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> } | null, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null }> } | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null, answerReview?: Array<{ __typename?: 'AttemptAnswerReviewItem', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, selectedAnswerText?: string | null, correctAnswerText?: string | null, points: number, responseGuide?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> | null }> };

export type GetStudentsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetStudentsQuery = { __typename?: 'Query', students: Array<{ __typename?: 'Student', id: string, name: string, className: string }> };

export const AttemptMonitoringEventFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringEventFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]} as unknown as DocumentNode<AttemptMonitoringEventFieldsFragment, unknown>;
export const AttemptMonitoringSummaryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringEventFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringEventFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]} as unknown as DocumentNode<AttemptMonitoringSummaryFieldsFragment, unknown>;
export const QuestionResultFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}}]} as unknown as DocumentNode<QuestionResultFieldsFragment, unknown>;
export const AttemptResultSummaryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptResultSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptResultSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionResultFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}}]} as unknown as DocumentNode<AttemptResultSummaryFieldsFragment, unknown>;
export const AttemptFeedbackFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptFeedbackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]} as unknown as DocumentNode<AttemptFeedbackFieldsFragment, unknown>;
export const AttemptSummaryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptResultSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptFeedbackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"answerReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"correctAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringEventFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringEventFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptResultSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptResultSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionResultFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptFeedbackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]} as unknown as DocumentNode<AttemptSummaryFieldsFragment, unknown>;
export const TestCriteriaFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}}]} as unknown as DocumentNode<TestCriteriaFieldsFragment, unknown>;
export const ExamOptionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamOptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamOption"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]} as unknown as DocumentNode<ExamOptionFieldsFragment, unknown>;
export const StudentExamQuestionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentExamQuestionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StudentExamQuestion"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"audioUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamOptionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamOptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamOption"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]} as unknown as DocumentNode<StudentExamQuestionFieldsFragment, unknown>;
export const ExamSessionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamSessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamSession"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimitMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"questions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StudentExamQuestionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamOptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamOption"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentExamQuestionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StudentExamQuestion"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"audioUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamOptionFields"}}]}}]}}]} as unknown as DocumentNode<ExamSessionFieldsFragment, unknown>;
export const ExamProgressFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamProgressFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamProgress"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"answeredQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completionRate"}}]}}]} as unknown as DocumentNode<ExamProgressFieldsFragment, unknown>;
export const StartExamPayloadFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StartExamPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StartExamPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"existingAnswers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"exam"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamSessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"progress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamProgressFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamOptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamOption"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentExamQuestionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StudentExamQuestion"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"audioUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamOptionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamSessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamSession"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimitMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"questions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StudentExamQuestionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamProgressFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamProgress"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"answeredQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completionRate"}}]}}]} as unknown as DocumentNode<StartExamPayloadFieldsFragment, unknown>;
export const StudentFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Student"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}}]}}]} as unknown as DocumentNode<StudentFieldsFragment, unknown>;
export const SubmitAnswersPayloadFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SubmitAnswersPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SubmitAnswersPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamProgressFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptResultSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptFeedbackFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamProgressFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamProgress"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"answeredQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completionRate"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptResultSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptResultSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionResultFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptFeedbackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]} as unknown as DocumentNode<SubmitAnswersPayloadFieldsFragment, unknown>;
export const TestFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Test"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}}]} as unknown as DocumentNode<TestFieldsFragment, unknown>;
export const ApproveAttemptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ApproveAttempt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"approveAttempt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"attemptId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}}}]}]}}]} as unknown as DocumentNode<ApproveAttemptMutation, ApproveAttemptMutationVariables>;
export const LogAttemptActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogAttemptActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptActivityInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logAttemptActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"attemptId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<LogAttemptActivityMutation, LogAttemptActivityMutationVariables>;
export const ResumeExamDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResumeExam"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resumeExam"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"attemptId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StartExamPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamOptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamOption"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentExamQuestionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StudentExamQuestion"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"audioUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamOptionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamSessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamSession"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimitMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"questions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StudentExamQuestionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamProgressFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamProgress"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"answeredQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completionRate"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StartExamPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StartExamPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"existingAnswers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"exam"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamSessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"progress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamProgressFields"}}]}}]}}]} as unknown as DocumentNode<ResumeExamMutation, ResumeExamMutationVariables>;
export const SaveTestDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveTest"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"test"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveTest"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"test"},"value":{"kind":"Variable","name":{"kind":"Name","value":"test"}}}]}]}}]} as unknown as DocumentNode<SaveTestMutation, SaveTestMutationVariables>;
export const StartExamDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartExam"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"testId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"studentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"studentName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startExam"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"testId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"testId"}}},{"kind":"Argument","name":{"kind":"Name","value":"studentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"studentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"studentName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"studentName"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StartExamPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamOptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamOption"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentExamQuestionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StudentExamQuestion"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"audioUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamOptionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamSessionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamSession"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimitMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"questions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StudentExamQuestionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamProgressFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamProgress"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"answeredQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completionRate"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StartExamPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StartExamPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"existingAnswers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"exam"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamSessionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"progress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamProgressFields"}}]}}]}}]} as unknown as DocumentNode<StartExamMutation, StartExamMutationVariables>;
export const SubmitAnswersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitAnswers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"answers"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AnswerInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"finalize"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitAnswers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"attemptId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attemptId"}}},{"kind":"Argument","name":{"kind":"Name","value":"answers"},"value":{"kind":"Variable","name":{"kind":"Name","value":"answers"}}},{"kind":"Argument","name":{"kind":"Name","value":"finalize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"finalize"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SubmitAnswersPayloadFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExamProgressFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ExamProgress"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"answeredQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"remainingQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"completionRate"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptResultSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptResultSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionResultFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptFeedbackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SubmitAnswersPayloadFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SubmitAnswersPayload"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"progress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExamProgressFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptResultSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptFeedbackFields"}}]}}]}}]} as unknown as DocumentNode<SubmitAnswersMutation, SubmitAnswersMutationVariables>;
export const SyncExternalNewMathExamsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SyncExternalNewMathExams"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"syncExternalNewMathExams"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"examId"}},{"kind":"Field","name":{"kind":"Name","value":"importedTestId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<SyncExternalNewMathExamsMutation, SyncExternalNewMathExamsMutationVariables>;
export const GetAttemptsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAttempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringEventFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringEventFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptResultSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptResultSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionResultFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptFeedbackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptResultSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptFeedbackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"answerReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"correctAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}}]}}]} as unknown as DocumentNode<GetAttemptsQuery, GetAttemptsQueryVariables>;
export const GetAvailableTestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetAvailableTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Test"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}}]}}]} as unknown as DocumentNode<GetAvailableTestsQuery, GetAvailableTestsQueryVariables>;
export const GetStudentDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStudentDashboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestCriteriaFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TestCriteria"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringEventFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringEvent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptMonitoringSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringEventFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptResultSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptResultSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionResultFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptFeedbackFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Test"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TestCriteriaFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AttemptSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptMonitoringSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptResultSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AttemptFeedbackFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"answerReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"correctAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}}]}}]} as unknown as DocumentNode<GetStudentDashboardQuery, GetStudentDashboardQueryVariables>;
export const GetStudentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStudents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"students"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"StudentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StudentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Student"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"className"}}]}}]} as unknown as DocumentNode<GetStudentsQuery, GetStudentsQueryVariables>;