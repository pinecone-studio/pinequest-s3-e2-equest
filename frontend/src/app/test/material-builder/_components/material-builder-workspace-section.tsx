"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import type { ChangeEvent, ReactNode } from "react";
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
  Check,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Database,
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
import { requestExtractedExam } from "@/lib/math-exam-api";
import { confirmDeleteAction } from "@/lib/confirm-destructive-action";
import { cn } from "@/lib/utils";
import {
  fetchR2TextbookCandidates,
  getExpectedR2FileName,
  type MaterialBuilderSubject,
  type R2TextbookCandidate,
} from "@/features/textbook-processing/api";
import {} from "@/features/textbook-processing/status";
import {
  loadPersistedImportedTextbookCards,
  persistImportedTextbookCards,
  type PersistedImportedTextbookCard,
} from "@/features/textbook-processing/persisted-material-cache";
import type {
  TextbookMaterial,
  TextbookUploadedAsset,
} from "@/features/textbook-processing/types";
import {
  sourceOptions,
  type MaterialSourceId,
} from "./material-builder-config";
import { normalizeBackendMathText } from "@/lib/normalize-math-text";
import {
  materialBuilderDemoQuestions,
  type MaterialBuilderDemoQuestion,
} from "./material-builder-demo-questions";
import {
  type PreviewQuestion,
  type PreviewQuestionSourceType,
} from "./material-builder-types";
import {
  TextbookSection,
  type TextbookGeneratedState,
} from "./textbook-section";
import { mergeTextbookQuestionsIntoPreview } from "./textbook-preview-merge";
import { mapGeneratedTextbookTestToPreviewQuestions } from "./textbook-preview-adapter";

type Props = {
  generalInfo: {
    durationMinutes: string;
    examName: string;
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
const mathAssistFieldClassName =
  "rounded-[20px]! border-[#dbe4f3]! bg-[#F1F4FA]! px-3! py-2.5! hover:border-[#c7d5ea]! focus-visible:border-[#b8c8e0]! focus-visible:ring-[#b8c8e0]/20";
const questionMathAssistFieldClassName = `${mathAssistFieldClassName} bg-white!`;
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

const workspaceSourceOptions = sourceOptions;

function normalizeTextbookSubject(
  value: string,
): MaterialBuilderSubject | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "math" || normalized.includes("мат")) {
    return "math";
  }

  if (normalized === "physics" || normalized.includes("физ")) {
    return "physics";
  }

  if (normalized === "chemistry" || normalized.includes("хим")) {
    return "chemistry";
  }

  return null;
}

