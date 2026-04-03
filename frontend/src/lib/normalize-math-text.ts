/**
 * Хэрэглэгчийн бичвэр / редактор — `$...$` хадгална (KaTeX tokenize-д шаардлагатай).
 * DB-ээс ирсэн delimiter-гүй мөрт {@link normalizeBackendMathText} ашиглана.
 */
export function normalizePreviewMathText(raw: string): string {
  if (!raw) return raw;
  const next = raw
    .replace(/\\\$(?=[A-Za-z])/g, "\\")
    .replace(/\\\$(?=\{)/g, "\\")
    .replace(/\\\\(?=[A-Za-z])/g, "\\")
    .replace(/\$([}\]\)])/g, "$1");
  const trimmed = next.trim();

  if (!containsExplicitMathDelimiters(trimmed)) {
    return normalizeBackendMathText(trimmed);
  }

  return trimmed;
}

export function normalizeBackendMathText(raw: string): string {
  const normalizedRaw = normalizeBrokenMathSpacing(
    normalizeSystemSeparators(raw),
  );

  if (containsExplicitMathDelimiters(normalizedRaw)) {
    return normalizeCommonMathSyntax(
      normalizeBackendDelimitedMathText(normalizedRaw),
    );
  }

  return restoreInlineMathDelimiters(
    normalizeCommonMathSyntax(normalizeBackendLatexArtifacts(normalizedRaw)),
  );
}

/**
 * For fields that should remain pure-LaTeX (ex: answerLatex).
 * Removes common backend/db artifacts but does NOT add `$...$` delimiters.
 */
export function normalizeBackendLatexOnly(raw: string): string {
  return normalizeCommonMathSyntax(normalizeBackendLatexArtifacts(raw));
}

function containsExplicitMathDelimiters(raw: string): boolean {
  if (!raw) {
    return false;
  }

  return /\\\[[\s\S]+?\\\]|\\\([^)]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/.test(
    raw,
  );
}

function normalizeBackendDelimitedMathText(raw: string): string {
  if (!raw) {
    return raw;
  }

  const normalizedRaw = normalizeExplicitSystemLines(raw);

  return normalizedRaw
    .replace(/\\\$(?=[A-Za-z])/g, "\\")
    .replace(/\\\$(?=\{)/g, "\\")
    .replace(/\\\\(?=[A-Za-z])/g, "\\")
    .replace(/\$([}\]\)])/g, "$1")
    .trim();
}

function looksLikeSystemRelationLine(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  return /(?:=|<|>|\\(?:leq|geq|neq|lt|gt)\b)/.test(trimmed);
}

function normalizeSystemSeparators(raw: string): string {
  if (!raw || raw.includes("\n") || /\\begin\{[a-zA-Z*]+\}/.test(raw)) {
    return raw;
  }

  const parts = raw.split(/\\\\/).map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2 || !parts.every(looksLikeSystemRelationLine)) {
    return raw;
  }

  return parts.join("\n");
}

function normalizeExplicitSystemLines(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed || /\\begin\{[a-zA-Z*]+\}/.test(trimmed)) {
    return raw;
  }

  const wrappers = [
    { close: "$$", open: "$$" },
    { close: "\\]", open: "\\[" },
    { close: "\\)", open: "\\(" },
    { close: "$", open: "$" },
  ] as const;

  for (const wrapper of wrappers) {
    if (!trimmed.startsWith(wrapper.open) || !trimmed.endsWith(wrapper.close)) {
      continue;
    }

    const inner = trimmed
      .slice(wrapper.open.length, trimmed.length - wrapper.close.length)
      .trim();
    const parts = inner.split(/\\\\/).map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2 || !parts.every(looksLikeSystemRelationLine)) {
      return raw;
    }

    return parts
      .map((part) => `${wrapper.open}${part}${wrapper.close}`)
      .join("\n");
  }

  return raw;
}

