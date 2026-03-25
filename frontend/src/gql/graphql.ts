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
  easyPoints?: InputMaybe<Scalars['Float']['input']>;
  hardPoints?: InputMaybe<Scalars['Float']['input']>;
  mediumPoints?: InputMaybe<Scalars['Float']['input']>;
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

export type FormatDistributionInput = {
  fillIn: Scalars['Int']['input'];
  matching: Scalars['Int']['input'];
  multipleChoice: Scalars['Int']['input'];
  singleChoice: Scalars['Int']['input'];
  written: Scalars['Int']['input'];
};

export type ExamGenerationResult = {
  __typename?: 'ExamGenerationResult';
  examId: Scalars['ID']['output'];
  questions: Array<GeneratedQuestion>;
};

export enum ExamStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED'
}

export enum ExamType {
  FinalTerm = 'FINALTERM',
  Midterm = 'MIDTERM',
  Practice = 'PRACTICE',
  Periodic_1 = 'PERIODIC_1',
  Periodic_2 = 'PERIODIC_2'
}

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

export type Mutation = {
  __typename?: 'Mutation';
  generateExamQuestions: ExamGenerationResult;
  saveExam: SaveExamPayload;
};


export type MutationGenerateExamQuestionsArgs = {
  input: ExamGenerationInput;
};


export type MutationSaveExamArgs = {
  input: SaveExamInput;
};

export type Query = {
  __typename?: 'Query';
  health: Scalars['String']['output'];
};

export enum QuestionFormat {
  FillIn = 'FILL_IN',
  Matching = 'MATCHING',
  MultipleChoice = 'MULTIPLE_CHOICE',
  SingleChoice = 'SINGLE_CHOICE',
  Written = 'WRITTEN'
}

export type SaveExamInput = {
  examId?: InputMaybe<Scalars['ID']['input']>;
  generation: ExamGenerationInput;
  questions: Array<EditableQuestionInput>;
  status: ExamStatus;
};

export type SaveExamPayload = {
  __typename?: 'SaveExamPayload';
  examId: Scalars['ID']['output'];
  status: ExamStatus;
};
