"use client";

import { useLazyQuery, useMutation } from "@apollo/client/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MathAssistField } from "@/components/exam/math-exam-assist-field";
import MathPreviewText from "@/components/math-preview-text";
import { normalizeBackendMathText } from "@/lib/normalize-math-text";
import {
  ConfirmExamVariantsDocument,
  GetExamVariantJobDocument,
  GetNewMathExamDocument,
  SaveNewMathExamDocument,
} from "@/gql/create-exam-documents";
import {
  MathExamQuestionType,
  type SaveNewMathExamInput,
  type SaveNewMathExamPayload,
} from "@/gql/graphql";
import { Button } from "@/components/ui/button";
import { TestShell } from "../../_components/test-shell";
import type { BreadcrumbItem } from "../../_components/test-header-bar";
import {
  GeneralInfoSection,
  type MaterialBuilderExamType,
  type MaterialBuilderGeneralInfo,
} from "./general-info-section";
import {
  ImportSection,
  type ImportedTextbookCard,
} from "./import-section";
import {
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "./material-builder-config";
import { QuestionBankSection } from "./question-bank-section";
import { SharedLibrarySection } from "./shared-library-section";
import { SourceSelector } from "./source-selector";
import { TextbookLibrarySection } from "./textbook-library-section";
import {
  TextbookSection,
  type TextbookGeneratedState,
} from "./textbook-section";
import type {
  TextbookMaterial,
  TextbookUploadedAsset,
} from "@/features/textbook-processing/types";
import { buildUploadedAssetFromMaterial } from "@/features/textbook-processing/material-asset";
import {
  loadPersistedImportedTextbookCards,
  persistImportedTextbookCards,
} from "@/features/textbook-processing/persisted-material-cache";
import { useTextbookMaterialLibrary } from "@/features/textbook-processing/use-textbook-material-library";

type GeneratedVariant = {
  id: string;
  variantNumber: number;
  title: string;
  status?: string | null;
  confirmedAt?: string | null;
  savedAt?: string | null;
  savedExamId?: string | null;
  questions: Array<{
    id: string;
    position: number;
    type: string;
    prompt: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    explanation?: string | null;
  }>;
};

type ExistingExamQuestion = {
  answerLatex?: string | null;
  correctOption?: number | null;
  id: string;
  options?: string[] | null;
  points?: number | null;
  prompt: string;
  responseGuide?: string | null;
  type: string;
};

type ExistingExam = {
  examId: string;
  questions: ExistingExamQuestion[];
  sessionMeta?: {
    durationMinutes?: number | null;
    examType?: string | null;
    grade?: number | null;
    groupClass?: string | null;
    subject?: string | null;
    variantCount?: number | null;
    withVariants?: boolean | null;
  } | null;
  title: string;
};

const defaultGeneralInfo: GeneralInfoValues = {
  subject: "",
  grade: "",
  examType: "",
  examName: "",
  examType: "progress",
  grade: 10,
  subject: "math",
};

function stripChoicePrefix(value: string) {
  return String(value || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:\-–]|\s+)\s*/iu, "")
    .trim();
}

function toSessionExamType(value: MaterialBuilderExamType) {
  switch (value) {
    case "midterm":
      return "term";
    case "final":
      return "year_final";
    default:
      return value;
  }
}

function getDifficultySummary(state: TextbookGeneratedState) {
  const activeEntries = Object.entries(
    state.generatedTest.difficultyCountsApplied,
  ).filter(([, count]) => Number(count) > 0);

  if (activeEntries.length !== 1) {
    return "mixed";
  }

  return activeEntries[0]?.[0] || "mixed";
}

function getCorrectOptionIndex(correctAnswer: string, optionCount: number) {
  const normalized = String(correctAnswer || "").trim().toUpperCase();
  const index = ["A", "B", "C", "D"].indexOf(normalized);

  return index >= 0 && index < optionCount ? index : undefined;
}

function normalizePoints(value: number) {
  const parsed = Math.trunc(Number(value) || 0);
  return parsed >= 1 ? parsed : 1;
}

