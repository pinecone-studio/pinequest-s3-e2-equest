import { AlertTriangle } from "lucide-react";
import MathPreviewText from "@/components/math-preview-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WeakQuestion } from "../lib/report-adapters";

interface ReportWeakQuestionsProps {
  questions: WeakQuestion[];
}

const MIN_BAR_WIDTH_PERCENT = 12;
const ACCENT_COLOR = "#EA580C";
const LIGHT_BAR_START = [255, 237, 213] as const;
const LIGHT_BAR_END = [254, 215, 170] as const;
const STRONG_BAR_START = [249, 115, 22] as const;
const STRONG_BAR_END = [234, 88, 12] as const;

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
  const intensity = clamp(errorRate / 100) ** 1.35;

  return {
    backgroundImage: `linear-gradient(90deg, ${mixColor(LIGHT_BAR_START, STRONG_BAR_START, intensity)} 0%, ${mixColor(LIGHT_BAR_END, STRONG_BAR_END, intensity)} 100%)`,
  };
}

function getBarWidth(errorRate: number): string {
  return `${Math.max(Math.round(errorRate), MIN_BAR_WIDTH_PERCENT)}%`;
}

export function ReportWeakQuestions({ questions }: ReportWeakQuestionsProps) {
  return (
    <Card className="h-[295px] rounded-md border border-[#eef2f8] bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.18)]">
      <CardHeader className="px-8 pt-2">
        <div className="flex items-center gap-3 text-[#1f2937]">
          <AlertTriangle
            className="h-6 w-6"
            style={{ color: ACCENT_COLOR }}
            strokeWidth={2.1}
          />
          <CardTitle className="text-lg font-semibold tracking-tight text-[#1f2937]">
            Хамгийн их алдсан асуултууд
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex px-8 pb-6">
        {questions.length > 0 ? (
          <div className="flex max-h-[220px] flex-1 flex-col justify-center gap-4 overflow-y-auto pr-1">
            {questions.map((question) => {
              const prompt =
                question.prompt.trim() || "Асуултын текст олдсонгүй.";

              return (
                <Tooltip key={question.label}>
                  <TooltipTrigger asChild>
                    <div
                      className="grid cursor-help grid-cols-[48px_minmax(0,1fr)_46px] items-center gap-5 rounded-xl outline-none transition-transform duration-200 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[#EA580C]/20"
                      tabIndex={0}
                      aria-label={`${question.label}: ${prompt}`}
                    >
                      <p className="text-[0.95rem] font-semibold tracking-[0.01em] text-[#4b5563]">
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
                        className="text-right text-[0.95rem] font-semibold"
                        style={{ color: ACCENT_COLOR }}
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
  );
}
