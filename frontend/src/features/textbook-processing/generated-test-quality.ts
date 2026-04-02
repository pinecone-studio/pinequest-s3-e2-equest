import type {
  GeneratedTextbookOpenTask,
  GeneratedTextbookQuestion,
  GeneratedTextbookTest,
} from "@/app/test/material-builder/_components/textbook-material-data";
import {
  cleanTextbookSourceProblemText,
  type CleanedGenerationSource,
} from "./generation-source-cleaner";
import { normalizeReadableProblemText } from "./readable-problem-patterns";
import { toStudentFacingProblemPrompt } from "./student-facing-problem";

type SanitizeGeneratedTestInput = {
  generationSource: CleanedGenerationSource;
  test: GeneratedTextbookTest;
};

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;
const GENERIC_PROMPTS = new Set([
  "энэ бодлогыг бодоод зөв хариуг сонго.",
  "сонголтот асуулт",
]);
const META_PHRASES = [
  "сонгосон хэсэг",
  "дараах мөрөөс",
  "эх хэсэг",
  "source",
  "page ",
];

function normalizeSpace(value: string) {
  return normalizeReadableProblemText(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string) {
  return normalizeSpace(value).toLowerCase();
}

function stripChoicePrefix(value: string) {
  return String(value || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:\-–]|\s+)\s*/iu, "")
    .trim();
}

function formatChoice(value: string, index: number) {
  const label = CHOICE_LABELS[index] || "A";
  return `${label}. ${stripChoicePrefix(value) || `Сонголт ${label}`}`;
}

function cleanStudentFacingText(value: string, maxLength = 220) {
  const normalized = toStudentFacingProblemPrompt(
    normalizeSpace(value)
      .replace(/^\[?\s*page\s*\d+\s*\]?\s*/iu, "")
      .replace(/[ ]+([,.;:!?])/g, "$1")
      .trim(),
  ) || normalizeSpace(value)
    .replace(/^\[?\s*page\s*\d+\s*\]?\s*/iu, "")
    .replace(/[ ]+([,.;:!?])/g, "$1")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : normalized;
}

function isGenericPrompt(value: string) {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return true;
  }

  return (
    GENERIC_PROMPTS.has(normalized) ||
    META_PHRASES.some((phrase) => normalized.includes(phrase))
  );
}

function deriveStudentPrompt(question: GeneratedTextbookQuestion) {
  const prompt = cleanStudentFacingText(question.question, 200);
  const bookProblem = cleanTextbookSourceProblemText(question.bookProblem, 200);

  if (!prompt || isGenericPrompt(prompt)) {
    return bookProblem || prompt;
  }

  return prompt;
}

function deriveCorrectChoiceIndex(question: GeneratedTextbookQuestion, choiceBodies: string[]) {
  const directLabel = String(question.correctAnswer || "")
    .trim()
    .toUpperCase();
  if (/^[A-D]$/.test(directLabel)) {
    const labelIndex = CHOICE_LABELS.indexOf(directLabel as (typeof CHOICE_LABELS)[number]);
    const originalChoice = stripChoicePrefix(question.choices[labelIndex] || "");
    const normalizedOriginal = normalizeKey(originalChoice);
    const foundIndex = choiceBodies.findIndex((choice) => normalizeKey(choice) === normalizedOriginal);
    if (foundIndex >= 0) {
      return foundIndex;
    }
  }

  const strippedAnswer = normalizeKey(stripChoicePrefix(question.correctAnswer || ""));
  if (strippedAnswer) {
    const foundIndex = choiceBodies.findIndex((choice) => normalizeKey(choice) === strippedAnswer);
    if (foundIndex >= 0) {
      return foundIndex;
    }
  }

  return 0;
}

function scoreQuestionClarity(question: GeneratedTextbookQuestion) {
  const prompt = deriveStudentPrompt(question);
  const choiceBodies = question.choices
    .map((choice) => cleanStudentFacingText(stripChoicePrefix(choice), 80))
    .filter(Boolean);
  const uniqueChoiceCount = new Set(choiceBodies.map((choice) => normalizeKey(choice))).size;
  let score = 0;

  if (prompt.length >= 10 && prompt.length <= 180) score += 5;
  if (!isGenericPrompt(prompt)) score += 4;
  if (uniqueChoiceCount === 4) score += 4;
  if (choiceBodies.every((choice) => choice.length <= 50)) score += 2;
  if (question.explanation && cleanStudentFacingText(question.explanation, 220)) score += 2;
  if (META_PHRASES.some((phrase) => normalizeKey(prompt).includes(phrase))) score -= 5;
  if (/([^\p{L}\p{N}\s])\1{2,}/u.test(prompt)) score -= 4;
  if (prompt.length > 220) score -= 5;

  return score;
}

