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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  SaveNewMathExamDocument,
  SaveExamVariantsDocument,
  RequestExamVariantsDocument,
} from "@/gql/create-exam-documents";
import { MathExamQuestionType } from "@/gql/graphql";
import { TestShell } from "../../_components/test-shell";
import {
  GeneralInfoSection,
  type GeneralInfoValues,
} from "./general-info-section";
import {
  MaterialBuilderWorkspaceSection,
  type PreviewQuestion,
} from "./material-builder-workspace-section";
import {
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "./material-builder-config";

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

const defaultGeneralInfo: GeneralInfoValues = {
  subject: "",
  grade: "",
  examType: "",
  examName: "",
  durationMinutes: "",
};
const demoGeneralInfo: GeneralInfoValues = {
  subject: "math",
  grade: "9",
  examType: "progress",
  examName: "Алгебр явцын шалгалт",
  durationMinutes: "30",
};

function normalizeVariantQuestions(
  questions: GeneratedVariant["questions"],
): GeneratedVariant["questions"] {
  function normalizeVariantText(value?: string | null) {
    if (value == null) return value ?? null;

    return normalizeBackendMathText(
      value.replace(/\\\{/g, "{").replace(/\\\}/g, "}"),
    );
  }

  return questions.map((question, index) => ({
    ...question,
    position: index + 1,
    prompt: normalizeVariantText(question.prompt) ?? "",
    options: (question.options ?? []).map(
      (option) => normalizeVariantText(option) ?? "",
    ),
    correctAnswer: normalizeVariantText(question.correctAnswer),
    explanation: normalizeVariantText(question.explanation),
  }));
}

function mapVariantToPreviewQuestions(
  variant: GeneratedVariant,
): PreviewQuestion[] {
  return normalizeVariantQuestions(variant.questions).map((question, index) => {
    const options = question.options ?? [];
    const matchedCorrectIndex = options.findIndex(
      (option) => option.trim() === (question.correctAnswer ?? "").trim(),
    );

    return {
      id: `variant-${variant.id}-${question.id}-${index + 1}`,
      index: index + 1,
      question: question.prompt,
      questionType: question.type === "written" ? "written" : "single-choice",
      answers: options,
      correct: matchedCorrectIndex >= 0 ? matchedCorrectIndex : 0,
      points: 1,
      source: `AI хувилбар ${variant.variantNumber}`,
      explanation: question.explanation ?? undefined,
    };
  });
}

function getDisplayVariantTitle(variant: GeneratedVariant) {
  return `Хувилбар ${variant.variantNumber}`;
}

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
  const writtenQuestions = args.previewQuestions.filter(
    (question) => question.questionType === "written",
  );

  return {
    examId: args.examId,
    title: args.generalInfo.examName.trim(),
    mcqCount: mcqQuestions.length,
    mathCount: writtenQuestions.length,
    totalPoints: args.previewQuestions.length,
    sessionMeta: {
      grade: Number(args.generalInfo.grade),
      examType: args.generalInfo.examType,
      subject: args.generalInfo.subject,
      durationMinutes: Number(args.generalInfo.durationMinutes),
      withVariants: args.hasGeneratedVariants,
      variantCount: args.hasGeneratedVariants ? args.generatedVariantsCount : 0,
    },
    questions: args.previewQuestions.map((question) => ({
      type:
        question.questionType === "written"
          ? MathExamQuestionType.Math
          : MathExamQuestionType.Mcq,
      prompt: question.question,
      points: question.points,
      options:
        question.questionType === "written" ? undefined : question.answers,
      correctOption:
        question.questionType === "written" ? undefined : question.correct,
      answerLatex:
        question.questionType === "written"
          ? (question.answers[0] ?? "").trim() || undefined
          : undefined,
      responseGuide:
        question.questionType === "written"
          ? question.explanation?.trim() || undefined
          : undefined,
    })),
  };
}

function getCorrectOptionIndex(
  question: GeneratedVariant["questions"][number],
) {
  const correctAnswer = (question.correctAnswer ?? "").trim();
  if (!correctAnswer) return -1;
  return (question.options ?? []).findIndex(
    (option) => option.trim() === correctAnswer,
  );
}

