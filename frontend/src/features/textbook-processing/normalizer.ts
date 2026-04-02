function normalizeWhitespace(value: string) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeExtractedText(value: string) {
  return normalizeWhitespace(value);
}

export function sanitizeHumanText(value: string) {
  return normalizeWhitespace(value)
    .replace(
      /[^\p{L}\p{N}\s.,;:!?()[\]{}\-+*/=<>%'"`~@#$^&_\\|°√π∞≤≥≈×÷±∫∑∏]/gu,
      " ",
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanAnalysisPageText(value: string) {
  return sanitizeHumanText(value)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitParagraphs(text: string) {
  return String(text || "")
    .trim()
    .split(/(?<=[.!?])\s{2,}|\n{2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function cleanHeading(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.·•]+$/g, "")
    .replace(/\s+\d{1,3}$/g, "")
    .trim();
}

export function slugifyText(value: string) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return ascii || `textbook-${Date.now()}`;
}

export function countTokens(value: string) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function extractHeadingNumber(value: string) {
  const matched = String(value || "").match(/^(\d+(?:\.\d+){0,3})\b/);
  return matched?.[1] || "";
}

export function directPageNumbersFromMetadata(metadata: Record<string, unknown> | null) {
  const raw = metadata?.directPageNumbers;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1)
    .map((value) => Math.trunc(value));
}
