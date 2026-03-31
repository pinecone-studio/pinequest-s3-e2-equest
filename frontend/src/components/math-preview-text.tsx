"use client";

import { useMemo, type ReactNode } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

import { cn } from "@/lib/utils";
import {
  normalizeBackendLatexOnly,
  normalizeBackendMathText,
  normalizePreviewMathText,
} from "@/lib/normalize-math-text";
import { normalizeStructuredContent } from "@/lib/normalize-structured-content";

type MathPreviewTextProps = {
  activeMathIndex?: number | null;
  activeTextIndex?: number | null;
  className?: string;
  content: string;
  /** `backend`: DB/API (зарим `$` цэвэрлэн дахин орооно). `preview`: хэрэглэгчийн оролт — `$...$` хадгална. */
  contentSource?: "backend" | "preview";
  displayMode?: boolean;
  forceMath?: boolean;
  onMathSegmentClick?: (segment: MathPreviewMathSegment) => void;
  onTextSegmentClick?: (segment: MathPreviewTextSegment) => void;
  renderActiveMathSegment?: (segment: MathPreviewMathSegment) => ReactNode;
  renderActiveTextSegment?: (segment: MathPreviewTextSegment) => ReactNode;
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

type RenderBlock =
  | {
      type: "empty";
    }
  | {
      segments: Segment[];
      type: "line";
    }
  | {
      lines: MathSegment[];
      type: "system";
    };

export type MathPreviewMathSegment = {
  content: string;
  displayMode: boolean;
  mathIndex: number;
  raw: string;
};

export type MathPreviewTextSegment = {
  content: string;
  raw: string;
  textIndex: number;
};

function containsBlockLatex(value: string) {
  return /\\begin\{(?:cases|aligned|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}/.test(
    value,
  );
}

function stripOuterMathDelimiters(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) {
    return trimmed.slice(2, -2).trim();
  }

  if (trimmed.startsWith("\\(") && trimmed.endsWith("\\)")) {
    return trimmed.slice(2, -2).trim();
  }

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

  return (
    /^[A-Za-z0-9\s=+\-*/^_()[\]{}.,|:]+$/.test(trimmed) && /[=^_]/.test(trimmed)
  );
}

function looksLikeSystemRelationLine(value: string) {
  const trimmed = stripOuterMathDelimiters(value).trim();

  if (!trimmed) {
    return false;
  }

  return /(?:=|<|>|\\(?:leq|geq|neq|lt|gt)\b)/.test(trimmed);
}

function isSystemContinuationLine(value: string) {
  const trimmed = stripOuterMathDelimiters(value).trim();

  if (!trimmed) {
    return true;
  }

  return looksLikeSystemRelationLine(value);
}

function getSystemLineContent(value: string) {
  return stripOuterMathDelimiters(value)
    .replace(/^(?:\\left\\\{|\\\{|[{⎧⎨⎩])\s*/u, "")
    .replace(/\s*(?:\\right\.|\\right\\\}|[}⎫⎬⎭])$/u, "")
    .replace(/\\\\$/u, "")
    .trim();
}

function buildSystemBraceLatex(lines: MathSegment[]) {
  const phantomLines = lines
    .map((line) => {
      const content = getSystemLineContent(line.content) || "\\quad";
      return `\\vphantom{${content}}`;
    })
    .join("\\\\");

  return `\\left\\{\\begin{array}{@{}l@{}}${phantomLines}\\end{array}\\right.`;
}

function groupRenderBlocks(lines: Segment[][]) {
  const blocks: RenderBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index];

    if (currentLine.length === 0) {
      blocks.push({ type: "empty" });
      index += 1;
      continue;
    }

    const currentMathSegment =
      currentLine.length === 1 && currentLine[0]?.type === "math"
        ? currentLine[0]
        : null;

    if (
      !currentMathSegment ||
      !looksLikeSystemRelationLine(currentMathSegment.content)
    ) {
      blocks.push({
        segments: currentLine,
        type: "line",
      });
      index += 1;
      continue;
    }

    const groupedLines: MathSegment[] = [currentMathSegment];
    let nextIndex = index + 1;

    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex];
      const nextMathSegment =
        nextLine.length === 1 && nextLine[0]?.type === "math" ? nextLine[0] : null;

      if (!nextMathSegment || !isSystemContinuationLine(nextMathSegment.content)) {
        break;
      }

      groupedLines.push(nextMathSegment);
      nextIndex += 1;
    }

    if (groupedLines.length >= 2) {
      blocks.push({
        lines: groupedLines,
        type: "system",
      });
      index = nextIndex;
      continue;
    }

    blocks.push({
      segments: currentLine,
      type: "line",
    });
    index += 1;
  }

  return blocks;
}

