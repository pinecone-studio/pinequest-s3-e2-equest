"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  FileUp,
  FileText,
  Filter,
  GripVertical,
  Keyboard,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MathAssistField } from "@/components/exam/math-exam-assist-field";
import MathPreviewText from "@/components/math-preview-text";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  GenerateQuestionAnswerDocument,
  GetNewMathExamDocument,
  ListNewMathExamsDocument,
  RegenerateQuestionAnswerDocument,
} from "@/gql/create-exam-documents";
import { Difficulty, QuestionFormat } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
  explanationClassName,
  sourceOptions,
  type MaterialSourceId,
} from "./material-builder-config";
import { normalizeBackendMathText } from "@/lib/normalize-math-text";
import {
  materialBuilderDemoQuestions,
  type MaterialBuilderDemoQuestion,
} from "./material-builder-demo-questions";

type Props = {
  generalInfo: {
    durationMinutes: string;
    examType: string;
    grade: string;
    subject: string;
  };
  selectedSharedMaterialId: string;
  onSelectMaterialId: (id: string) => void;
  source: MaterialSourceId;
  onSourceChange: (source: MaterialSourceId) => void;
  previewQuestions: PreviewQuestion[];
  onPreviewQuestionsChange: (questions: PreviewQuestion[]) => void;
  appendedContent?: ReactNode;
};

type WorkspaceSourceId = Exclude<MaterialSourceId, "textbook">;

export type PreviewQuestion = {
  id: string;
  index: number;
  question: string;
  questionType: "single-choice" | "written";
  answers: string[];
  correct: number;
  points: number;
  source: string;
  explanation?: string;
};

const initialPreviewQuestions: PreviewQuestion[] = [];
const mathAssistFieldClassName =
  "rounded-[20px]! border-[#dbe4f3]! bg-[#F1F4FA]! px-3! py-2.5! hover:border-[#c7d5ea]! focus-visible:border-[#b8c8e0]! focus-visible:ring-[#b8c8e0]/20";
const answerMathAssistFieldClassName = `${mathAssistFieldClassName} h-11! min-h-11! bg-white!`;
const mathAssistFieldContentClassName =
  "pl-3 font-sans text-[14px] leading-[1.6] font-normal tracking-normal text-slate-800 [&_.katex]:text-inherit";

function normalizeGeneratedExplanationText(value: string) {
  return normalizeBackendMathText(value)
    .replace(/\\\$/g, "$")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\([(){}[\]])/g, "$1")
    .replace(/\\times/g, " x ")
    .replace(/\\circ/g, "°")
    .replace(/\\cdot/g, " x ")
    .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\$/g, "")
    .replace(/\\/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const workspaceSourceOptions = sourceOptions.filter(
  (
    option,
  ): option is (typeof sourceOptions)[number] & { id: WorkspaceSourceId } =>
    option.id !== "textbook",
);

type SharedLibraryExamQuestion = {
  answerLatex?: string | null;
  correctOption?: number | null;
  id: string;
  options?: string[] | null;
  points?: number | null;
  prompt: string;
  responseGuide?: string | null;
  type: "Math" | "Mcq" | string;
};

type SharedLibraryExam = {
  createdAt?: string | null;
  examId: string;
  questions: SharedLibraryExamQuestion[];
  sessionMeta?: {
    durationMinutes?: number | null;
    examType?: string | null;
    grade?: number | null;
    subject?: string | null;
    teacherId?: string | null;
    variantCount?: number | null;
    withVariants?: boolean | null;
  } | null;
  title: string;
  totalPoints?: number | null;
  updatedAt?: string | null;
};

type SharedLibraryExamSummary = {
  durationMinutes?: number | null;
  examId: string;
  examType?: string | null;
  grade?: number | null;
  questionCount: number;
  subject?: string | null;
  teacherId?: string | null;
  title: string;
  updatedAt?: string | null;
  variantCount?: number | null;
  withVariants?: boolean | null;
};

function mapLibraryExamToPreviewQuestions(
  exam: SharedLibraryExam,
): PreviewQuestion[] {
  return exam.questions.map((question, index) => {
    const answers =
      question.type === "Math"
        ? [question.answerLatex?.trim() || ""]
        : (question.options ?? []).map((option) => String(option));

    return {
      id: `library-${exam.examId}-${question.id}-${index + 1}`,
      index: index + 1,
      question: question.prompt,
      questionType: question.type === "Math" ? "written" : "single-choice",
      answers,
      correct: question.correctOption ?? 0,
      points: question.points ?? 1,
      source: exam.title,
      explanation: question.responseGuide ?? undefined,
    } satisfies PreviewQuestion;
  });
}

function WorkspaceTabs({
  source,
  onSourceChange,
}: {
  source: MaterialSourceId;
  onSourceChange: (source: MaterialSourceId) => void;
}) {
  const activeSource = source === "textbook" ? "question-bank" : source;

  return (
    <div className="mx-auto max-w-[148px] space-y-1.5 rounded-[17px] border border-[#d9e2ed] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      {workspaceSourceOptions.map((option) => {
        const Icon = option.icon;
        const active = option.id === activeSource;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSourceChange(option.id)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[12.5px] font-medium transition-all",
              active
                ? "bg-[#0b5cab] text-white shadow-[0_10px_22px_rgba(11,92,171,0.2)]"
                : "bg-white text-slate-900 hover:bg-[#f8fbff]",
            )}
          >
            <Icon className="h-[15px] w-[15px] shrink-0" />
            <span className="whitespace-nowrap">
              {option.label === "Нэгдсэн сангаас ашиглах"
                ? "Сан"
                : option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilePanel() {
  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="rounded-[20px] p-4">
        <div className="relative rounded-[20px] border border-dashed border-[#cfd8e3] bg-transparent px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2f7] text-slate-600">
            <Upload className="h-4 w-4" />
          </div>
          <p className="mt-4 text-[16px] font-semibold text-slate-900">
            Файл чирж оруулах эсвэл сонгох
          </p>
          <p className="mt-2 text-[14px] text-slate-500">
            PDF, DOC, DOCX форматууд
          </p>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.82fr)_minmax(0,1fr)] gap-2">
          <button className="flex min-w-0 h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] border border-[#d9e3f0] bg-[#f4f7fb] px-2 text-[12px] font-medium leading-none text-slate-700 transition hover:bg-[#eef3f9] sm:text-[13px]">
            <BookOpen className="h-4 w-4 shrink-0 text-emerald-700" />
            Сурах бичиг
          </button>
          <button className="flex min-w-0 h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] border border-[#d9e3f0] bg-[#f4f7fb] px-2 text-[12px] font-medium leading-none text-slate-700 transition hover:bg-[#eef3f9] sm:text-[13px]">
            <FileText className="h-4 w-4 text-rose-500" />
            PDF
          </button>
          <button className="flex min-w-0 h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] border border-[#d9e3f0] bg-[#f4f7fb] px-2 text-[12px] font-medium leading-none text-slate-700 transition hover:bg-[#eef3f9] sm:text-[13px]">
            <FileText className="h-4 w-4 text-blue-500" />
            DOC/DOCX
          </button>
        </div>
      </div>
    </div>
  );
}

type QuestionBankPanelHandle = {
  fillAiDemo: () => void;
  fillDemo: () => void;
  reset: () => void;
};

const QuestionBankPanel = forwardRef<
  QuestionBankPanelHandle,
  {
    onAppendQuestion: (question: Omit<PreviewQuestion, "id" | "index">) => void;
    onQuestionAdded?: () => void;
  }