function normalizeBackendLatexArtifacts(raw: string): string {
  if (!raw) return raw;

  // 1) Undo common "escaped dollar" artifacts.
  // Seen examples: "\\$cdot" -> "\\cdot", "\\$right" -> "\\right"
  let next = raw
    .replace(/\\\$(?=[A-Za-z])/g, "\\")
    .replace(/\\\$(?=\{)/g, "\\")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");

  // 2) Fix double escaping before LaTeX commands: "\\\\sqrt" -> "\\sqrt"
  // Keep literal linebreaks ("\\\\") intact by only touching when a command follows.
  next = next.replace(/\\\\(?=[A-Za-z])/g, "\\");

  // 3) Remove dangling '$' before closers like "^{7$}" or "\\frac{100}{4$}"
  next = next.replace(/\$([}\]\)])/g, "$1");

  // 4) Convert common inline spacing commands that should not surface in plain text.
  next = next.replace(/\\,/g, ", ");

  // 4.1) Repair broken degree notations that were split by HTML/OCR formatting.
  next = next
    .replace(/(\d+)\s*\^\s*(?:\{?\s*[∘°]\s*\}?)/gu, "$1^\\circ")
    .replace(/(\d+)\s*(?:[∘°])/gu, "$1^\\circ")
    .replace(/\^\s*\\circ/gu, "^\\circ");

  // 4.2) Add a separator when two prompts were concatenated without whitespace.
  next = next.replace(/([?!.])(?=[А-Яа-яӨөҮүЁё])/gu, "$1 ");

  // 5) Strip ALL remaining dollars. Our app stores delimiter-free text in DB, and
  // incoming backend text frequently contains stray '$' artifacts.
  next = next.replace(/\$/g, "");

  return next.trim();
}

function normalizeCommonMathSyntax(value: string): string {
  if (!value) return value;

  return value
    .replace(/\s*\^\s*\\circ/gu, "^\\circ")
    .replace(/\\left\s+([\{\[\(\|])/g, "\\left$1")
    .replace(/\\right\s+([\}\]\)\|])/g, "\\right$1")
    .replace(/\\left\{/g, "\\left(")
    .replace(/\\right\}/g, "\\right)")
    .replace(/([|∣])\s+([A-Za-z0-9\\])/g, "$1$2")
    .replace(/([A-Za-z0-9\\])\s+([|∣])/g, "$1$2")
    .replace(/(\d)\s+([A-Za-z])/g, "$1$2")
    .replace(/([A-Za-z])\s+(\d)/g, "$1$2")
    .replace(
      /(^|[\s{[(,])(-?)\s*(\d+)\s+(\d+)\s+\4\s+\3(?=$|[\s}\]),.;:])/g,
      (_full, prefix: string, sign: string, numerator: string, denominator: string) =>
        `${prefix}${sign}\\frac{${numerator}}{${denominator}}`,
    )
    .replace(
      /(^|[=+\-*/,(]\s*)(\d+)\s+(\d+)\/(\d+)(?=(?:\s|[+)=,.;:]|\\right|$))/g,
      (_full, prefix: string, whole: string, numerator: string, denominator: string) =>
        `${prefix}${whole}\\frac{${numerator}}{${denominator}}`,
    );
}

