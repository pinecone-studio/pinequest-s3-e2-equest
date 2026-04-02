import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import MathPreviewText from "@/components/math-preview-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizeBackendMathText } from "@/lib/normalize-math-text";
import { normalizeStructuredContent } from "@/lib/normalize-structured-content";
import type { WeakQuestion } from "../lib/report-adapters";

interface ReportWeakQuestionsProps {
  questions: WeakQuestion[];
}

const MIN_BAR_WIDTH_PERCENT = 12;
const ACCENT_COLOR = "#EA580C";
const LIGHT_BAR_START = [246, 236, 229] as const;
const LIGHT_BAR_END = [238, 228, 222] as const;
const STRONG_BAR_START = [249, 102, 18] as const;
const STRONG_BAR_END = [226, 75, 10] as const;
const CYRILLIC_TEXT_PATTERN = /[А-Яа-яӨөҮүЁё]/u;
const EXPLICIT_MATH_DELIMITER_PATTERN =
  /\\\[[\s\S]+?\\\]|\\\([^)]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/;
const QUESTION_LABEL_PREFIX_PATTERN =
  /^(?<label>(?:[Qq]|[Aa])\d+\.\s*)(?<body>[\s\S]+)$/u;
const LATEX_MATH_RUN_PATTERN =
  /((?:[Qq]\d+\.\s*)?[A-Za-z0-9\\()[\]{}^_.,:+\-*/=<>| ]*\\[A-Za-z]+[A-Za-z0-9\\()[\]{}^_.,:+\-*/=<>| ]*)(?=(?:\s+[А-Яа-яӨөҮүЁё]|$))/gu;
const ASCII_EQUATION_RUN_PATTERN =
  /(^|[\s(])((?![Qq]\d+\.\s)[A-Za-z0-9][A-Za-z0-9\s:+\-*/=^_()[\]{}.,|<>]*[=^_][A-Za-z0-9\s:+\-*/=^_()[\]{}.,|<>]*[A-Za-z0-9])([.?!,;:]?)(?=$|[\s)])/g;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function mixColor(
  light: readonly [number, number, number],
  strong: readonly [number, number, number],
  intensity: number,
): string {
  return `rgb(${light
    .map((channel, index) => {
      return Math.round(channel + (strong[index] - channel) * intensity);
    })
    .join(", ")})`;
}

function getBarFillStyle(errorRate: number) {
  const intensity = clamp(errorRate / 100) ** 1.45;

  return {
    backgroundImage: `linear-gradient(90deg, ${mixColor(LIGHT_BAR_START, STRONG_BAR_START, intensity)} 0%, ${mixColor(LIGHT_BAR_END, STRONG_BAR_END, intensity)} 100%)`,
  };
}

function getBarWidth(errorRate: number): string {
  return `${Math.max(Math.round(errorRate), MIN_BAR_WIDTH_PERCENT)}%`;
}

function getPercentColor(errorRate: number): string {
  const intensity = clamp(errorRate / 100) ** 1.25;
  const light = [240, 198, 162] as const;
  const strong = [234, 88, 12] as const;
  return mixColor(light, strong, intensity);
}

function isMathQuestionType(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase();

  return (
    normalized === "math" ||
    normalized === "written" ||
    normalized === "open-ended" ||
    normalized === "open_ended" ||
    normalized === "equation"
  );
}

function looksMathLikePrompt(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  return (
    /\\(?:frac|sqrt|left|right|cdot|times|div|pm|mp|leq|geq|neq|alpha|beta|theta|pi|sum|int)\b/.test(
      normalized,
    ) ||
    /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([^)]+?\\\)/.test(
      normalized,
    ) ||
    /(?:\d|[A-Za-z])[ \t]*[=+\-*/^<>][ \t]*(?:\d|[A-Za-z])/.test(normalized) ||
    /(?:x|y|z|a|b|c)\s*[_^]\s*\{?[\dA-Za-z+-]+\}?/.test(normalized)
  );
}

function containsCyrillicText(value: string): boolean {
  return CYRILLIC_TEXT_PATTERN.test(value);
}

