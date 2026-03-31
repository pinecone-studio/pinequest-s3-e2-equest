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
      output: "html",
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

const autoWrapInlineLatex = (value: string) => {
  if (!value || value.includes("$") || value.includes("\\(") || value.includes("\\[")) {
    return value;
  }

  const withWrappedCommands = value.replace(
    /(\\[A-Za-z]+)(\s*(?:\{[^}]*\}|\[[^\]]*\]))+/g,
    (full) => `$${full.trim()}$`,
  );

  return wrapTrailingLatexRuns(withWrappedCommands);
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
