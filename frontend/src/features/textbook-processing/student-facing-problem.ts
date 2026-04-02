import { normalizeReadableProblemText } from "./readable-problem-patterns";

const AMBIGUOUS_TEXTBOOK_PHRASES = [
  "дадлага ажил",
  "дүрс ",
  "нэрлэвэл",
  "олон өнцөгт биш",
  "бусад дүрс",
  "зургийг ажигла",
  "зураг ашиглан",
  "хүснэгт ашиглан",
  "бодлого 9 шийдтэй",
  "шийдтэй",
];

function normalizeSpace(value: string) {
  return normalizeReadableProblemText(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEquationNotation(value: string) {
  return String(value || "")
    .replace(/\b([xyzabcXYZABCхХуУаАбБ])\s*([2-9])\b/g, "$1^$2")
    .replace(/\b1\s*([xyzabcXYZABCхХуУаАбБ])\b/g, "$1")
    .replace(/\b-\s*1\s*([xyzabcXYZABCхХуУаАбБ])\b/g, "-$1")
    .replace(/\s*([=+*/<>≤≥])\s*/g, " $1 ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeStandaloneEquation(text: string) {
  const normalized = normalizeEquationNotation(normalizeSpace(text));
  if (!normalized) {
    return false;
  }

  return (
    /[=]/.test(normalized) &&
    /(?:\b[xXyYzZaAbBcCхХуУ]\b|[xXyYzZaAbBcCхХуУ])/u.test(normalized) &&
    !/(утгыг\s*ол|шийд|тооцоол|хэд\s*вэ|тэгшитгэл|илэрхийлэл)/iu.test(normalized)
  );
}

function detectPrimaryVariable(text: string) {
  const matched = normalizeSpace(text).match(/[xXyYzZaAbBcCхХуУ]/u);
  const variable = matched?.[0] || "x";
  if (/[хХ]/u.test(variable)) {
    return "x";
  }
  if (/[уУ]/u.test(variable)) {
    return "y";
  }
  return variable.toLowerCase();
}

export function isAmbiguousTextbookInstruction(value: string) {
  const normalized = normalizeSpace(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  return AMBIGUOUS_TEXTBOOK_PHRASES.some((phrase) => normalized.includes(phrase));
}

export function normalizeStudentFacingMathText(value: string) {
  return normalizeEquationNotation(normalizeSpace(value))
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function toStudentFacingProblemPrompt(value: string) {
  const normalized = normalizeStudentFacingMathText(value);
  if (!normalized || isAmbiguousTextbookInstruction(normalized)) {
    return "";
  }

  if (looksLikeStandaloneEquation(normalized)) {
    const variable = detectPrimaryVariable(normalized);
    const equationOnly = normalized.replace(
      /\s+[xXyYzZaAbBcCхХуУ]\s*(?:hed\s+ve|хэд\s+вэ|ийн\s+утгыг\s+ол|ын\s+утгыг\s+ол)\.?$/iu,
      "",
    );
    return `Дараах тэгшитгэлийг бод. ${variable}-ийн утгыг ол: ${equationOnly}`;
  }

  return normalized;
}
