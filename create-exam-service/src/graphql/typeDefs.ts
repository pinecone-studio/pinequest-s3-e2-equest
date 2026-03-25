/** Runtime-д ашиглана; `schema.graphql`-тай синхрон байлгаарай (codegen эндээс уншина). */
export const typeDefs = /* GraphQL */ `
  enum ExamType {
    PERIODIC_1
    PERIODIC_2
    MIDTERM
    FINAL_TERM
  }

  enum ExamStatus {
    DRAFT
    PUBLISHED
  }

  enum Difficulty {
    EASY
    MEDIUM
    HARD
  }

  enum QuestionFormat {
    SINGLE_CHOICE
    MULTIPLE_CHOICE
    MATCHING
    FILL_IN
    WRITTEN
  }

  input DifficultyDistributionInput {
    easy: Int!
    medium: Int!
    hard: Int!
  }

  input DifficultyPointsInput {
    easyPoints: Float
    mediumPoints: Float
    hardPoints: Float
  }

  input DifficultyFormatsInput {
    easy: QuestionFormat!
    medium: QuestionFormat!
    hard: QuestionFormat!
  }

  input ExamGenerationInput {
    gradeClass: String!
    subject: String!
    examType: ExamType!
    topicScope: String!
    examDate: String!
    examTime: String!
    durationMinutes: Int!
    totalQuestionCount: Int!
    difficultyDistribution: DifficultyDistributionInput!
    difficultyPoints: DifficultyPointsInput
    difficultyFormats: DifficultyFormatsInput!
  }

  input EditableQuestionInput {
    id: ID!
    text: String!
    format: QuestionFormat!
    difficulty: Difficulty!
    options: [String!]
    correctAnswer: String
    explanation: String
  }

  input SaveExamInput {
    examId: ID
    status: ExamStatus!
    generation: ExamGenerationInput!
    questions: [EditableQuestionInput!]!
  }

  type GeneratedQuestion {
    id: ID!
    text: String!
    format: QuestionFormat!
    difficulty: Difficulty!
    options: [String!]
    correctAnswer: String
    explanation: String
  }

  type ExamGenerationResult {
    questions: [GeneratedQuestion!]!
  }

  type SaveExamPayload {
    examId: ID!
    status: ExamStatus!
  }

  type Query {
    health: String!
  }

  type Mutation {
    generateExamQuestions(input: ExamGenerationInput!): ExamGenerationResult!
    saveExam(input: SaveExamInput!): SaveExamPayload!
  }
`;