function normalizeTextbookGrade(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getTextbookSubjectLabel(subject: MaterialBuilderSubject | null) {
  switch (subject) {
    case "math":
      return "Математик";
    case "physics":
      return "Физик";
    case "chemistry":
      return "Хими";
    default:
      return "";
  }
}

function resolvePreviewQuestionSourceType(
  question: PreviewQuestion,
): PreviewQuestionSourceType {
  if (question.sourceType) {
    return question.sourceType;
  }

  if (question.source === "Гараар") {
    return "question-bank";
  }

  if (/\.(pdf|doc|docx|xls|xlsx)$/i.test(question.source)) {
    return "import";
  }

  return "shared-library";
}

type QueuedTextbookImport = {
  file?: File | null;
  fileName: string;
  id: string;
  materialId?: string | null;
  title: string;
  uploadedAsset?: PersistedImportedTextbookCard["uploadedAsset"];
};

type ImportedQuestion = Omit<PreviewQuestion, "index"> & {
  imageAlt?: string;
  imageDataUrl?: string;
};

type ImportedDocument = {
  fileName: string;
  questions: ImportedQuestion[];
  selectedIds: string[];
};

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_IMPORT_ACCEPT =
  ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDocImportFile(file: File) {
  const fileName = file.name.toLowerCase();

  return (
    file.type === DOCX_MIME_TYPE ||
    file.type === "application/msword" ||
    /\.(doc|docx)$/i.test(fileName)
  );
}

function createTextbookImportId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `textbook-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
        (
          image,
        ): image is {
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
        answers: options.length >= 2 ? options : ["Сонголт танигдсангүй."],
        correct,
        explanation: question.responseGuide?.trim() || undefined,
        id: `import-${Date.now()}-${index + 1}`,
        imageAlt: question.imageAlt?.trim() || linkedImage?.alt,
        imageDataUrl: linkedImage?.dataUrl,
        points: question.points ?? 1,
        question: prompt,
        questionType: "single-choice",
        source: sourceName,
        sourceType: "import",
      });

      return result;
    }

    const writtenAnswer =
      question.answerLatex?.trim() ||
      question.responseGuide?.trim() ||
      "Хариултын тайлбар олдсонгүй.";

    result.push({
      answers: [writtenAnswer],
      correct: 0,
      explanation: question.responseGuide?.trim() || undefined,
      id: `import-${Date.now()}-${index + 1}`,
      imageAlt: question.imageAlt?.trim() || linkedImage?.alt,
      imageDataUrl: linkedImage?.dataUrl,
      points: question.points ?? 1,
      question: prompt,
      questionType: "written",
      source: sourceName,
      sourceType: "import",
    });

    return result;
  }, []);
}

function buildTextbookAssetIdentity(
  input?: {
    bucketName?: string | null;
    key?: string | null;
  } | null,
) {
  if (!input?.bucketName || !input?.key) {
    return "";
  }

  return `${input.bucketName}:${input.key}`;
}

function createTextbookImportIdFromUploadedAsset(asset: {
  bucketName: string;
  key: string;
}) {
  return `textbook-r2:${asset.bucketName}:${asset.key}`;
}

function createUploadedAssetFromR2Candidate(
  candidate: R2TextbookCandidate,
): TextbookUploadedAsset {
  return {
    bucketName: candidate.bucketName,
    contentType: "application/pdf",
    fileName: candidate.fileName,
    key: candidate.key,
    size: candidate.size,
    uploadedAt: candidate.lastModified || new Date().toISOString(),
  };
}

function getTextbookFileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Сурах бичиг";
}

function findTextbookCardByAsset(
  cards: PersistedImportedTextbookCard[],
  asset?: {
    bucketName?: string | null;
    key?: string | null;
  } | null,
) {
  const identity = buildTextbookAssetIdentity(asset);
  if (!identity) {
    return null;
  }

  return (
    cards.find(
      (card) => buildTextbookAssetIdentity(card.uploadedAsset) === identity,
    ) ?? null
  );
}

function upsertTextbookCard(
  cards: PersistedImportedTextbookCard[],
  nextCard: PersistedImportedTextbookCard,
) {
  const nextIdentity = buildTextbookAssetIdentity(nextCard.uploadedAsset);
  const existingIndex = cards.findIndex((card) => {
    if (card.id === nextCard.id) {
      return true;
    }

    return (
      Boolean(nextIdentity) &&
      buildTextbookAssetIdentity(card.uploadedAsset) === nextIdentity
    );
  });

  if (existingIndex < 0) {
    return [nextCard, ...cards];
  }

  const current = cards[existingIndex];
  const mergedCard: PersistedImportedTextbookCard = {
    ...current,
    ...nextCard,
    createdAt: current.createdAt || nextCard.createdAt,
  };
  const nextCards = [...cards];
  nextCards[existingIndex] = mergedCard;
  return nextCards;
}

function getTextbookCardTitle(card: PersistedImportedTextbookCard) {
  return card.title?.trim() || card.fileName || "Сурах бичиг";
}

function formatTextbookUpdatedAt(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("mn-MN", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

type TextbookLibraryGridItem =
  | {
      createdAt?: string | null;
      fileName: string;
      id: string;
      kind: "r2";
      title: string;
      candidate: R2TextbookCandidate;
    }
  | {
      createdAt?: string | null;
      fileName: string;
      id: string;
      kind: "saved";
      title: string;
      card: PersistedImportedTextbookCard;
    };

const TEXTBOOK_CARD_COVER_THEMES = [
  {
    backgroundImage:
      "radial-gradient(circle at 12% 12%, rgba(255,255,255,0.24), transparent 24%), linear-gradient(145deg, rgba(8,43,10,0) 26%, rgba(8,43,10,0.62) 27%, rgba(8,43,10,0.62) 50%, rgba(8,43,10,0) 51%), linear-gradient(135deg, #8CFF00 0%, #53F20C 58%, #1DB400 100%)",
  },
  {
    backgroundImage:
      "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.28), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(8,43,10,0.18)), linear-gradient(135deg, #74FF2A 0%, #64F640 52%, #B3FF63 100%)",
  },
  {
    backgroundImage:
      "radial-gradient(circle at 85% 12%, rgba(255,255,255,0.2), transparent 24%), linear-gradient(168deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.24) 24%, rgba(255,255,255,0) 25%), linear-gradient(140deg, #7CFF57 0%, #63F644 45%, #D6FF8A 100%)",
  },
] as const;

function getTextbookCardCoverTheme(seed: string) {
  let hash = 0;
  for (const char of String(seed || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }

  return TEXTBOOK_CARD_COVER_THEMES[
    Math.abs(hash) % TEXTBOOK_CARD_COVER_THEMES.length
  ];
}

function toRomanGrade(value: number) {
  const romanMap: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
  };

  return romanMap[value] || String(value);
}

function getTextbookCoverSubjectLabel(
  value: string,
  fallbackSubject: MaterialBuilderSubject | null,
) {
  if (fallbackSubject) {
    return getTextbookSubjectLabel(fallbackSubject).toUpperCase();
  }

  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("мат")) {
    return "МАТЕМАТИК";
  }
  if (normalized.includes("физ")) {
    return "ФИЗИК";
  }
  if (normalized.includes("хим")) {
    return "ХИМИ";
  }

  return (
    getTextbookSubjectLabel(fallbackSubject).toUpperCase() || "СУРАХ БИЧИГ"
  );
}

function getTextbookCoverGradeLabel(fallbackGrade: number | null) {
  const gradeNumber = fallbackGrade || null;

  if (!gradeNumber || !Number.isFinite(gradeNumber)) {
    return "";
  }

  return toRomanGrade(gradeNumber);
}

function getTextbookDisplayTitle(
  value: string,
  fallbackSubject: MaterialBuilderSubject | null,
  fallbackGrade: number | null,
) {
  const subjectLabel = getTextbookSubjectLabel(fallbackSubject);

  if (subjectLabel && fallbackGrade) {
    return `${subjectLabel} - ${fallbackGrade}`;
  }

  if (subjectLabel) {
    return subjectLabel;
  }

  return value.trim() || "Сурах бичиг";
}

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
      sourceType: "shared-library",
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
  return (
    <div className="mx-auto max-w-[148px] space-y-1.5 rounded-[17px] border border-[#d9e2ed] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      {workspaceSourceOptions.map((option) => {
        const Icon = option.icon;
        const active = option.id === source;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSourceChange(option.id)}
            className={cn(
              "flex w-full origin-center cursor-pointer items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[12.5px] font-medium transition-[transform,background-color,color,box-shadow] duration-200 ease-out will-change-transform",
              active
                ? "bg-[#0b5cab] text-white shadow-[0_10px_22px_rgba(11,92,171,0.2)]"
                : "bg-white text-slate-900 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-slate-100 hover:text-slate-950 hover:shadow-[0_12px_24px_rgba(15,23,42,0.10)]",
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

function FilePanel({
  importedDocument,
  importError,
  isExtracting,
  onClear,
  onOpenReview,
  onSelectFiles,
}: {
  importedDocument: ImportedDocument | null;
  importError: string | null;
  isExtracting: boolean;
  onClear: () => void;
  onOpenReview: () => void;
  onSelectFiles: (files: File[]) => Promise<void> | void;
}) {
  const allFileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
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
    <div className="min-w-0 space-y-3 overflow-x-hidden">
      <input
        ref={allFileInputRef}
        type="file"
        accept={DOC_IMPORT_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept={DOC_IMPORT_ACCEPT}
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
          "relative rounded-[20px] border border-dashed px-5 py-7 text-center transition-all",
          isDragging
            ? "border-[#0b5cab] bg-[#f4f8ff]"
            : "border-[#cfd8e3] bg-transparent",
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2f7] text-slate-600">
          {isExtracting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </div>
        <p className="mt-4 text-[16px] font-semibold text-slate-900">
          {isExtracting
            ? "Файлаас асуулт уншиж байна..."
            : "Файл чирж оруулах эсвэл сонгох"}
        </p>
        <p className="mt-2 text-[14px] text-slate-500">
          DOC, DOCX форматууд
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-[12px] border-[#dbe4f3] bg-[#f8fbff]"
          disabled={isExtracting}
          onClick={() => allFileInputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          {isExtracting ? "Уншиж байна..." : "Файл сонгох"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => docInputRef.current?.click()}
          disabled={isExtracting}
          className="flex min-w-0 h-[42px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] border border-[#d9e3f0] bg-[#f4f7fb] px-2 text-[12px] font-medium leading-none text-slate-700 transition hover:bg-[#eef3f9] sm:text-[13px]"
        >
          <FileText className="h-4 w-4 text-blue-500" />
          DOC/DOCX
        </button>
      </div>

      <div className="rounded-[14px] border border-[#dbe4f3] bg-[#f8fbff] px-4 py-3 text-[13px] text-slate-500">
        DOC файл дээр `AI enhance` ашиглаж уншина. DOCX файл бол шууд `fast
        import`-оор танина.
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
                onClick={onOpenReview}
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
              onClick={onOpenReview}
              disabled={questionCount === 0}
            >
              <Check className="h-4 w-4" />
              Асуултуудыг шалгах
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[16px] border border-[#e5edf7] bg-[#fbfdff] px-4 py-4 text-[14px] text-slate-500">
          DOC / DOCX import хийсний дараа танигдсан асуултуудыг эндээс шалгаад
          шалгалт руу нэмнэ.
        </div>
      )}
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
      sourceType: "question-bank",
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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="min-w-0">
            <Select value={scoreValue} onValueChange={setScoreValue}>
              <SelectTrigger
                title="Оноо"
                className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] !bg-white [&>span]:truncate"
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

          <div className="min-w-0">
            <Select
              value={questionTypeValue}
              onValueChange={setQuestionTypeValue}
            >
              <SelectTrigger
                title="Асуултын төрөл"
                className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] !bg-white [&>span]:truncate"
              >
                <SelectValue placeholder="Төрөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
                <SelectItem value="written">Нээлттэй</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <Select value={difficultyValue} onValueChange={setDifficultyValue}>
              <SelectTrigger
                title="Асуултын хүндрэлийн түвшин"
                className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] !bg-white [&>span]:truncate"
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
          className={questionMathAssistFieldClassName}
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

  async function deleteEditingExamQuestion(questionId: string) {
    if (
      !(await confirmDeleteAction(
        "Энэ асуултыг",
        "Шалгалтын доторх асуултын жагсаалтаас хасагдана.",
      ))
    ) {
      return;
    }

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
                    className="w-[min(92vw,24rem)] rounded-[18px] border border-[#dbe4f3] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-slate-900">
                          Нэмэлт filter
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">
                          Хугацаа
                        </p>
                        <Select
                          value={durationFilter}
                          onValueChange={setDurationFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Сонгох" />
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
                        <p className="text-[12px] font-medium text-slate-600">
                          Багш
                        </p>
                        <Select
                          value={teacherFilter}
                          onValueChange={setTeacherFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүх багш</SelectItem>
                            {teacherOptions.map((value) => (
                              <SelectItem key={`teacher-${value}`} value={value}>
                                {value === "unknown"
                                  ? "Тодорхойгүй"
                                  : value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">
                          Хувилбар
                        </p>
                        <Select
                          value={variantFilter}
                          onValueChange={setVariantFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Бүгд</SelectItem>
                            <SelectItem value="with">Хувилбартай</SelectItem>
                            <SelectItem value="without">Хувилбаргүй</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <p className="text-[12px] font-medium text-slate-600">
                          Асуултын тоо
                        </p>
                        <Select
                          value={questionCountFilter}
                          onValueChange={setQuestionCountFilter}
                        >
                          <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                            <SelectValue placeholder="Сонгох" />
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

function getQuestionSourceBadge(question: PreviewQuestion) {
  const sourceType = resolvePreviewQuestionSourceType(question);

  if (sourceType === "question-bank") {
    return {
      icon: Keyboard,
      label: "Гараар оруулсан",
      className:
        "rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
    };
  }

  if (sourceType === "textbook") {
    return {
      icon: BookOpen,
      label: question.source,
      className:
        "rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    };
  }

  if (sourceType === "shared-library") {
    return {
      icon: Database,
      label: question.source,
      className:
        "rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
    };
  }

  return {
    icon: FileText,
    label: question.source,
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
  const sourceBadge = getQuestionSourceBadge(question);
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
            <div className="space-y-1.5">
              <span className="block">{`Асуулт ${question.index}:`}</span>
              <MathPreviewText
                content={question.question}
                contentSource="preview"
                className="block text-[14px] leading-relaxed text-slate-900"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              draggable
              onDragStart={onDragHandleStart}
              onDragEnd={onDragHandleEnd}
              className="cursor-grab rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
              aria-label="Асуултын байрлал өөрчлөх"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Дээш зөөх"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Доош зөөх"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Устгах"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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
  const [importedDocument, setImportedDocument] =
    useState<ImportedDocument | null>(null);
  const [importReviewDialogOpen, setImportReviewDialogOpen] = useState(false);
  const [isExtractingImport, setIsExtractingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [sharedLibraryDialogOpen, setSharedLibraryDialogOpen] = useState(false);
  const [textbookDialogOpen, setTextbookDialogOpen] = useState(false);
  const [textbookDetailDialogOpen, setTextbookDetailDialogOpen] =
    useState(false);
  const [textbookQuestionDialogOpen, setTextbookQuestionDialogOpen] =
    useState(false);
  const [textbookCards, setTextbookCards] = useState<
    PersistedImportedTextbookCard[]
  >([]);
  const [textbookR2Candidates, setTextbookR2Candidates] = useState<
    R2TextbookCandidate[]
  >([]);
  const [textbookR2Error, setTextbookR2Error] = useState("");
  const [textbookR2Loading, setTextbookR2Loading] = useState(false);
  const [selectedTextbookId, setSelectedTextbookId] = useState<string | null>(
    null,
  );
  const [selectedTextbookQuestionIds, setSelectedTextbookQuestionIds] =
    useState<string[]>([]);
  const [queuedTextbookImport, setQueuedTextbookImport] =
    useState<QueuedTextbookImport | null>(null);
  const [textbookGeneratedState, setTextbookGeneratedState] =
    useState<TextbookGeneratedState | null>(null);
  const manualQuestionPanelRef = useRef<QuestionBankPanelHandle | null>(null);
  const textbookUploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastGeneratedTextbookStateRef = useRef("");
  const [dragTargetQuestionId, setDragTargetQuestionId] = useState<
    string | null
  >(null);
  const textbookSubject = useMemo(
    () => normalizeTextbookSubject(generalInfo.subject),
    [generalInfo.subject],
  );
  const textbookGrade = useMemo(
    () => normalizeTextbookGrade(generalInfo.grade),
    [generalInfo.grade],
  );
  const textbookExpectedR2FileName = useMemo(
    () =>
      textbookSubject && textbookGrade
        ? getExpectedR2FileName(textbookGrade, textbookSubject)
        : "",
    [textbookGrade, textbookSubject],
  );
  const textbookPreviewQuestions = useMemo(
    () =>
      textbookGeneratedState
        ? mapGeneratedTextbookTestToPreviewQuestions({
            bookTitle: textbookGeneratedState.bookTitle,
            generatedTest: textbookGeneratedState.generatedTest,
          })
        : [],
    [textbookGeneratedState],
  );
  const textbookLibraryItems = useMemo<TextbookLibraryGridItem[]>(() => {
    const savedItems = textbookCards.map((card) => ({
      card,
      createdAt: card.createdAt,
      fileName: card.fileName,
      id: card.id,
      kind: "saved" as const,
      title: getTextbookCardTitle(card),
    }));
    const r2Items = textbookR2Candidates
      .filter((candidate) => {
        const uploadedAsset = createUploadedAssetFromR2Candidate(candidate);
        return !findTextbookCardByAsset(textbookCards, uploadedAsset);
      })
      .map((candidate) => ({
        candidate,
        createdAt: candidate.lastModified,
        fileName: candidate.fileName,
        id: `${candidate.bucketName}:${candidate.key}`,
        kind: "r2" as const,
        title: getTextbookFileTitle(candidate.fileName),
      }));

    return [...savedItems, ...r2Items].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt
        ? new Date(right.createdAt).getTime()
        : 0;
      return rightTime - leftTime;
    });
  }, [textbookCards, textbookR2Candidates]);
  const sourceCounts = useMemo(
    () => ({
      "question-bank": previewQuestions.filter(
        (question) =>
          resolvePreviewQuestionSourceType(question) === "question-bank",
      ).length,
      textbook: previewQuestions.filter(
        (question) => resolvePreviewQuestionSourceType(question) === "textbook",
      ).length,
      import: previewQuestions.filter(
        (question) => resolvePreviewQuestionSourceType(question) === "import",
      ).length,
      "shared-library": previewQuestions.filter(
        (question) =>
          resolvePreviewQuestionSourceType(question) === "shared-library",
      ).length,
    }),
    [previewQuestions],
  );

  useEffect(() => {
    if (!textbookDialogOpen) {
      return;
    }

    setTextbookCards((current) =>
      current.length > 0 ? current : loadPersistedImportedTextbookCards(),
    );
  }, [textbookDialogOpen]);

  useEffect(() => {
    if (!textbookDialogOpen) {
      return;
    }

    if (!textbookSubject || !textbookGrade) {
      setTextbookR2Candidates([]);
      setTextbookR2Error("");
      setTextbookR2Loading(false);
      return;
    }

    let cancelled = false;
    setTextbookR2Loading(true);
    setTextbookR2Error("");

    void (async () => {
      try {
        const payload = await fetchR2TextbookCandidates(
          textbookGrade,
          textbookSubject,
        );
        if (cancelled) {
          return;
        }

        setTextbookR2Candidates(payload.items);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setTextbookR2Candidates([]);
        setTextbookR2Error(
          error instanceof Error
            ? error.message
            : "R2-оос сурах бичгийн жагсаалт татаж чадсангүй.",
        );
      } finally {
        if (!cancelled) {
          setTextbookR2Loading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [textbookDialogOpen, textbookGrade, textbookSubject]);

  useEffect(() => {
    setSelectedTextbookQuestionIds(
      textbookPreviewQuestions.map((question) => question.id),
    );
  }, [textbookPreviewQuestions]);

  function appendImportedQuestions(questions: ImportedQuestion[]) {
    onPreviewQuestionsChange(
      reindexQuestions([
        ...previewQuestions,
        ...questions.map((question, index) => ({
          ...question,
          id: `import-${Date.now()}-${index + 1}`,
          index: 0,
        })),
      ]),
    );
  }

  function handleToggleImportedQuestion(id: string, checked: boolean) {
    setImportedDocument((current) => {
      if (!current) {
        return current;
      }

      const selectedIds = checked
        ? Array.from(new Set([...current.selectedIds, id]))
        : current.selectedIds.filter((item) => item !== id);

      return {
        ...current,
        selectedIds,
      };
    });
  }

  function handleUpdateImportedQuestion(
    questionId: string,
    updater: (question: ImportedQuestion) => ImportedQuestion,
  ) {
    setImportedDocument((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.map((question) =>
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

    if (
      !question ||
      question.questionType === "written" ||
      question.answers.length <= 2
    ) {
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
      if (question.questionType === "written") {
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

  function handleClearImportedDocument() {
    setImportedDocument(null);
    setImportReviewDialogOpen(false);
    setImportError(null);
  }

  async function handleSelectImportFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const invalidFiles = files.filter((file) => !isDocImportFile(file));

    if (invalidFiles.length > 0) {
      const message =
        "Одоогоор import дээр зөвхөн DOC эсвэл DOCX файл оруулна.";
      setImportError(message);
      setImportedDocument(null);
      setImportReviewDialogOpen(false);
      toast.error(message);
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
      setImportReviewDialogOpen(true);
      onSourceChange("import");
      toast.success(`${fileLabel}-с ${questions.length} асуулт уншлаа.`);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Файлаас асуулт уншихад алдаа гарлаа.";

      setImportedDocument(null);
      setImportReviewDialogOpen(false);
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

    appendImportedQuestions(importedDocument.questions);
    toast.success(`${importedDocument.questions.length} асуулт нэмэгдлээ.`);
    setImportedDocument(null);
    setImportReviewDialogOpen(false);
    setImportError(null);
    setFileDialogOpen(false);
    onSourceChange("import");
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

    appendImportedQuestions(selectedQuestions);
    toast.success(`${selectedQuestions.length} асуулт нэмэгдлээ.`);
    setImportedDocument(null);
    setImportReviewDialogOpen(false);
    setImportError(null);
    setFileDialogOpen(false);
    onSourceChange("import");
  }

  useEffect(() => {
    if (!textbookGeneratedState) {
      lastGeneratedTextbookStateRef.current = "";
      return;
    }

    if (!textbookDetailDialogOpen || textbookPreviewQuestions.length === 0) {
      return;
    }

    const generationKey = JSON.stringify({
      bookTitle: textbookGeneratedState.bookTitle,
      materialId: textbookGeneratedState.materialId || "",
      openQuestionCount:
        textbookGeneratedState.generatedTest.openQuestionCountGenerated,
      questionCount:
        textbookGeneratedState.generatedTest.questionCountGenerated,
      selectedSectionIds: textbookGeneratedState.selectedSectionIds,
    });

    if (lastGeneratedTextbookStateRef.current === generationKey) {
      return;
    }

    lastGeneratedTextbookStateRef.current = generationKey;
    setTextbookQuestionDialogOpen(true);
  }, [
    textbookDetailDialogOpen,
    textbookGeneratedState,
    textbookPreviewQuestions.length,
  ]);

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

    if (nextSource === "textbook") {
      setTextbookDialogOpen(true);
      return;
    }

    if (nextSource === "shared-library") {
      setSharedLibraryDialogOpen(true);
    }
  }

  function handleAddTextbook() {
    textbookUploadInputRef.current?.click();
  }

  function handleTextbookFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const importId = createTextbookImportId();
    const title = file.name.replace(/\.[^.]+$/, "").trim() || "Сурах бичиг";
    const nextCard: PersistedImportedTextbookCard = {
      createdAt: new Date().toISOString(),
      fileName: file.name,
      id: importId,
      materialStage: "uploading",
      materialStatus: "uploaded",
      title,
      uploadedAsset: null,
    };

    setTextbookCards((current) => [nextCard, ...current]);
    setSelectedTextbookId(importId);
    setQueuedTextbookImport({
      file,
      fileName: file.name,
      id: importId,
      title,
    });
    setTextbookGeneratedState(null);
    setTextbookDetailDialogOpen(true);
    event.currentTarget.value = "";
  }

  function handleOpenTextbookDetail(cardId: string) {
    const card = textbookCards.find((item) => item.id === cardId) ?? null;
    if (!card) {
      return;
    }

    setSelectedTextbookId(cardId);
    setQueuedTextbookImport({
      fileName: card.fileName,
      id: card.id,
      materialId: card.materialId ?? null,
      title: getTextbookCardTitle(card),
      uploadedAsset: card.uploadedAsset ?? null,
    });
    setTextbookGeneratedState(null);
    setTextbookDetailDialogOpen(true);
  }

  function handleOpenTextbookR2Candidate(candidate: R2TextbookCandidate) {
    const uploadedAsset = createUploadedAssetFromR2Candidate(candidate);
    const existingCard = findTextbookCardByAsset(textbookCards, uploadedAsset);
    const importId =
      existingCard?.id ||
      createTextbookImportIdFromUploadedAsset(uploadedAsset);
    const nextCard: PersistedImportedTextbookCard = {
      createdAt:
        existingCard?.createdAt ||
        uploadedAsset.uploadedAt ||
        new Date().toISOString(),
      fileName: candidate.fileName,
      id: importId,
      materialId: existingCard?.materialId ?? null,
      materialStage: existingCard?.materialStage ?? null,
      materialStatus: existingCard?.materialStatus ?? "idle",
      pageCount: existingCard?.pageCount ?? 0,
      sectionCount: existingCard?.sectionCount ?? 0,
      subchapterCount: existingCard?.subchapterCount ?? 0,
      title: existingCard?.title || getTextbookFileTitle(candidate.fileName),
      uploadedAsset,
    };

    setTextbookCards((current) => upsertTextbookCard(current, nextCard));
    setSelectedTextbookId(importId);
    setQueuedTextbookImport({
      fileName: candidate.fileName,
      id: importId,
      materialId: existingCard?.materialId ?? null,
      title: nextCard.title,
      uploadedAsset,
    });
    setTextbookGeneratedState(null);
    setTextbookDetailDialogOpen(true);
  }

  function handleTextbookMaterialStateChange(next: {
    importId: string;
    material: TextbookMaterial | null;
    uploadedAsset: TextbookUploadedAsset | null;
  }) {
    setTextbookCards((current) => {
      const existing =
        current.find((card) => card.id === next.importId) ?? null;
      const updatedCard: PersistedImportedTextbookCard = {
        createdAt:
          existing?.createdAt ||
          next.uploadedAsset?.uploadedAt ||
          new Date().toISOString(),
        errorMessage:
          next.material?.errorMessage ?? existing?.errorMessage ?? null,
        fileName:
          next.material?.fileName?.trim() ||
          next.uploadedAsset?.fileName ||
          existing?.fileName ||
          queuedTextbookImport?.fileName ||
          "textbook.pdf",
        id: next.importId,
        materialId: next.material?.id ?? existing?.materialId ?? null,
        materialStage: next.material?.stage ?? existing?.materialStage ?? null,
        materialStatus:
          next.material?.status ?? existing?.materialStatus ?? "uploaded",
        pageCount: next.material?.pageCount ?? existing?.pageCount ?? 0,
        sectionCount:
          next.material?.sectionCount ?? existing?.sectionCount ?? 0,
        subchapterCount:
          next.material?.subchapterCount ?? existing?.subchapterCount ?? 0,
        title:
          next.material?.title?.trim() ||
          existing?.title ||
          queuedTextbookImport?.title ||
          "Сурах бичиг",
        uploadedAsset: next.uploadedAsset ?? existing?.uploadedAsset ?? null,
      };

      const nextCards = upsertTextbookCard(current, updatedCard);

      persistImportedTextbookCards(nextCards);
      return nextCards;
    });
  }

  function handleToggleTextbookQuestion(questionId: string, checked: boolean) {
    setSelectedTextbookQuestionIds((current) =>
      checked
        ? current.includes(questionId)
          ? current
          : [...current, questionId]
        : current.filter((id) => id !== questionId),
    );
  }

  function handleSaveTextbookQuestions() {
    const questionsToAppend = textbookPreviewQuestions.filter((question) =>
      selectedTextbookQuestionIds.includes(question.id),
    );

    if (questionsToAppend.length === 0) {
      toast.error("Нэмэх асуултаа сонгоно уу.");
      return;
    }

    onPreviewQuestionsChange(
      mergeTextbookQuestionsIntoPreview({
        idPrefix: `textbook-${Date.now()}`,
        previewQuestions,
        textbookQuestions: questionsToAppend,
      }),
    );
    setTextbookQuestionDialogOpen(false);
    setTextbookDetailDialogOpen(false);
    setTextbookGeneratedState(null);
    onSourceChange("textbook");
    toast.success(`${questionsToAppend.length} асуулт шалгалтад нэмэгдлээ.`);
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

  async function handleDeleteQuestion(questionId: string) {
    if (
      !(await confirmDeleteAction(
        "Энэ асуултыг",
        "Шалгалтын асуултын жагсаалтаас хасагдана.",
      ))
    ) {
      return;
    }

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
      <input
        ref={textbookUploadInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleTextbookFileSelected}
      />
      <div className="grid gap-5 xl:grid-cols-[206px_minmax(0,1fr)]">
        <div className="w-full rounded-[20px] bg-[#f4f7fb] p-3 xl:max-w-[196px]">
          <div className="mb-5">
            <h2 className="text-[15px] mt-3 font-bold tracking-tight text-slate-900">
              Асуулт нэмэх
            </h2>
          </div>

          <WorkspaceTabs source={source} onSourceChange={handleSourceSelect} />
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
              <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[14px] font-semibold text-emerald-700">
                <BookOpen className="h-4 w-4" />
                {sourceCounts.textbook}
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
                  <p>Зүүн талын аргуудын аль нэгийг ашиглан асуулт нэмнэ үү.</p>
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
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manualQuestionPanelRef.current?.fillDemo()}
                  className="h-auto border-0 bg-transparent px-1 py-0 text-[10px] font-medium tracking-[0.01em] text-slate-300 opacity-70 shadow-none transition hover:bg-transparent hover:text-slate-500 hover:opacity-100"
                >
                  Demo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manualQuestionPanelRef.current?.fillAiDemo()}
                  className="h-auto border-0 bg-transparent px-1 py-0 text-[10px] font-medium tracking-[0.01em] text-slate-300 opacity-70 shadow-none transition hover:bg-transparent hover:text-slate-500 hover:opacity-100"
                >
                  Demo-AI
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => manualQuestionPanelRef.current?.reset()}
                  className="h-auto border-0 bg-transparent px-1 py-0 text-[10px] font-medium tracking-[0.01em] text-slate-300 opacity-70 shadow-none transition hover:bg-transparent hover:text-slate-500 hover:opacity-100"
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

      <Dialog
        open={fileDialogOpen}
        onOpenChange={(open) => {
          setFileDialogOpen(open);
          if (!open) {
            setImportReviewDialogOpen(false);
          }
        }}
      >
        <DialogContent className="w-[min(100vw-1.5rem,38rem)]! max-w-none! gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0 shadow-[0_26px_72px_-30px_rgba(15,23,42,0.26)]">
          <DialogHeader className="border-b border-[#e6edf7] px-5 py-4">
            <DialogTitle className="text-[20px] font-semibold text-slate-900">
              Файлаас асуулт оруулах
            </DialogTitle>
          </DialogHeader>
          <div className="bg-white px-5 py-5">
            <FilePanel
              importedDocument={importedDocument}
              importError={importError}
              isExtracting={isExtractingImport}
              onClear={handleClearImportedDocument}
              onOpenReview={() => setImportReviewDialogOpen(true)}
              onSelectFiles={handleSelectImportFiles}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importReviewDialogOpen}
        onOpenChange={setImportReviewDialogOpen}
      >
        <DialogContent className="max-w-4xl gap-0 overflow-hidden rounded-[28px] border border-[#dbe4f3] bg-white p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[#e6edf7] px-5 py-5 sm:px-6">
            <div className="pr-10">
              <DialogTitle className="text-[20px] font-semibold text-slate-900">
                {importedDocument?.fileName ?? "Import review"}
              </DialogTitle>
              <p className="mt-1 text-[14px] text-slate-500">
                Танигдсан асуултуудаа эндээс шалгаад сонгон нэмнэ үү.
              </p>
            </div>
          </DialogHeader>

          {importedDocument ? (
            <>
              <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
                {importedDocument.questions.map((question, index) => {
                  const checked = importedDocument.selectedIds.includes(
                    question.id,
                  );

                  return (
                    <div
                      key={question.id}
                      className="rounded-[16px] border border-[#dbe4f3] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(15,23,42,0.03)]"
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            handleToggleImportedQuestion(
                              question.id,
                              next === true,
                            )
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
                                  handleUpdateImportedQuestion(
                                    question.id,
                                    (current) => ({
                                      ...current,
                                      question: value,
                                    }),
                                  )
                                }
                                placeholder="Асуултын текст"
                              />
                            </div>
                            <span className="rounded-full bg-[#f2f6fb] px-2 py-1 text-[11px] font-semibold text-slate-600">
                              #{index + 1}
                            </span>
                          </div>

                          {question.questionType === "written" ? (
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Хариултын чиглэл
                                </p>
                                <MathAssistField
                                  value={question.answers[0] ?? ""}
                                  multiline
                                  onChange={(value) =>
                                    handleUpdateImportedQuestion(
                                      question.id,
                                      (current) => ({
                                        ...current,
                                        answers: [value],
                                      }),
                                    )
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
                                    handleUpdateImportedQuestion(
                                      question.id,
                                      (current) => ({
                                        ...current,
                                        explanation: value,
                                      }),
                                    )
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
                                      handleSetImportedCorrectAnswer(
                                        question.id,
                                        answerIndex,
                                      )
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
                                        handleUpdateImportedQuestion(
                                          question.id,
                                          (current) => ({
                                            ...current,
                                            answers: current.answers.map(
                                              (item, itemIndex) =>
                                                itemIndex === answerIndex
                                                  ? value
                                                  : item,
                                            ),
                                          }),
                                        )
                                      }
                                      placeholder={`Сонголт ${String.fromCharCode(65 + answerIndex)}`}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveImportedAnswer(
                                        question.id,
                                        answerIndex,
                                      )
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
                                  Зөв хариултыг зүүн талын үсгэн товчоор
                                  сонгоно.
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-[10px] border-[#dbe4f3] bg-white"
                                  onClick={() =>
                                    handleAddImportedAnswer(question.id)
                                  }
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
                                    handleUpdateImportedQuestion(
                                      question.id,
                                      (current) => ({
                                        ...current,
                                        explanation: value,
                                      }),
                                    )
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
                  onClick={handleClearImportedDocument}
                >
                  <X className="h-4 w-4" />
                  Цуцлах
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-[12px] bg-[#0b5cab] text-white hover:bg-[#0a4f96]"
                  onClick={handleAddSelectedImportedQuestions}
                  disabled={importedDocument.selectedIds.length === 0}
                >
                  <Check className="h-4 w-4" />
                  {importedDocument.selectedIds.length} асуулт нэмэх
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-[12px] border-[#dbe4f3] bg-white"
                  onClick={handleAddAllImportedQuestions}
                  disabled={importedDocument.questions.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Бүгдийг нэмэх
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={textbookDialogOpen}
        onOpenChange={(open) => {
          setTextbookDialogOpen(open);
          if (!open) {
            setTextbookDetailDialogOpen(false);
            setQueuedTextbookImport(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            "max-w-none! gap-0 overflow-hidden rounded-[28px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]",
            textbookDetailDialogOpen
              ? "w-[min(100vw-1.5rem,86rem)]!"
              : "w-[min(100vw-1.5rem,52rem)]!",
          )}
        >
          {textbookDetailDialogOpen ? (
            <div className="max-h-[min(86vh,46rem)] overflow-y-auto px-6 py-6">
              {!textbookSubject || !textbookGrade ? (
                <div className="rounded-[20px] border border-dashed border-[#dbe4f3] bg-[#fcfdff] px-6 py-10 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-4 text-[18px] font-semibold text-slate-900">
                    Эхлээд анги, хичээлээ сонгоно уу
                  </p>
                  <p className="mx-auto mt-2 max-w-[34rem] text-[14px] leading-6 text-slate-500">
                    Сурах бичгийн PDF-г зөв ангилж, зөв бүтэцтэй ачаалахын тулд
                    `Ерөнхий мэдээлэл` хэсэгт анги болон хичээлийн төрлийг
                    бөглөсний дараа энэ урсгал ажиллана.
                  </p>
                </div>
              ) : (
                <TextbookSection
                  activeImportId={selectedTextbookId}
                  embedded
                  grade={textbookGrade}
                  hideImportTools
                  onGeneratedStateChange={setTextbookGeneratedState}
                  onMaterialStateChange={handleTextbookMaterialStateChange}
                  onQueuedImportConsumed={(importId) => {
                    if (queuedTextbookImport?.id === importId) {
                      setQueuedTextbookImport(null);
                    }
                  }}
                  queuedImport={queuedTextbookImport}
                  subject={textbookSubject}
                />
              )}
            </div>
          ) : (
            <>
              <DialogHeader className="border-b border-[#e6edf7] px-7 py-5">
                <DialogTitle className="text-[20px] font-semibold text-slate-900">
                  Сурах бичиг
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[min(82vh,48rem)] overflow-y-auto px-6 py-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[15px] font-medium text-slate-900">
                      Миний сурах бичгүүд
                    </p>
                    <Button
                      type="button"
                      onClick={handleAddTextbook}
                      disabled={!textbookSubject || !textbookGrade}
                      className="h-12 rounded-[12px] bg-[#0B5CAB] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(11,92,171,0.22)] hover:bg-[#0a4f96] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Сурах бичиг нэмэх
                    </Button>
                  </div>

                  {!textbookSubject || !textbookGrade ? (
                    <div className="rounded-[18px] border border-dashed border-[#dbe4f3] bg-[#f8fbff] px-5 py-5 text-[14px] leading-6 text-slate-500">
                      Сурах бичгийн логик ашиглахын өмнө `Ерөнхий мэдээлэл`
                      хэсэгт анги болон хичээлээ бөглөнө үү.
                    </div>
                  ) : textbookLibraryItems.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-[#dbe4f3] bg-[#fcfdff] px-6 py-10 text-center">
                      <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
                      <p className="mt-4 text-[18px] font-semibold text-slate-900">
                        Сурах бичиг алга байна
                      </p>
                      <p className="mx-auto mt-2 max-w-[34rem] text-[14px] leading-6 text-slate-500">
                        {textbookR2Loading
                          ? "Сурах бичгийн санг ачаалж байна..."
                          : textbookR2Error
                            ? textbookR2Error
                            : `Шинэ PDF нэмж болно. Хүлээгдэж буй файл: ${textbookExpectedR2FileName}`}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {textbookLibraryItems.map((item) => {
                        const theme = getTextbookCardCoverTheme(
                          `${item.id}:${item.title}`,
                        );
                        const coverSubject = getTextbookCoverSubjectLabel(
                          `${item.title} ${item.fileName}`,
                          textbookSubject,
                        );
                        const coverGrade =
                          getTextbookCoverGradeLabel(textbookGrade);
                        const displayTitle = getTextbookDisplayTitle(
                          item.title,
                          textbookSubject,
                          textbookGrade,
                        );

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.kind === "saved") {
                                handleOpenTextbookDetail(item.card.id);
                                return;
                              }

                              handleOpenTextbookR2Candidate(item.candidate);
                            }}
                            className="overflow-hidden rounded-[18px] border border-[#dfe5ee] bg-white text-left shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,23,42,0.08)]"
                          >
                            <div
                              className="relative h-[144px] overflow-hidden"
                              style={theme}
                            >
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,23,42,0.08))]" />
                              <div className="absolute -left-8 bottom-0 h-20 w-44 rounded-[999px] bg-white/16" />
                              <div className="absolute -right-8 top-3 h-24 w-40 rounded-[999px] bg-white/12" />
                              <div className="absolute inset-x-0 top-6 px-5 text-center text-white [text-shadow:0_2px_8px_rgba(15,23,42,0.35)]">
                                <p className="text-[15px] font-semibold tracking-[0.08em]">
                                  {coverSubject}
                                </p>
                                {coverGrade ? (
                                  <p className="mt-1 text-[16px] font-semibold">
                                    {coverGrade}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="px-5 py-4">
                              <p className="truncate text-[16px] font-semibold text-slate-900">
                                {displayTitle}
                              </p>
                              <p className="mt-1 text-[13px] text-slate-500">
                                Үүсгэсэн:{" "}
                                {formatTextbookUpdatedAt(item.createdAt) || "-"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={textbookQuestionDialogOpen}
        onOpenChange={setTextbookQuestionDialogOpen}
      >
        <DialogContent className="flex h-[min(92vh,56rem)] w-[min(100vw-1.5rem,66rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[28px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
          <DialogHeader className="border-b border-[#e6edf7] px-5 py-4">
            <DialogTitle className="text-[18px] font-semibold text-slate-900">
              {textbookGeneratedState?.bookTitle || "Сурах бичгийн асуултууд"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[16px] font-medium text-slate-900">
                Нэмэх асуултуудаа сонгоно уу.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setSelectedTextbookQuestionIds(
                      textbookPreviewQuestions.map((question) => question.id),
                    )
                  }
                  className="rounded-[12px] border-[#0b5cab] bg-white px-4 text-[#0b5cab] hover:bg-[#f7faff]"
                >
                  Бүгдийг сонгох
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTextbookQuestionIds([])}
                  className="rounded-[12px] border-[#dbe4f3] bg-white px-4 text-slate-700 hover:bg-slate-50"
                >
                  Цэвэрлэх
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-5">
              {textbookPreviewQuestions.map((question, index) => {
                const isSelected = selectedTextbookQuestionIds.includes(
                  question.id,
                );
                const isWrittenQuestion = question.questionType === "written";

                return (
                  <div
                    key={question.id}
                    className="rounded-[22px] border border-[#dfe7f3] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleToggleTextbookQuestion(
                              question.id,
                              checked === true,
                            )
                          }
                        />
                        <span>Асуулт {index + 1}</span>
                      </label>
                      <Badge className="rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                        {question.points} оноо
                      </Badge>
                    </div>

                    <div className="mt-4 rounded-[14px] bg-[#f3f6fb] px-4 py-3 text-[16px] text-slate-900">
                      <MathPreviewText
                        content={question.question}
                        contentSource="preview"
                        className="text-[15px] leading-relaxed text-slate-900"
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      {isWrittenQuestion ? (
                        <div className="rounded-[12px] border border-[#b6e2ca] bg-[#eefaf4] px-3 py-3 text-[15px] text-[#245d44]">
                          <MathPreviewText
                            content={question.answers[0] ?? "-"}
                            contentSource="preview"
                            className="text-[14px] leading-relaxed"
                          />
                        </div>
                      ) : (
                        question.answers.map((answer, optionIndex) => {
                          const isCorrect = optionIndex === question.correct;

                          return (
                            <div
                              key={`${question.id}-option-${optionIndex}`}
                              className={cn(
                                "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-[12px] border px-3 py-3 text-[15px]",
                                isCorrect
                                  ? "border-[#b6e2ca] bg-[#eefaf4] text-[#245d44]"
                                  : "border-[#dfe7f3] bg-white text-slate-700",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full border",
                                  isCorrect
                                    ? "border-[#0b5cab] bg-[#e8f1ff]"
                                    : "border-[#d7dfec] bg-white",
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-full",
                                    isCorrect
                                      ? "bg-[#0b5cab]"
                                      : "bg-transparent",
                                  )}
                                />
                              </div>
                              <MathPreviewText
                                content={answer}
                                contentSource="preview"
                                className="text-[14px] leading-relaxed text-inherit"
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="border-t border-[#e6edf7] px-5 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTextbookQuestionDialogOpen(false)}
              className="rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
            >
              Хаах
            </Button>
            <Button
              type="button"
              onClick={handleSaveTextbookQuestions}
              disabled={selectedTextbookQuestionIds.length === 0}
              className="rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96]"
            >
              Хадгалах
            </Button>
          </DialogFooter>
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
