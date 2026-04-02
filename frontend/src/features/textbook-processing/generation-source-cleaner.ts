import type { TextbookSourceProblem } from "@/app/test/material-builder/_components/textbook-material-data";
import { normalizeReadableProblemText } from "./readable-problem-patterns";
import {
  isAmbiguousTextbookInstruction,
  normalizeStudentFacingMathText,
  toStudentFacingProblemPrompt,
} from "./student-facing-problem";

type VisiblePage = {
  content: string;
  pageNumber: number;
};

type CleanGenerationSourceInput = {
  requestedOpenQuestionCount: number;
  requestedQuestionCount: number;
  sourceProblems: TextbookSourceProblem[];
  visiblePages: VisiblePage[];
};

type CleanSourceProblem = TextbookSourceProblem & {
  qualityScore: number;
};

export type CleanedGenerationSource = {
  preferredOpenQuestionCount: number;
  preferredQuestionCount: number;
  sourceProblems: TextbookSourceProblem[];
  visiblePages: VisiblePage[];
  warnings: string[];
};

const META_PHRASES = [
  "сонгосон хэсэг",
  "дараах мөрөөс",
  "эх хэсэг",
  "хуудасны эх",
  "source",
  "page ",
];
const GENERIC_PROMPTS = [
  "энэ бодлогыг бодоод зөв хариуг сонго",
  "сонголтот асуулт",
  "задгай даалгавар",
  "mock асуулт",
];

