import type {
  GeneratedTextbookOpenTask,
  GeneratedTextbookQuestion,
  GeneratedTextbookTest,
  TextbookDifficulty,
  TextbookSourceProblem,
} from "@/app/test/material-builder/_components/textbook-material-data";
import {
  looksReadableMathWordProblem,
  normalizeReadableProblemText,
  replaceFirstReadableTokenWithBlank,
  trySolveReadableMathProblem,
} from "./readable-problem-patterns";

type VisiblePage = {
  content: string;
  pageNumber: number;
};

type EnsureGeneratedTestShapeInput = {
  requestedOpenQuestionCount: number;
  requestedQuestionCount: number;
  requestedTotalScore: number;
  sourceProblems: TextbookSourceProblem[];
  test: GeneratedTextbookTest;
  visiblePages: VisiblePage[];
};

type MockSourceSeed = {
  pageNumber: number;
  text: string;
};

const GENERIC_WORD_DISTRACTORS = [
  "магадлал",
  "функц",
  "вектор",
  "координат",
  "өнцөг",
  "периметр",
  "талбай",
  "параллель",
];

const MOCK_STOP_WORDS = new Set([
  "аль",
  "ба",
  "бай",
  "байна",
  "байх",
  "бол",
  "болно",
  "бодолт",
  "бодлого",
  "бод",
  "бүлэг",
  "гэсэн",
  "гэж",
  "даалгавар",
  "дараах",
  "дээр",
  "дээрх",
  "доорх",
  "жишээ",
  "зөв",
  "мөн",
  "ол",
  "олоорой",
  "олно",
  "сонго",
  "сэдэв",
  "тэнцүү",
  "тул",
  "утга",
  "утгыг",
  "хариу",
  "хийнэ",
  "шийд",
  "шийдье",
  "энэ",
  "өөр",
]);

function normalizeTokenKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, ".");
}

function normalizeLine(value: string, maxLength = 220) {
  const normalized = normalizeReadableProblemText(String(value || ""))
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\s*[\).:\-–]\s*/u, "")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

function uniquePageNumbers(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isFinite(value) && value >= 1),
    ),
  ).sort((left, right) => left - right);
}

function extractCandidateTokens(sourceText: string) {
  const text = normalizeLine(sourceText, 400);
  if (!text) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (candidate: string) => {
    const value = String(candidate || "").trim();
    const key = normalizeTokenKey(value);
    if (!value || !key || seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(value);
  };

  for (const token of text.match(/[+\-]?\d+(?:[.,]\d+)?/g) || []) {
    push(token);
  }

  for (const token of text.match(/\b[xyzabXYZABхХуУ]\b/gu) || []) {
    push(token);
  }

  for (const token of text.match(/[\p{L}]{4,18}/gu) || []) {
    if (MOCK_STOP_WORDS.has(token.toLowerCase())) {
      continue;
    }
    push(token);
  }

  return out.slice(0, 8);
}

function buildSourceSeeds(
  sourceProblems: TextbookSourceProblem[],
  visiblePages: VisiblePage[],
) {
  const out: MockSourceSeed[] = [];
  const seen = new Set<string>();

  for (const item of sourceProblems) {
    const text = normalizeLine(item.text);
    const key = `${item.pageNumber}:${text}`;
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      pageNumber: Math.max(1, Math.trunc(Number(item.pageNumber) || 0)),
      text,
    });
  }

  for (const page of visiblePages) {
    const text = normalizeLine(page.content);
    const key = `${page.pageNumber}:${text}`;
    if (!text || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      pageNumber: Math.max(1, Math.trunc(Number(page.pageNumber) || 0)),
      text,
    });
  }

  if (out.length > 0) {
    return out;
  }

  return [
    {
      pageNumber: 1,
      text: "Сонгосон хэсгийн текстэн мэдээлэлд тулгуурласан mock асуулт.",
    },
  ];
}

function collectTokenPool(seeds: MockSourceSeed[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    for (const token of extractCandidateTokens(seed.text)) {
      const key = normalizeTokenKey(token);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(token);
    }
  }

  return out;
}

