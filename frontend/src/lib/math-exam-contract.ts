export type QuestionType = "mcq" | "math";

export type DifficultyLevel = "easy" | "medium" | "advanced";
export type ExtractExamEnhanceFocus =
  | "all"
  | "images"
  | "incomplete"
  | "math";
export type ExtractExamMode = "enhance" | "fast";

export type GeneratedExamQuestionPayload = {
  answerLatex?: string;
  correctOption?: number | null;
  imageAlt?: string;
  options?: string[];
  points?: number;
  prompt?: string;
  responseGuide?: string;
  sourceImageName?: string;
  type?: QuestionType;
};

export type GeneratedExamSourceImagePayload = {
  alt?: string;
  dataUrl?: string;
  mimeType?: string;
  name: string;
};

export type GeneratedExamPayload = {
  sourceImages?: GeneratedExamSourceImagePayload[];
  title?: string;
  questions?: GeneratedExamQuestionPayload[];
};

export type UploadAttachmentPayload = {
  data?: string;
  mimeType: string;
  name: string;
  text?: string;
};

export type GenerateExamRequest = {
  attachments?: UploadAttachmentPayload[];
  difficulty?: DifficultyLevel;
  mathCount?: number;
  mcqCount?: number;
  sourceContext?: string;
  topics?: string;
  totalPoints?: number;
};

export type ExtractExamRequest = {
  attachments?: UploadAttachmentPayload[];
  enhanceFocus?: ExtractExamEnhanceFocus;
  mode?: ExtractExamMode;
};

export type ExamApiResponse = {
  error?: string;
  exam?: GeneratedExamPayload;
};