function buildResponseGuide(answer: string, sourceExcerpt: string) {
  const parts = [
    sourceExcerpt.trim() ? `Эх сурвалж: ${sourceExcerpt.trim()}` : "",
    answer.trim() ? `Зөв хариу: ${answer.trim()}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join("\n") : undefined;
}

function buildTextbookSaveInput(
  generalInfo: MaterialBuilderGeneralInfo,
  textbookState: TextbookGeneratedState,
  examId: string | null,
): SaveNewMathExamInput {
  const mcqQuestions = textbookState.generatedTest.questions.map((question) => {
    const options = question.choices.map((choice) => {
      const stripped = stripChoicePrefix(choice);
      return stripped || choice.trim();
    });

    return {
      type: MathExamQuestionType.Mcq,
      prompt:
        question.bookProblem.trim() ||
        question.question.trim() ||
        "Сонголтот асуулт",
      points: normalizePoints(question.points),
      options,
      correctOption: getCorrectOptionIndex(
        question.correctAnswer,
        options.length,
      ),
    };
  });

function buildBaseExamInput(args: {
  examId?: string;
  generalInfo: GeneralInfoValues;
  previewQuestions: PreviewQuestion[];
  hasGeneratedVariants: boolean;
  generatedVariantsCount: number;
}) {
  const mcqQuestions = args.previewQuestions.filter(
    (question) => question.questionType !== "written",
  );
  const topics = textbookState.selectedSectionTitles.filter((title) =>
    title.trim().length > 0,
  );
  const r2Path = `${textbookState.uploadedAsset.bucketName}/${textbookState.uploadedAsset.key}`;
  const pageSummary = textbookState.generatedTest.sourcePages.length
    ? `pages: ${textbookState.generatedTest.sourcePages.join(", ")}`
    : "";
  const sourceContext = [
    textbookState.bookTitle.trim(),
    textbookState.fileName.trim(),
    `r2: ${r2Path}`,
    pageSummary,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    examId: examId || undefined,
    title:
      generalInfo.examName.trim() || `${textbookState.bookTitle.trim()} шалгалт`,
    mcqCount: mcqQuestions.length,
    mathCount: mathQuestions.length,
    totalPoints,
    generator: {
      difficulty: getDifficultySummary(textbookState),
      topics: topics.join(", ") || undefined,
      sourceContext: sourceContext || undefined,
    },
    sessionMeta: {
      grade: generalInfo.grade,
      examType: toSessionExamType(generalInfo.examType),
      subject: generalInfo.subject,
      topics: topics.length ? topics : undefined,
      durationMinutes: generalInfo.durationMinutes,
      description: `R2 asset: ${r2Path}`,
    },
    questions,
  };
}

function syncImportedTextbookCard(
  current: ImportedTextbookCard,
  next: {
    material: TextbookMaterial | null;
    uploadedAsset: TextbookUploadedAsset | null;
  },
) {
  const { material, uploadedAsset } = next;

  return {
    ...current,
    title: material?.title?.trim() || current.title,
    fileName: material?.fileName || uploadedAsset?.fileName || current.fileName,
    materialId: material?.id || current.materialId || null,
    materialStage: material?.stage || current.materialStage || null,
    materialStatus: material?.status || current.materialStatus || "idle",
    pageCount: material?.pageCount ?? current.pageCount ?? 0,
    sectionCount: material?.sectionCount ?? current.sectionCount ?? 0,
    subchapterCount: material?.subchapterCount ?? current.subchapterCount ?? 0,
    errorMessage: material?.errorMessage ?? null,
    uploadedAsset: uploadedAsset || current.uploadedAsset || null,
  } satisfies ImportedTextbookCard;
}

function hasImportedTextbookCardChanged(
  current: ImportedTextbookCard,
  next: ImportedTextbookCard,
) {
  return (
    current.title !== next.title ||
    current.fileName !== next.fileName ||
    current.materialId !== next.materialId ||
    current.materialStage !== next.materialStage ||
    current.materialStatus !== next.materialStatus ||
    current.pageCount !== next.pageCount ||
    current.sectionCount !== next.sectionCount ||
    current.subchapterCount !== next.subchapterCount ||
    current.errorMessage !== next.errorMessage ||
    current.uploadedAsset?.bucketName !== next.uploadedAsset?.bucketName ||
    current.uploadedAsset?.key !== next.uploadedAsset?.key ||
    current.uploadedAsset?.fileName !== next.uploadedAsset?.fileName ||
    current.uploadedAsset?.size !== next.uploadedAsset?.size ||
    current.uploadedAsset?.uploadedAt !== next.uploadedAsset?.uploadedAt ||
    current.uploadedAsset?.contentType !== next.uploadedAsset?.contentType
  );
}

function createLibraryTextbookCard(material: TextbookMaterial): ImportedTextbookCard {
  return {
    createdAt: material.createdAt,
    errorMessage: material.errorMessage ?? null,
    file: null,
    fileName: material.fileName,
    id: material.id,
    materialId: material.id,
    materialStage: material.stage,
    materialStatus: material.status,
    pageCount: material.pageCount,
    sectionCount: material.sectionCount,
    subchapterCount: material.subchapterCount,
    title:
      material.title?.trim() || material.fileName.replace(/\.pdf$/i, "") || material.fileName,
    uploadedAsset: buildUploadedAssetFromMaterial(material),
  };
}

function importedTextbookMatchesMaterial(
  item: ImportedTextbookCard,
  material: TextbookMaterial,
) {
  return (
    item.materialId === material.id ||
    (item.uploadedAsset?.bucketName === material.bucketName &&
      item.uploadedAsset?.key === material.r2Key)
  );
}

function mergeTextbookLibraryItems(
  importedTextbooks: ImportedTextbookCard[],
  materials: TextbookMaterial[],
) {
  const matchedSessionIds = new Set<string>();
  const persistedItems = materials.map((material) => {
    const matchingSessionItem =
      importedTextbooks.find((item) => importedTextbookMatchesMaterial(item, material)) || null;

    if (!matchingSessionItem) {
      return createLibraryTextbookCard(material);
    }

    matchedSessionIds.add(matchingSessionItem.id);
    return syncImportedTextbookCard(matchingSessionItem, {
      material,
      uploadedAsset: buildUploadedAssetFromMaterial(material),
    });
  });
  const sessionOnlyItems = importedTextbooks.filter(
    (item) => !matchedSessionIds.has(item.id),
  );

  return [...sessionOnlyItems, ...persistedItems].sort(
    (left, right) =>
      Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
  );
}

export default function MaterialBuilderPageContent() {
  const searchParams = useSearchParams();
  const editingExamId = searchParams.get("examId")?.trim() ?? "";
  const isEditingExistingExam = editingExamId.length > 0;
  const builderTitle = isEditingExistingExam
    ? "Шалгалт үүсгэх"
    : "Шалгалтын материал үүсгэх";
  const breadcrumbItems: BreadcrumbItem[] = isEditingExistingExam
    ? [
        { href: "/test/live-dashboard", label: "Нүүр" },
        { href: "/test/live-dashboard", label: "Миний шалгалтууд" },
        { active: true, label: builderTitle },
      ]
    : [
        { href: "/test/live-dashboard", label: "Нүүр" },
        { active: true, label: builderTitle },
      ];
  const [source, setSource] = useState<MaterialSourceId>("question-bank");
  const [generalInfo, setGeneralInfo] =
    useState<MaterialBuilderGeneralInfo>(DEFAULT_GENERAL_INFO);
  const [textbookGeneratedState, setTextbookGeneratedState] =
    useState<TextbookGeneratedState | null>(null);
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] = useState<string>(
    sharedLibraryMaterials[0]?.id ?? "",
  );
  const [importedTextbooks, setImportedTextbooks] = useState<ImportedTextbookCard[]>(
    [],
  );
  const [activeImportedTextbookId, setActiveImportedTextbookId] = useState<string | null>(
    null,
  );
  const [selectedTextbookLibraryId, setSelectedTextbookLibraryId] = useState<string | null>(
    null,
  );
  const [draggedConfirmedQuestion, setDraggedConfirmedQuestion] = useState<{
    questionId: string;
    variantId: string;
  } | null>(null);
  const [dragTargetConfirmedQuestion, setDragTargetConfirmedQuestion] =
    useState<{
      questionId: string;
      variantId: string;
    } | null>(null);
  const [savingExam, setSavingExam] = useState(false);
  const [savingVariantAsExam, setSavingVariantAsExam] = useState(false);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);
  const [persistedVariantCount, setPersistedVariantCount] = useState(0);
  const [isHydratingExistingExam, setIsHydratingExistingExam] = useState(
    isEditingExistingExam,
  );
  const hydratedExamIdRef = useRef<string | null>(null);
  const variantToastIdRef = useRef<string | number | null>(null);

  const [requestExamVariants, { loading: requestingVariants }] = useMutation(
    RequestExamVariantsDocument,
  );
  const [confirmExamVariants, { loading: confirmingVariants }] = useMutation(
    ConfirmExamVariantsDocument,
  );
  const [saveExamVariants] = useMutation(SaveExamVariantsDocument);
  const [saveNewMathExam] = useMutation(SaveNewMathExamDocument);
  const [fetchExistingExam] = useLazyQuery(GetNewMathExamDocument, {
    fetchPolicy: "no-cache",
  });
  const [fetchVariantJob] = useLazyQuery(GetExamVariantJobDocument, {
    fetchPolicy: "no-cache",
  });

  const activeImportedTextbook =
    importedTextbooks.find((item) => item.id === activeImportedTextbookId) || null;
  const textbookLibraryItems = useMemo(
    () => mergeTextbookLibraryItems(importedTextbooks, persistedTextbookMaterials),
    [importedTextbooks, persistedTextbookMaterials],
  );
  const resolvedVariantCount =
    confirmedVariants.length > 0
      ? confirmedVariants.length
      : persistedVariantCount;

  useEffect(() => {
    if (!isEditingExistingExam) {
      hydratedExamIdRef.current = null;
      setGeneralInfo(defaultGeneralInfo);
      setSource("question-bank");
      setSelectedSharedMaterialId(sharedLibraryMaterials[0]?.id ?? "");
      setVariantDialogOpen(false);
      setVariantViewerOpen(false);
      setVariantCount("2");
      setPreviewQuestions([]);
      setVariantJobId(null);
      setGeneratedVariants([]);
      setSelectedVariantId(null);
      setCheckedVariantIds([]);
      setConfirmedVariantIds([]);
      setEditingQuestionId(null);
      setSavingExam(false);
      setSavingVariantAsExam(false);
      setSavedExamId(null);
      setPersistedVariantCount(0);
      setIsHydratingExistingExam(false);
      return;
    }

    if (hydratedExamIdRef.current === editingExamId) {
      return;
    }

    let cancelled = false;
    setIsHydratingExistingExam(true);

    void fetchExistingExam({
      variables: { examId: editingExamId },
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const exam = (
          result.data as { getNewMathExam?: ExistingExam | null } | undefined
        )?.getNewMathExam;

        if (!exam) {
          throw new Error("Сонгосон шалгалтын мэдээлэл олдсонгүй.");
        }

        setGeneralInfo(mapExistingExamToGeneralInfo(exam));
        setSource("question-bank");
        setSelectedSharedMaterialId(sharedLibraryMaterials[0]?.id ?? "");
        setVariantDialogOpen(false);
        setVariantViewerOpen(false);
        setPreviewQuestions(mapExistingExamToPreviewQuestions(exam));
        setVariantJobId(null);
        setGeneratedVariants([]);
        setSelectedVariantId(null);
        setCheckedVariantIds([]);
        setConfirmedVariantIds([]);
        setEditingQuestionId(null);
        setSavedExamId(exam.examId);
        setPersistedVariantCount(
          exam.sessionMeta?.withVariants
            ? Math.max(exam.sessionMeta?.variantCount ?? 0, 0)
            : 0,
        );
        hydratedExamIdRef.current = editingExamId;
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Сонгосон шалгалтыг нээж чадсангүй.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingExistingExam(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editingExamId, fetchExistingExam, isEditingExistingExam]);

  useEffect(() => {
    setSavedExamId(null);
  }, [textbookGeneratedState?.generatedTest]);

  useEffect(() => {
    const restored = loadPersistedImportedTextbookCards().map((item) => ({
      ...item,
      file: null,
    }));

    if (restored.length > 0) {
      setImportedTextbooks((current) => {
        if (current.length > 0) {
          return current;
        }
        return restored;
      });
    }

    setHasHydratedImportedTextbooks(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedImportedTextbooks) {
      return;
    }

    try {
      const title = generalInfo.examName.trim();
      if (!title) {
        toast.error("Шалгалтын нэрээ оруулна уу.");
        return;
      }

      let baseExamId = savedExamId;
      if (!baseExamId) {
        const saveResult = await saveNewMathExam({
          variables: {
            input: buildBaseExamInput({
              examId: undefined,
              generalInfo,
              previewQuestions,
              hasGeneratedVariants: resolvedVariantCount > 0,
              generatedVariantsCount: resolvedVariantCount,
            }),
          },
        });

  async function handleSave() {
    if (source !== "textbook" && source !== "import") {
      toast.error("Одоогоор зөвхөн `Сурах бичиг` болон `Импорт` хэсгийн хадгалалт холбогдсон.");
      return;
    }

    if (!textbookGeneratedState) {
      toast.error("Эхлээд `Шалгалт үүсгэх` дээр дарж тестээ бэлдэнэ үү.");
      return;
    }

    setIsSaving(true);

    try {
      const input = buildTextbookSaveInput(
        generalInfo,
        textbookGeneratedState,
        savedExamId,
      );
      const result = await saveNewMathExamMutation({
        variables: { input },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      const data = result.data as
        | { saveNewMathExam?: SaveNewMathExamPayload }
        | undefined;
      const examId = data?.saveNewMathExam?.examId;
      if (!examId) {
        throw new Error("Хадгалалтын хариунаас examId ирсэнгүй.");
      }

      setSavedExamId(examId);
      toast.success("Шалгалтыг амжилттай хадгаллаа.");

      await apolloClient.refetchQueries({
        include: [ListNewMathExamsDocument],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Шалгалтыг хадгалах үед алдаа гарлаа.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleTextbookPicked(file: File) {
    const nextCard: ImportedTextbookCard = {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      fileName: file.name,
      title: file.name.replace(/\.pdf$/i, "").trim() || file.name,
      createdAt: new Date().toISOString(),
      materialId: null,
      materialStage: null,
      materialStatus: "idle",
      pageCount: 0,
      sectionCount: 0,
      subchapterCount: 0,
      uploadedAsset: null,
    };

    setImportedTextbooks((current) => [nextCard, ...current].slice(0, 8));
    setActiveImportedTextbookId(nextCard.id);
    setQueuedImportedTextbookId(nextCard.id);
    toast.success("Ном нэмэгдлээ. Доор progress-тай боловсруулалт эхэлнэ.");
  }

  function handleOpenImportedTextbook(importId: string) {
    setActiveImportedTextbookId(importId);
    setQueuedImportedTextbookId(importId);
  }

  function handleImportedTextbookMaterialStateChange(next: {
    importId: string;
    material: TextbookMaterial | null;
    uploadedAsset: TextbookUploadedAsset | null;
  }) {
    setImportedTextbooks((current) => {
      let hasChanges = false;

      const updated = current.map((item) => {
        if (item.id !== next.importId) {
          return item;
        }

        const synced = syncImportedTextbookCard(item, next);
        if (hasImportedTextbookCardChanged(item, synced)) {
          hasChanges = true;
          return synced;
        }

        return item;
      });

      return hasChanges ? updated : current;
    });
  }

  function handleTextbookLibrarySelect(importId: string) {
    const selected = textbookLibraryItems.find((item) => item.id === importId);
    if (!selected) {
      return;
    }

    if (!selected.materialId && !selected.uploadedAsset) {
      toast.message("Энэ ном боловсруулж дуусаагүй байна. Импорт хэсгээс явцыг нь харна уу.");
      return;
    }

    try {
      setSavingExam(true);

      const input = {
        ...buildBaseExamInput({
          examId: savedExamId ?? undefined,
          generalInfo,
          previewQuestions,
          hasGeneratedVariants: resolvedVariantCount > 0,
          generatedVariantsCount: resolvedVariantCount,
        }),
      };

      const result = await saveNewMathExam({ variables: { input } });
      const examId = (
        result.data as
          | {
              saveNewMathExam?: {
                examId?: string | null;
              } | null;
            }
          | undefined
      )?.saveNewMathExam?.examId;

      if (!examId) {
        throw new Error("Хариу дээр examId ирсэнгүй.");
      }

      setSavedExamId(examId);
      setPersistedVariantCount(resolvedVariantCount);
      toast.success("Шалгалт өгөгдлийн санд амжилттай хадгалагдлаа.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Шалгалт хадгалах үед алдаа гарлаа.",
      );
    } finally {
      setSavingExam(false);
    }
  }

  const pageHeading = generalInfo.examName.trim();

  return (
    <TestShell
      breadcrumbItems={breadcrumbItems}
      title={builderTitle}
      contentClassName="px-6 py-0 sm:px-8 lg:px-10"
      hideSidebar={isEditingExistingExam}
      sidebarCollapsible={!isEditingExistingExam}
      teacherVariant={isEditingExistingExam ? "none" : undefined}
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        {isEditingExistingExam && pageHeading ? (
          <div className="px-1 pb-6 pt-4">
            <h1 className="text-[32px] font-bold tracking-[-0.02em] text-slate-900">
              {pageHeading}
            </h1>
          </div>
        ) : null}
        {isEditingExistingExam && isHydratingExistingExam ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex min-h-[32vh] w-full items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-6 text-sm text-slate-500">
              Сонгосон шалгалтын мэдээллийг ачаалж байна...
            </div>
          </div>
        ) : (
          <>
            <GeneralInfoSection
              values={generalInfo}
              onChange={setGeneralInfo}
              onApplyDemo={handleGeneralInfoDemo}
              onReset={handleGeneralInfoReset}
              showUtilityActions={!isEditingExistingExam}
            />
            <MaterialBuilderWorkspaceSection
              generalInfo={generalInfo}
              source={source}
              onSourceChange={setSource}
              selectedSharedMaterialId={selectedSharedMaterialId}
              onSelectMaterialId={setSelectedSharedMaterialId}
              previewQuestions={previewQuestions}
              onPreviewQuestionsChange={setPreviewQuestions}
              appendedContent={
                confirmedVariants.length > 0 ? (
                  <section>
                    <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                      <Check className="h-4 w-4 text-[#167e61]" />
                      Баталсан AI хувилбарууд
                    </div>
                    <div className="space-y-3">
                      {confirmedVariants.map((variant) => (
                        <div key={variant.id} className="space-y-3">
                          <div className="rounded-[14px] border border-[#e6edf7] bg-[#f8fbff] px-4 py-3">
                            <div>
                              <p className="text-[15px] font-semibold text-slate-900">
                                {getDisplayVariantTitle(variant)}
                              </p>
                              <p className="mt-1 text-[12px] text-slate-500">
                                {variant.questions.length} асуулт
                              </p>
                            </div>
                          </div>
                          {variant.questions.map((question) => (
                            <div
                              key={question.id}
                              className={`group rounded-[20px] border bg-white p-5 transition-all duration-200 ${
                                draggedConfirmedQuestion?.questionId ===
                                question.id
                                  ? "scale-[1.015] -rotate-1 border-sky-300 bg-sky-50/60 shadow-[0_24px_50px_-20px_rgba(14,116,144,0.35)] opacity-70"
                                  : dragTargetConfirmedQuestion?.questionId ===
                                        question.id &&
                                      dragTargetConfirmedQuestion.variantId ===
                                        variant.id
                                    ? "border-[#0f74e7] ring-2 ring-[#0f74e7]/20 shadow-[0_0_0_1px_rgba(15,116,231,0.08)]"
                                    : "border-[#e3e9f4] shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-[#b8ccef] hover:bg-[#fbfdff] hover:shadow-[0_10px_22px_rgba(148,163,184,0.14)]"
                              }`}
                              onDragEnter={() => {
                                if (!draggedConfirmedQuestion) return;
                                if (
                                  draggedConfirmedQuestion.variantId !==
                                  variant.id
                                )
                                  return;
                                setDragTargetConfirmedQuestion({
                                  variantId: variant.id,
                                  questionId: question.id,
                                });
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                if (!draggedConfirmedQuestion) return;
                                if (
                                  draggedConfirmedQuestion.variantId !==
                                  variant.id
                                )
                                  return;
                                event.dataTransfer.dropEffect = "move";
                                setDragTargetConfirmedQuestion({
                                  variantId: variant.id,
                                  questionId: question.id,
                                });
                              }}
                              onDrop={() =>
                                dropConfirmedVariantQuestion(
                                  variant.id,
                                  question.id,
                                )
                              }
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex w-8 shrink-0 flex-col items-center gap-2">
                                  <button
                                    type="button"
                                    draggable
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed = "move";
                                      setDraggedConfirmedQuestion({
                                        variantId: variant.id,
                                        questionId: question.id,
                                      });
                                      setDragTargetConfirmedQuestion({
                                        variantId: variant.id,
                                        questionId: question.id,
                                      });
                                    }}
                                    onDragEnd={() => {
                                      setDraggedConfirmedQuestion(null);
                                      setDragTargetConfirmedQuestion(null);
                                    }}
                                    className="cursor-grab rounded-md p-1 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                                    aria-label="Асуултын байрлал өөрчлөх"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0f74e7] text-[12px] font-semibold text-white">
                                    {question.position}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1 text-[14px] font-semibold text-slate-900">
                                      <MathPreviewText
                                        content={question.prompt}
                                        contentSource="backend"
                                        className="text-[14px] leading-relaxed text-slate-900"
                                      />
                                    </div>
                                    <div className="flex items-start gap-1 transition-opacity group-hover:opacity-100 md:opacity-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          moveConfirmedVariantQuestion(
                                            variant.id,
                                            question.id,
                                            "up",
                                          )
                                        }
                                        disabled={question.position === 1}
                                        className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Дээш зөөх"
                                      >
                                        <ChevronUp className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          moveConfirmedVariantQuestion(
                                            variant.id,
                                            question.id,
                                            "down",
                                          )
                                        }
                                        disabled={
                                          question.position ===
                                          variant.questions.length
                                        }
                                        className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                                        aria-label="Доош зөөх"
                                      >
                                        <ChevronDown className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteConfirmedVariantQuestion(
                                            variant.id,
                                            question.id,
                                          )
                                        }
                                        className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                        aria-label="Устгах"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  {(question.options ?? []).length > 0 ? (
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      {(question.options ?? []).map(
                                        (option, index) => {
                                          const isCorrect =
                                            option.trim() ===
                                            (
                                              question.correctAnswer ?? ""
                                            ).trim();

                                          return (
                                            <div
                                              key={`${question.id}-${index}`}
                                              className={`rounded-[14px] px-4 py-3 text-[14px] ${
                                                isCorrect
                                                  ? "border border-[#a8ddd0] bg-[#d8f2ea] text-[#167e61]"
                                                  : "bg-[#eef2f6] text-slate-700"
                                              }`}
                                            >
                                              <div className="flex items-start gap-1.5">
                                                <span className="shrink-0">
                                                  {String.fromCharCode(
                                                    65 + index,
                                                  )}
                                                  .
                                                </span>
                                                <MathPreviewText
                                                  content={option}
                                                  contentSource="backend"
                                                  className="min-w-0 flex-1 text-[14px] leading-relaxed"
                                                />
                                              </div>
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  ) : null}
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Badge className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100">
                                      AI
                                    </Badge>
                                    <Badge className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                      1 оноо
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null
              }
            />

            <div className="flex items-center justify-end gap-3 pt-10">
              <Button
                variant="outline"
                onClick={() =>
                  shouldShowVariantViewerButton
                    ? setVariantViewerOpen(true)
                    : setVariantDialogOpen(true)
                }
                disabled={previewQuestions.length === 0 || isGeneratingVariants}
                className="h-[42px] min-w-[148px] cursor-pointer rounded-[10px] border-[#cfe0fb] bg-white px-6 text-[15px] font-semibold text-[#0b5cab] shadow-[0_6px_14px_rgba(148,163,184,0.12)] hover:border-[#b7cff8] hover:bg-[#f7faff] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#cfe0fb] disabled:hover:bg-white"
              >
                {isGeneratingVariants ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Хувилбар боловсруулж байна...
                  </>
                ) : shouldShowVariantViewerButton ? (
                  <>
                    <Eye className="h-4 w-4" />
                    AI хувилбар харах
                  </>
                ) : (
                  "Хувилбар үүсгэх"
                )}
              </Button>
              <Button
                onClick={() => void handleSaveExam()}
                disabled={savingExam}
                className="h-[42px] min-w-[128px] cursor-pointer rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96] disabled:cursor-not-allowed"
              >
                {savingExam ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Хадгалж байна...
                  </>
                ) : source === "shared-library" ? (
                  "Сонгосон материалыг ашиглах"
                ) : (
                  "Хадгалах"
                )}
              </Button>
            </div>

            <Dialog
              open={variantDialogOpen}
              onOpenChange={setVariantDialogOpen}
            >
              <DialogContent className="max-w-[min(100vw-2rem,28rem)] gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
                <DialogHeader className="px-5 py-4">
                  <DialogTitle className="text-[18px] font-semibold text-slate-900">
                    Хувилбарын тоо оруулах
                  </DialogTitle>
                </DialogHeader>

                <div className="px-5 py-6">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={variantCount}
                    onChange={(event) => setVariantCount(event.target.value)}
                    placeholder="Жишээ нь: 2"
                    className="h-[48px] w-full rounded-[14px] border border-[#d7e3f5] bg-white px-4 text-[15px] shadow-none outline-none"
                  />
                </div>

                <DialogFooter className="mx-0 mb-0 rounded-b-[24px] border-t-0 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVariantDialogOpen(false)}
                    className="cursor-pointer rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
                  >
                    Хаах
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleRequestVariants()}
                    disabled={
                      !canGenerateVariants ||
                      requestingVariants ||
                      Boolean(variantJobId)
                    }
                    className="cursor-pointer rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96] disabled:cursor-not-allowed"
                  >
                    {requestingVariants || variantJobId ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI ажиллаж байна...
                      </>
                    ) : (
                      "AI хувилбар үүсгэх"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        <Dialog open={variantViewerOpen} onOpenChange={setVariantViewerOpen}>
          <DialogContent className="flex h-[min(92vh,52rem)] w-[min(100vw-1.5rem,56rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
            <DialogHeader className="border-b border-[#e9eef6] px-5 py-4">
              <DialogTitle className="text-[18px] font-semibold text-slate-900">
                AI үүсгэсэн хувилбарууд
              </DialogTitle>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden lg:grid-cols-[230px_minmax(0,1fr)] lg:grid-rows-1 xl:grid-cols-[250px_minmax(0,1fr)]">
              <div className="max-h-56 overflow-y-auto border-b border-[#e9eef6] bg-[#f8fbff] p-4 lg:max-h-none lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  {generatedVariants.map((variant) => {
                    const isActive = variant.id === selectedVariantId;
                    const isChecked = checkedVariantIds.includes(variant.id);
                    const isConfirmed =
                      variant.status === "confirmed" ||
                      confirmedVariantIds.includes(variant.id);

                    return (
                      <div key={variant.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            toggleCheckedVariant(variant.id, checked === true)
                          }
                          className="h-5 w-5 cursor-pointer rounded-[6px] border-[#b9cbe4] data-[state=checked]:border-[#0b5cab] data-[state=checked]:bg-[#0b5cab]"
                          aria-label={`${getDisplayVariantTitle(variant)}-ийг action-д сонгох`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVariantId(variant.id);
                            setEditingQuestionId(null);
                          }}
                          className={`w-full cursor-pointer rounded-[16px] border px-4 py-3 text-left transition-all duration-200 ${
                            isActive
                              ? "border-[#0b5cab] bg-white shadow-[0_10px_20px_rgba(11,92,171,0.12)]"
                              : "border-[#dbe4f3] bg-white hover:-translate-y-0.5 hover:border-[#a9c8f3] hover:bg-[#f8fbff] hover:shadow-[0_10px_22px_rgba(148,163,184,0.16)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[16px] font-semibold text-slate-900">
                                {getDisplayVariantTitle(variant)}
                              </p>
                              <p className="mt-1 text-[12px] text-slate-500">
                                {variant.questions.length} асуулт
                              </p>
                            </div>
                            {isConfirmed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#e4f7ee] px-2.5 py-1 text-[11px] font-semibold text-[#167e61]">
                                <Check className="h-3.5 w-3.5" />
                                Баталсан
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                {selectedVariant ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-slate-900">
                          {getDisplayVariantTitle(selectedVariant)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteVariant(selectedVariant.id)}
                        className="cursor-pointer rounded-[12px] border-rose-200 px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Хувилбар устгах"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {selectedVariant.questions.map((question) => {
                      const correctOptionIndex =
                        getCorrectOptionIndex(question);
                      const isEditingQuestion =
                        editingQuestionId === question.id;

                      return (
                        <div
                          key={question.id}
                          className="rounded-[16px] border border-[#dbe4f3] bg-[#fcfdff] p-4"
                        >
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[14px] font-semibold text-slate-900">
                              Асуулт {question.position}
                            </p>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setEditingQuestionId((current) =>
                                    current === question.id
                                      ? null
                                      : question.id,
                                  )
                                }
                                className="cursor-pointer px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                aria-label={
                                  isEditingQuestion
                                    ? "Засварлах горимоос гарах"
                                    : "Засварлах"
                                }
                              >
                                {isEditingQuestion ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Pencil className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  deleteVariantQuestion(
                                    selectedVariant.id,
                                    question.id,
                                  )
                                }
                                className="cursor-pointer px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                aria-label="Асуулт устгах"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {isEditingQuestion ? (
                            <div className="space-y-3">
                              <MathAssistField
                                multiline
                                value={question.prompt}
                                onChange={(nextValue) =>
                                  updateVariantQuestion(
                                    selectedVariant.id,
                                    question.id,
                                    (current) => ({
                                      ...current,
                                      prompt: nextValue,
                                    }),
                                  )
                                }
                                className="min-h-[120px]! rounded-[14px]! border-[#d7e3f5]! bg-white!"
                                contentClassName="text-[14px] leading-6 text-slate-900 [&_.katex]:text-inherit"
                              />

                              {(question.options ?? []).length > 0 ? (
                                <div className="grid gap-3">
                                  {(question.options ?? []).map(
                                    (option, index) => (
                                      <div
                                        key={`${question.id}-${index}`}
                                        className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3"
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateVariantQuestion(
                                              selectedVariant.id,
                                              question.id,
                                              (current) => ({
                                                ...current,
                                                correctAnswer:
                                                  current.options?.[index] ??
                                                  "",
                                              }),
                                            )
                                          }
                                          className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition ${
                                            index === correctOptionIndex
                                              ? "border-[#0b5cab] bg-[#e8f1ff] shadow-[0_0_0_3px_rgba(11,92,171,0.08)]"
                                              : "border-[#cbd9ee] bg-white hover:border-[#9fbae3]"
                                          }`}
                                          aria-label={`Сонголт ${index + 1}-ийг зөв хариу болгох`}
                                        >
                                          <span
                                            className={`h-2.5 w-2.5 rounded-full transition ${
                                              index === correctOptionIndex
                                                ? "bg-[#0b5cab]"
                                                : "bg-transparent"
                                            }`}
                                          />
                                        </button>
                                        <MathAssistField
                                          value={option}
                                          onChange={(nextValue) =>
                                            updateVariantQuestion(
                                              selectedVariant.id,
                                              question.id,
                                              (current) => {
                                                const nextOptions = [
                                                  ...(current.options ?? []),
                                                ];
                                                const previousOption =
                                                  nextOptions[index] ?? "";
                                                nextOptions[index] = nextValue;
                                                const nextCorrectAnswer =
                                                  (
                                                    current.correctAnswer ?? ""
                                                  ).trim() ===
                                                  previousOption.trim()
                                                    ? nextValue
                                                    : current.correctAnswer;

                                                return {
                                                  ...current,
                                                  options: nextOptions,
                                                  correctAnswer:
                                                    nextCorrectAnswer,
                                                };
                                              },
                                            )
                                          }
                                          className={`rounded-[12px]! bg-white! ${
                                            index === correctOptionIndex
                                              ? "border-[#9cd9c0]! bg-[#eefaf4]!"
                                              : "border-[#d7e3f5]!"
                                          }`}
                                          contentClassName="text-[14px] leading-6 text-slate-900 [&_.katex]:text-inherit"
                                        />
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : null}
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
                                    (option, index) => (
                                      <div
                                        key={`${question.id}-${index}`}
                                        className={`grid grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-[12px] border px-3 py-2 ${
                                          index === correctOptionIndex
                                            ? "border-[#9cd9c0] bg-[#eefaf4]"
                                            : "border-[#d7e3f5] bg-white"
                                        }`}
                                      >
                                        <div
                                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                            index === correctOptionIndex
                                              ? "border-[#0b5cab] bg-[#e8f1ff] shadow-[0_0_0_3px_rgba(11,92,171,0.08)]"
                                              : "border-[#cbd9ee] bg-white"
                                          }`}
                                        >
                                          <span
                                            className={`h-2.5 w-2.5 rounded-full ${
                                              index === correctOptionIndex
                                                ? "bg-[#0b5cab]"
                                                : "bg-transparent"
                                            }`}
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
                              ) : question.type === "written" ? (
                                <Textarea
                                  value=""
                                  readOnly
                                  placeholder="Хариултаа энд бичнэ үү..."
                                  className="min-h-[120px] resize-none rounded-[14px] border-[#d7e3f5] bg-white text-[14px] leading-6 text-slate-700 placeholder:text-slate-400"
                                />
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full min-h-80 items-center justify-center rounded-[18px] border border-dashed border-[#d7e3f5] bg-[#fbfdff] text-center text-[14px] text-slate-500">
                    Харах AI хувилбар үлдсэнгүй.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-[24px] border-t border-[#e9eef6] bg-white px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantViewerOpen(false)}
                disabled={isPersistingVariant}
                className="cursor-pointer rounded-[12px] border-[#d7e3f5] bg-white px-5 hover:bg-slate-50"
              >
                Хаах
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveVariantsAsNewExams}
                disabled={checkedVariants.length === 0 || isPersistingVariant}
                className="cursor-pointer rounded-[12px] border-sky-200 bg-sky-50 px-5 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
              >
                {savingVariantAsExam ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Шинэ шалгалт болгож хадгалж байна...
                  </>
                ) : (
                  "Шинэ шалгалт болгож хадгалах"
                )}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmVariant}
                disabled={checkedVariants.length === 0 || isPersistingVariant}
                className="cursor-pointer rounded-[12px] bg-[#0b5cab] px-5 hover:bg-[#0a4f96]"
              >
                {confirmingVariants ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Баталж байна...
                  </>
                ) : (
                  "Хувилбар батлах"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TestShell>
  );
}