function rotateChoices(values: string[], shift: number) {
  if (values.length <= 1) {
    return values;
  }

  const normalizedShift = ((shift % values.length) + values.length) % values.length;
  return values
    .slice(normalizedShift)
    .concat(values.slice(0, normalizedShift));
}

function buildDistractors(correctToken: string, tokenPool: string[], pageNumber: number) {
  const normalizedCorrect = normalizeTokenKey(correctToken);
  const out: string[] = [];
  const seen = new Set([normalizedCorrect]);

  const push = (candidate: string) => {
    const value = String(candidate || "").trim();
    const key = normalizeTokenKey(value);
    if (!value || !key || seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(value);
  };

  const numericValue = Number(correctToken.replace(",", "."));
  if (/^[-+]?\d+(?:[.,]\d+)?$/.test(correctToken) && Number.isFinite(numericValue)) {
    for (const candidate of [
      numericValue + 1,
      numericValue - 1,
      numericValue + 2,
      numericValue - 2,
      numericValue + 5,
    ]) {
      push(String(candidate));
      if (out.length >= 3) {
        return out.slice(0, 3);
      }
    }
  }

  if (/^[xyzabхХуУ]$/u.test(correctToken)) {
    for (const candidate of ["x", "y", "z", "a", "b", "х", "у"]) {
      push(candidate);
      if (out.length >= 3) {
        return out.slice(0, 3);
      }
    }
  }

  for (const candidate of tokenPool) {
    push(candidate);
    if (out.length >= 3) {
      return out.slice(0, 3);
    }
  }

  for (const candidate of GENERIC_WORD_DISTRACTORS) {
    push(candidate);
    if (out.length >= 3) {
      return out.slice(0, 3);
    }
  }

  for (const candidate of [String(pageNumber), String(pageNumber + 1), String(pageNumber + 2)]) {
    push(candidate);
    if (out.length >= 3) {
      return out.slice(0, 3);
    }
  }

  return out.slice(0, 3);
}

function countDifficulties(
  items: Array<{ difficulty: TextbookDifficulty }>,
) {
  return items.reduce(
    (accumulator, item) => {
      accumulator[item.difficulty] += 1;
      return accumulator;
    },
    { easy: 0, medium: 0, hard: 0 },
  );
}

function pickNextDifficulty(
  currentCounts: { easy: number; medium: number; hard: number },
  targetCounts: { easy: number; medium: number; hard: number },
): TextbookDifficulty {
  const priorities: TextbookDifficulty[] = ["hard", "medium", "easy"];
  let best: TextbookDifficulty = "medium";
  let bestGap = Number.NEGATIVE_INFINITY;

  for (const difficulty of priorities) {
    const gap = Number(targetCounts[difficulty] || 0) - Number(currentCounts[difficulty] || 0);
    if (gap > bestGap) {
      bestGap = gap;
      best = difficulty;
    }
  }

  return bestGap > 0 ? best : "medium";
}

function buildMockQuestionPrompt(seed: MockSourceSeed, correctToken: string) {
  const normalizedSeed = normalizeReadableProblemText(seed.text);
  const directProblem = trySolveReadableMathProblem(normalizedSeed);
  if (directProblem) {
    return directProblem.prompt;
  }

  const blanked = replaceFirstReadableTokenWithBlank(normalizedSeed, correctToken);
  if (blanked && blanked !== normalizedSeed) {
    return `Хоосон зайг зөв нөхөж бөглөнө үү.\n${blanked}`;
  }

  if (looksReadableMathWordProblem(normalizedSeed)) {
    return normalizedSeed;
  }

  return `Дараах бодлоготой холбоотой зөв өгөгдлийг сонгоно уу.\n${normalizedSeed}`;
}

function buildMockMcqQuestions(
  existingQuestions: GeneratedTextbookQuestion[],
  targetCount: number,
  targetDifficulties: { easy: number; medium: number; hard: number },
  sourceProblems: TextbookSourceProblem[],
  visiblePages: VisiblePage[],
) {
  const seeds = buildSourceSeeds(sourceProblems, visiblePages);
  const tokenPool = collectTokenPool(seeds);
  const questions = existingQuestions.slice(0, targetCount);
  const questionKeys = new Set(
    questions.map((question) => `${normalizeLine(question.bookProblem)}::${question.correctAnswer}`),
  );

  let safety = 0;
  while (questions.length < targetCount && safety < Math.max(40, targetCount * 12)) {
    const seed = seeds[safety % seeds.length] || seeds[0];
    const solvedPattern = trySolveReadableMathProblem(seed.text);
    const questionKey = `${seed.pageNumber}:${seed.text}`;
    if (solvedPattern) {
      if (questionKeys.has(`${questionKey}:pattern`)) {
        safety += 1;
        continue;
      }

      const correctToken = String(solvedPattern.answer);
      const distractors = buildDistractors(correctToken, tokenPool, seed.pageNumber);
      if (distractors.length < 3) {
        safety += 1;
        continue;
      }

      const rawChoices = rotateChoices([correctToken, ...distractors.slice(0, 3)], safety);
      const correctIndex = rawChoices.findIndex(
        (choice) => normalizeTokenKey(choice) === normalizeTokenKey(correctToken),
      );
      const labels = ["A", "B", "C", "D"];
      const currentCounts = countDifficulties(questions);
      const difficulty = pickNextDifficulty(currentCounts, targetDifficulties);

      questions.push({
        id: `mcq-mock-${questions.length + 1}`,
        kind: "mcq",
        question: solvedPattern.prompt,
        choices: rawChoices.map((choice, index) => `${labels[index]}. ${choice}`),
        correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
        difficulty,
        explanation: solvedPattern.explanation,
        points: 1,
        sourcePages: [seed.pageNumber],
        bookProblem: normalizeReadableProblemText(seed.text),
      });
      questionKeys.add(`${questionKey}:pattern`);
      safety += 1;
      continue;
    }

    const candidateTokens = extractCandidateTokens(seed.text);
    const correctToken =
      candidateTokens[safety % Math.max(1, candidateTokens.length)] ||
      String(seed.pageNumber);
    const distractors = buildDistractors(correctToken, tokenPool, seed.pageNumber);
    if (distractors.length < 3) {
      safety += 1;
      continue;
    }

    const rawChoices = rotateChoices(
      [correctToken, ...distractors.slice(0, 3)],
      safety,
    );
    const correctIndex = rawChoices.findIndex(
      (choice) => normalizeTokenKey(choice) === normalizeTokenKey(correctToken),
    );
    const labels = ["A", "B", "C", "D"];
    const tokenQuestionKey = `${questionKey}:${correctToken}`;
    if (questionKeys.has(tokenQuestionKey)) {
      safety += 1;
      continue;
    }
    questionKeys.add(tokenQuestionKey);

    const currentCounts = countDifficulties(questions);
    const difficulty = pickNextDifficulty(currentCounts, targetDifficulties);
    const prompt = buildMockQuestionPrompt(seed, correctToken);
    const isBlankPrompt = prompt.includes("_____");
    questions.push({
      id: `mcq-mock-${questions.length + 1}`,
      kind: "mcq",
      question: prompt,
      choices: rawChoices.map((choice, index) => `${labels[index]}. ${choice}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
      difficulty,
      explanation: isBlankPrompt
        ? `Эх бодлогод ${correctToken} гэж өгөгдсөн.`
        : `Сонгосон бодлогын зөв түлхүүр өгөгдөл нь ${correctToken}.`,
      points: 1,
      sourcePages: [seed.pageNumber],
      bookProblem: normalizeReadableProblemText(seed.text),
    });
    safety += 1;
  }

  return questions.slice(0, targetCount);
}

function buildMockOpenTasks(
  existingTasks: GeneratedTextbookOpenTask[],
  targetCount: number,
  sourceProblems: TextbookSourceProblem[],
  visiblePages: VisiblePage[],
) {
  const seeds = buildSourceSeeds(sourceProblems, visiblePages);
  const tasks = existingTasks.slice(0, targetCount);

  let safety = 0;
  while (tasks.length < targetCount && safety < Math.max(20, targetCount * 10)) {
    const seed = seeds[safety % seeds.length] || seeds[0];
    const focusToken = extractCandidateTokens(seed.text)[0] || `хуудас ${seed.pageNumber}`;

    tasks.push({
      id: `written-mock-${tasks.length + 1}`,
      kind: "written",
      prompt: looksReadableMathWordProblem(seed.text)
        ? `Дараах бодлогыг хэрхэн бодохоо тайлбарлан бичнэ үү.\n${normalizeReadableProblemText(seed.text)}`
        : `Дараах хэсгийн гол өгөгдөл болон бодох дарааллыг тайлбарлан бичнэ үү.\n${normalizeReadableProblemText(seed.text)}`,
      answer: `Хүлээгдэж буй хариу: ${focusToken} гэсэн гол өгөгдлийг зөв ашиглаж, бодох алхмуудаа дараалалтай тайлбарласан байна.`,
      difficulty: "medium",
      points: 2,
      score: 2,
      sourceExcerpt: normalizeReadableProblemText(seed.text),
      sourcePages: [seed.pageNumber],
    });
    safety += 1;
  }

  return tasks.slice(0, targetCount);
}

export function ensureGeneratedTestShape({
  requestedOpenQuestionCount,
  requestedQuestionCount,
  requestedTotalScore,
  sourceProblems,
  test,
  visiblePages,
}: EnsureGeneratedTestShapeInput): GeneratedTextbookTest {
  const targetQuestionCount = Math.max(0, Math.trunc(Number(requestedQuestionCount) || 0));
  const targetOpenQuestionCount = Math.max(
    0,
    Math.trunc(Number(requestedOpenQuestionCount) || 0),
  );
  const initialQuestionCount = Array.isArray(test.questions) ? test.questions.length : 0;
  const initialOpenQuestionCount = Array.isArray(test.openQuestions)
    ? test.openQuestions.length
    : 0;

  const questions = buildMockMcqQuestions(
    Array.isArray(test.questions) ? test.questions : [],
    targetQuestionCount,
    test.difficultyCountsApplied,
    sourceProblems,
    visiblePages,
  );
  const openQuestions = buildMockOpenTasks(
    Array.isArray(test.openQuestions) ? test.openQuestions : [],
    targetOpenQuestionCount,
    sourceProblems,
    visiblePages,
  );

  const warnings = [...(Array.isArray(test.warnings) ? test.warnings : [])];
  const mockMcqCount = Math.max(0, questions.length - initialQuestionCount);
  const mockOpenCount = Math.max(0, openQuestions.length - initialOpenQuestionCount);

  if (mockMcqCount > 0) {
    warnings.push(
      `Автоматаар хүрэлцээгүй ${mockMcqCount} сонголтот асуултыг mock fallback-аар нөхлөө.`,
    );
  }
  if (mockOpenCount > 0) {
    warnings.push(
      `Автоматаар хүрэлцээгүй ${mockOpenCount} задгай даалгаврыг mock fallback-аар нөхлөө.`,
    );
  }
  if (targetQuestionCount > questions.length) {
    warnings.push(
      `Хүссэн ${targetQuestionCount} сонголтот асуултаас ${questions.length}-ийг л бүрдүүлж чадлаа.`,
    );
  }
  if (targetOpenQuestionCount > openQuestions.length) {
    warnings.push(
      `Хүссэн ${targetOpenQuestionCount} задгай даалгавраас ${openQuestions.length}-ийг л бүрдүүлж чадлаа.`,
    );
  }

  return {
    ...test,
    openQuestions,
    openQuestionCountGenerated: openQuestions.length,
    questionCountGenerated: questions.length,
    questions,
    sourcePages: uniquePageNumbers([
      ...(Array.isArray(test.sourcePages) ? test.sourcePages : []),
      ...sourceProblems.map((item) => item.pageNumber),
      ...visiblePages.map((page) => page.pageNumber),
      ...questions.flatMap((question) => question.sourcePages),
      ...openQuestions.flatMap((task) => task.sourcePages),
    ]),
    totalScore: Math.max(0, Math.trunc(Number(requestedTotalScore) || test.totalScore || 0)),
    warnings,
  };
}
