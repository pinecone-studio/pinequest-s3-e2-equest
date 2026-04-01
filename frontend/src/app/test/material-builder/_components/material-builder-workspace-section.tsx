"use client";

import { useMutation } from "@apollo/client/react";
import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
  FileUp,
  FileText,
  GripVertical,
  Loader2,
  PenSquare,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  RegenerateQuestionAnswerDocument,
} from "@/gql/create-exam-documents";
import { Difficulty, QuestionFormat } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
  explanationClassName,
  sharedLibraryMaterials,
  sourceOptions,
  type MaterialSourceId,
} from "./material-builder-config";

type Props = {
  selectedSharedMaterialId: string;
  onSelectMaterialId: (id: string) => void;
  source: MaterialSourceId;
  onSourceChange: (source: MaterialSourceId) => void;
};

type WorkspaceSourceId = Exclude<MaterialSourceId, "textbook">;

type PreviewQuestion = {
  id: string;
  index: number;
  question: string;
  answers: string[];
  correct: number;
  source: string;
};

const initialPreviewQuestions: PreviewQuestion[] = [
  {
    id: "q1",
    index: 1,
    question: "Монгол улсын нийслэл хот юу вэ?",
    answers: ["Дархан", "Эрдэнэт", "Улаанбаатар", "Дорнод"],
    correct: 2,
    source: "БШ_MAT_VIII.docx",
  },
  {
    id: "q2",
    index: 2,
    question: "2 + 2 = ?",
    answers: ["3", "4", "5", "6"],
    correct: 1,
    source: "БШ_MAT_VIII.docx",
  },
  {
    id: "q3",
    index: 3,
    question: "H2O гэж юу вэ?",
    answers: ["Ус", "Хүчил", "Давс", "Агаар"],
    correct: 0,
    source: "БШ_MAT_VIII.docx",
  },
  {
    id: "q4",
    index: 4,
    question: "Дэлхийн хамгийн том далай юу вэ?",
    answers: [
      "Атлантын далай",
      "Энэтхэгийн далай",
      "Номхон далай",
      "Хойд мөсөн далай",
    ],
    correct: 2,
    source: "БШ_MAT_VIII.docx",
  },
];

const workspaceSourceOptions = sourceOptions.filter(
  (option): option is (typeof sourceOptions)[number] & { id: WorkspaceSourceId } =>
    option.id !== "textbook",
);

