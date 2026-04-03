"use client";

import { useMutation } from "@apollo/client/react";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  FileUp,
  GripVertical,
  Loader2,
  PenSquare,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MathAssistField } from "@/components/exam/math-exam-assist-field";
import { Input } from "@/components/ui/input";
import MathPreviewText from "@/components/math-preview-text";
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
import { requestExtractedExam } from "@/lib/math-exam-api";
import { confirmDeleteAction } from "@/lib/confirm-destructive-action";
import { cn } from "@/lib/utils";
import {
  explanationClassName,
  sharedLibraryMaterials,
  sourceOptions,
  type MaterialSourceId,
} from "../material-builder/_components/material-builder-config";

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
  explanation?: string;
  imageAlt?: string;
  imageDataUrl?: string;
  kind: "choice" | "written";
  source: string;
};

type ImportedQuestion = Omit<PreviewQuestion, "index">;

type ImportedDocument = {
  fileName: string;
  questions: ImportedQuestion[];
  selectedIds: string[];
};

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const acceptedImportFormats =
  ".pdf,.doc,.docx,.txt,.md,.xls,.xlsx";
const importedSourcePattern =
  /\.(pdf|doc|docx|txt|md|xls|xlsx)$/i;

const workspaceSourceOptions = sourceOptions.filter(
  (
    option,
  ): option is (typeof sourceOptions)[number] & { id: WorkspaceSourceId } =>
    option.id !== "textbook",
);

function reindexQuestions(questions: PreviewQuestion[]) {
  return questions.map((question, index) => ({
    ...question,
    index: index + 1,
  }));
}

function summarizeImportFileNames(files: File[]) {
  if (files.length === 0) {
    return "attachment";
  }

  if (files.length === 1) {
    return files[0]?.name ?? "attachment";
  }

  return `${files[0]?.name ?? "attachment"} +${files.length - 1} файл`;
}

function shouldUseFastImport(files: File[]) {
  return files.every((file) => {
    const fileName = file.name.toLowerCase();

    return (
      file.type === DOCX_MIME_TYPE ||
      file.type.startsWith("text/") ||
      /\.(docx|txt|md|markdown|csv|json)$/i.test(fileName)
    );
  });
}

function buildImportedQuestions(
  exam: Awaited<ReturnType<typeof requestExtractedExam>>,
  sourceName: string,
): ImportedQuestion[] {
  const sourceImagesByName = Object.fromEntries(
    (exam.sourceImages ?? [])
      .filter(
        (image): image is {
          alt?: string;
          dataUrl: string;
          name: string;
        } =>
          typeof image.name === "string" &&
          image.name.trim().length > 0 &&
          typeof image.dataUrl === "string" &&
          image.dataUrl.trim().length > 0,
      )
      .map((image) => [image.name, image]),
  );
  const rawQuestions = Array.isArray(exam.questions) ? exam.questions : [];

  return rawQuestions.reduce<ImportedQuestion[]>((result, question, index) => {
    const prompt = question.prompt?.trim();
    const linkedImage = question.sourceImageName
      ? sourceImagesByName[question.sourceImageName]
      : undefined;

    if (!prompt) {
      return result;
    }

    const options = (question.options ?? [])
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (question.type === "mcq" || options.length >= 2) {
      const correct =
        typeof question.correctOption === "number" &&
        question.correctOption >= 0 &&
        question.correctOption < options.length
          ? question.correctOption
          : 0;

      result.push({
        id: `import-${Date.now()}-${index + 1}`,
        question: prompt,
        answers: options.length >= 2 ? options : ["Сонголт танигдсангүй."],
        correct,
        explanation: question.responseGuide?.trim() || undefined,
        imageAlt: question.imageAlt?.trim() || linkedImage?.alt,
        imageDataUrl: linkedImage?.dataUrl,
        kind: "choice",
        source: sourceName,
      });

      return result;
    }

    const writtenAnswer =
      question.answerLatex?.trim() ||
      question.responseGuide?.trim() ||
      "Хариултын тайлбар олдсонгүй.";

    result.push({
      id: `import-${Date.now()}-${index + 1}`,
      question: prompt,
      answers: [writtenAnswer],
      correct: 0,
      explanation: question.responseGuide?.trim() || undefined,
      imageAlt: question.imageAlt?.trim() || linkedImage?.alt,
      imageDataUrl: linkedImage?.dataUrl,
      kind: "written",
      source: sourceName,
    });

    return result;
  }, []);
}

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

