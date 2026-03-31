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

export type FrontendDashboardAttemptFieldsFragment = { __typename?: 'AttemptSummary', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, answerKeySource: string, score?: number | null, maxScore?: number | null, percentage?: number | null, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> } | null, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> } | null, answerReview?: Array<{ __typename?: 'AttemptAnswerReviewItem', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, selectedAnswerText?: string | null, correctAnswerText?: string | null, points: number, responseGuide?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null };

export type FrontendDashboardLiveFeedFieldsFragment = { __typename?: 'AttemptLiveFeedItem', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null } | null, latestEvent?: { __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string } | null };

export type FrontendDashboardAvailableTestFieldsFragment = { __typename?: 'Test', id: string, title: string, description: string, answerKeySource: string, updatedAt: string, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number } };

export type FrontendTakeExamDashboardQueryVariables = Exact<{
  limit: Scalars['Int']['input'];
}>;


export type FrontendTakeExamDashboardQuery = { __typename?: 'Query', availableTests: Array<{ __typename?: 'Test', id: string, title: string, description: string, answerKeySource: string, updatedAt: string, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number } }>, attempts: Array<{ __typename?: 'AttemptSummary', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, answerKeySource: string, score?: number | null, maxScore?: number | null, percentage?: number | null, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> } | null, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> } | null, answerReview?: Array<{ __typename?: 'AttemptAnswerReviewItem', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, selectedAnswerText?: string | null, correctAnswerText?: string | null, points: number, responseGuide?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null }>, liveMonitoringFeed: Array<{ __typename?: 'AttemptLiveFeedItem', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null } | null, latestEvent?: { __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string } | null }> };

export type FrontendTakeExamDashboardWithMaterialQueryVariables = Exact<{
  limit: Scalars['Int']['input'];
  testId: Scalars['ID']['input'];
}>;


export type FrontendTakeExamDashboardWithMaterialQuery = { __typename?: 'Query', availableTests: Array<{ __typename?: 'Test', id: string, title: string, description: string, answerKeySource: string, updatedAt: string, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number } }>, attempts: Array<{ __typename?: 'AttemptSummary', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, answerKeySource: string, score?: number | null, maxScore?: number | null, percentage?: number | null, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null, recentEvents: Array<{ __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string }> } | null, result?: { __typename?: 'AttemptResultSummary', score: number, maxScore: number, percentage: number, correctCount: number, incorrectCount: number, unansweredCount: number, questionResults: Array<{ __typename?: 'QuestionResult', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, correctOptionId: string, isCorrect: boolean, pointsAwarded: number, maxPoints: number, explanation?: string | null, explanationSource?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> } | null, answerReview?: Array<{ __typename?: 'AttemptAnswerReviewItem', questionId: string, prompt: string, competency: string, questionType: string, selectedOptionId?: string | null, selectedAnswerText?: string | null, correctAnswerText?: string | null, points: number, responseGuide?: string | null, dwellMs?: number | null, answerChangeCount?: number | null }> | null, feedback?: { __typename?: 'AttemptFeedback', headline: string, summary: string, strengths: Array<string>, improvements: Array<string>, source?: string | null } | null }>, liveMonitoringFeed: Array<{ __typename?: 'AttemptLiveFeedItem', attemptId: string, testId: string, title: string, studentId: string, studentName: string, status: string, startedAt: string, submittedAt?: string | null, monitoring?: { __typename?: 'AttemptMonitoringSummary', totalEvents: number, warningCount: number, dangerCount: number, lastEventAt?: string | null } | null, latestEvent?: { __typename?: 'AttemptMonitoringEvent', id: string, code: string, severity: string, title: string, detail: string, occurredAt: string } | null }>, testMaterial?: { __typename?: 'ExamSession', testId: string, title: string, description: string, timeLimitMinutes: number, criteria: { __typename?: 'TestCriteria', gradeLevel: number, className: string, subject: string, topic: string, difficulty: string, questionCount: number }, questions: Array<{ __typename?: 'StudentExamQuestion', questionId: string, type: string, prompt: string, points: number, competency?: string | null, imageUrl?: string | null, audioUrl?: string | null, videoUrl?: string | null, responseGuide?: string | null, options: Array<{ __typename?: 'ExamOption', id: string, text: string }> }> } | null };

export const FrontendDashboardAttemptFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardAttemptFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"answerKeySource"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"answerReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"correctAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]}}]} as unknown as DocumentNode<FrontendDashboardAttemptFieldsFragment, unknown>;
export const FrontendDashboardLiveFeedFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardLiveFeedFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptLiveFeedItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestEvent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]}}]} as unknown as DocumentNode<FrontendDashboardLiveFeedFieldsFragment, unknown>;
export const FrontendDashboardAvailableTestFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardAvailableTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Test"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"answerKeySource"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}}]}}]} as unknown as DocumentNode<FrontendDashboardAvailableTestFieldsFragment, unknown>;
export const FrontendTakeExamDashboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FrontendTakeExamDashboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FrontendDashboardAvailableTestFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FrontendDashboardAttemptFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"liveMonitoringFeed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FrontendDashboardLiveFeedFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardAvailableTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Test"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"answerKeySource"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardAttemptFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"answerKeySource"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"answerReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"correctAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardLiveFeedFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptLiveFeedItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestEvent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]}}]} as unknown as DocumentNode<FrontendTakeExamDashboardQuery, FrontendTakeExamDashboardQueryVariables>;
export const FrontendTakeExamDashboardWithMaterialDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FrontendTakeExamDashboardWithMaterial"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"testId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FrontendDashboardAvailableTestFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attempts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FrontendDashboardAttemptFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"liveMonitoringFeed"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"FrontendDashboardLiveFeedFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"testMaterial"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"testId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"testId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimitMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"questions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"audioUrl"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardAvailableTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Test"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"answerKeySource"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"criteria"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"className"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"topic"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"questionCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardAttemptFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"answerKeySource"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}},{"kind":"Field","name":{"kind":"Name","value":"recentEvents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxScore"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}},{"kind":"Field","name":{"kind":"Name","value":"unansweredCount"}},{"kind":"Field","name":{"kind":"Name","value":"questionResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"correctOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"isCorrect"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"explanationSource"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"answerReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"competency"}},{"kind":"Field","name":{"kind":"Name","value":"questionType"}},{"kind":"Field","name":{"kind":"Name","value":"selectedOptionId"}},{"kind":"Field","name":{"kind":"Name","value":"selectedAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"correctAnswerText"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"responseGuide"}},{"kind":"Field","name":{"kind":"Name","value":"dwellMs"}},{"kind":"Field","name":{"kind":"Name","value":"answerChangeCount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedback"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"headline"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"strengths"}},{"kind":"Field","name":{"kind":"Name","value":"improvements"}},{"kind":"Field","name":{"kind":"Name","value":"source"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FrontendDashboardLiveFeedFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AttemptLiveFeedItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"attemptId"}},{"kind":"Field","name":{"kind":"Name","value":"testId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"studentId"}},{"kind":"Field","name":{"kind":"Name","value":"studentName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"monitoring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalEvents"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"dangerCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"latestEvent"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"detail"}},{"kind":"Field","name":{"kind":"Name","value":"occurredAt"}}]}}]}}]} as unknown as DocumentNode<FrontendTakeExamDashboardWithMaterialQuery, FrontendTakeExamDashboardWithMaterialQueryVariables>;