function WorkspaceTabs({
  source,
  onSourceChange,
  counts,
}: {
  source: MaterialSourceId;
  onSourceChange: (source: MaterialSourceId) => void;
  counts: Record<WorkspaceSourceId, number>;
}) {
  const activeSource = source === "textbook" ? "question-bank" : source;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-[16px] bg-[#eef3f9] p-2">
      {workspaceSourceOptions.map((option) => {
        const Icon = option.icon;
        const active = option.id === activeSource;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSourceChange(option.id)}
            className={cn(
              "relative flex h-[72px] flex-col items-center justify-center gap-2 rounded-[12px] border text-[13px] font-medium transition-all",
              active
                ? "border-[#0b5cab] bg-[#0b5cab] text-white shadow-[0_10px_24px_rgba(11,92,171,0.22)]"
                : "border-transparent bg-transparent text-slate-700 hover:bg-white hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>
              {option.label === "Нэгдсэн сангаас ашиглах"
                ? "Сан"
                : option.label}
            </span>
            {counts[option.id] > 0 ? (
              <span className="absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[11px] font-semibold text-white">
                {counts[option.id]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FilePanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-dashed border-[#d8e2ef] bg-white p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3ff] text-[#0b5cab]">
          <Upload className="h-6 w-6" />
        </div>
        <p className="mt-4 text-[18px] font-semibold text-slate-900">
          Файл чирж оруулах эсвэл сонгох
        </p>
        <p className="mt-2 text-[14px] text-slate-500">
          PDF, DOC, DOCX форматууд
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] border border-[#e0e7f1] bg-white text-[14px] font-medium text-slate-700">
          <FileText className="h-4 w-4 text-rose-500" />
          PDF
        </button>
        <button className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] border border-[#e0e7f1] bg-white text-[14px] font-medium text-slate-700">
          <FileText className="h-4 w-4 text-blue-500" />
          DOC/DOCX
        </button>
      </div>

      <div className="rounded-[16px] border border-[#d7e7de] bg-[#effaf4] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">
              БШ_MAT_VIII.docx
            </p>
            <p className="text-[13px] text-slate-500">4 асуулт олдлоо</p>
          </div>
          <Button
            size="sm"
            className="rounded-[10px] bg-[#0b5cab] px-3 text-white"
          >
            Бүгдийг оруулах
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionBankPanel({
  onAppendQuestion,
}: {
  onAppendQuestion: (question: Omit<PreviewQuestion, "id" | "index">) => void;
}) {
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
  const [showCorrectAnswerError, setShowCorrectAnswerError] = useState(false);
  const [generatedExplanation, setGeneratedExplanation] = useState("");
  const [scoreValue, setScoreValue] = useState("1");
  const [questionTypeValue, setQuestionTypeValue] = useState("single-choice");
  const [difficultyValue, setDifficultyValue] = useState("medium");
  const isAiWorking = generating || regenerating;
  const minimumRequiredAnswers = questionTypeValue === "written" ? 1 : 2;
  const filledAnswersCount = answers.filter(
    (answer) => answer.trim().length > 0,
  ).length;
  const canAppendQuestion =
    questionText.trim().length > 0 &&
    filledAnswersCount >= minimumRequiredAnswers;

  function handleAddAnswer() {
    setAnswers((prev) => [...prev, ""]);
  }

  function handleRemoveAnswer(index: number) {
    setAnswers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) return [""];
      return next;
    });
    setSelectedAnswerIndex((prev) => {
      if (prev === null) return null;
      if (index === prev) return null;
      if (index < prev) return prev - 1;
      return prev;
    });
  }

  function handleAnswerChange(index: number, value: string) {
    setAnswers((prev) => prev.map((item, i) => (i === index ? value : item)));
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
    setGeneratedExplanation(payload.explanation);
    setShowCorrectAnswerError(false);
    setScoreValue(String(payload.points ?? 1));
    setQuestionTypeValue(
      payload.format === QuestionFormat.Written
        ? "written"
        : payload.format === QuestionFormat.MultipleChoice
          ? "multiple-choice"
          : "single-choice",
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
                : questionTypeValue === "multiple-choice"
                  ? QuestionFormat.MultipleChoice
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
                : questionTypeValue === "multiple-choice"
                  ? QuestionFormat.MultipleChoice
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
    if (!trimmedQuestion || normalizedAnswers.length === 0) return;
    if (selectedAnswerIndex === null || !answers[selectedAnswerIndex]?.trim()) {
      setShowCorrectAnswerError(true);
      return;
    }

    onAppendQuestion({
      question: trimmedQuestion,
      answers: normalizedAnswers,
      correct: normalizedAnswers.indexOf(answers[selectedAnswerIndex].trim()),
      source: "Гараар",
    });

    setQuestionText("");
    setAnswers(["", "", "", ""]);
    setSelectedAnswerIndex(null);
    setShowCorrectAnswerError(false);
    setGeneratedExplanation("");
    setScoreValue("1");
    setQuestionTypeValue("single-choice");
    setDifficultyValue("medium");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-[14px] font-medium text-slate-800">
          Асуулт
        </label>
        <div className="flex flex-col gap-1 lg:flex-row lg:items-center">
          <div className="w-full lg:w-[50px] lg:shrink-0">
            <Select value={scoreValue} onValueChange={setScoreValue}>
              <SelectTrigger
                title="Оноо"
                className="w-full rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] [&>span]:truncate"
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

          <div className="min-w-0 flex-1 lg:min-w-[157px]">
            <Select
              value={questionTypeValue}
              onValueChange={setQuestionTypeValue}
            >
              <SelectTrigger
                title="Асуултын төрөл"
                className="w-full rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] [&>span]:truncate"
              >
                <SelectValue placeholder="Асуултын төрөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
                <SelectItem value="multiple-choice">Олон сонголттой</SelectItem>
                <SelectItem value="written">Задгай</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-[90px] lg:shrink-0">
            <Select value={difficultyValue} onValueChange={setDifficultyValue}>
              <SelectTrigger
                title="Асуултын хүндрэлийн түвшин"
                className="w-full rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] [&>span]:truncate"
              >
                <SelectValue placeholder="Асуултын хүндрэлийн түвшин" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Энгийн</SelectItem>
                <SelectItem value="medium">Дунд</SelectItem>
                <SelectItem value="hard">Хүнд</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <Textarea
          value={questionText}
          onChange={(event) => setQuestionText(event.target.value)}
          placeholder="Асуултаа энд бичнэ үү..."
          className="min-h-[110px] rounded-[12px] border-[#e2e8f0] bg-[#f3f6fb]"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleGenerateAnswer()}
        disabled={isAiWorking}
        className="w-full rounded-[12px] border-[#dce8fb] bg-[#f4f8ff] text-[#0b5cab]"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <WandSparkles className="h-4 w-4" />
        )}
        {generating ? "Үүсгэж байна..." : "Хариулт үүсгэх"}
      </Button>

      <div className="space-y-3 rounded-[16px] border border-[#e2e8f0] bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-slate-900">Хариултууд</p>
          <button
            type="button"
            onClick={handleAddAnswer}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0b5cab]"
          >
            <Plus className="h-4 w-4" />
            Хариулт нэмэх
          </button>
        </div>
        {answers.map((label, index) => (
          <div key={`answer-${index}`} className="flex items-center gap-3">
            <span
              role="button"
              onClick={() => {
                setSelectedAnswerIndex(index);
                setShowCorrectAnswerError(false);
              }}
              className={cn(
                "h-4 w-4 rounded-full border cursor-pointer",
                index === selectedAnswerIndex
                  ? "border-[#0b5cab] bg-[#0b5cab]"
                  : "border-slate-300 bg-white",
              )}
            />
            <Input
              value={label}
              onChange={(event) =>
                handleAnswerChange(index, event.target.value)
              }
              placeholder={`Хариулт ${index + 1}`}
              className="h-[42px] flex-1 rounded-[12px] border-[#dbe4f3] bg-[#eef3f9] px-4 text-[14px] text-slate-700"
            />
            <button
              type="button"
              onClick={() => handleRemoveAnswer(index)}
              className="text-slate-500 transition hover:text-slate-700"
              aria-label="Хариулт устгах"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <p
          className={cn(
            "text-[12px]",
            showCorrectAnswerError ? "text-red-500" : "text-slate-500",
          )}
        >
          Зөв хариултыг сонгоно уу
        </p>
        {generatedExplanation ? (
          <div className="space-y-2">
            <p className="text-[14px] font-semibold text-slate-900">
              Бодолт / Тайлбар
            </p>
            <Textarea
              value={generatedExplanation}
              readOnly
              className={explanationClassName}
            />
            <button
              type="button"
              onClick={() => void handleRegenerateAnswer()}
              disabled={isAiWorking}
              className="inline-flex items-center gap-2 rounded-[10px] border border-transparent px-3 py-2 text-[14px] font-medium text-slate-700 transition hover:border-[#dbe4f3] hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {regenerating ? "Дахин үүсгэж байна..." : "Дахин үүсгүүлэх"}
            </button>
          </div>
        ) : null}
        <Button
          type="button"
          onClick={handleAppendQuestion}
          disabled={!canAppendQuestion}
          className="w-full rounded-[12px] bg-[#0b5cab] text-white hover:bg-[#0a4f96] disabled:bg-[#c8d8ee] disabled:text-white"
        >
          Асуулт нэмэх
        </Button>
      </div>
    </div>
  );
}

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
                  <SelectTrigger className="rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
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
                  <SelectTrigger className="rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
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
  selectedSharedMaterialId,
  onSelectMaterialId,
}: {
  selectedSharedMaterialId: string;
  onSelectMaterialId: (id: string) => void;
}) {
  const material = useMemo(
    () =>
      sharedLibraryMaterials.find(
        (item) => item.id === selectedSharedMaterialId,
      ) ?? sharedLibraryMaterials[0],
    [selectedSharedMaterialId],
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          placeholder="Асуулт хайх..."
          className="rounded-[12px] border-[#dbe4f3] bg-[#f3f6fb] pl-10"
        />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["Бүгд", "Бүгд", "Бүгд"].map((label, index) => (
          <Select key={`${label}-${index}`} defaultValue="all">
            <SelectTrigger className="rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
              <SelectValue placeholder={label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{label}</SelectItem>
            </SelectContent>
          </Select>
        ))}
      </div>

      <div className="rounded-[16px] border border-[#dbe4f3] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">
              {material.title}
            </p>
            <p className="text-[12px] text-slate-500">
              {material.subject} · {material.updatedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectMaterialId(material.id)}
            className="text-[12px] font-medium text-[#0b5cab]"
          >
            Бүгдийг сонгох
          </button>
        </div>

        <div className="space-y-3">
          {material.contents.slice(0, 2).map((content) => (
            <div
              key={content.id}
              className="rounded-[14px] border border-[#e3e9f4] bg-[#f9fbff] p-3"
            >
              <div className="flex items-center gap-2">
                <Checkbox checked />
                <p className="text-[14px] font-medium text-slate-900">
                  {content.previewPrompt}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {content.previewAnswers.slice(0, 3).map((answer, index) => (
                  <div
                    key={answer}
                    className={cn(
                      "rounded-[10px] border px-3 py-2 text-[13px]",
                      index === 0
                        ? "border-[#9cd9c0] bg-[#dff6ee] text-[#127c54]"
                        : "border-[#e3e9f4] bg-white text-slate-700",
                    )}
                  >
                    {String.fromCharCode(65 + index)}. {answer}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#eef4ff] px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-slate-900">
              2 асуулт сонгогдсон
            </p>
            <p className="text-[12px] text-slate-500">Тест рүү нэмэхэд бэлэн</p>
          </div>
          <Button className="rounded-[10px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]">
            <Plus className="h-4 w-4" />
            Нэмэх
          </Button>
        </div>
      </div>
    </div>
  );
}

function getQuestionSourceBadge(source: string) {
  if (source === "Гараар") {
    return {
      icon: PenSquare,
      label: "Гараар оруулсан",
      className:
        "rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
    };
  }

  return {
    icon: FileText,
    label: source,
    className:
      "rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
  };
}

function PreviewQuestionCard({ question }: { question: PreviewQuestion }) {
  const sourceBadge = getQuestionSourceBadge(question.source);

  return (
    <div className="group rounded-[20px] border border-[#e3e9f4] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <div className="flex w-8 shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            className="text-slate-400 transition-opacity group-hover:opacity-100 md:opacity-0"
            aria-label="Асуултын байрлал өөрчлөх"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0f74e7] text-[12px] font-semibold text-white">
            {question.index}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[18px] font-semibold text-slate-900">
              {question.question}
            </p>
            <div className="flex items-center gap-1 transition-opacity group-hover:opacity-100 md:opacity-0">
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Дээш зөөх"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Доош зөөх"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Устгах"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {question.answers.map((answer, index) => (
              <div
                key={answer}
                className={cn(
                  "rounded-[14px] px-4 py-3 text-[15px] text-slate-700",
                  index === question.correct
                    ? "border border-[#a8ddd0] bg-[#d8f2ea] text-[#167e61]"
                    : "bg-[#eef2f6]",
                )}
              >
                {String.fromCharCode(65 + index)}. {answer}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Badge
              className={cn(
                "inline-flex items-center gap-1.5",
                sourceBadge.className,
              )}
            >
              <sourceBadge.icon className="h-3.5 w-3.5" />
              {sourceBadge.label}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MaterialBuilderWorkspaceSection({
  selectedSharedMaterialId,
  onSelectMaterialId,
  source,
  onSourceChange,
}: Props) {
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>(
    initialPreviewQuestions,
  );
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

  function handleAppendQuestion(
    question: Omit<PreviewQuestion, "id" | "index">,
  ) {
    setPreviewQuestions((prev) => {
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
    });
  }

  return (
    <section className="mt-5 rounded-[22px] border border-[#dbe4f3] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-[20px] border border-[#e6edf7] bg-[#fbfcfe] p-4 sm:p-5">
          <div className="mb-4 border-b border-[#e6edf7] pb-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Асуулт нэмэх
            </h2>
            <p className="mt-1 text-[14px] text-slate-500">
              Олон аргыг хамтад нь ашиглаж болно
            </p>
          </div>

          <WorkspaceTabs
            source={activeSource}
            onSourceChange={onSourceChange}
            counts={sourceCounts}
          />

          <div className="mt-5 rounded-[20px] border border-[#e1e8f2] bg-[#f8fbff] p-4">
            {activeSource === "question-bank" ? (
              <QuestionBankPanel onAppendQuestion={handleAppendQuestion} />
            ) : null}
            {activeSource === "import" ? <FilePanel /> : null}
            {activeSource === "shared-library" ? (
              <SharedLibraryPanel
                selectedSharedMaterialId={selectedSharedMaterialId}
                onSelectMaterialId={onSelectMaterialId}
              />
            ) : null}
          </div>
        </div>

        <div className="rounded-[20px] border border-[#e6edf7] bg-[#fcfdff] p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#e6edf7] pb-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
                Шалгалтын асуултууд
              </h2>
              <p className="mt-1 text-[14px] text-slate-500">
                Дарааллыг өөрчлөх эсвэл устгах боломжтой
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[14px] font-semibold text-blue-700">
                <PenSquare className="h-4 w-4" />
                {previewQuestions.length}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[14px] font-semibold text-amber-700">
                <FileUp className="h-4 w-4" />1
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[14px] font-semibold text-slate-600">
                <Database className="h-4 w-4" />1
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {previewQuestions.map((question) => (
              <PreviewQuestionCard key={question.id} question={question} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