function FilePanel({
  importDialogOpen,
  importedDocument,
  importError,
  isExtracting,
  onAddAll,
  onAddSelected,
  onAddAnswer,
  onClear,
  onImportDialogOpenChange,
  onRemoveAnswer,
  onSelectFiles,
  onSetCorrectAnswer,
  onToggleQuestion,
  onUpdateQuestion,
}: {
  importDialogOpen: boolean;
  importedDocument: ImportedDocument | null;
  importError: string | null;
  isExtracting: boolean;
  onAddAll: () => void;
  onAddSelected: () => void;
  onAddAnswer: (questionId: string) => void;
  onClear: () => void;
  onImportDialogOpenChange: (open: boolean) => void;
  onRemoveAnswer: (questionId: string, answerIndex: number) => void;
  onSelectFiles: (files: File[]) => Promise<void> | void;
  onSetCorrectAnswer: (questionId: string, answerIndex: number) => void;
  onToggleQuestion: (id: string, checked: boolean) => void;
  onUpdateQuestion: (
    questionId: string,
    updater: (question: ImportedQuestion) => ImportedQuestion,
  ) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const questionCount = importedDocument?.questions.length ?? 0;
  const selectedCount = importedDocument?.selectedIds.length ?? 0;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void onSelectFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void onSelectFiles(Array.from(event.dataTransfer.files ?? []));
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedImportFormats}
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          "rounded-[18px] border border-dashed bg-white p-5 text-center transition-all",
          isDragging
            ? "border-[#0b5cab] bg-[#f4f8ff]"
            : "border-[#d8e2ef] hover:border-[#b7cbe3]",
        )}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef3ff] text-[#0b5cab]">
          {isExtracting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </div>
        <p className="mt-4 text-[18px] font-semibold text-slate-900">
          {isExtracting
            ? "Файлаас асуулт уншиж байна..."
            : "Файл чирж оруулах эсвэл сонгох"}
        </p>
        <p className="mt-2 text-[14px] text-slate-500">
          PDF, DOC, DOCX, TXT, MD формат дэмжинэ
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-[12px] border-[#dbe4f3] bg-[#f8fbff]"
          disabled={isExtracting}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          {isExtracting ? "Уншиж байна..." : "Файл сонгох"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] border border-[#e0e7f1] bg-white text-[14px] font-medium text-slate-700 transition hover:border-[#bfd1eb] hover:bg-[#f8fbff]"
        >
          <FileText className="h-4 w-4 text-rose-500" />
          PDF
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] border border-[#e0e7f1] bg-white text-[14px] font-medium text-slate-700 transition hover:border-[#bfd1eb] hover:bg-[#f8fbff]"
        >
          <FileText className="h-4 w-4 text-blue-500" />
          DOC / DOCX
        </button>
      </div>

      <div className="rounded-[14px] border border-[#dbe4f3] bg-[#f8fbff] px-4 py-3 text-[13px] text-slate-500">
        PDF, DOC файл дээр `AI enhance` ашиглаж уншина. DOCX/TXT файл бол шууд `fast import`-оор танина.
      </div>

      {importError ? (
        <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-700">
          {importError}
        </div>
      ) : null}

      {importedDocument ? (
        <div className="space-y-3">
          <div className="rounded-[16px] border border-[#d7e7de] bg-[#effaf4] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-slate-900">
                  {importedDocument.fileName}
                </p>
                <p className="text-[13px] text-slate-500">
                  {questionCount} асуулт олдлоо · {selectedCount} сонгогдсон
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onImportDialogOpenChange(true)}
                className="rounded-[10px] border-[#dbe4f3] bg-white text-slate-700 hover:bg-[#f8fbff]"
                variant="outline"
              >
                Нээх
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[14px] border border-[#dbe4f3] bg-[#f8fbff] p-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-[12px] border-[#dbe4f3] bg-white"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
              Цуцлах
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-[12px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]"
              onClick={onAddAll}
              disabled={questionCount === 0}
            >
              <Check className="h-4 w-4" />
              Бүгдийг оруулах
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[16px] border border-[#e5edf7] bg-[#fbfdff] px-4 py-4 text-[14px] text-slate-500">
          Файл import хийсний дараа зүүн талд танигдсан асуултууд гарч ирнэ.
        </div>
      )}

      <Dialog open={importDialogOpen} onOpenChange={onImportDialogOpenChange}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden rounded-[28px] border border-[#dbe4f3] bg-white p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[#e6edf7] px-5 py-5 sm:px-6">
            <div className="pr-10">
              <DialogTitle className="text-[20px] font-semibold text-slate-900">
                {importedDocument?.fileName ?? "Import review"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-[14px] text-slate-500">
                Танигдсан асуултуудаа эндээс шалгаад сонгон нэмнэ үү.
              </DialogDescription>
            </div>
          </DialogHeader>

          {importedDocument ? (
            <>
              <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
                {importedDocument.questions.map((question, index) => {
                  const checked = importedDocument.selectedIds.includes(question.id);

                  return (
                    <div
                      key={question.id}
                      className="rounded-[16px] border border-[#dbe4f3] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(15,23,42,0.03)]"
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            onToggleQuestion(question.id, next === true)
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          {question.imageDataUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={question.imageDataUrl}
                              alt={question.imageAlt || "Question image"}
                              className="mb-3 max-h-44 rounded-[12px] border border-[#dbe4f3] object-contain"
                            />
                          ) : null}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <MathAssistField
                                value={question.question}
                                multiline
                                onChange={(value) =>
                                  onUpdateQuestion(question.id, (current) => ({
                                    ...current,
                                    question: value,
                                  }))
                                }
                                placeholder="Асуултын текст"
                              />
                            </div>
                            <span className="rounded-full bg-[#f2f6fb] px-2 py-1 text-[11px] font-semibold text-slate-600">
                              #{index + 1}
                            </span>
                          </div>

                          {question.kind === "written" ? (
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Хариултын чиглэл
                                </p>
                                <MathAssistField
                                  value={question.answers[0] ?? ""}
                                  multiline
                                  onChange={(value) =>
                                    onUpdateQuestion(question.id, (current) => ({
                                      ...current,
                                      answers: [value],
                                    }))
                                  }
                                  placeholder="Хариултын чиглэл / зөв хариу"
                                />
                              </div>
                              <div>
                                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Тайлбар
                                </p>
                                <MathAssistField
                                  value={question.explanation ?? ""}
                                  multiline
                                  onChange={(value) =>
                                    onUpdateQuestion(question.id, (current) => ({
                                      ...current,
                                      explanation: value,
                                    }))
                                  }
                                  placeholder="Нэмэлт тайлбар"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {question.answers.map((answer, answerIndex) => (
                                <div
                                  key={`${question.id}-answer-${answerIndex}`}
                                  className="flex items-center gap-3 rounded-[14px] border border-[#dbe4f3] bg-[#f8fbff] px-3 py-3"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSetCorrectAnswer(question.id, answerIndex)
                                    }
                                    className={cn(
                                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition",
                                      answerIndex === question.correct
                                        ? "border-[#16a36d] bg-[#16a36d] text-white"
                                        : "border-[#cbd5e1] bg-white text-slate-600 hover:border-[#0b5cab] hover:text-[#0b5cab]",
                                    )}
                                  >
                                    {String.fromCharCode(65 + answerIndex)}
                                  </button>
                                  <div className="flex-1">
                                    <MathAssistField
                                      value={answer}
                                      onChange={(value) =>
                                        onUpdateQuestion(question.id, (current) => ({
                                          ...current,
                                          answers: current.answers.map(
                                            (item, itemIndex) =>
                                              itemIndex === answerIndex ? value : item,
                                          ),
                                        }))
                                      }
                                      placeholder={`Сонголт ${String.fromCharCode(65 + answerIndex)}`}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onRemoveAnswer(question.id, answerIndex)
                                    }
                                    className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                    aria-label="Хариулт устгах"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}

                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[12px] text-slate-500">
                                  Зөв хариултыг зүүн талын үсгэн товчоор сонгоно.
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-[10px] border-[#dbe4f3] bg-white"
                                  onClick={() => onAddAnswer(question.id)}
                                >
                                  <Plus className="h-4 w-4" />
                                  Хариулт нэмэх
                                </Button>
                              </div>

                              <div>
                                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Тайлбар
                                </p>
                                <MathAssistField
                                  value={question.explanation ?? ""}
                                  multiline
                                  onChange={(value) =>
                                    onUpdateQuestion(question.id, (current) => ({
                                      ...current,
                                      explanation: value,
                                    }))
                                  }
                                  placeholder="Нэмэлт тайлбар"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 border-t border-[#e6edf7] bg-[#fbfdff] px-5 py-4 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-[12px] border-[#dbe4f3] bg-white"
                  onClick={onClear}
                >
                  <X className="h-4 w-4" />
                  Цуцлах
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-[12px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]"
                  onClick={onAddSelected}
                  disabled={selectedCount === 0}
                >
                  <Check className="h-4 w-4" />
                  {selectedCount} асуулт нэмэх
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
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

  async function handleRemoveAnswer(index: number) {
    if (
      !(await confirmDeleteAction(
        "Энэ хариултыг",
        "Сонгосон хариултын мөр устна.",
      ))
    ) {
      return;
    }

    setAnswers((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
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
    setAnswers((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
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
    const selectedAnswer = answers[selectedAnswerIndex ?? 0]?.trim() ?? "";

    if (!trimmedQuestion || normalizedAnswers.length === 0) return;
    if (selectedAnswerIndex === null || !selectedAnswer) {
      setShowCorrectAnswerError(true);
      return;
    }

    onAppendQuestion({
      question: trimmedQuestion,
      answers: normalizedAnswers,
      correct: Math.max(
        0,
        normalizedAnswers.findIndex((answer) => answer === selectedAnswer),
      ),
      explanation: generatedExplanation || undefined,
      kind: questionTypeValue === "written" ? "written" : "choice",
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

      <Textarea
        value={questionText}
        onChange={(event) => setQuestionText(event.target.value)}
        placeholder="Асуултаа энд бичнэ үү..."
        className="hidden"
      />
      <MathAssistField
        value={questionText}
        multiline
        onChange={setQuestionText}
        placeholder="Асуултаа энд бичнэ үү..."
      />

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
                "h-4 w-4 cursor-pointer rounded-full border",
                index === selectedAnswerIndex
                  ? "border-[#0b5cab] bg-[#0b5cab]"
                  : "border-slate-300 bg-white",
              )}
            />
            <div className="flex-1">
              <MathAssistField
                value={label}
                onChange={(value) => handleAnswerChange(index, value)}
                placeholder={`Хариулт ${index + 1}`}
              />
            </div>
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

function SharedLibraryPanel({
  selectedSharedMaterialId,
  onAppendQuestions,
  onSelectMaterialId,
}: {
  selectedSharedMaterialId: string;
  onAppendQuestions: (questions: Omit<PreviewQuestion, "id" | "index">[]) => void;
  onSelectMaterialId: (id: string) => void;
}) {
  const material = useMemo(
    () =>
      sharedLibraryMaterials.find(
        (item) => item.id === selectedSharedMaterialId,
      ) ?? sharedLibraryMaterials[0],
    [selectedSharedMaterialId],
  );

  function handleAddToPreview() {
    onAppendQuestions(
      material.contents.map((content) => ({
        question: content.previewPrompt,
        answers: [...content.previewAnswers],
        correct: 0,
        explanation: content.previewExplanation,
        kind: content.type === "Задгай" ? "written" : "choice",
        source: material.title,
      })),
    );
    toast.success(`${material.title}-оос асуултууд нэмэгдлээ.`);
  }

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
                <MathPreviewText
                  content={content.previewPrompt}
                  className="text-[14px] font-medium text-slate-900"
                />
              </div>
              <div className="mt-3 space-y-2">
                {content.previewAnswers.map((answer, index) => (
                  <div
                    key={answer}
                    className={cn(
                      "rounded-[10px] border px-3 py-2 text-[13px]",
                      index === 0
                        ? "border-[#9cd9c0] bg-[#dff6ee] text-[#127c54]"
                        : "border-[#e3e9f4] bg-white text-slate-700",
                    )}
                  >
                    <span className="mr-1">{String.fromCharCode(65 + index)}.</span>
                    <MathPreviewText
                      content={answer}
                      className="inline text-[13px] text-inherit"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#eef4ff] px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-slate-900">
              {material.contents.length} асуулт бэлэн
            </p>
            <p className="text-[12px] text-slate-500">Тест рүү нэмэхэд бэлэн</p>
          </div>
          <Button
            className="rounded-[10px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]"
            onClick={handleAddToPreview}
          >
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

  if (importedSourcePattern.test(source)) {
    return {
      icon: FileText,
      label: source,
      className:
        "rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
    };
  }

  return {
    icon: Database,
    label: source,
    className:
      "rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  };
}

function PreviewQuestionCard({
  canMoveDown,
  canMoveUp,
  onMoveDown,
  onMoveUp,
  onRemove,
  question,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  question: PreviewQuestion;
}) {
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
            <MathPreviewText
              content={question.question}
              className="text-[18px] font-semibold text-slate-900"
            />
            <div className="flex items-center gap-1 transition-opacity group-hover:opacity-100 md:opacity-0">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                aria-label="Дээш зөөх"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                aria-label="Доош зөөх"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Устгах"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {question.kind === "written" ? (
            <div className="mt-3 rounded-[14px] border border-[#dbe4f3] bg-[#f8fbff] px-4 py-4 text-[15px] text-slate-700">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Хариултын чиглэл
              </p>
              {question.imageDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={question.imageDataUrl}
                  alt={question.imageAlt || "Question image"}
                  className="mt-3 max-h-56 rounded-[14px] border border-[#dbe4f3] object-contain"
                />
              ) : null}
              <MathPreviewText
                content={question.answers[0] || "Хариултын тайлбар алга."}
                className="mt-2 text-[15px] text-slate-700"
              />
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {question.imageDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={question.imageDataUrl}
                  alt={question.imageAlt || "Question image"}
                  className="max-h-64 rounded-[14px] border border-[#dbe4f3] object-contain"
                />
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
              {question.answers.map((answer, index) => (
                <div
                  key={`${question.id}-answer-${index}`}
                  className={cn(
                    "rounded-[14px] px-4 py-3 text-[15px] text-slate-700",
                    index === question.correct
                      ? "border border-[#a8ddd0] bg-[#d8f2ea] text-[#167e61]"
                      : "bg-[#eef2f6]",
                  )}
                >
                  <span className="mr-1">{String.fromCharCode(65 + index)}.</span>
                  <MathPreviewText
                    content={answer}
                    className="inline text-[15px] text-inherit"
                  />
                </div>
              ))}
              </div>
            </div>
          )}

          {question.explanation ? (
            <div className="mt-3 rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[13px] text-slate-600">
              <MathPreviewText
                content={question.explanation}
                className="text-[13px] text-slate-600"
              />
            </div>
          ) : null}

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

function PreviewEmptyState() {
  return (
    <div className="flex min-h-[440px] items-center justify-center rounded-[20px] border border-dashed border-[#dbe4f3] bg-white/70 p-6">
      <div className="max-w-[320px] text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f5ff] text-[#0b5cab]">
          <FileText className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-[24px] font-semibold text-slate-900">
          Асуулт байхгүй байна
        </h3>
        <p className="mt-3 text-[15px] leading-7 text-slate-500">
          Зүүн талын аргуудаас ашиглан асуулт нэмнэ үү. Та файл import хийж,
          гараар бичиж, эсвэл нэгдсэн сангаас сонгож болно.
        </p>
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
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>([]);
  const [importedDocument, setImportedDocument] = useState<ImportedDocument | null>(
    null,
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isExtractingImport, setIsExtractingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const activeSource = source === "textbook" ? "question-bank" : source;
  const sourceCounts = useMemo(
    () => ({
      "question-bank": previewQuestions.filter(
        (question) => question.source === "Гараар",
      ).length,
      import: previewQuestions.filter((question) =>
        importedSourcePattern.test(question.source),
      ).length,
      "shared-library": previewQuestions.filter(
        (question) =>
          question.source !== "Гараар" &&
          !importedSourcePattern.test(question.source),
      ).length,
    }),
    [previewQuestions],
  );

  function appendQuestions(questions: Omit<PreviewQuestion, "id" | "index">[]) {
    setPreviewQuestions((prev) =>
      reindexQuestions([
        ...prev,
        ...questions.map((question, index) => ({
          ...question,
          id: `${question.source}-${Date.now()}-${index + 1}`,
          index: 0,
        })),
      ]),
    );
  }

  function handleAppendQuestion(question: Omit<PreviewQuestion, "id" | "index">) {
    appendQuestions([question]);
  }

  function handleToggleImportedQuestion(id: string, checked: boolean) {
    setImportedDocument((prev) => {
      if (!prev) return prev;

      const selectedIds = checked
        ? Array.from(new Set([...prev.selectedIds, id]))
        : prev.selectedIds.filter((item) => item !== id);

      return {
        ...prev,
        selectedIds,
      };
    });
  }

  function handleUpdateImportedQuestion(
    questionId: string,
    updater: (question: ImportedQuestion) => ImportedQuestion,
  ) {
    setImportedDocument((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        questions: prev.questions.map((question) =>
          question.id === questionId ? updater(question) : question,
        ),
      };
    });
  }

  function handleAddImportedAnswer(questionId: string) {
    handleUpdateImportedQuestion(questionId, (question) => ({
      ...question,
      answers: [...question.answers, ""],
    }));
  }

  async function handleRemoveImportedAnswer(
    questionId: string,
    answerIndex: number,
  ) {
    const question = importedDocument?.questions.find(
      (item) => item.id === questionId,
    );

    if (!question || question.kind === "written" || question.answers.length <= 2) {
      return;
    }

    if (
      !(await confirmDeleteAction(
        "Энэ хариултыг",
        "Импортолсон асуултын энэ сонголт устна.",
      ))
    ) {
      return;
    }

    handleUpdateImportedQuestion(questionId, (question) => {
      if (question.kind === "written") {
        return question;
      }

      if (question.answers.length <= 2) {
        return question;
      }

      const nextAnswers = question.answers.filter(
        (_, index) => index !== answerIndex,
      );
      const nextCorrect =
        question.correct === answerIndex
          ? 0
          : question.correct > answerIndex
            ? question.correct - 1
            : question.correct;

      return {
        ...question,
        answers: nextAnswers,
        correct: Math.max(0, Math.min(nextCorrect, nextAnswers.length - 1)),
      };
    });
  }

  function handleSetImportedCorrectAnswer(
    questionId: string,
    answerIndex: number,
  ) {
    handleUpdateImportedQuestion(questionId, (question) => ({
      ...question,
      correct: answerIndex,
    }));
  }

  async function handleSelectImportFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setImportError(null);
    setIsExtractingImport(true);

    try {
      const useFastImport = shouldUseFastImport(files);
      const fileLabel = summarizeImportFileNames(files);
      const exam = await requestExtractedExam(files, {
        mode: useFastImport ? "fast" : "enhance",
      });
      const questions = buildImportedQuestions(exam, fileLabel);

      if (questions.length === 0) {
        throw new Error("Файлаас танигдсан асуулт олдсонгүй.");
      }

      setImportedDocument({
        fileName: fileLabel,
        questions,
        selectedIds: questions.map((question) => question.id),
      });
      setImportDialogOpen(true);
      onSourceChange("import");
      toast.success(`${fileLabel}-с ${questions.length} асуулт уншлаа.`);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Файлаас асуулт уншихад алдаа гарлаа.";

      setImportedDocument(null);
      setImportDialogOpen(false);
      setImportError(message);
      toast.error(message);
    } finally {
      setIsExtractingImport(false);
    }
  }

  function handleAddAllImportedQuestions() {
    if (!importedDocument || importedDocument.questions.length === 0) {
      return;
    }

    appendQuestions(importedDocument.questions);
    toast.success(`${importedDocument.questions.length} асуулт нэмэгдлээ.`);
    setImportedDocument(null);
    setImportDialogOpen(false);
    setImportError(null);
  }

  function handleAddSelectedImportedQuestions() {
    if (!importedDocument) {
      return;
    }

    const selectedQuestions = importedDocument.questions.filter((question) =>
      importedDocument.selectedIds.includes(question.id),
    );

    if (selectedQuestions.length === 0) {
      toast.error("Нэмэх асуултаа сонгоно уу.");
      return;
    }

    appendQuestions(selectedQuestions);
    toast.success(`${selectedQuestions.length} асуулт нэмэгдлээ.`);

    const remainingQuestions = importedDocument.questions.filter(
      (question) => !importedDocument.selectedIds.includes(question.id),
    );

    setImportedDocument(
      remainingQuestions.length > 0
        ? {
            ...importedDocument,
            questions: remainingQuestions,
            selectedIds: [],
          }
        : null,
    );
    setImportDialogOpen(remainingQuestions.length > 0);
  }

  function handleMoveQuestion(id: string, direction: "up" | "down") {
    setPreviewQuestions((prev) => {
      const index = prev.findIndex((question) => question.id === id);

      if (index < 0) {
        return prev;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [movedQuestion] = next.splice(index, 1);
      next.splice(targetIndex, 0, movedQuestion);

      return reindexQuestions(next);
    });
  }

  async function handleRemoveQuestion(id: string) {
    if (
      !(await confirmDeleteAction(
        "Энэ асуултыг",
        "Шалгалтын асуултын жагсаалтаас хасагдана.",
      ))
    ) {
      return;
    }

    setPreviewQuestions((prev) =>
      reindexQuestions(prev.filter((question) => question.id !== id)),
    );
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

            {activeSource === "import" ? (
              <FilePanel
                importDialogOpen={importDialogOpen}
                importedDocument={importedDocument}
                importError={importError}
                isExtracting={isExtractingImport}
                onAddAll={handleAddAllImportedQuestions}
                onAddSelected={handleAddSelectedImportedQuestions}
                onAddAnswer={handleAddImportedAnswer}
                onClear={() => {
                  setImportedDocument(null);
                  setImportDialogOpen(false);
                  setImportError(null);
                }}
                onImportDialogOpenChange={setImportDialogOpen}
                onRemoveAnswer={handleRemoveImportedAnswer}
                onSelectFiles={handleSelectImportFiles}
                onSetCorrectAnswer={handleSetImportedCorrectAnswer}
                onToggleQuestion={handleToggleImportedQuestion}
                onUpdateQuestion={handleUpdateImportedQuestion}
              />
            ) : null}

            {activeSource === "shared-library" ? (
              <SharedLibraryPanel
                selectedSharedMaterialId={selectedSharedMaterialId}
                onSelectMaterialId={onSelectMaterialId}
                onAppendQuestions={appendQuestions}
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
                <FileUp className="h-4 w-4" />
                {sourceCounts.import}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[14px] font-semibold text-slate-600">
                <Database className="h-4 w-4" />
                {sourceCounts["shared-library"]}
              </div>
            </div>
          </div>

          {previewQuestions.length === 0 ? (
            <PreviewEmptyState />
          ) : (
            <div className="space-y-4">
              {previewQuestions.map((question, index) => (
                <PreviewQuestionCard
                  key={question.id}
                  question={question}
                  canMoveUp={index > 0}
                  canMoveDown={index < previewQuestions.length - 1}
                  onMoveUp={() => handleMoveQuestion(question.id, "up")}
                  onMoveDown={() => handleMoveQuestion(question.id, "down")}
                  onRemove={() => handleRemoveQuestion(question.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
