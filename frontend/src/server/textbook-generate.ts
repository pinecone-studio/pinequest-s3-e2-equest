import {
  chatWithOllama,
  DEFAULT_OLLAMA_MODEL,
} from "../lib/ollama";
import { parseGeminiJson } from "../lib/parse-gemini-json";
import { buildSourceRefinementPrompt, type AiRefinedSourcePayload } from "../features/textbook-processing/ai-source-refinement";
import { cleanTextbookGenerationSource } from "../features/textbook-processing/generation-source-cleaner";
import { toStudentFacingProblemPrompt } from "../features/textbook-processing/student-facing-problem";
import type {
  GeneratedTextbookOpenTask,
  GeneratedTextbookQuestion,
  GeneratedTextbookTest,
  TextbookDifficulty,
} from "../app/test/material-builder/_components/textbook-material-data";

export type TextbookGenerateEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
};

type TextbookGenerateRequest = {
  fallbackTest?: GeneratedTextbookTest;
  sourceProblems?: Array<{
    pageNumber?: number;
    text?: string;
  }>;
  visiblePages?: Array<{
    content?: string;
    pageNumber?: number;
  }>;
  selectedSectionTitles?: string[];
};

type SourceCandidate = {
  sourcePages: number[];
  text: string;
};

type AiMcqPayload = {
  bookProblem?: string;
  correctAnswer?: number | string | null;
  correctOption?: number | string | null;
  difficulty?: string;
  explanation?: string;
  options?: string[];
  prompt?: string;
  sourceExcerpt?: string;
  sourcePages?: number[];
};

type AiOpenPayload = {
  answer?: string;
  answerLatex?: string;
  difficulty?: string;
  points?: number;
  prompt?: string;
  responseGuide?: string;
  sourceExcerpt?: string;
  sourcePages?: number[];
};

type AiTextbookPayload = {
  mcqQuestions?: AiMcqPayload[];
  openQuestions?: AiOpenPayload[];
  warnings?: string[];
};

type AiProviderResult = {
  error?: string;
  model?: string;
  payload: AiTextbookPayload | null;
  provider: "gemini" | "local" | "ollama";
  warnings: string[];
};

type AiJsonProviderResult<T> = {
  error?: string;
  model?: string;
  payload: T | null;
  provider: "gemini" | "local" | "ollama";
  warnings: string[];
};

const CHOICE_LABELS = ["A", "B", "C", "D"] as const;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "ba",
  "bol",
  "deer",
  "dotor",
  "for",
  "from",
  "gej",
  "gesen",
  "hai",
  "in",
  "is",
  "it",
  "of",
  "or",
  "that",
  "the",
  "this",
  "to",
  "tuhai",
]);
const DEFAULT_TIMEOUT_MS = 120000;
const SOLVE_QUESTION_TEXT = "Энэ бодлогыг бодоод зөв хариуг сонго.";

function randomId(): string {
  return String(globalThis.crypto.randomUUID());
}

function normalizeSpace(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return normalizeSpace(value).toLowerCase();
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeSpace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function stripChoicePrefix(value: string) {
  return String(value || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:\-–]|\s+)\s*/iu, "")
    .trim();
}

function formatChoice(choice: string, index: number) {
  const label = CHOICE_LABELS[index] || "A";
  return `${label}. ${stripChoicePrefix(choice) || `Сонголт ${label}`}`;
}

function normalizeDifficulty(value?: string | null): TextbookDifficulty {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "easy") {
    return "easy";
  }
  if (normalized === "hard" || normalized === "advanced") {
    return "hard";
  }
  return "medium";
}

