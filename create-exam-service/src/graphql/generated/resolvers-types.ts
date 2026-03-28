import { GraphQLResolveInfo } from 'graphql';
import { GraphQLContext } from '../context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
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
  sessionMeta?: Maybe<NewMathExamSessionMeta>;
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

export type NewMathExamSessionMeta = {
  __typename?: 'NewMathExamSessionMeta';
  description?: Maybe<Scalars['String']['output']>;
  durationMinutes?: Maybe<Scalars['Int']['output']>;
  endTime?: Maybe<Scalars['String']['output']>;
  examDate?: Maybe<Scalars['String']['output']>;
  examType?: Maybe<Scalars['String']['output']>;
  grade?: Maybe<Scalars['Int']['output']>;
  groupClass?: Maybe<Scalars['String']['output']>;
  mixQuestions?: Maybe<Scalars['Boolean']['output']>;
  roomId?: Maybe<Scalars['String']['output']>;
  startTime?: Maybe<Scalars['String']['output']>;
  subject?: Maybe<Scalars['String']['output']>;
  teacherId?: Maybe<Scalars['String']['output']>;
  topics?: Maybe<Array<Scalars['String']['output']>>;
  variantCount?: Maybe<Scalars['Int']['output']>;
  withVariants?: Maybe<Scalars['Boolean']['output']>;
};

export type NewMathExamSessionMetaInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  durationMinutes?: InputMaybe<Scalars['Int']['input']>;
  endTime?: InputMaybe<Scalars['String']['input']>;
  examDate?: InputMaybe<Scalars['String']['input']>;
  examType?: InputMaybe<Scalars['String']['input']>;
  grade?: InputMaybe<Scalars['Int']['input']>;
  groupClass?: InputMaybe<Scalars['String']['input']>;
  mixQuestions?: InputMaybe<Scalars['Boolean']['input']>;
  roomId?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
  subject?: InputMaybe<Scalars['String']['input']>;
  teacherId?: InputMaybe<Scalars['String']['input']>;
  topics?: InputMaybe<Array<Scalars['String']['input']>>;
  variantCount?: InputMaybe<Scalars['Int']['input']>;
  withVariants?: InputMaybe<Scalars['Boolean']['input']>;
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
  sessionMeta?: InputMaybe<NewMathExamSessionMetaInput>;
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

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Difficulty: Difficulty;
  DifficultyDistributionInput: DifficultyDistributionInput;
  DifficultyPointsInput: DifficultyPointsInput;
  EditableQuestionInput: EditableQuestionInput;
  ExamGenerationInput: ExamGenerationInput;
  ExamGenerationResult: ResolverTypeWrapper<ExamGenerationResult>;
  ExamStatus: ExamStatus;
  ExamType: ExamType;
  FormatDistributionInput: FormatDistributionInput;
  GeneratedQuestion: ResolverTypeWrapper<GeneratedQuestion>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  MathExamQuestionType: MathExamQuestionType;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  NewMathExam: ResolverTypeWrapper<NewMathExam>;
  NewMathExamGeneratorMeta: ResolverTypeWrapper<NewMathExamGeneratorMeta>;
  NewMathExamGeneratorMetaInput: NewMathExamGeneratorMetaInput;
  NewMathExamQuestion: ResolverTypeWrapper<NewMathExamQuestion>;
  NewMathExamQuestionInput: NewMathExamQuestionInput;
  NewMathExamSessionMeta: ResolverTypeWrapper<NewMathExamSessionMeta>;
  NewMathExamSessionMetaInput: NewMathExamSessionMetaInput;
  NewMathExamSummary: ResolverTypeWrapper<NewMathExamSummary>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  QuestionFormat: QuestionFormat;
  SaveExamInput: SaveExamInput;
  SaveExamPayload: ResolverTypeWrapper<SaveExamPayload>;
  SaveNewMathExamInput: SaveNewMathExamInput;
  SaveNewMathExamPayload: ResolverTypeWrapper<SaveNewMathExamPayload>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean']['output'];
  DifficultyDistributionInput: DifficultyDistributionInput;
  DifficultyPointsInput: DifficultyPointsInput;
  EditableQuestionInput: EditableQuestionInput;
  ExamGenerationInput: ExamGenerationInput;
  ExamGenerationResult: ExamGenerationResult;
  FormatDistributionInput: FormatDistributionInput;
  GeneratedQuestion: GeneratedQuestion;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: Record<PropertyKey, never>;
  NewMathExam: NewMathExam;
  NewMathExamGeneratorMeta: NewMathExamGeneratorMeta;
  NewMathExamGeneratorMetaInput: NewMathExamGeneratorMetaInput;
  NewMathExamQuestion: NewMathExamQuestion;
  NewMathExamQuestionInput: NewMathExamQuestionInput;
  NewMathExamSessionMeta: NewMathExamSessionMeta;
  NewMathExamSessionMetaInput: NewMathExamSessionMetaInput;
  NewMathExamSummary: NewMathExamSummary;
  Query: Record<PropertyKey, never>;
  SaveExamInput: SaveExamInput;
  SaveExamPayload: SaveExamPayload;
  SaveNewMathExamInput: SaveNewMathExamInput;
  SaveNewMathExamPayload: SaveNewMathExamPayload;
  String: Scalars['String']['output'];
}>;