function normalizeSpace(value: string) {
  return normalizeStudentFacingMathText(
    normalizeReadableProblemText(String(value || "")),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function stripNoiseLine(value: string) {
  const text = normalizeSpace(value);
  if (!text) {
    return "";
  }

  if (/^\[?\s*page\s*\d+\s*\]?$/iu.test(text)) {
    return "";
  }
  if (/^хуудас\s*\d+$/iu.test(text)) {
    return "";
  }
  if (/^\d{1,4}$/.test(text)) {
    return "";
  }
  if (/^[.\-_=•·]{3,}$/.test(text)) {
    return "";
  }
  if (/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\1{5,}/u.test(text)) {
    return "";
  }

  return text
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function joinWrappedLines(lines: string[]) {
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = stripNoiseLine(rawLine);
    if (!line) {
      continue;
    }

    const previous = out[out.length - 1] || "";
    const shouldJoin =
      previous &&
      !/[.?!:]$/.test(previous) &&
      !/^(?:\d{1,3}[).]|[\p{L}]\)|[-*•])/u.test(line) &&
      previous.length + line.length <= 240;

    if (shouldJoin) {
      out[out.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ").trim();
      continue;
    }

    out.push(line);
  }

  return out;
}

function cleanPromptLikeText(value: string, maxLength = 220) {
  const normalized = normalizeSpace(value)
    .replace(/^\[page\s*\d+\]\s*/iu, "")
    .replace(/^\s*(?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\s*[\).:\-–]\s*/u, "")
    .trim();

  if (!normalized) {
    return "";
  }

  const compact = normalized
    .replace(/\s{2,}/g, " ")
    .replace(/[ ]+([,.;:!?])/g, "$1")
    .trim();

  return compact.length > maxLength
    ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : compact;
}

export function cleanTextbookPageContent(value: string, maxLength = 1200) {
  const joined = joinWrappedLines(String(value || "").split(/\r?\n+/))
    .map((line) => cleanPromptLikeText(line, 220))
    .filter((line) => !isDiscardableContextLine(line));

  const uniqueLines = joined.filter(
    (line, index, items) => items.findIndex((item) => item === line) === index,
  );
  const result = uniqueLines.join("\n");

  return result.length > maxLength
    ? `${result.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : result;
}

export function cleanTextbookSourceProblemText(value: string, maxLength = 220) {
  const raw = cleanPromptLikeText(value, maxLength);
  if (!raw) {
    return "";
  }

  return toStudentFacingProblemPrompt(raw);
}

function hasMetaPhrase(value: string) {
  const normalized = normalizeSpace(value).toLowerCase();
  return META_PHRASES.some((phrase) => normalized.includes(phrase));
}

function hasGenericPrompt(value: string) {
  const normalized = normalizeSpace(value)
    .toLowerCase()
    .replace(/[.?!]+$/g, "");
  return GENERIC_PROMPTS.some((phrase) => normalized.includes(phrase));
}

function isDiscardableContextLine(value: string) {
  const normalized = cleanPromptLikeText(value, 260);
  if (!normalized) {
    return true;
  }
  if (hasMetaPhrase(normalized) || hasGenericPrompt(normalized)) {
    return true;
  }
  if (
    /^(?:жишээ|бодолт|тайлбар|дүгнэлт|тодорхойлолт|зураг)(?:\s|$|[.:])/iu.test(normalized) &&
    (!/[=+\-*/<>≤≥√°^]/.test(normalized) || /[.…]{2,}/.test(normalized) || normalized.length <= 28)
  ) {
    return true;
  }
  if (/^[.·•:_\-–—]{2,}$/.test(normalized)) {
    return true;
  }
  return false;
}

function scoreSourceProblem(text: string) {
  const normalized = cleanTextbookSourceProblemText(text, 260);
  if (!normalized) {
    return -999;
  }

  let score = 0;
  const tokenCount = (normalized.match(/[\p{L}\p{N}]+/gu) || []).length;
  const symbolCount = (normalized.match(/[=+\-*/<>≤≥√°^|]/g) || []).length;
  const digitCount = (normalized.match(/\d/g) || []).length;
  const hasQuestionVerb = /(утгыг\s*ол|хэд\s*вэ|ол\.?$|олно\s*уу|шийд|тооцоол|батал)/iu.test(
    normalized,
  );
  const hasMathSignal =
    digitCount >= 2 ||
    symbolCount >= 1 ||
    /(гурвалжин|өнцөг|тэгшитгэл|функц|магадлал|талбай|периметр)/iu.test(normalized);

  if (hasQuestionVerb) score += 5;
  if (hasMathSignal) score += 4;
  if (tokenCount >= 4 && tokenCount <= 26) score += 4;
  if (normalized.length >= 14 && normalized.length <= 160) score += 4;
  if (!hasMetaPhrase(normalized)) score += 2;
  if (/[?.]$/.test(normalized)) score += 1;
  if (/[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]{2,}\s+[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]{2,}/u.test(normalized)) score += 2;
  if (/([^\p{L}\p{N}\s])\1{2,}/u.test(normalized)) score -= 4;
  if (normalized.length > 180) score -= 5;
  if (tokenCount < 3) score -= 4;
  if (!hasMathSignal) score -= 4;
  if (hasMetaPhrase(normalized)) score -= 8;
  if (hasGenericPrompt(normalized)) score -= 8;
  if (/^(жишээ|бодолт|тайлбар|дүгнэлт|тодорхойлолт|зураг)\b/iu.test(normalized)) score -= 6;
  if (!hasQuestionVerb && normalized.length > 120) score -= 5;
  if (isAmbiguousTextbookInstruction(normalized)) score -= 12;

  return score;
}

function cleanSourceProblems(
  sourceProblems: TextbookSourceProblem[],
  visiblePages: VisiblePage[],
  requestedQuestionCount: number,
) {
  const cleaned: CleanSourceProblem[] = [];
  const seen = new Set<string>();

  const pushItem = (item: TextbookSourceProblem) => {
    const text = cleanTextbookSourceProblemText(item.text);
    if (!text) {
      return;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    cleaned.push({
      pageNumber: Math.max(1, Math.trunc(Number(item.pageNumber) || 0)),
      qualityScore: scoreSourceProblem(text),
      text,
    });
  };

  for (const item of sourceProblems) {
    pushItem(item);
  }

  for (const item of extractSourceCandidatesFromVisiblePages(visiblePages)) {
    pushItem(item);
  }

  cleaned.sort((left, right) => right.qualityScore - left.qualityScore);
  const maxItems = Math.max(12, requestedQuestionCount * 4);
  const preferred = cleaned.filter((item) => item.qualityScore >= 6).slice(0, maxItems);

  return preferred.length > 0 ? preferred : cleaned.slice(0, Math.min(maxItems, 6));
}

function cleanVisiblePages(
  visiblePages: VisiblePage[],
  requestedQuestionCount: number,
) {
  const maxPages = Math.max(4, Math.min(12, requestedQuestionCount * 2));

  return visiblePages
    .map((page) => ({
      content: cleanTextbookPageContent(page.content, 900),
      pageNumber: Math.max(1, Math.trunc(Number(page.pageNumber) || 0)),
    }))
    .filter((page) => page.content)
    .slice(0, maxPages);
}

function splitPageIntoCandidateLines(content: string) {
  return cleanTextbookPageContent(content, 1600)
    .split(/\n+/)
    .flatMap((line) =>
      line
        .split(/(?<=[.?!])\s+/)
        .map((part) => cleanTextbookSourceProblemText(part, 220)),
    )
    .filter(Boolean);
}

function extractSourceCandidatesFromVisiblePages(visiblePages: VisiblePage[]) {
  const candidates: TextbookSourceProblem[] = [];
  const seen = new Set<string>();

  for (const page of visiblePages) {
    const snippets = splitPageIntoCandidateLines(page.content)
      .map((text) => ({
        pageNumber: Math.max(1, Math.trunc(Number(page.pageNumber) || 0)),
        text,
      }))
      .filter((item) => scoreSourceProblem(item.text) >= 8)
      .slice(0, 8);

    for (const snippet of snippets) {
      const key = snippet.text.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      candidates.push(snippet);
    }
  }

  return candidates;
}

export function cleanTextbookGenerationSource({
  requestedOpenQuestionCount,
  requestedQuestionCount,
  sourceProblems,
  visiblePages,
}: CleanGenerationSourceInput): CleanedGenerationSource {
  const cleanedVisiblePages = cleanVisiblePages(visiblePages, requestedQuestionCount);
  const cleanedSourceProblems = cleanSourceProblems(
    sourceProblems,
    cleanedVisiblePages,
    requestedQuestionCount,
  );
  const warnings: string[] = [];

  const preferredQuestionCount = Math.min(
    Math.max(0, Math.trunc(Number(requestedQuestionCount) || 0)),
    cleanedSourceProblems.length,
  );
  const preferredOpenQuestionCount = Math.min(
    Math.max(0, Math.trunc(Number(requestedOpenQuestionCount) || 0)),
    Math.floor(cleanedSourceProblems.length / 4),
  );

  if (requestedQuestionCount > preferredQuestionCount) {
    warnings.push(
      `Чанартай source problem ${cleanedSourceProblems.length} ширхэг тул сонголтот асуултыг ${preferredQuestionCount} болгож багасгав.`,
    );
  }
  if (requestedOpenQuestionCount > preferredOpenQuestionCount) {
    warnings.push(
      `Чанартай эх хязгаартай тул задгай даалгаврыг ${preferredOpenQuestionCount} болгож багасгав.`,
    );
  }

  return {
    preferredOpenQuestionCount,
    preferredQuestionCount,
    sourceProblems: cleanedSourceProblems.map(({ pageNumber, text }) => ({
      pageNumber,
      text,
    })),
    visiblePages: cleanedVisiblePages,
    warnings,
  };
}
