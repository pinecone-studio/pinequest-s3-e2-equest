"use client";

import katex from "katex";
import { cn } from "@/lib/utils";

type MathTextProps = {
  as?: "div" | "h2" | "p" | "span";
  className?: string;
  displayMode?: boolean;
  text?: string | null;
};

type MathSegment = {
  displayMode: boolean;
  type: "math" | "text";
  value: string;
};

const DELIMITER_PATTERNS = [
  { close: "$$", displayMode: true, open: "$$" },
  { close: "$", displayMode: false, open: "$" },
  { close: "\\]", displayMode: true, open: "\\[" },
  { close: "\\)", displayMode: false, open: "\\(" },
] as const;

const renderKatex = (value: string, displayMode: boolean) => {
  try {
    return katex.renderToString(value.trim(), {
      displayMode,
      // Include MathML so rendered formulas stay readable to assistive tech.
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
    });
  } catch {
    return null;
  }
};

const looksLikeMathCandidate = (value: string) => {
  const text = value.trim();
  if (!text) return false;

  if (/[\\^_=<>±√∑∫∞]/u.test(text)) return true;
  if (/[{}]/.test(text)) return true;
  if (/\d+\s*[/+*-]\s*\d+/.test(text)) return true;

  return (
    /^[0-9a-zA-Z().,[\]/+\-=*:\s|]+$/.test(text) &&
    /[=+\-*/^]/.test(text) &&
    /[0-9a-zA-Z]/.test(text)
  );
};

const hasCyrillicText = (value: string) => /[А-Яа-яӨөҮүЁё]/u.test(value);

const looksLikeInlineMathToken = (value: string) => {
  const text = value.trim();
  if (!text || hasCyrillicText(text)) {
    return false;
  }

  if (/[\\^_=<>±√∑∫∞]/u.test(text)) {
    return true;
  }

  if (/[A-Za-z]\([^)]*\)/.test(text)) {
    return true;
  }

  if (/\d+\s*[/+*]\s*\d+/.test(text)) {
    return true;
  }

  return /[=+*/^]/.test(text) && /[0-9A-Za-z]/.test(text);
};

const wrapInlineMathToken = (token: string) => {
  if (!token || token.includes("$") || token.includes("\\(") || token.includes("\\[")) {
    return token;
  }

  let working = token;
  let trailingPunctuation = "";
  let trailingCyrillicSuffix = "";

  const punctuationMatch = working.match(/[.,!?;:]+$/u);
  if (punctuationMatch) {
    trailingPunctuation = punctuationMatch[0];
    working = working.slice(0, -trailingPunctuation.length);
  }

  const cyrillicSuffixMatch = working.match(/(-[А-Яа-яӨөҮүЁё]+)$/u);
  if (cyrillicSuffixMatch) {
    trailingCyrillicSuffix = cyrillicSuffixMatch[0];
    working = working.slice(0, -trailingCyrillicSuffix.length);
  }

  if (!looksLikeInlineMathToken(working)) {
    return token;
  }

  return `$${working}$${trailingCyrillicSuffix}${trailingPunctuation}`;
};

const autoWrapMixedInlineMath = (value: string) =>
  value
    .split(/(\s+)/)
    .map((segment) => {
      if (!segment || /^\s+$/u.test(segment)) {
        return segment;
      }

      return wrapInlineMathToken(segment);
    })
    .join("");

const wrapTrailingLatexRuns = (value: string) =>
  value.replace(
    /(\\[A-Za-z][\\A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]+?)(?=(?:\s+[А-Яа-яӨөҮүЁё]|$))/gu,
    (full) => {
      const trimmed = full.trim();
      if (!trimmed || trimmed.includes("$")) {
        return full;
      }

      return `$${trimmed}$`;
    },
  );

