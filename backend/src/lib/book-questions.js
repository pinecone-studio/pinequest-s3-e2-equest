const axios = require("axios");

const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const ALLOWED_TYPES = new Set(["factual", "conceptual", "analytical"]);
const CHOICE_LABELS = ["A", "B", "C", "D"];
const RAW_OPTION_TO_NORMALIZED = new Map([
  ["A", "A"],
  ["B", "B"],
  ["C", "C"],
  ["D", "D"],
  ["1", "A"],
  ["2", "B"],
  ["3", "C"],
  ["4", "D"],
  // Cyrillic labels often used in Mongolian/Russian books
  ["А", "A"],
  ["Б", "B"],
  ["В", "C"],
  ["Г", "D"],
]);

function normalizeOptionToken(value) {
  const token = String(value || "").trim();
  if (!token) return "";
  const upper = token.toUpperCase();
  return RAW_OPTION_TO_NORMALIZED.get(upper) || "";
}
const ALLOWED_PROVIDERS = new Set(["auto", "gemini", "ollama"]);
const DEFAULT_PROVIDER = "auto";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:0.5b";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const LOCAL_FALLBACK_MODEL = "local-fallback";
const LOCAL_EXTRACT_MODEL = "local-extract";

function createAppError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanGenerationMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "extract" ? "extract" : "generate";
}

function requireAiEnabled() {
  return String(process.env.REQUIRE_AI || "").trim() === "1";
}

function uniqueModels(models) {
  return [...new Set(models)];
}

function cleanModelName(model) {
  return String(model || "").trim();
}

function cleanProviderName(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (ALLOWED_PROVIDERS.has(normalized)) {
    return normalized;
  }
  return DEFAULT_PROVIDER;
}

function isModelNotFoundError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("model") && message.includes("not found");
}

async function listInstalledModels({ baseUrl, timeoutMs }) {
  try {
    const response = await axios.get(`${baseUrl.replace(/\/+$/, "")}/api/tags`, {
      timeout: Math.min(timeoutMs, 15000),
    });
    const models = Array.isArray(response?.data?.models) ? response.data.models : [];

    return uniqueModels(
      models
        .map((item) => cleanModelName(item?.name))
        .filter(Boolean),
    );
  } catch {
    return [];
  }
}

function buildModelCandidates({ requestedModel, installedModels }) {
  const requested = cleanModelName(requestedModel) || DEFAULT_OLLAMA_MODEL;
  if (!installedModels.length) {
    return [requested];
  }

  if (installedModels.includes(requested)) {
    return [requested];
  }

  const requestedBase = requested.split(":")[0];
  const sameFamily = installedModels.filter((model) => model.split(":")[0] === requestedBase);

  return uniqueModels([requested, ...sameFamily, ...installedModels]);
}

function cleanJsonBlock(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonArray(raw) {
  const cleaned = cleanJsonBlock(raw);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
  } catch {
    // Continue with substring strategy below.
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("AI JSON массив буцаасангүй.");
  }

  const sliced = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(sliced);
  if (!Array.isArray(parsed)) {
    throw new Error("AI хариу массив биш байна.");
  }
  return parsed;
}

function normalizeChoiceText(choice, index) {
  const label = CHOICE_LABELS[index] || "A";
  const labelPrefix = /^[A-D](?:\s*[\).:-]|\s+)\s*/i;
  const raw = String(choice || "")
    .replace(labelPrefix, "")
    .trim();
  return `${label}. ${raw || `Сонголт ${label}`}`;
}

function stripChoiceLabel(value) {
  return String(value || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:-]|\s+)\s*/iu, "")
    .trim();
}

