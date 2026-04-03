"use client";

import { useApolloClient, useLazyQuery, useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";

import { ExamSessionMetadataForm } from "@/components/exam/exam-session-metadata-form";
import { MathExamControls } from "@/components/exam/math-exam-controls";
import { EditorSection } from "@/components/exam/math-exam-editor-section";
import { runMathExamDemo } from "@/components/exam/demo-button";
import { Button } from "@/components/ui/button";

import {
  createDefaultGeneratorSettings,
  createDefaultSectionState,
  createMcqQuestion,
  createMathQuestion,
  createQuestion,
  getQuestionCollections,
  normalizeGeneratedQuestions,
  normalizeImportedQuestions,
  type ExamQuestion,
  type GeneratorSettings,
  type QuestionSectionState,
} from "@/lib/math-exam-model";
import {
  requestExtractedExam,
  requestGeneratedExam,
} from "@/lib/math-exam-api";
import type { ExtractExamEnhanceFocus } from "@/lib/math-exam-contract";
import { buildAblyAuthUrl } from "@/lib/runtime-api";
import { SaveNewMathExamDocument } from "@/gql/create-exam-documents";
import {
  GetNewMathExamDocument,
  ListNewMathExamsDocument,
} from "@/gql/create-exam-documents";
import {
  MathExamQuestionType,
  type NewMathExamSessionMetaInput,
  type SaveNewMathExamInput,
  type SaveNewMathExamPayload,
} from "@/gql/graphql";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PreviewSection } from "./math-exam-student";
import { normalizeBackendMathText } from "@/lib/normalize-math-text";
import {
  createDefaultExamSessionMetadata,
  type ExamSessionExamType,
  type ExamSessionMetadata,
  type ExamSessionSubject,
} from "@/lib/exam-session-metadata";
import { confirmDeleteAction } from "@/lib/confirm-destructive-action";

const EXAM_DRAFT_STORAGE_KEY = "pinequest-math-exam-draft";

type StoredMathExamDraft = {
  v: 1;
  editorSections: QuestionSectionState;
  examTitle: string;
  generatorSettings: GeneratorSettings;
  previewSections: QuestionSectionState;
  questions: ExamQuestion[];
  sessionMetadata: ExamSessionMetadata;
};

const SESSION_EXAM_TYPES: ExamSessionExamType[] = [
  "progress",
  "term",
  "year_final",
  "practice",
];
const SESSION_SUBJECTS: ExamSessionSubject[] = [
  "math",
  "physics",
  "mongolian",
];

type AblyChannelLike = {
  subscribe: (eventName: string, listener: () => void) => void;
  unsubscribe: () => void;
};

type AblyRealtimeLike = {
  channels: {
    get: (channelName: string) => AblyChannelLike;
  };
  close: () => void;
};

type AblyModule = {
  Realtime?: new (config: {
    authMethod: string;
    authUrl: string;
  }) => AblyRealtimeLike;
  default?: {
    Realtime?: new (config: {
      authMethod: string;
      authUrl: string;
    }) => AblyRealtimeLike;
  };
};

type StoredBankExamQuestion = {
  answerLatex?: string | null;
  correctOption?: number | null;
  id: string;
  imageAlt?: string | null;
  imageDataUrl?: string | null;
  options?: string[] | null;
  points: number;
  prompt?: string | null;
  responseGuide?: string | null;
  type: MathExamQuestionType;
};

type StoredBankExam = {
  examId: string;
  generator?: {
    difficulty?: string | null;
    sourceContext?: string | null;
    topics?: string | null;
  } | null;
  mathCount: number;
  mcqCount: number;
  questions?: StoredBankExamQuestion[] | null;
  sessionMeta?: {
    grade?: number | null;
    groupClass?: string | null;
    examType?: string | null;
    subject?: string | null;
    topics?: string[] | null;
    teacherId?: string | null;
    roomId?: string | null;
    examDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes?: number | null;
    mixQuestions?: boolean | null;
    withVariants?: boolean | null;
    variantCount?: number | null;
    description?: string | null;
  } | null;
  title: string;
  totalPoints: number;
};

function sessionMetadataToGqlInput(
  meta: ExamSessionMetadata,
): NewMathExamSessionMetaInput {
  return {
    grade: meta.grade ?? undefined,
    groupClass: meta.groupClass || undefined,
    examType: meta.examType ?? undefined,
    subject: meta.subject ?? undefined,
    topics: meta.topics.length ? meta.topics : undefined,
    teacherId: meta.teacherId.trim() || undefined,
    roomId: meta.roomId.trim() || undefined,
    examDate: meta.examDate.trim() || undefined,
    startTime: meta.startTime.trim() || undefined,
    endTime: meta.endTime || undefined,
    durationMinutes: meta.durationMinutes ?? undefined,
    mixQuestions: meta.mixQuestions,
    withVariants: meta.withVariants,
    variantCount: meta.variantCount ?? undefined,
    description: meta.description || undefined,
  };
}

