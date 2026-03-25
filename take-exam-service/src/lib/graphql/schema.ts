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
    updatedAt: String!
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

  type QuestionResult {
    questionId: ID!
    selectedOptionId: String
    correctOptionId: String!
    isCorrect: Boolean!
    explanation: String
  }

  type Attempt {
    attemptId: ID!
    testId: ID!
    title: String!
    studentId: String!
    studentName: String!
    status: String!
    score: Int
    maxScore: Int
    percentage: Int
    startedAt: String!
    submittedAt: String
    result: AttemptResultSummary
  }

  type Query {
    students: [Student!]!
    availableTests: [Test!]!
    attempts: [Attempt!]!
  }

  type Mutation {
    saveTest(test: String!): Boolean!
    startExam(testId: String!, studentId: String!, studentName: String!): Attempt!
    resumeExam(attemptId: String!): Attempt!
    submitAnswers(attemptId: String!, answers: [AnswerInput!]!, finalize: Boolean!): Attempt!
    approveAttempt(attemptId: String!): Boolean!
  }

  input AnswerInput {
    questionId: ID!
    selectedOptionId: String
  }
`;

export const schema = createSchema({
  typeDefs,
  resolvers,
});
