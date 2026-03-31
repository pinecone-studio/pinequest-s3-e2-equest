"use client";

import { ChevronDown, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";

import { readFileAsDataUrl } from "@/lib/math-exam-api";
import {
  buildQuestionLabel,
  coercePoints,
  type EditorQuestionItem,
  type ExamQuestion,
} from "@/lib/math-exam-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { MathAssistField } from "@/components/exam/math-exam-assist-field";

function McqOptionEditor({
  option,
  index,
  isCorrect,
  canRemove,
  onChange,
  onMarkCorrect,
  onRemove,
}: {
  canRemove: boolean;
  index: number;
  isCorrect: boolean;
  onChange: (value: string) => void;
  onMarkCorrect: () => void;
  onRemove: () => void;
  option: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition",
            isCorrect
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
          onClick={onMarkCorrect}
        >
          {String.fromCharCode(65 + index)}
        </button>
        <MathAssistField
          value={option}
          onChange={onChange}
          placeholder={`Сонголт ${String.fromCharCode(65 + index)}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function QuestionEditor({
  index,
  onAddOption,
  onRemove,
  onUpdate,
  question,
}: {
  index: number;
  onAddOption: (questionId: string) => void;
  onRemove: (questionId: string) => void;
  onUpdate: (
    questionId: string,
    updater: (question: ExamQuestion) => ExamQuestion,
  ) => void;
  question: ExamQuestion;
}) {
  const fieldId = useId();
  const [isImageToolsOpen, setIsImageToolsOpen] = useState(
    Boolean(question.imageDataUrl),
  );
  const questionImageInputRef = useRef<HTMLInputElement | null>(null);

  function openQuestionImagePicker() {
    setIsImageToolsOpen(true);

    requestAnimationFrame(() => {
      const input = questionImageInputRef.current;

      if (!input) {
        return;
      }

      input.value = "";
      input.click();
    });
  }

  function handleImageShortcutClick() {
    if (question.imageDataUrl) {
      setIsImageToolsOpen((current) => !current);
      return;
    }

    openQuestionImagePicker();
  }

  async function handleQuestionImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageDataUrl = await readFileAsDataUrl(file);

    onUpdate(question.id, (current) => ({
      ...current,
      imageAlt: current.imageAlt || file.name,
      imageDataUrl,
    }));
    setIsImageToolsOpen(true);
  }

  return (
    <Card className="border border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Асуулт {index + 1}</Badge>
              <Badge variant="secondary">
                {buildQuestionLabel(question.type)}
              </Badge>
            </div>

            <CardDescription>
              Асуултын өгүүлбэрээ бичиж, хариултыг тохируулна уу.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(question.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-prompt`}>Асуулт</Label>
            <MathAssistField
              id={`${fieldId}-prompt`}
              value={question.prompt}
              multiline
              onChange={(nextValue) =>
                onUpdate(question.id, (current) => ({
                  ...current,
                  prompt: nextValue,
                }))
              }
              placeholder="Асуултын текстээ энд бичнэ үү..."
              secondaryAction={{
                active: isImageToolsOpen || Boolean(question.imageDataUrl),
                icon: <ImagePlus />,
                onClick: handleImageShortcutClick,
              }}
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-points`}>Оноо</Label>
              <Input
                id={`${fieldId}-points`}
                type="number"
                min={1}
                value={question.points}
                onChange={(event) =>
                  onUpdate(question.id, (current) => ({
                    ...current,
                    points: coercePoints(event.target.value),
                  }))
                }
              />
            </div>
          </div>
        </div>
        <Collapsible open={isImageToolsOpen} onOpenChange={setIsImageToolsOpen}>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
            <CollapsibleContent className="space-y-3 border-t border-border/70 p-4">
              {question.imageDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={question.imageDataUrl}
                  alt={question.imageAlt || "Question image"}
                  className="max-h-64 rounded-2xl border border-border object-contain"
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background px-4 py-6 text-sm text-muted-foreground">
                  Одоогоор зураг хавсаргаагүй байна.
                </div>
              )}
              <div className="space-y-2">
                <Label>Зургийн тайлбар</Label>
                <Input
                  value={question.imageAlt}
                  onChange={(event) =>
                    onUpdate(question.id, (current) => ({
                      ...current,
                      imageAlt: event.target.value,
                    }))
                  }
                  placeholder="Жишээ: График, дүрс, хүснэгтийн тайлбар"
                />
              </div>
              <input
                ref={questionImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleQuestionImageChange(event);
                }}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openQuestionImagePicker}
                >
                  <ImagePlus />
                  Зураг нэмэх
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onUpdate(question.id, (current) => ({
                      ...current,
                      imageAlt: "",
                      imageDataUrl: undefined,
                    }))
                  }
                >
                  Зураг арилгах
                </Button>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {question.type === "mcq" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-foreground">
                  Хариултын сонголтууд
                </h3>
                <p className="text-sm text-muted-foreground">
                  Зөв хариултыг тэмдэглэхийн тулд үсгэн товчийг дарна уу.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => onAddOption(question.id)}
              >
                <Plus />
                Сонголт нэмэх
              </Button>
            </div>
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <McqOptionEditor
                  key={`${question.id}-option-${optionIndex}`}
                  option={option}
                  index={optionIndex}
                  isCorrect={question.correctOption === optionIndex}
                  canRemove={question.options.length > 2}
                  onChange={(value) =>
                    onUpdate(question.id, (current) => {
                      if (current.type !== "mcq") {
                        return current;
                      }

                      return {
                        ...current,
                        options: current.options.map((item, currentIndex) =>
                          currentIndex === optionIndex ? value : item,
                        ),
                      };
                    })
                  }
                  onMarkCorrect={() =>
                    onUpdate(question.id, (current) => {
                      if (current.type !== "mcq") {
                        return current;
                      }

                      return {
                        ...current,
                        correctOption:
                          current.correctOption === optionIndex
                            ? null
                            : optionIndex,
                      };
                    })
                  }
                  onRemove={() =>
                    onUpdate(question.id, (current) => {
                      if (
                        current.type !== "mcq" ||
                        current.options.length <= 2
                      ) {
                        return current;
                      }

                      const nextOptions = current.options.filter(
                        (_, currentIndex) => currentIndex !== optionIndex,
                      );

                      let nextCorrectOption = current.correctOption;

                      if (current.correctOption === optionIndex) {
                        nextCorrectOption = null;
                      } else if (
                        current.correctOption !== null &&
                        current.correctOption > optionIndex
                      ) {
                        nextCorrectOption = current.correctOption - 1;
                      }

                      return {
                        ...current,
                        options: nextOptions,
                        correctOption: nextCorrectOption,
                      };
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-guide`}>Сурагчид өгөх заавар</Label>
              <MathAssistField
                id={`${fieldId}-guide`}
                value={question.responseGuide}
                onChange={(nextValue) =>
                  onUpdate(question.id, (current) => {
                    if (current.type !== "math") {
                      return current;
                    }

                    return {
                      ...current,
                      responseGuide: nextValue,
                    };
                  })
                }
                placeholder="Жишээ: Эцсийн хариуг бүрэн хялбарчилж бич."
              />
            </div>
            <div className="space-y-2">
              <Label>Зөв хариу</Label>
              <MathAssistField
                value={question.answerLatex}
                previewDisplayMode
                previewForceMath
                onChange={(nextValue) =>
                  onUpdate(question.id, (current) => {
                    if (current.type !== "math") {
                      return current;
                    }

                    return {
                      ...current,
                      answerLatex: nextValue,
                    };
                  })
                }
                placeholder="Зөв математик хариуг оруулна уу"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type EditorSectionProps = {
  emptyText: string;
  onAddOption: (questionId: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: (questionId: string) => void;
  onUpdate: (
    questionId: string,
    updater: (question: ExamQuestion) => ExamQuestion,
  ) => void;
  open: boolean;
  questions: EditorQuestionItem[];
  title: string;
};

export function EditorSection({
  emptyText,
  onAddOption,
  onOpenChange,
  onRemove,
  onUpdate,
  open,
  questions,
  title,
}: EditorSectionProps) {
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
              questions.map(({ displayIndex, question }) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={displayIndex}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onAddOption={onAddOption}
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
