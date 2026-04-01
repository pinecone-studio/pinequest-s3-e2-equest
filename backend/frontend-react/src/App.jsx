import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function resolveApiBase() {
  const configured = String(import.meta.env.VITE_BOOK_API_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "";
  return "";
}

function toApiUrl(path, apiBase = "") {
  const base = String(apiBase || "")
    .trim()
    .replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

function buildPdfFileUrl({ bookId, apiBase = "" }) {
  const safeBookId = encodeURIComponent(String(bookId || "").trim());
  return toApiUrl(`/api/books/${safeBookId}/file`, apiBase);
}

function buildPdfPageImageUrl({ bookId, pageNumber, apiBase = "" }) {
  const safeBookId = encodeURIComponent(String(bookId || "").trim());
  const safePage = Math.max(1, Math.trunc(Number(pageNumber) || 1));
  return toApiUrl(`/api/books/${safeBookId}/pages/${safePage}/image`, apiBase);
}

function buildPdfPagePreviewUrl({ fileUrl, pageNumber }) {
  const safeFileUrl = String(fileUrl || "").trim();
  if (!safeFileUrl) return "";
  const page = Math.max(1, Math.trunc(Number(pageNumber) || 1));
  return `${safeFileUrl}#page=${page}&view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
}

function defaultLocalBackendBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  const host = window.location.hostname || "127.0.0.1";
  const proto = window.location.protocol || "http:";
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const resolvedProto = proto === "https:" && isLocalHost ? "http:" : proto;
  return `${resolvedProto}//${host}:4000`;
}

function candidateBackendBases() {
  const out = [];
  for (let port = 4000; port <= 4010; port += 1) {
    out.push(`http://127.0.0.1:${port}`);
    out.push(`http://localhost:${port}`);
  }
  return ["", defaultLocalBackendBase(), ...out]
    .map((item) =>
      String(item || "")
        .trim()
        .replace(/\/+$/, ""),
    )
    .filter((item, idx, arr) =>
      item !== "" ? arr.indexOf(item) === idx : idx === 0,
    );
}

async function requestJson(path, options = {}) {
  const apiBase = typeof options?.apiBase === "string" ? options.apiBase : "";
  const url = toApiUrl(path, apiBase);
  const { apiBase: _ignore, ...fetchOptions } = options || {};

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || "");
    throw new Error(
      `Backend рүү холбогдож чадсангүй. (URL: ${url}) ${detail}`.trim(),
      { cause: error },
    );
  }

  if (!response.ok) {
    let bodyText = "";
    let bodyError = "";
    try {
      bodyText = await response.text();
      try {
        const parsed = JSON.parse(bodyText);
        bodyError = String(parsed?.error || "").trim();
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
    const message = bodyError || bodyText || `HTTP ${response.status}`;
    throw new Error(`${message} (URL: ${response.url || url})`);
  }

  return response.json();
}

function clampQuestionCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(80, Math.max(0, Math.trunc(n)));
}

function clampNonNegativeInt(value, fallback = 0, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

function extractChoiceToken(choiceText, fallbackIdx) {
  const raw = String(choiceText || "").trim();
  const matched = raw.match(/^([A-D])[\).:\-\s]+(.+)$/i);
  if (matched) {
    return {
      label: String(matched[1] || "").toUpperCase(),
      body: String(matched[2] || "").trim(),
    };
  }
  const labels = ["A", "B", "C", "D"];
  return {
    label: labels[fallbackIdx] || "A",
    body: raw,
  };
}

function normalizeMathExpression(value) {
  return String(value || "")
    .replace(/×/g, "\\times ")
    .replace(/[·∙•]/g, "\\cdot ")
    .replace(/÷/g, "\\div ")
    .replace(/:/g, "\\colon ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/π/g, "\\pi ")
    .replace(/∞/g, "\\infty ")
    .trim();
}

function normalizeFractions(value) {
  return String(value || "").replace(
    /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g,
    (_m, a, b) =>
      `\\frac{${String(a).replace(",", ".")}}{${String(b).replace(",", ".")}}`,
  );
}

function normalizeSqrt(value) {
  return String(value || "")
    .replace(/sqrt\s*\(\s*([^)]+?)\s*\)/gi, "\\sqrt{$1}")
    .replace(/√\s*\(\s*([^)]+?)\s*\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9]+(?:[.,]\d+)?)/g, "\\sqrt{$1}");
}

function tryRenderKatex(mathText, displayMode = false) {
  const normalized = normalizeSqrt(
    normalizeFractions(normalizeMathExpression(mathText)),
  );
  if (!normalized) return "";
  try {
    return katex.renderToString(normalized, {
      displayMode,
      strict: "ignore",
      throwOnError: false,
      trust: false,
    });
  } catch {
    return "";
  }
}

function renderLatex(latex, displayMode = false) {
  const source = String(latex || "").trim();
  if (!source) return "";
  try {
    return katex.renderToString(source, {
      displayMode,
      strict: "ignore",
      throwOnError: false,
      trust: false,
    });
  } catch {
    return "";
  }
}

function parseMathSegments(value) {
  const source = String(value || "");
  const out = [];
  const regex =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)/g;
  let lastIndex = 0;
  let matched = regex.exec(source);
  while (matched) {
    if (matched.index > lastIndex) {
      out.push({
        type: "text",
        value: source.slice(lastIndex, matched.index),
      });
    }
    out.push({
      type: "math",
      display: Boolean(matched[1] || matched[2]),
      value: matched[1] || matched[2] || matched[3] || matched[4] || "",
    });
    lastIndex = regex.lastIndex;
    matched = regex.exec(source);
  }
  if (lastIndex < source.length) {
    out.push({
      type: "text",
      value: source.slice(lastIndex),
    });
  }
  return out;
}

const SUPERSCRIPT_TO_DIGIT = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

function superscriptToDigits(value) {
  return String(value || "")
    .split("")
    .map((char) => SUPERSCRIPT_TO_DIGIT[char] || "")
    .join("");
}

function splitExerciseLabel(value) {
  const raw = String(value || "").trim();
  const matched = raw.match(
    /^((?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]))\)\s*(.+)$/u,
  );
  if (!matched) {
    return {
      label: "",
      body: raw,
    };
  }
  return {
    label: `${matched[1]})`,
    body: String(matched[2] || "").trim(),
  };
}

function convertAbsoluteBars(value) {
  const src = String(value || "");
  const totalBars = (src.match(/\|/g) || []).length;
  if (totalBars < 2 || totalBars % 2 !== 0) return src;

  let opened = false;
  let out = "";
  for (const ch of src) {
    if (ch === "|") {
      out += opened ? "\\right|" : "\\left|";
      opened = !opened;
    } else {
      out += ch;
    }
  }
  return opened ? src : out;
}

function normalizePlainProblemToLatex(value) {
  let text = String(value || "").trim();
  if (!text) return "";

  text = text
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/×/g, "\\times ")
    .replace(/[·∙•]/g, "\\cdot ")
    .replace(/÷/g, "\\div ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/π/g, "\\pi ")
    .replace(/∞/g, "\\infty ")
    .replace(/([0-9])\s*°/g, "$1^{\\circ}")
    .replace(
      /([²³⁴⁵⁶⁷⁸⁹])\s*√\s*([A-Za-z0-9().,+\-]+)/g,
      (_match, degree, radicand) =>
        `\\sqrt[${superscriptToDigits(degree)}]{${radicand}}`,
    )
    .replace(/√\s*\(\s*([^)]+)\s*\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9().,+\-]+)/g, "\\sqrt{$1}")
    .replace(/(?<!\\)\bsin\b/gi, "\\sin")
    .replace(/(?<!\\)\bcos\b/gi, "\\cos")
    .replace(/(?<!\\)\btan\b/gi, "\\tan")
    .replace(/(?<!\\)\blog\b/gi, "\\log")
    .replace(/(?<!\\)\bln\b/gi, "\\ln");

  text = text.replace(
    /([A-Za-z0-9\])}])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
    (_match, base, exponent) => {
      const exp = superscriptToDigits(exponent);
      return exp ? `${base}^{${exp}}` : _match;
    },
  );

  text = convertAbsoluteBars(text);
  return normalizeSqrt(normalizeFractions(text)).replace(/\s+/g, " ").trim();
}

function looksMathyProblemText(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 220) return false;
  if (/[?？]$/.test(text) && text.length > 120) return false;

  const hasStrongMath =
    /[=+\-*/^|√≤≥≈×÷]|(sin|cos|tan|log|ln)|[²³⁴⁵⁶⁷⁸⁹]/i.test(text);
  if (!hasStrongMath) return false;

  const hasLongMongolianPhrase =
    /[А-Яа-яЁёӨөҮүҢңӘә]{3,}\s+[А-Яа-яЁёӨөҮүҢңӘә]{3,}/u.test(text);
  if (hasLongMongolianPhrase && text.length > 60) return false;

  const longWordCount = (text.match(/[\p{L}]{2,}/gu) || []).length;
  if (longWordCount >= 10 && text.length > 80) return false;

  return true;
}