export type ExamGenerationResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExamGenerationResult'] = ResolversParentTypes['ExamGenerationResult']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  errorLog?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  questions?: Resolver<Array<ResolversTypes['GeneratedQuestion']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ExamStatus'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type GeneratedQuestionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['GeneratedQuestion'] = ResolversParentTypes['GeneratedQuestion']> = ResolversObject<{
  correctAnswer?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  difficulty?: Resolver<ResolversTypes['Difficulty'], ParentType, ContextType>;
  explanation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  format?: Resolver<ResolversTypes['QuestionFormat'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  options?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  text?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  generateExamQuestions?: Resolver<ResolversTypes['ExamGenerationResult'], ParentType, ContextType, RequireFields<MutationGenerateExamQuestionsArgs, 'input'>>;
  saveExam?: Resolver<ResolversTypes['SaveExamPayload'], ParentType, ContextType, RequireFields<MutationSaveExamArgs, 'input'>>;
  saveNewMathExam?: Resolver<ResolversTypes['SaveNewMathExamPayload'], ParentType, ContextType, RequireFields<MutationSaveNewMathExamArgs, 'input'>>;
}>;

export type NewMathExamResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['NewMathExam'] = ResolversParentTypes['NewMathExam']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  generator?: Resolver<Maybe<ResolversTypes['NewMathExamGeneratorMeta']>, ParentType, ContextType>;
  mathCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  mcqCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  questions?: Resolver<Array<ResolversTypes['NewMathExamQuestion']>, ParentType, ContextType>;
  sessionMeta?: Resolver<Maybe<ResolversTypes['NewMathExamSessionMeta']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalPoints?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type NewMathExamGeneratorMetaResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['NewMathExamGeneratorMeta'] = ResolversParentTypes['NewMathExamGeneratorMeta']> = ResolversObject<{
  difficulty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sourceContext?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  topics?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type NewMathExamQuestionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['NewMathExamQuestion'] = ResolversParentTypes['NewMathExamQuestion']> = ResolversObject<{
  answerLatex?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  correctOption?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  imageAlt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  imageDataUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  options?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  points?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  prompt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  responseGuide?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['MathExamQuestionType'], ParentType, ContextType>;
}>;

export type NewMathExamSessionMetaResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['NewMathExamSessionMeta'] = ResolversParentTypes['NewMathExamSessionMeta']> = ResolversObject<{
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  durationMinutes?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  endTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  examDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  examType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  grade?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  groupClass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  mixQuestions?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  roomId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  subject?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  teacherId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  topics?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  variantCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  withVariants?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
}>;

export type NewMathExamSummaryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['NewMathExamSummary'] = ResolversParentTypes['NewMathExamSummary']> = ResolversObject<{
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  getNewMathExam?: Resolver<Maybe<ResolversTypes['NewMathExam']>, ParentType, ContextType, RequireFields<QueryGetNewMathExamArgs, 'examId'>>;
  listNewMathExams?: Resolver<Array<ResolversTypes['NewMathExamSummary']>, ParentType, ContextType, RequireFields<QueryListNewMathExamsArgs, 'limit'>>;
}>;

export type SaveExamPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SaveExamPayload'] = ResolversParentTypes['SaveExamPayload']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  errorLog?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ExamStatus'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type SaveNewMathExamPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SaveNewMathExamPayload'] = ResolversParentTypes['SaveNewMathExamPayload']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  ExamGenerationResult?: ExamGenerationResultResolvers<ContextType>;
  GeneratedQuestion?: GeneratedQuestionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NewMathExam?: NewMathExamResolvers<ContextType>;
  NewMathExamGeneratorMeta?: NewMathExamGeneratorMetaResolvers<ContextType>;
  NewMathExamQuestion?: NewMathExamQuestionResolvers<ContextType>;
  NewMathExamSessionMeta?: NewMathExamSessionMetaResolvers<ContextType>;
  NewMathExamSummary?: NewMathExamSummaryResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SaveExamPayload?: SaveExamPayloadResolvers<ContextType>;
  SaveNewMathExamPayload?: SaveNewMathExamPayloadResolvers<ContextType>;
}>;