function parseStoredExamType(
  v: string | null | undefined,
): ExamSessionExamType | null {
  return v && SESSION_EXAM_TYPES.includes(v as ExamSessionExamType)
    ? (v as ExamSessionExamType)
    : null;
}

function parseStoredSubject(
  v: string | null | undefined,
): ExamSessionSubject | null {
  return v && SESSION_SUBJECTS.includes(v as ExamSessionSubject)
    ? (v as ExamSessionSubject)
    : null;
}

function importOptionalModule<T = unknown>(moduleName: string) {
  return new Function(
    "specifier",
    "return import(specifier);",
  )(moduleName) as Promise<T>;
}

function loadStoredMathExamDraft(): StoredMathExamDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(EXAM_DRAFT_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredMathExamDraft>;

    if (parsed.v !== 1 || !Array.isArray(parsed.questions)) {
      return null;
    }

    return {
      v: 1,
      examTitle: typeof parsed.examTitle === "string" ? parsed.examTitle : "",
      questions: parsed.questions.map((question) =>
        question.type === "mcq"
          ? createMcqQuestion({
              ...question,
              correctOption:
                typeof question.correctOption === "number"
                  ? question.correctOption
                  : null,
              options: Array.isArray(question.options)
                ? question.options
                : undefined,
            })
          : createMathQuestion(question),
      ),
      generatorSettings: {
        ...createDefaultGeneratorSettings(),
        ...(parsed.generatorSettings ?? {}),
      },
      sessionMetadata: {
        ...createDefaultExamSessionMetadata(),
        ...(parsed.sessionMetadata ?? {}),
        topics: Array.isArray(parsed.sessionMetadata?.topics)
          ? parsed.sessionMetadata.topics
          : [],
      },
      editorSections: {
        ...createDefaultSectionState(),
        ...(parsed.editorSections ?? {}),
      },
      previewSections: {
        ...createDefaultSectionState(),
        ...(parsed.previewSections ?? {}),
      },
    };
  } catch {
    return null;
  }
}

