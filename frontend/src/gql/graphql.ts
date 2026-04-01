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
