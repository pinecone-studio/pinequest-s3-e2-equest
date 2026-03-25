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
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GeneratedQuestion: ResolverTypeWrapper<GeneratedQuestion>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  QuestionFormat: QuestionFormat;
  SaveExamInput: SaveExamInput;
  SaveExamPayload: ResolverTypeWrapper<SaveExamPayload>;
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
  Float: Scalars['Float']['output'];
  GeneratedQuestion: GeneratedQuestion;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  SaveExamInput: SaveExamInput;
  SaveExamPayload: SaveExamPayload;
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
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  health?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type SaveExamPayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SaveExamPayload'] = ResolversParentTypes['SaveExamPayload']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  errorLog?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ExamStatus'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  ExamGenerationResult?: ExamGenerationResultResolvers<ContextType>;
  GeneratedQuestion?: GeneratedQuestionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SaveExamPayload?: SaveExamPayloadResolvers<ContextType>;
}>;

