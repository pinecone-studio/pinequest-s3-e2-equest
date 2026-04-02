export type PreviewQuestionSourceType =
  | "question-bank"
  | "textbook"
  | "import"
  | "shared-library";

export type PreviewQuestion = {
  answers: string[];
  correct: number;
  explanation?: string;
  id: string;
  index: number;
  points: number;
  question: string;
  questionType: "single-choice" | "written";
  source: string;
  sourceType?: PreviewQuestionSourceType;
};
