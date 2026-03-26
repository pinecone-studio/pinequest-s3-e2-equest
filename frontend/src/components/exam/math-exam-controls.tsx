"use client";

import { ChevronDown, LoaderCircle, Plus } from "lucide-react";
import {
  useRef,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DIFFICULTY_LABELS,
  type GeneratorSettings,
} from "@/lib/math-exam-model";
import type { QuestionType } from "@/lib/math-exam-contract";
import { cn } from "@/lib/utils";

function ExamStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

type MathExamControlsProps = {
  examTitle: string;
  generatorError: string;
  generatorSettings: GeneratorSettings;
  isExtractingSource: boolean;
  isGenerating: boolean;
  isGeneratorOpen: boolean;
  onAddQuestion: (type: QuestionType) => void;
  onDemo: () => void;
  onExamTitleChange: (value: string) => void;
  onGenerateExam: () => void;
  onGeneratorOpenChange: (open: boolean) => void;
  onReset: () => void;
  onSourceFilesSelected: (files: File[]) => void;
  requestedQuestionCount: number;
  setGeneratorSettings: Dispatch<SetStateAction<GeneratorSettings>>;
  sourceFiles: File[];
  stats: {
    mathCount: number;
    mcqCount: number;
    totalPoints: number;
  };
};

export function MathExamControls({
  examTitle,
  generatorError,
  generatorSettings,
  isExtractingSource,
  isGenerating,
  isGeneratorOpen,
  onAddQuestion,
  onDemo,
  onExamTitleChange,
  onGenerateExam,
  onGeneratorOpenChange,
  onReset,
  onSourceFilesSelected,
  requestedQuestionCount,
  setGeneratorSettings,
  sourceFiles,
  stats,
}: MathExamControlsProps) {
  const generatorFileInputRef = useRef<HTMLInputElement | null>(null);

  function handleSourceFileChange(event: ChangeEvent<HTMLInputElement>) {
    void onSourceFilesSelected(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  return (
    <Card className="border border-border/70 bg-card/90 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            Жишиг Шалгалт
          </Badge>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={generatorFileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.doc,.docx"
              className="hidden"
              onChange={handleSourceFileChange}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isExtractingSource}
              onClick={() => generatorFileInputRef.current?.click()}
            >
              {isExtractingSource ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Уншиж байна
                </>
              ) : (
                <>Docs file</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onGeneratorOpenChange(!isGeneratorOpen)}
            >
              AI Generate
              <ChevronDown
                className={cn(
                  "transition-transform",
                  isGeneratorOpen && "rotate-180",
                )}
              />
            </Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="exam-title">Шалгалтын нэр</Label>
            <Input
              id="exam-title"
              value={examTitle}
              onChange={(event) => onExamTitleChange(event.target.value)}
              className="h-11 text-lg"
              placeholder="Шалгалтын нэрээ оруулна уу"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddQuestion("mcq")}
            >
              <Plus />
              Тест нэмэх
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddQuestion("math")}
            >
              <Plus />
              Задгай даалгавар нэмэх
            </Button>
          </div>
        </div>
        <Collapsible open={isGeneratorOpen} onOpenChange={onGeneratorOpenChange}>
          <CollapsibleContent className="space-y-4 border-t border-border/70 pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="generator-mcq-count">Тестийн тоо</Label>
                  <Input
                    id="generator-mcq-count"
                    type="number"
                    min={0}
                    value={generatorSettings.mcqCount}
                    onChange={(event) =>
                      setGeneratorSettings((current) => ({
                        ...current,
                        mcqCount: Math.max(
                          0,
                          Number.parseInt(event.target.value || "0", 10) || 0,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generator-math-count">
                    Задгай даалгаврын тоо
                  </Label>
                  <Input
                    id="generator-math-count"
                    type="number"
                    min={0}
                    value={generatorSettings.mathCount}
                    onChange={(event) =>
                      setGeneratorSettings((current) => ({
                        ...current,
                        mathCount: Math.max(
                          0,
                          Number.parseInt(event.target.value || "0", 10) || 0,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generator-total-points">Нийт оноо</Label>
                  <Input
                    id="generator-total-points"
                    type="number"
                    min={1}
                    value={generatorSettings.totalPoints}
                    onChange={(event) =>
                      setGeneratorSettings((current) => ({
                        ...current,
                        totalPoints: Math.max(
                          1,
                          Number.parseInt(event.target.value || "1", 10) || 1,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Хавсаргасан материал</Label>
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    {sourceFiles.length > 0 ? (
                      <div className="space-y-1">
                        {sourceFiles.map((file) => (
                          <div key={`${file.name}-${file.size}`}>
                            {file.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>Баримт хавсаргаагүй байна.</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generator-source-context">
                    Материалаас уншсан агуулга
                  </Label>
                  <Textarea
                    id="generator-source-context"
                    value={generatorSettings.sourceContext}
                    onChange={(event) =>
                      setGeneratorSettings((current) => ({
                        ...current,
                        sourceContext: event.target.value,
                      }))
                    }
                    className="min-h-32"
                    placeholder="Энэ хэсэг нь AI Generate-д нэмэлт эх материал болгон ашиглагдана."
                  />
                  {isExtractingSource && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                      Файлаас асуултуудыг таньж байна
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Түвшин</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["easy", "medium", "advanced"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                          generatorSettings.difficulty === level
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() =>
                          setGeneratorSettings((current) => ({
                            ...current,
                            difficulty: level,
                          }))
                        }
                      >
                        {DIFFICULTY_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="generator-topics">Заасан дэд сэдвүүд</Label>
                  <Textarea
                    id="generator-topics"
                    value={generatorSettings.topics}
                    onChange={(event) =>
                      setGeneratorSettings((current) => ({
                        ...current,
                        topics: event.target.value,
                      }))
                    }
                    className="min-h-24"
                    placeholder="Жишээ: Квадрат тэгшитгэл, график, язгууртай илэрхийлэл"
                  />
                </div>
              </div>
            </div>
            {generatorError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {generatorError}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onGenerateExam}
                disabled={isGenerating || requestedQuestionCount <= 0}
              >
                {isGenerating ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Gemini үүсгэж байна
                  </>
                ) : (
                  <>AI Generate</>
                )}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <ExamStat label="Тестийн тоо" value={String(stats.mcqCount)} />
          <ExamStat
            label="Сонгох / Бодлого"
            value={`${stats.mcqCount} / ${stats.mathCount}`}
          />
          <ExamStat label="Нийт оноо" value={String(stats.totalPoints)} />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
          <Button type="button" variant="outline" onClick={onDemo}>
            Demo
          </Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