function tryRenderProblemAsKatex(text) {
  const raw = String(text || "").trim();
  if (!raw || !looksMathyProblemText(raw)) return null;

  const { label, body } = splitExerciseLabel(raw);
  const source = body || raw;
  const latex = normalizePlainProblemToLatex(source);
  if (!latex) return null;
  if (
    !/[=+\-*/^]|\\(sqrt|sin|cos|tan|log|ln|left\||frac|times|div|le|ge|ne|approx)/.test(
      latex,
    )
  ) {
    return null;
  }
  const html = renderLatex(latex, false);
  if (!html) return null;
  return {
    html,
    label,
  };
}

function MathText({ text }) {
  const segments = parseMathSegments(text);
  if (!segments.some((segment) => segment.type === "math")) {
    const auto = tryRenderProblemAsKatex(text);
    if (auto) {
      return (
        <span>
          {auto.label ? <span>{auto.label} </span> : null}
          <span
            className="math-inline"
            dangerouslySetInnerHTML={{ __html: auto.html }}
          />
        </span>
      );
    }
    return <span>{String(text || "")}</span>;
  }

  return (
    <span>
      {segments.map((segment, idx) => {
        if (segment.type === "text") {
          return <span key={`t-${idx}`}>{segment.value}</span>;
        }
        const html = tryRenderKatex(segment.value, segment.display);
        if (!html) {
          return <span key={`m-${idx}`}>{segment.value}</span>;
        }
        return (
          <span
            key={`m-${idx}`}
            className={segment.display ? "math-block" : "math-inline"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

function formatDate(value) {
  const time = Date.parse(value || "");
  if (Number.isNaN(time)) return "-";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function pickPreferredSectionId(sections) {
  const list = Array.isArray(sections) ? sections : [];
  if (!list.length) return "";

  const keywords =
    /(дасгал|жишээ|бодлого|модул|тэгшитгэл|тэнцэтгэл|логарифм|функц)/iu;
  const candidate = list.find((section) => {
    const title = String(section?.title || "");
    const startPage = Number(section?.startPage || 0);
    return keywords.test(title) && startPage >= 5;
  });
  if (candidate?.id) return candidate.id;

  const nonCover = list.find((section) => Number(section?.startPage || 0) >= 5);
  if (nonCover?.id) return nonCover.id;

  return String(list[0]?.id || "");
}

function makeChapterKey(chapter, chapterIdx) {
  const title =
    String(chapter?.title || "").trim() || `Chapter ${chapterIdx + 1}`;
  return `${chapterIdx}:${title}`;
}

function resolveChapterKey(chapter, chapterIdx) {
  const explicit = String(chapter?.id || "").trim();
  if (explicit) return explicit;
  return makeChapterKey(chapter, chapterIdx);
}

function normalizeLineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .trim();
}

function cleanTocHeading(raw) {
  const source = normalizeLineText(raw)
    .replace(/\s+\d{1,3}\s*$/g, "")
    .replace(/\s*[+_=\\/]{2,}\s*/g, " ")
    .split(/\.{3,}/)[0]
    .trim();

  const tokens = source
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => {
      const letters = token.replace(/[^\p{L}]/gu, "");
      if (!letters) return true;
      if (/^([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\1{3,}$/u.test(letters)) return false;
      if (/^[иИөӨүҮнН]{4,}$/u.test(letters)) return false;
      return true;
    });

  return tokens.slice(0, 12).join(" ").trim();
}

function extractSectionNumber(rawTitle) {
  const source = normalizeLineText(rawTitle);
  const matched = source.match(
    /(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\s*[).:\-–—]?\s*(.+)?/u,
  );
  if (!matched) return null;
  const major = Math.max(1, Math.trunc(Number(matched[1] || 0)));
  const minor = Math.max(1, Math.trunc(Number(matched[2] || 0)));
  const sub = matched[3] ? Math.max(1, Math.trunc(Number(matched[3]))) : null;
  const tail = cleanTocHeading(matched[4] || "");
  return {
    major,
    minor,
    sub,
    key: `${major}.${minor}`,
    label: sub ? `${major}.${minor}.${sub}` : `${major}.${minor}`,
    tail,
  };
}

function extractChapterName(rawTitle) {
  const source = normalizeLineText(rawTitle);
  const matched = source.match(
    /(?:^|[\s.,;:])(?:[IVXА-ЯЁӨҮҮУШТЛП]{1,4}\s+)?Б[ҮУ]?ЛЭГ[.,]?\s*(.+)$/iu,
  );
  const suffix = matched ? matched[1] : source;
  const trimmed = suffix
    .replace(/Энэ\s+б[үу]?лэг[\s\S]*$/iu, "")
    .replace(/\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s*[).:\-–—]?.*$/u, "")
    .replace(/^[\s,.;:]+/g, "")
    .trim();
  return cleanTocHeading(trimmed);
}

function extractTocTitlesFromPages(pages) {
  const sourcePages = Array.isArray(pages) ? pages : [];
  const tocTexts = sourcePages
    .map((page) => normalizeLineText(page?.text || ""))
    .filter((text) => {
      if (!text) return false;
      if (/ГАРЧИГ/iu.test(text)) return true;
      const sectionCount = (text.match(/\d{1,2}\.\d{1,2}\./g) || []).length;
      const chapterCount = (text.match(/Б[ҮУ]?ЛЭГ/giu) || []).length;
      return sectionCount >= 4 && chapterCount >= 1;
    });

  if (!tocTexts.length) {
    return {
      chapterByMajor: {},
      sectionByKey: {},
      sectionTitlesByMajor: {},
    };
  }

  const joined = tocTexts.join("\n");
  const sectionEntries = [];
  const sectionRe =
    /(\d{1,2})\.(\d{1,2})\.\s*([\s\S]*?)(?=(?:\d{1,2}\.\d{1,2}\.\s*)|(?:[IVXА-ЯЁӨҮҮУШТЛП]{1,4}\s+Б[ҮУ]?ЛЭГ)|$)/giu;
  let sectionMatch = sectionRe.exec(joined);
  while (sectionMatch) {
    const major = Math.max(1, Math.trunc(Number(sectionMatch[1] || 0)));
    const minor = Math.max(1, Math.trunc(Number(sectionMatch[2] || 0)));
    const key = `${major}.${minor}`;
    const cleanedTitle = cleanTocHeading(sectionMatch[3] || "");
    if (cleanedTitle) {
      sectionEntries.push({
        index: sectionMatch.index,
        major,
        minor,
        key,
        title: cleanedTitle,
      });
    }
    sectionMatch = sectionRe.exec(joined);
  }

  const chapterByMajor = {};
  const chapterRe =
    /([IVXА-ЯЁӨҮҮУШТЛП]{1,4})\s+Б[ҮУ]?ЛЭГ[.,]?\s*([\s\S]*?)(?=(?:\d{1,2}\.\d{1,2}\.\s*)|$)/giu;
  let chapterMatch = chapterRe.exec(joined);
  while (chapterMatch) {
    const chapterName = cleanTocHeading(chapterMatch[2] || "");
    if (chapterName) {
      const nextSection = sectionEntries.find(
        (entry) => entry.index > chapterMatch.index,
      );
      if (nextSection && !chapterByMajor[nextSection.major]) {
        chapterByMajor[nextSection.major] = chapterName;
      }
    }
    chapterMatch = chapterRe.exec(joined);
  }

  const sectionByKey = {};
  const sectionTitlesByMajor = {};
  for (const sectionEntry of sectionEntries) {
    if (!sectionByKey[sectionEntry.key]) {
      sectionByKey[sectionEntry.key] = sectionEntry.title;
    }
    if (!sectionTitlesByMajor[sectionEntry.major]) {
      sectionTitlesByMajor[sectionEntry.major] = [];
    }
    const hasMinor = sectionTitlesByMajor[sectionEntry.major].some(
      (item) => item.minor === Number(sectionEntry.minor || 0),
    );
    if (!hasMinor) {
      sectionTitlesByMajor[sectionEntry.major].push({
        minor: Number(sectionEntry.minor || 0),
        title: sectionEntry.title,
      });
    }
  }

  for (const key of Object.keys(sectionTitlesByMajor)) {
    sectionTitlesByMajor[key].sort(
      (a, b) => Number(a?.minor || 0) - Number(b?.minor || 0),
    );
  }

  return { chapterByMajor, sectionByKey, sectionTitlesByMajor };
}

function getChapterNumber(chapter, chapterIdx) {
  const sections = Array.isArray(chapter?.sections) ? chapter.sections : [];
  const votes = new Map();
  for (const section of sections) {
    const parsed = extractSectionNumber(section?.title || "");
    if (!parsed) continue;
    const major = Number(parsed.major || 0);
    const minor = Number(parsed.minor || 0);
    if (major < 1 || major > 15) continue;
    if (minor < 1 || minor > 20) continue;
    votes.set(major, Number(votes.get(major) || 0) + 1);
  }
  let bestMajor = 0;
  let bestScore = 0;
  for (const [major, score] of votes.entries()) {
    if (score > bestScore) {
      bestMajor = major;
      bestScore = score;
    }
  }
  if (bestMajor > 0) {
    return bestMajor;
  }
  return chapterIdx + 1;
}

function shortenTitle(value, maxLength = 84) {
  const cleaned = normalizeLineText(value);
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`;
}

function getChapterDisplayTitle(chapter, chapterIdx, tocLabels) {
  const chapterNumber = getChapterNumber(chapter, chapterIdx);
  const chapterByMajor =
    tocLabels && typeof tocLabels === "object"
      ? tocLabels.chapterByMajor || {}
      : {};
  const tocTitle = chapterByMajor[chapterNumber];
  const rawTitle = extractChapterName(chapter?.title || "");
  const title = shortenTitle(tocTitle || rawTitle || "БҮЛЭГ", 96);
  return `${chapterNumber}. ${title}`;
}

function getSectionDisplayTitle(section, sectionIdx, chapterNumber, tocLabels) {
  const parsed = extractSectionNumber(section?.title || "");
  const sectionTitlesByMajor =
    tocLabels && typeof tocLabels === "object"
      ? tocLabels.sectionTitlesByMajor || {}
      : {};
  const sectionByKey =
    tocLabels && typeof tocLabels === "object"
      ? tocLabels.sectionByKey || {}
      : {};
  const tocOrdered = Array.isArray(sectionTitlesByMajor[chapterNumber])
    ? sectionTitlesByMajor[chapterNumber]
    : [];
  const tocByIndex = tocOrdered[sectionIdx] || null;

  const parsedMajor = Number(parsed?.major || 0);
  const parsedMinor = Number(parsed?.minor || 0);
  const tocByMinor =
    parsedMajor === chapterNumber && parsedMinor >= 1
      ? tocOrdered.find((item) => Number(item?.minor || 0) === parsedMinor) ||
        null
      : null;
  const maxAllowedMinor = Math.max(
    tocOrdered.length,
    ...tocOrdered.map((item) => Number(item?.minor || 0)),
    1,
  );
  const isPlausibleParsed =
    parsed &&
    parsedMajor === chapterNumber &&
    parsedMinor >= 1 &&
    parsedMinor <= Math.max(40, maxAllowedMinor);

  const preferredToc = tocByMinor || tocByIndex;
  const numberLabel = preferredToc?.minor
    ? `${chapterNumber}.${preferredToc.minor}`
    : isPlausibleParsed
      ? parsed.label
      : `${chapterNumber}.${sectionIdx + 1}`;
  const tocTitle =
    preferredToc?.title ||
    (isPlausibleParsed && parsed?.key ? sectionByKey[parsed.key] : "");
  const rawTitle =
    isPlausibleParsed && parsed?.tail
      ? parsed.tail
      : cleanTocHeading(section?.title || "");
  const title = shortenTitle(tocTitle || rawTitle || "Сэдэв", 98);
  return `${numberLabel} ${title}`.trim();
}

const CANONICAL_MATH12_TOC = {
  chapterByMajor: {
    1: "ТЭГШИТГЭЛ, ТЭНЦЭТГЭЛ БИШ",
    2: "ОЛОН ГИШҮҮНТ",
    3: "ФУНКЦ БА ГРАФИК",
    4: "ФУНКЦИЙН УЛАМЖЛАЛ",
    5: "ИНТЕГРАЛ",
    6: "МАГАДЛАЛ БА СТАТИСТИК",
    7: "КОМПЛЕКС ТОО",
  },
  sectionTitlesByMajor: {
    1: [
      { minor: 1, title: "Тооны модул" },
      { minor: 2, title: "Модул агуулсан тэгшитгэл" },
      { minor: 3, title: "Модул агуулсан тэнцэтгэл биш" },
    ],
    2: [
      { minor: 1, title: "Нэг ба олон гишүүнт" },
      { minor: 2, title: "Олон гишүүнтийн хуваах үйлдэл" },
      { minor: 3, title: "Безугийн теорем" },
      {
        minor: 4,
        title:
          "Рационал илэрхийллийг олон гишүүнт болон алгебрын хялбар бутархайн нийлбэр болгон задлах",
      },
    ],
    3: [
      { minor: 1, title: "Тооны логарифм" },
      { minor: 2, title: "Логарифмын чанар" },
      { minor: 3, title: "Хялбар илтгэгч тэгшитгэл, тэнцэтгэл биш" },
      { minor: 4, title: "Логарифм функц" },
      { minor: 5, title: "y = e^x ба y = ln x функц" },
      { minor: 6, title: "Рационал функц" },
      { minor: 7, title: "Тоон аргументтай тригонометр функц" },
    ],
    4: [
      { minor: 1, title: "y = e^x функцийн уламжлал" },
      { minor: 2, title: "y = ln x функцийн уламжлал" },
      { minor: 3, title: "y = sin x ба y = cos x функцийн уламжлал" },
      { minor: 4, title: "Үржвэр функцийн уламжлал" },
      { minor: 5, title: "Ногдвор функцийн уламжлал" },
      { minor: 6, title: "y = tg x функцийн уламжлал" },
      { minor: 7, title: "Давхар функцийн уламжлал" },
    ],
    5: [
      { minor: 1, title: "Илтгэгч, тригонометр, рационал функцийн интеграл" },
      { minor: 2, title: "Рационал функцийн интеграл" },
      { minor: 3, title: "F'(x) / F(x) хэлбэрийн интеграл бодох" },
      { minor: 4, title: "ln|f(x)| + C томьёо ашиглан тодорхой интеграл бодох" },
      {
        minor: 5,
        title:
          "Орлуулах аргаар тодорхой болон тодорхой бус интегралыг хялбар интегралд шилжүүлэн бодох",
      },
    ],
    6: [
      { minor: 1, title: "Дискрет санамсаргүй хувьсагч" },
      { minor: 2, title: "Математик дундаж" },
      { minor: 3, title: "Дисперс" },
    ],
    7: [
      { minor: 1, title: "Комплекс тоо, түүний бодит ба хуурмаг хэсэг" },
      { minor: 2, title: "Комплекс тооны нэмэх үйлдэл" },
      { minor: 3, title: "Комплекс тооны үржүүлэх үйлдэл" },
      {
        minor: 4,
        title: "Хоёр комплекс тооны тэнцүүгийн тодорхойлолтыг хэрэглэх",
      },
      { minor: 5, title: "Комплекс тооны хуваах үйлдэл" },
      { minor: 6, title: "Комплекс тооны модул ба хосмог тоо" },
      {
        minor: 7,
        title:
          "Бодит коэффициенттэй квадрат тэгшитгэлийн комплекс тоон язгуур",
      },
      { minor: 8, title: "Комплекс тооны геометр дүрслэл" },
    ],
  },
};

function buildSectionByKeyFromMajorMap(sectionTitlesByMajor) {
  const out = {};
  const source =
    sectionTitlesByMajor && typeof sectionTitlesByMajor === "object"
      ? sectionTitlesByMajor
      : {};
  Object.keys(source).forEach((majorKey) => {
    const major = Math.trunc(Number(majorKey));
    const items = Array.isArray(source[majorKey]) ? source[majorKey] : [];
    items.forEach((item) => {
      const minor = Math.trunc(Number(item?.minor || 0));
      const title = String(item?.title || "").trim();
      if (major >= 1 && minor >= 1 && title) {
        out[`${major}.${minor}`] = title;
      }
    });
  });
  return out;
}

function looksLikeMath12Book(bookTitle, extractedLabels) {
  const rawTitle = String(bookTitle || "").toLowerCase();
  const hasMath12InTitle =
    /12/.test(rawTitle) && /(matem|матем)/iu.test(rawTitle);
  if (hasMath12InTitle) return true;

  const sectionTitlesByMajor =
    extractedLabels && typeof extractedLabels === "object"
      ? extractedLabels.sectionTitlesByMajor || {}
      : {};
  const hasComplex =
    Array.isArray(sectionTitlesByMajor[7]) &&
    sectionTitlesByMajor[7].length >= 6;
  const hasDerivative =
    Array.isArray(sectionTitlesByMajor[4]) &&
    sectionTitlesByMajor[4].length >= 5;
  const hasAlgebra =
    Array.isArray(sectionTitlesByMajor[1]) &&
    sectionTitlesByMajor[1].length >= 3;
  return hasComplex && hasDerivative && hasAlgebra;
}

function resolveTocLabelsForBook(bookTitle, extractedLabels) {
  if (!looksLikeMath12Book(bookTitle, extractedLabels)) {
    return extractedLabels;
  }
  const sectionTitlesByMajor = CANONICAL_MATH12_TOC.sectionTitlesByMajor;
  return {
    chapterByMajor: { ...CANONICAL_MATH12_TOC.chapterByMajor },
    sectionTitlesByMajor,
    sectionByKey: buildSectionByKeyFromMajorMap(sectionTitlesByMajor),
  };
}

function getVisibleChapterSections(chapter, chapterIdx, tocLabels) {
  const chapterSections = Array.isArray(chapter?.sections) ? chapter.sections : [];
  const chapterNumber =
    Number(chapter?.chapterNumber || 0) || getChapterNumber(chapter, chapterIdx);
  const sectionTitlesByMajor =
    tocLabels && typeof tocLabels === "object"
      ? tocLabels.sectionTitlesByMajor || {}
      : {};
  const ordered = Array.isArray(sectionTitlesByMajor[chapterNumber])
    ? sectionTitlesByMajor[chapterNumber]
    : [];
  if (!ordered.length) return chapterSections;

  const maxMinor = Math.max(
    ordered.length,
    ...ordered.map((item) => Number(item?.minor || 0)),
    1,
  );
  const byMinor = new Map();
  const leftovers = [];

  for (const section of chapterSections) {
    const parsed = extractSectionNumber(section?.title || "");
    const parsedMajor = Number(parsed?.major || 0);
    const parsedMinor = Number(parsed?.minor || 0);
    const isValidMinor =
      parsed &&
      parsedMajor === chapterNumber &&
      parsedMinor >= 1 &&
      parsedMinor <= maxMinor;
    if (isValidMinor && !byMinor.has(parsedMinor)) {
      byMinor.set(parsedMinor, section);
      continue;
    }
    leftovers.push(section);
  }

  const out = [];
  for (const item of ordered) {
    const wantedMinor = Number(item?.minor || 0);
    if (wantedMinor >= 1 && byMinor.has(wantedMinor)) {
      out.push(byMinor.get(wantedMinor));
      continue;
    }
    if (leftovers.length) {
      out.push(leftovers.shift());
    }
  }

  if (out.length > 0) return out;
  return chapterSections.slice(0, ordered.length);
}

function pickAutoBookIdForSelection({ books, subject, grade }) {
  const list = Array.isArray(books) ? books : [];
  const safeSubject = String(subject || "").trim().toLowerCase();
  const safeGrade = String(grade || "").trim().toLowerCase();
  const isMath12 =
    /математик|math|matematik/i.test(safeSubject) && /12/.test(safeGrade);
  if (!isMath12) return "";

  const candidates = list.filter((book) => {
    const title = String(book?.title || "").toLowerCase();
    return /матем|math|matematik/i.test(title) && /12/.test(title);
  });
  if (!candidates.length) return "";

  const sorted = [...candidates].sort((a, b) => {
    const aTime = Date.parse(String(a?.createdAt || "")) || 0;
    const bTime = Date.parse(String(b?.createdAt || "")) || 0;
    return bTime - aTime;
  });
  return String(sorted[0]?.id || "");
}

export default function App() {
  // Exam meta (UI only – for now these are not sent to the backend,
  // but they let the screen visually match the design mock).
  const [subject, setSubject] = useState("Математик");
  const [grade, setGrade] = useState("10 дугаар анги");
  const [examType, setExamType] = useState("Явцын");
  const [examName, setExamName] = useState("Явц-1 Алгебр");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(30);

  const [apiBaseOverride, setApiBaseOverride] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem("book_api_base") || "";
    } catch {
      return "";
    }
  });
  const apiBase = useMemo(() => {
    const override = String(apiBaseOverride || "").trim();
    if (override) {
      const lowered = override.toLowerCase();
      if (lowered === "same-origin" || lowered === "proxy") return "";
      return override.replace(/\/+$/, "");
    }
    return resolveApiBase();
  }, [apiBaseOverride]);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [structure, setStructure] = useState({ chapters: [], sections: [] });
  const [tocLabels, setTocLabels] = useState({
    chapterByMajor: {},
    sectionByKey: {},
    sectionTitlesByMajor: {},
  });
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [allTopicsMode, setAllTopicsMode] = useState(false);
  const [expandedChapterKeys, setExpandedChapterKeys] = useState([]);
  const windowSize = 3;
  const [sectionWindow, setSectionWindow] = useState(null);
  const [loadingSection, setLoadingSection] = useState(false);
  const [failedPageImages, setFailedPageImages] = useState({});

  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [difficultyCounts, setDifficultyCounts] = useState({
    easy: 0,
    medium: 0,
    hard: 0,
  });
  const [openQuestionCount, setOpenQuestionCount] = useState(0);
  const [totalScore, setTotalScore] = useState(100);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showExplanations, setShowExplanations] = useState(true);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const displayChapters = useMemo(() => {
    const source = Array.isArray(structure.chapters) ? structure.chapters : [];
    const grouped = [];
    const byKey = new Map();

    for (let chapterIdx = 0; chapterIdx < source.length; chapterIdx += 1) {
      const chapter = source[chapterIdx];
      const chapterNumber = getChapterNumber(chapter, chapterIdx);
      const chapterDisplayTitle = getChapterDisplayTitle(
        chapter,
        chapterIdx,
        tocLabels,
      );
      const normalizedTitle = String(chapterDisplayTitle || "")
        .replace(/^\d+\.\s*/u, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
      const groupKey = `${chapterNumber}:${normalizedTitle}`;
      const chapterSections = Array.isArray(chapter?.sections)
        ? chapter.sections
        : [];

      if (!byKey.has(groupKey)) {
        const item = {
          id: groupKey,
          chapterNumber,
          title: chapterDisplayTitle,
          sections: [...chapterSections],
        };
        grouped.push(item);
        byKey.set(groupKey, item);
        continue;
      }

      const existing = byKey.get(groupKey);
      const existingSectionIds = new Set(
        (Array.isArray(existing?.sections) ? existing.sections : [])
          .map((section) => String(section?.id || ""))
          .filter(Boolean),
      );
      chapterSections.forEach((section) => {
        const sectionId = String(section?.id || "");
        if (sectionId && existingSectionIds.has(sectionId)) return;
        existing.sections.push(section);
        if (sectionId) existingSectionIds.add(sectionId);
      });
    }

    const chapterByMajor =
      tocLabels && typeof tocLabels === "object"
        ? tocLabels.chapterByMajor || {}
        : {};
    const knownMajors = Object.keys(chapterByMajor)
      .map((key) => Math.trunc(Number(key)))
      .filter((value) => Number.isFinite(value) && value >= 1)
      .sort((a, b) => a - b);
    const hasCanonicalLikeSequence =
      knownMajors.length >= 7 &&
      knownMajors.slice(0, 7).every((value, idx) => value === idx + 1);

    if (!hasCanonicalLikeSequence) {
      return grouped;
    }

    return grouped.map((chapter, idx) => {
      const forcedNumber = idx + 1;
      const canonicalName = String(chapterByMajor[forcedNumber] || "").trim();
      const fallbackName = String(chapter?.title || "")
        .replace(/^\d+\.\s*/u, "")
        .trim();
      const mergedTitle = `${forcedNumber}. ${canonicalName || fallbackName || "БҮЛЭГ"}`;
      return {
        ...chapter,
        chapterNumber: forcedNumber,
        id: `${forcedNumber}:${(canonicalName || fallbackName || "БҮЛЭГ").toUpperCase()}`,
        title: mergedTitle,
      };
    });
  }, [structure.chapters, tocLabels]);

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) || null,
    [books, selectedBookId],
  );
  const selectedSection = useMemo(
    () =>
      structure.sections.find((section) => section.id === selectedSectionId) ||
      null,
    [structure.sections, selectedSectionId],
  );
  const selectedChapterInfo = useMemo(() => {
    const chapters = Array.isArray(displayChapters) ? displayChapters : [];
    for (let chapterIdx = 0; chapterIdx < chapters.length; chapterIdx += 1) {
      const chapter = chapters[chapterIdx];
      const chapterSections = Array.isArray(chapter?.sections)
        ? chapter.sections
        : [];
      if (chapterSections.some((section) => section.id === selectedSectionId)) {
        return {
          chapter,
          chapterIdx,
          key: resolveChapterKey(chapter, chapterIdx),
        };
      }
    }
    return null;
  }, [displayChapters, selectedSectionId]);
  const selectedChapter =
    selectedChapterInfo?.chapter || displayChapters[0] || null;
  const selectedChapterSections = useMemo(
    () => {
      if (!selectedChapter) return [];
      const fallbackIdx = Number(selectedChapterInfo?.chapterIdx || 0);
      return getVisibleChapterSections(selectedChapter, fallbackIdx, tocLabels);
    },
    [selectedChapter, selectedChapterInfo?.chapterIdx, tocLabels],
  );
  const chapterKeys = useMemo(
    () =>
      (Array.isArray(displayChapters) ? displayChapters : []).map(
        (chapter, chapterIdx) => resolveChapterKey(chapter, chapterIdx),
      ),
    [displayChapters],
  );
  const selectedChapterNumber = useMemo(
    () =>
      selectedChapterInfo
        ? Number(selectedChapterInfo?.chapter?.chapterNumber || 0) ||
          getChapterNumber(
            selectedChapterInfo.chapter,
            selectedChapterInfo.chapterIdx,
          )
        : Number(displayChapters[0]?.chapterNumber || 0) ||
          getChapterNumber(displayChapters[0] || null, 0),
    [selectedChapterInfo, displayChapters],
  );
  const selectedSectionIndexInChapter = useMemo(() => {
    if (!selectedSectionId) return -1;
    return selectedChapterSections.findIndex(
      (section) => String(section?.id || "") === selectedSectionId,
    );
  }, [selectedChapterSections, selectedSectionId]);
  const selectedSectionDisplayTitle = useMemo(() => {
    if (!selectedSection) return "";
    return getSectionDisplayTitle(
      selectedSection,
      selectedSectionIndexInChapter >= 0 ? selectedSectionIndexInChapter : 0,
      selectedChapterNumber,
      tocLabels,
    );
  }, [
    selectedSection,
    selectedSectionIndexInChapter,
    selectedChapterNumber,
    tocLabels,
  ]);
  const selectedSectionIdSet = useMemo(
    () =>
      new Set(
        (Array.isArray(selectedSectionIds) ? selectedSectionIds : []).filter(
          Boolean,
        ),
      ),
    [selectedSectionIds],
  );
  const sectionSummaryById = useMemo(() => {
    const map = new Map();
    const sections = Array.isArray(structure.sections) ? structure.sections : [];
    sections.forEach((section) => {
      const id = String(section?.id || "");
      if (!id) return;
      map.set(id, section);
    });
    return map;
  }, [structure.sections]);
  const checkedSectionsForPreview = useMemo(() => {
    const out = [];
    const chapters = Array.isArray(structure.chapters) ? structure.chapters : [];
    for (let chapterIdx = 0; chapterIdx < chapters.length; chapterIdx += 1) {
      const chapter = chapters[chapterIdx];
      const chapterNumber = getChapterNumber(chapter, chapterIdx);
      const chapterSections = getVisibleChapterSections(
        chapter,
        chapterIdx,
        tocLabels,
      );
      for (let sectionIdx = 0; sectionIdx < chapterSections.length; sectionIdx += 1) {
        const section = chapterSections[sectionIdx];
        const sectionId = String(section?.id || "");
        if (!sectionId || !selectedSectionIdSet.has(sectionId)) continue;

        const summary = sectionSummaryById.get(sectionId);
        const summaryPages = Array.isArray(summary?.pageNumbers)
          ? summary.pageNumbers
          : [];
        const rawPages = summaryPages.length
          ? summaryPages
          : Array.isArray(section?.pages)
            ? section.pages.map((page) => page?.pageNumber)
            : [];
        const pageNumbers = [
          ...new Set(
            rawPages
              .map((pageNumber) => Math.trunc(Number(pageNumber)))
              .filter(
                (pageNumber) => Number.isFinite(pageNumber) && pageNumber >= 1,
              ),
          ),
        ].sort((a, b) => a - b);

        out.push({
          id: sectionId,
          displayTitle: getSectionDisplayTitle(
            section,
            sectionIdx,
            chapterNumber,
            tocLabels,
          ),
          pageNumbers,
        });
      }
    }
    return out;
  }, [structure.chapters, sectionSummaryById, selectedSectionIdSet, tocLabels]);
  const resolvedQuestionCount = useMemo(
    () => clampQuestionCount(questionCount),
    [questionCount],
  );

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "book_api_base",
          String(apiBaseOverride || ""),
        );
      }
    } catch {
      // ignore
    }
  }, [apiBaseOverride]);

  async function requestWithFallback(path, options = {}) {
    try {
      return await requestJson(path, { ...options, apiBase });
    } catch (error) {
      if (apiBase !== "") throw error;
      const candidates = candidateBackendBases().filter(Boolean);
      for (const candidate of candidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await requestJson("/health", { apiBase: candidate });
          setApiBaseOverride(candidate);
          // eslint-disable-next-line no-await-in-loop
          return await requestJson(path, { ...options, apiBase: candidate });
        } catch {
          // try next
        }
      }
      throw error;
    }
  }

  async function loadHealth() {
    try {
      const payload = await requestWithFallback("/health");
      setHealth(payload);
      setHealthError("");
    } catch (error) {
      setHealth(null);
      setHealthError(
        error instanceof Error ? error.message : "Health check алдаа",
      );
    }
  }

  async function loadBooks(preferredBookId = "") {
    setIsRefreshing(true);
    try {
      const payload = await requestWithFallback("/api/books");
      const items = Array.isArray(payload?.books) ? payload.books : [];
      setBooks(items);
      if (!items.length) {
        setSelectedBookId("");
        setStructure({ chapters: [], sections: [] });
        setTocLabels({
          chapterByMajor: {},
          sectionByKey: {},
          sectionTitlesByMajor: {},
        });
        setAllTopicsMode(false);
        setSelectedSectionId("");
        setSelectedSectionIds([]);
        setSectionWindow(null);
        return;
      }

      const nextBookId =
        preferredBookId && items.some((book) => book.id === preferredBookId)
          ? preferredBookId
          : selectedBookId && items.some((book) => book.id === selectedBookId)
            ? selectedBookId
            : items[0].id;
      setSelectedBookId(nextBookId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Номын жагсаалт уншиж чадсангүй.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadStructure(bookId) {
    if (!bookId) return;
    try {
      const payload = await requestWithFallback(
        `/api/books/${bookId}/structure`,
      );
      const chapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
      const sections = Array.isArray(payload?.sections) ? payload.sections : [];
      setStructure({ chapters, sections });
      if (sections.length > 0) {
        const nextSectionId =
          selectedSectionId &&
          sections.some((section) => section.id === selectedSectionId)
            ? selectedSectionId
            : pickPreferredSectionId(sections);
        setSelectedSectionId(nextSectionId);
        setSelectedSectionIds([]);
      } else {
        setAllTopicsMode(false);
        setSelectedSectionId("");
        setSelectedSectionIds([]);
        setSectionWindow(null);
      }
    } catch (error) {
      setStructure({ chapters: [], sections: [] });
      setErrorMessage(
        error instanceof Error ? error.message : "Structure уншиж чадсангүй.",
      );
    }
  }

  async function loadTocLabels(bookId) {
    if (!bookId) {
      setTocLabels({
        chapterByMajor: {},
        sectionByKey: {},
        sectionTitlesByMajor: {},
      });
      return;
    }
    try {
      const payload = await requestWithFallback(
        `/api/books/${bookId}?includeText=1`,
      );
      const pages = Array.isArray(payload?.pages) ? payload.pages : [];
      const extracted = extractTocTitlesFromPages(pages);
      setTocLabels(resolveTocLabelsForBook(payload?.title || "", extracted));
    } catch {
      setTocLabels({
        chapterByMajor: {},
        sectionByKey: {},
        sectionTitlesByMajor: {},
      });
    }
  }

  async function loadSectionWindow({
    bookId,
    sectionId,
    offset = 0,
    nextWindowSize = windowSize,
  }) {
    if (!bookId || !sectionId) return;
    setLoadingSection(true);
    setErrorMessage("");
    try {
      const payload = await requestWithFallback(
        `/api/books/${bookId}/sections/${sectionId}?offset=${offset}&windowSize=${nextWindowSize}`,
      );
      setSectionWindow(payload);
      setStatusMessage(
        `Section content ачааллаа: ${payload.visiblePageNumbers?.join(", ") || "-"}`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Section content уншиж чадсангүй.",
      );
    } finally {
      setLoadingSection(false);
    }
  }

  useEffect(() => {
    void loadHealth();
    void loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    if (!selectedBookId) {
      setTocLabels({
        chapterByMajor: {},
        sectionByKey: {},
        sectionTitlesByMajor: {},
      });
      return;
    }
    void loadStructure(selectedBookId);
    void loadTocLabels(selectedBookId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId]);

  useEffect(() => {
    const autoBookId = pickAutoBookIdForSelection({
      books,
      subject,
      grade,
    });
    if (!autoBookId) return;
    if (selectedBookId === autoBookId) return;
    setSelectedBookId(autoBookId);
  }, [books, subject, grade, selectedBookId]);

  useEffect(() => {
    if (!selectedBookId || !selectedSectionId) return;
    void loadSectionWindow({
      bookId: selectedBookId,
      sectionId: selectedSectionId,
      offset: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId, selectedSectionId, windowSize]);

  useEffect(() => {
    setFailedPageImages({});
  }, [selectedBookId, selectedSectionId, sectionWindow?.offset]);

  useEffect(() => {
    const availableIds = new Set(
      (Array.isArray(structure.sections) ? structure.sections : [])
        .map((section) => String(section?.id || ""))
        .filter(Boolean),
    );
    setSelectedSectionIds((prev) => {
      const filtered = (Array.isArray(prev) ? prev : []).filter((id) =>
        availableIds.has(id),
      );
      return filtered;
    });
  }, [structure.sections]);

  useEffect(() => {
    const chapters = Array.isArray(displayChapters) ? displayChapters : [];
    if (!chapters.length) {
      setExpandedChapterKeys([]);
      return;
    }

    const selectedKey = String(selectedChapterInfo?.key || "");
    setExpandedChapterKeys((prev) => {
      const availableKeys = chapters.map((chapter, chapterIdx) =>
        resolveChapterKey(chapter, chapterIdx),
      );
      const filtered = (Array.isArray(prev) ? prev : []).filter((key) =>
        availableKeys.includes(key),
      );
      if (selectedKey) {
        return filtered.includes(selectedKey)
          ? filtered
          : [...filtered, selectedKey];
      }
      if (filtered.length > 0) return filtered;
      return [resolveChapterKey(chapters[0], 0)];
    });
  }, [displayChapters, selectedChapterInfo?.key]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) {
      setErrorMessage("PDF файлаа сонгоно уу.");
      return;
    }
    setIsUploading(true);
    setErrorMessage("");
    setStatusMessage("PDF upload + OCR хийж байна...");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const payload = await requestWithFallback("/api/books/upload", {
        method: "POST",
        body: form,
      });
      await loadBooks(payload.bookId);
      setSelectedFile(null);
      setStatusMessage(`Амжилттай upload: ${payload.title}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload алдаа.");
      setStatusMessage("");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleGenerateTest() {
    const activeSectionIds = Array.from(selectedSectionIdSet);
    const useVisiblePages = false;
    if (!selectedBookId || (!activeSectionIds.length && !selectedSectionId)) {
      setErrorMessage("Эхлээд дор хаяж нэг сэдэв сонгоно уу.");
      return;
    }

    setIsGeneratingTest(true);
    setErrorMessage("");
    setStatusMessage(
      "Сонгосон сэдвүүд дээр тулгуурлан шалгалтын материал үүсгэж байна...",
    );

    try {
      const payload = await requestWithFallback(
        `/api/books/${selectedBookId}/generate-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sectionId: selectedSectionId || activeSectionIds[0] || "",
            sectionIds: activeSectionIds,
            visiblePageNumbers: useVisiblePages
              ? sectionWindow.visiblePageNumbers
              : undefined,
            questionCount: resolvedQuestionCount,
            difficulty,
            difficultyCounts: {
              easy: clampNonNegativeInt(difficultyCounts.easy),
              medium: clampNonNegativeInt(difficultyCounts.medium),
              hard: clampNonNegativeInt(difficultyCounts.hard),
            },
            openQuestionCount: clampNonNegativeInt(openQuestionCount),
            totalScore: clampNonNegativeInt(totalScore, 100),
          }),
        },
      );

      setTestResult(payload);
      setSelectedAnswers({});
      setSubmitted(false);
      setShowExplanations(true);
      setTestModalOpen(false);
      setStatusMessage(
        `Шалгалт бэлэн: ${payload.questionCountGenerated || 0} сонгох + ${payload.openQuestionCountGenerated || 0} задгай`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Тест үүсгэх үед алдаа гарлаа.",
      );
      setStatusMessage("");
    } finally {
      setIsGeneratingTest(false);
    }
  }

  function handleSubmitTest() {
    setSubmitted(true);
  }

  function handleSelectAllTopics() {
    setAllTopicsMode(true);
    setExpandedChapterKeys(chapterKeys);
    const allIds = (Array.isArray(displayChapters) ? displayChapters : [])
      .flatMap((chapter, chapterIdx) =>
        getVisibleChapterSections(chapter, chapterIdx, tocLabels),
      )
      .map((section) => String(section?.id || ""))
      .filter(Boolean);
    setSelectedSectionIds(allIds);
    if (allIds.length > 0) {
      setSelectedSectionId((current) =>
        current && allIds.includes(current) ? current : allIds[0],
      );
    }
  }

  function handleSelectChapterTopics(chapter, chapterIdx) {
    const chapterKey = resolveChapterKey(chapter, chapterIdx);
    const chapterSections = getVisibleChapterSections(
      chapter,
      chapterIdx,
      tocLabels,
    );
    setAllTopicsMode(false);
    setExpandedChapterKeys((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.includes(chapterKey) ? list : [...list, chapterKey];
    });

    const firstSectionId = String(chapterSections[0]?.id || "");
    if (firstSectionId) {
      setSelectedSectionId(firstSectionId);
    }
    const ids = chapterSections
      .map((section) => String(section?.id || ""))
      .filter(Boolean);
    setSelectedSectionIds((prev) => {
      const set = new Set(Array.isArray(prev) ? prev : []);
      ids.forEach((id) => set.add(id));
      return Array.from(set);
    });
  }

  function handleSelectSection(sectionId) {
    setAllTopicsMode(false);
    const id = String(sectionId || "");
    setSelectedSectionId(id);
  }

  function handleToggleSectionSelection(sectionId) {
    const id = String(sectionId || "");
    if (!id) return;
    setAllTopicsMode(false);
    setSelectedSectionIds((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.includes(id);
      const next = exists ? list.filter((item) => item !== id) : [...list, id];
      setSelectedSectionId((current) => {
        if (!exists) return id;
        if (current !== id) return current;
        return String(next[0] || "");
      });
      return next;
    });
  }

  function handleToggleChapterSelection(chapter, chapterIdx) {
    const chapterSections = getVisibleChapterSections(
      chapter,
      chapterIdx,
      tocLabels,
    );
    const chapterSectionIds = chapterSections
      .map((section) => String(section?.id || ""))
      .filter(Boolean);
    if (!chapterSectionIds.length) return;
    const allSelected = chapterSectionIds.every((id) =>
      selectedSectionIdSet.has(id),
    );

    setSelectedSectionIds((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      let next = [];
      if (allSelected) {
        const chapterSet = new Set(chapterSectionIds);
        next = list.filter((id) => !chapterSet.has(id));
      } else {
        const set = new Set(list);
        chapterSectionIds.forEach((id) => set.add(id));
        next = Array.from(set);
      }
      setSelectedSectionId((current) => {
        if (!allSelected)
          return current && next.includes(current)
            ? current
            : chapterSectionIds[0];
        if (current && !chapterSectionIds.includes(current)) return current;
        return String(next[0] || "");
      });
      return next;
    });
  }

  function handleDifficultyCountChange(level, value) {
    const safeLevel = String(level || "");
    if (!["easy", "medium", "hard"].includes(safeLevel)) return;
    const next = clampNonNegativeInt(value);
    setDifficultyCounts((prev) => ({
      ...prev,
      [safeLevel]: next,
    }));
  }

  function handleChapterToggle(chapter, chapterIdx) {
    const chapterKey = resolveChapterKey(chapter, chapterIdx);
    const chapterSections = getVisibleChapterSections(
      chapter,
      chapterIdx,
      tocLabels,
    );
    const opening = !expandedChapterKeys.includes(chapterKey);
    setExpandedChapterKeys((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return opening
        ? [...list, chapterKey]
        : list.filter((item) => item !== chapterKey);
    });

    if (!opening || !chapterSections.length) return;
    if (!chapterSections.some((section) => section.id === selectedSectionId)) {
      const nextSectionId = String(chapterSections[0]?.id || "");
      if (nextSectionId) {
        setSelectedSectionId(nextSectionId);
      }
    }
  }

  function handlePrevPageWindow() {
    if (!selectedBookId || !selectedSectionId || !sectionWindow?.hasPrev)
      return;
    const offset = Math.max(0, Number(sectionWindow?.offset || 0) - windowSize);
    void loadSectionWindow({
      bookId: selectedBookId,
      sectionId: selectedSectionId,
      offset,
    });
  }

  function handleNextPageWindow() {
    if (!selectedBookId || !selectedSectionId || !sectionWindow?.hasNext)
      return;
    const offset = Math.max(0, Number(sectionWindow?.offset || 0) + windowSize);
    void loadSectionWindow({
      bookId: selectedBookId,
      sectionId: selectedSectionId,
      offset,
    });
  }

  const score = useMemo(() => {
    const questions = Array.isArray(testResult?.questions)
      ? testResult.questions
      : [];
    if (!questions.length) return { correct: 0, total: 0 };

    let correct = 0;
    questions.forEach((question, idx) => {
      const selected = selectedAnswers[idx];
      if (selected && selected === question.correctAnswer) {
        correct += 1;
      }
    });

    return {
      correct,
      total: questions.length,
    };
  }, [selectedAnswers, testResult?.questions]);

  return (
    <div className="app-shell">
      <p className="page-title">Шалгалтын материал үүсгэх</p>
      <section className="topbar">
        <div>
          <p className="panel-title">Ерөнхий мэдээлэл</p>
        </div>
        <div className="controls">
          <label>
            Хичээл
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              <option value="Математик">Математик</option>
              <option value="Физик">Физик</option>
              <option value="Хими">Хими</option>
              <option value="Информатик">Информатик</option>
            </select>
          </label>
          <label>
            Анги
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
            >
              <option value="9 дүгээр анги">9 дүгээр анги</option>
              <option value="10 дугаар анги">10 дугаар анги</option>
              <option value="11 дүгээр анги">11 дүгээр анги</option>
              <option value="12 дугаар анги">12 дугаар анги</option>
            </select>
          </label>
          <label>
            Төрөл
            <select
              value={examType}
              onChange={(event) => setExamType(event.target.value)}
            >
              <option value="Явцын">Явцын</option>
              <option value="Жил төгсгөх">Жил төгсгөх</option>
              <option value="Дасгал">Дасгал</option>
            </select>
          </label>
          <label>
            Шалгалтын нэр
            <input
              value={examName}
              onChange={(event) => setExamName(event.target.value)}
              placeholder="Жишээ: Явц-1 Алгебр"
            />
          </label>
          <label>
            Үргэлжлэх минут
            <select
              value={durationMinutes}
              onChange={(event) =>
                setDurationMinutes(Number(event.target.value) || 0)
              }
            >
              {[20, 30, 40, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {value} мин
                </option>
              ))}
            </select>
          </label>
          <label>
            Угтрах минут
            <select
              value={maxDurationMinutes}
              onChange={(event) =>
                setMaxDurationMinutes(Number(event.target.value) || 0)
              }
            >
              {[20, 30, 40, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {value} мин
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="toolbar">
        <form onSubmit={handleUpload} className="upload-form">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] || null)
            }
            required
          />
          <button type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload PDF"}
          </button>
        </form>

        <div className="controls">
          <label>
            Backend URL
            <input
              value={apiBaseOverride}
              onChange={(event) => setApiBaseOverride(event.target.value)}
              placeholder='auto эсвэл "same-origin"'
            />
          </label>

          <label>
            Ном
            <select
              value={selectedBookId}
              onChange={(event) => setSelectedBookId(event.target.value)}
            >
              <option value="">Ном сонгох</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} ({book.pageCount})
                </option>
              ))}
            </select>
          </label>

          <button
            className="ghost"
            type="button"
            onClick={() => void loadBooks()}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {selectedBook ? (
        <p className="book-meta">
          {selectedBook.title} • {selectedBook.pageCount} page •{" "}
          {formatDate(selectedBook.createdAt)}
        </p>
      ) : null}

      <main className="workspace">
        <aside className="sidebar exam-sidebar">
          <p className="sidebar-kicker">Сурах бичиг</p>
          <div className="builder-card">
            <div className="sidebar-head">
              <h2 className="builder-book-title">
                {selectedBook?.title || "Математик-12"}
              </h2>
              <div className="sidebar-actions">
                <button
                  type="button"
                  className="ghost mini-ghost"
                  onClick={handleSelectAllTopics}
                  disabled={!chapterKeys.length}
                >
                  Бүгдийг сонгох
                </button>
              </div>
            </div>

            <input
              className="topic-search-input"
              value={topicSearch}
              onChange={(event) => setTopicSearch(event.target.value)}
              placeholder="Хичээлийн сэдвээр хайх"
            />

            {!displayChapters.length ? (
              <p className="empty">
                Chapter/section бүтэц хараахан алга байна.
              </p>
            ) : (
              <div className="chapter-list exam-chapter-list">
                {displayChapters.map((chapter, chapterIdx) => {
                  const chapterSections = getVisibleChapterSections(
                    chapter,
                    chapterIdx,
                    tocLabels,
                  );
                  const chapterKey = resolveChapterKey(chapter, chapterIdx);
                  const isOpen = expandedChapterKeys.includes(chapterKey);
                  const chapterNumber =
                    Number(chapter?.chapterNumber || 0) ||
                    getChapterNumber(chapter, chapterIdx);
                  const chapterDisplayTitle =
                    String(chapter?.title || "").trim() ||
                    getChapterDisplayTitle(chapter, chapterIdx, tocLabels);
                  const searchLower = String(topicSearch || "")
                    .trim()
                    .toLowerCase();
                  const sectionEntries = chapterSections
                    .map((section, sectionIdx) => ({
                      section,
                      sectionIdx,
                      displayTitle: getSectionDisplayTitle(
                        section,
                        sectionIdx,
                        chapterNumber,
                        tocLabels,
                      ),
                    }))
                    .filter((entry) => {
                      if (!searchLower) return true;
                      return String(entry.displayTitle || "")
                        .toLowerCase()
                        .includes(searchLower);
                    });
                  const chapterMatches =
                    !searchLower ||
                    String(chapterDisplayTitle || "")
                      .toLowerCase()
                      .includes(searchLower) ||
                    sectionEntries.length > 0;
                  if (!chapterMatches) return null;

                  const visibleSectionIds = sectionEntries
                    .map((entry) => String(entry.section?.id || ""))
                    .filter(Boolean);
                  const allChapterVisibleSelected =
                    visibleSectionIds.length > 0 &&
                    visibleSectionIds.every((id) =>
                      selectedSectionIdSet.has(id),
                    );

                  return (
                    <div
                      key={`chapter-${chapterIdx}`}
                      className={`chapter-block ${isOpen ? "open" : ""}`}
                    >
                      <div className="chapter-select-row">
                        <label className="check-row chapter-check-row">
                          <input
                            type="checkbox"
                            checked={allChapterVisibleSelected}
                            onChange={() =>
                              handleToggleChapterSelection(chapter, chapterIdx)
                            }
                          />
                          <span className="chapter-title">
                            {chapterDisplayTitle}
                          </span>
                        </label>
                        <button
                          type="button"
                          className={`chapter-toggle ${isOpen ? "open" : ""}`}
                          onClick={() =>
                            handleChapterToggle(chapter, chapterIdx)
                          }
                          aria-expanded={isOpen}
                        >
                          <span
                            className={`chapter-chevron ${isOpen ? "open" : ""}`}
                            aria-hidden="true"
                          >
                            ⌄
                          </span>
                        </button>
                      </div>
                      {isOpen ? (
                        <div className="chapter-dropdown">
                          <button
                            type="button"
                            className="chapter-select-all-btn"
                            onClick={() =>
                              handleSelectChapterTopics(chapter, chapterIdx)
                            }
                            disabled={!chapterSections.length}
                          >
                            Энэ бүлгийн бүх сэдэв
                          </button>
                          {sectionEntries.length ? (
                            sectionEntries.map((entry) => {
                              const sectionId = String(entry.section?.id || "");
                              const isChecked =
                                selectedSectionIdSet.has(sectionId);
                              return (
                                <div
                                  key={
                                    sectionId ||
                                    `${chapterKey}-sec-${entry.sectionIdx}`
                                  }
                                  className={`section-check-row ${selectedSectionId === sectionId ? "active" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggleSectionSelection(sectionId)
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="section-inline-btn"
                                    onClick={() =>
                                      handleSelectSection(sectionId)
                                    }
                                  >
                                    {entry.displayTitle}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="empty">Энэ бүлэгт сэдэв олдсонгүй.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <label className="builder-field">
              <span>Тестийн тоо</span>
              <input
                type="number"
                min={0}
                value={questionCount}
                onChange={(event) =>
                  setQuestionCount(clampQuestionCount(event.target.value))
                }
                placeholder="Тестийн тоо оруулна уу"
              />
            </label>

            <label className="builder-field">
              <span>Задгай даалгаврын тоо</span>
              <input
                type="number"
                min={0}
                value={openQuestionCount}
                onChange={(event) =>
                  setOpenQuestionCount(clampNonNegativeInt(event.target.value))
                }
                placeholder="Задгай даалгаврын тоо оруулна уу"
              />
            </label>

            <label className="builder-field">
              <span>Нийт оноо</span>
              <input
                type="number"
                min={0}
                value={totalScore}
                onChange={(event) =>
                  setTotalScore(clampNonNegativeInt(event.target.value, 100))
                }
                placeholder="Нийт оноо оруулна уу"
              />
            </label>

            <div className="difficulty-stack">
              <p>Хүндрэлийн зэрэг</p>
              <label className="difficulty-row">
                <span>Энгийн</span>
                <input
                  type="number"
                  min={0}
                  value={difficultyCounts.easy}
                  onChange={(event) =>
                    handleDifficultyCountChange("easy", event.target.value)
                  }
                />
              </label>
              <label className="difficulty-row">
                <span>Дунд</span>
                <input
                  type="number"
                  min={0}
                  value={difficultyCounts.medium}
                  onChange={(event) =>
                    handleDifficultyCountChange("medium", event.target.value)
                  }
                />
              </label>
              <label className="difficulty-row">
                <span>Хүнд</span>
                <input
                  type="number"
                  min={0}
                  value={difficultyCounts.hard}
                  onChange={(event) =>
                    handleDifficultyCountChange("hard", event.target.value)
                  }
                />
              </label>
            </div>

            <button
              type="button"
              className="create-exam-btn"
              onClick={() => void handleGenerateTest()}
              disabled={
                isGeneratingTest ||
                !selectedBookId ||
                selectedSectionIdSet.size === 0
              }
            >
              {isGeneratingTest ? "Үүсгэж байна..." : "Шалгалт үүсгэх"}
            </button>
          </div>
        </aside>

        <section className="reader">
          <div className="reader-head">
            <div>
              <h2 className="reader-main-title">Model-ийн Гаргалгаа</h2>
              <p className="subtext">
                `Шалгалт үүсгэх` дарсны дараах model-ийн гаргалгаа энд шууд харагдана.
              </p>
            </div>
            {testResult ? (
              <div className="reader-actions">
                <button type="button" onClick={handleSubmitTest}>
                  Submit
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setShowExplanations((prev) => !prev)}
                >
                  {showExplanations ? "Hide explanations" : "Show explanations"}
                </button>
              </div>
            ) : null}
          </div>

          {isGeneratingTest ? (
            <p className="empty">Model ажиллаж байна, шалгалтыг үүсгэж байна...</p>
          ) : null}

          {!isGeneratingTest && testResult ? (
            <div className="visual-panel">
              <div className="window-nav">
                <p>
                  Difficulty: {testResult.difficulty} • {testResult.questionCountGenerated} асуулт • Pages:{" "}
                  {Array.isArray(testResult.visiblePageNumbers)
                    ? testResult.visiblePageNumbers.join(", ")
                    : "-"}
                </p>
              </div>

              <p className="subtext">
                Задгай даалгавар: {testResult.openQuestionCountGenerated || 0}
              </p>

              {submitted ? (
                <p className="score">
                  Score: {score.correct} / {score.total}
                </p>
              ) : null}

              {Array.isArray(testResult.warnings) && testResult.warnings.length ? (
                <div className="warning-box">
                  {testResult.warnings.map((warning, idx) => (
                    <p key={`warn-inline-${idx}`}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div className="question-list">
                {(Array.isArray(testResult.questions) ? testResult.questions : []).map(
                  (question, qIdx) => (
                    <article key={`inline-q-${qIdx}`} className="question-item">
                      {String(
                        question.bookProblem || question.sourceExcerpt || "",
                      ).trim() ? (
                        <p className="problem-line">
                          <strong>Номын бодлого:</strong>{" "}
                          <MathText
                            text={String(
                              question.bookProblem || question.sourceExcerpt || "",
                            ).trim()}
                          />
                        </p>
                      ) : null}

                      <h3>
                        {qIdx + 1}. <MathText text={question.question} />
                      </h3>

                      <div className="choice-list">
                        {(Array.isArray(question.choices) ? question.choices : []).map(
                          (choice, choiceIdx) => {
                            const parsed = extractChoiceToken(choice, choiceIdx);
                            const selected = selectedAnswers[qIdx] === parsed.label;
                            const isCorrect = parsed.label === question.correctAnswer;
                            const classNames = [
                              "choice-item",
                              selected ? "selected" : "",
                              isCorrect ? "correct" : "",
                              submitted && selected && !isCorrect ? "incorrect" : "",
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return (
                              <label
                                key={`inline-q-${qIdx}-c-${choiceIdx}`}
                                className={classNames}
                              >
                                <input
                                  type="radio"
                                  name={`inline-q-${qIdx}`}
                                  value={parsed.label}
                                  checked={selected}
                                  onChange={() =>
                                    setSelectedAnswers((prev) => ({
                                      ...prev,
                                      [qIdx]: parsed.label,
                                    }))
                                  }
                                />
                                <span className="choice-label">{parsed.label}.</span>
                                <span>
                                  <MathText text={parsed.body} />
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>

                      <p className="answer-line">
                        Correct answer: {question.correctAnswer}
                      </p>

                      {Array.isArray(question.sourcePages) &&
                      question.sourcePages.length ? (
                        <p className="source-line">
                          Source pages: {question.sourcePages.join(", ")}
                        </p>
                      ) : null}

                      {showExplanations ? (
                        <p className="explain-line">
                          <MathText text={question.explanation || ""} />
                        </p>
                      ) : null}
                    </article>
                  ),
                )}
              </div>

              {Array.isArray(testResult.openQuestions) &&
              testResult.openQuestions.length ? (
                <div className="question-list">
                  {testResult.openQuestions.map((task, idx) => (
                    <article
                      key={`inline-open-${idx}`}
                      className="question-item open-item"
                    >
                      <h3>
                        Задгай {idx + 1}.{" "}
                        <MathText text={task.prompt || task.question || ""} />
                      </h3>
                      <p className="answer-line">
                        Зөв хариу:{" "}
                        {String(task.answer || "").trim() ? (
                          <MathText text={task.answer || ""} />
                        ) : (
                          "Тооцоолж гаргах боломжгүй (задгай үнэлгээтэй)"
                        )}
                      </p>
                      {Number.isFinite(Number(task.score)) ? (
                        <p className="source-line">Оноо: {Number(task.score)}</p>
                      ) : null}
                      {task.difficulty ? (
                        <p className="source-line">Түвшин: {task.difficulty}</p>
                      ) : null}
                      {Array.isArray(task.sourcePages) && task.sourcePages.length ? (
                        <p className="source-line">
                          Source pages: {task.sourcePages.join(", ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="empty">
              `Шалгалт үүсгэх` дээр дарсны дараа model-ийн гаргалгаа энд харагдана.
            </p>
          )}
        </section>
      </main>

      {testModalOpen && testResult ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h2>Generated Test</h2>
              <button
                className="ghost"
                type="button"
                onClick={() => setTestModalOpen(false)}
              >
                Close
              </button>
            </div>

            <p className="subtext">
              Difficulty: {testResult.difficulty} •{" "}
              {testResult.questionCountGenerated} асуулт • Pages:{" "}
              {Array.isArray(testResult.visiblePageNumbers)
                ? testResult.visiblePageNumbers.join(", ")
                : "-"}
            </p>
            <p className="subtext">
              Задгай даалгавар: {testResult.openQuestionCountGenerated || 0}
            </p>

            {submitted ? (
              <p className="score">
                Score: {score.correct} / {score.total}
              </p>
            ) : null}

            <div className="modal-actions">
              <button type="button" onClick={handleSubmitTest}>
                Submit
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => setShowExplanations((prev) => !prev)}
              >
                {showExplanations ? "Hide explanations" : "Show explanations"}
              </button>
            </div>

            {Array.isArray(testResult.warnings) &&
            testResult.warnings.length ? (
              <div className="warning-box">
                {testResult.warnings.map((warning, idx) => (
                  <p key={`warn-${idx}`}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className="question-list">
              {(Array.isArray(testResult.questions)
                ? testResult.questions
                : []
              ).map((question, qIdx) => (
                <article key={`q-${qIdx}`} className="question-item">
                  {String(
                    question.bookProblem || question.sourceExcerpt || "",
                  ).trim() ? (
                    <p className="problem-line">
                      <strong>Номын бодлого:</strong>{" "}
                      <MathText
                        text={String(
                          question.bookProblem || question.sourceExcerpt || "",
                        ).trim()}
                      />
                    </p>
                  ) : null}

                  <h3>
                    {qIdx + 1}. <MathText text={question.question} />
                  </h3>

                  <div className="choice-list">
                    {(Array.isArray(question.choices)
                      ? question.choices
                      : []
                    ).map((choice, choiceIdx) => {
                      const parsed = extractChoiceToken(choice, choiceIdx);
                      const selected = selectedAnswers[qIdx] === parsed.label;
                      const isCorrect = parsed.label === question.correctAnswer;
                      const classNames = [
                        "choice-item",
                        selected ? "selected" : "",
                        isCorrect ? "correct" : "",
                        submitted && selected && !isCorrect ? "incorrect" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <label
                          key={`q-${qIdx}-c-${choiceIdx}`}
                          className={classNames}
                        >
                          <input
                            type="radio"
                            name={`q-${qIdx}`}
                            value={parsed.label}
                            checked={selected}
                            onChange={() =>
                              setSelectedAnswers((prev) => ({
                                ...prev,
                                [qIdx]: parsed.label,
                              }))
                            }
                          />
                          <span className="choice-label">{parsed.label}.</span>
                          <span>
                            <MathText text={parsed.body} />
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="answer-line">
                    Correct answer: {question.correctAnswer}
                  </p>

                  {Array.isArray(question.sourcePages) &&
                  question.sourcePages.length ? (
                    <p className="source-line">
                      Source pages: {question.sourcePages.join(", ")}
                    </p>
                  ) : null}

                  {showExplanations ? (
                    <p className="explain-line">
                      <MathText text={question.explanation || ""} />
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            {Array.isArray(testResult.openQuestions) &&
            testResult.openQuestions.length ? (
              <div className="question-list">
                {testResult.openQuestions.map((task, idx) => (
                  <article
                    key={`open-${idx}`}
                    className="question-item open-item"
                  >
                    <h3>
                      Задгай {idx + 1}.{" "}
                      <MathText text={task.prompt || task.question || ""} />
                    </h3>
                    <p className="answer-line">
                      Зөв хариу:{" "}
                      {String(task.answer || "").trim() ? (
                        <MathText text={task.answer || ""} />
                      ) : (
                        "Тооцоолж гаргах боломжгүй (задгай үнэлгээтэй)"
                      )}
                    </p>
                    {Number.isFinite(Number(task.score)) ? (
                      <p className="source-line">Оноо: {Number(task.score)}</p>
                    ) : null}
                    {task.difficulty ? (
                      <p className="source-line">Түвшин: {task.difficulty}</p>
                    ) : null}
                    {Array.isArray(task.sourcePages) &&
                    task.sourcePages.length ? (
                      <p className="source-line">
                        Source pages: {task.sourcePages.join(", ")}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {statusMessage || errorMessage || healthError ? (
        <footer className="footer-status">
          {statusMessage ? <p className="status ok">{statusMessage}</p> : null}
          {errorMessage ? <p className="status err">{errorMessage}</p> : null}
          {healthError ? <p className="status err">{healthError}</p> : null}
        </footer>
      ) : null}
    </div>
  );
}
