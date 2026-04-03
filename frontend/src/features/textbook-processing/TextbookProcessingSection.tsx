"use client";

import {
  BookOpen,
  FileUp,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getMaterialProgressValue,
  getStageLabel,
  getUploadWorkflowProgressValue,
} from "./status";
import { SectionTree } from "./SectionTree";
import {
  buildSectionTree,
  countSelectedPagesFromMaterial,
  resolveGenerateSelection,
} from "./selectors";
import { applyTextbookDisplayTitleFallbacks } from "./textbook-display-title-fallback";
import {
  buildTextbookGenerationSourceFromMaterial,
  generateTextbookTestFromMaterial,
} from "./legacy-generation-adapter";
import { getTextbookMaterialSelectionByNodeIds } from "./material-selection-api";
import { cachePersistedTextbookMaterial } from "./persisted-material-cache";
import { cacheSessionTextbookMaterial } from "./session-material-cache";
import { useTextbookMaterialProcessing } from "./use-textbook-material-processing";
import type {
  MaterialBuilderSubject,
} from "./api";
import { getExpectedR2FileName } from "./api";
import type {
  TextbookMaterial,
  TextbookMaterialDetail,
  TextbookSectionTreeNode,
  TextbookUploadedAsset,
} from "./types";
import type {
  GeneratedTextbookQuestion,
  GeneratedTextbookTest,
  TextbookSourceProblem,
} from "@/app/test/material-builder/_components/textbook-material-data";
import {
  TextbookQuestionCard,
} from "@/app/test/material-builder/_components/material-builder-ui";
import { textareaClassName } from "@/app/test/material-builder/_components/material-builder-config";
import { buildRuntimeApiUrl } from "@/lib/runtime-api";

type TextbookGenerateApiResponse = {
  error?: string;
  test?: GeneratedTextbookTest;
};

const MIN_GENERATE_DURATION_MS = 5000;
const MAX_GENERATE_DURATION_MS = 7000;

export type TextbookGeneratedState = {
  bookTitle: string;
  fileName: string;
  generatedTest: GeneratedTextbookTest;
  materialId?: string;
  selectedSectionIds: string[];
  selectedSectionTitles: string[];
  uploadedAsset: TextbookUploadedAsset;
};

function getChoiceText(question: GeneratedTextbookQuestion) {
  return (
    question.choices.find((choice) =>
      choice.toUpperCase().startsWith(`${question.correctAnswer}.`),
    ) || question.choices[0] || ""
  );
}

