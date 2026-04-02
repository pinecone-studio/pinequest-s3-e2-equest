"use client";

import { useApolloClient, useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ListNewMathExamsDocument,
  SaveNewMathExamDocument,
} from "@/gql/create-exam-documents";
import {
  MathExamQuestionType,
  type SaveNewMathExamInput,
  type SaveNewMathExamPayload,
} from "@/gql/graphql";
import { Button } from "@/components/ui/button";
import { TestShell } from "../../_components/test-shell";
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

const DEFAULT_GENERAL_INFO: MaterialBuilderGeneralInfo = {
  durationMinutes: 30,
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

  const mathQuestions = textbookState.generatedTest.openQuestions.map((task) => ({
    type: MathExamQuestionType.Math,
    prompt: task.prompt.trim() || "Задгай даалгавар",
    points: normalizePoints(task.score || task.points),
    responseGuide: buildResponseGuide(task.answer, task.sourceExcerpt),
    answerLatex: task.answer.trim() || undefined,
  }));

  const questions = [...mcqQuestions, ...mathQuestions];
  const totalPoints = questions.reduce(
    (sum, question) => sum + normalizePoints(question.points),
    0,
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

export default function MaterialBuilderPageContent() {
  const apolloClient = useApolloClient();
  const [saveNewMathExamMutation] = useMutation(SaveNewMathExamDocument);
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
  const [queuedImportedTextbookId, setQueuedImportedTextbookId] = useState<string | null>(
    null,
  );
  const [savedExamId, setSavedExamId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeImportedTextbook =
    importedTextbooks.find((item) => item.id === activeImportedTextbookId) || null;
  const selectedTextbookLibrary =
    importedTextbooks.find((item) => item.id === selectedTextbookLibraryId) || null;
  const queuedImportedTextbook =
    importedTextbooks.find((item) => item.id === queuedImportedTextbookId) || null;

  useEffect(() => {
    setSavedExamId(null);
  }, [textbookGeneratedState?.generatedTest]);

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
    const selected = importedTextbooks.find((item) => item.id === importId);
    if (!selected) {
      return;
    }

    if (selected.materialStatus !== "ready" && selected.materialStatus !== "ocr_needed") {
      toast.message("Энэ ном боловсруулж дуусаагүй байна. Импорт хэсгээс явцыг нь харна уу.");
      return;
    }

    setSelectedTextbookLibraryId(importId);
    setQueuedImportedTextbookId(importId);
  }

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <GeneralInfoSection value={generalInfo} onChange={setGeneralInfo} />
        <SourceSelector source={source} onChange={setSource} />
        {source === "question-bank" ? <QuestionBankSection /> : null}
        {source === "import" ? (
          <div className="space-y-5">
            <ImportSection
              activeImportId={activeImportedTextbookId}
              importedTextbooks={importedTextbooks}
              onTextbookPicked={handleTextbookPicked}
              onOpenImportedTextbook={handleOpenImportedTextbook}
            />
            {activeImportedTextbook ? (
              <TextbookSection
                activeImportId={activeImportedTextbookId}
                grade={generalInfo.grade}
                hideImportTools
                onMaterialStateChange={handleImportedTextbookMaterialStateChange}
                subject={generalInfo.subject}
                onGeneratedStateChange={setTextbookGeneratedState}
                queuedImport={queuedImportedTextbook}
                onQueuedImportConsumed={(importId) => {
                  setQueuedImportedTextbookId((current) =>
                    current === importId ? null : current,
                  );
                }}
              />
            ) : null}
          </div>
        ) : null}
        {source === "textbook" ? (
          <div className="space-y-5">
            <TextbookLibrarySection
              activeId={selectedTextbookLibraryId}
              items={importedTextbooks}
              onSelect={handleTextbookLibrarySelect}
            />
            {selectedTextbookLibrary ? (
              <TextbookSection
                activeImportId={selectedTextbookLibraryId}
                grade={generalInfo.grade}
                hideImportTools
                onMaterialStateChange={handleImportedTextbookMaterialStateChange}
                subject={generalInfo.subject}
                onGeneratedStateChange={setTextbookGeneratedState}
                queuedImport={queuedImportedTextbook}
                onQueuedImportConsumed={(importId) => {
                  setQueuedImportedTextbookId((current) =>
                    current === importId ? null : current,
                  );
                }}
              />
            ) : null}
          </div>
        ) : null}
        {source === "shared-library" ? (
          <SharedLibrarySection
            selectedMaterialId={selectedSharedMaterialId}
            onSelectMaterialId={setSelectedSharedMaterialId}
          />
        ) : null}

        <div className="flex items-center justify-end pt-10">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={
              isSaving ||
              ((source === "textbook" || source === "import") &&
                !textbookGeneratedState)
            }
            className="h-[42px] min-w-[128px] rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96]"
          >
            {source === "shared-library"
              ? "Сонгосон материалыг ашиглах"
              : isSaving
                ? "Хадгалж байна..."
                : "Хадгалах"}
          </Button>
        </div>
      </div>
    </TestShell>
  );
}