function normalizeKey(value) {
  return stripChoiceLabel(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function formatNumberForChoice(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(4)).toString();
}

function numericDistractors(correctText) {
  const raw = stripChoiceLabel(correctText).replace(/,/g, "").trim();
  const num = Number(raw);
  if (!Number.isFinite(num)) return [];

  const variants = [
    num + 1,
    num - 1,
    num * 2,
    num / 2,
    -num,
  ];

  return uniqueModels(
    variants
      .map((value) => formatNumberForChoice(value))
      .filter((value) => normalizeKey(value) !== normalizeKey(raw)),
  );
}

function buildOptionSet(rawChoices, correctAnswerRaw) {
  const cleaned = uniqueModels(
    (Array.isArray(rawChoices) ? rawChoices : [])
      .map((item) => stripChoiceLabel(item))
      .filter(Boolean),
  );

  if (cleaned.length === 0) {
    cleaned.push("Тохирох хариулт олдсонгүй");
  }

  const letter = String(correctAnswerRaw || "").trim().toUpperCase();
  const letterIndex = CHOICE_LABELS.indexOf(letter);
  const byLetter = letterIndex >= 0 ? cleaned[letterIndex] : "";

  const byText = cleaned.find((choice) => normalizeKey(choice) === normalizeKey(correctAnswerRaw));
  const correctText = byText || byLetter || cleaned[0];

  const wrong = cleaned.filter((choice) => normalizeKey(choice) !== normalizeKey(correctText));
  const generatedWrong = numericDistractors(correctText);
  for (const item of generatedWrong) {
    if (wrong.length >= 3) break;
    if (wrong.some((w) => normalizeKey(w) === normalizeKey(item))) continue;
    wrong.push(item);
  }

  while (wrong.length < 3) {
    const next = `Буруу хувилбар ${wrong.length + 1}`;
    wrong.push(next);
  }

  const unlabeled = shuffleChoices([correctText, ...wrong.slice(0, 3)]);
  const labeled = unlabeled.map((item, idx) => normalizeChoiceText(item, idx));
  const correctIndex = unlabeled.findIndex((item) => normalizeKey(item) === normalizeKey(correctText));

  return {
    choices: labeled,
    correctAnswer: CHOICE_LABELS[correctIndex >= 0 ? correctIndex : 0],
  };
}

function inferAnswerLetter(correctAnswer, choices) {
  const raw = String(correctAnswer || "").trim();
  const normalizedToken = normalizeOptionToken(raw);
  if (normalizedToken) return normalizedToken;

  const normalizedRaw = stripChoiceLabel(raw).trim().toLowerCase();
  const foundIdx = choices.findIndex((choice) =>
    normalizeKey(choice) === normalizeKey(normalizedRaw));

  if (foundIdx >= 0 && foundIdx < CHOICE_LABELS.length) {
    return CHOICE_LABELS[foundIdx];
  }

  return "A";
}

function normalizeQuestionPreserve(rawQuestion) {
  const question = String(rawQuestion?.question || "").trim();
  if (!question) {
    return null;
  }

  const rawChoices = Array.isArray(rawQuestion?.choices) ? rawQuestion.choices : [];
  if (rawChoices.length !== 4) return null;

  const cleanedChoices = rawChoices.map((choice) => String(choice || "").trim());
  if (cleanedChoices.some((choice) => !choice)) return null;

  const correctAnswer = inferAnswerLetter(rawQuestion?.correct_answer, cleanedChoices);
  if (!/^[A-D]$/.test(correctAnswer)) return null;

  const explanation = String(rawQuestion?.explanation || "").trim();

  const difficulty = String(rawQuestion?.difficulty || "")
    .trim()
    .toLowerCase();
  const safeDifficulty = ALLOWED_DIFFICULTIES.has(difficulty) ? difficulty : "medium";

  const type = String(rawQuestion?.type || "")
    .trim()
    .toLowerCase();
  const safeType = ALLOWED_TYPES.has(type) ? type : "factual";

  const sourcePagesRaw = Array.isArray(rawQuestion?.source_pages)
    ? rawQuestion.source_pages
    : Array.isArray(rawQuestion?.sourcePages)
      ? rawQuestion.sourcePages
      : [];
  const source_pages = sourcePagesRaw
    .map((value) => Math.trunc(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 1);

  const source_excerpt = String(
    rawQuestion?.source_excerpt
      || rawQuestion?.sourceExcerpt
      || rawQuestion?.source
      || "",
  ).trim();

  const correctAnswerRaw = String(rawQuestion?.correct_answer_raw || rawQuestion?.correctAnswerRaw || "")
    .trim();

  return {
    question,
    choices: cleanedChoices,
    correct_answer: correctAnswer,
    ...(correctAnswerRaw ? { correct_answer_raw: correctAnswerRaw } : {}),
    explanation,
    difficulty: safeDifficulty,
    type: safeType,
    ...(source_pages.length ? { source_pages } : {}),
    ...(source_excerpt ? { source_excerpt } : {}),
  };
}

function normalizeQuestion(rawQuestion, index) {
  const question = String(rawQuestion?.question || "").trim();
  if (!question) {
    return null;
  }

  const optionSet = buildOptionSet(rawQuestion?.choices, rawQuestion?.correct_answer);
  const choices = optionSet.choices;
  const correctAnswer = optionSet.correctAnswer || inferAnswerLetter(rawQuestion?.correct_answer, choices);

  const explanation = String(rawQuestion?.explanation || "").trim();

  const difficulty = String(rawQuestion?.difficulty || "")
    .trim()
    .toLowerCase();
  const safeDifficulty = ALLOWED_DIFFICULTIES.has(difficulty) ? difficulty : "medium";

  const type = String(rawQuestion?.type || "")
    .trim()
    .toLowerCase();
  const safeType = ALLOWED_TYPES.has(type) ? type : "factual";

  const sourcePagesRaw = Array.isArray(rawQuestion?.source_pages)
    ? rawQuestion.source_pages
    : Array.isArray(rawQuestion?.sourcePages)
      ? rawQuestion.sourcePages
      : [];
  const source_pages = sourcePagesRaw
    .map((value) => Math.trunc(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 1);

  const source_excerpt = String(
    rawQuestion?.source_excerpt
      || rawQuestion?.sourceExcerpt
      || rawQuestion?.source
      || "",
  ).trim();

  return {
    question,
    choices,
    correct_answer: correctAnswer,
    explanation,
    difficulty: safeDifficulty,
    type: safeType,
    ...(source_pages.length ? { source_pages } : {}),
    ...(source_excerpt ? { source_excerpt } : {}),
  };
}

function parseQuestionsSafely(rawResponse, options = {}) {
  const mode = String(options?.mode || "").trim().toLowerCase();
  const preserve = mode === "extract";
  try {
    const parsed = extractJsonArray(rawResponse);
    return parsed
      .map((question, index) =>
        preserve ? normalizeQuestionPreserve(question) : normalizeQuestion(question, index))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dedupeQuestions(questions) {
  const seen = new Set();
  const out = [];
  for (const q of questions) {
    const key = q.question.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function splitPageSections(pageText) {
  const raw = String(pageText || "");
  const pages = [];
  const re = /\[Page\s+(\d+)\]\s*/gi;
  let match = re.exec(raw);
  if (!match) {
    const text = raw.trim();
    return text ? [{ pageNumber: 1, text }] : [];
  }

  let currentPage = Math.trunc(Number(match[1])) || 1;
  let lastIndex = re.lastIndex;
  match = re.exec(raw);

  while (match) {
    const nextPage = Math.trunc(Number(match[1])) || currentPage;
    const slice = raw.slice(lastIndex, match.index).trim();
    if (slice) {
      pages.push({ pageNumber: currentPage, text: slice });
    }
    currentPage = nextPage;
    lastIndex = re.lastIndex;
    match = re.exec(raw);
  }

  const tail = raw.slice(lastIndex).trim();
  if (tail) pages.push({ pageNumber: currentPage, text: tail });
  return pages;
}

function buildAnswerKeyIndex(pages) {
  const index = new Map(); // qNumber -> { letter, raw, pageNumber, evidence }
  const keyMarkersSource = /(хариу(?:\s*түлхүүр)?|answers?|answer\s*key)/giu;
  const pairReSource =
    /(?:^|\s)(\d{1,3})\s*(?:[).:\-–]\s*|\s+)\s*([A-DАБВГ1-4])(?=\s|$|[).,;])/giu;

  function collectPairsFromRegion({ region, regionStart, pageNumber, baseText }) {
    const pairs = [];
    const pairRe = new RegExp(pairReSource.source, pairReSource.flags);
    let pair = pairRe.exec(region);
    while (pair) {
      const qNum = Math.trunc(Number(pair[1]));
      const rawToken = String(pair[2] || "").trim();
      const letter = normalizeOptionToken(rawToken);
      if (Number.isFinite(qNum) && qNum >= 1 && qNum <= 999 && /^[A-D]$/.test(letter)) {
        pairs.push({
          absIndex: regionStart + pair.index,
          baseText: String(baseText || ""),
          letter,
          pageNumber,
          qNum,
          raw: rawToken,
          text: pair[0],
        });
      }
      pair = pairRe.exec(region);
    }

    return pairs;
  }

  function insertPairs(pairs) {
    for (const hit of pairs) {
      if (index.has(hit.qNum)) continue;
      const evidence = String(hit.baseText || "")
        .slice(
          Math.max(0, hit.absIndex - 24),
          Math.min(String(hit.baseText || "").length, hit.absIndex + hit.text.length + 24),
        )
        .replace(/\s+/g, " ")
        .trim();
      index.set(hit.qNum, {
        evidence,
        letter: hit.letter,
        raw: hit.raw,
        pageNumber: hit.pageNumber,
      });
    }
  }

  for (const page of pages) {
    const text = String(page?.text || "");
    const keyMarkers = new RegExp(keyMarkersSource.source, keyMarkersSource.flags);
    let marker = keyMarkers.exec(text);
    let markerPairs = 0;
    while (marker) {
      const regionStart = marker.index;
      const region = text.slice(regionStart, Math.min(text.length, regionStart + 2000));
      const pairs = collectPairsFromRegion({
        baseText: text,
        pageNumber: page.pageNumber,
        region,
        regionStart,
      });
      markerPairs += pairs.length;
      insertPairs(pairs);
      marker = keyMarkers.exec(text);
    }

    // If the page looks like an answer table but doesn't have a clear "Хариу/Answers" header,
    // detect by density (many "12-A 13-C ..." pairs).
    if (markerPairs === 0) {
      const pairs = collectPairsFromRegion({
        baseText: text,
        pageNumber: page.pageNumber,
        region: text.slice(0, Math.min(text.length, 2200)),
        regionStart: 0,
      });
      // If not dense enough, we don't treat it as an answer key page.
      if (pairs.length >= 6) {
        insertPairs(pairs);
      }
    }
  }

  return index;
}

function extractAnswerLetterNear(text) {
  const raw = String(text || "");
  const re =
    /(зөв\s*хариу|хариу|answer)\s*[:\-–]\s*([A-DАБВГ1-4])(?=\s|$|[).,;])/iu;
  const match = raw.match(re);
  if (!match) return null;
  const rawToken = String(match[2] || "").trim();
  const letter = normalizeOptionToken(rawToken);
  if (!/^[A-D]$/.test(letter)) return null;
  const evidence = String(match[0] || "").replace(/\s+/g, " ").trim();
  const cutIndex = match.index ?? -1;
  return { cutIndex, evidence, letter, raw: rawToken };
}

function cleanQuestionText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractNumericAnswerNear(text) {
  const raw = String(text || "");
  const re =
    /(зөв\s*хариу|хариу|answer)\s*(?:[:\-–]\s*)?([+-]?\d+(?:[.,]\d+)?)(?=\s|$|[).,;])/iu;
  const match = raw.match(re);
  if (!match) return null;
  const token = String(match[2] || "").trim();
  const normalized = token.replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  const evidence = String(match[0] || "").replace(/\s+/g, " ").trim();
  const cutIndex = match.index ?? -1;
  return { cutIndex, evidence, number: num, raw: token };
}

function extractMcqFromPages({ pages, answerKeyIndex, questionCount }) {
  const out = [];
  const skippedNoAnswer = new Set();
  const labelTokenSource = /(?:^|\s|\()([A-DАБВГ1-4])\s*[\).:\-–]\s*/giu;
  const qStartTokenSource = /(?:^|\s)(?:№\s*)?(\d{1,3})\s*[\).:\-–]\s*/giu;

  for (const page of pages) {
    const text = cleanQuestionText(page?.text || "");
    if (!text) continue;

    const labels = [];
    const labelRe = new RegExp(labelTokenSource.source, labelTokenSource.flags);
    let m = labelRe.exec(text);
    while (m) {
      const rawToken = String(m[1] || "").trim();
      const normalized = normalizeOptionToken(rawToken);
      if (!normalized) {
        m = labelRe.exec(text);
        continue;
      }
      labels.push({
        end: labelRe.lastIndex,
        index: m.index,
        letter: normalized,
        raw: rawToken,
      });
      m = labelRe.exec(text);
    }

    for (let i = 0; i < labels.length && out.length < questionCount; i += 1) {
      const a = labels[i];
      if (a.letter !== "A") continue;

      const b = labels[i + 1];
      const c = labels[i + 2];
      const d = labels[i + 3];
      if (!b || !c || !d) continue;
      if (b.letter !== "B" || c.letter !== "C" || d.letter !== "D") continue;

      const span = d.end - a.index;
      if (span < 40 || span > 900) continue;

      const lookbackStart = Math.max(0, a.index - 260);
      const lookback = text.slice(lookbackStart, a.index);
      let qStart = null;
      const qStartRe = new RegExp(qStartTokenSource.source, qStartTokenSource.flags);
      let qMatch = qStartRe.exec(lookback);
      while (qMatch) {
        qStart = { index: qMatch.index, number: Math.trunc(Number(qMatch[1])) };
        qMatch = qStartRe.exec(lookback);
      }
      if (!qStart || !Number.isFinite(qStart.number) || qStart.number < 1) {
        continue;
      }

      const questionStartIdx = lookbackStart + qStart.index;
      const questionText = text.slice(questionStartIdx, a.index).trim();
      if (questionText.length < 12 || questionText.length > 320) continue;

      const choiceAFull = text.slice(a.index, b.index).trim();
      const choiceBFull = text.slice(b.index, c.index).trim();
      const choiceCFull = text.slice(c.index, d.index).trim();
      let choiceDFull = text.slice(d.index, Math.min(text.length, d.index + 320)).trim();

      const answerNear = extractAnswerLetterNear(choiceDFull);
      let localEvidence = "";
      let localLetter = "";
      let localRaw = "";
      if (answerNear) {
        localEvidence = answerNear.evidence;
        localLetter = answerNear.letter;
        localRaw = answerNear.raw;
        if (Number.isFinite(answerNear.cutIndex) && answerNear.cutIndex >= 0) {
          choiceDFull = choiceDFull.slice(0, answerNear.cutIndex).trim();
        }
      }

      if (
        !choiceAFull ||
        !choiceBFull ||
        !choiceCFull ||
        !choiceDFull ||
        choiceAFull.length > 260 ||
        choiceBFull.length > 260 ||
        choiceCFull.length > 260 ||
        choiceDFull.length > 260
      ) {
        continue;
      }

      const keyEntry = answerKeyIndex.get(qStart.number);
      const correctLetter = localLetter || keyEntry?.letter || "";
      const correctRaw = localRaw || keyEntry?.raw || "";
      if (!/^[A-D]$/.test(correctLetter)) {
        skippedNoAnswer.add(qStart.number);
        continue;
      }

      const sourcePages = new Set([page.pageNumber]);
      let evidence = localEvidence;
      if (!evidence && keyEntry?.evidence) {
        evidence = keyEntry.evidence;
      }
      if (!localLetter && keyEntry?.pageNumber) {
        sourcePages.add(keyEntry.pageNumber);
      }

      const excerpt = text.slice(questionStartIdx, Math.min(text.length, questionStartIdx + 160)).trim();
      if (excerpt.replace(/\s+/g, "").length < 24) continue;

      out.push({
        question: questionText,
        choices: [
          choiceAFull,
          choiceBFull,
          choiceCFull,
          choiceDFull,
        ],
        correct_answer: correctLetter,
        ...(correctRaw ? { correct_answer_raw: correctRaw } : {}),
        explanation: evidence ? `Номон дээрх хариу түлхүүр: ${evidence}` : "Номын хариу түлхүүрээс.",
        difficulty: "medium",
        type: "factual",
        source_pages: Array.from(sourcePages).sort((x, y) => x - y),
        source_excerpt: excerpt,
      });
    }
  }

  return {
    questions: dedupeQuestions(out).slice(0, questionCount),
    skippedNoAnswerCount: skippedNoAnswer.size,
  };
}

function normalizeDedupeKey(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

const STOP_WORDS = new Set(
  [
    // Mongolian (common)
    "ба",
    "бол",
    "нь",
    "энэ",
    "тэр",
    "тухай",
    "гэсэн",
    "гэх",
    "гэж",
    "эсвэл",
    "дээр",
    "доор",
    "дотор",
    "гадна",
    "хий",
    "хийнэ",
    "байна",
    "байх",
    "болно",
    "биш",
    "ямар",
    "яаж",
    "яагаад",
    "хэд",
    "хаана",
    "хэзээ",
    "аль",
    "тэгээд",
    "тиймээс",
    "тийм",
    "сонго",
    "сонгоно",
    "сонгох",
    // English (common)
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "it",
    "this",
    "that",
  ].map((w) => w.toLowerCase()),
);

function extractWordPool(pageText, limit = 600) {
  const cleaned = String(pageText || "")
    .replace(/\[Page\s+\d+\]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const words = cleaned.match(/[\p{L}]{3,}/gu) || [];
  const out = [];
  const seen = new Set();
  for (const raw of words) {
    const word = String(raw || "").trim();
    const key = word.toLowerCase();
    if (!word) continue;
    if (STOP_WORDS.has(key)) continue;
    if (key.length < 3 || key.length > 22) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

function pickBlankCandidateFromSnippet(snippet) {
  const text = String(snippet || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const withoutQNum = text.replace(/^(?:№\s*)?\d{1,3}\s*[\).:\-–]\s*/iu, "").trim();
  const candidateText = withoutQNum || text;

  const numbers = candidateText.match(/[+-]?\d+(?:[.,]\d+)?/g) || [];
  if (numbers.length > 0) {
    const token = numbers.map((n) => String(n).trim()).find((n) => n && n.length <= 14);
    if (token) {
      const num = Number(token.replace(",", "."));
      if (Number.isFinite(num)) {
        return { token, type: "number", value: num };
      }
    }
  }

  const words = candidateText.match(/[\p{L}]{3,}/gu) || [];
  for (const rawWord of words) {
    const word = String(rawWord || "").trim();
    const key = word.toLowerCase();
    if (!word) continue;
    if (STOP_WORDS.has(key)) continue;
    if (key.length < 3 || key.length > 22) continue;
    return { token: word, type: "word", value: word };
  }

  return null;
}

function replaceFirstOccurrence(text, token, replacement) {
  const source = String(text || "");
  const needle = String(token || "");
  if (!source || !needle) return source;
  const idx = source.indexOf(needle);
  if (idx < 0) return source;
  return `${source.slice(0, idx)}${replacement}${source.slice(idx + needle.length)}`;
}

function buildWordChoices({ correctWord, wordPool, seed }) {
  const correct = String(correctWord || "").trim();
  if (!correct) return null;

  const candidates = (Array.isArray(wordPool) ? wordPool : [])
    .map((w) => String(w || "").trim())
    .filter(Boolean)
    .filter((w) => w.toLowerCase() !== correct.toLowerCase());

  const wrong = [];
  for (let i = 0; i < candidates.length && wrong.length < 3; i += 1) {
    const pick = candidates[(i + seed) % candidates.length];
    if (!pick) continue;
    if (wrong.some((w) => w.toLowerCase() === pick.toLowerCase())) continue;
    wrong.push(pick);
  }

  while (wrong.length < 3) {
    wrong.push(`(буруу) ${correct}${wrong.length + 1}`);
  }

  const unlabeled = shuffleChoices([correct, ...wrong.slice(0, 3)]);
  const labeled = unlabeled.map((item, idx) => normalizeChoiceText(item, idx));
  const correctIndex = unlabeled.findIndex((item) => item.toLowerCase() === correct.toLowerCase());

  return {
    choices: labeled,
    correctAnswer: CHOICE_LABELS[correctIndex >= 0 ? correctIndex : 0],
  };
}

function buildClozeQuestionsFromRawMatches({
  existingQuestions,
  questionCount,
  rawMatches,
  wordPool,
}) {
  const out = [];
  const existing = new Set(
    (Array.isArray(existingQuestions) ? existingQuestions : [])
      .map((q) => normalizeDedupeKey(q?.question)),
  );

  const matches = Array.isArray(rawMatches) ? rawMatches : [];
  for (let i = 0; i < matches.length && out.length < questionCount; i += 1) {
    const match = matches[i];
    const pageNumber = Math.trunc(Number(match?.pageNumber));
    const snippet = String(match?.text || "").replace(/\s+/g, " ").trim();
    if (!snippet) continue;
    if (!Number.isFinite(pageNumber) || pageNumber < 1) continue;

    const blank = pickBlankCandidateFromSnippet(snippet);
    if (!blank) continue;

    const questionSentence = replaceFirstOccurrence(snippet, blank.token, "_____");
    const questionText = `Хоосон зайд тохирох үгийг сонго: ${questionSentence}`;
    const key = normalizeDedupeKey(questionText);
    if (!key || existing.has(key)) continue;
    existing.add(key);

    let optionSet = null;
    const correctRaw = String(blank.token || "").trim();

    if (blank.type === "number") {
      const optionValues = buildNumericChoices(blank.value, i + pageNumber);
      if (optionValues.length >= 4) {
        const mixed = shuffleChoices(optionValues);
        const correctText = formatMathValue(blank.value);
        const correctIndex = mixed.findIndex((v) => normalizeKey(v) === normalizeKey(correctText));
        optionSet = {
          choices: mixed.map((value, idx) => normalizeChoiceText(value, idx)),
          correctAnswer: CHOICE_LABELS[correctIndex >= 0 ? correctIndex : 0],
        };
      }
    } else {
      optionSet = buildWordChoices({
        correctWord: blank.value,
        seed: i + pageNumber,
        wordPool,
      });
    }

    if (!optionSet || !Array.isArray(optionSet.choices) || optionSet.choices.length !== 4) {
      continue;
    }

    out.push({
      question: questionText,
      choices: optionSet.choices,
      correct_answer: optionSet.correctAnswer,
      ...(correctRaw ? { correct_answer_raw: correctRaw } : {}),
      explanation: `Эх текстээс: "${snippet.slice(0, 180)}"`,
      difficulty: "easy",
      type: "factual",
      source_pages: [pageNumber],
      source_excerpt: snippet.slice(0, 160),
    });
  }

  return out;
}

function extractNumericMcqFromRawMatches({ rawMatches, questionCount, existingQuestions }) {
  const out = [];
  const existing = new Set(
    (Array.isArray(existingQuestions) ? existingQuestions : [])
      .map((q) => normalizeDedupeKey(q?.question)),
  );

  const matches = Array.isArray(rawMatches) ? rawMatches : [];
  for (let i = 0; i < matches.length && out.length < questionCount; i += 1) {
    const match = matches[i];
    const pageNumber = Math.trunc(Number(match?.pageNumber));
    const text = String(match?.text || "").replace(/\s+/g, " ").trim();
    if (!text || !Number.isFinite(pageNumber) || pageNumber < 1) continue;

    const numericAnswer = extractNumericAnswerNear(text);
    if (!numericAnswer) continue;

    const beforeAnswer =
      Number.isFinite(numericAnswer.cutIndex) && numericAnswer.cutIndex >= 0
        ? text.slice(0, numericAnswer.cutIndex).trim()
        : text;

    const questionText = beforeAnswer.replace(/\s+/g, " ").trim();
    if (questionText.length < 16 || questionText.length > 520) continue;

    const dedupeKey = normalizeDedupeKey(questionText);
    if (!dedupeKey || existing.has(dedupeKey)) continue;
    existing.add(dedupeKey);

    const optionValues = buildNumericChoices(numericAnswer.number, i + pageNumber);
    if (optionValues.length < 4) continue;
    const mixed = shuffleChoices(optionValues);
    const correctText = formatMathValue(numericAnswer.number);
    const correctIndex = mixed.findIndex((v) => normalizeKey(v) === normalizeKey(correctText));
    const labeledChoices = mixed.map((value, idx) => normalizeChoiceText(value, idx));

    out.push({
      question: questionText,
      choices: labeledChoices,
      correct_answer: CHOICE_LABELS[correctIndex >= 0 ? correctIndex : 0],
      correct_answer_raw: numericAnswer.raw,
      explanation: `Номон дээрх хариу: ${numericAnswer.evidence}`,
      difficulty: "medium",
      type: "analytical",
      source_pages: [pageNumber],
      source_excerpt: questionText.slice(0, 160),
    });
  }

  return out;
}

function extractRawQuestionSnippetsFromPages({ pages, limit = 120 }) {
  const out = [];
  const seen = new Set();

  const questionStartReSource = /(?:^|\s)(?:№\s*)?(\d{1,3})\s*[\).:\-–]\s+/giu;
  const keywordStartReSource =
    /\b(Бодлого|Даалгавар|Асуулт|Жишээ|Exercise|Example|Problem)\s*(\d{0,3})\b/giu;

  for (const page of pages) {
    const text = String(page?.text || "");
    if (!text.trim()) continue;

    const startMatches = [];
    const questionStartRe = new RegExp(questionStartReSource.source, questionStartReSource.flags);
    let match = questionStartRe.exec(text);
    while (match) {
      startMatches.push({
        index: match.index,
        pageNumber: page.pageNumber,
      });
      match = questionStartRe.exec(text);
    }

    const keywordStartRe = new RegExp(keywordStartReSource.source, keywordStartReSource.flags);
    match = keywordStartRe.exec(text);
    while (match && startMatches.length < 200) {
      startMatches.push({
        index: match.index,
        pageNumber: page.pageNumber,
      });
      match = keywordStartRe.exec(text);
    }

    startMatches.sort((a, b) => a.index - b.index);

    for (let i = 0; i < startMatches.length && out.length < limit; i += 1) {
      const start = startMatches[i];
      const next = startMatches[i + 1];
      const endIndex = next ? next.index : text.length;
      if (endIndex <= start.index) continue;

      const snippet = text.slice(start.index, endIndex).trim();
      if (snippet.length < 16) continue;
      if (snippet.length > 2200) continue;

      const key = normalizeDedupeKey(snippet);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        pageNumber: start.pageNumber,
        text: snippet,
      });
    }

    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

function buildPrompt({
  mode = "generate",
  pageText,
  questionCount,
  excludedQuestions,
  avoidArithmeticDrills = true,
}) {
  const exclusionText =
    excludedQuestions && excludedQuestions.length
      ? `
Өмнө нь гарсан асуултууд (давтахгүй):
${excludedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
`
      : "";

  const avoidText = avoidArithmeticDrills
    ? `
ЧАНАРЫН ШААРДЛАГА (маш чухал):
- "5 - 3 = ?" / "2 + 2 = ?" гэх мэт 1 алхмын хэт энгийн арифметик drill асуулт БҮҮ гарга.
- Асуулт бүр нь өгөгдсөн номын текст/бодлогоос ШУУД ГАРСАН байх. ШИНЭ бодлогын нөхцөл, тоон өгөгдөл, контекст ЗОХИОХГҮЙ.
- Эх бодлогын МӨР/өгүүлбэрийг өөр үг хэлбэрээр асуулт болгож болно, ГЭХДЭЭ тоо, тэмдэгт, нөхцөл, зорилгыг нь ӨӨРЧЛӨХГҮЙ.
- Зөвхөн бүрэн тодорхой, тооцоолол эсвэл бодлого шийдэх даалгавар гарга. Зөвхөн тодорхойлолт асуусан, цэвэр онолын, эсвэл "ярилц" маягийн асуулт БҮҮ гарга.
- "..." хоосон орон, доогуур зураас, _ , __ гэх мэт хоосон зай бөглөөдөг fill‑in‑the‑blank асуулт БҮҮ гарга. Зөвхөн 4 сонголттой (MCQ) асуулт гарга.
- Зөвхөн medium болон hard түвшний асуулт гарга. easy түвшний асуулт БҮҮ гарга.
- Тайлбар нь алхамтай, ойлгомжтой, зөвхөн эх текст дэх мэдээлэлд тулгуурласан байна (гадаад мэдлэг, таамаглал бүү ашигла).
`
    : "";

  const safeMode = String(mode || "").trim().toLowerCase() === "extract" ? "extract" : "generate";
  const candidateExercises =
    safeMode === "extract" ? pickExerciseCandidates(pageText).slice(0, 60) : [];
  const candidateText =
    candidateExercises.length
      ? `
ДАРААХ НЬ TEXT-ЭЭС ШУУД ОЛСОН "БОДЛОГО / АСУУЛТ" МАГАДЛАЛТАЙ МӨРҮҮД.
ЧИ АСУУЛТАА ЭНЭ ЖАГСААЛТААС Л СОНГОЖ АВААРАЙ (character-for-character ойролцоо хуул).

EXERCISE_CANDIDATES:
${candidateExercises.map((line, idx) => `${idx + 1}. ${line}`).join("\n")}
`
      : "";

  const modeText =
    safeMode === "extract"
      ? `
MODE: EXTRACT (маш чухал)
- Чи шинэ бодлого ЗОХИОХГҮЙ.
- Зөвхөн TEXT дотор АЛЬ ХЭДИЙНЭЭ БИЙ байгаа бодлого/асуултыг л ашиглана. Хэрвээ A/B/C/D тест хэлбэрт оруулаагүй байвал ЗӨВХӨН тухайн бодлогын утгыг АЛДАЛГҮЙ дахин бичиж, 4 сонголт зохион байгуулж болно.
- Сонголтууд (choices) болон зөв хариу (correct_answer) нь TEXT-ээс үг үсгээр нь хуулсан байх ёстой. (шинээр зохиож бөглөхгүй)
- Хэрвээ тухайн асуултын зөв хариу нь TEXT дотор (хариултын түлхүүр/шийд/хариу) байдлаар тодорхой бичигдээгүй бол ТЭР асуултыг алгас.
- "question" талбар нь TEXT (эсвэл EXERCISE_CANDIDATES)-ээс шууд хуулсан байх ёстой.
- Хэрвээ TEXT дотор бодлого/асуулт үнэхээр олдохгүй бол [] буцаа.
`
      : `
MODE: GENERATE
- TEXT дээр тулгуурлаж шалгалтын асуулт үүсгэнэ.
- Шинэ бодлого, өгөгдөл, нөхцөл зохиож болохгүй. Зөвхөн TEXT дотор байгаа бодлого, жишээг АСУУЛТ + 4 СОНГОЛТ хэлбэрт оруул.
`;

  return `
Чи бол туршлагатай боловсролын багш, ном уншиж чанартай шалгалтын асуулт гаргадаг AI.

Доорх нь хэрэглэгчийн сонгосон номын page-уудын текст.

${modeText}

Чиний даалгавар:
1. Текстийг анхааралтай унш
2. Тухайн текст доторх БОДЛОГО / ДААЛГАВАР / ЖИШЭЭ дээр тулгуурласан ${questionCount} чанартай шалгалтын асуулт гарга
3. Асуулт бүрт 4 сонголт өг (A, B, C, D)
4. ЯГ 1 зөв хариу, 3 буруу (гэхдээ төөрөгдүүлэхүйц) сонголттой бай
5. Зөв хариуг тодорхой тэмдэглэ
6. Асуулт бүрт богино тайлбар нэм (алхамчилсан, зөвхөн эх текстээс)
7. Асуулт бүрт difficulty (easy / medium / hard) заавал оруул
8. Асуулт бүрт type (factual / conceptual / analytical) заавал оруул
9. Давхардсан асуулт гаргахгүй
10. Хэт ерөнхий асуулт гаргахгүй, зөвхөн өгөгдсөн текст дээр тулгуурласан байх
11. Асуулт бүрт source_pages ба source_excerpt нэм (эх текстээс 1 мөр/хэсгийг яг хуулж)

JSON ДҮРЭМ:
- choices нь ЯГ 4 ширхэг байна
- correct_answer нь зөвхөн A, B, C, D-ийн нэг байна
- correct_answer заасан сонголт нь тайлбартайгаа зөрөхгүй байна
- source_pages нь [1, 2] хэлбэртэй тоонуудын массив байна
- source_excerpt нь TEXT хэсгээс үг үсгээр нь хуулсан богино ишлэл байна (160 тэмдэгтээс ихгүй)
- JSON-оос өөр текст БИТГИЙ нэм

OUTPUT FORMAT (JSON):
[
  {
    "question": "...",
    "choices": ["A ...", "B ...", "C ...", "D ..."],
    "correct_answer": "A",
    "explanation": "...",
    "difficulty": "easy",
    "type": "factual",
    "source_pages": [12],
    "source_excerpt": "..."
  }
]

ХЭРВЭЭ текст хангалтгүй эсвэл ойлгомжгүй бол:
- арай бага асуулт гаргаж болно
- таамаг бүү хий

${avoidText}
${exclusionText}
${candidateText}
TEXT:
${pageText}
`.trim();
}

function isTrivialArithmeticQuestion(questionText) {
  const q = String(questionText || "").replace(/\s+/g, " ").trim();
  if (!q) return false;

  const normalized = q
    .replace(/[−–—]/g, "-")
    .replace(/[×∙·]/g, "*")
    .replace(/÷/g, "/");

  const simpleForm =
    /^-?\d+(?:[.,]\d+)?\s*[+\-*/]\s*-?\d+(?:[.,]\d+)?\s*=\s*\?$/;
  const hasOnlyMath = /^[\d\s+\-*/=?.(),]+$/.test(normalized);
  if (simpleForm.test(q)) return true;
  if (simpleForm.test(normalized)) return true;
  if (hasOnlyMath && normalized.length <= 26 && normalized.includes("?")) return true;
  return false;
}

function filterTrivialArithmetic(questions) {
  return (Array.isArray(questions) ? questions : []).filter(
    (q) => !isTrivialArithmeticQuestion(q?.question),
  );
}

function normalizeForGrounding(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function extractPageNumbersFromMarkers(pageText) {
  const set = new Set();
  const re = /\[Page\s+(\d+)\]/gi;
  let match = re.exec(String(pageText || ""));
  while (match) {
    const n = Math.trunc(Number(match[1]));
    if (Number.isFinite(n) && n >= 1) set.add(n);
    match = re.exec(String(pageText || ""));
  }
  return set;
}

function isGroundedQuestion(
  question,
  normalizedText,
  allowedPages,
  { requireQuestionMatch = false } = {},
) {
  const excerpt = String(question?.source_excerpt || "").trim();
  if (!excerpt) return false;
  const normalizedExcerpt = normalizeForGrounding(excerpt);
  const minExcerptLength = requireQuestionMatch ? 8 : 6;
  if (normalizedExcerpt.length < minExcerptLength) return false;
  if (!normalizedText.includes(normalizedExcerpt)) return false;

  if (requireQuestionMatch) {
    const qText = String(question?.question || "").trim();
    if (qText.length < 6) return false;
    const normalizedQ = normalizeForGrounding(qText);
    if (normalizedQ.length < 6) return false;
    if (!normalizedText.includes(normalizedQ)) return false;
  }

  const pages = Array.isArray(question?.source_pages) ? question.source_pages : [];
  const numericPages = pages
    .map((v) => Math.trunc(Number(v)))
    .filter((v) => Number.isFinite(v) && v >= 1);
  if (!numericPages.length) return false;
  if (allowedPages && allowedPages.size) {
    if (!numericPages.some((p) => allowedPages.has(p))) return false;
  }
  return true;
}

function filterGroundedQuestions(questions, pageText, options) {
  const normalizedText = normalizeForGrounding(pageText);
  const allowedPages = extractPageNumbersFromMarkers(pageText);
  return (Array.isArray(questions) ? questions : []).filter((q) =>
    isGroundedQuestion(q, normalizedText, allowedPages, options),
  );
}

function pickExerciseCandidates(pageText) {
  const cleaned = String(pageText || "")
    .replace(/\[Page\s+\d+\]\s*/gi, "\n")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const lines = cleaned
    .split(/(?:(?:\r?\n)+|(?<=\?)\s+|(?<=\.)\s{2,})/g)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const looksLikeExercise = (line) => {
    const t = String(line || "");
    if (t.length < 18 || t.length > 260) return false;
    if (/[?？]$/.test(t) || /[?？]\s*$/.test(t)) return true;
    if (/^\(?\d{1,3}[\).:-]\s+/.test(t)) return true;
    if (/(Бодлого|Даалгавар|Асуулт|Жишээ|Exercise|Example|Problem)\b/i.test(t)) return true;
    return false;
  };

  return uniqueModels(lines.filter(looksLikeExercise));
}

function splitTextIntoTwoChunks(pageText) {
  const text = String(pageText || "").trim();
  if (!text) return [];

  const markerRegex = /\[Page\s+\d+\]/g;
  const markerIndices = [];
  for (const match of text.matchAll(markerRegex)) {
    markerIndices.push(match.index);
  }

  const midpoint = Math.floor(text.length / 2);
  let splitAt = -1;

  if (markerIndices.length > 1) {
    splitAt = markerIndices.reduce((best, current) => (
      Math.abs(current - midpoint) < Math.abs(best - midpoint) ? current : best
    ), markerIndices[0]);
  }

  if (splitAt <= 0 || splitAt >= text.length - 1) {
    splitAt = midpoint;
  }

  const first = text.slice(0, splitAt).trim();
  const second = text.slice(splitAt).trim();

  if (!first || !second) {
    return [text];
  }

  return [first, second];
}

function pickCandidateSentences(pageText) {
  const cleaned = String(pageText || "").replace(/\[Page\s+\d+\]\s*/gi, " ");
  const chunks = cleaned.split(/[\n\r]+|(?<=[.!?])\s+/);

  const isGarbled = (line) => {
    const text = String(line || "");
    const total = text.length || 1;
    const letters = (text.match(/[\p{L}\p{N}]/gu) || []).length;
    const symbols = (text.match(/[^\p{L}\p{N}\s.,;:!?()[\]{}\-+*/=<>%'"`~@#$^&_\\|]/gu) || []).length;
    const symbolRatio = symbols / total;
    const letterRatio = letters / total;
    return symbolRatio > 0.24 || letterRatio < 0.45;
  };

  const normalized = chunks
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 18 && line.length <= 220)
    .filter((line) => !isGarbled(line));

  return uniqueModels(normalized);
}

function mutateSentence(sentence, seed) {
  const text = String(sentence || "").trim();
  if (!text) return "Эх тексттэй тохирохгүй өгүүлбэр.";

  if (/\d+/.test(text)) {
    return text.replace(/\d+/, (match) => String(Number(match) + (seed % 3) + 1));
  }

  if (seed % 2 === 0) {
    return `Энэ өгүүлбэр эх текстэд байхгүй байж болно: ${text}`;
  }

  return `${text} (өөрчилсөн хувилбар)`;
}

function formatMathValue(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 1e-10) return "0";
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(3)).toString();
}

function computeArithmetic(a, op, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/" && b !== 0) return a / b;
  return null;
}

function buildNumericChoices(correctValue, seed) {
  const answer = Number(correctValue);
  if (!Number.isFinite(answer)) return [];

  const choices = [formatMathValue(answer)];
  const deltas = Number.isInteger(answer)
    ? [1, -1, 2, -2, 3, -3]
    : [0.5, -0.5, 1, -1, 1.5, -1.5];
  for (let i = 0; i < deltas.length; i += 1) {
    const v = answer + deltas[(i + seed) % deltas.length];
    const t = formatMathValue(v);
    if (!t || choices.includes(t)) continue;
    choices.push(t);
    if (choices.length >= 4) break;
  }

  while (choices.length < 4) {
    const noise = formatMathValue(answer + (choices.length + seed + 1) * 2);
    if (!noise || choices.includes(noise)) break;
    choices.push(noise);
  }

  return choices.slice(0, 4);
}

function extractArithmeticProblems(pageText) {
  const cleaned = String(pageText || "").replace(/\[Page\s+\d+\]\s*/gi, " ");
  const out = [];
  const seen = new Set();
  const re = /(-?\d+(?:[.,]\d+)?)\s*([+\-*/])\s*(-?\d+(?:[.,]\d+)?)/g;

  let match = re.exec(cleaned);
  while (match && out.length < 100) {
    const a = Number(String(match[1]).replace(",", "."));
    const b = Number(String(match[3]).replace(",", "."));
    const op = match[2];

    const answer = computeArithmetic(a, op, b);
    if (Number.isFinite(answer)) {
      const text = `${formatMathValue(a)} ${op} ${formatMathValue(b)}`;
      const key = `${text}=${formatMathValue(answer)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ a, answer, b, expr: text, op });
      }
    }

    match = re.exec(cleaned);
  }

  return out;
}

function extractNumberPool(pageText) {
  const cleaned = String(pageText || "").replace(/\[Page\s+\d+\]\s*/gi, " ");
  const raw = cleaned.match(/-?\d+(?:[.,]\d+)?/g) || [];
  const nums = raw
    .map((v) => Number(String(v).replace(",", ".")))
    .filter((v) => Number.isFinite(v))
    .filter((v) => Math.abs(v) <= 100000);
  return nums;
}

function buildMathDrillQuestion({ index, a, b, op }) {
  const answer = computeArithmetic(a, op, b);
  if (!Number.isFinite(answer)) return null;

  const optionValues = buildNumericChoices(answer, index);
  if (optionValues.length < 4) return null;

  const mixed = shuffleChoices(optionValues);
  const correctText = formatMathValue(answer);
  const correctIndex = mixed.findIndex((v) => v === correctText);
  const labeledChoices = mixed.map((value, idx) => normalizeChoiceText(value, idx));

  return {
    question: `${formatMathValue(a)} ${op} ${formatMathValue(b)} = ?`,
    choices: labeledChoices,
    correct_answer: CHOICE_LABELS[correctIndex >= 0 ? correctIndex : 0],
    explanation: `Зөв бодвол хариу нь ${correctText} гарна.`,
    difficulty: "easy",
    type: "analytical",
  };
}

function shuffleChoices(choices) {
  const arr = choices.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildLocalFallbackQuestions({ pageText, questionCount }) {
  const candidates = pickCandidateSentences(pageText);
  if (!candidates.length) return [];

  const sentenceOut = [];
  for (let i = 0; i < questionCount; i += 1) {
    const correct = candidates[i % candidates.length];
    const wrong = [];

    for (let k = 1; k < candidates.length && wrong.length < 3; k += 1) {
      const candidate = candidates[(i + k) % candidates.length];
      if (candidate !== correct && !wrong.includes(candidate)) {
        wrong.push(candidate);
      }
    }

    while (wrong.length < 3) {
      wrong.push(mutateSentence(correct, i + wrong.length));
    }

    const mixed = shuffleChoices([correct, ...wrong].slice(0, 4));
    const correctIndex = mixed.indexOf(correct);
    const labeledChoices = mixed.map((choice, idx) => normalizeChoiceText(choice, idx));

    sentenceOut.push({
      question: `Дараах өгүүлбэрүүдээс эх текстэд хамгийн ойр зөв хувилбарыг сонгоно уу. (#${i + 1})`,
      choices: labeledChoices,
      correct_answer: CHOICE_LABELS[correctIndex] || "A",
      explanation: "Зөв хариулт нь эх текстээс яг тэр хэвээрээ авсан өгүүлбэр.",
      difficulty: "easy",
      type: "factual",
    });
  }

  return sentenceOut;
}

async function requestOllama({ model, prompt, timeoutMs, baseUrl }) {
  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/+$/, "")}/api/generate`,
      {
        model,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
      },
    );

    if (!response.data || typeof response.data.response !== "string") {
      throw createAppError("Ollama хариу буруу бүтэцтэй ирлээ.", 502);
    }

    return response.data.response;
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    if (error.code === "ECONNABORTED") {
      throw createAppError(
        "Ollama хариулах хугацаа хэтэрлээ. `OLLAMA_TIMEOUT_MS`-оо өсгөж үзнэ үү.",
        504,
      );
    }

    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      throw createAppError(
        `Ollama серверт холбогдож чадсангүй (${baseUrl}). Ollama асаалттай эсэхээ шалгана уу.`,
        502,
      );
    }

    if (
      error.response &&
      error.response.data &&
      typeof error.response.data === "object" &&
      typeof error.response.data.error === "string"
    ) {
      const appError = createAppError(`Ollama алдаа: ${error.response.data.error}`, 502);
      if (isModelNotFoundError(error.response.data.error)) {
        appError.code = "OLLAMA_MODEL_NOT_FOUND";
      }
      throw appError;
    }

    throw createAppError(
      `Ollama хүсэлт амжилтгүй боллоо: ${error.message || "Тодорхойгүй алдаа"}`,
      502,
    );
  }
}

async function requestGemini({
  apiKey,
  baseUrl,
  model,
  prompt,
  timeoutMs,
}) {
  if (!cleanModelName(apiKey)) {
    throw createAppError("`GEMINI_API_KEY` тохируулаагүй байна.", 500);
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await axios.post(
      `${url}?key=${encodeURIComponent(apiKey)}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
      },
    );

    const candidate = Array.isArray(response?.data?.candidates)
      ? response.data.candidates[0]
      : null;
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    const text = parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();

    if (!text) {
      throw createAppError("Gemini хариу буруу бүтэцтэй ирлээ.", 502);
    }

    return text;
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    if (error.code === "ECONNABORTED") {
      throw createAppError(
        "Gemini хариулах хугацаа хэтэрлээ. Timeout тохиргоогоо өсгөж үзнэ үү (`OLLAMA_TIMEOUT_MS`).",
        504,
      );
    }

    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      throw createAppError(
        `Gemini серверт холбогдож чадсангүй (${baseUrl}). Сүлжээ эсвэл GEMINI_BASE_URL-оо шалгана уу.`,
        502,
      );
    }

    if (error.response && typeof error.response.data === "object") {
      const rawMessage =
        typeof error.response.data?.error?.message === "string"
          ? error.response.data.error.message
          : "Тодорхойгүй алдаа";
      const appError = createAppError(`Gemini алдаа: ${rawMessage}`, 502);
      if (isModelNotFoundError(rawMessage)) {
        appError.code = "GEMINI_MODEL_NOT_FOUND";
      }
      throw appError;
    }

    throw createAppError(
      `Gemini хүсэлт амжилтгүй боллоо: ${error.message || "Тодорхойгүй алдаа"}`,
      502,
    );
  }
}

