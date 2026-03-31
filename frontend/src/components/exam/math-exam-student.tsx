"use client";

import { ChevronDown } from "lucide-react";

import MathPreviewText from "@/components/math-preview-text";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { buildQuestionLabel, type ExamQuestion } from "@/lib/math-exam-model";
import { cn } from "@/lib/utils";

function PreviewQuestion({
  index,
  question,
}: {
  index: number;
  question: ExamQuestion;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Q{index + 1}</Badge>
            <Badge variant="secondary">
              {buildQuestionLabel(question.type)}
            </Badge>
          </div>
          <MathPreviewText
            content={question.prompt.trim() || "Гарчиггүй асуулт"}
            className="text-base leading-7 text-foreground"
          />
        </div>
        <Badge variant="outline">{question.points} оноо</Badge>
      </div>

      {(question.imageDataUrl || question.imageAlt) && (
        <div className="mt-4 space-y-3">
          {question.imageDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={question.imageDataUrl}
              alt={question.imageAlt || "Question image"}
              className="max-h-72 rounded-2xl border border-border object-contain"
            />
          ) : null}
          {question.imageAlt ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Зургийн тайлбар: {question.imageAlt}
            </div>
          ) : null}
        </div>
      )}

      {question.type === "mcq" ? (
        <div className="mt-4 space-y-2">
          {question.options.map((option, optionIndex) => (
            <div
              key={`${question.id}-preview-${optionIndex}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3",
                question.correctOption === optionIndex
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border/70",
              )}
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
                  question.correctOption === optionIndex
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-border text-muted-foreground",
                )}
              >
                {String.fromCharCode(65 + optionIndex)}
              </div>
              <MathPreviewText
                content={
                  option.trim() ||
                  `Сонголт ${String.fromCharCode(65 + optionIndex)}`
                }
                className="text-sm text-foreground"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <MathPreviewText
              content={
                question.responseGuide.trim() ||
                "Хариултаа математик тэмдэглэгээ ашиглан бичнэ үү."
              }
            />
          </div>
          <div className="rounded-2xl border border-border/70 bg-background px-4 py-5 text-sm text-muted-foreground">
            Сурагчийн хариу бичих хэсэг
          </div>
          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <div className="mb-2">Зөв хариу:</div>
            {question.answerLatex.trim() ? (
              <MathPreviewText
                content={question.answerLatex}
                displayMode
                forceMath
              />
            ) : (
              "Одоогоор оруулаагүй"
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type PreviewSectionProps = {
  emptyText: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  questions: ExamQuestion[];
  title: string;
};

export function PreviewSection({
  emptyText,
  onOpenChange,
  open,
  questions,
  title,
}: PreviewSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/70">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-muted/30"
          >
            <div>
              <div className="text-base font-semibold text-foreground">
                {title}
              </div>
              <div className="text-sm text-muted-foreground">
                {questions.length} асуулт
              </div>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/70">
          <div className="space-y-4 p-4">
            {questions.length > 0 ? (
              questions.map((question, index) => (
                <PreviewQuestion
                  key={`${question.id}-preview`}
                  question={question}
                  index={index}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border/80 bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