function normalizeBrokenMathSpacing(raw: string): string {
  if (!raw) return raw;

  return raw
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u000B/g, " ")
    .replace(/([\\{}()[\]|∣=+\-−*/,:;<>^])\s*[\r\n]+\s*/g, "$1")
    .replace(/\s*[\r\n]+\s*([\\{}()[\]|∣=+\-−*/,:;<>^])/g, "$1")
    .replace(/(-?)\s*(\d)\s*[\r\n]+\s*(\d)\s*[\r\n]+\s*\3\s*[\r\n]+\s*\2/g, "$1$2 $3 $3 $2")
    .replace(/(\\[A-Za-z]+)\s+([\[{(|])/g, "$1$2")
    .replace(/([\])}|])\s+(\\[A-Za-z]+)/g, "$1$2")
    .replace(/(\d)\s+([A-Za-z])/g, "$1$2")
    .replace(/([A-Za-z])\s+(\d)/g, "$1$2")
    .replace(/([|∣])\s+/g, "$1")
    .replace(/\s+([|∣])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function restoreInlineMathDelimiters(value: string): string {
  if (!value) return value;
  if (value.includes("$")) return value;

  const withWrappedEnvironments = value.replace(
    /\\begin\{([a-zA-Z*]+)\}[\s\S]+?\\end\{\1\}/g,
    (full) => `$$${full.trim()}$$`,
  );
  if (withWrappedEnvironments !== value) {
    return withWrappedEnvironments;
  }

  const withWrappedBraceRuns = wrapEscapedBraceMathRuns(value);
  const withWrappedDegreeExpressions = withWrappedBraceRuns.replace(
    /(\d+\^\\circ(?:\s*[,;]\s*\d+\^\\circ)+|\d+\^\\circ)/g,
    (full) => `$${full.trim()}$`,
  );
  if (withWrappedDegreeExpressions !== value) {
    return wrapTrailingLatexRuns(withWrappedDegreeExpressions);
  }

  // Wrap obvious LaTeX commands inline.
  // Example: "Илэрхийллийг хялбарчил. \\sqrt{50}" -> "... $\\sqrt{50}$"
  const withWrappedCommands = value.replace(
    /(\\[A-Za-z]+)(\s*(?:\{[^}]*\}|\[[^\]]*\]))+/g,
    (full) => `$${full.trim()}$`,
  );
  if (withWrappedCommands !== value) {
    return wrapTrailingLatexRuns(withWrappedCommands);
  }

  // Wrap ascii-only math-ish expressions containing =, ^, or _ with $...$.
  // Works even when embedded in Mongolian text.
  const pattern =
    /([A-Za-z0-9][A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]*[=^_][A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]*[A-Za-z0-9])([.?!,;:]?)/g;

  return wrapTrailingLatexRuns(
    value.replace(pattern, (_full, expr: string, punct: string) => {
      const trimmed = String(expr).trim();
      if (!trimmed) return _full;
      return `$${trimmed}$${punct ?? ""}`;
    }),
  );
}

function wrapTrailingLatexRuns(value: string): string {
  if (!value || value.includes("$$")) {
    return value;
  }

  return value.replace(
    /(\\[A-Za-z][\\A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]+?)(?=(?:\s+[А-Яа-яӨөҮүЁё]|$))/g,
    (full) => {
      const trimmed = full.trim();
      if (!trimmed || trimmed.includes("$")) {
        return full;
      }

      return `$${trimmed}$`;
    },
  );
}

function wrapEscapedBraceMathRuns(value: string) {
  if (!value) {
    return value;
  }

  let cursor = 0;
  let wrapped = "";
  let hasWrappedSegment = false;

  while (cursor < value.length) {
    const leftBraceIndex = value.indexOf("\\left\\{", cursor);
    const bareBraceIndex = value.indexOf("\\{", cursor);
    const candidateIndexes = [leftBraceIndex, bareBraceIndex].filter(
      (index) => index >= 0,
    );

    if (candidateIndexes.length === 0) {
      wrapped += value.slice(cursor);
      break;
    }

    const nextIndex = Math.min(...candidateIndexes);
    wrapped += value.slice(cursor, nextIndex);

    const isLeftRightBrace = value.startsWith("\\left\\{", nextIndex);
    const closingToken = isLeftRightBrace ? "\\right\\}" : "\\}";
    const searchStart = nextIndex + (isLeftRightBrace ? "\\left\\{".length : "\\{".length);
    const closingIndex = value.indexOf(closingToken, searchStart);

    if (closingIndex < 0) {
      wrapped += value.slice(nextIndex);
      break;
    }

    const segment = value.slice(nextIndex, closingIndex + closingToken.length).trim();
    const previousChar = wrapped.at(-1);
    const nextChar = value.at(closingIndex + closingToken.length);
    const isAlreadyWrapped = previousChar === "$" && nextChar === "$";

    wrapped += isAlreadyWrapped ? segment : `$${segment}$`;
    hasWrappedSegment = hasWrappedSegment || !isAlreadyWrapped;
    cursor = closingIndex + closingToken.length;
  }

  return hasWrappedSegment ? wrapped : value;
}
