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
  return next.trim();
}

export function normalizeBackendMathText(raw: string): string {
  const normalizedRaw = normalizeSystemSeparators(raw);

  if (containsExplicitMathDelimiters(normalizedRaw)) {
    return normalizeBackendDelimitedMathText(normalizedRaw);
  }

  return restoreInlineMathDelimiters(normalizeBackendLatexArtifacts(normalizedRaw));
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
    .replace(/\\\$(?=\{)/g, "\\");

  // 2) Fix double escaping before LaTeX commands: "\\\\sqrt" -> "\\sqrt"
  // Keep literal linebreaks ("\\\\") intact by only touching when a command follows.
  next = next.replace(/\\\\(?=[A-Za-z])/g, "\\");

  // 3) Remove dangling '$' before closers like "^{7$}" or "\\frac{100}{4$}"
  next = next.replace(/\$([}\]\)])/g, "$1");

  // 4) Strip ALL remaining dollars. Our app stores delimiter-free text in DB, and
  // incoming backend text frequently contains stray '$' artifacts.
  next = next.replace(/\$/g, "");

  return next.trim();
}

function normalizeCommonMathSyntax(value: string): string {
  if (!value) return value;

  return value
    .replace(/\\left\{/g, "\\left(")
    .replace(/\\right\}/g, "\\right)")
    .replace(
      /(^|[=+\-*/,(]\s*)(\d+)\s+(\d+)\/(\d+)(?=(?:\s|[+)=,.;:]|\\right|$))/g,
      (_full, prefix: string, whole: string, numerator: string, denominator: string) =>
        `${prefix}${whole}\\frac{${numerator}}{${denominator}}`,
    );
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