function isWeakQuestionMathCandidate(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed || CYRILLIC_TEXT_PATTERN.test(trimmed)) {
    return false;
  }

  if (/^[Qq]\d+\.$/.test(trimmed)) {
    return false;
  }

  if (/^[A-Za-z]$/.test(trimmed) || /^[-+]?\d+(?:[.,]\d+)?$/.test(trimmed)) {
    return false;
  }

  return (
    /\\[A-Za-z]+/.test(trimmed) ||
    /[_^=]/.test(trimmed) ||
    /[A-Za-z0-9)\]}]\s*[:+\-*/<>]\s*[A-Za-z0-9\\([{]/.test(trimmed)
  );
}

function wrapWeakQuestionMathCandidate(value: string): string {
  const trimmed = value.trim();
  const labeledMatch = trimmed.match(QUESTION_LABEL_PREFIX_PATTERN);
  const label = labeledMatch?.groups?.label ?? "";
  const body = labeledMatch?.groups?.body ?? trimmed;
  const leadingWhitespace = body.match(/^\s*/u)?.[0] ?? "";
  const bodyWithoutLeadingWhitespace = body.slice(leadingWhitespace.length);
  const firstMathCharacterIndex = bodyWithoutLeadingWhitespace.search(
    /[A-Za-z0-9\\([{]/u,
  );
  const leadingText =
    firstMathCharacterIndex > 0
      ? `${leadingWhitespace}${bodyWithoutLeadingWhitespace.slice(0, firstMathCharacterIndex)}`
      : leadingWhitespace;
  const mathCandidate =
    firstMathCharacterIndex > 0
      ? bodyWithoutLeadingWhitespace.slice(firstMathCharacterIndex)
      : bodyWithoutLeadingWhitespace;
  const trimmedMathCandidate = mathCandidate.trimEnd();
  const trailingPunctuation =
    trimmedMathCandidate.match(/[.?!,;:]$/u)?.[0] ?? "";
  const mathBody = trailingPunctuation
    ? trimmedMathCandidate.slice(0, -trailingPunctuation.length)
    : trimmedMathCandidate;

  if (!isWeakQuestionMathCandidate(mathBody)) {
    return value;
  }

  return `${label}${leadingText}$${mathBody.trim()}$${trailingPunctuation}`;
}

function normalizeWeakQuestionPrompt(value: string): string {
  const structuredContent = normalizeStructuredContent(value).trim();

  if (!structuredContent) {
    return "";
  }

  if (EXPLICIT_MATH_DELIMITER_PATTERN.test(structuredContent)) {
    return normalizeBackendMathText(structuredContent);
  }

  const withWrappedLatexRuns = structuredContent.replace(
    LATEX_MATH_RUN_PATTERN,
    (candidate) => wrapWeakQuestionMathCandidate(candidate),
  );
  const withWrappedAsciiRuns = withWrappedLatexRuns.replace(
    ASCII_EQUATION_RUN_PATTERN,
    (_full, boundary: string, expression: string, punctuation: string) =>
      `${boundary}$${expression.trim()}$${punctuation ?? ""}`,
  );

  return normalizeBackendMathText(withWrappedAsciiRuns);
}

function getQuestionPrompt(prompt: string): string {
  const normalized = normalizeWeakQuestionPrompt(prompt);

  return normalized || "Асуултын текст олдсонгүй.";
}

function shouldDisplayAsMath(question: WeakQuestion): boolean {
  return (
    isMathQuestionType(question.questionType) ||
    looksMathLikePrompt(question.prompt)
  );
}

function shouldForceMathPrompt(question: WeakQuestion, prompt: string): boolean {
  return shouldDisplayAsMath(question) && !containsCyrillicText(prompt);
}

export function ReportWeakQuestions({ questions }: ReportWeakQuestionsProps) {
  const [isAllOpen, setIsAllOpen] = useState(false);
  const visibleQuestions = questions.slice(0, 5);

  return (
    <>
      <Card className="h-[295px] rounded-md border border-[#eef2f8] bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.18)]">
        <CardHeader className="px-8 pt-2">
          <div className="flex items-center justify-between gap-3 text-[#1f2937]">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="h-6 w-6"
                style={{ color: ACCENT_COLOR }}
                strokeWidth={2.1}
              />
              <CardTitle className="text-lg font-semibold tracking-tight text-[#1f2937]">
                Хамгийн их алдсан асуултууд
              </CardTitle>
            </div>
            {questions.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAllOpen(true)}
                className="h-9 rounded-lg border-[#f3d2c2] bg-white px-3 text-xs font-semibold text-[#EA580C] shadow-none hover:bg-[#fff4ed]"
              >
                Цааш үзэх
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex px-8 pb-6">
          {questions.length > 0 ? (
            <div className="flex max-h-[220px] flex-1 flex-col justify-center gap-4 overflow-y-auto pr-1">
              {visibleQuestions.map((question, index) => {
                const prompt = getQuestionPrompt(question.prompt);
                const shouldRenderAsMath = shouldDisplayAsMath(question);
                const shouldForceMath = shouldForceMathPrompt(question, prompt);

                return (
                  <Tooltip key={`${question.label}-${index}`}>
                    <TooltipTrigger asChild>
                      <div
                        className="grid cursor-pointer grid-cols-[48px_minmax(0,1fr)_46px] items-center gap-5 rounded-xl outline-none transition-transform duration-200 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[#EA580C]/20"
                        tabIndex={0}
                        aria-label={`${question.label}: ${prompt}`}
                      >
                        <p className="text-[0.9rem] font-semibold tracking-[0.01em] text-[#4b5563]">
                          {question.label}
                        </p>

                        <div className="h-4 overflow-hidden rounded-full bg-[#e6ebf3]">
                          <div
                            className="h-full rounded-full transition-[width,background-image] duration-300"
                            style={{
                              ...getBarFillStyle(question.errorRate),
                              width: getBarWidth(question.errorRate),
                            }}
                          />
                        </div>

                        <p
                          className="text-right text-[0.9rem] font-semibold"
                          style={{ color: getPercentColor(question.errorRate) }}
                        >
                          {question.errorRate}%
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="block max-w-md bg-[#1f2937] px-3 py-2 text-white"
                    >
                      <MathPreviewText
                        content={prompt}
                        contentSource="backend"
                        displayMode={shouldRenderAsMath}
                        forceMath={shouldForceMath}
                        className="text-[12px] leading-5 text-white [&_.katex-display]:overflow-x-auto [&_.katex]:text-white"
                      />
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 text-sm text-muted-foreground">
              Алдсан асуулт олдсонгүй.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAllOpen} onOpenChange={setIsAllOpen}>
        <DialogContent className="h-[85vh] w-[92vw] max-w-[1000px] overflow-hidden rounded-[28px] border border-[#f3e7df] bg-white p-0 sm:max-w-[1000px]">
          <DialogHeader className="border-b border-[#f5e4d8] px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-[#1f2937]">
              Алдсан асуултуудын дэлгэрэнгүй
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#7c5a4b]">
              Нийт {questions.length} асуултын алдааны мэдээлэл.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[calc(85vh-120px)]">
            <div className="space-y-4 px-6 py-5">
              {questions.map((question, index) => {
                const prompt = getQuestionPrompt(question.prompt);
                const shouldRenderAsMath = shouldDisplayAsMath(question);
                const shouldForceMath = shouldForceMathPrompt(question, prompt);

                return (
                  <div
                    key={`detail-${question.label}-${index}`}
                    className="rounded-2xl border border-[#f3e7df] bg-[#fff8f2] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a0613a]">
                          {question.label}
                        </p>
                        <div className="mt-2 text-sm font-medium text-[#1f2937]">
                          <MathPreviewText
                            content={prompt}
                            contentSource="backend"
                            displayMode={shouldRenderAsMath}
                            forceMath={shouldForceMath}
                            className="text-[13px] leading-5 text-[#1f2937] [&_.katex-display]:overflow-x-auto [&_.katex]:text-[#1f2937]"
                          />
                        </div>
                      </div>
                      <div className="min-w-[160px] rounded-xl border border-[#f1d5c3] bg-white px-3 py-2 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a0613a]">
                          Алдааны хувь
                        </p>
                        <p className="mt-1 text-lg font-semibold text-[#EA580C]">
                          {question.errorRate}%
                        </p>
                        <p className="text-xs text-[#7c5a4b]">
                          {question.missedCount}/{question.totalCount} сурагч
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f4e6dc]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          ...getBarFillStyle(question.errorRate),
                          width: getBarWidth(question.errorRate),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
