import type {
  DifficultyLevel,
  GeneratedExamPayload,
  QuestionType,
} from "@/lib/math-exam-contract";
import {
  normalizeBackendLatexOnly,
  normalizeBackendMathText,
} from "@/lib/normalize-math-text";

export type BaseQuestion = {
  id: string;
  imageAlt: string;
  imageDataUrl?: string;
  points: number;
  prompt: string;
  type: QuestionType;
};

export type McqQuestion = BaseQuestion & {
  correctOption: number | null;
  options: string[];
  type: "mcq";
};

export type MathQuestion = BaseQuestion & {
  answerLatex: string;
  responseGuide: string;
  type: "math";
};

export type ExamQuestion = McqQuestion | MathQuestion;

export type QuestionSectionState = {
  math: boolean;
  mcq: boolean;
};

export type GeneratorSettings = {
  difficulty: DifficultyLevel;
  mathCount: number;
  mcqCount: number;
  sourceContext: string;
  totalPoints: number;
  topics: string;
};

export type EditorQuestionItem = {
  displayIndex: number;
  question: ExamQuestion;
};

let questionSequence = 0;

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  advanced: "Ахисан",
  easy: "Амархан",
  medium: "Дунд",
};

export function createDefaultSectionState(): QuestionSectionState {
  return {
    math: true,
    mcq: true,
  };
}

export function createDefaultGeneratorSettings(): GeneratorSettings {
  return {
    difficulty: "medium",
    mathCount: 2,
    mcqCount: 4,
    sourceContext: "",
    totalPoints: 20,
    topics: "Квадрат функц, тэгшитгэл, илэрхийлэл хялбарчлах",
  };
}

function nextQuestionId() {
  questionSequence += 1;
  return `question-${questionSequence}`;
}

export function createMcqQuestion(
  overrides?: Partial<McqQuestion>,
): McqQuestion {
  return {
    id: overrides?.id ?? nextQuestionId(),
    imageAlt: overrides?.imageAlt ?? "",
    imageDataUrl: overrides?.imageDataUrl,
    type: "mcq",
    prompt: overrides?.prompt ?? "",
    points: overrides?.points ?? 1,
    options: overrides?.options ?? [
      "Сонголт A",
      "Сонголт B",
      "Сонголт C",
      "Сонголт D",
    ],
    correctOption: overrides?.correctOption ?? null,
  };
}

export function createMathQuestion(
  overrides?: Partial<MathQuestion>,
): MathQuestion {
  return {
    id: overrides?.id ?? nextQuestionId(),
    imageAlt: overrides?.imageAlt ?? "",
    imageDataUrl: overrides?.imageDataUrl,
    type: "math",
    prompt: overrides?.prompt ?? "",
    points: overrides?.points ?? 2,
    answerLatex: overrides?.answerLatex ?? "",
    responseGuide:
      overrides?.responseGuide ?? "Бодолтын бүх алхмаа тодорхой бичнэ үү.",
  };
}

export function createQuestion(type: QuestionType): ExamQuestion {
  return type === "mcq" ? createMcqQuestion() : createMathQuestion();
}

export function buildQuestionLabel(type: QuestionType) {
  return type === "mcq" ? "Тест" : "Задгай даалгавар";
}

