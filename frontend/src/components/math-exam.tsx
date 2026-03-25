"use client";

import {
  ChevronDown,
  LoaderCircle,
  Keyboard,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";

import MathInput from "@/components/math-input";
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
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type QuestionType = "mcq" | "math";
type DifficultyLevel = "easy" | "medium" | "advanced";

type BaseQuestion = {
  id: string;
  points: number;
  prompt: string;
  type: QuestionType;
};

type McqQuestion = BaseQuestion & {
  correctOption: number | null;
  options: string[];
  type: "mcq";
};

type MathQuestion = BaseQuestion & {
  answerLatex: string;
  responseGuide: string;
  type: "math";
};

type ExamQuestion = McqQuestion | MathQuestion;
type TextLikeElement = HTMLInputElement | HTMLTextAreaElement;
type GeneratedExamPayload = {
  title?: string;
  questions?: Array<{
    answerLatex?: string;
    correctOption?: number | null;
    options?: string[];
    points?: number;
    prompt?: string;
    responseGuide?: string;
    type?: QuestionType;
  }>;
};

let questionSequence = 0;

function nextQuestionId() {
  questionSequence += 1;
  return `question-${questionSequence}`;
}

function createMcqQuestion(overrides?: Partial<McqQuestion>): McqQuestion {
  return {
    id: overrides?.id ?? nextQuestionId(),
    type: "mcq",
    prompt: overrides?.prompt ?? "",
    points: overrides?.points ?? 1,
    options: overrides?.options ?? [
      "Сонголт A",
      "Сонголт B",
      "Сонголт C",
      "Сонголт D",
    ],
    correctOption: overrides?.correctOption ?? null,
  };
}

function createMathQuestion(overrides?: Partial<MathQuestion>): MathQuestion {
  return {
    id: overrides?.id ?? nextQuestionId(),
    type: "math",
    prompt: overrides?.prompt ?? "",
    points: overrides?.points ?? 2,
    answerLatex: overrides?.answerLatex ?? "",
    responseGuide:
      overrides?.responseGuide ?? "Бодолтын бүх алхмаа тодорхой бичнэ үү.",
  };
}

function createQuestion(type: QuestionType): ExamQuestion {
  return type === "mcq" ? createMcqQuestion() : createMathQuestion();
}

function buildQuestionLabel(type: QuestionType) {
  return type === "mcq" ? "Тест" : "Задгай даалгавар";
}

function coercePoints(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

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

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  advanced: "Ахисан",
  easy: "Амархан",
  medium: "Дунд",
};

function distributePoints(totalPoints: number, questionCount: number) {
  if (questionCount <= 0) {
    return [];
  }

  const safeTotal = Math.max(totalPoints, questionCount);
  const base = Math.floor(safeTotal / questionCount);
  const remainder = safeTotal % questionCount;

  return Array.from(
    { length: questionCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function normalizeGeneratedQuestions(
  payload: GeneratedExamPayload,
  settings: {
    mathCount: number;
    mcqCount: number;
    totalPoints: number;
  },
) {
  const rawQuestions = Array.isArray(payload.questions)
    ? payload.questions
    : [];
  const normalizedMcq = rawQuestions
    .filter((question) => question.type === "mcq")
    .slice(0, settings.mcqCount)
    .map((question) =>
      createMcqQuestion({
        correctOption:
          typeof question.correctOption === "number"
            ? question.correctOption
            : null,
        options:
          question.options?.length && question.options.length >= 2
            ? question.options.slice(0, 6)
            : undefined,
        points:
          typeof question.points === "number" && question.points > 0
            ? question.points
            : 1,
        prompt: question.prompt?.trim() ?? "",
      }),
    );

  const normalizedMath = rawQuestions
    .filter((question) => question.type === "math")
    .slice(0, settings.mathCount)
    .map((question) =>
      createMathQuestion({
        answerLatex: question.answerLatex?.trim() ?? "",
        points:
          typeof question.points === "number" && question.points > 0
            ? question.points
            : 1,
        prompt: question.prompt?.trim() ?? "",
        responseGuide:
          question.responseGuide?.trim() ??
          "Бодолтын бүх алхмаа тодорхой бичнэ үү.",
      }),
    );

  while (normalizedMcq.length < settings.mcqCount) {
    normalizedMcq.push(createMcqQuestion());
  }

  while (normalizedMath.length < settings.mathCount) {
    normalizedMath.push(createMathQuestion());
  }

  const combinedQuestions = [...normalizedMcq, ...normalizedMath];
  const pointPlan = distributePoints(
    settings.totalPoints,
    combinedQuestions.length,
  );

  return combinedQuestions.map((question, index) => ({
    ...question,
    points: pointPlan[index] ?? question.points,
  }));
}

function MathAssistField({
  id,
  multiline = false,
  onChange,
  placeholder,
  value,
}: {
  id?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [mathValue, setMathValue] = useState("");
  const inputRef = useRef<TextLikeElement | null>(null);
  const selectionRef = useRef({
    end: value.length,
    start: value.length,
  });

  function syncSelection() {
    const element = inputRef.current;

    if (!element) {
      return;
    }

    selectionRef.current = {
      start: element.selectionStart ?? value.length,
      end: element.selectionEnd ?? value.length,
    };
  }

  function applyMathValue() {
    if (!mathValue.trim()) {
      return;
    }

    const { start, end } = selectionRef.current;
    const nextValue = `${value.slice(0, start)}${mathValue}${value.slice(end)}`;
    const nextCaretPosition = start + mathValue.length;

    onChange(nextValue);
    setMathValue("");

    requestAnimationFrame(() => {
      const element = inputRef.current;

      if (!element) {
        return;
      }

      element.focus();
      element.setSelectionRange(nextCaretPosition, nextCaretPosition);
      selectionRef.current = {
        start: nextCaretPosition,
        end: nextCaretPosition,
      };
    });
  }

  const sharedProps = {
    className: cn(
      multiline
        ? "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 pr-12 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        : "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-12 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
    ),
    onClick: syncSelection,
    id,
    onKeyUp: syncSelection,
    onSelect: syncSelection,
    placeholder,
    value,
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {multiline ? (
          <textarea
            ref={(node) => {
              inputRef.current = node;
            }}
            {...sharedProps}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            ref={(node) => {
              inputRef.current = node;
            }}
            {...sharedProps}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1"
          onClick={() => {
            syncSelection();
            setIsKeyboardOpen((current) => !current);
          }}
        >
          <Keyboard />
        </Button>
      </div>

      <Collapsible open={isKeyboardOpen} onOpenChange={setIsKeyboardOpen}>
        <CollapsibleContent className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
          <MathInput
            value={mathValue}
            onChange={setMathValue}
            placeholder="Математикийн тэмдэглэгээг энд оруулна уу"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMathValue("");
                setIsKeyboardOpen(false);
              }}
            >
              Хаах
            </Button>
            <Button type="button" onClick={applyMathValue}>
              Оруулах
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function QuestionTypeSwitch({
  type,
  onChange,
}: {
  type: QuestionType;
  onChange: (type: QuestionType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["mcq", "math"] as const).map((option) => {
        const active = option === type;

        return (
          <button
            key={option}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option)}
          >
            {buildQuestionLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

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
    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 p-2">
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
  );
}

function QuestionEditor({
  index,
  onAddOption,
  onChangeType,
  onRemove,
  onUpdate,
  question,
}: {
  index: number;
  onAddOption: (questionId: string) => void;
  onChangeType: (questionId: string, type: QuestionType) => void;
  onRemove: (questionId: string) => void;
  onUpdate: (
    questionId: string,
    updater: (question: ExamQuestion) => ExamQuestion,
  ) => void;
  question: ExamQuestion;
}) {
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
            <CardTitle>Асуулт засварлах</CardTitle>
            <CardDescription>
              Асуултын өгүүлбэрээ бичиж, төрлөө сонгоод хариултыг тохируулна уу.
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
            <Label htmlFor={`${question.id}-prompt`}>Асуулт</Label>
            <MathAssistField
              id={`${question.id}-prompt`}
              value={question.prompt}
              multiline
              onChange={(nextValue) =>
                onUpdate(question.id, (current) => ({
                  ...current,
                  prompt: nextValue,
                }))
              }
              placeholder="Асуултын текстээ энд бичнэ үү..."
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${question.id}-points`}>Оноо</Label>
              <Input
                id={`${question.id}-points`}
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

                      const nextOptions = current.options.map(
                        (item, currentIndex) =>
                          currentIndex === optionIndex ? value : item,
                      );

                      return {
                        ...current,
                        options: nextOptions,
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
              <Label htmlFor={`${question.id}-guide`}>
                Сурагчид өгөх заавар
              </Label>
              <MathAssistField
                id={`${question.id}-guide`}
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
          <p className="text-base leading-7 text-foreground">
            {question.prompt.trim() || "Гарчиггүй асуулт"}
          </p>
        </div>
        <Badge variant="outline">{question.points} оноо</Badge>
      </div>

      {question.type === "mcq" ? (
        <div className="mt-4 space-y-2">
          {question.options.map((option, optionIndex) => (
            <div
              key={`${question.id}-preview-${optionIndex}`}
              className="flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3"
            >
              <div className="flex size-8 items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground">
                {String.fromCharCode(65 + optionIndex)}
              </div>
              <span className="text-sm text-foreground">
                {option.trim() ||
                  `Сонголт ${String.fromCharCode(65 + optionIndex)}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {question.responseGuide.trim() ||
              "Хариултаа математик тэмдэглэгээ ашиглан бичнэ үү."}
          </div>
          <div className="rounded-2xl border border-border/70 bg-background px-4 py-5 text-sm text-muted-foreground">
            Сурагчийн хариу бичих хэсэг
          </div>
          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Зөв хариу: {question.answerLatex.trim() || "Одоогоор оруулаагүй"}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewSection({
  emptyText,
  open,
  onOpenChange,
  questions,
  title,
}: {
  emptyText: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  questions: ExamQuestion[];
  title: string;
}) {
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

function EditorSection({
  emptyText,
  onAddOption,
  onChangeType,
  onOpenChange,
  onRemove,
  onUpdate,
  open,
  questions,
  title,
}: {
  emptyText: string;
  onAddOption: (questionId: string) => void;
  onChangeType: (questionId: string, type: QuestionType) => void;
  onOpenChange: (open: boolean) => void;
  onRemove: (questionId: string) => void;
  onUpdate: (
    questionId: string,
    updater: (question: ExamQuestion) => ExamQuestion,
  ) => void;
  open: boolean;
  questions: Array<{
    displayIndex: number;
    question: ExamQuestion;
  }>;
  title: string;
}) {
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
                  onChangeType={onChangeType}
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

export default function MathExam() {
  const [examTitle, setExamTitle] = useState("Жишиг шалгалт");
  const [questions, setQuestions] = useState<ExamQuestion[]>([
    createMcqQuestion({
      prompt: "y = x^2 функцийг аль график зөв дүрсэлж байна вэ?",
      correctOption: 1,
    }),
    createMathQuestion({
      prompt: "x-ийг ол: 2x + 5 = 19",
      answerLatex: "x=7",
    }),
  ]);
  const [previewSections, setPreviewSections] = useState({
    math: true,
    mcq: true,
  });
  const [editorSections, setEditorSections] = useState({
    math: true,
    mcq: true,
  });
  const [generatorSettings, setGeneratorSettings] = useState({
    difficulty: "medium" as DifficultyLevel,
    mathCount: 2,
    mcqCount: 4,
    totalPoints: 20,
    topics: "Квадрат функц, тэгшитгэл, илэрхийлэл хялбарчлах",
  });
  const [generatorError, setGeneratorError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const totalPoints = questions.reduce(
    (sum, question) => sum + question.points,
    0,
  );
  const mathCount = questions.filter(
    (question) => question.type === "math",
  ).length;
  const mcqCount = questions.length - mathCount;
  const mcqQuestions = questions.filter((question) => question.type === "mcq");
  const mathQuestions = questions.filter(
    (question) => question.type === "math",
  );
  const mcqEditorQuestions = questions
    .map((question, index) => ({
      displayIndex: index,
      question,
    }))
    .filter(({ question }) => question.type === "mcq");
  const mathEditorQuestions = questions
    .map((question, index) => ({
      displayIndex: index,
      question,
    }))
    .filter(({ question }) => question.type === "math");
  const requestedQuestionCount =
    generatorSettings.mcqCount + generatorSettings.mathCount;

  function updateQuestion(
    questionId: string,
    updater: (question: ExamQuestion) => ExamQuestion,
  ) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question) =>
        question.id === questionId ? updater(question) : question,
      ),
    );
  }

  function addQuestion(type: QuestionType) {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      createQuestion(type),
    ]);
  }

  function changeQuestionType(questionId: string, type: QuestionType) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question) => {
        if (question.id !== questionId || question.type === type) {
          return question;
        }

        const sharedFields = {
          id: question.id,
          points: question.points,
          prompt: question.prompt,
        };

        return type === "mcq"
          ? createMcqQuestion(sharedFields)
          : createMathQuestion(sharedFields);
      }),
    );
  }

  function removeQuestion(questionId: string) {
    setQuestions((currentQuestions) =>
      currentQuestions.filter((question) => question.id !== questionId),
    );
  }

  function addOption(questionId: string) {
    updateQuestion(questionId, (question) => {
      if (question.type !== "mcq") {
        return question;
      }

      const nextLabel = String.fromCharCode(65 + question.options.length);

      return {
        ...question,
        options: [...question.options, `Сонголт ${nextLabel}`],
      };
    });
  }

  async function handleGenerateExam() {
    setGeneratorError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/gemini-exam", {
        body: JSON.stringify(generatorSettings),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as
        | { error?: string; exam?: GeneratedExamPayload }
        | undefined;

      if (!response.ok || !payload?.exam) {
        throw new Error(payload?.error || "AI шалгалт үүсгэж чадсангүй.");
      }

      const nextQuestions = normalizeGeneratedQuestions(payload.exam, {
        mathCount: generatorSettings.mathCount,
        mcqCount: generatorSettings.mcqCount,
        totalPoints: generatorSettings.totalPoints,
      });

      setQuestions(nextQuestions);
      setExamTitle(payload.exam.title?.trim() || "AI үүсгэсэн жишиг шалгалт");
      setEditorSections({
        math: true,
        mcq: true,
      });
      setPreviewSections({
        math: true,
        mcq: true,
      });
      setIsGeneratorOpen(false);
    } catch (error) {
      setGeneratorError(
        error instanceof Error
          ? error.message
          : "AI шалгалт үүсгэхэд алдаа гарлаа.",
      );
      setIsGeneratorOpen(true);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.98))] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border border-border/70 bg-card/90 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Жишиг Шалгалт
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGeneratorOpen((current) => !current)}
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
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label htmlFor="exam-title">Шалгалтын нэр</Label>
                  <Input
                    id="exam-title"
                    value={examTitle}
                    onChange={(event) => setExamTitle(event.target.value)}
                    className="h-11 text-lg"
                    placeholder="Шалгалтын нэрээ оруулна уу"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addQuestion("mcq")}
                  >
                    <Plus />
                    Тест нэмэх
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addQuestion("math")}
                  >
                    <Plus />
                    Задгай даалгавар нэмэх
                  </Button>
                </div>
              </div>
              <Collapsible
                open={isGeneratorOpen}
                onOpenChange={setIsGeneratorOpen}
              >
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
                                Number.parseInt(
                                  event.target.value || "0",
                                  10,
                                ) || 0,
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
                                Number.parseInt(
                                  event.target.value || "0",
                                  10,
                                ) || 0,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="generator-total-points">
                          Нийт оноо
                        </Label>
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
                                Number.parseInt(
                                  event.target.value || "1",
                                  10,
                                ) || 1,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Түвшин</Label>
                        <div className="flex flex-wrap gap-2">
                          {(["easy", "medium", "advanced"] as const).map(
                            (level) => (
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
                            ),
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="generator-topics">
                          Заасан дэд сэдвүүд
                        </Label>
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
                      onClick={handleGenerateExam}
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
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <ExamStat label="Тестийн тоо" value={String(mcqCount)} />
              <ExamStat
                label="Сонгох / Бодлого"
                value={`${mcqCount} / ${mathCount}`}
              />
              <ExamStat label="Нийт оноо" value={String(totalPoints)} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <EditorSection
              title="Тест"
              questions={mcqEditorQuestions}
              open={editorSections.mcq}
              onOpenChange={(open) =>
                setEditorSections((current) => ({
                  ...current,
                  mcq: open,
                }))
              }
              onUpdate={updateQuestion}
              onRemove={removeQuestion}
              onAddOption={addOption}
              onChangeType={changeQuestionType}
              emptyText="Тест хэсэгт хараахан асуулт алга."
            />
            <EditorSection
              title="Задгай даалгавар"
              questions={mathEditorQuestions}
              open={editorSections.math}
              onOpenChange={(open) =>
                setEditorSections((current) => ({
                  ...current,
                  math: open,
                }))
              }
              onUpdate={updateQuestion}
              onRemove={removeQuestion}
              onAddOption={addOption}
              onChangeType={changeQuestionType}
              emptyText="Задгай даалгаврын хэсэгт хараахан асуулт алга."
            />
          </div>
        </div>

        {/* Student Preview */}

        <Card className="h-fit border border-border/70 bg-card/90 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] xl:sticky xl:top-8">
          <CardHeader className="gap-3">
            <div>
              <CardTitle className="text-xl">
                {examTitle.trim() || "Нэргүй шалгалт"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{questions.length} асуулт</span>
              <span>•</span>
              <span>{totalPoints} нийт оноо</span>
            </div>
            <Separator />
            <div className="space-y-4">
              <PreviewSection
                title="Тест"
                questions={mcqQuestions}
                open={previewSections.mcq}
                onOpenChange={(open) =>
                  setPreviewSections((current) => ({
                    ...current,
                    mcq: open,
                  }))
                }
                emptyText="Тест хэсэгт хараахан асуулт алга."
              />
              <PreviewSection
                title="Задгай даалгавар"
                questions={mathQuestions}
                open={previewSections.math}
                onOpenChange={(open) =>
                  setPreviewSections((current) => ({
                    ...current,
                    math: open,
                  }))
                }
                emptyText="Задгай даалгаврын хэсэгт хараахан асуулт алга."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
