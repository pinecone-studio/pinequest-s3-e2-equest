export function normalizeBackendMathText(raw: string): string {
  return restoreInlineMathDelimiters(normalizeBackendLatexArtifacts(raw));
}

/**
 * For fields that should remain pure-LaTeX (ex: answerLatex).
 * Removes common backend/db artifacts but does NOT add `$...$` delimiters.
 */
export function normalizeBackendLatexOnly(raw: string): string {
  return normalizeBackendLatexArtifacts(raw);
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

function restoreInlineMathDelimiters(value: string): string {
  if (!value) return value;
  if (value.includes("$")) return value;

  // Wrap obvious LaTeX commands inline.
  // Example: "Илэрхийллийг хялбарчил. \\sqrt{50}" -> "... $\\sqrt{50}$"
  const withWrappedCommands = value.replace(
    /(\\[A-Za-z]+)(\s*(?:\{[^}]*\}|\[[^\]]*\]))+/g,
    (full) => `$${full.trim()}$`,
  );
  if (withWrappedCommands !== value) {
    return withWrappedCommands;
  }

  // Wrap ascii-only math-ish expressions containing =, ^, or _ with $...$.
  // Works even when embedded in Mongolian text.
  const pattern =
    /([A-Za-z0-9][A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]*[=^_][A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]*[A-Za-z0-9])([.?!,;:]?)/g;

  return value.replace(pattern, (_full, expr: string, punct: string) => {
    const trimmed = String(expr).trim();
    if (!trimmed) return _full;
    return `$${trimmed}$${punct ?? ""}`;
  });
}