function clearStoredMathExamDraft() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(EXAM_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isMathExamDraftEmpty(snapshot: Omit<StoredMathExamDraft, "v">) {
  return (
    !snapshot.examTitle.trim() &&
    snapshot.questions.length === 0 &&
    JSON.stringify(snapshot.generatorSettings) ===
      JSON.stringify(createDefaultGeneratorSettings()) &&
    JSON.stringify(snapshot.sessionMetadata) ===
      JSON.stringify(createDefaultExamSessionMetadata()) &&
    JSON.stringify(snapshot.editorSections) ===
      JSON.stringify(createDefaultSectionState()) &&
    JSON.stringify(snapshot.previewSections) ===
      JSON.stringify(createDefaultSectionState())
  );
}

export default function MathExam() {
  const apolloClient = useApolloClient();
  const [examTitle, setExamTitle] = useState("");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [bankExams, setBankExams] = useState<{ examId: string; title: string }[]>(
    [],
  );
  const [previewSections, setPreviewSections] = useState(
    createDefaultSectionState,
  );
  const [editorSections, setEditorSections] = useState(
    createDefaultSectionState,
  );
  const [generatorSettings, setGeneratorSettings] = useState(
    createDefaultGeneratorSettings,
  );
  const [generatorError, setGeneratorError] = useState("");
  const [isExtractingSource, setIsExtractingSource] = useState(false);
  const [isEnhancingSource, setIsEnhancingSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessionMetadata, setSessionMetadata] = useState<ExamSessionMetadata>(
    createDefaultExamSessionMetadata,
  );
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);

  const [saveNewMathExamMutation] = useMutation(SaveNewMathExamDocument);
  const [fetchExamList] = useLazyQuery(ListNewMathExamsDocument, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });
  const [fetchExamById] = useLazyQuery(GetNewMathExamDocument, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    totalPoints,
    mathCount,
    mathEditorQuestions,
    mathQuestions,
    mcqCount,
    mcqEditorQuestions,
    mcqQuestions,
  } = getQuestionCollections(questions);
  const requestedQuestionCount =
    generatorSettings.mcqCount + generatorSettings.mathCount;

  useEffect(() => {
    const storedDraft = loadStoredMathExamDraft();

    if (storedDraft) {
      setExamTitle(storedDraft.examTitle);
      setQuestions(storedDraft.questions);
      setGeneratorSettings(storedDraft.generatorSettings);
      setSessionMetadata(storedDraft.sessionMetadata);
      setEditorSections(storedDraft.editorSections);
      setPreviewSections(storedDraft.previewSections);
    }

    setHasLoadedDraft(true);
  }, []);

  useEffect(() => {
    const authUrl = buildAblyAuthUrl();
    let active = true;
    let cleanup: (() => void) | null = null;

    void importOptionalModule<AblyModule>("ably")
      .then((mod) => {
        if (!active) return;
        const AblyRealtime = mod.default?.Realtime ?? mod.Realtime;

        if (!AblyRealtime) {
          return;
        }

        const realtime = new AblyRealtime({
          authUrl,
          authMethod: "POST",
        });

        const channel = realtime.channels.get("new-math-exams");
        channel.subscribe("exam.saved", () => {
          // Refresh list cache; dropdown UI state will pick it up on next open (or via cache-first query).
          void apolloClient.refetchQueries({ include: [ListNewMathExamsDocument] });
          setBankExams([]);
        });

        cleanup = () => {
          try {
            channel.unsubscribe();
            realtime.close();
          } catch {
            // ignore
          }
        };
      })
      .catch(() => {
        // Ignore realtime init failures; exam editing should still work.
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [apolloClient]);

  useEffect(() => {
    if (!hasLoadedDraft) {
      return;
    }

    const snapshot = {
      editorSections,
      examTitle,
      generatorSettings,
      previewSections,
      questions,
      sessionMetadata,
    };

    if (isMathExamDraftEmpty(snapshot)) {
      clearStoredMathExamDraft();
      return;
    }

    try {
      window.localStorage.setItem(
        EXAM_DRAFT_STORAGE_KEY,
        JSON.stringify({
          v: 1,
          ...snapshot,
        } satisfies StoredMathExamDraft),
      );
    } catch {
      // ignore
    }
  }, [
    editorSections,
    examTitle,
    generatorSettings,
    hasLoadedDraft,
    previewSections,
    questions,
    sessionMetadata,
  ]);

  const normalizeImportedText = (value: string) => normalizeBackendMathText(value);

  async function handleRequestBankExams() {
    try {
      const listResult = await fetchExamList({ variables: { limit: 50 } });
      const exams =
        (listResult.data as
          | { listNewMathExams?: { examId: string; title: string }[] }
          | undefined)?.listNewMathExams ?? [];
      setBankExams(exams);
    } catch {
      setBankExams([]);
    }
  }

  async function handleImportFromBank(examIdRaw: string) {
    setGeneratorError("");
    setSaveError(null);
    setSavedExamId(null);

    try {
      const examResult = await fetchExamById({
        variables: { examId: examIdRaw },
      });
      const exam = (
        examResult.data as
          | {
              getNewMathExam?: StoredBankExam | null;
            }
          | undefined
      )?.getNewMathExam;
      if (!exam) {
        throw new Error("Сонгосон шалгалтын дэлгэрэнгүй ирсэнгүй.");
      }

      setIsGeneratorOpen(false);
      setSourceFiles([]);
      setExamTitle(exam.title);
      if (exam.sessionMeta) {
        const sm = exam.sessionMeta;
        setSessionMetadata({
          grade: sm.grade ?? null,
          groupClass: sm.groupClass ?? "",
          examType: parseStoredExamType(sm.examType ?? undefined),
          subject: parseStoredSubject(sm.subject ?? undefined),
          topics: sm.topics ?? [],
          teacherId: sm.teacherId ?? "",
          roomId: sm.roomId ?? "",
          examDate: sm.examDate ?? "",
          startTime: sm.startTime ?? "",
          endTime: sm.endTime ?? "",
          durationMinutes: sm.durationMinutes ?? null,
          mixQuestions: sm.mixQuestions ?? false,
          withVariants: sm.withVariants ?? false,
          variantCount: sm.variantCount ?? null,
          description: sm.description ?? "",
        });
      } else {
        setSessionMetadata(createDefaultExamSessionMetadata());
      }
      setGeneratorSettings((current) => ({
        ...current,
        difficulty:
          exam.generator?.difficulty === "easy" ||
          exam.generator?.difficulty === "medium" ||
          exam.generator?.difficulty === "advanced"
            ? exam.generator.difficulty
            : current.difficulty,
        topics: exam.generator?.topics ?? "",
        sourceContext: exam.generator?.sourceContext ?? "",
        mcqCount: exam.mcqCount,
        mathCount: exam.mathCount,
        totalPoints: exam.totalPoints,
      }));

      const nextQuestions: ExamQuestion[] = (exam.questions ?? []).map((q) =>
        q.type === MathExamQuestionType.Mcq
          ? createMcqQuestion({
              id: q.id,
              prompt: normalizeImportedText(q.prompt ?? ""),
              points: q.points,
              imageAlt: q.imageAlt ?? "",
              imageDataUrl: q.imageDataUrl ?? undefined,
              options: (q.options ?? []).map((opt: string) =>
                normalizeImportedText(opt),
              ),
              correctOption: q.correctOption ?? null,
            })
          : createMathQuestion({
              id: q.id,
              prompt: normalizeImportedText(q.prompt ?? ""),
              points: q.points,
              imageAlt: q.imageAlt ?? "",
              imageDataUrl: q.imageDataUrl ?? undefined,
              responseGuide: normalizeImportedText(q.responseGuide ?? ""),
              answerLatex: q.answerLatex ?? "",
            }),
      );

      setQuestions(nextQuestions);
      resetSectionState();
    } catch (e) {
      setGeneratorError(
        e instanceof Error ? e.message : "Сангаас шалгалт татахад алдаа гарлаа.",
      );
    }
  }

  function resetSectionState() {
    setEditorSections(createDefaultSectionState());
    setPreviewSections(createDefaultSectionState());
  }

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

  function addQuestion(type: "mcq" | "math") {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      createQuestion(type),
    ]);
  }

  async function removeQuestion(questionId: string) {
    if (
      !(await confirmDeleteAction(
        "Энэ асуултыг",
        "Шалгалтын жагсаалтаас хасагдана.",
      ))
    ) {
      return;
    }

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

  function handleDemo() {
    runMathExamDemo({
      setGeneratorError,
      setSaveError,
      setSavedExamId,
      setIsGeneratorOpen,
      setSourceFiles,
      setGeneratorSettings,
      setQuestions,
      resetSectionState,
    });
  }

  function handleResetAll() {
    setGeneratorError("");
    setSaveError(null);
    setSavedExamId(null);
    setSaving(false);

    setExamTitle("");
    setSessionMetadata(createDefaultExamSessionMetadata());
    setQuestions([]);
    setSourceFiles([]);
    setGeneratorSettings(createDefaultGeneratorSettings());
    setIsGeneratorOpen(false);
    resetSectionState();
    clearStoredMathExamDraft();
  }

  async function handleGenerateExam() {
    setGeneratorError("");
    setIsGenerating(true);

    try {
      const exam = await requestGeneratedExam({
        ...generatorSettings,
        files: sourceFiles,
      });
      const nextQuestions = normalizeGeneratedQuestions(exam, {
        mathCount: generatorSettings.mathCount,
        mcqCount: generatorSettings.mcqCount,
        totalPoints: generatorSettings.totalPoints,
      });

      setQuestions(nextQuestions);
      setExamTitle(exam.title?.trim() || "AI үүсгэсэн жишиг шалгалт");
      resetSectionState();
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

  async function handleSourceFilesSelected(files: File[]) {
    setSourceFiles(files);
    setIsGeneratorOpen(false);
    setGeneratorSettings((current) => ({
      ...current,
      sourceContext: "",
    }));

    if (files.length === 0) {
      return;
    }

    setGeneratorError("");
    setIsExtractingSource(true);

    try {
      const exam = await requestExtractedExam(files, { mode: "fast" });
      applyImportedExam(exam, "Docs-оос импортолсон шалгалт");
    } catch (error) {
      setGeneratorError(
        error instanceof Error
          ? error.message
          : "Файлаас асуултуудыг таньж чадсангүй.",
      );
    } finally {
      setIsExtractingSource(false);
    }
  }

  function applyImportedExam(exam: Awaited<ReturnType<typeof requestExtractedExam>>, fallbackTitle: string) {
    const sourceImagesByName = Object.fromEntries(
      (exam.sourceImages ?? [])
        .filter(
          (image): image is { dataUrl: string; name: string } =>
            typeof image.name === "string" &&
            image.name.trim().length > 0 &&
            typeof image.dataUrl === "string" &&
            image.dataUrl.trim().length > 0,
        )
        .map((image) => [image.name, image.dataUrl]),
    );
    const normalizedImportedQuestions = normalizeImportedQuestions(
      exam,
      sourceImagesByName,
    );

    if (normalizedImportedQuestions.length === 0) {
      throw new Error("Файлаас танигдсан асуулт олдсонгүй.");
    }

    setQuestions(normalizedImportedQuestions);
    setExamTitle(exam.title?.trim() || fallbackTitle);
    resetSectionState();
  }

  async function handleEnhanceImportedExam(focus: ExtractExamEnhanceFocus) {
    if (sourceFiles.length === 0) {
      setGeneratorError("Эхлээд Docs file-аа fast import хийнэ үү.");
      return;
    }

    setGeneratorError("");
    setIsEnhancingSource(true);

    try {
      const exam = await requestExtractedExam(sourceFiles, {
        enhanceFocus: focus,
        mode: "enhance",
      });
      applyImportedExam(exam, "AI сайжруулсан импорт");
    } catch (error) {
      setGeneratorError(
        error instanceof Error
          ? error.message
          : "AI сайжруулалт хийхэд алдаа гарлаа.",
      );
    } finally {
      setIsEnhancingSource(false);
    }
  }

  async function handleSaveToDatabase() {
    setSaveError(null);
    setSaving(true);
    try {
      const input: SaveNewMathExamInput = {
        examId: savedExamId ?? undefined,
        title: examTitle.trim() || "Нэргүй шалгалт",
        mcqCount,
        mathCount,
        totalPoints,
        generator: {
          difficulty: generatorSettings.difficulty,
          topics: generatorSettings.topics,
          sourceContext: generatorSettings.sourceContext,
        },
        sessionMeta: sessionMetadataToGqlInput(sessionMetadata),
        questions: questions.map((q) =>
          q.type === "mcq"
            ? {
                type: MathExamQuestionType.Mcq,
                prompt: q.prompt,
                points: q.points,
                imageAlt: q.imageAlt || undefined,
                imageDataUrl: q.imageDataUrl,
                options: q.options,
                correctOption:
                  q.correctOption === null ? undefined : q.correctOption,
              }
            : {
                type: MathExamQuestionType.Math,
                prompt: q.prompt,
                points: q.points,
                imageAlt: q.imageAlt || undefined,
                imageDataUrl: q.imageDataUrl,
                responseGuide: q.responseGuide,
                answerLatex: q.answerLatex,
              },
        ),
      };

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
        throw new Error("Хариу дээр examId ирээгүй байна.");
      }
      toast.success("Амжилттай хадгаллаа.");
      handleResetAll();
      setBankExams([]);
      setSavedExamId(examId);

      // DB өөрчлөгдсөн тул list cache-аа шинэчилнэ.
      await apolloClient.refetchQueries({
        include: [ListNewMathExamsDocument],
      });
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "Өгөгдлийн санд хадгалахад алдаа гарлаа.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.98))] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ExamSessionMetadataForm
            metadata={sessionMetadata}
            onMetadataChange={setSessionMetadata}
            examTitle={examTitle}
            onExamTitleChange={setExamTitle}
          />
          <MathExamControls
            examTitle={examTitle}
            generatorError={generatorError}
            generatorSettings={generatorSettings}
            isEnhancingSource={isEnhancingSource}
            isExtractingSource={isExtractingSource}
            isGenerating={isGenerating}
            isGeneratorOpen={isGeneratorOpen}
            onAddQuestion={addQuestion}
            onDemo={handleDemo}
            onGenerateExam={handleGenerateExam}
            onGeneratorOpenChange={setIsGeneratorOpen}
            bankExams={bankExams}
            onRequestBankExams={handleRequestBankExams}
            onImportFromBank={handleImportFromBank}
            onEnhanceImportedExam={handleEnhanceImportedExam}
            onReset={handleResetAll}
            onSourceFilesSelected={handleSourceFilesSelected}
            requestedQuestionCount={requestedQuestionCount}
            setGeneratorSettings={setGeneratorSettings}
            sourceFiles={sourceFiles}
            stats={{
              mathCount,
              mcqCount,
              totalPoints,
            }}
          />

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
              emptyText="Задгай даалгаврын хэсэгт хараахан асуулт алга."
            />

            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              {savedExamId ? (
                <p className="mb-3 text-xs text-muted-foreground">
                  Хадгалсан шалгалтын ID:{" "}
                  <span className="font-mono text-foreground">
                    {savedExamId}
                  </span>
                </p>
              ) : null}
              {saveError ? (
                <p className="mb-3 text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveToDatabase()}
                >
                  {saving ? "Хадгалж байна…" : "Өгөгдлийн санд хадгалах"}
                </Button>
              </div>
            </div>
          </div>
        </div>

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