function compactTextbookPageContent(page: { content: string; pageNumber: number }) {
  return String(page.content || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function requestAiEnhancedTextbookTest({
  fallbackTest,
  grade,
  sourceProblems,
  selectedSectionTitles,
  visiblePages,
}: {
  fallbackTest: GeneratedTextbookTest;
  grade: number;
  selectedSectionTitles: string[];
  sourceProblems: TextbookSourceProblem[];
  visiblePages: Array<{ content: string; pageNumber: number }>;
}) {
  const response = await fetch(buildRuntimeApiUrl("/api/textbook-generate"), {
    body: JSON.stringify({
      fallbackTest,
      grade,
      selectedSectionTitles,
      sourceProblems,
      visiblePages,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json()) as TextbookGenerateApiResponse;
  if (!response.ok || !payload.test) {
    throw new Error(
      payload.error || "Сурах бичгээс AI тест үүсгэж чадсангүй.",
    );
  }

  return payload.test;
}

function createGenerateDurationTargetMs() {
  return (
    MIN_GENERATE_DURATION_MS +
    Math.floor(
      Math.random() * (MAX_GENERATE_DURATION_MS - MIN_GENERATE_DURATION_MS + 1),
    )
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureMinimumGenerateDuration(startedAtMs: number, targetMs: number) {
  const elapsedMs = Date.now() - startedAtMs;
  if (elapsedMs >= targetMs) {
    return;
  }

  await sleep(targetMs - elapsedMs);
}

function filterTreeBySearch(
  nodes: TextbookSectionTreeNode[],
  search: string,
): TextbookSectionTreeNode[] {
  if (!search) {
    return nodes;
  }

  const lowered = search.toLocaleLowerCase();
  return nodes
    .map((node) => {
      const children = filterTreeBySearch(node.children, search);
      const matches = node.title.toLocaleLowerCase().includes(lowered);
      if (!matches && children.length === 0) {
        return null;
      }
      return {
        ...node,
        children,
      };
    })
    .filter((node): node is TextbookSectionTreeNode => Boolean(node));
}

function collectSelectableNodeIds(detail: TextbookMaterialDetail | null) {
  if (!detail) {
    return [];
  }

  return detail.sections
    .filter((section) => section.nodeType !== "chapter")
    .map((section) => section.id);
}

function getSubjectLabel(subject: MaterialBuilderSubject) {
  switch (subject) {
    case "math":
      return "Математик";
    case "physics":
      return "Физик";
    case "chemistry":
      return "Хими";
    default:
      return subject;
  }
}

function getTextbookDisplayTitle(input: {
  fallback?: string | null;
  grade: number;
  subject: MaterialBuilderSubject;
}) {
  const subjectLabel = getSubjectLabel(input.subject).trim();
  if (subjectLabel && Number.isFinite(input.grade) && input.grade > 0) {
    return `${subjectLabel}-${input.grade}`;
  }

  return input.fallback?.trim() || "Сурах бичиг";
}

type ReadableProgressCopy = {
  description: string;
  nextStep: string;
  title: string;
};

function getReadableProgressCopy(input: {
  fileName: string | null;
  isUploading: boolean;
  material: TextbookMaterial | null;
  message: string;
  uploadProgressPercent: number;
}) : ReadableProgressCopy {
  const fileLabel = input.fileName?.trim() || "Сурах бичгийн PDF";
  const safeUploadPercent = Math.max(0, input.uploadProgressPercent || 0);

  if (input.isUploading) {
    return {
      title: `${safeUploadPercent}% хадгаллаа`,
      description: `${fileLabel} файлыг системд ачаалж байна.`,
      nextStep:
        "Үүний дараа хуудас бүрийн текстийг уншаад бүлэг, сэдвүүдийг автоматаар ялгана.",
    };
  }

  switch (input.material?.stage) {
    case "processing_pages": {
      const total = input.material.progressTotal || 0;
      const current = input.material.progressCurrent || 0;
      const remaining = Math.max(total - current, 0);

      return {
        title:
          total > 0
            ? `${current}/${total} хуудас боловсрууллаа`
            : "Хуудас бүрийн текстийг уншиж байна",
        description:
          input.message || `${fileLabel} доторх текстийг хуудас бүрээр нь уншиж байна.`,
        nextStep:
          remaining > 0
            ? `${remaining} хуудас үлдээд байна. Дараа нь бүлэг, сэдвийг ялгана.`
            : "Хуудасны уншилт дуусмагц бүлэг, сэдвийн бүтцийг гаргана.",
      };
    }
    case "detecting_chapters":
      return {
        title: "Бүлэг, сэдвүүдийг ялгаж байна",
        description:
          input.message ||
          `${fileLabel}-ийн агуулгыг chapter, section бүтэц болгон ангилж байна.`,
        nextStep: "Дуусмагц бүлгүүдээ сонгоод шууд шалгалт үүсгэж болно.",
      };
    case "ready":
      return {
        title: "Сурах бичиг бэлэн боллоо",
        description:
          input.message || "Одоо бүлэг, сэдвээ сонгоод шалгалт үүсгэхэд бэлэн байна.",
        nextStep: "Зүүн талаас хэрэгтэй хэсгүүдээ сонгоод “Шалгалт үүсгэх” дээр дарна уу.",
      };
    case "ocr_needed":
      return {
        title: "PDF-д OCR хэрэгтэй байна",
        description:
          input.message ||
          "Энэ файл зурагтай эсвэл текст багатай тул шууд задлан унших боломжгүй байна.",
        nextStep: "Илүү цэвэр тексттэй PDF сонгох эсвэл OCR-той хувилбар ашиглана уу.",
      };
    case "error":
      return {
        title: "Боловсруулах үед алдаа гарлаа",
        description: input.message || "Сурах бичгийг боловсруулах явцад алдаа гарсан байна.",
        nextStep: "Файлаа дахин шалгаад дахин ачаалж үзнэ үү.",
      };
    case "uploaded":
    default:
      return {
        title: "Материалыг бэлтгэж байна",
        description: input.message || `${fileLabel} файлын мэдээллийг шалгаж байна.`,
        nextStep: "Дараагийн алхамд хуудас бүрийн текстийг уншиж эхэлнэ.",
      };
  }
}

const WORKFLOW_STEPS = [
  "uploading",
  "processing_pages",
  "detecting_chapters",
  "ready",
] as const;
const MAX_SINGLE_CHOICE_COUNT = 40;
const MAX_OPEN_QUESTION_COUNT = 20;
const MAX_TOTAL_QUESTION_COUNT =
  MAX_SINGLE_CHOICE_COUNT + MAX_OPEN_QUESTION_COUNT;

function getWorkflowStageRank(
  stage: "detecting_chapters" | "processing_pages" | "ready" | "uploading",
) {
  return WORKFLOW_STEPS.indexOf(stage);
}

function normalizeWorkflowStage(stage: string | null | undefined) {
  switch (stage) {
    case "uploading":
    case "processing_pages":
    case "detecting_chapters":
    case "ready":
      return stage;
    case "ocr_needed":
      return "ready";
    default:
      return "uploading";
  }
}

function normalizeRequestedCount(
  value: string | number,
  options: {
    fallback: number;
    max: number;
    min: number;
  },
) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return options.fallback;
  }

  return Math.min(options.max, Math.max(options.min, parsed));
}

type Props = {
  activeImportId?: string | null;
  embedded?: boolean;
  grade: number;
  hideImportTools?: boolean;
  onGeneratedStateChange?: (next: TextbookGeneratedState | null) => void;
  onMaterialStateChange?: (next: {
    importId: string;
    material: TextbookMaterial | null;
    uploadedAsset: TextbookUploadedAsset | null;
  }) => void;
  onQueuedImportConsumed?: (importId: string) => void;
  queuedImport?: {
    file?: File | null;
    fileName: string;
    id: string;
    materialId?: string | null;
    title: string;
    uploadedAsset?: TextbookUploadedAsset | null;
  } | null;
  subject: MaterialBuilderSubject;
};

export function TextbookProcessingSection({
  activeImportId = null,
  embedded = false,
  grade,
  hideImportTools = false,
  onGeneratedStateChange,
  onMaterialStateChange,
  onQueuedImportConsumed,
  queuedImport = null,
  subject,
}: Props) {
  const {
    expandedChapterIds,
    isLoadingR2,
    isProcessing,
    isUploading,
    materialDetail,
    r2Candidates,
    r2Error,
    selectedFile,
    selectedR2Candidate,
    selectedR2Key,
    setExpandedChapterIds,
    setSelectedFile,
    setSelectedR2Key,
    statusMessage,
    uploadProgressPercent,
    uploadedAsset,
    importBook,
    loadFromR2,
    loadMaterialById,
  } = useTextbookMaterialProcessing({
    enableR2Lookup: !hideImportTools,
    grade,
    subject,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState("10");
  const [openQuestionCount, setOpenQuestionCount] = useState("0");
  const [totalScore, setTotalScore] = useState("20");
  const [difficultyCounts, setDifficultyCounts] = useState({
    easy: "0",
    medium: "3",
    hard: "7",
  });
  const [generatedTest, setGeneratedTest] = useState<GeneratedTextbookTest | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [localStatusMessage, setLocalStatusMessage] = useState("");
  const consumedQueuedImportIdRef = useRef("");
  const lastMaterialSyncKeyRef = useRef("");

  const deferredSearch = useDeferredValue(searchTerm.trim());
  const tree = useMemo(
    () => buildSectionTree(materialDetail?.sections || []),
    [materialDetail?.sections],
  );
  const displayTree = useMemo(
    () =>
      applyTextbookDisplayTitleFallbacks(tree, {
        bookTitle:
          materialDetail?.material.title ||
          materialDetail?.material.fileName ||
          "",
        grade,
        subject,
      }),
    [grade, materialDetail?.material.fileName, materialDetail?.material.title, subject, tree],
  );
  const visibleTree = useMemo(
    () => filterTreeBySearch(embedded ? displayTree : tree, deferredSearch),
    [deferredSearch, displayTree, embedded, tree],
  );
  const selectedIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const selection = useMemo(
    () => resolveGenerateSelection(materialDetail, selectedNodeIds),
    [materialDetail, selectedNodeIds],
  );
  const selectedPageCount = useMemo(
    () => countSelectedPagesFromMaterial(materialDetail, selectedNodeIds),
    [materialDetail, selectedNodeIds],
  );
  const requestedTotalQuestionCount =
    (Number(questionCount) || 0) + (Number(openQuestionCount) || 0);
  const material = materialDetail?.material || null;
  const materialReady = material?.status === "ready";
  const materialNeedsOcr = material?.status === "ocr_needed";
  const workflowStage = isUploading
    ? "uploading"
    : normalizeWorkflowStage(material?.stage || null);
  const progressValue =
    isUploading
      ? getUploadWorkflowProgressValue(uploadProgressPercent)
      : getMaterialProgressValue(material);
  const progressMetaLabel = isUploading
    ? `${Math.max(uploadProgressPercent, 0)}%`
    : material?.stage === "processing_pages" && material.progressTotal > 0
      ? `${material.progressCurrent}/${material.progressTotal} хуудас`
      : material?.stage === "detecting_chapters"
        ? "Бүтэц боловсруулж байна"
        : material?.stage === "uploaded" || material?.status === "uploaded"
          ? "Хүлээгдэж байна"
        : materialReady
          ? "Бэлэн"
          : materialNeedsOcr
            ? "OCR хэрэгтэй"
            : "";
  const progressStepCards = WORKFLOW_STEPS.map((step) => {
    const stepRank = getWorkflowStageRank(step);
    const activeRank = getWorkflowStageRank(workflowStage);
    const state =
      workflowStage === step
        ? "active"
        : stepRank < activeRank || (materialReady && step === "ready")
          ? "done"
          : "pending";

    return {
      key: step,
      label:
        step === "ready" && materialNeedsOcr
          ? "OCR хэрэгтэй"
          : getStageLabel(step),
      state,
    };
  });
  const hasVisibleProgress =
    isUploading ||
    isProcessing ||
    Boolean(material) ||
    Boolean(selectedFile);
  const bannerMessage = localStatusMessage || statusMessage;
  const progressCopy = getReadableProgressCopy({
    fileName: material?.fileName || selectedFile?.name || uploadedAsset?.fileName || null,
    isUploading,
    material,
    message: bannerMessage,
    uploadProgressPercent,
  });

  const generatedState = useMemo<TextbookGeneratedState | null>(() => {
    if (!generatedTest || !material || !uploadedAsset) {
      return null;
    }

    return {
      bookTitle: getTextbookDisplayTitle({
        fallback:
          material.title?.trim() ||
          material.fileName.replace(/\.pdf$/i, "") ||
          "Сурах бичиг",
        grade,
        subject,
      }),
      fileName: material.fileName,
      generatedTest,
      materialId: material.id,
      selectedSectionIds: selection.effectiveNodeIds,
      selectedSectionTitles: selection.selectedSectionTitles,
      uploadedAsset,
    };
  }, [generatedTest, grade, material, selection, subject, uploadedAsset]);

  useEffect(() => {
    onGeneratedStateChange?.(generatedState);
  }, [generatedState, onGeneratedStateChange]);

  useEffect(() => {
    if (!onGeneratedStateChange) {
      return;
    }

    return () => {
      onGeneratedStateChange(null);
    };
  }, [onGeneratedStateChange]);

  useEffect(() => {
    setSelectedNodeIds([]);
    setGeneratedTest(null);
    setLocalStatusMessage("");
  }, [material?.id]);

  useEffect(() => {
    if (!queuedImport) {
      return;
    }

    if (consumedQueuedImportIdRef.current === queuedImport.id) {
      return;
    }

    consumedQueuedImportIdRef.current = queuedImport.id;
    onQueuedImportConsumed?.(queuedImport.id);
    if (queuedImport.materialId) {
      void (async () => {
        const materialId = queuedImport.materialId ?? "";
        if (!materialId) {
          return;
        }
        const loaded = await loadMaterialById(materialId);
        if (loaded) {
          return;
        }

        if (materialId.startsWith("local:") && queuedImport.file) {
          await importBook(queuedImport.file);
          return;
        }

        if (materialId.startsWith("local:")) {
          toast.error(
            "Локал материалаа дахин нээхийн тулд энэ session доторх эх PDF файл хэрэгтэй байна.",
          );
        }
      })();
      return;
    }

    if (
      queuedImport.uploadedAsset &&
      queuedImport.uploadedAsset.bucketName !== "local"
    ) {
      void loadFromR2(
        {
          bucketName: queuedImport.uploadedAsset.bucketName,
          fileName: queuedImport.uploadedAsset.fileName,
          key: queuedImport.uploadedAsset.key,
          lastModified: queuedImport.uploadedAsset.uploadedAt,
          matchScore: 100,
          size: queuedImport.uploadedAsset.size,
        },
        true,
      );
      return;
    }

    if (queuedImport.file) {
      void importBook(queuedImport.file);
    }
  }, [importBook, loadFromR2, loadMaterialById, onQueuedImportConsumed, queuedImport]);

  useEffect(() => {
    if (!activeImportId || !onMaterialStateChange) {
      return;
    }

    if (!material && !uploadedAsset) {
      return;
    }

    const syncKey = JSON.stringify({
      activeImportId,
      bucketName: uploadedAsset?.bucketName || "",
      errorMessage: material?.errorMessage || "",
      fileName: material?.fileName || uploadedAsset?.fileName || "",
      key: uploadedAsset?.key || "",
      materialId: material?.id || "",
      pageCount: material?.pageCount || 0,
      sectionCount: material?.sectionCount || 0,
      stage: material?.stage || "",
      status: material?.status || "",
      subchapterCount: material?.subchapterCount || 0,
      title: material?.title || "",
      uploadedAt: uploadedAsset?.uploadedAt || "",
    });

    if (lastMaterialSyncKeyRef.current === syncKey) {
      return;
    }

    lastMaterialSyncKeyRef.current = syncKey;

    onMaterialStateChange({
      importId: activeImportId,
      material,
      uploadedAsset,
    });
  }, [activeImportId, material, onMaterialStateChange, uploadedAsset]);

  useEffect(() => {
    cacheSessionTextbookMaterial({
      asset: uploadedAsset,
      detail: materialDetail,
      importId: activeImportId,
    });
    cachePersistedTextbookMaterial({
      asset: uploadedAsset,
      detail: materialDetail,
      importId: activeImportId,
    });
  }, [activeImportId, materialDetail, uploadedAsset]);

  function clearGeneratedPreview() {
    if (!generatedTest) {
      return;
    }

    setGeneratedTest(null);
    setLocalStatusMessage("Тохиргоо өөрчлөгдсөн тул шалгалтаа дахин үүсгэнэ үү.");
  }

  function handleQuestionCountChange(value: string) {
    clearGeneratedPreview();

    const nextQuestionCount = normalizeRequestedCount(value, {
      fallback: 10,
      max: MAX_SINGLE_CHOICE_COUNT,
      min: 1,
    });
    const nextOpenCount = Math.min(
      normalizeRequestedCount(openQuestionCount, {
        fallback: 0,
        max: MAX_OPEN_QUESTION_COUNT,
        min: 0,
      }),
      MAX_TOTAL_QUESTION_COUNT - nextQuestionCount,
    );

    setQuestionCount(String(nextQuestionCount));
    setOpenQuestionCount(String(nextOpenCount));
  }

  function handleOpenQuestionCountChange(value: string) {
    clearGeneratedPreview();

    const currentQuestionCount = normalizeRequestedCount(questionCount, {
      fallback: 10,
      max: MAX_SINGLE_CHOICE_COUNT,
      min: 1,
    });
    const nextOpenCount = normalizeRequestedCount(value, {
      fallback: 0,
      max: Math.min(MAX_OPEN_QUESTION_COUNT, MAX_TOTAL_QUESTION_COUNT - currentQuestionCount),
      min: 0,
    });

    setOpenQuestionCount(String(nextOpenCount));
  }

  function updateSectionSelection(sectionIds: string[], checked: boolean) {
    clearGeneratedPreview();
    setSelectedNodeIds((current) => {
      const next = new Set(current);
      for (const sectionId of sectionIds) {
        if (checked) {
          next.add(sectionId);
        } else {
          next.delete(sectionId);
        }
      }
      return Array.from(next);
    });
  }

  function toggleExpanded(sectionId: string) {
    setExpandedChapterIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  async function handleGenerate() {
    if (!materialDetail || !material) {
      toast.error("Эхлээд сурах бичгийн PDF оруулна уу.");
      return;
    }

    if (!materialReady) {
      toast.error("Сурах бичиг бүрэн боловсроогүй байна.");
      return;
    }

    if (selectedNodeIds.length === 0) {
      toast.error("Дор хаяж нэг бүлэг, сэдэв эсвэл дэд сэдэв сонгоно уу.");
      return;
    }

    setIsGenerating(true);
    setLocalStatusMessage("Сонгосон бодлогуудыг шалгаж, тест боловсруулж байна...");
    const generationStartedAtMs = Date.now();
    const minimumGenerateDurationMs = createGenerateDurationTargetMs();

    try {
      let generationDetail = materialDetail;
      const needsScopedLoad =
        generationDetail.chunks.length === 0 &&
        generationDetail.pages.length === 0 &&
        !material.id.startsWith("local:");

      if (needsScopedLoad) {
        setLocalStatusMessage("Сонгосон хэсгийн chunk-уудыг ачаалж байна...");
        const scopedDetail = await getTextbookMaterialSelectionByNodeIds(
          material.id,
          selectedNodeIds,
        );

        if (!scopedDetail || scopedDetail.sections.length === 0) {
          throw new Error("Сонгосон бүлгийн бүтэц DB-с олдсонгүй.");
        }

        if (scopedDetail.chunks.length === 0) {
          throw new Error(
            "Сонгосон хэсгээс generation хийх chunk олдсонгүй. PDF-г дахин боловсруулж шалгана уу.",
          );
        }

        generationDetail = scopedDetail;
      }

      const { result: fallbackTest, selectedSectionTitles } =
        generateTextbookTestFromMaterial(generationDetail, selectedNodeIds, {
          fallbackDifficulty: "hard",
          grade,
          questionCount: Number(questionCount) || 0,
          openQuestionCount: Number(openQuestionCount) || 0,
          totalScore: Number(totalScore) || 0,
          difficultyCounts: {
            easy: Number(difficultyCounts.easy) || 0,
            medium: Number(difficultyCounts.medium) || 0,
            hard: Number(difficultyCounts.hard) || 0,
          },
        });

      let result = fallbackTest;

      try {
        const generationSource = buildTextbookGenerationSourceFromMaterial(
          generationDetail,
          selectedNodeIds,
          {
            questionCount: Number(questionCount) || 0,
          },
        );
        result = await requestAiEnhancedTextbookTest({
          fallbackTest,
          grade,
          selectedSectionTitles,
          sourceProblems: generationSource.sourceProblems,
          visiblePages: generationSource.visiblePages.map((page) => ({
            pageNumber: page.pageNumber,
            content: compactTextbookPageContent(page).slice(0, 4000),
          })),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "AI route ажиллахгүй байна.";
        result = {
          ...fallbackTest,
          warnings: [...fallbackTest.warnings, message],
        };
        toast.warning(
          "AI route холбогдсонгүй. Local fallback тестийг ашиглалаа.",
        );
      }

      setLocalStatusMessage("Асуултуудын чанар, хариултуудыг шалгаж байна...");
      await ensureMinimumGenerateDuration(
        generationStartedAtMs,
        minimumGenerateDurationMs,
      );
      setGeneratedTest(result);
      setLocalStatusMessage(
        `${result.questionCountGenerated} сонголтот, ${result.openQuestionCountGenerated} задгай даалгавар бэлэн боллоо.`,
      );
      toast.success("Шалгалтын материал үүсгэлээ.");
    } catch (error) {
      await ensureMinimumGenerateDuration(
        generationStartedAtMs,
        minimumGenerateDurationMs,
      );
      setLocalStatusMessage("");
      toast.error(
        error instanceof Error
          ? error.message
          : "Тест үүсгэх үед алдаа гарлаа.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const displayTitle = getTextbookDisplayTitle({
    fallback: material?.title || material?.fileName || "Сурах бичиг",
    grade,
    subject,
  });
  const compactInputClassName =
    "!h-[40px] rounded-[12px] border-[#dfe5ef] bg-[#f5f7fb] text-[15px] text-slate-900 shadow-none";
  const compactPillInputClassName =
    "!h-[32px] w-[48px] rounded-[10px] border-[#d4dae5] bg-white text-center text-[14px] text-slate-900 shadow-none";
  const canGenerate =
    !isGenerating &&
    !isUploading &&
    !isProcessing &&
    materialReady &&
    selection.effectiveNodeIds.length > 0;

  if (embedded) {
    return (
      <section className="space-y-0">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_392px]">
          <div className="rounded-[20px] border border-[#e6ebf2] bg-white p-5">
            <h3 className="text-[17px] font-semibold text-[#0b5cab]">
              {displayTitle}
            </h3>

            <div className="relative mt-4">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Хичээлийн сэдвээр хайх"
                className="!h-[42px] rounded-[12px] border-[#e2e7f0] bg-white pr-10 text-[14px] text-slate-800 shadow-none"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="mt-4 h-[30rem] overflow-hidden rounded-[18px] border border-[#e6ebf2] bg-white">
              <ScrollArea className="h-full px-4 py-4">
                {material?.errorMessage ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-[14px] leading-6 text-[#8a5a13]">
                    {material.errorMessage}
                  </div>
                ) : materialNeedsOcr ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-[14px] leading-6 text-[#8a5a13]">
                    {material.unsupportedReason ||
                      "PDF-ийн зарим хуудас скан зурагтай тул OCR хэрэгтэй байна."}
                  </div>
                ) : !materialDetail || !materialReady ? (
                  <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                    <div
                      aria-atomic="true"
                      aria-live="polite"
                      className="w-full max-w-[22rem] rounded-[18px] border border-[#dbe4f3] bg-[#f7faff] p-4 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-[#dbe4f3] bg-white px-3 py-1 text-[11px] font-semibold text-[#0b5cab]">
                          {isUploading
                            ? getStageLabel("uploading")
                            : getStageLabel(material?.stage || "uploaded")}
                        </span>
                        {progressMetaLabel ? (
                          <span className="text-[12px] font-medium text-slate-600">
                            {progressMetaLabel}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-[15px] font-semibold text-slate-900">
                        {progressCopy.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-6 text-slate-600">
                        {progressCopy.description}
                      </p>

                      {(isUploading || isProcessing || progressValue > 0) && (
                        <div className="mt-4 space-y-2">
                          <Progress
                            value={progressValue}
                            className="h-2.5 bg-[#dbe7ff]"
                          />
                          <div className="flex items-center justify-between gap-3 text-[12px] text-slate-500">
                            <span>{bannerMessage || "Боловсруулж байна..."}</span>
                            {progressMetaLabel ? (
                              <span className="shrink-0 font-medium text-slate-700">
                                {progressMetaLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}

                      <p className="mt-3 text-[12px] leading-5 text-slate-500">
                        Дараагийн алхам: {progressCopy.nextStep}
                      </p>
                    </div>
                  </div>
                ) : visibleTree.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-[14px] leading-6 text-slate-500">
                    Хайлтад тохирох хэсэг олдсонгүй.
                  </div>
                ) : (
                  <SectionTree
                    compact
                    expandedIds={expandedChapterIds}
                    nodes={visibleTree}
                    onSelectionChange={updateSectionSelection}
                    onToggleExpanded={toggleExpanded}
                    selectedIdSet={selectedIdSet}
                  />
                )}
              </ScrollArea>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#e6ebf2] bg-white p-5">
            <h3 className="text-[17px] font-semibold text-[#0b5cab]">
              {displayTitle}
            </h3>

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <p className="text-[15px] font-medium text-slate-900">Тестийн тоо</p>
                <Input
                  type="number"
                  min={1}
                  max={MAX_SINGLE_CHOICE_COUNT}
                  value={questionCount}
                  onChange={(event) => handleQuestionCountChange(event.target.value)}
                  className={compactInputClassName}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[15px] font-medium text-slate-900">Тестийн төрлүүд</p>
                <div className="space-y-3">
                  <label className="flex min-h-[38px] items-center justify-between gap-3 rounded-[12px] border border-[#dfe5ef] bg-[#f5f7fb] px-4 text-[14px] text-slate-900">
                    <span>Нэг сонголттой</span>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_SINGLE_CHOICE_COUNT}
                      value={questionCount}
                      onChange={(event) => handleQuestionCountChange(event.target.value)}
                      className={compactPillInputClassName}
                    />
                  </label>
                  <div className="flex min-h-[38px] items-center justify-between gap-3 rounded-[12px] border border-[#dfe5ef] bg-[#f5f7fb] px-4 text-[14px] text-slate-900">
                    <span>Олон сонголттой</span>
                    <span className="inline-flex h-[32px] min-w-[48px] items-center justify-center rounded-[10px] border border-[#d4dae5] bg-white px-3 text-[14px] text-slate-700">
                      0
                    </span>
                  </div>
                  <div className="flex min-h-[38px] items-center justify-between gap-3 rounded-[12px] border border-[#dfe5ef] bg-[#f5f7fb] px-4 text-[14px] text-slate-900">
                    <span>Дараалал</span>
                    <span className="inline-flex h-[32px] min-w-[48px] items-center justify-center rounded-[10px] border border-[#d4dae5] bg-white px-3 text-[14px] text-slate-700">
                      0
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[15px] font-medium text-slate-900">
                  Задгай даалгаврын тоо
                </p>
                <Input
                  type="number"
                  min={0}
                  max={Math.min(
                    MAX_OPEN_QUESTION_COUNT,
                    MAX_TOTAL_QUESTION_COUNT -
                      normalizeRequestedCount(questionCount, {
                        fallback: 10,
                        max: MAX_SINGLE_CHOICE_COUNT,
                        min: 1,
                      }),
                  )}
                  value={openQuestionCount}
                  onChange={(event) =>
                    handleOpenQuestionCountChange(event.target.value)
                  }
                  className={compactInputClassName}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[15px] font-medium text-slate-900">Нийт оноо</p>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={totalScore}
                  onChange={(event) => {
                    clearGeneratedPreview();
                    setTotalScore(event.target.value);
                  }}
                  className={compactInputClassName}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[15px] font-medium text-slate-900">Хүндрэлийн зэрэг</p>
                <div className="space-y-3">
                  {([
                    ["easy", "Энгийн"],
                    ["medium", "Дунд"],
                    ["hard", "Хүнд"],
                  ] as const).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-[38px] items-center justify-between gap-3 rounded-[12px] border border-[#dfe5ef] bg-[#f5f7fb] px-4 text-[14px] text-slate-900"
                    >
                      <span>{label}</span>
                      <Input
                        type="number"
                        min={0}
                        max={40}
                        value={difficultyCounts[key]}
                        onChange={(event) => {
                          clearGeneratedPreview();
                          setDifficultyCounts((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }));
                        }}
                        className={compactPillInputClassName}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                className="!mt-6 !h-[48px] w-full rounded-[12px] bg-[#0b5cab] text-[19px] font-semibold hover:bg-[#0a4f96]"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? "Үүсгэж байна..." : "Шалгалт үүсгэх"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={embedded ? "space-y-4" : "mt-5 space-y-4"}>
      {!embedded ? (
        <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
          <BookOpen className="h-5 w-5 text-[#2563eb]" />
          Сурах бичиг
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[404px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
          {!hideImportTools ? (
            <div className="rounded-[18px] border border-dashed border-[#cddcf3] bg-[#f7faff] p-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#2563eb] shadow-[0_6px_18px_rgba(37,99,235,0.10)]">
                  <FileUp className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold text-slate-900">
                    Сурах бичгийн PDF оруулах
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-600">
                    PDF-ийг эхлээд R2-д хадгалаад, дараа нь хуудас-хуудасаар
                    worker дээр боловсруулж бүтэцлэнэ. Нэг удаа бэлэн болсон
                    бүтэц дараагийн generate дээр дахин PDF parse хийхгүй.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[12px] border border-[#dbe4f3] bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">
                      R2-оос сурах бичиг хайх
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {grade}-р анги · {getSubjectLabel(subject)}
                    </p>
                    <p className="mt-1 break-all text-[12px] text-slate-500">
                      Хүлээгдэж буй файл: {getExpectedR2FileName(grade, subject)}
                    </p>
                  </div>
                  {isLoadingR2 ? (
                    <Loader2 className="mt-1 h-4 w-4 animate-spin text-[#0b5cab]" />
                  ) : null}
                </div>

                {r2Candidates.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    <Select
                      value={selectedR2Key}
                      onValueChange={setSelectedR2Key}
                    >
                      <SelectTrigger className="!h-[40px] w-full rounded-[10px] border-[#dbe4f3] bg-[#eef3ff] text-left text-[13px] text-slate-800">
                        <SelectValue placeholder="R2-оос ном сонгох" />
                      </SelectTrigger>
                      <SelectContent>
                        {r2Candidates.map((candidate) => (
                          <SelectItem key={candidate.key} value={candidate.key}>
                            {candidate.fileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadFromR2()}
                      disabled={!selectedR2Candidate || isUploading || isProcessing}
                      className="h-[38px] w-full rounded-[10px] border-[#dbe4f3] bg-white px-3 text-[13px] text-slate-700 hover:bg-slate-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                      {selectedR2Candidate
                        ? `${selectedR2Candidate.fileName} ачаалах`
                        : "R2-оос ачаалах"}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[10px] border border-dashed border-[#dbe4f3] bg-[#f8fbff] px-3 py-3 text-[13px] text-slate-500">
                    {r2Error
                      ? `R2 алдаа: ${r2Error}`
                      : isLoadingR2
                        ? "R2-оос сурах бичиг хайж байна..."
                        : "Тохирох ном жагсаалтаас олдсонгүй. PDF-ээ гараар оруулж болно."}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                  }}
                  className="cursor-pointer rounded-[12px] border-[#dbe4f3] bg-white file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#0b5cab] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-white"
                />

                <Button
                  type="button"
                  onClick={() => selectedFile && void importBook(selectedFile)}
                  disabled={!selectedFile || isUploading || isLoadingR2 || isProcessing}
                  className="!h-[42px] w-full rounded-[12px] bg-[#0b5cab] text-[15px] font-semibold hover:bg-[#0a4f96]"
                >
                  {isUploading || isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="h-4 w-4" />
                  )}
                  {isUploading
                    ? `Хадгалж байна ${Math.max(uploadProgressPercent, 0)}%`
                    : isProcessing
                      ? "Боловсруулж байна..."
                      : "Сурах бичиг ачаалах"}
                </Button>
              </div>
            </div>
          ) : null}

          {hasVisibleProgress ? (
            <div
              aria-atomic="true"
              aria-live="polite"
              className="space-y-4 rounded-[16px] border border-[#dbe4f3] bg-white px-4 py-4 text-[13px] text-slate-700"
            >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {material?.title ||
                        material?.fileName ||
                        selectedFile?.name ||
                        "Сурах бичиг"}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {isUploading
                        ? "PDF файлыг R2 руу байршуулж байна."
                        : material
                          ? `${material.pageCount || 0} хуудас, ${material.sectionCount} сэдэв, ${material.subchapterCount} дэд сэдэв`
                          : "Файл бэлтгэж байна."}
                    </p>
                  </div>
                  <div className="rounded-full border border-[#dbe4f3] bg-[#f8fbff] px-3 py-1 text-[11px] font-medium text-[#0b5cab]">
                    {isUploading
                      ? getStageLabel("uploading")
                      : getStageLabel(material?.stage || "uploaded")}
                  </div>
                </div>

                <div className="rounded-[14px] border border-[#edf2fb] bg-[#f8fbff] px-3 py-3">
                  <p className="text-[14px] font-semibold text-slate-900">
                    {progressCopy.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">
                    {progressCopy.description}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    Дараагийн алхам: {progressCopy.nextStep}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[12px] text-slate-500">
                    <span>{bannerMessage || "Бэлтгэж байна..."}</span>
                    <span className="shrink-0 font-medium text-slate-700">
                      {progressMetaLabel}
                    </span>
                  </div>
                  <Progress value={progressValue} className="h-2.5 bg-[#e8efff]" />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {progressStepCards.map((step) => (
                    <div
                      key={step.key}
                      className={
                        step.state === "done"
                          ? "rounded-[12px] border border-[#cfe0ff] bg-[#f1f7ff] px-3 py-2"
                          : step.state === "active"
                            ? "rounded-[12px] border border-[#9fc4ff] bg-[#e8f1ff] px-3 py-2 shadow-[0_4px_10px_rgba(37,99,235,0.10)]"
                            : "rounded-[12px] border border-[#e6edf7] bg-[#fbfdff] px-3 py-2"
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            step.state === "done"
                              ? "h-2.5 w-2.5 rounded-full bg-[#0b5cab]"
                              : step.state === "active"
                                ? "h-2.5 w-2.5 rounded-full bg-[#2563eb]"
                                : "h-2.5 w-2.5 rounded-full bg-slate-300"
                          }
                        />
                        <p className="text-[12px] font-medium text-slate-800">
                          {step.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {uploadedAsset ? (
                  <p className="break-all text-[12px] text-slate-500">
                    R2: {uploadedAsset.bucketName}/{uploadedAsset.key}
                  </p>
                ) : null}
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[20px] font-semibold text-[#0b5cab]">
                {material?.title || material?.fileName || "Сурах бичиг"}
              </h3>
              <div className="text-right text-[12px] text-slate-500">
                <p>{selection.effectiveNodeIds.length} хэсэг</p>
                <p>{selectedPageCount} хуудас</p>
              </div>
            </div>

            <div className="relative mt-4">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Бүлэг, сэдвээр хайх"
                className="!h-[40px] rounded-[12px] border-[#dbe4f3] bg-white pr-10 text-[14px] text-slate-800"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateSectionSelection(collectSelectableNodeIds(materialDetail), true)
                }
                disabled={!materialDetail}
                className="h-[36px] rounded-[10px] border-[#dbe4f3] bg-white px-3 text-[13px] text-slate-700 hover:bg-slate-50"
              >
                Бүгдийг сонгох
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearGeneratedPreview();
                  setSelectedNodeIds([]);
                }}
                disabled={selectedNodeIds.length === 0}
                className="h-[36px] rounded-[10px] border-[#dbe4f3] bg-white px-3 text-[13px] text-slate-700 hover:bg-slate-50"
              >
                Цэвэрлэх
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[360px] rounded-[16px] border border-[#e6edf7] bg-[#fbfdff] px-3 py-3">
            {!materialDetail ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-[14px] leading-6 text-slate-500">
                PDF оруулсны дараа бүлэг, сэдвийн бүтэц энд харагдана.
              </div>
            ) : visibleTree.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-[14px] leading-6 text-slate-500">
                Хайлтад тохирох хэсэг олдсонгүй.
              </div>
            ) : (
              <SectionTree
                expandedIds={expandedChapterIds}
                nodes={visibleTree}
                onSelectionChange={updateSectionSelection}
                onToggleExpanded={toggleExpanded}
                selectedIdSet={selectedIdSet}
              />
            )}
          </ScrollArea>

          <div className="space-y-4 rounded-[18px] border border-[#edf2fb] bg-[#fbfdff] p-4">
            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Тестийн тоо</p>
              <Input
                type="number"
                min={1}
                max={MAX_SINGLE_CHOICE_COUNT}
                value={questionCount}
                onChange={(event) => handleQuestionCountChange(event.target.value)}
                className="!h-[44px] rounded-[12px] border-[#dbe4f3] bg-[#eef3ff]"
              />
              <p className="text-[12px] text-slate-500">
                Generate болох сонголтот тестийн тоо. Нийт асуулт:{" "}
                {requestedTotalQuestionCount}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Тестийн төрлүүд</p>
              <div className="space-y-3">
                <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
                  <span>Нэг сонголттой</span>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_SINGLE_CHOICE_COUNT}
                    value={questionCount}
                    onChange={(event) => handleQuestionCountChange(event.target.value)}
                    className="!h-[34px] w-[74px] rounded-[10px] border-[#c7d3e7] bg-white text-center"
                  />
                </label>
                <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
                  <span>Задгай</span>
                  <Input
                    type="number"
                    min={0}
                    max={Math.min(
                      MAX_OPEN_QUESTION_COUNT,
                      MAX_TOTAL_QUESTION_COUNT -
                        normalizeRequestedCount(questionCount, {
                          fallback: 10,
                          max: MAX_SINGLE_CHOICE_COUNT,
                          min: 1,
                        }),
                    )}
                    value={openQuestionCount}
                    onChange={(event) =>
                      handleOpenQuestionCountChange(event.target.value)
                    }
                    className="!h-[34px] w-[74px] rounded-[10px] border-[#c7d3e7] bg-white text-center"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Нийт оноо</p>
              <Input
                type="number"
                min={1}
                max={500}
                value={totalScore}
                onChange={(event) => {
                  clearGeneratedPreview();
                  setTotalScore(event.target.value);
                }}
                className="!h-[44px] rounded-[12px] border-[#dbe4f3] bg-[#eef3ff]"
              />
            </div>

            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Хүндрэлийн зэрэг</p>
              <div className="space-y-3">
                {([
                  ["easy", "Энгийн"],
                  ["medium", "Дунд"],
                  ["hard", "Хүнд"],
                ] as const).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800"
                  >
                    <span>{label}</span>
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      value={difficultyCounts[key]}
                      onChange={(event) => {
                        clearGeneratedPreview();
                        setDifficultyCounts((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }));
                      }}
                      className="!h-[34px] w-[74px] rounded-[10px] border-[#c7d3e7] bg-white text-center"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={
              isGenerating ||
              isUploading ||
              isProcessing ||
              !materialReady ||
              selection.effectiveNodeIds.length === 0
            }
            className="!h-[44px] w-full rounded-[12px] bg-[#0b5cab] text-[18px] font-semibold hover:bg-[#0a4f96]"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Үүсгэж байна..." : "Шалгалт үүсгэх"}
          </Button>
        </aside>

        <div className="space-y-5">
          {bannerMessage ? (
            <div className="rounded-[18px] border border-[#d7e6ff] bg-[#f4f8ff] px-5 py-4 text-[14px] text-[#1d4f91]">
              <div className="flex items-start justify-between gap-4">
                <p>{bannerMessage}</p>
                {progressMetaLabel ? (
                  <span className="shrink-0 text-[12px] font-semibold text-[#0b5cab]">
                    {progressMetaLabel}
                  </span>
                ) : null}
              </div>
              {(isUploading || isProcessing) && progressValue > 0 ? (
                <Progress value={progressValue} className="mt-3 h-2 bg-[#dbe7ff]" />
              ) : null}
            </div>
          ) : null}

          {material?.errorMessage ? (
            <div className="rounded-[18px] border border-[#fde8c8] bg-[#fff9ef] px-5 py-4 text-[14px] text-[#8a5a13]">
              {material.errorMessage}
            </div>
          ) : null}

          {materialNeedsOcr ? (
            <div className="rounded-[18px] border border-[#fde8c8] bg-[#fff9ef] px-5 py-4 text-[14px] text-[#8a5a13]">
              {material.unsupportedReason ||
                "PDF-ийн зарим хуудас скан зурагтай тул OCR хэрэгтэй байна."}
            </div>
          ) : null}

          {generatedTest?.warnings.length ? (
            <div className="rounded-[18px] border border-[#fde8c8] bg-[#fff9ef] px-5 py-4 text-[14px] text-[#8a5a13]">
              <p className="font-semibold text-[#7a4d0a]">Санамж</p>
              <div className="mt-2 space-y-2">
                {generatedTest.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          {!generatedTest ? (
            <div className="rounded-[20px] border border-[#e3e9f4] bg-white p-6 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <p className="text-[20px] font-semibold text-slate-900">
                Model-ийн гаргалгаа
              </p>
              <p className="mt-2 max-w-[720px] text-[15px] leading-7 text-slate-600">
                PDF upload хийгээд зүүн талаас бүлэг, сэдэв, дэд сэдвээ
                сонгоно. Generate дарахад зөвхөн cache-д хадгалсан бүтэцтэй
                section/chunk өгөгдлөөс тест үүсгэнэ.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-4">
                <div className="rounded-[16px] border border-[#e6edf7] bg-[#fbfdff] p-4">
                  <p className="text-[13px] font-medium text-slate-500">
                    Сонгосон хэсэг
                  </p>
                  <p className="mt-2 text-[24px] font-semibold text-slate-900">
                    {selection.effectiveNodeIds.length}
                  </p>
                </div>
                <div className="rounded-[16px] border border-[#e6edf7] bg-[#fbfdff] p-4">
                  <p className="text-[13px] font-medium text-slate-500">
                    Хамрах хуудас
                  </p>
                  <p className="mt-2 text-[24px] font-semibold text-slate-900">
                    {selectedPageCount}
                  </p>
                </div>
                <div className="rounded-[16px] border border-[#e6edf7] bg-[#fbfdff] p-4">
                  <p className="text-[13px] font-medium text-slate-500">
                    Илэрсэн сэдэв
                  </p>
                  <p className="mt-2 text-[24px] font-semibold text-slate-900">
                    {material?.sectionCount || 0}
                  </p>
                </div>
                <div className="rounded-[16px] border border-[#e6edf7] bg-[#fbfdff] p-4">
                  <p className="text-[13px] font-medium text-slate-500">
                    Илэрсэн дэд сэдэв
                  </p>
                  <p className="mt-2 text-[24px] font-semibold text-slate-900">
                    {material?.subchapterCount || 0}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {generatedTest.questions.map((question, index) => (
                <TextbookQuestionCard
                  key={question.id}
                  answerMode="single-choice"
                  answerText={getChoiceText(question)}
                  answers={question.choices}
                  countValue={String(index + 1)}
                  difficultyValue={question.difficulty}
                  focusValue="practice"
                  formatValue="single-choice"
                  content={
                    <div className="space-y-3">
                      <Textarea
                        value={question.bookProblem || question.question}
                        readOnly
                        className={textareaClassName}
                      />
                      <div className="flex flex-wrap gap-2 text-[12px] text-slate-500">
                        <span className="rounded-full border border-[#dbe4f3] bg-white px-3 py-1">
                          Номын бодлого
                        </span>
                        {question.sourcePages.length > 0 ? (
                          <span className="rounded-full border border-[#dbe4f3] bg-white px-3 py-1">
                            Хуудас: {question.sourcePages.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  }
                />
              ))}

              {generatedTest.openQuestions.map((task, index) => (
                <TextbookQuestionCard
                  key={task.id}
                  answerMode="written"
                  answerText={task.answer || "Бодолтын дагуу үнэлнэ."}
                  answers={[task.answer || "Бодолтын дагуу үнэлнэ."]}
                  countValue={String(generatedTest.questions.length + index + 1)}
                  difficultyValue={task.difficulty}
                  focusValue="proof"
                  formatValue="written"
                  content={
                    <div className="space-y-3">
                      <Textarea
                        value={task.prompt}
                        readOnly
                        className={textareaClassName}
                      />
                      <div className="flex flex-wrap gap-2 text-[12px] text-slate-500">
                        <span className="rounded-full border border-[#dbe4f3] bg-white px-3 py-1">
                          {task.score} оноо
                        </span>
                        {task.sourcePages.length > 0 ? (
                          <span className="rounded-full border border-[#dbe4f3] bg-white px-3 py-1">
                            Хуудас: {task.sourcePages.join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