function tokenizeLine(
  line: string,
  options: {
    displayMode: boolean;
    forceMath: boolean;
  },
) {
  if (!line.trim()) {
    return [] as Segment[];
  }

  if (options.forceMath) {
    return [
      {
        content: stripOuterMathDelimiters(line),
        displayMode: options.displayMode,
        raw: line,
        type: "math",
      },
    ] satisfies Segment[];
  }

  const segments: Segment[] = [];
  const pattern =
    /\\\[([\s\S]+?)\\\]|\\\(([^)\n]+?)\\\)|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let cursor = 0;

  for (const match of line.matchAll(pattern)) {
    const matchedText = match[0];
    const matchedIndex = match.index ?? 0;

    if (matchedIndex > cursor) {
      segments.push({
        content: line.slice(cursor, matchedIndex),
        type: "text",
      });
    }

    segments.push({
      content: stripOuterMathDelimiters(matchedText),
      displayMode:
        Boolean(match[1]) ||
        Boolean(match[3]) ||
        containsBlockLatex(matchedText),
      raw: matchedText,
      type: "math",
    });
    cursor = matchedIndex + matchedText.length;
  }

  if (cursor < line.length) {
    segments.push({
      content: line.slice(cursor),
      type: "text",
    });
  }

  const baseSegments =
    segments.length > 0
      ? segments
      : ([{ content: line, type: "text" }] satisfies Segment[]);
  const environmentPattern = /\\begin\{([a-zA-Z*]+)\}([\s\S]+?)\\end\{\1\}/g;
  const inlineLatexPattern =
    /(\\(?:[a-zA-Z]+|.)(?:\[[^\]]*\])?(?:\{[^{}]*\}){0,3}|[A-Za-z0-9]+(?:_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}]+)+)/g;
  const inlineOperatorPattern =
    /(?:\\[a-zA-Z]+(?:\{[^{}]*\})*|[A-Za-z0-9]+(?:_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}]+)*(?:\([^()\n]*\))?)(?:\s*(?:\\(?:cdot|div|geq|leq|neq|times)|[=+\-*/<>])\s*(?:\\[a-zA-Z]+(?:\{[^{}]*\})*|[A-Za-z0-9]+(?:_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}]+)*(?:\([^()\n]*\))?))+/g;

  function splitTextSegments(
    currentSegments: Segment[],
    patternToApply: RegExp,
    toMathSegment: (match: RegExpMatchArray) => MathSegment | null,
  ) {
    return currentSegments.flatMap((segment) => {
      if (segment.type !== "text" || !segment.content.trim()) {
        return [segment];
      }

      const nextSegments: Segment[] = [];
      let nextCursor = 0;
      const matcher = new RegExp(patternToApply.source, patternToApply.flags);

      for (const match of segment.content.matchAll(matcher)) {
        const matchedText = match[0];
        const matchedIndex = match.index ?? 0;
        const nextMathSegment = toMathSegment(match);

        if (!nextMathSegment) {
          continue;
        }

        if (matchedIndex > nextCursor) {
          nextSegments.push({
            content: segment.content.slice(nextCursor, matchedIndex),
            type: "text",
          });
        }

        nextSegments.push(nextMathSegment);
        nextCursor = matchedIndex + matchedText.length;
      }

      if (nextSegments.length === 0) {
        return [segment];
      }

      if (nextCursor < segment.content.length) {
        nextSegments.push({
          content: segment.content.slice(nextCursor),
          type: "text",
        });
      }

      return nextSegments;
    });
  }

  const withEnvironmentSegments = splitTextSegments(
    baseSegments,
    environmentPattern,
    (match) => ({
      content: match[0],
      displayMode: true,
      raw: match[0],
      type: "math",
    }),
  );
  const withInlineLatexSegments = splitTextSegments(
    withEnvironmentSegments,
    inlineLatexPattern,
    (match) => {
      if (!looksLikeLatexExpression(match[0])) {
        return null;
      }

      return {
        content: stripOuterMathDelimiters(match[0]),
        displayMode: false,
        raw: match[0],
        type: "math",
      };
    },
  );
  const withInlineOperatorSegments = splitTextSegments(
    withInlineLatexSegments,
    inlineOperatorPattern,
    (match) => {
      if (!looksLikeLatexExpression(match[0])) {
        return null;
      }

      return {
        content: stripOuterMathDelimiters(match[0]),
        displayMode: false,
        raw: match[0],
        type: "math",
      };
    },
  );

  if (withInlineOperatorSegments.some((segment) => segment.type === "math")) {
    return withInlineOperatorSegments;
  }

  if (looksLikeLatexExpression(line)) {
    return [
      {
        content: stripOuterMathDelimiters(line),
        displayMode: options.displayMode,
        raw: line,
        type: "math",
      },
    ] satisfies Segment[];
  }

  return [{ content: line, type: "text" }] satisfies Segment[];
}

