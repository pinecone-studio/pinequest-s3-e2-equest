/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
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

export enum Difficulty {
  Easy = 'EASY',
  Hard = 'HARD',
  Medium = 'MEDIUM'
}

export type DifficultyDistributionInput = {
  easy: Scalars['Int']['input'];
  hard: Scalars['Int']['input'];
  medium: Scalars['Int']['input'];
};

export type DifficultyPointsInput = {
  easyPoints?: InputMaybe<Scalars['Int']['input']>;
  hardPoints?: InputMaybe<Scalars['Int']['input']>;
  mediumPoints?: InputMaybe<Scalars['Int']['input']>;
};

export type EditableQuestionInput = {
  correctAnswer?: InputMaybe<Scalars['String']['input']>;
  difficulty: Difficulty;
  explanation?: InputMaybe<Scalars['String']['input']>;
  format: QuestionFormat;
  id: Scalars['ID']['input'];
  options?: InputMaybe<Array<Scalars['String']['input']>>;
  text: Scalars['String']['input'];
};

export type ExamGenerationInput = {
  difficultyDistribution: DifficultyDistributionInput;
  difficultyPoints?: InputMaybe<DifficultyPointsInput>;
  durationMinutes: Scalars['Int']['input'];
  examContent: Scalars['String']['input'];
  examDate: Scalars['String']['input'];
  examTime: Scalars['String']['input'];
  examType: ExamType;
  formatDistribution?: InputMaybe<FormatDistributionInput>;
  gradeClass: Scalars['String']['input'];
  subject: Scalars['String']['input'];
  topicScope: Scalars['String']['input'];
  totalQuestionCount: Scalars['Int']['input'];
};

export type ExamGenerationResult = {
  __typename?: 'ExamGenerationResult';
  createdAt: Scalars['String']['output'];
  errorLog?: Maybe<Scalars['String']['output']>;
  examId: Scalars['ID']['output'];
  questions: Array<GeneratedQuestion>;
  status: ExamStatus;
  updatedAt: Scalars['String']['output'];
};

export enum ExamStatus {
  Draft = 'DRAFT',
  Failed = 'FAILED',
  Generating = 'GENERATING',
  Published = 'PUBLISHED'
}

export enum ExamType {
  Finalterm = 'FINALTERM',
  Midterm = 'MIDTERM',
  Periodic_1 = 'PERIODIC_1',
  Periodic_2 = 'PERIODIC_2',
  Practice = 'PRACTICE'
}

export type FormatDistributionInput = {
  fillIn: Scalars['Int']['input'];
  matching: Scalars['Int']['input'];
  multipleChoice: Scalars['Int']['input'];
  singleChoice: Scalars['Int']['input'];
  written: Scalars['Int']['input'];
};

export type GeneratedQuestion = {
  __typename?: 'GeneratedQuestion';
  correctAnswer?: Maybe<Scalars['String']['output']>;
  difficulty: Difficulty;
  explanation?: Maybe<Scalars['String']['output']>;
  format: QuestionFormat;
  id: Scalars['ID']['output'];
  options?: Maybe<Array<Scalars['String']['output']>>;
  text: Scalars['String']['output'];
};

export enum MathExamQuestionType {
  Math = 'MATH',
  Mcq = 'MCQ'
}

export type Mutation = {
  __typename?: 'Mutation';
  generateExamQuestions: ExamGenerationResult;
  saveExam: SaveExamPayload;
  saveNewMathExam: SaveNewMathExamPayload;
};


export type MutationGenerateExamQuestionsArgs = {
  input: ExamGenerationInput;
};


export type MutationSaveExamArgs = {
  input: SaveExamInput;
};


export type MutationSaveNewMathExamArgs = {
  input: SaveNewMathExamInput;
};

export type NewMathExam = {
  __typename?: 'NewMathExam';
  createdAt: Scalars['String']['output'];
  examId: Scalars['ID']['output'];
  generator?: Maybe<NewMathExamGeneratorMeta>;
  mathCount: Scalars['Int']['output'];
  mcqCount: Scalars['Int']['output'];
  questions: Array<NewMathExamQuestion>;
  title: Scalars['String']['output'];
  totalPoints: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
};

export type NewMathExamGeneratorMeta = {
  __typename?: 'NewMathExamGeneratorMeta';
  difficulty?: Maybe<Scalars['String']['output']>;
  sourceContext?: Maybe<Scalars['String']['output']>;
  topics?: Maybe<Scalars['String']['output']>;
};

export type NewMathExamGeneratorMetaInput = {
  difficulty?: InputMaybe<Scalars['String']['input']>;
  sourceContext?: InputMaybe<Scalars['String']['input']>;
  topics?: InputMaybe<Scalars['String']['input']>;
};

export type NewMathExamQuestion = {
  __typename?: 'NewMathExamQuestion';
  answerLatex?: Maybe<Scalars['String']['output']>;
  correctOption?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  imageAlt?: Maybe<Scalars['String']['output']>;
  imageDataUrl?: Maybe<Scalars['String']['output']>;
  options?: Maybe<Array<Scalars['String']['output']>>;
  points: Scalars['Int']['output'];
  prompt: Scalars['String']['output'];
  responseGuide?: Maybe<Scalars['String']['output']>;
  type: MathExamQuestionType;
};

export type NewMathExamQuestionInput = {
  answerLatex?: InputMaybe<Scalars['String']['input']>;
  correctOption?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  imageAlt?: InputMaybe<Scalars['String']['input']>;
  imageDataUrl?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<Array<Scalars['String']['input']>>;
  points: Scalars['Int']['input'];
  prompt: Scalars['String']['input'];
  responseGuide?: InputMaybe<Scalars['String']['input']>;
  type: MathExamQuestionType;
};

export type NewMathExamSummary = {
  __typename?: 'NewMathExamSummary';
  examId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  getNewMathExam?: Maybe<NewMathExam>;
  health: Scalars['String']['output'];
  listNewMathExams: Array<NewMathExamSummary>;
};


export type QueryGetNewMathExamArgs = {
  examId: Scalars['ID']['input'];
};


export type QueryListNewMathExamsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export enum QuestionFormat {
  FillIn = 'FILL_IN',
  Matching = 'MATCHING',
  MultipleChoice = 'MULTIPLE_CHOICE',
  SingleChoice = 'SINGLE_CHOICE',
  Written = 'WRITTEN'
}

export type SaveExamInput = {
  errorLog?: InputMaybe<Scalars['String']['input']>;
  examId?: InputMaybe<Scalars['ID']['input']>;
  generation: ExamGenerationInput;
  questions: Array<EditableQuestionInput>;
  status: ExamStatus;
};

export type SaveExamPayload = {
  __typename?: 'SaveExamPayload';
  createdAt: Scalars['String']['output'];
  errorLog?: Maybe<Scalars['String']['output']>;
  examId: Scalars['ID']['output'];
  status: ExamStatus;
  updatedAt: Scalars['String']['output'];
};

export type SaveNewMathExamInput = {
  examId?: InputMaybe<Scalars['ID']['input']>;
  generator?: InputMaybe<NewMathExamGeneratorMetaInput>;
  mathCount: Scalars['Int']['input'];
  mcqCount: Scalars['Int']['input'];
  questions: Array<NewMathExamQuestionInput>;
  title: Scalars['String']['input'];
  totalPoints: Scalars['Int']['input'];
};

export type SaveNewMathExamPayload = {
  __typename?: 'SaveNewMathExamPayload';
  createdAt: Scalars['String']['output'];
  examId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};