const wrapEscapedBraceMathRuns = (value: string) => {
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
    const searchStart =
      nextIndex + (isLeftRightBrace ? "\\left\\{".length : "\\{".length);
    const closingIndex = value.indexOf(closingToken, searchStart);

    if (closingIndex < 0) {
      wrapped += value.slice(nextIndex);
      break;
    }

    const segment = value
      .slice(nextIndex, closingIndex + closingToken.length)
      .trim();
    const previousChar = wrapped[wrapped.length - 1];
    const nextChar = value[closingIndex + closingToken.length];
    const isAlreadyWrapped = previousChar === "$" && nextChar === "$";

    wrapped += isAlreadyWrapped ? segment : `$${segment}$`;
    hasWrappedSegment = hasWrappedSegment || !isAlreadyWrapped;
    cursor = closingIndex + closingToken.length;
  }

  return hasWrappedSegment ? wrapped : value;
};

const autoWrapInlineLatex = (value: string) => {
  if (!value) {
    return value;
  }

  const withWrappedBraceRuns = wrapEscapedBraceMathRuns(value);
  if (withWrappedBraceRuns !== value) {
    return autoWrapMixedInlineMath(wrapTrailingLatexRuns(withWrappedBraceRuns));
  }

  const withWrappedCommands = value.replace(
    /(\\[A-Za-z]+)(\s*(?:\{[^}]*\}|\[[^\]]*\]))+/g,
    (full) => `$${full.trim()}$`,
  );

  return autoWrapMixedInlineMath(wrapTrailingLatexRuns(withWrappedCommands));
};

const parseMathSegments = (value: string): MathSegment[] => {
  const segments: MathSegment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const nextDelimiter = DELIMITER_PATTERNS
      .map((delimiter) => {
        const index = value.indexOf(delimiter.open, cursor);
        return index === -1 ? null : { ...delimiter, index };
      })
      .filter((entry): entry is (typeof DELIMITER_PATTERNS)[number] & { index: number } => Boolean(entry))
      .sort((left, right) => left.index - right.index)[0];

    if (!nextDelimiter) {
      segments.push({
        displayMode: false,
        type: "text",
        value: value.slice(cursor),
      });
      break;
    }

    if (nextDelimiter.index > cursor) {
      segments.push({
        displayMode: false,
        type: "text",
        value: value.slice(cursor, nextDelimiter.index),
      });
    }

    const start = nextDelimiter.index + nextDelimiter.open.length;
    const end = value.indexOf(nextDelimiter.close, start);

    if (end === -1) {
      segments.push({
        displayMode: false,
        type: "text",
        value: value.slice(nextDelimiter.index),
      });
      break;
    }

    segments.push({
      displayMode: nextDelimiter.displayMode,
      type: "math",
      value: value.slice(start, end),
    });
    cursor = end + nextDelimiter.close.length;
  }

  return segments.filter((segment) => segment.value.length > 0);
};

export function MathText({
  as = "div",
  className,
  displayMode = false,
  text,
}: MathTextProps) {
  const Component = as;
  const value = autoWrapInlineLatex(text?.trim() ?? "");

  if (!value) {
    return null;
  }

  const segments = parseMathSegments(value);
  const hasDelimitedMath = segments.some((segment) => segment.type === "math");
  const wholeMathHtml =
    !hasDelimitedMath &&
    looksLikeMathCandidate(value) &&
    !hasCyrillicText(value)
      ? renderKatex(value, displayMode)
      : null;

  return (
    <Component
      className={cn(
        "math-text break-words whitespace-pre-wrap",
        displayMode && "space-y-3",
        className,
      )}
    >
      {wholeMathHtml ? (
        <span dangerouslySetInnerHTML={{ __html: wholeMathHtml }} />
      ) : (
        segments.map((segment, index) => {
          if (segment.type === "text") {
            return <span key={`${segment.type}-${index}`}>{segment.value}</span>;
          }

          const html = renderKatex(segment.value, segment.displayMode);
          if (!html) {
            return <span key={`${segment.type}-${index}`}>{segment.value}</span>;
          }

          return (
            <span
              key={`${segment.type}-${index}`}
              className={segment.displayMode ? "block overflow-x-auto overflow-y-hidden py-1" : "inline-block max-w-full align-middle"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })
      )}
    </Component>
  );
}
