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
import { getStageLabel } from "./status";
import { SectionTree } from "./SectionTree";
import {
  buildSectionTree,
  countSelectedPagesFromMaterial,
  resolveGenerateSelection,
} from "./selectors";
import {
  buildTextbookGenerationSourceFromMaterial,
  generateTextbookTestFromMaterial,
} from "./legacy-generation-adapter";
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
  TextbookStatField,
} from "@/app/test/material-builder/_components/material-builder-ui";
import { textareaClassName } from "@/app/test/material-builder/_components/material-builder-config";

type TextbookGenerateApiResponse = {
  error?: string;
  test?: GeneratedTextbookTest;
};

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
  sourceProblems,
  selectedSectionTitles,
  visiblePages,
}: {
  fallbackTest: GeneratedTextbookTest;
  selectedSectionTitles: string[];
  sourceProblems: TextbookSourceProblem[];
  visiblePages: Array<{ content: string; pageNumber: number }>;
}) {
  const response = await fetch("/api/textbook-generate", {
    body: JSON.stringify({
      fallbackTest,
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

const WORKFLOW_STEPS = [
  "uploading",
  "processing_pages",
  "detecting_chapters",
  "ready",
] as const;

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

type Props = {
  activeImportId?: string | null;
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
    file: File;
    fileName: string;
    id: string;
    title: string;
    uploadedAsset?: TextbookUploadedAsset | null;
  } | null;
  subject: MaterialBuilderSubject;
};

export function TextbookProcessingSection({
  activeImportId = null,
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
  } = useTextbookMaterialProcessing({
    enableR2Lookup: !hideImportTools,
    grade,
    subject,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState("10");
  const [openQuestionCount, setOpenQuestionCount] = useState("2");
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
  const visibleTree = useMemo(
    () => filterTreeBySearch(tree, deferredSearch),
    [deferredSearch, tree],
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
      ? Math.max(uploadProgressPercent, 2)
      : material && material.progressTotal > 0
      ? Math.min(100, Math.round((material.progressCurrent / material.progressTotal) * 100))
      : materialReady
        ? 100
        : 0;
  const progressMetaLabel = isUploading
    ? `${Math.max(uploadProgressPercent, 0)}%`
    : material?.stage === "processing_pages" && material.progressTotal > 0
      ? `${material.progressCurrent}/${material.progressTotal} хуудас`
      : material?.stage === "detecting_chapters"
        ? "Бүтэц боловсруулж байна"
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

  const generatedState = useMemo<TextbookGeneratedState | null>(() => {
    if (!generatedTest || !material || !uploadedAsset) {
      return null;
    }

    return {
      bookTitle:
        material.title?.trim() ||
        material.fileName.replace(/\.pdf$/i, "") ||
        "Сурах бичиг",
      fileName: material.fileName,
      generatedTest,
      materialId: material.id,
      selectedSectionIds: selection.effectiveNodeIds,
      selectedSectionTitles: selection.selectedSectionTitles,
      uploadedAsset,
    };
  }, [generatedTest, material, selection, uploadedAsset]);

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

    void importBook(queuedImport.file);
  }, [importBook, loadFromR2, onQueuedImportConsumed, queuedImport]);

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

  function clearGeneratedPreview() {
    if (!generatedTest) {
      return;
    }

    setGeneratedTest(null);
    setLocalStatusMessage("Тохиргоо өөрчлөгдсөн тул шалгалтаа дахин үүсгэнэ үү.");
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

    try {
      const { result: fallbackTest, selectedSectionTitles } =
        generateTextbookTestFromMaterial(materialDetail, selectedNodeIds, {
          fallbackDifficulty: "hard",
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
          materialDetail,
          selectedNodeIds,
          {
            questionCount: Number(questionCount) || 0,
          },
        );
        result = await requestAiEnhancedTextbookTest({
          fallbackTest,
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

      setGeneratedTest(result);
      setLocalStatusMessage(
        `${result.questionCountGenerated} сонголтот, ${result.openQuestionCountGenerated} задгай даалгавар бэлэн боллоо.`,
      );
      toast.success("Шалгалтын материал үүсгэлээ.");
    } catch (error) {
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

  return (
    <section className="mt-5 space-y-4">
      <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
        <BookOpen className="h-5 w-5 text-[#2563eb]" />
        Сурах бичиг
      </div>

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
                    ? `R2-д хадгалж байна ${Math.max(uploadProgressPercent, 0)}%`
                    : isProcessing
                      ? "Боловсруулж байна..."
                      : "Сурах бичиг ачаалах"}
                </Button>
              </div>
            </div>
          ) : null}

          {hasVisibleProgress ? (
            <div className="space-y-4 rounded-[16px] border border-[#dbe4f3] bg-white px-4 py-4 text-[13px] text-slate-700">
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
            <TextbookStatField
              label="Тестийн тоо"
              value={requestedTotalQuestionCount}
            />

            <div className="space-y-2">
              <p className="text-[15px] font-medium text-slate-900">Тестийн төрлүүд</p>
              <div className="space-y-3">
                <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
                  <span>Нэг сонголттой</span>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    value={questionCount}
                    onChange={(event) => {
                      clearGeneratedPreview();
                      setQuestionCount(event.target.value);
                    }}
                    className="!h-[34px] w-[74px] rounded-[10px] border-[#c7d3e7] bg-white text-center"
                  />
                </label>
                <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
                  <span>Задгай</span>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={openQuestionCount}
                    onChange={(event) => {
                      clearGeneratedPreview();
                      setOpenQuestionCount(event.target.value);
                    }}
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
