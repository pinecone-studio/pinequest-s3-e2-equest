"use client";

import { useMemo } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

import { cn } from "@/lib/utils";
import {
  normalizeBackendLatexOnly,
  normalizeBackendMathText,
} from "@/lib/normalize-math-text";

type MathPreviewTextProps = {
  className?: string;
  content: string;
  displayMode?: boolean;
  forceMath?: boolean;
};

type TextSegment = {
  content: string;
  type: "text";
};

type MathSegment = {
  content: string;
  displayMode: boolean;
  raw: string;
  type: "math";
};

type Segment = MathSegment | TextSegment;

function containsBlockLatex(value: string) {
  return /\\begin\{(?:cases|aligned|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}/.test(
    value,
  );
}


function stripOuterMathDelimiters(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return trimmed.slice(2, -2).trim();
  }

  if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function looksLikeLatexExpression(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (
    trimmed.startsWith("$") ||
    /\\(?:begin|cdot|circ|cos|cot|div|end|frac|geq|infty|int|left|leq|lg|lim|ln|log|neq|oint|operatorname|pi|pm|mp|prod|right|sin|sqrt|sum|tan|times|alpha|beta|gamma|theta|bigcap|bigcup)\b/.test(
      trimmed,
    )
  ) {
    return true;
  }

  return /^[A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]+$/.test(trimmed) &&
    /[=^_]/.test(trimmed);
}

function tokenizeLine(
  line: string,
  options: {
    displayMode: boolean;
    forceMath: boolean;
  },
) {
  const normalizedLine = line
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  if (!normalizedLine.trim()) {
    return [] as Segment[];
  }

  if (options.forceMath) {
    return [
      {
        content: stripOuterMathDelimiters(normalizedLine),
        displayMode: options.displayMode,
        raw: normalizedLine,
        type: "math",
      },
    ] satisfies Segment[];
  }

  const segments: Segment[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let cursor = 0;

  for (const match of normalizedLine.matchAll(pattern)) {
    const matchedText = match[0];
    const matchedIndex = match.index ?? 0;

    if (matchedIndex > cursor) {
      segments.push({
        content: normalizedLine.slice(cursor, matchedIndex),
        type: "text",
      });
    }

    segments.push({
      content: stripOuterMathDelimiters(matchedText),
      displayMode: Boolean(match[1]) || containsBlockLatex(matchedText),
      raw: matchedText,
      type: "math",
    });
    cursor = matchedIndex + matchedText.length;
  }

  if (cursor < normalizedLine.length) {
    segments.push({
      content: normalizedLine.slice(cursor),
      type: "text",
    });
  }

  if (segments.length > 0) {
    return segments;
  }

  const environmentPattern = /\\begin\{([a-zA-Z*]+)\}([\s\S]+?)\\end\{\1\}/g;
  const environmentSegments: Segment[] = [];
  let environmentCursor = 0;

  for (const match of normalizedLine.matchAll(environmentPattern)) {
    const matchedText = match[0];
    const matchedIndex = match.index ?? 0;

    if (matchedIndex > environmentCursor) {
      environmentSegments.push({
        content: normalizedLine.slice(environmentCursor, matchedIndex),
        type: "text",
      });
    }

    environmentSegments.push({
      content: matchedText,
      displayMode: true,
      raw: matchedText,
      type: "math",
    });
    environmentCursor = matchedIndex + matchedText.length;
  }

  if (environmentSegments.length > 0) {
    if (environmentCursor < normalizedLine.length) {
      environmentSegments.push({
        content: normalizedLine.slice(environmentCursor),
        type: "text",
      });
    }

    return environmentSegments;
  }

  const inlineLatexPattern =
    /(\\(?:[a-zA-Z]+|.)(?:\[[^\]]*\])?(?:\{[^{}]*\}){0,3}|[A-Za-z0-9]+(?:_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}]+)+)/g;
  const inlineSegments: Segment[] = [];
  let inlineCursor = 0;

  for (const match of normalizedLine.matchAll(inlineLatexPattern)) {
    const matchedText = match[0];
    const matchedIndex = match.index ?? 0;

    if (!looksLikeLatexExpression(matchedText)) {
      continue;
    }

    if (matchedIndex > inlineCursor) {
      inlineSegments.push({
        content: normalizedLine.slice(inlineCursor, matchedIndex),
        type: "text",
      });
    }

    inlineSegments.push({
      content: stripOuterMathDelimiters(matchedText),
      displayMode: false,
      raw: matchedText,
      type: "math",
    });
    inlineCursor = matchedIndex + matchedText.length;
  }

  if (inlineSegments.length > 0) {
    if (inlineCursor < normalizedLine.length) {
      inlineSegments.push({
        content: normalizedLine.slice(inlineCursor),
        type: "text",
      });
    }

    return inlineSegments;
  }

  if (looksLikeLatexExpression(normalizedLine)) {
    return [
      {
        content: stripOuterMathDelimiters(normalizedLine),
        displayMode: options.displayMode,
        raw: normalizedLine,
        type: "math",
      },
    ] satisfies Segment[];
  }

  return [{ content: normalizedLine, type: "text" }] satisfies Segment[];
}

export default function MathPreviewText({
  className,
  content,
  displayMode = false,
  forceMath = false,
}: MathPreviewTextProps) {
  const sanitizedContent = useMemo(
    // If the caller forces math, treat content as pure LaTeX (ex: answerLatex).
    // In that case we must NOT auto-wrap pieces with $...$, otherwise strings like
    // "x = 3,\\,-1" can be split into "$x = 3,$\\,-1" and render incorrectly.
    () => (forceMath ? normalizeBackendLatexOnly(content) : normalizeBackendMathText(content)),
    [content, forceMath],
  );

  const lines = useMemo(
    () =>
      sanitizedContent.split(/\r?\n/).map((line) =>
        tokenizeLine(line, {
          displayMode,
          forceMath,
        }),
      ),
    [sanitizedContent, displayMode, forceMath],
  );

  return (
    <div
      className={cn(
        "space-y-1 whitespace-pre-wrap [&_.katex-display]:my-1",
        className,
      )}
    >
      {lines.map((segments, lineIndex) => {
        if (segments.length === 0) {
          return <div key={`line-${lineIndex}`} className="h-4" />;
        }

        const hasDisplaySegment = segments.some(
          (segment) => segment.type === "math" && segment.displayMode,
        );

        return (
          <div
            key={`line-${lineIndex}`}
            className={cn(
              "flex flex-wrap items-baseline gap-x-1 gap-y-2",
              (forceMath && displayMode) || hasDisplaySegment
                ? "items-start"
                : null,
            )}
          >
            {segments.map((segment, segmentIndex) => {
              if (segment.type === "text") {
                return (
                  <span key={`segment-${lineIndex}-${segmentIndex}`}>
                    {segment.content}
                  </span>
                );
              }

              try {
                const html = katex.renderToString(segment.content, {
                  displayMode: segment.displayMode,
                  throwOnError: false,
                });

                const Wrapper = segment.displayMode ? "div" : "span";

                return (
                  <Wrapper
                    key={`segment-${lineIndex}-${segmentIndex}`}
                    className={segment.displayMode ? "w-full overflow-x-auto" : undefined}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              } catch {
                return (
                  <span
                    key={`segment-${lineIndex}-${segmentIndex}`}
                    className={segment.displayMode ? "w-full" : undefined}
                  >
                    {segment.raw}
                  </span>
                );
              }
            })}
          </div>
        );
      })}
    </div>
  );
}