function sanitizeMcqQuestion(
  question: GeneratedTextbookQuestion,
): GeneratedTextbookQuestion | null {
  const prompt = deriveStudentPrompt(question);
  const bookProblem = cleanTextbookSourceProblemText(
    question.bookProblem || question.question,
    220,
  );
  const choiceBodies = question.choices
    .map((choice) => cleanStudentFacingText(stripChoicePrefix(choice), 80))
    .filter(Boolean)
    .filter(
      (choice, index, items) =>
        items.findIndex((item) => normalizeKey(item) === normalizeKey(choice)) === index,
    );

  if (!prompt || choiceBodies.length < 4) {
    return null;
  }

  const correctIndex = deriveCorrectChoiceIndex(question, choiceBodies);
  const explanation = cleanStudentFacingText(question.explanation, 220);

  return {
    ...question,
    bookProblem: bookProblem || prompt,
    choices: choiceBodies.slice(0, 4).map((choice, index) => formatChoice(choice, index)),
    correctAnswer: CHOICE_LABELS[correctIndex] || "A",
    explanation,
    question: prompt,
  } satisfies GeneratedTextbookQuestion;
}

function sanitizeOpenTask(task: GeneratedTextbookOpenTask): GeneratedTextbookOpenTask | null {
  const prompt = cleanStudentFacingText(task.prompt, 220);
  if (!prompt) {
    return null;
  }

  return {
    ...task,
    answer: cleanStudentFacingText(task.answer, 220),
    prompt,
    sourceExcerpt: cleanStudentFacingText(task.sourceExcerpt || task.prompt, 220),
  };
}

function dedupeMcqQuestions(items: GeneratedTextbookQuestion[]) {
  const out: GeneratedTextbookQuestion[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = normalizeKey(item.question || item.bookProblem);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }

  return out;
}

function dedupeOpenTasks(items: GeneratedTextbookOpenTask[]) {
  const out: GeneratedTextbookOpenTask[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = normalizeKey(item.prompt || item.sourceExcerpt);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }

  return out;
}

function uniqueWarnings(items: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const value = normalizeSpace(item);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }

  return out;
}

export function sanitizeGeneratedTextbookTest({
  generationSource,
  test,
}: SanitizeGeneratedTestInput): GeneratedTextbookTest {
  const sanitizedQuestionCandidates = test.questions
    .map((question) => sanitizeMcqQuestion(question))
    .filter((question): question is GeneratedTextbookQuestion => Boolean(question))
    .sort((left, right) => scoreQuestionClarity(right) - scoreQuestionClarity(left));
  const highQualityQuestions = sanitizedQuestionCandidates.filter(
    (question) => scoreQuestionClarity(question) >= 6,
  );
  const sanitizedQuestions = dedupeMcqQuestions(
    (highQualityQuestions.length > 0 ? highQualityQuestions : sanitizedQuestionCandidates).slice(
      0,
      generationSource.preferredQuestionCount,
    ),
  );

  const sanitizedOpenTasks = dedupeOpenTasks(
    test.openQuestions
      .map((task) => sanitizeOpenTask(task))
      .filter((task): task is GeneratedTextbookOpenTask => Boolean(task))
      .slice(0, generationSource.preferredOpenQuestionCount),
  );

  const droppedQuestions = Math.max(0, test.questions.length - sanitizedQuestions.length);
  const droppedOpenTasks = Math.max(0, test.openQuestions.length - sanitizedOpenTasks.length);

  return {
    ...test,
    openQuestionCountGenerated: sanitizedOpenTasks.length,
    openQuestions: sanitizedOpenTasks,
    questionCountGenerated: sanitizedQuestions.length,
    questions: sanitizedQuestions,
    sourcePages: Array.from(
      new Set([
        ...test.sourcePages,
        ...generationSource.sourceProblems.map((item) => item.pageNumber),
        ...generationSource.visiblePages.map((item) => item.pageNumber),
      ]),
    ).sort((left, right) => left - right),
    warnings: uniqueWarnings([
      ...generationSource.warnings,
      ...test.warnings,
      droppedQuestions > 0
        ? `${droppedQuestions} ойлгомж муутай сонголтот асуултыг quality filter-ээр хаслаа.`
        : "",
      droppedOpenTasks > 0
        ? `${droppedOpenTasks} ойлгомж муутай задгай даалгаврыг quality filter-ээр хаслаа.`
        : "",
    ]),
  };
}
