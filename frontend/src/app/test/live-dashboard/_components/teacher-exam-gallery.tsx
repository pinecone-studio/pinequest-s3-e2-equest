"use client";

import { useApolloClient } from "@apollo/client/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Eye,
  Flag,
  GraduationCap,
  MoreVertical,
  PlusCircle,
  Printer,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import MathPreviewText from "@/components/math-preview-text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GetNewMathExamDocument } from "@/gql/create-exam-documents";
import type { ExamQuestion } from "@/lib/math-exam-model";
import {
  normalizeBackendLatexOnly,
  normalizeBackendMathText,
} from "@/lib/normalize-math-text";
import { cn } from "@/lib/utils";
import type { Exam } from "../lib/types";

const UNKNOWN_GRADE_VALUE = "__unknown_grade__";
const FILTER_TRIGGER_CLASS =
  "!h-[41px] !w-[152px] !min-w-[152px] !rounded-[12px] !border !border-[#d9e2ec] !bg-white !px-4 !text-[15px] !font-medium !text-slate-700 shadow-none hover:!bg-white focus-visible:ring-0 [&_[data-slot=select-value]]:max-w-[110px] [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-left";

type TeacherExamGalleryProps = {
  error?: string | null;
  exams: Exam[];
  onSelectExam: (exam: Exam) => void;
};

type ExamActionId = "delete" | "preview" | "print" | "schedule";

type RawExamQuestion = {
  answerLatex?: string | null;
  correctOption?: number | null;
  id: string;
  imageAlt?: string | null;
  imageDataUrl?: string | null;
  options?: string[] | null;
  points?: number | null;
  prompt: string;
  responseGuide?: string | null;
  type: string;
};

type LoadedExamDetail = {
  examId: string;
  questions: ExamQuestion[];
  sessionMeta?: {
    durationMinutes?: number | null;
    examType?: string | null;
    grade?: number | null;
    groupClass?: string | null;
    subject?: string | null;
  } | null;
  title: string;
};

type PreviewExamState = {
  detail: LoadedExamDetail | null;
  summary: Exam;
};

type PrintableExamState = {
  detail: LoadedExamDetail;
  summary: Exam;
};

type PrintJobState = {
  exam: PrintableExamState;
  jobId: number;
};