export function coercePoints(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function splitPromptAndPoints(rawPrompt: string, fallbackPoints: number) {
  const trimmedPrompt = rawPrompt.trim();
  const trailingPointsMatch = trimmedPrompt.match(
    /\s*(?:[/(\[]\s*)?(\d+)\s*оноо\s*(?:[/)\]])?\s*$/iu,
  );

  if (!trailingPointsMatch || trailingPointsMatch.index === undefined) {
    return {
      points: fallbackPoints,
      prompt: trimmedPrompt,
    };
  }

  const parsedPoints = Number.parseInt(trailingPointsMatch[1] ?? "", 10);
  const nextPrompt = trimmedPrompt
    .slice(0, trailingPointsMatch.index)
    .replace(/[/(\[\s]+$/u, "")
    .trim();

  return {
    points:
      Number.isNaN(parsedPoints) || parsedPoints < 1
        ? fallbackPoints
        : parsedPoints,
    prompt: nextPrompt || trimmedPrompt,
  };
}

function distributePoints(totalPoints: number, questionCount: number) {
  if (questionCount <= 0) {
    return [];
  }

  const safeTotal = Math.max(totalPoints, questionCount);
  const base = Math.floor(safeTotal / questionCount);
  const remainder = safeTotal % questionCount;

  return Array.from(
    { length: questionCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

export function normalizeGeneratedQuestions(
  payload: GeneratedExamPayload,
  settings: {
    mathCount: number;
    mcqCount: number;
    totalPoints: number;
  },
) {
  const rawQuestions = Array.isArray(payload.questions)
    ? payload.questions
    : [];
  const normalizedMcq = rawQuestions
    .filter((question) => question.type === "mcq")
    .slice(0, settings.mcqCount)
    .map((question) => {
      const { points, prompt } = splitPromptAndPoints(
        normalizeBackendMathText(question.prompt?.trim() ?? ""),
        typeof question.points === "number" && question.points > 0
          ? question.points
          : 1,
      );

      return createMcqQuestion({
        correctOption:
          typeof question.correctOption === "number"
            ? question.correctOption
            : null,
        imageAlt: question.imageAlt?.trim() ?? "",
        imageDataUrl: undefined,
        options:
          question.options?.length && question.options.length >= 2
            ? question.options.slice(0, 6).map((opt) => normalizeBackendMathText(opt))
            : undefined,
        points,
        prompt,
      });
    });

  const normalizedMath = rawQuestions
    .filter((question) => question.type === "math")
    .slice(0, settings.mathCount)
    .map((question) => {
      const { points, prompt } = splitPromptAndPoints(
        normalizeBackendMathText(question.prompt?.trim() ?? ""),
        typeof question.points === "number" && question.points > 0
          ? question.points
          : 1,
      );

      return createMathQuestion({
        answerLatex: normalizeBackendLatexOnly(question.answerLatex?.trim() ?? ""),
        imageAlt: question.imageAlt?.trim() ?? "",
        imageDataUrl: undefined,
        points,
        prompt,
        responseGuide:
          normalizeBackendMathText(
            question.responseGuide?.trim() ??
              "Бодолтын бүх алхмаа тодорхой бичнэ үү.",
          ),
      });
    });

  while (normalizedMcq.length < settings.mcqCount) {
    normalizedMcq.push(createMcqQuestion());
  }

  while (normalizedMath.length < settings.mathCount) {
    normalizedMath.push(createMathQuestion());
  }

  const combinedQuestions = [...normalizedMcq, ...normalizedMath];
  const pointPlan = distributePoints(
    settings.totalPoints,
    combinedQuestions.length,
  );

  return combinedQuestions.map((question, index) => ({
    ...question,
    points: pointPlan[index] ?? question.points,
  }));
}

export function normalizeImportedQuestions(
  payload: GeneratedExamPayload,
  sourceImagesByName: Record<string, string> = {},
) {
  const rawQuestions = Array.isArray(payload.questions)
    ? payload.questions
    : [];

  return rawQuestions
    .filter((question) => question.type === "mcq" || question.type === "math")
    .map((question) => {
      const { points, prompt } = splitPromptAndPoints(
        normalizeBackendMathText(question.prompt?.trim() ?? ""),
        typeof question.points === "number" && question.points > 0
          ? question.points
          : question.type === "math"
            ? 2
            : 1,
      );

      if (question.type === "mcq") {
        return createMcqQuestion({
          correctOption:
            typeof question.correctOption === "number"
              ? question.correctOption
              : null,
          imageAlt: question.imageAlt?.trim() ?? "",
          imageDataUrl: question.sourceImageName
            ? sourceImagesByName[question.sourceImageName]
            : undefined,
          options:
            question.options?.length && question.options.length >= 2
              ? question.options
                  .slice(0, 6)
                  .map((opt) => normalizeBackendMathText(opt))
              : undefined,
          points,
          prompt,
        });
      }

      return createMathQuestion({
        answerLatex: normalizeBackendLatexOnly(question.answerLatex?.trim() ?? ""),
        imageAlt: question.imageAlt?.trim() ?? "",
        imageDataUrl: question.sourceImageName
          ? sourceImagesByName[question.sourceImageName]
          : undefined,
        points,
        prompt,
        responseGuide:
          normalizeBackendMathText(
            question.responseGuide?.trim() ??
              "Бодолтын бүх алхмаа тодорхой бичнэ үү.",
          ),
      });
    });
}

export function getQuestionCollections(questions: ExamQuestion[]) {
  const mcqQuestions = questions.filter((question) => question.type === "mcq");
  const mathQuestions = questions.filter((question) => question.type === "math");

  return {
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
    mathCount: mathQuestions.length,
    mathEditorQuestions: questions
      .map((question, index) => ({
        displayIndex: index,
        question,
      }))
      .filter(({ question }) => question.type === "math"),
    mathQuestions,
    mcqCount: mcqQuestions.length,
    mcqEditorQuestions: questions
      .map((question, index) => ({
        displayIndex: index,
        question,
      }))
      .filter(({ question }) => question.type === "mcq"),
    mcqQuestions,
  };
}