export function containsMathPreviewSyntax(value: string) {
  return value.split(/\r?\n/).some((line) =>
    tokenizeLine(line, {
      displayMode: false,
      forceMath: false,
    }).some((segment) => segment.type === "math"),
  );
}

export function getMathPreviewSegments(
  content: string,
  options: {
    displayMode?: boolean;
    forceMath?: boolean;
  } = {},
) {
  let mathIndex = 0;

  return content.split(/\r?\n/).flatMap((line) =>
    tokenizeLine(line, {
      displayMode: options.displayMode ?? false,
      forceMath: options.forceMath ?? false,
    }).flatMap((segment) => {
      if (segment.type !== "math") {
        return [];
      }

      const nextSegment = {
        content: segment.content,
        displayMode: segment.displayMode,
        mathIndex,
        raw: segment.raw,
      } satisfies MathPreviewMathSegment;

      mathIndex += 1;
      return [nextSegment];
    }),
  );
}

export function getTextPreviewSegments(
  content: string,
  options: {
    displayMode?: boolean;
    forceMath?: boolean;
  } = {},
) {
  let textIndex = 0;

  return content.split(/\r?\n/).flatMap((line) =>
    tokenizeLine(line, {
      displayMode: options.displayMode ?? false,
      forceMath: options.forceMath ?? false,
    }).flatMap((segment) => {
      if (segment.type !== "text" || !segment.content.length) {
        return [];
      }

      const nextSegment = {
        content: segment.content,
        raw: segment.content,
        textIndex,
      } satisfies MathPreviewTextSegment;

      textIndex += 1;
      return [nextSegment];
    }),
  );
}