async function requestWithModelFallback({
  baseUrl,
  modelCandidates,
  prompt,
  timeoutMs,
}) {
  let lastModelNotFoundError = null;

  for (const model of modelCandidates) {
    try {
      const responseText = await requestOllama({
        baseUrl,
        model,
        prompt,
        timeoutMs,
      });
      return { modelUsed: model, responseText };
    } catch (error) {
      if (error?.code === "OLLAMA_MODEL_NOT_FOUND") {
        lastModelNotFoundError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastModelNotFoundError) {
    throw lastModelNotFoundError;
  }

  throw createAppError("Ollama model сонгох үед тодорхойгүй алдаа гарлаа.", 502);
}

function mergeFallbackReason(...messages) {
  const clean = messages.map((msg) => String(msg || "").trim()).filter(Boolean);
  if (!clean.length) return "";
  return uniqueModels(clean).join(" ");
}

async function generateWithOllama({
  mode,
  pageText,
  questionCount,
  model,
  baseUrl,
  timeoutMs,
}) {
  const safeMode = cleanGenerationMode(mode);
  const installedModels = await listInstalledModels({ baseUrl, timeoutMs });
  const modelRequested = cleanModelName(model) || DEFAULT_OLLAMA_MODEL;
  const modelCandidates = buildModelCandidates({
    requestedModel: modelRequested,
    installedModels,
  });

  const firstPrompt = buildPrompt({
    avoidArithmeticDrills: true,
    excludedQuestions: [],
    mode,
    pageText,
    questionCount,
  });
  let firstResult;
  try {
    firstResult = await requestWithModelFallback({
      baseUrl,
      modelCandidates,
      prompt: firstPrompt,
      timeoutMs,
    });
  } catch (error) {
    if (safeMode === "extract") {
      if (error?.code === "OLLAMA_MODEL_NOT_FOUND") {
        if (installedModels.length > 0) {
          throw createAppError(
            `Ollama дээр "${modelRequested}" model алга байна. Суулгасан model-ууд: ${installedModels.join(", ")}.`,
            502,
          );
        }

        throw createAppError(
          `Ollama дээр "${modelRequested}" model алга байна. Дараах командыг ажиллуулаад дахин оролдоно уу: ollama pull ${modelRequested}`,
          502,
        );
      }

      const status = Number.isFinite(error?.status) ? error.status : 502;
      throw createAppError(
        `EXTRACT горимд бодит номын асуулт авахын тулд Ollama/Gemini ажиллаж байх шаардлагатай. ${error?.message || "Ollama алдаа"}`,
        status,
      );
    }

    if (requireAiEnabled()) {
      throw createAppError(
        `AI ашиглах боломжгүй (${error?.message || "Ollama алдаа"}). REQUIRE_AI=1 тул local fallback ашиглахгүй.`,
        502,
      );
    }

    const localFallbackQuestions = buildLocalFallbackQuestions({
      pageText,
      questionCount,
    });

    if (localFallbackQuestions.length > 0) {
      return {
        installedModels,
        modelRequested,
        modelUsed: LOCAL_FALLBACK_MODEL,
        providerUsed: "local",
        questions: localFallbackQuestions,
        fallbackReason:
          "Ollama ашиглах боломжгүй тул local fallback асуулт үүсгэж харууллаа. Ollama model-оо татаж дуусмагц AI горим автоматаар сэргэнэ.",
      };
    }

    throw error;
  }
  const modelUsed = firstResult.modelUsed;
  const firstParsed = parseQuestionsSafely(firstResult.responseText, { mode: safeMode });
  const firstDedupe = dedupeQuestions(firstParsed);
  const groundingOptions =
    safeMode === "extract" ? { requireQuestionMatch: true } : undefined;
  const initialPool =
    safeMode === "extract" ? firstDedupe : filterTrivialArithmetic(firstDedupe);
  let questions = filterGroundedQuestions(
    initialPool,
    pageText,
    groundingOptions,
  );
  let groundingDropped = Math.max(0, firstDedupe.length - questions.length);

  if (questions.length < questionCount) {
    const missing = questionCount - questions.length;
    const retryPrompt = buildPrompt({
      avoidArithmeticDrills: true,
      excludedQuestions: questions.map((q) => q.question),
      mode,
      pageText,
      questionCount: missing,
    });
    const retryRaw = await requestOllama({
      model: modelUsed,
      prompt: retryPrompt,
      timeoutMs,
      baseUrl,
    });
    const retryParsed = parseQuestionsSafely(retryRaw, { mode: safeMode });
    const merged = dedupeQuestions([...questions, ...retryParsed]);
    const mergedPool =
      safeMode === "extract" ? merged : filterTrivialArithmetic(merged);
    const filtered = filterGroundedQuestions(
      mergedPool,
      pageText,
      groundingOptions,
    );
    groundingDropped += Math.max(0, merged.length - filtered.length);
    questions = filtered;
  }

  if (questions.length === 0) {
    if (safeMode === "extract") {
      return {
        installedModels,
        modelRequested,
        modelUsed,
        providerUsed: "ollama",
        fallbackReason:
          "Сонгосон page range дээр яг текстээс нь танигдах бодлого/асуулт олдсонгүй. Page preview дээр текст зөв уншигдаж байгаа эсэхээ (OCR) шалгаад, бодлого байдаг хэсгээ сонгоод дахин оролдоно уу.",
        groundingDropped,
        questions: [],
      };
    }

    if (!requireAiEnabled()) {
    const localFallbackQuestions = buildLocalFallbackQuestions({
      pageText,
      questionCount,
    });
    if (localFallbackQuestions.length > 0) {
      return {
        installedModels,
        modelRequested,
        modelUsed: LOCAL_FALLBACK_MODEL,
        providerUsed: "local",
        questions: localFallbackQuestions,
        fallbackReason:
          "AI output формат алдагдсан тул local fallback асуулт үүсгэж харууллаа.",
      };
    }
    }

    throw createAppError(
      "AI-аас номын эх текстэд таарсан (source_excerpt-тэй) асуулт гарч ирсэнгүй. Сонгосон page range дээр бодлогын текст/ OCR текст зөв орж ирсэн эсэхээ шалгаад дахин оролдоно уу.",
      502,
    );
  }

  return {
    installedModels,
    modelRequested,
    modelUsed,
    providerUsed: "ollama",
    fallbackReason: "",
    groundingDropped,
    questions: questions.slice(0, questionCount),
  };
}

async function generateWithGemini({
  allowLocalFallback = true,
  apiKey,
  baseUrl,
  model,
  mode,
  pageText,
  questionCount,
  timeoutMs,
}) {
  const modelRequested = cleanModelName(model) || DEFAULT_GEMINI_MODEL;
  const safeMode = cleanGenerationMode(mode);
  const firstPrompt = buildPrompt({
    avoidArithmeticDrills: true,
    excludedQuestions: [],
    mode,
    pageText,
    questionCount,
  });
  let firstRaw;
  try {
    firstRaw = await requestGemini({
      apiKey,
      baseUrl,
      model: modelRequested,
      prompt: firstPrompt,
      timeoutMs,
    });
  } catch (error) {
    if (safeMode === "extract") {
      throw error;
    }

    if (requireAiEnabled()) {
      throw createAppError(
        `AI ашиглах боломжгүй (${error?.message || "Gemini алдаа"}). REQUIRE_AI=1 тул local fallback ашиглахгүй.`,
        502,
      );
    }

    if (allowLocalFallback) {
      const localFallbackQuestions = buildLocalFallbackQuestions({
        pageText,
        questionCount,
      });
      if (localFallbackQuestions.length > 0) {
        return {
          installedModels: [],
          modelRequested,
          modelUsed: LOCAL_FALLBACK_MODEL,
          providerUsed: "local",
          questions: localFallbackQuestions,
          fallbackReason:
            "Gemini ашиглах боломжгүй тул local fallback асуулт үүсгэж харууллаа.",
        };
      }
    }
    throw error;
  }

  const firstParsed = parseQuestionsSafely(firstRaw, { mode: safeMode });
  const firstDedupe = dedupeQuestions(firstParsed);
  const groundingOptions =
    safeMode === "extract" ? { requireQuestionMatch: true } : undefined;
  const initialPool =
    safeMode === "extract" ? firstDedupe : filterTrivialArithmetic(firstDedupe);
  let questions = filterGroundedQuestions(
    initialPool,
    pageText,
    groundingOptions,
  );
  let groundingDropped = Math.max(0, firstDedupe.length - questions.length);
  if (questions.length < questionCount) {
    const missing = questionCount - questions.length;
    const retryPrompt = buildPrompt({
      avoidArithmeticDrills: true,
      excludedQuestions: questions.map((q) => q.question),
      mode,
      pageText,
      questionCount: missing,
    });
    const retryRaw = await requestGemini({
      apiKey,
      baseUrl,
      model: modelRequested,
      prompt: retryPrompt,
      timeoutMs,
    });
    const merged = dedupeQuestions([...questions, ...parseQuestionsSafely(retryRaw, { mode: safeMode })]);
    const mergedPool =
      safeMode === "extract" ? merged : filterTrivialArithmetic(merged);
    const filtered = filterGroundedQuestions(
      mergedPool,
      pageText,
      groundingOptions,
    );
    groundingDropped += Math.max(0, merged.length - filtered.length);
    questions = filtered;
  }

  if (questions.length === 0) {
    if (safeMode === "extract") {
      return {
        installedModels: [],
        modelRequested,
        modelUsed: modelRequested,
        providerUsed: "gemini",
        fallbackReason:
          "Сонгосон page range дээр яг текстээс нь танигдах бодлого/асуулт олдсонгүй. Page preview дээр текст зөв уншигдаж байгаа эсэхээ (OCR) шалгаад, бодлого байдаг хэсгээ сонгоод дахин оролдоно уу.",
        groundingDropped,
        questions: [],
      };
    }

    if (allowLocalFallback && !requireAiEnabled()) {
      const localFallbackQuestions = buildLocalFallbackQuestions({
        pageText,
        questionCount,
      });
      if (localFallbackQuestions.length > 0) {
        return {
          installedModels: [],
          modelRequested,
          modelUsed: LOCAL_FALLBACK_MODEL,
          providerUsed: "local",
          questions: localFallbackQuestions,
          fallbackReason:
            "Gemini output формат алдагдсан тул local fallback асуулт үүсгэж харууллаа.",
        };
      }
    }

    throw createAppError(
      "Gemini-аас номын эх текстэд таарсан (source_excerpt-тэй) асуулт гарч ирсэнгүй. Сонгосон page range дээр бодлогын текст/ OCR текст зөв орж ирсэн эсэхээ шалгаад дахин оролдоно уу.",
      502,
    );
  }

  return {
    installedModels: [],
    modelRequested,
    modelUsed: modelRequested,
    providerUsed: "gemini",
    fallbackReason: "",
    groundingDropped,
    questions: questions.slice(0, questionCount),
  };
}

async function generateBookQuestions({
  allowSplit = true,
  baseUrl,
  answerKeyText,
  fillMode,
  geminiApiKey,
  geminiBaseUrl,
  geminiModel,
  model,
  mode = "generate",
  pageText,
  provider,
  questionCount,
  timeoutMs,
}) {
  const safeMode = cleanGenerationMode(mode);
  const providerRequested = cleanProviderName(provider || process.env.LLM_PROVIDER);

  if (safeMode === "extract") {
    const pages = splitPageSections(pageText);
    const answerKeyPages = splitPageSections(
      typeof answerKeyText === "string" && answerKeyText.trim() ? answerKeyText : pageText,
    );
    const answerKeyIndex = buildAnswerKeyIndex(answerKeyPages);
    const answerKeyPagesFound = uniqueModels(
      Array.from(answerKeyIndex.values())
        .map((item) => Math.trunc(Number(item?.pageNumber)))
        .filter((n) => Number.isFinite(n) && n >= 1),
    ).sort((a, b) => a - b);
    const rawMatches = extractRawQuestionSnippetsFromPages({
      limit: Math.max(40, questionCount * 6),
      pages,
    });
    const extracted = extractMcqFromPages({
      answerKeyIndex,
      pages,
      questionCount,
    });
    const numericMcq = extractNumericMcqFromRawMatches({
      existingQuestions: extracted.questions,
      questionCount: Math.max(0, questionCount - extracted.questions.length),
      rawMatches,
    });
    const baseQuestions = dedupeQuestions([...extracted.questions, ...numericMcq]).slice(
      0,
      questionCount,
    );
    const effectiveFillMode = String(
      fillMode ?? process.env.EXTRACT_FILL_MODE ?? "strict",
    )
      .trim()
      .toLowerCase();
    const allowClozeFill = effectiveFillMode === "cloze";
    const wordPool = allowClozeFill ? extractWordPool(pageText, 800) : [];
    const clozeQuestions =
      allowClozeFill && baseQuestions.length < questionCount
        ? buildClozeQuestionsFromRawMatches({
          existingQuestions: baseQuestions,
          questionCount: questionCount - baseQuestions.length,
          rawMatches,
          wordPool,
        })
        : [];
    const combinedQuestions = allowClozeFill
      ? dedupeQuestions([...baseQuestions, ...clozeQuestions]).slice(0, questionCount)
      : baseQuestions;

    const warnings = [];
    if (rawMatches.length === 0) {
      warnings.push(
        "Сонгосон page range дээр асуулт/даалгавар танигдсангүй. OCR/page preview дээр текст зөв уншигдаж байгаа эсэхийг шалгаад, бодлого байдаг хуудсаа сонгоно уу.",
      );
    }
    if (extracted.skippedNoAnswerCount > 0) {
      warnings.push(
        `Зарим асуултын зөв хариу номон дээр тодорхой (хариу түлхүүр) олдоогүй тул ${extracted.skippedNoAnswerCount} асуултыг алгаслаа.`,
      );
    }
    if (answerKeyIndex.size === 0) {
      warnings.push(
        "Номын текст дотор 'Хариу/Answers' түлхүүр олдсонгүй. Хариултын түлхүүртэй хуудсыг сонгосон page range-д багтаагаарай.",
      );
    }
    if (combinedQuestions.length === 0) {
      warnings.push(
        "Зөв хариу нь номон дээр тодорхой бичигдсэн тест (A/B/C/D + хариу түлхүүр) эсвэл 'Хариу: 12' хэлбэрийн бодлогын хариу олдсонгүй.",
      );
    } else if (extracted.questions.length === 0 && numericMcq.length > 0) {
      warnings.push(
        "Энэ хэсэгт A/B/C/D тест олдсонгүй. Харин 'Хариу: (тоо)' байгаа бодлогуудыг 4 сонголттой (MCQ) болгож харууллаа.",
      );
    } else if (
      extracted.questions.length === 0
      && numericMcq.length === 0
      && clozeQuestions.length > 0
    ) {
      warnings.push(
        "A/B/C/D тест ба 'Хариу: ...' мөр олдсонгүй. Тиймээс номын текстээс үг/тоог сонгон 'хоосон зай' төрлийн асуулт болгон (1 зөв + 3 буруу) гаргалаа. (fillMode=cloze)",
      );
    } else if (
      !allowClozeFill &&
      baseQuestions.length > 0 &&
      baseQuestions.length < questionCount
    ) {
      warnings.push(
        `Зөв хариу баталгаатай асуулт ${baseQuestions.length} ширхэг л олдлоо. (fillMode=strict)`,
      );
    }

    return {
      fallbackReason: warnings.join(" "),
      groundingDropped: 0,
      installedModels: [],
      modelRequested: "",
      modelUsed: LOCAL_EXTRACT_MODEL,
      providerRequested,
      providerUsed: "local",
      fillModeUsed: allowClozeFill ? "cloze" : "strict",
      answerKeyPagesFound,
      questions: combinedQuestions,
      rawMatches,
      segmentsUsed: 1,
    };
  }

  const geminiKey = cleanModelName(geminiApiKey || process.env.GEMINI_API_KEY);
  const normalizedGeminiBaseUrl = cleanModelName(geminiBaseUrl || process.env.GEMINI_BASE_URL)
    || DEFAULT_GEMINI_BASE_URL;
  const normalizedGeminiModel = cleanModelName(geminiModel || process.env.GEMINI_MODEL)
    || DEFAULT_GEMINI_MODEL;

  const maxPromptChars = Math.max(8000, Number(process.env.MAX_PROMPT_CHARS || 40000));
  if (allowSplit && String(pageText || "").length > maxPromptChars) {
    const chunks = splitTextIntoTwoChunks(pageText);
    if (chunks.length > 1) {
      const firstTarget = Math.ceil(questionCount / 2);
      const secondTarget = Math.max(0, questionCount - firstTarget);

      const firstResult = await generateBookQuestions({
        allowSplit: false,
        baseUrl,
        geminiApiKey: geminiKey,
        geminiBaseUrl: normalizedGeminiBaseUrl,
        geminiModel: normalizedGeminiModel,
        model,
        mode,
        pageText: chunks[0],
        provider: providerRequested,
        questionCount: firstTarget,
        timeoutMs,
      });

      const secondResult =
        secondTarget > 0
          ? await generateBookQuestions({
            allowSplit: false,
            baseUrl,
            geminiApiKey: geminiKey,
            geminiBaseUrl: normalizedGeminiBaseUrl,
            geminiModel: normalizedGeminiModel,
            model,
            mode,
            pageText: chunks[1],
            provider: providerRequested,
            questionCount: secondTarget,
            timeoutMs,
          })
          : {
            fallbackReason: "",
            installedModels: [],
            groundingDropped: 0,
            modelRequested: firstResult.modelRequested,
            modelUsed: firstResult.modelUsed,
            providerUsed: firstResult.providerUsed,
            questions: [],
          };

      const mergedRaw = [
        ...(firstResult.questions || []),
        ...(secondResult.questions || []),
      ];
      const mergedQuestions =
        firstResult.modelUsed === LOCAL_FALLBACK_MODEL || secondResult.modelUsed === LOCAL_FALLBACK_MODEL
          ? mergedRaw.slice(0, questionCount)
          : dedupeQuestions(mergedRaw).slice(0, questionCount);
      const providerUsed =
        firstResult.providerUsed === "local" || secondResult.providerUsed === "local"
          ? "local"
          : firstResult.providerUsed || secondResult.providerUsed || "ollama";

      return {
        fallbackReason: mergeFallbackReason(firstResult.fallbackReason, secondResult.fallbackReason),
        installedModels: firstResult.installedModels || secondResult.installedModels || [],
        groundingDropped: (firstResult.groundingDropped || 0) + (secondResult.groundingDropped || 0),
        modelRequested: firstResult.modelRequested || secondResult.modelRequested || cleanModelName(model),
        modelUsed:
          firstResult.modelUsed === LOCAL_FALLBACK_MODEL || secondResult.modelUsed === LOCAL_FALLBACK_MODEL
            ? LOCAL_FALLBACK_MODEL
            : firstResult.modelUsed || secondResult.modelUsed || cleanModelName(model),
        providerRequested,
        providerUsed,
        questions: mergedQuestions,
        segmentsUsed: 2,
      };
    }
  }

  let result;
  if (providerRequested === "gemini") {
    result = await generateWithGemini({
      allowLocalFallback: !requireAiEnabled(),
      apiKey: geminiKey,
      baseUrl: normalizedGeminiBaseUrl,
      model: normalizedGeminiModel,
      mode,
      pageText,
      questionCount,
      timeoutMs,
    });
  } else if (providerRequested === "ollama") {
    result = await generateWithOllama({
      baseUrl,
      mode,
      model,
      pageText,
      questionCount,
      timeoutMs,
    });
  } else if (geminiKey) {
    try {
      result = await generateWithGemini({
        allowLocalFallback: false,
        apiKey: geminiKey,
        baseUrl: normalizedGeminiBaseUrl,
        model: normalizedGeminiModel,
        mode,
        pageText,
        questionCount,
        timeoutMs,
      });
    } catch (geminiError) {
      const ollamaResult = await generateWithOllama({
        baseUrl,
        mode,
        model,
        pageText,
        questionCount,
        timeoutMs,
      });

      const fallbackReason = mergeFallbackReason(
        `Gemini хүсэлт амжилтгүй боллоо (${geminiError?.message || "Тодорхойгүй алдаа"}). Ollama-р үргэлжлүүллээ.`,
        ollamaResult.fallbackReason,
      );
      result = {
        ...ollamaResult,
        fallbackReason,
      };
    }
  } else {
    result = await generateWithOllama({
      baseUrl,
      mode,
      model,
      pageText,
      questionCount,
      timeoutMs,
    });
  }

  return {
    ...result,
    providerRequested,
    segmentsUsed: 1,
  };
}

module.exports = {
  generateBookQuestions,
};