function buildVariantMutationInput(
  variant: GeneratedVariant,
  generalInfo: GeneralInfoValues,
) {
  return {
    variantId: variant.id,
    examId: undefined,
    title: `${generalInfo.examName || "Шалгалт"} · ${variant.title}`,
    grade: Number(generalInfo.grade) || undefined,
    examType: generalInfo.examType || undefined,
    subject: generalInfo.subject || undefined,
    durationMinutes: Number(generalInfo.durationMinutes) || undefined,
    questions: variant.questions.map((question) => ({
      order: question.position,
      prompt: question.prompt,
      type: question.type,
      options: question.options ?? [],
      correctAnswer: question.correctAnswer ?? null,
      explanation: question.explanation ?? null,
    })),
  };
}

export default function MaterialBuilderPageContent() {
  const [source, setSource] = useState<MaterialSourceId>("question-bank");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] =
    useState<string>(sharedLibraryMaterials[0]?.id ?? "");
  const [generalInfo, setGeneralInfo] =
    useState<GeneralInfoValues>(defaultGeneralInfo);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantViewerOpen, setVariantViewerOpen] = useState(false);
  const [variantCount, setVariantCount] = useState("2");
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>(
    [],
  );
  const [variantJobId, setVariantJobId] = useState<string | null>(null);
  const [generatedVariants, setGeneratedVariants] = useState<
    GeneratedVariant[]
  >([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [checkedVariantIds, setCheckedVariantIds] = useState<string[]>([]);
  const [confirmedVariantIds, setConfirmedVariantIds] = useState<string[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
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
  const variantToastIdRef = useRef<string | number | null>(null);

  const [requestExamVariants, { loading: requestingVariants }] = useMutation(
    RequestExamVariantsDocument,
  );
  const [confirmExamVariants, { loading: confirmingVariants }] = useMutation(
    ConfirmExamVariantsDocument,
  );
  const [saveExamVariants] = useMutation(SaveExamVariantsDocument);
  const [saveNewMathExam] = useMutation(SaveNewMathExamDocument);
  const [fetchVariantJob] = useLazyQuery(GetExamVariantJobDocument, {
    fetchPolicy: "no-cache",
  });

  const canGenerateVariants = useMemo(
    () => previewQuestions.length > 0 && Number(variantCount) > 0,
    [previewQuestions.length, variantCount],
  );
  const selectedVariant = useMemo(
    () =>
      generatedVariants.find((variant) => variant.id === selectedVariantId) ??
      null,
    [generatedVariants, selectedVariantId],
  );
  const isGeneratingVariants = requestingVariants || Boolean(variantJobId);
  const isPersistingVariant =
    confirmingVariants || savingExam || savingVariantAsExam;
  const hasGeneratedVariants = generatedVariants.length > 0;
  const confirmedVariants = useMemo(
    () =>
      generatedVariants.filter(
        (variant) =>
          variant.status === "confirmed" ||
          confirmedVariantIds.includes(variant.id),
      ),
    [confirmedVariantIds, generatedVariants],
  );
  const shouldShowVariantViewerButton = hasGeneratedVariants;
  const checkedVariants = useMemo(
    () =>
      generatedVariants.filter((variant) =>
        checkedVariantIds.includes(variant.id),
      ),
    [checkedVariantIds, generatedVariants],
  );

  useEffect(() => {
    if (!variantJobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const result = await fetchVariantJob({
        variables: { jobId: variantJobId },
      });
      const job = (
        result.data as
          | {
              getExamVariantJob?: {
                status?: string;
                errorMessage?: string | null;
                variants?: GeneratedVariant[] | null;
              } | null;
            }
          | undefined
      )?.getExamVariantJob;

      if (!job || cancelled) return;

      if (job.status === "completed") {
        const nextVariants = (job.variants ?? []).map((variant) => ({
          ...variant,
          questions: normalizeVariantQuestions(variant.questions),
        }));
        setGeneratedVariants(nextVariants);
        setSelectedVariantId(nextVariants[0]?.id ?? null);
        setCheckedVariantIds([]);
        setVariantJobId(null);
        if (variantToastIdRef.current) {
          toast.dismiss(variantToastIdRef.current);
          variantToastIdRef.current = null;
        }
        toast.success("AI хувилбарууд бэлэн боллоо.");
        return;
      }

      if (job.status === "failed") {
        setVariantJobId(null);
        if (variantToastIdRef.current) {
          toast.dismiss(variantToastIdRef.current);
          variantToastIdRef.current = null;
        }
        toast.error(job.errorMessage || "AI хувилбар үүсгэхэд алдаа гарлаа.");
        return;
      }

      timer = setTimeout(() => {
        void poll();
      }, 2000);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchVariantJob, variantJobId]);

  async function handleRequestVariants() {
    if (!canGenerateVariants) {
      toast.error("Эхлээд шалгалтын асуултуудаа бүрдүүлнэ үү.");
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
              hasGeneratedVariants: false,
              generatedVariantsCount: 0,
            }),
          },
        });

        baseExamId =
          (
            saveResult.data as
              | {
                  saveNewMathExam?: {
                    examId?: string | null;
                  } | null;
                }
              | undefined
          )?.saveNewMathExam?.examId ?? null;

        if (!baseExamId) {
          throw new Error(
            "AI хувилбар үүсгэхийн өмнө үндсэн шалгалтыг хадгалж чадсангүй.",
          );
        }

        setSavedExamId(baseExamId);
      }

      const result = await requestExamVariants({
        variables: {
          input: {
            examId: baseExamId,
            variantCount: Number(variantCount),
            questions: previewQuestions.map((question) => ({
              order: question.index,
              prompt: question.question,
              type: question.questionType,
              options:
                question.questionType === "written" ? [] : question.answers,
              correctAnswer:
                question.questionType === "written"
                  ? (question.answers[0] ?? null)
                  : (question.answers[question.correct] ?? null),
              explanation:
                question.questionType === "written"
                  ? (question.explanation ?? null)
                  : null,
            })),
          },
        },
      });

      const payload = (
        result.data as
          | {
              requestExamVariants?: {
                success?: boolean;
                message?: string;
                jobId?: string | null;
              };
            }
          | undefined
      )?.requestExamVariants;

      if (!payload?.success || !payload.jobId) {
        toast.error(
          payload?.message || "AI хувилбар үүсгэх хүсэлт амжилтгүй боллоо.",
        );
        return;
      }

      setVariantJobId(payload.jobId);
      setGeneratedVariants([]);
      setSelectedVariantId(null);
      setCheckedVariantIds([]);
      setConfirmedVariantIds([]);
      setVariantDialogOpen(false);
      variantToastIdRef.current = toast.loading(
        "AI хувилбар боловсруулж байна...",
        {
          description: "Тоон утга, хариултуудыг шинэчилж байна.",
        },
      );
    } catch (error) {
      if (variantToastIdRef.current) {
        toast.dismiss(variantToastIdRef.current);
        variantToastIdRef.current = null;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "AI хувилбар үүсгэх хүсэлт амжилтгүй боллоо.",
      );
    }
  }

  function handleGeneralInfoDemo() {
    setGeneralInfo(demoGeneralInfo);
  }

  function handleGeneralInfoReset() {
    setGeneralInfo(defaultGeneralInfo);
  }

  function updateVariantQuestion(
    variantId: string,
    questionId: string,
    updater: (
      question: GeneratedVariant["questions"][number],
    ) => GeneratedVariant["questions"][number],
  ) {
    setGeneratedVariants((prev) =>
      prev.map((variant) =>
        variant.id !== variantId
          ? variant
          : {
              ...variant,
              questions: normalizeVariantQuestions(
                variant.questions.map((question) =>
                  question.id === questionId ? updater(question) : question,
                ),
              ),
            },
      ),
    );
  }

  function deleteVariantQuestion(variantId: string, questionId: string) {
    setGeneratedVariants((prev) =>
      prev.map((variant) =>
        variant.id !== variantId
          ? variant
          : {
              ...variant,
              questions: normalizeVariantQuestions(
                variant.questions.filter(
                  (question) => question.id !== questionId,
                ),
              ),
            },
      ),
    );
  }

  function reorderVariantQuestions(
    variantId: string,
    questions: GeneratedVariant["questions"],
  ) {
    setGeneratedVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              questions: normalizeVariantQuestions(questions),
            }
          : variant,
      ),
    );
  }

  function moveConfirmedVariantQuestion(
    variantId: string,
    questionId: string,
    direction: "up" | "down",
  ) {
    const variant = generatedVariants.find((item) => item.id === variantId);
    if (!variant) return;

    const currentIndex = variant.questions.findIndex(
      (question) => question.id === questionId,
    );
    if (currentIndex === -1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= variant.questions.length) return;

    const next = [...variant.questions];
    [next[currentIndex], next[targetIndex]] = [
      next[targetIndex],
      next[currentIndex],
    ];
    reorderVariantQuestions(variantId, next);
  }

  function deleteConfirmedVariantQuestion(
    variantId: string,
    questionId: string,
  ) {
    const variant = generatedVariants.find((item) => item.id === variantId);
    if (!variant) return;

    reorderVariantQuestions(
      variantId,
      variant.questions.filter((question) => question.id !== questionId),
    );
  }

  function dropConfirmedVariantQuestion(
    variantId: string,
    targetQuestionId: string,
  ) {
    if (
      !draggedConfirmedQuestion ||
      draggedConfirmedQuestion.variantId !== variantId ||
      draggedConfirmedQuestion.questionId === targetQuestionId
    ) {
      setDraggedConfirmedQuestion(null);
      setDragTargetConfirmedQuestion(null);
      return;
    }

    const variant = generatedVariants.find((item) => item.id === variantId);
    if (!variant) return;

    const draggedIndex = variant.questions.findIndex(
      (question) => question.id === draggedConfirmedQuestion.questionId,
    );
    const targetIndex = variant.questions.findIndex(
      (question) => question.id === targetQuestionId,
    );
    if (
      draggedIndex === -1 ||
      targetIndex === -1 ||
      draggedIndex === targetIndex
    ) {
      setDraggedConfirmedQuestion(null);
      setDragTargetConfirmedQuestion(null);
      return;
    }

    const next = [...variant.questions];
    const [draggedItem] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, draggedItem);
    reorderVariantQuestions(variantId, next);
    setDraggedConfirmedQuestion(null);
    setDragTargetConfirmedQuestion(null);
  }

  function handleDeleteVariant(variantId: string) {
    setGeneratedVariants((prev) => {
      const next = prev.filter((variant) => variant.id !== variantId);
      setEditingQuestionId(null);
      setCheckedVariantIds((current) =>
        current.filter((checkedId) => checkedId !== variantId),
      );
      if (selectedVariantId === variantId) {
        setSelectedVariantId(next[0]?.id ?? null);
      }
      if (!next.length) {
        setVariantViewerOpen(false);
      }
      return next;
    });
  }

  function toggleCheckedVariant(variantId: string, checked: boolean) {
    setCheckedVariantIds((prev) =>
      checked
        ? [...new Set([...prev, variantId])]
        : prev.filter((id) => id !== variantId),
    );
  }

  function handleConfirmVariant() {
    if (checkedVariants.length === 0) {
      toast.error("Батлах AI хувилбаруудаа checkbox-оор сонгоно уу.");
      return;
    }

    void (async () => {
      try {
        const result = await confirmExamVariants({
          variables: {
            inputs: checkedVariants.map((variant) => ({
              variantId: variant.id,
              questions: variant.questions.map((question) => ({
                order: question.position,
                prompt: question.prompt,
                type: question.type,
                options: question.options ?? [],
                correctAnswer: question.correctAnswer ?? null,
                explanation: question.explanation ?? null,
              })),
            })),
          },
        });

        const payload = (
          result.data as
            | {
                confirmExamVariants?: {
                  success?: boolean;
                  message?: string;
                  variants?: Array<{
                    id: string;
                    status?: string | null;
                    confirmedAt?: string | null;
                  } | null> | null;
                } | null;
              }
            | undefined
        )?.confirmExamVariants;

        if (!payload?.success || !payload.variants?.length) {
          toast.error(payload?.message || "AI хувилбар батлахад алдаа гарлаа.");
          return;
        }

        const confirmedMap = new Map(
          payload.variants
            .filter(Boolean)
            .map((variant) => [variant!.id, variant!]),
        );
        setGeneratedVariants((prev) =>
          prev.map((variant) =>
            confirmedMap.has(variant.id)
              ? {
                  ...variant,
                  status: confirmedMap.get(variant.id)?.status ?? "confirmed",
                  confirmedAt:
                    confirmedMap.get(variant.id)?.confirmedAt ?? null,
                }
              : variant,
          ),
        );
        setConfirmedVariantIds((prev) =>
          Array.from(new Set([...prev, ...confirmedMap.keys()])),
        );
        setCheckedVariantIds([]);
        setVariantViewerOpen(false);
        toast.success(
          payload.message ||
            `${confirmedMap.size} AI хувилбарыг амжилттай баталлаа.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "AI хувилбар батлахад алдаа гарлаа.",
        );
      }
    })();
  }

  function handleSaveVariantsAsNewExams() {
    if (checkedVariants.length === 0) {
      toast.error(
        "Шинэ шалгалт болгох AI хувилбаруудаа checkbox-оор сонгоно уу.",
      );
      return;
    }

    void (async () => {
      try {
        setSavingVariantAsExam(true);
        const result = await saveExamVariants({
          variables: {
            inputs: checkedVariants.map((variant) =>
              buildVariantMutationInput(variant, generalInfo),
            ),
          },
        });

        const payload = (
          result.data as
            | {
                saveExamVariants?: {
                  success?: boolean;
                  message?: string;
                  examIds?: Array<string | null> | null;
                  variants?: Array<{
                    id: string;
                    status?: string | null;
                    savedAt?: string | null;
                    savedExamId?: string | null;
                    confirmedAt?: string | null;
                  } | null> | null;
                } | null;
              }
            | undefined
        )?.saveExamVariants;

        if (!payload?.success || !payload.variants?.length) {
          throw new Error(
            payload?.message || "Шинэ шалгалт болгож хадгалж чадсангүй.",
          );
        }

        const savedMap = new Map(
          payload.variants
            .filter(Boolean)
            .map((variant) => [variant!.id, variant!]),
        );
        setGeneratedVariants((prev) =>
          prev.map((variant) =>
            savedMap.has(variant.id)
              ? {
                  ...variant,
                  status: savedMap.get(variant.id)?.status ?? "saved",
                  confirmedAt: savedMap.get(variant.id)?.confirmedAt ?? null,
                  savedAt: savedMap.get(variant.id)?.savedAt ?? null,
                  savedExamId: savedMap.get(variant.id)?.savedExamId ?? null,
                }
              : variant,
          ),
        );
        setCheckedVariantIds([]);
        toast.success(
          payload.message ||
            `${savedMap.size} AI хувилбарыг шинэ шалгалт болгож хадгаллаа.`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Шинэ шалгалт болгож хадгалахад алдаа гарлаа.",
        );
      } finally {
        setSavingVariantAsExam(false);
      }
    })();
  }

  async function handleSaveExam() {
    if (previewQuestions.length === 0) {
      toast.error("Хадгалахаас өмнө дор хаяж нэг асуулт нэмнэ үү.");
      return;
    }

    const title = generalInfo.examName.trim();
    if (!title) {
      toast.error("Шалгалтын нэрээ оруулна уу.");
      return;
    }

    try {
      setSavingExam(true);

      const input = {
        ...buildBaseExamInput({
          examId: savedExamId ?? undefined,
          generalInfo,
          previewQuestions,
          hasGeneratedVariants: confirmedVariants.length > 0,
          generatedVariantsCount: confirmedVariants.length,
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

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
      sidebarCollapsible
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <GeneralInfoSection
          values={generalInfo}
          onChange={setGeneralInfo}
          onApplyDemo={handleGeneralInfoDemo}
          onReset={handleGeneralInfoReset}
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
                            draggedConfirmedQuestion?.questionId === question.id
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
                              draggedConfirmedQuestion.variantId !== variant.id
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
                              draggedConfirmedQuestion.variantId !== variant.id
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
                                        (question.correctAnswer ?? "").trim();

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
                                              {String.fromCharCode(65 + index)}.
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

        <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
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