function uniqueWarnings(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
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

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function tokenize(value: string) {
  return normalizeSpace(value)
    .toLowerCase()
    .split(/[^a-z0-9а-яөүё]+/iu)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function buildSourceCandidates(fallbackTest: GeneratedTextbookTest) {
  const out: SourceCandidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (text: string, sourcePages: number[]) => {
    const normalizedText = normalizeSpace(text);
    if (!normalizedText) {
      return;
    }
    const key = `${normalizeKey(normalizedText)}|${sourcePages.join(",")}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({
      sourcePages,
      text: normalizedText,
    });
  };

  for (const question of fallbackTest.questions) {
    pushCandidate(question.bookProblem, question.sourcePages);
  }

  for (const task of fallbackTest.openQuestions) {
    pushCandidate(task.sourceExcerpt || task.prompt, task.sourcePages);
  }

  return out;
}

function dedupeSourceCandidates(items: SourceCandidate[]) {
  const out: SourceCandidate[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const text = toStudentFacingProblemPrompt(item.text) || normalizeSpace(item.text);
    if (!text) {
      continue;
    }

    const sourcePages = Array.from(
      new Set(
        (item.sourcePages || [])
          .map((pageNumber) => Math.trunc(Number(pageNumber)))
          .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber >= 1),
      ),
    ).sort((left, right) => left - right);
    const key = `${normalizeKey(text)}|${sourcePages.join(",")}`;
    if (!normalizeKey(text) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      sourcePages,
      text,
    });
  }

  return out;
}

function scoreSourceCandidate(query: string, candidate: SourceCandidate) {
  const normalizedQuery = normalizeSpace(query);
  const normalizedCandidate = normalizeSpace(candidate.text);

  if (!normalizedQuery || !normalizedCandidate) {
    return -1;
  }

  const queryKey = normalizeKey(normalizedQuery);
  const candidateKey = normalizeKey(normalizedCandidate);

  if (candidateKey.includes(queryKey) || queryKey.includes(candidateKey)) {
    return 100;
  }

  const queryTokens = tokenize(normalizedQuery);
  const candidateTokens = new Set(tokenize(normalizedCandidate));
  let score = 0;

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function findBestSourceCandidate(
  query: string,
  candidates: SourceCandidate[],
) {
  let best: SourceCandidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = scoreSourceCandidate(query, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || bestScore < 2) {
    return null;
  }

  return {
    candidate: best,
    score: bestScore,
  };
}

function buildPrompt(
  fallbackTest: GeneratedTextbookTest,
  sourceProblems: SourceCandidate[],
  selectedSectionTitles: string[],
  visiblePages: Array<{ content: string; pageNumber: number }>,
) {
  const hardCount = Number(fallbackTest.difficultyCountsApplied.hard || 0);
  const mediumCount = Number(fallbackTest.difficultyCountsApplied.medium || 0);
  const easyCount = Number(fallbackTest.difficultyCountsApplied.easy || 0);
  const preferHardProblems = hardCount >= mediumCount && hardCount >= easyCount;
  const promptProblems = sourceProblems
    .slice(0, 120)
    .map((candidate, index) => {
      const pageLabel = candidate.sourcePages.length
        ? `pages ${candidate.sourcePages.join(", ")}`
        : "pages unknown";
      return `${index + 1}. ${pageLabel} | ${truncateText(candidate.text, 220)}`;
    })
    .join("\n");

  const pagePreview = visiblePages
    .slice(0, 20)
    .map(
      (page) =>
        `[Page ${page.pageNumber}] ${truncateText(page.content, 1600)}`,
    )
    .join("\n\n");

  const sectionLines = selectedSectionTitles
    .map((title) => `- ${normalizeSpace(title)}`)
    .join("\n");

  return `
Чи сурах бичгийн яг сонгосон бүлэг, сэдвээс шалгалтын асуулт бэлддэг туслах.
Зөвхөн JSON object буцаа. Markdown, code fence, тайлбар бүү нэм.

Сонгосон сэдвүүд:
${sectionLines || "- Сонгосон сэдэв байхгүй"}

Шаардлагатай тоо:
- Сонголтот асуулт: ${fallbackTest.questionCountGenerated}
- Задгай даалгавар: ${fallbackTest.openQuestionCountGenerated}
- Нийт оноо: ${fallbackTest.totalScore}
- Түвшний хуваарилалт: easy=${fallbackTest.difficultyCountsApplied.easy}, medium=${fallbackTest.difficultyCountsApplied.medium}, hard=${fallbackTest.difficultyCountsApplied.hard}

Дүрэм:
- Зөвхөн доорх "Номын бодлогууд" болон "Хуудасны эх" хэсгээс асуулт гарга.
- Raw OCR эсвэл эвдэрхий source текстийг шууд copy-paste хийж асуулт бүү болго. Эхлээд цэвэрлэж, ойлгомжтой болгож бич.
- Сонголтот асуулт бүр нэг бодлого дээр суурилсан байна.
- Нэг асуултанд яг нэг source problem ашигла. Хоёр өөр бодлогыг нийлүүлж болохгүй.
- prompt талбар нь сурагчид шууд уншигдах, байгалийн Монгол хэлтэй байна.
- prompt нь богино, тодорхой, нэг утгатай байна.
- Хэрэв source дотор илүү урт тайлбар байвал зөвхөн бодоход хэрэгтэй хэсгийг л үлдээгээрэй.
- "Сонгосон хэсэг", "эх хэсэг", "дараах мөрөөс" гэх мэт meta хэллэг prompt-д бүү ашигла.
- Хэрэв source problem өөрөө бэлэн бодлогын өгүүлбэр байвал аль болох тэр хэлбэрийг нь хадгалж цэвэрлээд ашигла.
- "x - ийн" гэх мэт эвдэрсэн spacing байвал "x-ийн" болгож зас.
- "x2+1x-2=0" шиг мөр байвал "x^2 + x - 2 = 0" гэж засаж, "Дараах тэгшитгэлийг бод. x-ийн утгыг ол:" маягийн prompt болго.
- Математикийн илэрхийллүүдийг KaTeX/LaTeX-compatible байдлаар бичиж болно. Жишээ нь \\sqrt{...}, \\frac{...}{...}, x^2, 45^\\circ.
- bookProblem талбарт тухайн номын бодлогын агуулгыг ойр, танигдахуйц байдлаар өг.
- sourceExcerpt талбарт номын эхээс богино ишлэл өг.
- sourcePages талбарт аль page-ээс авснаа массив хэлбэрээр өг.
- Сонголтот асуулт бүр options массивтай, яг 4 сонголттой байна.
- correctOption нь 0-ээс эхэлсэн зөв индекс байна.
- Задгай даалгавар бүр answer болон responseGuide-тай байна.
- options нь цэвэр, богино, яг хариултын хувилбарууд байна. "A." "B." гэсэн prefix бүү нэм.
- Сонголтууд хоорондоо давхцахгүй, нэг нь нөгөөгөө багтаахгүй, будлиангүй байна.
- explanation болон responseGuide нь багш, сурагч хүн уншаад ойлгохоор товч, тодорхой байна.
- Хэрэв хангалттай шинэ хувилбар хийж чадахгүй бол одоо байгаа бодлогын хэлбэрийг хадгалсан, цэвэр хувилбар буцаа.
- Чанар муутай 10 асуултаас илүү, ойлгомжтой 4-6 асуулт буцаах нь дээр. Хэрэв source нь ойлгомжгүй бол requested count-оос цөөн буцааж болно.
- Энгийн тооны шууд үйлдэл, нэг алхамтай амархан асуултаас зайлсхий.
- Хувьсагчтай тэгшитгэл, язгуур, модультай, олон алхамтай бодлогуудыг түрүүлж сонго.
- "Дадлага ажил", "Дүрс 1", "нэрлэвэл", "олон өнцөгт биш" зэрэг incomplete instruction мөрүүдээс асуулт бүү хий.
- Source-д байхгүй demo маягийн бодлого бүү зохиож өг.
${preferHardProblems ? "- Энэ generation дээр hard түвшний бодлогуудыг давамгай сонго." : ""}

Номын бодлогууд:
${promptProblems || "Бодлогын жагсаалт олдсонгүй."}

Хуудасны эх:
${pagePreview || "Хуудасны эх олдсонгүй."}

Буцаах JSON бүтэц:
{
  "mcqQuestions": [
    {
      "prompt": "string",
      "bookProblem": "string",
      "options": ["string", "string", "string", "string"],
      "correctOption": 0,
      "explanation": "string",
      "difficulty": "easy | medium | hard",
      "sourceExcerpt": "string",
      "sourcePages": [12]
    }
  ],
  "openQuestions": [
    {
      "prompt": "string",
      "answer": "string",
      "responseGuide": "string",
      "difficulty": "easy | medium | hard",
      "sourceExcerpt": "string",
      "sourcePages": [12]
    }
  ],
  "warnings": ["string"]
}
`.trim();
}

async function requestGeminiPayload<T>(
  prompt: string,
  env: TextbookGenerateEnv,
) {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY тохируулаагүй байна.");
  }

  const model = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
            role: "user",
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message || "Gemini-с сурах бичгийн асуулт үүсгэж чадсангүй.",
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini хоосон хариу буцаалаа.");
  }

  return {
    model,
    payload: parseGeminiJson<T>(text),
  };
}

async function requestOllamaPayload<T>(
  prompt: string,
  env: TextbookGenerateEnv,
) {
  const baseUrl = env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("OLLAMA_BASE_URL тохируулаагүй байна.");
  }

  const result = await chatWithOllama({
    apiKey: env.OLLAMA_API_KEY?.trim(),
    baseUrl,
    context: "Textbook generate",
    format: "json",
    messages: [
      {
        role: "system",
        content:
          "You create Mongolian textbook-based math exams. Return JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
    retries: 1,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  return {
    model: result.model,
    payload: parseGeminiJson<T>(result.content),
  };
}

async function requestAiJsonPayload<T>(
  prompt: string,
  env: TextbookGenerateEnv,
  options: {
    localWarning: string;
    preferOllama?: boolean;
  },
): Promise<AiJsonProviderResult<T>> {
  const warnings: string[] = [];
  const providerOrder = options.preferOllama
    ? (["ollama", "gemini"] as const)
    : (["gemini", "ollama"] as const);

  for (const provider of providerOrder) {
    if (provider === "gemini" && env.GEMINI_API_KEY?.trim()) {
      try {
        const result = await requestGeminiPayload<T>(prompt, env);
        return {
          model: result.model,
          payload: result.payload,
          provider: "gemini",
          warnings,
        };
      } catch (error) {
        warnings.push(
          `Gemini ашиглаж чадсангүй: ${
            error instanceof Error ? error.message : "Тодорхойгүй алдаа"
          }`,
        );
      }
    }

    if (provider === "ollama" && env.OLLAMA_BASE_URL?.trim()) {
      try {
        const result = await requestOllamaPayload<T>(prompt, env);
        return {
          model: result.model,
          payload: result.payload,
          provider: "ollama",
          warnings,
        };
      } catch (error) {
        warnings.push(
          `Ollama ашиглаж чадсангүй: ${
            error instanceof Error ? error.message : "Тодорхойгүй алдаа"
          }`,
        );
      }
    }
  }

  warnings.push(options.localWarning);

  return {
    error: warnings[warnings.length - 1],
    payload: null,
    provider: "local",
    warnings,
  };
}

async function requestAiPayload(
  prompt: string,
  env: TextbookGenerateEnv,
): Promise<AiProviderResult> {
  return requestAiJsonPayload<AiTextbookPayload>(prompt, env, {
    localWarning:
      "AI provider олдсонгүй эсвэл ажиллахгүй байна. Local fallback тестийг ашиглалаа.",
    preferOllama: true,
  });
}

function parseSourcePages(value: unknown, fallback: number[]) {
  const source = Array.isArray(value) ? value : [];
  const out = source
    .map((item) => Math.trunc(Number(item)))
    .filter((item) => Number.isFinite(item) && item >= 1);

  return out.length ? out : fallback;
}

function parseCorrectOption(
  value: unknown,
  formattedChoices: string[],
) {
  if (typeof value === "number") {
    const index = Math.trunc(value);
    if (index >= 0 && index < formattedChoices.length) {
      return index;
    }
  }

  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (/^[A-D]$/.test(normalized)) {
    return CHOICE_LABELS.indexOf(normalized as (typeof CHOICE_LABELS)[number]);
  }

  const target = normalizeKey(stripChoicePrefix(String(value || "")));
  if (!target) {
    return 0;
  }

  const foundIndex = formattedChoices.findIndex(
    (choice) => normalizeKey(stripChoicePrefix(choice)) === target,
  );
  return foundIndex >= 0 ? foundIndex : 0;
}

function mapAiMcqQuestion(
  item: AiMcqPayload,
  candidates: SourceCandidate[],
  fallbackQuestion: GeneratedTextbookQuestion | undefined,
) {
  const rawOptions = Array.isArray(item.options)
    ? item.options.map((choice) => normalizeSpace(String(choice || ""))).filter(Boolean)
    : [];
  if (rawOptions.length < 4) {
    return null;
  }

  const formattedChoices = rawOptions.slice(0, 4).map((choice, index) =>
    formatChoice(choice, index),
  );
  const sourceQuery = String(
    item.sourceExcerpt || item.bookProblem || item.prompt || "",
  ).trim();
  const matchedSource = findBestSourceCandidate(sourceQuery, candidates);
  if (!matchedSource && candidates.length > 0) {
    return null;
  }

  const sourcePages = parseSourcePages(
    item.sourcePages,
    matchedSource?.candidate.sourcePages || fallbackQuestion?.sourcePages || [],
  );
  const correctOption = parseCorrectOption(
    item.correctOption ?? item.correctAnswer,
    formattedChoices,
  );

  return {
    id: randomId(),
    kind: "mcq" as const,
    question:
      toStudentFacingProblemPrompt(
        String(item.prompt || fallbackQuestion?.question || SOLVE_QUESTION_TEXT),
      ) ||
      normalizeSpace(item.prompt || fallbackQuestion?.question || SOLVE_QUESTION_TEXT),
    bookProblem:
      toStudentFacingProblemPrompt(
        String(item.bookProblem || item.sourceExcerpt || ""),
      )
      || normalizeSpace(item.bookProblem || item.sourceExcerpt || "")
      || matchedSource?.candidate.text
      || fallbackQuestion?.bookProblem
      || normalizeSpace(item.prompt || ""),
    choices: formattedChoices,
    correctAnswer: CHOICE_LABELS[correctOption] || "A",
    difficulty: normalizeDifficulty(item.difficulty || fallbackQuestion?.difficulty),
    explanation:
      normalizeSpace(item.explanation || "")
      || fallbackQuestion?.explanation
      || "AI-аар номын бодлого дээр тулгуурлан боловсруулав.",
    points: fallbackQuestion?.points || 2,
    sourcePages,
  };
}

function mapAiOpenTask(
  item: AiOpenPayload,
  candidates: SourceCandidate[],
  fallbackTask: GeneratedTextbookOpenTask | undefined,
) {
  const prompt =
    toStudentFacingProblemPrompt(String(item.prompt || "")) ||
    normalizeSpace(item.prompt || "");
  if (!prompt) {
    return null;
  }

  const sourceQuery = String(item.sourceExcerpt || prompt).trim();
  const matchedSource = findBestSourceCandidate(sourceQuery, candidates);
  if (!matchedSource && candidates.length > 0) {
    return null;
  }

  const answer = normalizeSpace(item.answer || item.answerLatex || "");
  const sourcePages = parseSourcePages(
    item.sourcePages,
    matchedSource?.candidate.sourcePages || fallbackTask?.sourcePages || [],
  );
  const score = Math.max(
    0,
    Math.trunc(Number(item.points || fallbackTask?.score || fallbackTask?.points || 0)),
  );

  return {
    id: randomId(),
    kind: "written" as const,
    prompt,
    answer: answer || fallbackTask?.answer || "",
    difficulty: normalizeDifficulty(item.difficulty || fallbackTask?.difficulty),
    points: score,
    score,
    sourceExcerpt:
      normalizeSpace(item.sourceExcerpt || "")
      || matchedSource?.candidate.text
      || fallbackTask?.sourceExcerpt
      || prompt,
    sourcePages,
  };
}

function dedupeMcqQuestions(items: GeneratedTextbookQuestion[]) {
  const out: GeneratedTextbookQuestion[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = normalizeKey(item.bookProblem || item.question);
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
    const key = normalizeKey(item.sourceExcerpt || item.prompt);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }

  return out;
}

function mapAiRefinedSourceCandidates(
  payload: AiRefinedSourcePayload | null,
  fallbackCandidates: SourceCandidate[],
  desiredCount: number,
) {
  const mapped = (payload?.problems || [])
    .map((item) => {
      const prompt = toStudentFacingProblemPrompt(
        String(item.prompt || item.sourceExcerpt || "").trim(),
      );
      if (!prompt) {
        return null;
      }

      const matchedSource = findBestSourceCandidate(
        String(item.sourceExcerpt || item.prompt || "").trim(),
        fallbackCandidates,
      );
      if (!matchedSource && fallbackCandidates.length > 0) {
        return null;
      }

      return {
        sourcePages: parseSourcePages(
          item.sourcePages,
          matchedSource?.candidate.sourcePages || [],
        ),
        text: prompt,
      } satisfies SourceCandidate;
    })
    .filter(isDefined);

  return dedupeSourceCandidates(
    (mapped.length > 0 ? mapped : fallbackCandidates).slice(
      0,
      Math.max(1, desiredCount),
    ),
  );
}

export async function handleTextbookGeneratePost(
  request: Request,
  env: TextbookGenerateEnv,
) {
  try {
    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      throw new Error("Generate хүсэлт application/json body хүлээж байна.");
    }

    let body: TextbookGenerateRequest;
    try {
      body = (await request.json()) as TextbookGenerateRequest;
    } catch {
      throw new Error("Generate хүсэлтийн JSON body буруу байна.");
    }
    const fallbackTest = body.fallbackTest;

    if (!fallbackTest) {
      return Response.json(
        { error: "fallbackTest шаардлагатай." },
        { status: 400 },
      );
    }

    const selectedSectionTitles = Array.isArray(body.selectedSectionTitles)
      ? body.selectedSectionTitles.map((item) => normalizeSpace(String(item || ""))).filter(Boolean)
      : [];
    const rawSourceProblems = (Array.isArray(body.sourceProblems)
      ? body.sourceProblems
      : [])
      .map((item) => ({
        pageNumber: Math.max(1, Math.trunc(Number(item?.pageNumber || 0))),
        text: normalizeSpace(String(item?.text || "")),
      }))
      .filter((item) => item.text);
    const rawVisiblePages = (Array.isArray(body.visiblePages) ? body.visiblePages : [])
      .map((page) => ({
        content: normalizeSpace(String(page?.content || "")),
        pageNumber: Math.max(1, Math.trunc(Number(page?.pageNumber || 0))),
      }))
      .filter((page) => page.content);
    const cleanedGenerationSource = cleanTextbookGenerationSource({
      requestedOpenQuestionCount: fallbackTest.openQuestionCountGenerated,
      requestedQuestionCount: fallbackTest.questionCountGenerated,
      sourceProblems: rawSourceProblems,
      visiblePages: rawVisiblePages,
    });
    const sourceProblems = cleanedGenerationSource.sourceProblems.map((item) => ({
      sourcePages: [item.pageNumber],
      text: item.text,
    }));
    const visiblePages = cleanedGenerationSource.visiblePages;

    if (
      fallbackTest.questionCountGenerated <= 0 &&
      fallbackTest.openQuestionCountGenerated <= 0
    ) {
      return Response.json({ test: fallbackTest });
    }

    const fallbackSourceCandidates = dedupeSourceCandidates(
      sourceProblems.length ? sourceProblems : buildSourceCandidates(fallbackTest),
    );
    const sourceRefinementPrompt = buildSourceRefinementPrompt({
      desiredCount: Math.max(fallbackTest.questionCountGenerated * 2, 8),
      selectedSectionTitles,
      sourceProblems: fallbackSourceCandidates,
      visiblePages,
    });
    const sourceRefinementResult =
      await requestAiJsonPayload<AiRefinedSourcePayload>(
        sourceRefinementPrompt,
        env,
        {
          localWarning:
            "AI-аар source problem цэвэрлэж чадсангүй. Heuristic cleaner-ийг ашиглалаа.",
          preferOllama: true,
        },
      );
    const sourceCandidates = mapAiRefinedSourceCandidates(
      sourceRefinementResult.payload,
      fallbackSourceCandidates,
      Math.max(fallbackTest.questionCountGenerated * 2, 8),
    );
    const prompt = buildPrompt(
      fallbackTest,
      sourceCandidates,
      selectedSectionTitles,
      visiblePages,
    );
    const aiResult = await requestAiPayload(prompt, env);

    const aiMcqQuestions = dedupeMcqQuestions(
      (aiResult.payload?.mcqQuestions || [])
        .map((item, index) =>
          mapAiMcqQuestion(
            item,
            sourceCandidates,
            fallbackTest.questions[index],
          ),
        )
        .filter(isDefined),
    );
    const aiOpenQuestions = dedupeOpenTasks(
      (aiResult.payload?.openQuestions || [])
        .map((item, index) =>
          mapAiOpenTask(
            item,
            sourceCandidates,
            fallbackTest.openQuestions[index],
          ),
        )
        .filter(isDefined),
    );

    const finalQuestions = dedupeMcqQuestions([
      ...aiMcqQuestions,
      ...fallbackTest.questions,
    ])
      .slice(0, fallbackTest.questionCountGenerated)
      .map((question, index) => ({
        ...question,
        difficulty:
          fallbackTest.questions[index]?.difficulty || question.difficulty,
        points: fallbackTest.questions[index]?.points || question.points,
      }));

    const finalOpenQuestions = dedupeOpenTasks([
      ...aiOpenQuestions,
      ...fallbackTest.openQuestions,
    ])
      .slice(0, fallbackTest.openQuestionCountGenerated)
      .map((task, index) => {
        const fallbackTask = fallbackTest.openQuestions[index];
        const score = fallbackTask?.score || task.score || task.points;
        return {
          ...task,
          difficulty: fallbackTask?.difficulty || task.difficulty,
          points: score,
          score,
        };
      });

    const warnings = uniqueWarnings([
      ...cleanedGenerationSource.warnings,
      ...fallbackTest.warnings,
      ...(Array.isArray(sourceRefinementResult.payload?.warnings)
        ? sourceRefinementResult.payload.warnings
        : []),
      ...sourceRefinementResult.warnings,
      ...(Array.isArray(aiResult.payload?.warnings) ? aiResult.payload.warnings : []),
      ...aiResult.warnings,
      sourceRefinementResult.provider === "local"
        ? ""
        : `${sourceRefinementResult.provider === "ollama" ? "Ollama" : "Gemini"} source problem-уудыг эхлээд цэвэрлэж шүүв.`,
      aiResult.provider === "local"
        ? "AI route ажиллахгүй үед local fallback тестийг хэвээр үлдээлээ."
        : `${aiResult.provider === "gemini" ? "Gemini" : "Ollama"} ашиглаж сонгосон сэдвээс тест боловсруулав.`,
      aiMcqQuestions.length < fallbackTest.questionCountGenerated
        ? `AI-аас ${aiMcqQuestions.length} сонголтот асуулт ирсэн тул үлдсэнийг local fallback-аар нөхөв.`
        : "",
      aiOpenQuestions.length < fallbackTest.openQuestionCountGenerated
        ? `AI-аас ${aiOpenQuestions.length} задгай даалгавар ирсэн тул үлдсэнийг local fallback-аар нөхөв.`
        : "",
    ]);

    const finalTest: GeneratedTextbookTest = {
      ...fallbackTest,
      questions: finalQuestions,
      openQuestions: finalOpenQuestions,
      questionCountGenerated: finalQuestions.length,
      openQuestionCountGenerated: finalOpenQuestions.length,
      warnings,
    };

    return Response.json({
      model: aiResult.model,
      provider: aiResult.provider,
      test: finalTest,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Сурах бичгээс тест үүсгэх үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