export function TeacherExamGallery({
  error,
  exams,
  onSelectExam,
}: TeacherExamGalleryProps) {
  const client = useApolloClient();
  const hiddenPrintContentRef = useRef<HTMLDivElement | null>(null);
  const printJobCounterRef = useRef(0);
  const lastPrintedJobIdRef = useRef<number | null>(null);
  const [activeMenuExamId, setActiveMenuExamId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [previewExam, setPreviewExam] = useState<PreviewExamState | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  const [deleteTargetExam, setDeleteTargetExam] = useState<Exam | null>(null);
  const [printJob, setPrintJob] = useState<PrintJobState | null>(null);
  const [examDetailCache, setExamDetailCache] = useState<
    Record<string, LoadedExamDetail>
  >({});

  const gradeOptions = useMemo(
    () =>
      [...new Set(exams.map((exam) => normalizeGradeValue(exam.class)))].sort(),
    [exams],
  );

  const filteredExams = useMemo(
    () =>
      exams
        .filter((exam) => {
          const isLive = exam.liveStudentCount > 0 && !exam.endTime;
          const matchesGrade =
            gradeFilter === "all" ||
            normalizeGradeValue(exam.class) === gradeFilter;
          const matchesType =
            typeFilter === "all" ||
            (typeFilter === "live" && isLive) ||
            (typeFilter === "completed" && !isLive);

          return matchesGrade && matchesType;
        })
        .sort(
          (left, right) => right.startTime.getTime() - left.startTime.getTime(),
        ),
    [exams, gradeFilter, typeFilter],
  );

  const loadExamDetail = useCallback(
    async (exam: Exam) => {
      const cachedExam = examDetailCache[exam.id];
      if (cachedExam) {
        return cachedExam;
      }

      const result = await client.query({
        query: GetNewMathExamDocument,
        variables: { examId: exam.id },
        fetchPolicy: "no-cache",
      });

      const rawExam = (
        result.data as
          | {
              getNewMathExam?: {
                examId: string;
                questions: RawExamQuestion[];
                sessionMeta?: LoadedExamDetail["sessionMeta"];
                title: string;
              } | null;
            }
          | undefined
      )?.getNewMathExam;

      if (!rawExam) {
        throw new Error("Шалгалтын дэлгэрэнгүй мэдээлэл олдсонгүй.");
      }

      const detail: LoadedExamDetail = {
        examId: rawExam.examId,
        questions: rawExam.questions.map(mapRawQuestionToExamQuestion),
        sessionMeta: rawExam.sessionMeta,
        title: rawExam.title,
      };

      setExamDetailCache((current) => ({
        ...current,
        [exam.id]: detail,
      }));

      return detail;
    },
    [client, examDetailCache],
  );

  const openExamDialog = useCallback(
    (exam: Exam) => {
      setPreviewLoadError(null);
      setPreviewExam({
        detail: examDetailCache[exam.id] ?? null,
        summary: exam,
      });

      if (examDetailCache[exam.id]) {
        return;
      }

      void loadExamDetail(exam)
        .then((detail) => {
          setPreviewExam((current) =>
            current?.summary.id === exam.id
              ? {
                  detail,
                  summary: exam,
                }
              : current,
          );
        })
        .catch((nextError) => {
          const message =
            nextError instanceof Error
              ? nextError.message
              : "Шалгалтын preview ачаалж чадсангүй.";

          setPreviewLoadError(message);
          toast.error(message);
        });
    },
    [examDetailCache, loadExamDetail],
  );

  const handlePrintExam = useCallback(
    async (exam: Exam) => {
      const toastId = toast.loading("Хэвлэхэд бэлдэж байна...");

      try {
        const detail = examDetailCache[exam.id] ?? (await loadExamDetail(exam));

        printJobCounterRef.current += 1;
        setPrintJob({
          exam: {
            detail,
            summary: exam,
          },
          jobId: printJobCounterRef.current,
        });
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Хэвлэх мэдээлэл ачаалж чадсангүй.";

        toast.error(message);
      } finally {
        toast.dismiss(toastId);
      }
    },
    [examDetailCache, loadExamDetail],
  );

  useEffect(() => {
    if (!printJob || !hiddenPrintContentRef.current) {
      return;
    }

    if (lastPrintedJobIdRef.current === printJob.jobId) {
      return;
    }

    lastPrintedJobIdRef.current = printJob.jobId;
    let isActive = true;

    void printPreviewContent(
      hiddenPrintContentRef.current,
      printJob.exam.detail?.title ?? printJob.exam.summary.title ?? "Шалгалт",
    ).finally(() => {
      if (isActive) {
        setPrintJob((current) =>
          current?.jobId === printJob.jobId ? null : current,
        );
      }
    });

    return () => {
      isActive = false;
    };
  }, [printJob]);

  const handleMenuAction = useCallback(
    (action: ExamActionId, exam: Exam) => {
      if (action === "preview") {
        openExamDialog(exam);
        return;
      }

      if (action === "print") {
        void handlePrintExam(exam);
        return;
      }

      if (action === "schedule") {
        toast.info("Шалгалт товлох action дараагийн алхмаар холбоно.");
        return;
      }

      setDeleteTargetExam(exam);
    },
    [handlePrintExam, openExamDialog],
  );

  return (
    <>
      <section className="min-h-full">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div />

          <div onClick={(event) => event.stopPropagation()}>
            <Link
              href="/test/material-builder"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0b5cab] px-6 text-[16px] font-semibold text-white shadow-[0_12px_24px_rgba(11,92,171,0.18)] transition-transform hover:-translate-y-0.5"
            >
              <PlusCircle className="h-4 w-4" />
              Шинэ шалгалт үүсгэх
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">
              Миний үүсгэсэн шалгалтууд
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger
                className={cn(
                  FILTER_TRIGGER_CLASS,
                  gradeFilter !== "all"
                    ? "!border-[#b8cbe2] !text-[#0b5cab]"
                    : "",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[14px] border border-[#d9e2ec] p-1 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <SelectItem value="all">Анги</SelectItem>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {formatGradeLabel(grade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className={cn(
                  FILTER_TRIGGER_CLASS,
                  typeFilter !== "all"
                    ? "!border-[#b8cbe2] !text-[#0b5cab]"
                    : "",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[14px] border border-[#d9e2ec] p-1 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                <SelectItem value="all">Төрөл</SelectItem>
                <SelectItem value="live">Явц</SelectItem>
                <SelectItem value="live">Бататгах</SelectItem>
                <SelectItem value="completed">Улирал</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {filteredExams.length > 0 ? (
          <div className="mt-4 grid gap-6 xl:grid-cols-3">
            {filteredExams.map((exam) => (
              <article
                key={exam.id}
                onClick={() => onSelectExam(exam)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectExam(exam);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`rounded-[22px] border bg-white p-7 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 ${
                  activeMenuExamId === exam.id
                    ? "border-[#0b5cab] shadow-[0_0_0_1px_rgba(11,92,171,0.12)]"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="flex items-center gap-2 text-[18px] font-semibold text-slate-900">
                    <GraduationCap className="h-5 w-5" />
                    {formatExamClassLabel(exam.class)}
                  </p>
                  <ExamActionsMenu
                    exam={exam}
                    onAction={handleMenuAction}
                    onOpenChange={(isOpen) =>
                      setActiveMenuExamId(isOpen ? exam.id : null)
                    }
                  />
                </div>

                <h3 className="mt-7 text-[20px] font-bold leading-snug text-slate-900">
                  {exam.title}
                </h3>

                <div className="mt-8 space-y-3 text-[15px] text-slate-500">
                  <p className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    {getEstimatedDurationLabel(exam)}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Үүсгэсэн огноо: {formatExamDate(exam.startTime)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
            Сонгосон filter-т тохирох шалгалт олдсонгүй.
          </div>
        )}
      </section>

      <ExamPreviewDialog
        exam={previewExam}
        error={previewLoadError}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewExam(null);
            setPreviewLoadError(null);
          }
        }}
      />

      {printJob ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[-200vw] top-0 w-[1024px] opacity-0"
        >
          <div ref={hiddenPrintContentRef}>
            <PrintableExamSheet exam={printJob.exam} />
          </div>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(deleteTargetExam)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetExam(null);
          }
        }}
      >
        <AlertDialogContent
          size="sm"
          className="rounded-[24px] border border-[#e7d7d7] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]"
        >
          <AlertDialogHeader className="px-6 py-6 text-left">
            <AlertDialogMedia className="mb-0 rounded-full bg-[#fef2f2] text-[#dc2626]">
              <Trash2 className="h-5 w-5" />
            </AlertDialogMedia>
            <AlertDialogTitle className="w-full text-[20px] font-semibold text-slate-900 sm:text-left">
              Шалгалтыг устгах уу?
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 w-full text-[14px] leading-6 text-slate-500 sm:text-left">
              <span className="font-semibold text-slate-700">
                {deleteTargetExam?.title ?? "Сонгосон шалгалт"}
              </span>{" "}
              шалгалтыг устгавал буцааж сэргээх боломжгүй. Үргэлжлүүлэх үү?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="!mx-0 !mb-0 !grid !grid-cols-2 !border-t-0 !bg-transparent gap-4 rounded-b-[24px] px-6 py-5 sm:!grid sm:!grid-cols-2 sm:justify-stretch">
            <AlertDialogCancel
              className="h-12 w-full min-w-0 rounded-[14px] border border-[#d9e2ec] bg-white px-4 text-[15px] font-semibold text-slate-800 shadow-none hover:bg-slate-50"
              onClick={() => setDeleteTargetExam(null)}
            >
              Болих
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12 w-full min-w-0 rounded-[14px] border border-[#1976d2] bg-[#1976d2] px-4 text-[15px] font-semibold text-white shadow-none hover:border-[#0f66c2] hover:bg-[#0f66c2]"
              onClick={() => {
                toast.info(
                  "Устгах серверийн action хараахан холбогдоогүй байна.",
                );
                setDeleteTargetExam(null);
              }}
            >
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExamPreviewDialog({
  exam,
  error,
  onOpenChange,
}: {
  exam: PreviewExamState | null;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const questionCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, number>
  >({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>(
    {},
  );
  const [flaggedQuestions, setFlaggedQuestions] = useState<
    Record<string, boolean>
  >({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (!exam?.detail?.examId) {
      setSelectedOptions({});
      setWrittenAnswers({});
      setFlaggedQuestions({});
      setActiveQuestionId(null);
      return;
    }

    setSelectedOptions({});
    setWrittenAnswers({});
    setFlaggedQuestions({});
    setActiveQuestionId(exam.detail.questions[0]?.id ?? null);
  }, [exam?.detail?.examId, exam?.detail?.questions]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const detail = exam?.detail;

    if (!root || !detail?.questions.length) {
      return;
    }

    const nodes = detail.questions
      .map(
        (question) =>
          [question.id, questionCardRefs.current[question.id]] as const,
      )
      .filter((entry): entry is [string, HTMLElement] => Boolean(entry[1]));

    if (nodes.length === 0) {
      return;
    }

    setActiveQuestionId(nodes[0][0]);

    const observer = new IntersectionObserver(
      (entries) => {
        const topEntry = [...entries]
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          )[0];

        const questionId = topEntry?.target.getAttribute("data-question-id");
        if (questionId) {
          setActiveQuestionId(questionId);
        }
      },
      {
        root,
        rootMargin: "-10% 0px -48% 0px",
        threshold: [0.2, 0.45, 0.75],
      },
    );

    nodes.forEach(([, node]) => observer.observe(node));

    return () => observer.disconnect();
  }, [exam?.detail]);

  const durationMinutes = exam
    ? getDurationMinutes(exam.summary, exam.detail)
    : 0;
  const previewTitle = exam?.detail?.title ?? exam?.summary.title ?? "Шалгалт";
  const previewSubject = formatSubjectLabel(
    exam?.detail?.sessionMeta?.subject ?? exam?.summary.subject,
  );
  const previewClass = exam
    ? formatPreviewClassLabel(exam.summary, exam.detail)
    : "Тодорхойгүй";
  const previewType = formatExamTypeLabel(exam?.detail?.sessionMeta?.examType);
  const questionCount =
    exam?.detail?.questions.length ?? exam?.summary.questionCount ?? 0;
  const timeLeftLabel = formatTimerLabel(durationMinutes);

  const scrollToQuestion = (questionId: string) => {
    questionCardRefs.current[questionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handlePreviewAction = (action: "save" | "submit") => {
    toast.info(
      action === "submit"
        ? "Preview mode тул эцсийн илгээлт хийхгүй."
        : "Preview mode тул явц хадгалахгүй.",
    );
  };

  return (
    <Dialog open={Boolean(exam)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,56rem)] w-[min(100vw-1.5rem,76rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[28px] border border-[#dfe7f3] bg-white p-0 shadow-[0_30px_80px_-28px_rgba(15,23,42,0.28)]">
        <DialogHeader className="sr-only">
          <DialogTitle>{previewTitle}</DialogTitle>
          <DialogDescription>
            Сурагчийн take-exam screen-тэй ижил preview.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f8] text-slate-900"
        >
          <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <div className="mb-5 flex items-start justify-between gap-4 rounded-[18px] border border-slate-200/80 bg-[#f7f7f8] px-4 py-3 sm:mb-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {previewType}
                </p>
                <div className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[20px]">
                  <MathPreviewText
                    content={previewTitle}
                    contentSource="backend"
                    className="[&_.katex-display]:my-2"
                  />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {previewSubject} · {previewClass} · {questionCount} асуулт
                </p>
              </div>
            </div>

            {error ? (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : exam?.detail ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_256px] lg:items-start lg:gap-5">
                <div className="order-2 space-y-4 lg:order-1 lg:space-y-6">
                  {exam.detail.questions.map((question, index) => {
                    const selectedOption = selectedOptions[question.id];
                    const writtenValue = writtenAnswers[question.id] ?? "";
                    const isFlagged = Boolean(flaggedQuestions[question.id]);

                    return (
                      <div
                        key={question.id}
                        className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start lg:gap-5"
                      >
                        <aside className="bg-transparent" />

                        <article
                          data-question-id={question.id}
                          ref={(node) => {
                            questionCardRefs.current[question.id] = node;
                          }}
                          className="rounded-[24px] border border-[#dfe7ef] bg-[#f4fbff] px-4 py-5 shadow-[0_8px_20px_rgba(148,163,184,0.12)] sm:px-6 sm:py-7 lg:rounded-[28px] lg:px-7 lg:py-8"
                        >
                          <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="flex items-center gap-3">
                              <span className="rounded-full border border-[#cfe0ef] bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                                Сорил {index + 1}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <span className="rounded-full border border-[#d7e6f2] bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                                Бүтэн оноо {question.points.toFixed(1)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setFlaggedQuestions((current) => ({
                                    ...current,
                                    [question.id]: !current[question.id],
                                  }))
                                }
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                                  isFlagged
                                    ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "border-[#b9d8ed] bg-white text-[#1e6d99] hover:bg-[#eef8ff]",
                                )}
                              >
                                <Flag className="h-3.5 w-3.5" />
                                {isFlagged ? "Тэмдэглэсэн" : "Тэмдэглэх"}
                              </button>
                            </div>
                          </div>

                          <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
                            <MathPreviewText
                              content={question.prompt}
                              contentSource="backend"
                              displayMode={question.type === "math"}
                              className="text-base font-medium leading-7 text-slate-900 sm:text-[18px] sm:leading-8"
                            />
                          </div>

                          {question.imageDataUrl ? (
                            <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={question.imageDataUrl}
                                alt={
                                  question.imageAlt || `Question ${index + 1}`
                                }
                                className="max-h-80 w-auto max-w-full object-contain"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-4 pl-0 sm:space-y-5 sm:pl-1">
                            {question.type === "math" ? (
                              <div className="space-y-3">
                                <textarea
                                  value={writtenValue}
                                  onChange={(event) =>
                                    setWrittenAnswers((current) => ({
                                      ...current,
                                      [question.id]: event.target.value,
                                    }))
                                  }
                                  onInput={(event) => {
                                    const target = event.currentTarget;
                                    target.style.height = "auto";
                                    target.style.height = `${Math.max(target.scrollHeight, 112)}px`;
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.stopPropagation();
                                    }
                                  }}
                                  placeholder="Хариугаа энд бичнэ үү..."
                                  className="min-h-28 w-full resize-none overflow-hidden rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 shadow-[0_10px_24px_rgba(148,163,184,0.10)] outline-none transition focus:border-sky-300 sm:rounded-[24px]"
                                />
                                {question.responseGuide ? (
                                  <MathPreviewText
                                    content={question.responseGuide}
                                    contentSource="backend"
                                    className="text-sm leading-6 text-slate-500"
                                  />
                                ) : null}
                              </div>
                            ) : (
                              question.options.map((option, optionIndex) => {
                                const isSelected =
                                  selectedOption === optionIndex;

                                return (
                                  <label
                                    key={`${question.id}-${optionIndex}`}
                                    className="flex cursor-pointer items-center gap-3 text-base text-slate-800 sm:gap-4 sm:text-[18px]"
                                  >
                                    <span
                                      className={cn(
                                        "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition sm:h-8 sm:w-8",
                                        isSelected
                                          ? "border-[#2a9ee9] bg-white"
                                          : "border-slate-300 bg-white",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "h-3 w-3 rounded-full transition sm:h-3.5 sm:w-3.5",
                                          isSelected
                                            ? "bg-[#2a9ee9]"
                                            : "bg-transparent",
                                        )}
                                      />
                                    </span>
                                    <input
                                      type="radio"
                                      name={question.id}
                                      checked={isSelected}
                                      onChange={() =>
                                        setSelectedOptions((current) => ({
                                          ...current,
                                          [question.id]: optionIndex,
                                        }))
                                      }
                                      className="sr-only"
                                    />
                                    <MathPreviewText
                                      content={option}
                                      contentSource="backend"
                                      className="leading-7"
                                    />
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>

                <aside className="order-1 lg:order-2 lg:sticky lg:top-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(148,163,184,0.10)] sm:p-5">
                    <div className="sticky top-3 z-20 mb-4 rounded-[10px] border border-[#ff8d8d] bg-white/95 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm backdrop-blur sm:text-[15px]">
                      Үлдсэн хугацаа {timeLeftLabel}
                    </div>
                    <h3 className="text-[15px] font-semibold text-slate-900">
                      Шалгалтын навигаци
                    </h3>
                    <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {exam.detail.questions.map((question, index) => {
                        const selectedOption = selectedOptions[question.id];
                        const writtenValue = writtenAnswers[question.id] ?? "";
                        const isAnswered =
                          question.type === "mcq"
                            ? typeof selectedOption === "number"
                            : writtenValue.trim().length > 0;
                        const isFlagged = Boolean(
                          flaggedQuestions[question.id],
                        );
                        const isActive = activeQuestionId === question.id;

                        return (
                          <button
                            key={`nav-${question.id}`}
                            type="button"
                            onClick={() => scrollToQuestion(question.id)}
                            className={cn(
                              "flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition sm:h-12 sm:text-[15px]",
                              isFlagged
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : isAnswered
                                  ? "border-[#9dcff2] bg-[#eef8ff] text-slate-900"
                                  : "border-slate-300 bg-white text-slate-800 hover:border-slate-400",
                              isActive &&
                                "ring-2 ring-[#2a9ee9]/40 ring-offset-1",
                            )}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 grid gap-2 sm:space-y-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewAction("submit")}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27a7ea] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1199de]"
                      >
                        <Send className="h-4 w-4" />
                        Сорилыг дуусгах
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreviewAction("save")}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Save className="h-4 w-4" />
                        Явц хадгалах
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="flex min-h-[50vh] items-center justify-center rounded-[24px] border border-dashed border-[#dbe4f3] bg-white px-6 text-sm text-slate-500">
                Preview ачаалж байна...
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrintableExamSheet({ exam }: { exam: PrintableExamState }) {
  const durationMinutes = getDurationMinutes(exam.summary, exam.detail);

  return (
    <div className="bg-white px-8 py-8 text-slate-900">
      <div className="border-b border-[#d9e2ec] pb-5">
        <div className="text-[28px] font-bold text-slate-950">
          <MathPreviewText
            content={exam.detail?.title ?? exam.summary.title}
            contentSource="backend"
            className="[&_.katex-display]:my-2"
          />
        </div>
        <p className="mt-2 text-[14px] text-slate-500">
          Сурагчид зориулсан хэвлэх хувилбар
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewMetaCard
            label="Хичээл"
            value={formatSubjectLabel(
              exam.detail?.sessionMeta?.subject ?? exam.summary.subject,
            )}
          />
          <PreviewMetaCard
            label="Анги"
            value={formatPreviewClassLabel(exam.summary, exam.detail)}
          />
          <PreviewMetaCard
            label="Төрөл"
            value={formatExamTypeLabel(exam.detail?.sessionMeta?.examType)}
          />
          <PreviewMetaCard
            label="Хугацаа"
            value={
              durationMinutes > 0 ? `${durationMinutes} мин` : "Тодорхойгүй"
            }
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {exam.detail.questions.map((question, index) => (
          <section
            key={question.id}
            className="break-inside-avoid rounded-[24px] border border-[#dbe4f3] bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-3 text-[15px] font-semibold text-[#0b5cab]">
                  Асуулт {index + 1}
                </p>
                <MathPreviewText
                  content={question.prompt}
                  contentSource="backend"
                  displayMode={question.type === "math"}
                  className="text-[16px] leading-7 text-slate-900"
                />
              </div>
              <div className="shrink-0 rounded-full bg-[#f4f7fb] px-3 py-1 text-[13px] font-semibold text-slate-600">
                {question.points} оноо
              </div>
            </div>

            {question.imageDataUrl ? (
              <div className="mt-4 overflow-hidden rounded-[20px] border border-[#e6edf7] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={question.imageDataUrl}
                  alt={question.imageAlt || "Question image"}
                  className="max-h-[320px] w-full object-contain"
                />
              </div>
            ) : null}

            {question.type === "mcq" ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={`${question.id}-${optionIndex}`}
                    className="flex items-start gap-3 rounded-[18px] border border-[#dbe4f3] bg-[#f8fafc] px-4 py-3"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[13px] font-semibold text-slate-600">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <MathPreviewText
                      content={option}
                      contentSource="backend"
                      className="min-w-0 flex-1 text-[15px] leading-6 text-slate-800"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="rounded-[18px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 text-[13px] text-slate-500">
                  <MathPreviewText
                    content={
                      question.responseGuide.trim() ||
                      "Бодолтын бүх алхмаа бичиж, хариугаа тайлбарлан оруулна уу."
                    }
                    contentSource="backend"
                    className="text-[13px] leading-6 text-slate-500"
                  />
                </div>
                <div className="min-h-[148px] rounded-[18px] border border-[#dbe4f3] bg-white" />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function PreviewMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[140px] rounded-[18px] border border-[#e6edf7] bg-[#f8fbff] px-4 py-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function mapRawQuestionToExamQuestion(question: RawExamQuestion): ExamQuestion {
  const normalizedType = question.type.trim().toLowerCase();

  if (normalizedType === "mcq") {
    return {
      correctOption:
        typeof question.correctOption === "number"
          ? question.correctOption
          : null,
      id: question.id,
      imageAlt: question.imageAlt ?? "",
      imageDataUrl: question.imageDataUrl ?? undefined,
      options: (question.options ?? []).map((option) =>
        normalizeBackendMathText(String(option).trim()),
      ),
      points: question.points ?? 1,
      prompt: normalizeBackendMathText(question.prompt.trim()),
      type: "mcq",
    };
  }

  return {
    answerLatex: normalizeBackendLatexOnly(question.answerLatex?.trim() ?? ""),
    id: question.id,
    imageAlt: question.imageAlt ?? "",
    imageDataUrl: question.imageDataUrl ?? undefined,
    points: question.points ?? 1,
    prompt: normalizeBackendMathText(question.prompt.trim()),
    responseGuide: normalizeBackendMathText(
      question.responseGuide?.trim() ?? "",
    ),
    type: "math",
  };
}

function formatExamDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function getEstimatedDurationLabel(exam: Exam) {
  const estimatedMinutes = Math.max(30, Math.ceil(exam.questionCount / 5) * 10);
  return `${estimatedMinutes} мин`;
}

function getDurationMinutes(exam: Exam, detail: LoadedExamDetail | null) {
  if (
    typeof detail?.sessionMeta?.durationMinutes === "number" &&
    detail.sessionMeta.durationMinutes > 0
  ) {
    return detail.sessionMeta.durationMinutes;
  }

  return Math.max(30, Math.ceil(exam.questionCount / 5) * 10);
}

function formatPreviewClassLabel(exam: Exam, detail: LoadedExamDetail | null) {
  const gradeLabel =
    typeof detail?.sessionMeta?.grade === "number"
      ? `${detail.sessionMeta.grade} дүгээр анги`
      : "";
  const groupLabel = detail?.sessionMeta?.groupClass?.trim() ?? "";

  return [gradeLabel, groupLabel].filter(Boolean).join(" ") || exam.class;
}

function formatSubjectLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) return "Тодорхойгүй";
  if (normalized === "math") return "Математик";
  if (normalized === "physics") return "Физик";
  if (normalized === "chemistry") return "Хими";

  return value?.trim() || "Тодорхойгүй";
}

function formatExamTypeLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) return "Шалгалт";
  if (normalized === "progress") return "Явцын";
  if (normalized === "quarter") return "Улирлын";
  if (normalized === "state") return "Улсын";
  if (normalized === "benchmark") return "Жишиг";
  if (normalized === "unit") return "Бүлэг сэдвийн";

  return value?.trim() || "Шалгалт";
}

function formatTimerLabel(minutes: number) {
  const safeMinutes = Math.max(minutes, 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}:00`
    : `${String(remainingMinutes).padStart(2, "0")}:00`;
}

function normalizeGradeValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_GRADE_VALUE;
}

function formatGradeLabel(value: string) {
  return value === UNKNOWN_GRADE_VALUE ? "Тодорхойгүй анги" : value;
}

function formatExamClassLabel(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Тодорхойгүй анги";
}

function ExamActionsMenu({
  exam,
  onAction,
  onOpenChange,
}: {
  exam: Exam;
  onAction: (action: ExamActionId, exam: Exam) => void;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Шалгалтын үйлдлүүд"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className="rounded-lg p-1 text-slate-700 transition hover:bg-slate-100"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-56 rounded-2xl border border-[#dfe5ef] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
      >
        {CARD_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={`${exam.id}-${action.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onAction(action.id, exam);
            }}
            className={`rounded-xl px-3 py-3 text-[15px] font-medium ${
              action.variant === "destructive"
                ? "text-[#dc2626] focus:bg-[#fef2f2] focus:text-[#dc2626]"
                : "text-slate-800 focus:bg-[#f8fafc] focus:text-slate-900"
            }`}
          >
            <action.icon className="h-4 w-4" />
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const CARD_ACTIONS: Array<{
  icon: typeof CalendarCheck | typeof Eye | typeof Printer | typeof Trash2;
  id: ExamActionId;
  label: string;
  variant?: "destructive";
}> = [
  { icon: CalendarCheck, id: "schedule", label: "Шалгалт товлох" },
  { icon: Eye, id: "preview", label: "Урьдчилан харах" },
  { icon: Printer, id: "print", label: "Хэвлэх" },
  { icon: Trash2, id: "delete", label: "Устгах", variant: "destructive" },
];

async function printPreviewContent(
  printableNode: HTMLDivElement | null,
  title: string,
) {
  if (!printableNode) {
    toast.error("Хэвлэх content олдсонгүй.");
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";

  document.body.appendChild(iframe);

  const iframeDocument =
    iframe.contentDocument ?? iframe.contentWindow?.document ?? null;

  if (!iframeDocument) {
    iframe.remove();
    toast.error("Хэвлэх цонх бэлдэж чадсангүй.");
    return;
  }

  const styles = [
    ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')),
    ...Array.from(document.querySelectorAll("style")),
  ]
    .map((node) => node.outerHTML)
    .join("\n");

  iframeDocument.open();
  iframeDocument.write(`<!doctype html>
<html lang="mn">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${styles}
    <style>
      body {
        margin: 0;
        background: white;
      }
      .print-root {
        padding: 24px;
        background: white;
      }
      .print-root textarea {
        min-height: 140px !important;
      }
      @page {
        margin: 16mm;
      }
    </style>
  </head>
  <body>
    <div class="print-root">${printableNode.innerHTML}</div>
  </body>
</html>`);
  iframeDocument.close();

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    iframe.remove();
    toast.error("Хэвлэх цонх нээгдсэнгүй.");
    return;
  }

  const fonts = (iframeDocument as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {
      // Ignore font loading issues and continue printing with current markup.
    }
  }

  await new Promise((resolve) => {
    printWindow.requestAnimationFrame(() => {
      printWindow.requestAnimationFrame(resolve);
    });
  });

  printWindow.focus();
  printWindow.print();

  window.setTimeout(() => {
    iframe.remove();
  }, 1000);
}
