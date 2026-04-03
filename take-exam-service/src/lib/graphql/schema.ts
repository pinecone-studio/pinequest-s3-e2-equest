import { createSchema } from "graphql-yoga";
import { resolvers } from "./resolvers";

export const typeDefs = /* GraphQL */ `
  type Student {
    id: ID!
    name: String!
    className: String!
  }

  type TestCriteria {
    gradeLevel: Int!
    className: String!
    subject: String!
    topic: String!
    difficulty: String!
    questionCount: Int!
  }

  type Test {
    id: ID!
    title: String!
    description: String!
    criteria: TestCriteria!
    answerKeySource: String!
    updatedAt: String!
  }

  type ExternalExamSummary {
    examId: ID!
    title: String!
    updatedAt: String!
  }

  type ExternalExamImportResult {
    examId: ID!
    importedTestId: ID!
    title: String!
  }

  type ExamOption {
    id: ID!
    text: String!
  }

  type ExistingAnswer {
    questionId: ID!
    selectedOptionId: String
  }

  type StudentExamQuestion {
    questionId: ID!
    type: String!
    prompt: String!
    options: [ExamOption!]!
    points: Int!
    competency: String
    imageUrl: String
    audioUrl: String
    videoUrl: String
    responseGuide: String
  }

  type TeacherExamQuestion {
    questionId: ID!
    type: String!
    prompt: String!
    options: [ExamOption!]!
    points: Int!
    competency: String
    imageUrl: String
    audioUrl: String
    videoUrl: String
    correctOptionId: String
    responseGuide: String
    answerLatex: String
  }

  type ExamSession {
    testId: ID!
    title: String!
    description: String!
    criteria: TestCriteria!
    timeLimitMinutes: Int!
    questions: [StudentExamQuestion!]!
  }

  type TeacherExamSession {
    testId: ID!
    title: String!
    description: String!
    criteria: TestCriteria!
    timeLimitMinutes: Int!
    questions: [TeacherExamQuestion!]!
  }

  type ExamProgress {
    totalQuestions: Int!
    answeredQuestions: Int!
    remainingQuestions: Int!
    completionRate: Int!
  }

  type AttemptMonitoringEvent {
    id: ID!
    code: String!
    severity: String!
    title: String!
    detail: String!
    occurredAt: String!
    mode: String!
    screenshotCapturedAt: String
    screenshotStorageKey: String
    screenshotUrl: String
  }

  type AttemptMonitoringSummary {
    totalEvents: Int!
    infoCount: Int
    warningCount: Int!
    dangerCount: Int!
    lastEventAt: String
    recentEvents: [AttemptMonitoringEvent!]!
  }

  type AttemptFeedback {
    headline: String!
    summary: String!
    strengths: [String!]!
    improvements: [String!]!
    source: String
  }

  type QuestionResult {
    questionId: ID!
    prompt: String!
    competency: String!
    questionType: String!
    selectedOptionId: String
    correctOptionId: String!
    isCorrect: Boolean!
    pointsAwarded: Int!
    maxPoints: Int!
    explanation: String
    explanationSource: String
    dwellMs: Int
    answerChangeCount: Int
  }

  type AttemptResultSummary {
    score: Int!
    maxScore: Int!
    percentage: Int!
    correctCount: Int!
    incorrectCount: Int!
    unansweredCount: Int!
    questionResults: [QuestionResult!]!
  }

  type AttemptAnswerReviewItem {
    questionId: ID!
    prompt: String!
    competency: String!
    questionType: String!
    selectedOptionId: String
    selectedAnswerText: String
    correctAnswerText: String
    points: Int!
    responseGuide: String
    dwellMs: Int
    answerChangeCount: Int
  }

  type TeacherSubmissionSync {
    status: String!
    targetService: String!
    lastError: String
    sentAt: String
  }

  type AttemptSummary {
    attemptId: ID!
    testId: ID!
    title: String!
    studentId: String!
    studentName: String!
    status: String!
    criteria: TestCriteria
    answerKeySource: String!
    progress: ExamProgress!
    score: Int
    maxScore: Int
    percentage: Int
    startedAt: String!
    submittedAt: String
    result: AttemptResultSummary
    monitoring: AttemptMonitoringSummary
    feedback: AttemptFeedback
    teacherSync: TeacherSubmissionSync
    answerReview: [AttemptAnswerReviewItem!]
  }

  type AttemptLiveFeedItem {
    attemptId: ID!
    testId: ID!
    title: String!
    studentId: String!
    studentName: String!
    status: String!
    startedAt: String!
    submittedAt: String
    monitoring: AttemptMonitoringSummary
    latestEvent: AttemptMonitoringEvent
  }

  type StartExamPayload {
    attemptId: ID!
    status: String!
    studentId: String!
    studentName: String!
    startedAt: String!
    expiresAt: String!
    existingAnswers: [ExistingAnswer!]
    exam: ExamSession!
    progress: ExamProgress!
  }

  type SubmitAnswersPayload {
    attemptId: ID!
    status: String!
    progress: ExamProgress!
    result: AttemptResultSummary
    feedback: AttemptFeedback
  }

  type Query {
    students: [Student!]!
    availableTests(limit: Int, forceRefresh: Boolean): [Test!]!
    attempts(limit: Int, forceRefresh: Boolean): [AttemptSummary!]!
    attemptsByTestId(testId: ID!, limit: Int, forceRefresh: Boolean): [AttemptSummary!]!
    testMaterial(testId: ID!, forceRefresh: Boolean): TeacherExamSession
    liveMonitoringFeed(limit: Int, testId: ID): [AttemptLiveFeedItem!]!
    externalNewMathExams(limit: Int): [ExternalExamSummary!]!
  }

  type Mutation {
    saveTest(test: String!): Boolean!
    importNewMathExam(examId: ID!): ExternalExamImportResult!
    syncExternalNewMathExams(limit: Int): [ExternalExamImportResult!]!
    startExam(testId: String!, studentId: String!, studentName: String!): StartExamPayload!
    resumeExam(attemptId: String!): StartExamPayload!
    submitAnswers(attemptId: String!, answers: [AnswerInput!]!, finalize: Boolean!): SubmitAnswersPayload!
    approveAttempt(attemptId: String!, review: AttemptReviewInput): Boolean!
    logAttemptActivity(attemptId: String!, input: AttemptActivityInput!): Boolean!
    logQuestionMetrics(attemptId: String!, input: [QuestionMetricInput!]!): Boolean!
  }

  input AnswerInput {
    questionId: ID!
    selectedOptionId: String
  }

  input AttemptActivityInput {
    code: String!
    severity: String!
    title: String!
    detail: String!
    occurredAt: String
    mode: String!
    screenshotCapturedAt: String
    screenshotStorageKey: String
    screenshotUrl: String
  }

  input QuestionMetricInput {
    questionId: ID!
    dwellMs: Int
    answerChangeCount: Int
  }

  input AttemptQuestionReviewInput {
    questionId: ID!
    correctOptionId: String
    explanation: String
    isCorrect: Boolean
    maxPoints: Int
    pointsAwarded: Int
  }

  input AttemptReviewInput {
    questionReviews: [AttemptQuestionReviewInput!]!
  }
`;

export const schema = createSchema({
  typeDefs,
  resolvers,
});
