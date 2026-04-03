import type {
  GeneratedTextbookQuestion,
  GeneratedTextbookTest,
} from "./textbook-material-data";
import type { PreviewQuestion } from "./material-builder-types";

const GENERIC_MCQ_PROMPTS = new Set([
  "",
  "Зөв хариултыг сонгоно уу.",
  "Энэ бодлогыг бодоод зөв хариуг сонго.",
]);

function stripChoiceLabel(value: string) {
  return String(value || "")
    .replace(/^[A-Z]\.\s*/i, "")
    .trim();
}

function normalizeBookProblemText(value: string) {
  return String(value || "")
    .replace(/\s*\[mock-\d+\]\s*$/i, "")
    .replace(/^(?:[\p{L}\d]{1,3})(?:\)|\.|:|-)\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveMcqPrompt(question: GeneratedTextbookQuestion) {
  const rawPrompt = String(question.question || "").trim();
  const normalizedProblem = normalizeBookProblemText(question.bookProblem);
  const shouldUseProblemText =
    normalizedProblem &&
    (GENERIC_MCQ_PROMPTS.has(rawPrompt) ||
      rawPrompt.toLowerCase().startsWith("mock нөхөлт"));

  if (!shouldUseProblemText) {
    return rawPrompt || normalizedProblem || "Зөв хариултыг сонгоно уу.";
  }

  if (/[xXхХ]/.test(normalizedProblem) && normalizedProblem.includes("=")) {
    return `Дараах тэгшитгэлийн шийдийг ол.\n${normalizedProblem}`;
  }

  if (/[0-9]/.test(normalizedProblem) && /[+\-*/√|]/.test(normalizedProblem)) {
    return `Дараах илэрхийллийг бодоод зөв хариуг сонго.\n${normalizedProblem}`;
  }

  return `Дараах бодлогын зөв хариуг сонго.\n${normalizedProblem}`;
}

function resolveCorrectChoiceIndex(
  choices: string[],
  correctAnswer: string,
) {
  const normalizedCorrectAnswer = String(correctAnswer || "").trim().toUpperCase();
  const prefixedIndex = choices.findIndex((choice) =>
    choice.trim().toUpperCase().startsWith(`${normalizedCorrectAnswer}.`),
  );

  if (prefixedIndex >= 0) {
    return prefixedIndex;
  }

  const strippedCorrectAnswer = stripChoiceLabel(correctAnswer);
  const strippedIndex = choices.findIndex(
    (choice) => stripChoiceLabel(choice) === strippedCorrectAnswer,
  );

  return strippedIndex >= 0 ? strippedIndex : 0;
}

export function mapGeneratedTextbookTestToPreviewQuestions(input: {
  bookTitle: string;
  generatedTest: GeneratedTextbookTest;
}): PreviewQuestion[] {
  const source = input.bookTitle.trim() || "Сурах бичиг";

  const mcqQuestions: PreviewQuestion[] = input.generatedTest.questions.map(
    (question) => ({
      answers: question.choices.map(stripChoiceLabel),
      correct: resolveCorrectChoiceIndex(
        question.choices,
        question.correctAnswer,
      ),
      id: question.id,
      index: 0,
      explanation: question.explanation?.trim() || undefined,
      points: question.points,
      question: resolveMcqPrompt(question),
      questionType: "single-choice",
      source,
      sourceType: "textbook",
    }),
  );

  const writtenQuestions: PreviewQuestion[] = input.generatedTest.openQuestions.map(
    (question) => ({
      answers: [question.answer || ""],
      correct: 0,
      explanation: question.sourceExcerpt || undefined,
      id: question.id,
      index: 0,
      points: question.score,
      question: question.prompt,
      questionType: "written",
      source,
      sourceType: "textbook",
    }),
  );

  return [...mcqQuestions, ...writtenQuestions].map((question, index) => ({
    ...question,
    index: index + 1,
  }));
}
