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

export type AiExamTemplatePayload = {
  __typename?: 'AiExamTemplatePayload';
  createdAt: Scalars['String']['output'];
  difficulty: Difficulty;
  templateId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  totalPoints: Scalars['Int']['output'];
};

export type AiQuestionTemplateInput = {
  aiSuggestedType?: InputMaybe<Scalars['String']['input']>;
  correctAnswer?: InputMaybe<Scalars['String']['input']>;
  difficulty?: InputMaybe<Difficulty>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  optionsJson?: InputMaybe<Scalars['String']['input']>;
  points?: InputMaybe<Scalars['Int']['input']>;
  prompt: Scalars['String']['input'];
  skillLevel?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type CreateAiExamTemplateInput = {
  durationMinutes: Scalars['Int']['input'];
  grade: Scalars['Int']['input'];
  questions: Array<AiQuestionTemplateInput>;
  subject: Scalars['String']['input'];
  teacherId: Scalars['String']['input'];
  title: Scalars['String']['input'];
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

export type ExamSchedule = {
  __typename?: 'ExamSchedule';
  aiReasoning?: Maybe<Scalars['String']['output']>;
  /** pending | suggested | confirmed | failed */
  aiVariants: Array<ExamScheduleVariant>;
  classId: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  endTime?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  roomId?: Maybe<Scalars['String']['output']>;
  /** Багшийн сонгосон өдөр (эхлэл) — санал гармагц хувилбарын цаг тусдаа */
  startTime: Scalars['String']['output'];
  status: Scalars['String']['output'];
  testId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ExamScheduleVariant = {
  __typename?: 'ExamScheduleVariant';
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  roomId: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
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

export type GenerateQuestionAnswerInput = {
  difficulty?: InputMaybe<Difficulty>;
  format?: InputMaybe<QuestionFormat>;
  points?: InputMaybe<Scalars['Int']['input']>;
  prompt: Scalars['String']['input'];
};

export type GenerateQuestionAnswerResult = {
  __typename?: 'GenerateQuestionAnswerResult';
  correctAnswer: Scalars['String']['output'];
  difficulty: Difficulty;
  explanation: Scalars['String']['output'];
  format: QuestionFormat;
  options?: Maybe<Array<Scalars['String']['output']>>;
  points: Scalars['Int']['output'];
  questionText: Scalars['String']['output'];
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
  analyzeQuestion: QuestionAnalysisResult;
  /** Багш AI-ийн саналуудаас нэгийг сонгож батална (human-in-the-loop) */
  approveAiExamSchedule: ExamSchedule;
  createAiExamTemplate: AiExamTemplatePayload;
  generateExamQuestions: ExamGenerationResult;
  generateQuestionAnswer: GenerateQuestionAnswerResult;
  /**
   * Багш AI-ийн санал (variant)-аас татгалзана. Үлдсэн санал байвал suggested хэвээр,
   * бүгд татгалзвал status = rejected болно.
   */
  rejectAiExamScheduleVariant: ExamSchedule;
  requestAiExamSchedule: RequestExamSchedulePayload;
  saveExam: SaveExamPayload;
  saveNewMathExam: SaveNewMathExamPayload;
};


export type MutationAnalyzeQuestionArgs = {
  prompt: Scalars['String']['input'];
};


export type MutationApproveAiExamScheduleArgs = {
  examId: Scalars['ID']['input'];
  variantId: Scalars['String']['input'];
};


export type MutationCreateAiExamTemplateArgs = {
  input: CreateAiExamTemplateInput;
};


export type MutationGenerateExamQuestionsArgs = {
  input: ExamGenerationInput;
};


export type MutationGenerateQuestionAnswerArgs = {
  input: GenerateQuestionAnswerInput;
};


export type MutationRejectAiExamScheduleVariantArgs = {
  examId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  variantId: Scalars['String']['input'];
};


export type MutationRequestAiExamScheduleArgs = {
  classId: Scalars['String']['input'];
  preferredDate: Scalars['String']['input'];
  testId: Scalars['ID']['input'];
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
  durationMinutes?: Maybe<Scalars['Int']['output']>;
  examId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** AI scheduler: нэг мөрийн төлөв (polling-д ашиглана) */
  getAiExamSchedule?: Maybe<ExamSchedule>;
  getNewMathExam?: Maybe<NewMathExam>;
  /** ai-scheduler-school-event: өгөгдсөн хугацааны мужид давхцах эвентүүд */
  getSchoolEvents: Array<SchoolEvent>;
  /** ai-scheduler-student: сонгосон сурагчийн үндсэн хуваарь (ангиар нь) */
  getStudentMainLessonsList: Array<StudentMainLesson>;
  /** ai-scheduler-student: 10A гэх мэт ангид харьяалагдах сурагчдын жагсаалт */
  getStudentsList: Array<Student>;
  /** ai-scheduler-teacher: тухайн багшийн үндсэн хичээлийн (primary) хуваарь */
  getTeacherMainLessonsList: Array<TeacherMainLesson>;
  /** ai-scheduler-teacher: 9–12-р ангийн Math (MATH_HS) ордог багш нар */
  getTeachersList: Array<Teacher>;
  listNewMathExams: Array<NewMathExamSummary>;
};


export type QueryGetAiExamScheduleArgs = {
  examId: Scalars['ID']['input'];
};


export type QueryGetNewMathExamArgs = {
  examId: Scalars['ID']['input'];
};


export type QueryGetSchoolEventsArgs = {
  endDate: Scalars['String']['input'];
  startDate: Scalars['String']['input'];
};


export type QueryGetStudentMainLessonsListArgs = {
  includeDraft?: InputMaybe<Scalars['Boolean']['input']>;
  semesterId?: InputMaybe<Scalars['String']['input']>;
  studentId: Scalars['ID']['input'];
};


export type QueryGetStudentsListArgs = {
  grade: Scalars['Int']['input'];
  group: Scalars['String']['input'];
};


export type QueryGetTeacherMainLessonsListArgs = {
  includeDraft?: InputMaybe<Scalars['Boolean']['input']>;
  semesterId?: InputMaybe<Scalars['String']['input']>;
  teacherId: Scalars['ID']['input'];
};


export type QueryGetTeachersListArgs = {
  grades?: InputMaybe<Array<Scalars['Int']['input']>>;
};


export type QueryListNewMathExamsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QuestionAnalysisResult = {
  __typename?: 'QuestionAnalysisResult';
  correctAnswer: Scalars['String']['output'];
  difficulty: Difficulty;
  explanation: Scalars['String']['output'];
  options?: Maybe<Array<Scalars['String']['output']>>;
  points: Scalars['Int']['output'];
  /** Bloom-ийн таксономи — Мэдлэг | Ойлгомж | Хэрэглээ | Шинжилгээ. */
  skillLevel?: Maybe<Scalars['String']['output']>;
  /** Эх сурвалжийн таамаглал (жишээ нь ЭЕШ, сурах бичиг). */
  source?: Maybe<Scalars['String']['output']>;
  suggestedType: QuestionAnalysisSuggestedType;
  tags: Array<Scalars['String']['output']>;
};

export enum QuestionAnalysisSuggestedType {
  FillIn = 'FILL_IN',
  FreeText = 'FREE_TEXT',
  Matching = 'MATCHING',
  Math = 'MATH',
  Mcq = 'MCQ'
}

export enum QuestionFormat {
  FillIn = 'FILL_IN',
  Matching = 'MATCHING',
  MultipleChoice = 'MULTIPLE_CHOICE',
  SingleChoice = 'SINGLE_CHOICE',
  Written = 'WRITTEN'
}

export type RequestExamSchedulePayload = {
  __typename?: 'RequestExamSchedulePayload';
  examId?: Maybe<Scalars['ID']['output']>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

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

/** ai-scheduler-school-event: сургуулийн эвент (D1 school_events) */
export type SchoolEvent = {
  __typename?: 'SchoolEvent';
  colorCode?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  endDate: Scalars['String']['output'];
  endPeriodId?: Maybe<Scalars['Int']['output']>;
  eventType: Scalars['String']['output'];
  groupIds: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isFullLock: Scalars['Boolean']['output'];
  isSchoolWide: Scalars['Boolean']['output'];
  priority: Scalars['Int']['output'];
  repeatPattern: Scalars['String']['output'];
  startDate: Scalars['String']['output'];
  startPeriodId?: Maybe<Scalars['Int']['output']>;
  targetType: Scalars['String']['output'];
  teacherIds: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  urgencyLevel: Scalars['String']['output'];
};

/** ai-scheduler-student: ангид харьяалагдах сурагч (minimal fields) */
export type Student = {
  __typename?: 'Student';
  firstName: Scalars['String']['output'];
  gradeLevel: Scalars['Int']['output'];
  groupId: Scalars['String']['output'];
  homeRoomNumber?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastName: Scalars['String']['output'];
  status: Scalars['String']['output'];
  studentCode: Scalars['String']['output'];
};

/** ai-scheduler-student: сурагчийн үндсэн хичээлийн хуваарь (class timetable) */
export type StudentMainLesson = {
  __typename?: 'StudentMainLesson';
  classroomId: Scalars['String']['output'];
  classroomRoomNumber: Scalars['String']['output'];
  dayOfWeek: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  gradeLevel: Scalars['Int']['output'];
  groupId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDraft: Scalars['Boolean']['output'];
  periodId: Scalars['Int']['output'];
  periodNumber: Scalars['Int']['output'];
  periodShift: Scalars['Int']['output'];
  semesterId: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  subjectId: Scalars['String']['output'];
  subjectName: Scalars['String']['output'];
  teacherId: Scalars['ID']['output'];
  teacherShortName?: Maybe<Scalars['String']['output']>;
};

export type Teacher = {
  __typename?: 'Teacher';
  department: Scalars['String']['output'];
  email?: Maybe<Scalars['String']['output']>;
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastName: Scalars['String']['output'];
  role: Scalars['String']['output'];
  shortName?: Maybe<Scalars['String']['output']>;
  teachingLevel: Scalars['String']['output'];
  workLoadLimit: Scalars['Int']['output'];
};

export type TeacherMainLesson = {
  __typename?: 'TeacherMainLesson';
  classroomId: Scalars['String']['output'];
  classroomRoomNumber: Scalars['String']['output'];
  dayOfWeek: Scalars['Int']['output'];
  endTime: Scalars['String']['output'];
  gradeLevel: Scalars['Int']['output'];
  groupId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDraft: Scalars['Boolean']['output'];
  periodId: Scalars['Int']['output'];
  periodNumber: Scalars['Int']['output'];
  periodShift: Scalars['Int']['output'];
  semesterId: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  subjectId: Scalars['String']['output'];
  subjectName: Scalars['String']['output'];
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
  AiExamTemplatePayload: ResolverTypeWrapper<AiExamTemplatePayload>;
  AiQuestionTemplateInput: AiQuestionTemplateInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CreateAiExamTemplateInput: CreateAiExamTemplateInput;
  Difficulty: Difficulty;
  DifficultyDistributionInput: DifficultyDistributionInput;
  DifficultyPointsInput: DifficultyPointsInput;
  EditableQuestionInput: EditableQuestionInput;
  ExamGenerationInput: ExamGenerationInput;
  ExamGenerationResult: ResolverTypeWrapper<ExamGenerationResult>;
  ExamSchedule: ResolverTypeWrapper<ExamSchedule>;
  ExamScheduleVariant: ResolverTypeWrapper<ExamScheduleVariant>;
  ExamStatus: ExamStatus;
  ExamType: ExamType;
  FormatDistributionInput: FormatDistributionInput;
  GenerateQuestionAnswerInput: GenerateQuestionAnswerInput;
  GenerateQuestionAnswerResult: ResolverTypeWrapper<GenerateQuestionAnswerResult>;
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
  QuestionAnalysisResult: ResolverTypeWrapper<QuestionAnalysisResult>;
  QuestionAnalysisSuggestedType: QuestionAnalysisSuggestedType;
  QuestionFormat: QuestionFormat;
  RequestExamSchedulePayload: ResolverTypeWrapper<RequestExamSchedulePayload>;
  SaveExamInput: SaveExamInput;
  SaveExamPayload: ResolverTypeWrapper<SaveExamPayload>;
  SaveNewMathExamInput: SaveNewMathExamInput;
  SaveNewMathExamPayload: ResolverTypeWrapper<SaveNewMathExamPayload>;
  SchoolEvent: ResolverTypeWrapper<SchoolEvent>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Student: ResolverTypeWrapper<Student>;
  StudentMainLesson: ResolverTypeWrapper<StudentMainLesson>;
  Teacher: ResolverTypeWrapper<Teacher>;
  TeacherMainLesson: ResolverTypeWrapper<TeacherMainLesson>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AiExamTemplatePayload: AiExamTemplatePayload;
  AiQuestionTemplateInput: AiQuestionTemplateInput;
  Boolean: Scalars['Boolean']['output'];
  CreateAiExamTemplateInput: CreateAiExamTemplateInput;
  DifficultyDistributionInput: DifficultyDistributionInput;
  DifficultyPointsInput: DifficultyPointsInput;
  EditableQuestionInput: EditableQuestionInput;
  ExamGenerationInput: ExamGenerationInput;
  ExamGenerationResult: ExamGenerationResult;
  ExamSchedule: ExamSchedule;
  ExamScheduleVariant: ExamScheduleVariant;
  FormatDistributionInput: FormatDistributionInput;
  GenerateQuestionAnswerInput: GenerateQuestionAnswerInput;
  GenerateQuestionAnswerResult: GenerateQuestionAnswerResult;
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
  QuestionAnalysisResult: QuestionAnalysisResult;
  RequestExamSchedulePayload: RequestExamSchedulePayload;
  SaveExamInput: SaveExamInput;
  SaveExamPayload: SaveExamPayload;
  SaveNewMathExamInput: SaveNewMathExamInput;
  SaveNewMathExamPayload: SaveNewMathExamPayload;
  SchoolEvent: SchoolEvent;
  String: Scalars['String']['output'];
  Student: Student;
  StudentMainLesson: StudentMainLesson;
  Teacher: Teacher;
  TeacherMainLesson: TeacherMainLesson;
}>;

export type AiExamTemplatePayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AiExamTemplatePayload'] = ResolversParentTypes['AiExamTemplatePayload']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  difficulty?: Resolver<ResolversTypes['Difficulty'], ParentType, ContextType>;
  templateId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalPoints?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type ExamGenerationResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExamGenerationResult'] = ResolversParentTypes['ExamGenerationResult']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  errorLog?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  questions?: Resolver<Array<ResolversTypes['GeneratedQuestion']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ExamStatus'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type ExamScheduleResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExamSchedule'] = ResolversParentTypes['ExamSchedule']> = ResolversObject<{
  aiReasoning?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  aiVariants?: Resolver<Array<ResolversTypes['ExamScheduleVariant']>, ParentType, ContextType>;
  classId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  roomId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  testId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type ExamScheduleVariantResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ExamScheduleVariant'] = ResolversParentTypes['ExamScheduleVariant']> = ResolversObject<{
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  reason?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  roomId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type GenerateQuestionAnswerResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['GenerateQuestionAnswerResult'] = ResolversParentTypes['GenerateQuestionAnswerResult']> = ResolversObject<{
  correctAnswer?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  difficulty?: Resolver<ResolversTypes['Difficulty'], ParentType, ContextType>;
  explanation?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  format?: Resolver<ResolversTypes['QuestionFormat'], ParentType, ContextType>;
  options?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  points?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  questionText?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
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
  analyzeQuestion?: Resolver<ResolversTypes['QuestionAnalysisResult'], ParentType, ContextType, RequireFields<MutationAnalyzeQuestionArgs, 'prompt'>>;
  approveAiExamSchedule?: Resolver<ResolversTypes['ExamSchedule'], ParentType, ContextType, RequireFields<MutationApproveAiExamScheduleArgs, 'examId' | 'variantId'>>;
  createAiExamTemplate?: Resolver<ResolversTypes['AiExamTemplatePayload'], ParentType, ContextType, RequireFields<MutationCreateAiExamTemplateArgs, 'input'>>;
  generateExamQuestions?: Resolver<ResolversTypes['ExamGenerationResult'], ParentType, ContextType, RequireFields<MutationGenerateExamQuestionsArgs, 'input'>>;
  generateQuestionAnswer?: Resolver<ResolversTypes['GenerateQuestionAnswerResult'], ParentType, ContextType, RequireFields<MutationGenerateQuestionAnswerArgs, 'input'>>;
  rejectAiExamScheduleVariant?: Resolver<ResolversTypes['ExamSchedule'], ParentType, ContextType, RequireFields<MutationRejectAiExamScheduleVariantArgs, 'examId' | 'variantId'>>;
  requestAiExamSchedule?: Resolver<ResolversTypes['RequestExamSchedulePayload'], ParentType, ContextType, RequireFields<MutationRequestAiExamScheduleArgs, 'classId' | 'preferredDate' | 'testId'>>;
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
  durationMinutes?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  examId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  getAiExamSchedule?: Resolver<Maybe<ResolversTypes['ExamSchedule']>, ParentType, ContextType, RequireFields<QueryGetAiExamScheduleArgs, 'examId'>>;
  getNewMathExam?: Resolver<Maybe<ResolversTypes['NewMathExam']>, ParentType, ContextType, RequireFields<QueryGetNewMathExamArgs, 'examId'>>;
  getSchoolEvents?: Resolver<Array<ResolversTypes['SchoolEvent']>, ParentType, ContextType, RequireFields<QueryGetSchoolEventsArgs, 'endDate' | 'startDate'>>;
  getStudentMainLessonsList?: Resolver<Array<ResolversTypes['StudentMainLesson']>, ParentType, ContextType, RequireFields<QueryGetStudentMainLessonsListArgs, 'includeDraft' | 'semesterId' | 'studentId'>>;
  getStudentsList?: Resolver<Array<ResolversTypes['Student']>, ParentType, ContextType, RequireFields<QueryGetStudentsListArgs, 'grade' | 'group'>>;
  getTeacherMainLessonsList?: Resolver<Array<ResolversTypes['TeacherMainLesson']>, ParentType, ContextType, RequireFields<QueryGetTeacherMainLessonsListArgs, 'includeDraft' | 'semesterId' | 'teacherId'>>;
  getTeachersList?: Resolver<Array<ResolversTypes['Teacher']>, ParentType, ContextType, RequireFields<QueryGetTeachersListArgs, 'grades'>>;
  listNewMathExams?: Resolver<Array<ResolversTypes['NewMathExamSummary']>, ParentType, ContextType, RequireFields<QueryListNewMathExamsArgs, 'limit'>>;
}>;

export type QuestionAnalysisResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['QuestionAnalysisResult'] = ResolversParentTypes['QuestionAnalysisResult']> = ResolversObject<{
  correctAnswer?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  difficulty?: Resolver<ResolversTypes['Difficulty'], ParentType, ContextType>;
  explanation?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  points?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  skillLevel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  suggestedType?: Resolver<ResolversTypes['QuestionAnalysisSuggestedType'], ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type RequestExamSchedulePayloadResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RequestExamSchedulePayload'] = ResolversParentTypes['RequestExamSchedulePayload']> = ResolversObject<{
  examId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
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

export type SchoolEventResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SchoolEvent'] = ResolversParentTypes['SchoolEvent']> = ResolversObject<{
  colorCode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  endDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endPeriodId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  eventType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  groupIds?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isFullLock?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isSchoolWide?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  priority?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  repeatPattern?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startPeriodId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  targetType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  teacherIds?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  urgencyLevel?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type StudentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Student'] = ResolversParentTypes['Student']> = ResolversObject<{
  firstName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  gradeLevel?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  groupId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  homeRoomNumber?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  studentCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type StudentMainLessonResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['StudentMainLesson'] = ResolversParentTypes['StudentMainLesson']> = ResolversObject<{
  classroomId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  classroomRoomNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  dayOfWeek?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  endTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  gradeLevel?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  groupId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isDraft?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  periodId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  periodNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  periodShift?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  semesterId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subjectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subjectName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  teacherId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  teacherShortName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type TeacherResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Teacher'] = ResolversParentTypes['Teacher']> = ResolversObject<{
  department?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  firstName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  shortName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  teachingLevel?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  workLoadLimit?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type TeacherMainLessonResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TeacherMainLesson'] = ResolversParentTypes['TeacherMainLesson']> = ResolversObject<{
  classroomId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  classroomRoomNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  dayOfWeek?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  endTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  gradeLevel?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  groupId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isDraft?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  periodId?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  periodNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  periodShift?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  semesterId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subjectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subjectName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  AiExamTemplatePayload?: AiExamTemplatePayloadResolvers<ContextType>;
  ExamGenerationResult?: ExamGenerationResultResolvers<ContextType>;
  ExamSchedule?: ExamScheduleResolvers<ContextType>;
  ExamScheduleVariant?: ExamScheduleVariantResolvers<ContextType>;
  GenerateQuestionAnswerResult?: GenerateQuestionAnswerResultResolvers<ContextType>;
  GeneratedQuestion?: GeneratedQuestionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NewMathExam?: NewMathExamResolvers<ContextType>;
  NewMathExamGeneratorMeta?: NewMathExamGeneratorMetaResolvers<ContextType>;
  NewMathExamQuestion?: NewMathExamQuestionResolvers<ContextType>;
  NewMathExamSessionMeta?: NewMathExamSessionMetaResolvers<ContextType>;
  NewMathExamSummary?: NewMathExamSummaryResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QuestionAnalysisResult?: QuestionAnalysisResultResolvers<ContextType>;
  RequestExamSchedulePayload?: RequestExamSchedulePayloadResolvers<ContextType>;
  SaveExamPayload?: SaveExamPayloadResolvers<ContextType>;
  SaveNewMathExamPayload?: SaveNewMathExamPayloadResolvers<ContextType>;
  SchoolEvent?: SchoolEventResolvers<ContextType>;
  Student?: StudentResolvers<ContextType>;
  StudentMainLesson?: StudentMainLessonResolvers<ContextType>;
  Teacher?: TeacherResolvers<ContextType>;
  TeacherMainLesson?: TeacherMainLessonResolvers<ContextType>;
}>;

