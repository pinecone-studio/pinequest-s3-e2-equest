import type {
  PreviewQuestion,
  PreviewQuestionSourceType,
} from "./material-builder-types";

function resolvePreviewQuestionSourceType(
  question: PreviewQuestion,
): PreviewQuestionSourceType {
  if (question.sourceType) {
    return question.sourceType;
  }

  if (question.source === "Гараар") {
    return "question-bank";
  }

  if (/\.(pdf|doc|docx|xls|xlsx)$/i.test(question.source)) {
    return "import";
  }

  return "shared-library";
}

function reindexQuestions(questions: PreviewQuestion[]) {
  return questions.map((question, index) => ({
    ...question,
    index: index + 1,
  }));
}

export function mergeTextbookQuestionsIntoPreview(args: {
  previewQuestions: PreviewQuestion[];
  textbookQuestions: PreviewQuestion[];
  idPrefix?: string;
}) {
  const nonTextbookQuestions = args.previewQuestions.filter(
    (question) => resolvePreviewQuestionSourceType(question) !== "textbook",
  );
  const textbookIdPrefix = args.idPrefix || `textbook-${Date.now()}`;

  return reindexQuestions([
    ...args.textbookQuestions.map((question, index) => ({
      ...question,
      id: `${textbookIdPrefix}-${index + 1}`,
    })),
    ...nonTextbookQuestions,
  ]);
}