export default function MathPreviewText({
  activeMathIndex = null,
  activeTextIndex = null,
  className,
  content,
  contentSource = "backend",
  displayMode = false,
  forceMath = false,
  onMathSegmentClick,
  onTextSegmentClick,
  renderActiveMathSegment,
  renderActiveTextSegment,
}: MathPreviewTextProps) {
  const sanitizedContent = useMemo(() => {
    const structuredContent = normalizeStructuredContent(content);

    if (contentSource === "preview") {
      return normalizePreviewMathText(structuredContent);
    }
    // If the caller forces math, treat content as pure LaTeX (ex: answerLatex).
    // In that case we must NOT auto-wrap pieces with $...$, otherwise strings like
    // "x = 3,\\,-1" can be split into "$x = 3,$\\,-1" and render incorrectly.
    if (forceMath) {
      return normalizeBackendLatexOnly(structuredContent);
    }
    return normalizeBackendMathText(structuredContent);
  }, [content, contentSource, forceMath]);

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
  const renderBlocks = useMemo(() => groupRenderBlocks(lines), [lines]);
  let mathCounter = 0;
  let textCounter = 0;

  return (
    <div
      className={cn(
        "space-y-1 whitespace-pre-wrap [&_.katex-display]:my-1",
        className,
      )}
    >
      {renderBlocks.map((block, lineIndex) => {
        if (block.type === "empty") {
          return <div key={`line-${lineIndex}`} className="h-4" />;
        }

        if (block.type === "system") {
          let braceNode: ReactNode;

          try {
            const braceHtml = katex.renderToString(buildSystemBraceLatex(block.lines), {
              displayMode: false,
              throwOnError: false,
            });

            braceNode = (
              <span
                className="flex shrink-0 items-stretch pt-0.5 [&_.katex]:h-full [&_.katex-display]:my-0"
                dangerouslySetInnerHTML={{ __html: braceHtml }}
              />
            );
          } catch {
            braceNode = (
              <span
                aria-hidden="true"
                className="select-none font-light text-slate-500"
                style={{
                  fontSize: `${Math.max(2.8, block.lines.length * 1.65)}rem`,
                  lineHeight: 0.78,
                }}
              >
                {"{"}
              </span>
            );
          }

          const systemLineNodes = block.lines.map((segment, segmentIndex) => {
            const currentMathIndex = mathCounter;
            mathCounter += 1;
            const mathSegment = {
              content: segment.content,
              displayMode: true,
              mathIndex: currentMathIndex,
              raw: segment.raw,
            } satisfies MathPreviewMathSegment;

            if (
              activeMathIndex === currentMathIndex &&
              renderActiveMathSegment
            ) {
              return (
                <div key={`system-${lineIndex}-${segmentIndex}`} className="w-full">
                  {renderActiveMathSegment(mathSegment)}
                </div>
              );
            }

            let mathNode: ReactNode;

            try {
              const html = katex.renderToString(getSystemLineContent(segment.content), {
                displayMode: false,
                throwOnError: false,
              });

              mathNode = (
                <span dangerouslySetInnerHTML={{ __html: html }} />
              );
            } catch {
              mathNode = <span>{segment.raw}</span>;
            }

            if (!onMathSegmentClick) {
              return (
                <div key={`system-${lineIndex}-${segmentIndex}`} className="w-full">
                  {mathNode}
                </div>
              );
            }

            return (
              <div
                key={`system-${lineIndex}-${segmentIndex}`}
                role="button"
                tabIndex={0}
                className="w-full cursor-text rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                onClick={(event) => {
                  event.stopPropagation();
                  onMathSegmentClick(mathSegment);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  onMathSegmentClick(mathSegment);
                }}
              >
                {mathNode}
              </div>
            );
          });

          return (
            <div key={`line-${lineIndex}`} className="flex items-start gap-1.5">
              {braceNode}
              <div className="flex min-w-0 flex-1 flex-col gap-y-2 pt-1">
                {systemLineNodes}
              </div>
            </div>
          );
        }

        const segments = block.segments;

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
                const currentTextIndex = textCounter;
                textCounter += 1;
                const textSegment = {
                  content: segment.content,
                  raw: segment.content,
                  textIndex: currentTextIndex,
                } satisfies MathPreviewTextSegment;

                if (
                  activeTextIndex === currentTextIndex &&
                  renderActiveTextSegment
                ) {
                  return (
                    <span key={`segment-${lineIndex}-${segmentIndex}`}>
                      {renderActiveTextSegment(textSegment)}
                    </span>
                  );
                }

                if (!onTextSegmentClick || !segment.content.trim()) {
                  return (
                    <span key={`segment-${lineIndex}-${segmentIndex}`}>
                      {segment.content}
                    </span>
                  );
                }

                return (
                  <span
                    key={`segment-${lineIndex}-${segmentIndex}`}
                    role="button"
                    tabIndex={0}
                    className="cursor-text rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTextSegmentClick(textSegment);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      onTextSegmentClick(textSegment);
                    }}
                  >
                    {segment.content}
                  </span>
                );
              }

              const currentMathIndex = mathCounter;
              mathCounter += 1;
              const mathSegment = {
                content: segment.content,
                displayMode: segment.displayMode,
                mathIndex: currentMathIndex,
                raw: segment.raw,
              } satisfies MathPreviewMathSegment;

              if (
                activeMathIndex === currentMathIndex &&
                renderActiveMathSegment
              ) {
                return (
                  <span
                    key={`segment-${lineIndex}-${segmentIndex}`}
                    className={segment.displayMode ? "w-full" : undefined}
                  >
                    {renderActiveMathSegment(mathSegment)}
                  </span>
                );
              }

              let mathNode: ReactNode;

              try {
                const html = katex.renderToString(segment.content, {
                  displayMode: segment.displayMode,
                  throwOnError: false,
                });

                const Wrapper = segment.displayMode ? "div" : "span";

                mathNode = (
                  <Wrapper
                    className={
                      segment.displayMode
                        ? "w-full overflow-x-auto"
                        : undefined
                    }
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              } catch {
                mathNode = (
                  <span className={segment.displayMode ? "w-full" : undefined}>
                    {segment.raw}
                  </span>
                );
              }

              if (!onMathSegmentClick) {
                return (
                  <span key={`segment-${lineIndex}-${segmentIndex}`}>
                    {mathNode}
                  </span>
                );
              }

              const InteractiveWrapper = segment.displayMode ? "div" : "span";

              return (
                <InteractiveWrapper
                  key={`segment-${lineIndex}-${segmentIndex}`}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                    segment.displayMode ? "w-full cursor-text" : "cursor-text",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMathSegmentClick(mathSegment);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    onMathSegmentClick(mathSegment);
                  }}
                >
                  {mathNode}
                </InteractiveWrapper>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