>(function QuestionBankPanel({ onAppendQuestion, onQuestionAdded }, ref) {
  const lastDemoIndexRef = useRef<number | null>(null);
  const [generateAnswer, { loading: generating }] = useMutation(
    GenerateQuestionAnswerDocument,
  );
  const [regenerateAnswer, { loading: regenerating }] = useMutation(
    RegenerateQuestionAnswerDocument,
  );
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(
    null,
  );
  const [questionText, setQuestionText] = useState("");
  const [showQuestionError, setShowQuestionError] = useState(false);
  const [showAnswerCountError, setShowAnswerCountError] = useState(false);
  const [showCorrectAnswerError, setShowCorrectAnswerError] = useState(false);
  const [generatedExplanation, setGeneratedExplanation] = useState("");
  const [scoreValue, setScoreValue] = useState("");
  const [questionTypeValue, setQuestionTypeValue] = useState("");
  const [difficultyValue, setDifficultyValue] = useState("");
  const isAiWorking = generating || regenerating;
  const isWrittenQuestion = questionTypeValue === "written";
  const minimumRequiredAnswers = questionTypeValue === "written" ? 1 : 2;
  const filledAnswersCount = answers.filter(
    (answer) => answer.trim().length > 0,
  ).length;
  const canAppendQuestion =
    questionText.trim().length > 0 &&
    filledAnswersCount >= minimumRequiredAnswers &&
    (isWrittenQuestion ||
      (selectedAnswerIndex !== null &&
        Boolean(answers[selectedAnswerIndex]?.trim())));

  function handleAddAnswer() {
    setAnswers((prev) => [...prev, ""]);
    setShowAnswerCountError(false);
  }

  function handleRemoveAnswer(index: number) {
    setAnswers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) return [""];
      return next;
    });
    setShowAnswerCountError(false);
    setSelectedAnswerIndex((prev) => {
      if (prev === null) return null;
      if (index === prev) return null;
      if (index < prev) return prev - 1;
      return prev;
    });
  }

  function handleAnswerChange(index: number, value: string) {
    setAnswers((prev) => prev.map((item, i) => (i === index ? value : item)));
    if (value.trim()) {
      setShowAnswerCountError(false);
    }
  }

  function applyGeneratedPayload(payload: {
    questionText: string;
    format: QuestionFormat;
    difficulty: Difficulty;
    points: number;
    options?: string[] | null;
    correctAnswer: string;
    explanation: string;
  }) {
    const nextAnswers =
      payload.format === QuestionFormat.Written
        ? [payload.correctAnswer]
        : (payload.options ?? []).filter(Boolean);
    const normalizedCorrectAnswer = payload.correctAnswer.trim();
    const matchedCorrectAnswerIndex = nextAnswers.findIndex(
      (option) => option.trim() === normalizedCorrectAnswer,
    );

    setQuestionText(payload.questionText);
    setAnswers(nextAnswers.length > 0 ? nextAnswers : [""]);
    setSelectedAnswerIndex(
      matchedCorrectAnswerIndex >= 0 ? matchedCorrectAnswerIndex : null,
    );
    setGeneratedExplanation(
      normalizeGeneratedExplanationText(payload.explanation),
    );
    setShowCorrectAnswerError(false);
    setShowAnswerCountError(false);
    setScoreValue(String(payload.points ?? 1));
    setQuestionTypeValue(
      payload.format === QuestionFormat.Written ? "written" : "single-choice",
    );
    setDifficultyValue(
      payload.difficulty === Difficulty.Easy
        ? "easy"
        : payload.difficulty === Difficulty.Hard
          ? "hard"
          : "medium",
    );
  }

  async function handleGenerateAnswer() {
    const trimmedPrompt = questionText.trim();
    if (!trimmedPrompt) {
      toast.error("Асуултаа эхлээд оруулна уу.");
      return;
    }

    try {
      const { data } = await generateAnswer({
        variables: {
          input: {
            prompt: trimmedPrompt,
            points: scoreValue ? Number(scoreValue) : undefined,
            difficulty:
              difficultyValue === "easy"
                ? Difficulty.Easy
                : difficultyValue === "hard"
                  ? Difficulty.Hard
                  : difficultyValue === "medium"
                    ? Difficulty.Medium
                    : undefined,
            format:
              questionTypeValue === "written"
                ? QuestionFormat.Written
                : questionTypeValue === "single-choice"
                  ? QuestionFormat.SingleChoice
                  : undefined,
          },
        },
      });

      const payload = (
        data as
          | {
              generateQuestionAnswer?: {
                questionText: string;
                format: QuestionFormat;
                difficulty: Difficulty;
                points: number;
                options?: string[] | null;
                correctAnswer: string;
                explanation: string;
              };
            }
          | null
          | undefined
      )?.generateQuestionAnswer;

      if (!payload) {
        toast.error("AI хариу үүсгэсэнгүй.");
        return;
      }

      applyGeneratedPayload(payload);
      toast.success("AI хариулт үүсгэлээ.");
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "AI хариулт үүсгэхэд алдаа гарлаа.";
      toast.error(message);
    }
  }

  async function handleRegenerateAnswer() {
    const trimmedPrompt = questionText.trim();
    if (!trimmedPrompt) {
      toast.error("Асуултаа эхлээд оруулна уу.");
      return;
    }

    try {
      const { data } = await regenerateAnswer({
        variables: {
          input: {
            prompt: trimmedPrompt,
            points: scoreValue ? Number(scoreValue) : undefined,
            difficulty:
              difficultyValue === "easy"
                ? Difficulty.Easy
                : difficultyValue === "hard"
                  ? Difficulty.Hard
                  : Difficulty.Medium,
            format:
              questionTypeValue === "written"
                ? QuestionFormat.Written
                : QuestionFormat.SingleChoice,
            previousOptions: answers
              .map((answer) => answer.trim())
              .filter(Boolean),
            previousCorrectAnswer:
              selectedAnswerIndex !== null
                ? answers[selectedAnswerIndex]
                : undefined,
            previousExplanation: generatedExplanation || undefined,
          },
        },
      });

      const payload = (
        data as
          | {
              regenerateQuestionAnswer?: {
                questionText: string;
                format: QuestionFormat;
                difficulty: Difficulty;
                points: number;
                options?: string[] | null;
                correctAnswer: string;
                explanation: string;
              };
            }
          | null
          | undefined
      )?.regenerateQuestionAnswer;

      if (!payload) {
        toast.error("AI шинэ хувилбар үүсгэсэнгүй.");
        return;
      }

      applyGeneratedPayload(payload);
      toast.success("AI хариултыг дахин үүсгэлээ.");
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "AI хариултыг дахин үүсгэхэд алдаа гарлаа.";
      toast.error(message);
    }
  }

  function handleAppendQuestion() {
    const trimmedQuestion = questionText.trim();
    const normalizedAnswers = answers
      .map((answer) => answer.trim())
      .filter(Boolean);
    if (!trimmedQuestion) {
      setShowQuestionError(true);
    } else {
      setShowQuestionError(false);
    }

    if (normalizedAnswers.length < minimumRequiredAnswers) {
      setShowAnswerCountError(true);
    } else {
      setShowAnswerCountError(false);
    }

    if (
      !isWrittenQuestion &&
      (selectedAnswerIndex === null || !answers[selectedAnswerIndex]?.trim())
    ) {
      setShowCorrectAnswerError(true);
    } else {
      setShowCorrectAnswerError(false);
    }

    if (
      !trimmedQuestion ||
      normalizedAnswers.length < minimumRequiredAnswers ||
      (!isWrittenQuestion &&
        (selectedAnswerIndex === null || !answers[selectedAnswerIndex]?.trim()))
    ) {
      return;
    }

    onAppendQuestion({
      question: trimmedQuestion,
      questionType: isWrittenQuestion ? "written" : "single-choice",
      answers: normalizedAnswers,
      correct: isWrittenQuestion
        ? 0
        : normalizedAnswers.indexOf(answers[selectedAnswerIndex!].trim()),
      points: scoreValue ? Number(scoreValue) : 1,
      source: "Гараар",
      explanation: isWrittenQuestion
        ? generatedExplanation.trim() || undefined
        : undefined,
    });

    setQuestionText("");
    setShowQuestionError(false);
    setShowAnswerCountError(false);
    setAnswers(["", "", "", ""]);
    setSelectedAnswerIndex(null);
    setShowCorrectAnswerError(false);
    setGeneratedExplanation("");
    setScoreValue("");
    setQuestionTypeValue("");
    setDifficultyValue("");
    onQuestionAdded?.();
  }

  function handleFillDemo() {
    const demoQuestions =
      materialBuilderDemoQuestions.length > 1 &&
      lastDemoIndexRef.current !== null
        ? materialBuilderDemoQuestions.filter(
            (_, index) => index !== lastDemoIndexRef.current,
          )
        : materialBuilderDemoQuestions;
    const randomPoolIndex = Math.floor(Math.random() * demoQuestions.length);
    const nextDemo = demoQuestions[randomPoolIndex];

    if (!nextDemo) {
      return;
    }

    const originalIndex = materialBuilderDemoQuestions.findIndex(
      (item) => item === nextDemo,
    );
    lastDemoIndexRef.current = originalIndex >= 0 ? originalIndex : null;
    applyDemoQuestion(nextDemo);
  }

  function handleFillAiDemo() {
    const demoQuestions =
      materialBuilderDemoQuestions.length > 1 &&
      lastDemoIndexRef.current !== null
        ? materialBuilderDemoQuestions.filter(
            (_, index) => index !== lastDemoIndexRef.current,
          )
        : materialBuilderDemoQuestions;
    const randomPoolIndex = Math.floor(Math.random() * demoQuestions.length);
    const nextDemo = demoQuestions[randomPoolIndex];

    if (!nextDemo) {
      return;
    }

    const originalIndex = materialBuilderDemoQuestions.findIndex(
      (item) => item === nextDemo,
    );
    lastDemoIndexRef.current = originalIndex >= 0 ? originalIndex : null;
    setQuestionText(nextDemo.questionText);
    setShowQuestionError(false);
  }

  function applyDemoQuestion(demo: MaterialBuilderDemoQuestion) {
    setScoreValue(demo.points);
    setQuestionTypeValue(demo.questionType);
    setDifficultyValue(demo.difficulty);
    setQuestionText(demo.questionText);
    setAnswers(demo.answers);
    setSelectedAnswerIndex(demo.correctIndex);
    setGeneratedExplanation("");
    setShowQuestionError(false);
    setShowAnswerCountError(false);
    setShowCorrectAnswerError(false);
  }

  function handleResetForm() {
    lastDemoIndexRef.current = null;
    setQuestionText("");
    setAnswers(["", "", "", ""]);
    setSelectedAnswerIndex(null);
    setGeneratedExplanation("");
    setScoreValue("");
    setQuestionTypeValue("");
    setDifficultyValue("");
    setShowQuestionError(false);
    setShowAnswerCountError(false);
    setShowCorrectAnswerError(false);
  }

  useImperativeHandle(ref, () => ({
    fillAiDemo: handleFillAiDemo,
    fillDemo: handleFillDemo,
    reset: handleResetForm,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-[16px] border border-[#dbe4f3] bg-[#f4f7fb] p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-[14px] font-semibold text-slate-800">
            Асуулт
          </label>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="w-full lg:w-[82px] lg:shrink-0">
            <Select value={scoreValue} onValueChange={setScoreValue}>
              <SelectTrigger
                title="Оноо"
                className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] [&>span]:truncate"
              >
                <SelectValue placeholder="Оноо" />
              </SelectTrigger>
              <SelectContent className="min-w-0 w-(--radix-select-trigger-width)">
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 flex-1 lg:min-w-[120px]">
            <Select
              value={questionTypeValue}
              onValueChange={setQuestionTypeValue}
            >
              <SelectTrigger
                title="Асуултын төрөл"
                className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] [&>span]:truncate"
              >
                <SelectValue placeholder="Төрөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
                <SelectItem value="written">Нээлттэй</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-[192px] lg:shrink-0">
            <Select value={difficultyValue} onValueChange={setDifficultyValue}>
              <SelectTrigger
                title="Асуултын хүндрэлийн түвшин"
                className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] [&>span]:truncate"
              >
                <SelectValue placeholder="Хүндрэлийн түвшин" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Энгийн</SelectItem>
                <SelectItem value="medium">Дунд</SelectItem>
                <SelectItem value="hard">Хүнд</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <MathAssistField
          className={mathAssistFieldClassName}
          contentClassName={mathAssistFieldContentClassName}
          value={questionText}
          multiline
          onChange={(nextValue) => {
            setQuestionText(nextValue);
            if (nextValue.trim()) {
              setShowQuestionError(false);
            }
          }}
          placeholder="Асуултаа энд бичнэ үү..."
        />
        {showQuestionError ? (
          <p className="text-[12px] text-red-500">Асуултаа оруулна уу</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => void handleGenerateAnswer()}
        disabled={isAiWorking || questionText.trim().length === 0}
        className="w-full cursor-pointer rounded-[12px] border-[#dce8fb] bg-[#f4f8ff] text-[#0b5cab]"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <WandSparkles className="h-4 w-4" />
        )}
        {generating ? "Үүсгэж байна..." : "Хариулт үүсгэх"}
      </Button>

      <div className="space-y-3 rounded-[16px] border border-[#dbe4f3] bg-[#f4f7fb] p-4">
        {isWrittenQuestion ? (
          <>
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-slate-900">
                Нээлттэй асуултын хариулт
              </p>
            </div>
            <div className="space-y-2">
              <Textarea
                value={answers[0] ?? ""}
                onChange={(event) => handleAnswerChange(0, event.target.value)}
                placeholder="Хариултыг энд бичнэ үү..."
                className="min-h-[20px] resize-y rounded-[16px] border-[#b8e5d7] bg-[#edf8f4] px-4 py-3 text-[14px] leading-6 text-slate-800 placeholder:text-slate-400 focus-visible:border-[#89cab8] focus-visible:ring-[#89cab8]/20"
              />
              {showAnswerCountError ? (
                <p className="text-[12px] text-red-500">Хариултаа оруулна уу</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-slate-900">
                Бодолт / Тайлбар
              </p>
              <Textarea
                value={generatedExplanation}
                onChange={(event) =>
                  setGeneratedExplanation(event.target.value)
                }
                placeholder="Бодолт, тайлбараа энд бичнэ үү..."
                className="min-h-[120px] resize-y rounded-[16px] border-[#b8e5d7] bg-[#edf8f4] px-4 py-3 text-[14px] leading-6 text-slate-800 placeholder:text-slate-400 focus-visible:border-[#89cab8] focus-visible:ring-[#89cab8]/20"
              />
            </div>
            <div className="flex items-center gap-2 rounded-[14px] border border-[#d8e7ff] bg-[#eef5ff] px-4 py-3 text-[14px] leading-6 text-[#365fc7]">
              <Lightbulb className="h-4 w-4 shrink-0 text-[#f2c94c]" />
              <p>Нээлттэй асуултыг гараар шалгах шаардлагатай.</p>
            </div>
            {generatedExplanation ? (
              <button
                type="button"
                onClick={() => void handleRegenerateAnswer()}
                disabled={isAiWorking}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-transparent px-3 py-2 text-[14px] font-medium text-slate-700 transition hover:border-[#dbe4f3] hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {regenerating ? "Дахин үүсгэж байна..." : "Дахин үүсгүүлэх"}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-slate-900">
                Хариултууд
              </p>
              <button
                type="button"
                onClick={handleAddAnswer}
                className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-[#0b5cab]"
              >
                <Plus className="h-4 w-4" />
                Хариулт нэмэх
              </button>
            </div>
            {answers.map((label, index) => (
              <div key={`answer-${index}`} className="space-y-2">
                <div className="grid grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-3">
                  <button
                    type="button"
                    role="button"
                    onClick={() => {
                      setSelectedAnswerIndex(index);
                      setShowCorrectAnswerError(false);
                    }}
                    className={cn(
                      "flex h-6 w-6 place-self-center cursor-pointer items-center justify-center rounded-full border transition",
                      index === selectedAnswerIndex
                        ? "border-[#0b5cab] bg-[#e8f1ff] shadow-[0_0_0_3px_rgba(11,92,171,0.08)]"
                        : "border-[#cbd9ee] bg-white hover:border-[#9fbae3]",
                    )}
                    aria-label={`Хариулт ${index + 1}-ийг зөв гэж сонгох`}
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full transition",
                        index === selectedAnswerIndex
                          ? "bg-[#0b5cab]"
                          : "bg-transparent",
                      )}
                    />
                  </button>
                  <div className="min-w-0">
                    <MathAssistField
                      className={answerMathAssistFieldClassName}
                      contentClassName={mathAssistFieldContentClassName}
                      value={label}
                      onChange={(nextValue) =>
                        handleAnswerChange(index, nextValue)
                      }
                      placeholder={`Хариулт ${index + 1}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAnswer(index)}
                    className="flex h-6 w-6 place-self-center cursor-pointer items-center justify-center text-slate-500 transition hover:text-slate-700"
                    aria-label="Хариулт устгах"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {showCorrectAnswerError ? (
              <p
                className={cn(
                  "text-[12px]",
                  showCorrectAnswerError ? "text-red-500" : "text-slate-500",
                )}
              >
                Зөв хариултыг сонгоно уу
              </p>
            ) : null}
          </>
        )}
        {!isWrittenQuestion && showAnswerCountError ? (
          <p className="text-[12px] text-red-500">
            {minimumRequiredAnswers >= 2
              ? "2-оос дээш хариулт оруулна уу"
              : "Хариултаа оруулна уу"}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={handleAppendQuestion}
          className={cn(
            "w-full cursor-pointer rounded-[12px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]",
            !canAppendQuestion && "opacity-55",
          )}
        >
          Асуулт нэмэх
        </Button>
      </div>
    </div>
  );
});

function TextbookPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-[#dbe4f3] bg-white p-4">
        <div className="relative">
          <Input
            placeholder="Ном хайх..."
            className="rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] pl-10"
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="mt-4 rounded-[14px] border border-[#0b5cab]/25">
          <div className="flex items-start justify-between gap-3 border-b border-[#e5edf8] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-[10px] bg-[#eef4ff] p-2 text-[#0b5cab]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-slate-900">
                  Математик 10-р анги
                </p>
                <p className="text-[13px] text-slate-500">БСШУС | 4 сэдэв</p>
              </div>
            </div>
            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
              156
            </Badge>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <p className="mb-3 text-[14px] font-medium text-slate-800">
                Дэд сэдвүүд сонгох
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Алгебр", "45", true],
                  ["Геометр", "38", false],
                  ["Тригонометр", "32", false],
                  ["Функц", "41", false],
                ].map(([label, count, active]) => (
                  <button
                    key={`${label}-${count}`}
                    className={cn(
                      "flex items-center justify-between rounded-[12px] border px-3 py-2 text-[13px]",
                      active
                        ? "border-[#bcd2f7] bg-[#eef4ff] text-[#0b5cab]"
                        : "border-[#e1e8f2] bg-white text-slate-700",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox checked={Boolean(active)} />
                      {label}
                    </span>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="mb-2 text-[13px] text-slate-600">Тестийн тоо</p>
                <Input
                  defaultValue="5"
                  className="rounded-[12px] border-[#dbe4f3] bg-[#f7faff]"
                />
              </div>
              <div>
                <p className="mb-2 text-[13px] text-slate-600">Олон сонголт</p>
                <Select defaultValue="no">
                  <SelectTrigger className="cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Үгүй</SelectItem>
                    <SelectItem value="yes">Тийм</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-2 text-[13px] text-slate-600">Хүндрэлийн</p>
                <Select defaultValue="medium">
                  <SelectTrigger className="cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Энгийн</SelectItem>
                    <SelectItem value="medium">Дунд</SelectItem>
                    <SelectItem value="hard">Хүнд</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full rounded-[12px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]">
              <Sparkles className="h-4 w-4" />
              AI Generate (5 тест)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedLibraryPanel({
  dialogOpen,
  generalInfo,
  hideLauncher = false,
  onDialogOpenChange,
  onAppendExamQuestions,
  selectedSharedMaterialId,
  onSelectMaterialId,
}: {
  dialogOpen: boolean;
  generalInfo: {
    durationMinutes: string;
    examType: string;
    grade: string;
    subject: string;
  };
  hideLauncher?: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onAppendExamQuestions: (questions: PreviewQuestion[]) => void;
  selectedSharedMaterialId: string;
  onSelectMaterialId: (id: string) => void;
}) {
  const client = useApolloClient();
  const listPageSize = 100;
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [durationFilter, setDurationFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [variantFilter, setVariantFilter] = useState("all");
  const [questionCountFilter, setQuestionCountFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOffset] = useState(0);
  const [libraryExamDetailLoading, setLibraryExamDetailLoading] =
    useState(false);
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [editingExamQuestionId, setEditingExamQuestionId] = useState<
    string | null
  >(null);
  const [editingExam, setEditingExam] = useState<SharedLibraryExam | null>(
    null,
  );
  const [examDetailCache, setExamDetailCache] = useState<
    Record<string, SharedLibraryExam>
  >({});
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const { data, loading } = useQuery(ListNewMathExamsDocument, {
    variables: {
      limit: listPageSize,
      offset: listOffset,
      filters: {
        durationMinutes:
          durationFilter !== "all" ? Number(durationFilter) : null,
        examType: generalInfo.examType || null,
        grade: generalInfo.grade ? Number(generalInfo.grade) : null,
        questionCount:
          questionCountFilter !== "all" ? Number(questionCountFilter) : null,
        search: debouncedSearchValue || null,
        subject: generalInfo.subject || null,
        teacherId: teacherFilter !== "all" ? teacherFilter : null,
        withVariants: variantFilter === "all" ? null : variantFilter === "with",
      },
    },
  });

  const libraryExamSummaries = useMemo(
    () =>
      (
        data as
          | { listNewMathExams?: SharedLibraryExamSummary[] | null }
          | undefined
      )?.listNewMathExams ?? [],
    [data],
  );

  useEffect(() => {
    if (!dialogOpen || libraryExamSummaries.length === 0) {
      return;
    }

    const examsToPrefetch = libraryExamSummaries
      .slice(0, 12)
      .filter((exam) => !examDetailCache[exam.examId]);

    if (examsToPrefetch.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      examsToPrefetch.map(async (exam) => {
        const result = await client.query({
          query: GetNewMathExamDocument,
          variables: { examId: exam.examId },
          fetchPolicy: "no-cache",
        });

        return (
          (
            result.data as
              | { getNewMathExam?: SharedLibraryExam | null }
              | undefined
          )?.getNewMathExam ?? null
        );
      }),
    ).then((fetchedExams) => {
      if (cancelled) return;
      const nextEntries = fetchedExams.filter(Boolean) as SharedLibraryExam[];
      if (nextEntries.length === 0) return;
      setExamDetailCache((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries.map((exam) => [exam.examId, exam])),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [client, dialogOpen, examDetailCache, libraryExamSummaries]);

  const teacherOptions = useMemo(() => {
    const values = Array.from(
      new Set(libraryExamSummaries.map((exam) => exam.teacherId ?? "unknown")),
    );
    return values.filter(Boolean);
  }, [libraryExamSummaries]);

  const durationOptions = useMemo(() => {
    const values: number[] = Array.from(
      new Set(
        libraryExamSummaries
          .map((exam) => exam.durationMinutes)
          .filter((value): value is number => typeof value === "number"),
      ),
    );
    return values.sort((a, b) => a - b);
  }, [libraryExamSummaries]);

  const questionCountOptions = useMemo(() => {
    const values: number[] = Array.from(
      new Set(libraryExamSummaries.map((exam) => exam.questionCount)),
    );
    return values.sort((a, b) => a - b);
  }, [libraryExamSummaries]);

  const activeFilterChips = useMemo(
    () =>
      [
        durationFilter !== "all"
          ? {
              key: "duration",
              label: `${durationFilter} мин`,
              onRemove: () => setDurationFilter("all"),
            }
          : null,
        teacherFilter !== "all"
          ? {
              key: "teacher",
              label:
                teacherFilter === "unknown"
                  ? "Тодорхойгүй багш"
                  : teacherFilter,
              onRemove: () => setTeacherFilter("all"),
            }
          : null,
        variantFilter !== "all"
          ? {
              key: "variant",
              label: variantFilter === "with" ? "Хувилбартай" : "Хувилбаргүй",
              onRemove: () => setVariantFilter("all"),
            }
          : null,
        questionCountFilter !== "all"
          ? {
              key: "count",
              label: `${questionCountFilter} асуулт`,
              onRemove: () => setQuestionCountFilter("all"),
            }
          : null,
      ].filter(Boolean) as Array<{
        key: string;
        label: string;
        onRemove: () => void;
      }>,
    [durationFilter, questionCountFilter, teacherFilter, variantFilter],
  );

  function resetAdvancedFilters() {
    setDurationFilter("all");
    setTeacherFilter("all");
    setVariantFilter("all");
    setQuestionCountFilter("all");
  }

  async function openExamPreview(exam: SharedLibraryExamSummary) {
    onSelectMaterialId(exam.examId);
    const cachedExam = examDetailCache[exam.examId];
    if (cachedExam) {
      setPreviewExamId(exam.examId);
      setEditingExamQuestionId(null);
      setEditingExam(structuredClone(cachedExam));
      setSelectedQuestionIds(
        cachedExam.questions.map((question) => question.id),
      );
      return;
    }
    setLibraryExamDetailLoading(true);
    try {
      const result = await client.query({
        query: GetNewMathExamDocument,
        variables: { examId: exam.examId },
        fetchPolicy: "no-cache",
      });
      const fullExam = (
        result.data as { getNewMathExam?: SharedLibraryExam | null } | undefined
      )?.getNewMathExam;
      if (!fullExam) {
        toast.error("Шалгалтын дэлгэрэнгүй мэдээлэл олдсонгүй.");
        return;
      }
      setExamDetailCache((prev) => ({ ...prev, [exam.examId]: fullExam }));
      setPreviewExamId(exam.examId);
      setEditingExamQuestionId(null);
      setEditingExam(structuredClone(fullExam));
      setSelectedQuestionIds(fullExam.questions.map((question) => question.id));
    } finally {
      setLibraryExamDetailLoading(false);
    }
  }

  function appendSelectedExam() {
    if (!editingExam) return;
    const selectedQuestions = editingExam.questions.filter((question) =>
      selectedQuestionIds.includes(question.id),
    );
    if (!selectedQuestions.length) {
      toast.error("Дор хаяж нэг асуулт сонгоно уу.");
      return;
    }
    onAppendExamQuestions(
      mapLibraryExamToPreviewQuestions({
        ...editingExam,
        questions: selectedQuestions,
      }),
    );
    setPreviewExamId(null);
    setEditingExamQuestionId(null);
    setEditingExam(null);
    setSelectedQuestionIds([]);
    onDialogOpenChange(false);
    toast.success(`${selectedQuestions.length} асуулт нэмэгдлээ.`);
  }

  function toggleQuestionSelection(questionId: string, checked: boolean) {
    setSelectedQuestionIds((current) =>
      checked
        ? current.includes(questionId)
          ? current
          : [...current, questionId]
        : current.filter((id) => id !== questionId),
    );
  }

  function updateEditingExamQuestion(
    questionId: string,
    updater: (question: SharedLibraryExamQuestion) => SharedLibraryExamQuestion,
  ) {
    setEditingExam((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((question) =>
              question.id === questionId ? updater(question) : question,
            ),
          }
        : prev,
    );
  }

  function deleteEditingExamQuestion(questionId: string) {
    setEditingExam((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.filter(
              (question) => question.id !== questionId,
            ),
          }
        : prev,
    );
    setSelectedQuestionIds((current) =>
      current.filter((id) => id !== questionId),
    );
    setEditingExamQuestionId((current) =>
      current === questionId ? null : current,
    );
  }

  return (
    <div className="space-y-4">
      {hideLauncher ? null : (
        <div className="rounded-[18px] border border-[#dbe4f3] bg-transparent p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">
                Сангаас шалгалт сонгох
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onDialogOpenChange(true)}
              className="cursor-pointer rounded-[12px] bg-[#0b5cab] px-4 text-white hover:bg-[#0a4f96]"
            >
              <Database className="h-4 w-4" />
              Сан нээх
            </Button>
          </div>
          <div className="mt-3 rounded-[14px] border border-dashed border-[#dbe4f3] bg-[#f8fbff] px-4 py-3 text-[13px] text-slate-500">
            {selectedSharedMaterialId
              ? "Сонгосон шалгалтын дэлгэрэнгүйг дахин харах эсвэл өөр шалгалт сонгож болно."
              : "Сонгосон анги, хичээл, шалгалтын төрөлд таарах сангийн материалууд dialog дотор харагдана."}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="flex h-[min(92vh,56rem)] w-[min(100vw-1.5rem,82rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0">
          <DialogHeader className="border-b border-[#e6edf7] px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-900">
              Сангийн шалгалтууд
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="relative">
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Шалгалтын материал хайх..."
                className="rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] pl-10"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] text-slate-400">
                  {activeFilterChips.length > 0
                    ? `${activeFilterChips.length} filter идэвхтэй`
                    : "Нэмэлт filter сонгоогүй байна"}
                </div>
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff] text-slate-700 hover:border-[#c9d9ef] hover:bg-[#f2f7ff]"
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                      {activeFilterChips.length > 0 ? (
                        <span className="ml-2 rounded-full bg-[#0b5cab] px-1.5 py-0.5 text-[11px] text-white">
                          {activeFilterChips.length}
                        </span>
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[min(92vw,28rem)] rounded-[18px] border border-[#dbe4f3] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-slate-900">
                          Нэмэлт шүүлт
                        </p>
                        <p className="text-[12px] text-slate-500">
                          Жагсаалтыг нарийвчлан шүүнэ
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetAdvancedFilters}
                        className="h-8 cursor-pointer px-2 text-[12px] text-slate-500 hover:bg-transparent hover:text-slate-800"
                      >
                        Цэвэрлэх
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[11px] font-medium text-slate-500">
                          Хугацаа
                        </p>
                        <Select
                          value={durationFilter}
                          onValueChange={setDurationFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Хугацаа" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүх хугацаа</SelectItem>
                            {durationOptions.map((value) => (
                              <SelectItem
                                key={`duration-${value}`}
                                value={String(value)}
                              >
                                {value} мин
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[11px] font-medium text-slate-500">
                          Хувилбар
                        </p>
                        <Select
                          value={variantFilter}
                          onValueChange={setVariantFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Хувилбар" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүгд</SelectItem>
                            <SelectItem value="with">Хувилбартай</SelectItem>
                            <SelectItem value="without">Хувилбаргүй</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[11px] font-medium text-slate-500">
                          Багш
                        </p>
                        <Select
                          value={teacherFilter}
                          onValueChange={setTeacherFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Багш" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүх багш</SelectItem>
                            {teacherOptions.map((value) => (
                              <SelectItem
                                key={`teacher-${value}`}
                                value={value}
                              >
                                {value === "unknown" ? "Тодорхойгүй" : value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[11px] font-medium text-slate-500">
                          Асуулт
                        </p>
                        <Select
                          value={questionCountFilter}
                          onValueChange={setQuestionCountFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Асуултын тоо" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүгд</SelectItem>
                            {questionCountOptions.map((value) => (
                              <SelectItem
                                key={`count-${value}`}
                                value={String(value)}
                              >
                                {value} асуулт
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {activeFilterChips.length > 0 ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#cfe0f6] bg-[#f5f9ff] px-3 py-1 text-[12px] font-medium text-[#3b5b86] transition hover:border-[#b9d0f0] hover:bg-[#edf5ff]"
                    >
                      {chip.label}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="rounded-[16px] border border-[#dbe4f3] bg-white p-6 text-center text-[14px] text-slate-500">
                  Материалуудыг ачаалж байна...
                </div>
              ) : libraryExamSummaries.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[#dbe4f3] bg-[#fcfdff] p-10 text-center text-[14px] text-slate-500">
                  Таарсан сангийн шалгалт олдсонгүй.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {libraryExamSummaries.map((exam) => (
                    <button
                      key={exam.examId}
                      type="button"
                      onClick={() => openExamPreview(exam)}
                      className="rounded-[16px] border border-[#dbe4f3] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b8ccef] hover:bg-[#fbfdff] hover:shadow-[0_10px_22px_rgba(148,163,184,0.14)]"
                    >
                      {(() => {
                        const cachedExam = examDetailCache[exam.examId];
                        const previewQuestions =
                          cachedExam?.questions.slice(0, 2) ?? [];

                        return (
                          <>
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[15px] font-semibold text-slate-900">
                                  {exam.title}
                                </p>
                                <p className="mt-1 text-[12px] text-slate-500">
                                  {exam.updatedAt?.slice(0, 10) ||
                                    "Огноо байхгүй"}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2 rounded-[12px] border border-[#e3e9f4] bg-[#f9fbff] p-3">
                              {previewQuestions.length > 0 ? (
                                previewQuestions.map((question, index) => (
                                  <div
                                    key={`${exam.examId}-snippet-${question.id}`}
                                    className="rounded-[10px] bg-white/70 px-3 py-2"
                                  >
                                    <p className="mb-1 text-[11px] font-medium text-slate-500">
                                      Асуулт {index + 1}
                                    </p>
                                    <MathPreviewText
                                      content={question.prompt}
                                      contentSource="backend"
                                      className="line-clamp-2 text-[13px] leading-relaxed text-slate-700"
                                    />
                                  </div>
                                ))
                              ) : (
                                <div className="text-[13px] text-slate-500">
                                  Асуултуудыг ачаалж байна...
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewExamId && editingExam)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewExamId(null);
            setEditingExamQuestionId(null);
            setEditingExam(null);
            setSelectedQuestionIds([]);
          }
        }}
      >
        <DialogContent className="flex h-[min(90vh,52rem)] w-[min(100vw-1.5rem,72rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0">
          <DialogHeader className="px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-900">
              {editingExam?.title ?? "Шалгалтын материал"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {libraryExamDetailLoading ? (
              <div className="py-10 text-center text-[14px] text-slate-500">
                Preview ачаалж байна...
              </div>
            ) : null}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#dbe4f3] bg-[#f8fbff] px-4 py-3">
              <p className="text-[13px] text-slate-600">
                Нэмэх асуултуудаа сонгоод дараа нь доорх товчоор оруулна.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setSelectedQuestionIds(
                      editingExam?.questions.map((question) => question.id) ??
                        [],
                    )
                  }
                  className="h-8 cursor-pointer px-2 text-[12px] text-slate-500 hover:bg-transparent hover:text-slate-800"
                >
                  Бүгдийг сонгох
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedQuestionIds([])}
                  className="h-8 cursor-pointer px-2 text-[12px] text-slate-500 hover:bg-transparent hover:text-slate-800"
                >
                  Цэвэрлэх
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              {editingExam?.questions.map((question, questionIndex) => {
                const isEditing = editingExamQuestionId === question.id;
                const isSelected = selectedQuestionIds.includes(question.id);
                return (
                  <div
                    key={question.id}
                    className={cn(
                      "rounded-[16px] border p-4",
                      isSelected
                        ? "border-[#b7d0f7] bg-[#fcfdff]"
                        : "border-[#e5ebf5] bg-[#f8fafc] opacity-80",
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleQuestionSelection(
                              question.id,
                              checked === true,
                            )
                          }
                        />
                        <p className="text-[14px] font-semibold text-slate-900">
                          Асуулт {questionIndex + 1}
                        </p>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingExamQuestionId((current) =>
                              current === question.id ? null : question.id,
                            )
                          }
                          className="cursor-pointer text-slate-400 transition hover:text-slate-700"
                          aria-label="Засах"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEditingExamQuestion(question.id)}
                          className="cursor-pointer text-rose-400 transition hover:text-rose-600"
                          aria-label="Устгах"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-3">
                        <MathAssistField
                          multiline
                          value={question.prompt}
                          onChange={(nextValue) =>
                            updateEditingExamQuestion(
                              question.id,
                              (current) => ({
                                ...current,
                                prompt: nextValue,
                              }),
                            )
                          }
                          className={`${mathAssistFieldClassName} min-h-[120px]!`}
                          contentClassName={mathAssistFieldContentClassName}
                        />
                        {(question.options ?? []).length > 0 ? (
                          <div className="grid gap-3">
                            {(question.options ?? []).map(
                              (option, optionIndex) => (
                                <div
                                  key={`${question.id}-edit-${optionIndex}`}
                                  className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3"
                                >
                                  <div
                                    className={cn(
                                      "flex h-6 w-6 items-center justify-center rounded-full border",
                                      optionIndex ===
                                        (question.correctOption ?? 0)
                                        ? "border-[#0b5cab] bg-[#e8f1ff]"
                                        : "border-[#cbd9ee] bg-white",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-2.5 w-2.5 rounded-full",
                                        optionIndex ===
                                          (question.correctOption ?? 0)
                                          ? "bg-[#0b5cab]"
                                          : "bg-transparent",
                                      )}
                                    />
                                  </div>
                                  <MathAssistField
                                    value={option}
                                    onChange={(nextValue) =>
                                      updateEditingExamQuestion(
                                        question.id,
                                        (current) => {
                                          const nextOptions = [
                                            ...(current.options ?? []),
                                          ];
                                          nextOptions[optionIndex] = nextValue;
                                          return {
                                            ...current,
                                            options: nextOptions,
                                          };
                                        },
                                      )
                                    }
                                    className={answerMathAssistFieldClassName}
                                    contentClassName={
                                      mathAssistFieldContentClassName
                                    }
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <MathAssistField
                            multiline
                            value={question.answerLatex ?? ""}
                            onChange={(nextValue) =>
                              updateEditingExamQuestion(
                                question.id,
                                (current) => ({
                                  ...current,
                                  answerLatex: nextValue,
                                }),
                              )
                            }
                            className={`${mathAssistFieldClassName} min-h-[88px]!`}
                            contentClassName={mathAssistFieldContentClassName}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-[14px] bg-[#f5f8fc] p-3">
                          <MathPreviewText
                            content={question.prompt}
                            contentSource="backend"
                            className="text-[14px] leading-relaxed text-slate-700"
                          />
                        </div>
                        {(question.options ?? []).length > 0 ? (
                          <div className="grid gap-3">
                            {(question.options ?? []).map(
                              (option, optionIndex) => (
                                <div
                                  key={`${question.id}-preview-${optionIndex}`}
                                  className={cn(
                                    "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-[12px] border px-3 py-2",
                                    optionIndex ===
                                      (question.correctOption ?? 0)
                                      ? "border-[#9cd9c0] bg-[#eefaf4]"
                                      : "border-[#d7e3f5] bg-white",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "flex h-6 w-6 items-center justify-center rounded-full border",
                                      optionIndex ===
                                        (question.correctOption ?? 0)
                                        ? "border-[#0b5cab] bg-[#e8f1ff]"
                                        : "border-[#cbd9ee] bg-white",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-2.5 w-2.5 rounded-full",
                                        optionIndex ===
                                          (question.correctOption ?? 0)
                                          ? "bg-[#0b5cab]"
                                          : "bg-transparent",
                                      )}
                                    />
                                  </div>
                                  <MathPreviewText
                                    content={option}
                                    contentSource="backend"
                                    className="text-[14px] leading-relaxed text-slate-700"
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        ) : (
                          <div className="rounded-[14px] border border-[#a8ddd0] bg-[#d8f2ea] px-4 py-3 text-[14px] text-[#167e61]">
                            <MathPreviewText
                              content={question.answerLatex ?? ""}
                              contentSource="backend"
                              className="text-[14px] leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-[24px] border-t-0 bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPreviewExamId(null);
                setEditingExamQuestionId(null);
                setEditingExam(null);
                setSelectedQuestionIds([]);
              }}
              className="rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
            >
              Хаах
            </Button>
            <Button
              type="button"
              onClick={appendSelectedExam}
              disabled={
                !editingExam?.questions.length ||
                selectedQuestionIds.length === 0
              }
              className="rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96]"
            >
              {selectedQuestionIds.length > 0
                ? `${selectedQuestionIds.length} асуулт нэмэх`
                : "Шалгалтын асуултууд руу нэмэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getQuestionSourceBadge(source: string) {
  if (source === "Гараар") {
    return {
      icon: Keyboard,
      label: "Гараар оруулсан",
      className:
        "rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
    };
  }

  if (!/\.(pdf|doc|docx|xls|xlsx)$/i.test(source)) {
    return {
      icon: Database,
      label: source,
      className:
        "rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
    };
  }

  return {
    icon: FileText,
    label: source,
    className:
      "rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
  };
}

function PreviewQuestionCard({
  question,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isDragging,
  isDragTarget,
  onDragHandleStart,
  onDragHandleEnd,
  onDragTargetEnter,
  onDragTargetOver,
  onDropOnTarget,
}: {
  question: PreviewQuestion;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDragging: boolean;
  isDragTarget: boolean;
  onDragHandleStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragHandleEnd: () => void;
  onDragTargetEnter: () => void;
  onDragTargetOver: (event: DragEvent<HTMLDivElement>) => void;
  onDropOnTarget: () => void;
}) {
  const sourceBadge = getQuestionSourceBadge(question.source);
  const isWrittenQuestion = question.questionType === "written";
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);

  return (
    <div
      className={cn(
        "group rounded-[20px] border bg-white p-5 transition-all duration-200",
        isDragging &&
          "scale-[1.015] -rotate-1 border-sky-300 bg-sky-50/60 shadow-[0_24px_50px_-20px_rgba(14,116,144,0.35)] opacity-70",
        isDragTarget
          ? "border-[#0f74e7] ring-2 ring-[#0f74e7]/20 shadow-[0_0_0_1px_rgba(15,116,231,0.08)]"
          : "border-[#D5D7DB] shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-[#b8ccef] hover:bg-[#fbfdff] hover:shadow-[0_10px_22px_rgba(148,163,184,0.14)]",
      )}
      onDragEnter={onDragTargetEnter}
      onDragOver={onDragTargetOver}
      onDrop={onDropOnTarget}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-[14px] font-semibold text-slate-900">
            <div className="inline-flex flex-wrap items-baseline gap-x-1">
              <span>{`Асуулт ${question.index} - `}</span>
              <MathPreviewText
                content={question.question}
                contentSource="preview"
                className="inline text-[14px] leading-relaxed text-slate-900"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Устгах"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">
          {isWrittenQuestion ? (
            <div className="space-y-3">
              {(question.answers[0] ?? "").trim() ? (
                <div className="rounded-[14px] border border-[#a8ddd0] bg-[#d8f2ea] px-4 py-3 text-[14px] text-[#167e61]">
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#167e61]/80">
                    Жишиг хариулт
                  </p>
                  <MathPreviewText
                    content={question.answers[0] ?? ""}
                    contentSource="preview"
                    className="text-[14px] leading-relaxed"
                  />
                </div>
              ) : null}
              {question.explanation?.trim() ? (
                <div className="rounded-[14px] border border-[#a8ddd0] bg-[#e7faf2] px-4 py-3 text-[14px] text-[#167e61]">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#167e61]/80">
                        Бодолт / Тайлбар
                      </p>
                      {isExplanationExpanded ? (
                        <MathPreviewText
                          content={question.explanation}
                          contentSource="preview"
                          className="text-[14px] leading-relaxed"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsExplanationExpanded(true)}
                          className="cursor-pointer text-left text-[13px] leading-relaxed text-[#167e61] hover:opacity-80"
                        >
                          {question.explanation}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {question.answers.map((answer, index) => (
                <div
                  key={`${answer}-${index}`}
                  className={cn(
                    "rounded-[14px] px-4 py-3 text-[14px] text-slate-700",
                    index === question.correct
                      ? "border border-[#a8ddd0] bg-[#d8f2ea] text-[#15803D]"
                      : "bg-[#F1F4FA]",
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <span>{String.fromCharCode(65 + index)}.</span>
                    <MathPreviewText
                      content={answer}
                      contentSource="preview"
                      className="min-w-0 text-[14px] leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              "inline-flex items-center gap-1.5",
              sourceBadge.className,
            )}
          >
            <sourceBadge.icon className="h-3.5 w-3.5" />
            {sourceBadge.label}
          </Badge>
          <Badge className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
            {question.points} оноо
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function MaterialBuilderWorkspaceSection({
  generalInfo,
  selectedSharedMaterialId,
  onSelectMaterialId,
  source,
  onSourceChange,
  previewQuestions,
  onPreviewQuestionsChange,
  appendedContent,
}: Props) {
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(
    null,
  );
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [sharedLibraryDialogOpen, setSharedLibraryDialogOpen] = useState(false);
  const manualQuestionPanelRef = useRef<QuestionBankPanelHandle | null>(null);
  const [dragTargetQuestionId, setDragTargetQuestionId] = useState<
    string | null
  >(null);
  const activeSource = source === "textbook" ? "question-bank" : source;
  const sourceCounts = useMemo(
    () => ({
      "question-bank": previewQuestions.filter(
        (question) => question.source === "Гараар",
      ).length,
      import: previewQuestions.filter((question) =>
        /\.(pdf|doc|docx|xls|xlsx)$/i.test(question.source),
      ).length,
      "shared-library": previewQuestions.filter(
        (question) =>
          question.source !== "Гараар" &&
          !/\.(pdf|doc|docx|xls|xlsx)$/i.test(question.source),
      ).length,
    }),
    [previewQuestions],
  );

  function handleSourceSelect(nextSource: MaterialSourceId) {
    onSourceChange(nextSource);

    if (nextSource === "question-bank") {
      setManualDialogOpen(true);
      return;
    }

    if (nextSource === "import") {
      setFileDialogOpen(true);
      return;
    }

    if (nextSource === "shared-library") {
      setSharedLibraryDialogOpen(true);
    }
  }

  function handleAppendQuestion(
    question: Omit<PreviewQuestion, "id" | "index">,
  ) {
    onPreviewQuestionsChange(
      ((prev: PreviewQuestion[]) => {
        const next = [
          {
            ...question,
            id: `manual-${Date.now()}-${prev.length + 1}`,
            index: 1,
          },
          ...prev,
        ];

        return next.map((item, index) => ({
          ...item,
          index: index + 1,
        }));
      })(previewQuestions),
    );
  }

  function handleDeleteQuestion(questionId: string) {
    onPreviewQuestionsChange(
      previewQuestions
        .filter((question) => question.id !== questionId)
        .map((question, index) => ({
          ...question,
          index: index + 1,
        })),
    );
  }

  function handleMoveQuestion(questionId: string, direction: "up" | "down") {
    onPreviewQuestionsChange(
      ((prev: PreviewQuestion[]) => {
        const currentIndex = prev.findIndex(
          (question) => question.id === questionId,
        );
        if (currentIndex === -1) return prev;

        const targetIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;

        const next = [...prev];
        [next[currentIndex], next[targetIndex]] = [
          next[targetIndex],
          next[currentIndex],
        ];

        return next.map((question, index) => ({
          ...question,
          index: index + 1,
        }));
      })(previewQuestions),
    );
  }

  function reindexQuestions(questions: PreviewQuestion[]) {
    return questions.map((question, index) => ({
      ...question,
      index: index + 1,
    }));
  }

  function handleDropQuestion(targetQuestionId: string) {
    if (!draggedQuestionId || draggedQuestionId === targetQuestionId) {
      setDraggedQuestionId(null);
      setDragTargetQuestionId(null);
      return;
    }

    const draggedIndex = previewQuestions.findIndex(
      (question) => question.id === draggedQuestionId,
    );
    const targetIndex = previewQuestions.findIndex(
      (question) => question.id === targetQuestionId,
    );

    if (
      draggedIndex === -1 ||
      targetIndex === -1 ||
      draggedIndex === targetIndex
    ) {
      setDraggedQuestionId(null);
      setDragTargetQuestionId(null);
      return;
    }

    const next = [...previewQuestions];
    const [draggedQuestion] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, draggedQuestion);
    onPreviewQuestionsChange(reindexQuestions(next));

    setDraggedQuestionId(null);
    setDragTargetQuestionId(null);
  }

  function handleAppendSharedLibraryQuestions(questions: PreviewQuestion[]) {
    onPreviewQuestionsChange(
      reindexQuestions([
        ...questions.map((question, index) => ({
          ...question,
          id: `shared-${Date.now()}-${index + 1}`,
        })),
        ...previewQuestions,
      ]),
    );
  }

  return (
    <section className="mt-5 rounded-[22px] border border-[#D5D7DB] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[206px_minmax(0,1fr)]">
        <div className="w-full rounded-[20px] bg-[#f4f7fb] p-3 xl:max-w-[196px]">
          <div className="mb-3.5">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">
              Асуулт нэмэх
            </h2>
          </div>

          <WorkspaceTabs
            source={activeSource}
            onSourceChange={handleSourceSelect}
          />
        </div>

        <div
          className={cn(
            "rounded-[20px] bg-[#F4F7FA] p-4 sm:p-5",
            previewQuestions.length > 5 &&
              "flex max-h-[calc(100vh-10rem)] flex-col",
          )}
        >
          <div className="flex items-start justify-between gap-4 pb-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
                Шалгалтын асуултууд
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[14px] font-semibold text-blue-700">
                <Keyboard className="h-4 w-4" />
                {sourceCounts["question-bank"]}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[14px] font-semibold text-amber-700">
                <FileUp className="h-4 w-4" />
                {sourceCounts.import}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[14px] font-semibold text-slate-600">
                <Database className="h-4 w-4" />
                {sourceCounts["shared-library"]}
              </div>
            </div>
          </div>

          <div
            className={cn(
              previewQuestions.length > 5 &&
                "min-h-0 flex-1 overflow-y-auto pr-2",
            )}
          >
            {previewQuestions.length === 0 ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#dbe4f3] bg-[#fcfdff] px-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef3f9] text-slate-500">
                  <FileText className="h-9 w-9" />
                </div>
                <p className="mt-6 text-[18px] font-semibold text-slate-900">
                  Асуулт байхгүй байна
                </p>
                <div className="mt-3 space-y-0 text-[14px] leading-6 text-slate-500">
                  <p>Зүүн талын 3 аргын аль нэгийг ашиглан асуулт нэмнэ үү.</p>
                  <p>Олон арга хольж ашиглаж болно.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {previewQuestions.map((question) => (
                  <PreviewQuestionCard
                    key={question.id}
                    question={question}
                    onDelete={() => handleDeleteQuestion(question.id)}
                    onMoveUp={() => handleMoveQuestion(question.id, "up")}
                    onMoveDown={() => handleMoveQuestion(question.id, "down")}
                    canMoveUp={question.index > 1}
                    canMoveDown={question.index < previewQuestions.length}
                    isDragging={draggedQuestionId === question.id}
                    isDragTarget={
                      dragTargetQuestionId === question.id &&
                      draggedQuestionId !== question.id
                    }
                    onDragHandleStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedQuestionId(question.id);
                      setDragTargetQuestionId(question.id);
                    }}
                    onDragHandleEnd={() => {
                      setDraggedQuestionId(null);
                      setDragTargetQuestionId(null);
                    }}
                    onDragTargetEnter={() => {
                      if (!draggedQuestionId) return;
                      setDragTargetQuestionId(question.id);
                    }}
                    onDragTargetOver={(event) => {
                      event.preventDefault();
                      if (!draggedQuestionId) return;
                      event.dataTransfer.dropEffect = "move";
                      setDragTargetQuestionId(question.id);
                    }}
                    onDropOnTarget={() => handleDropQuestion(question.id)}
                  />
                ))}
              </div>
            )}

            {appendedContent ? (
              <div className="mt-6 border-t border-[#e6edf7] pt-5">
                {appendedContent}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="flex h-[min(92vh,54rem)] w-[min(100vw-1.5rem,64rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[28px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
          <DialogHeader className="border-b border-[#e6edf7] px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="text-[20px] font-semibold text-slate-900">
                Гараар асуулт үүсгэх
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manualQuestionPanelRef.current?.fillDemo()}
                  className="h-8 cursor-pointer rounded-[10px] border-[#dbe4f3] bg-white px-2.5 text-[11px] font-medium text-slate-500 shadow-none hover:bg-slate-50 hover:text-slate-700"
                >
                  Demo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manualQuestionPanelRef.current?.fillAiDemo()}
                  className="h-8 cursor-pointer rounded-[10px] border-[#dbe4f3] bg-white px-2.5 text-[11px] font-medium text-slate-500 shadow-none hover:bg-slate-50 hover:text-slate-700"
                >
                  Demo-AI
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manualQuestionPanelRef.current?.reset()}
                  className="h-8 cursor-pointer rounded-[10px] border-[#dbe4f3] bg-white px-2.5 text-[11px] font-medium text-slate-500 shadow-none hover:bg-slate-50 hover:text-slate-700"
                >
                  Reset
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-6">
            <QuestionBankPanel
              ref={manualQuestionPanelRef}
              onAppendQuestion={handleAppendQuestion}
              onQuestionAdded={() => setManualDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="flex h-[min(92vh,42rem)] w-[min(100vw-1.5rem,56rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[28px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
          <DialogHeader className="border-b border-[#e6edf7] px-6 py-5">
            <DialogTitle className="text-[20px] font-semibold text-slate-900">
              Файлаас асуулт оруулах
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-6">
            <FilePanel />
          </div>
        </DialogContent>
      </Dialog>

      <SharedLibraryPanel
        dialogOpen={sharedLibraryDialogOpen}
        generalInfo={generalInfo}
        hideLauncher
        onDialogOpenChange={setSharedLibraryDialogOpen}
        onAppendExamQuestions={handleAppendSharedLibraryQuestions}
        selectedSharedMaterialId={selectedSharedMaterialId}
        onSelectMaterialId={onSelectMaterialId}
      />
    </section>
  );
}
