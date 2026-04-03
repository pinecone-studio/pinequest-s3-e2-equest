"use client";

import { useQuery } from "@apollo/client/react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Database, Filter, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  GetNewMathExamDocument,
  ListNewMathExamsDocument,
} from "@/gql/create-exam-documents";
import { MathExamQuestionType, type NewMathExam } from "@/gql/graphql";
import MathPreviewText from "@/components/math-preview-text";
import { cn } from "@/lib/utils";

type ExamSummaryRow = {
  examId: string;
  title: string;
  updatedAt?: string | null;
  durationMinutes?: number | null;
  questionCount?: number | null;
  teacherId?: string | null;
  withVariants?: boolean | null;
  variantCount?: number | null;
  firstQuestionPreview?: string | null;
  secondQuestionPreview?: string | null;
};

type ListNewMathExamsQueryData = {
  listNewMathExams: ExamSummaryRow[];
};

type GetNewMathExamQueryData = {
  getNewMathExam: NewMathExam | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Сонгосон шалгалт (examId + гарчиг UI-д харуулахад) */
  onPick: (exam: ExamSummaryRow) => void;
};

// `create-exam-service/drizzle/seed/users_seed.sql`-ийн seed нэршлээс.
const SEEDED_TEACHER_NAME_BY_ID: Record<string, string> = {
  MATH_09: "Б.Батбаяр",
};

const SUBJECT_NAME_BY_ID: Record<string, string> = {
  math: "Математик",
};

function getSeededTeacherDisplayName(teacherId: string | null | undefined) {
  const trimmed = String(teacherId ?? "").trim();

  if (!trimmed) {
    return "";
  }

  return SEEDED_TEACHER_NAME_BY_ID[trimmed] ?? trimmed;
}

function getSubjectDisplayName(subject: string | null | undefined) {
  const trimmed = String(subject ?? "").trim();

  if (!trimmed) {
    return "";
  }

  return SUBJECT_NAME_BY_ID[trimmed.toLowerCase()] ?? trimmed;
}

function collapseRepeatedPreviewContent(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return "";
  }

  const compact = trimmed.replace(/\s+/g, " ");
  const repeatedLeadSentence = compact.match(/^(.{10,80}?[.?!])/u)?.[1]?.trim() ?? "";

  if (repeatedLeadSentence.length >= 10) {
    const secondIndex = compact.indexOf(
      repeatedLeadSentence,
      repeatedLeadSentence.length,
    );

    if (secondIndex > 0) {
      return compact.slice(0, secondIndex).trim();
    }
  }

  const midpoint = Math.floor(compact.length / 2);
  const candidateStart = Math.max(1, midpoint - 3);
  const candidateEnd = Math.min(compact.length - 1, midpoint + 3);

  for (let splitIndex = candidateStart; splitIndex <= candidateEnd; splitIndex += 1) {
    const left = compact.slice(0, splitIndex).trim();
    const right = compact.slice(splitIndex).trim();

    if (!left || !right) {
      continue;
    }

    const normalizedLeft = left.replace(/\s+/g, " ");
    const normalizedRight = right.replace(/\s+/g, " ");

    if (normalizedLeft === normalizedRight) {
      return left;
    }
  }

  return compact;
}

export function AiSchedulerExamLibraryDialog({
  open,
  onOpenChange,
  onPick,
}: Props) {
  const listPageSize = 100;
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const [durationFilter, setDurationFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [variantFilter, setVariantFilter] = useState("all");
  const [questionCountFilter, setQuestionCountFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOffset] = useState(0);
  /** Жагсаалтаас сонгосон тест — дэлгэрэнгүй харагдах */
  const [detailExam, setDetailExam] = useState<ExamSummaryRow | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim());
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    if (!open) {
      setDetailExam(null);
    }
  }, [open]);

  const { data, loading } = useQuery<ListNewMathExamsQueryData>(
    ListNewMathExamsDocument,
    {
      variables: {
        limit: listPageSize,
        offset: listOffset,
        filters: {
          durationMinutes:
            durationFilter !== "all" ? Number(durationFilter) : null,
          examType: null,
          grade: null,
          questionCount:
            questionCountFilter !== "all" ? Number(questionCountFilter) : null,
          search: debouncedSearchValue || null,
          subject: null,
          teacherId: teacherFilter !== "all" ? teacherFilter : null,
          withVariants:
            variantFilter === "all" ? null : variantFilter === "with",
        },
      },
      skip: !open,
      fetchPolicy: "network-only",
    },
  );

  const { data: fullExamData, loading: fullExamLoading } = useQuery<
    GetNewMathExamQueryData,
    { examId: string }
  >(GetNewMathExamDocument, {
    variables: { examId: detailExam?.examId ?? "" },
    skip: !open || !detailExam?.examId,
    fetchPolicy: "network-only",
  });

  const libraryExamSummaries = useMemo(
    () => data?.listNewMathExams ?? [],
    [data?.listNewMathExams],
  );

  const fullExam = fullExamData?.getNewMathExam ?? null;

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
      new Set(
        libraryExamSummaries
          .map((exam) => exam.questionCount)
          .filter((value): value is number => typeof value === "number"),
      ),
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
                  : getSeededTeacherDisplayName(teacherFilter),
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

  function handleConfirmPick() {
    if (!detailExam) return;
    onPick(detailExam);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,56rem)] w-[min(100vw-1.5rem,82rem)]! max-w-none! flex-col gap-0 overflow-hidden rounded-[24px] border border-[#dfe7f3] bg-white p-0">
        <DialogHeader className="shrink-0 border-b border-[#e6edf7] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {detailExam ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 cursor-pointer gap-1 rounded-xl px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setDetailExam(null)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Жагсаалт
              </Button>
            ) : null}
            <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 text-[18px] font-semibold text-slate-900">
              <Database className="size-5 shrink-0 text-[#0b5cab]" aria-hidden />
              <span className="truncate">
                {detailExam ? detailExam.title : "Сангийн шалгалтууд"}
              </span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {detailExam ? (
            <div className="space-y-4">
              {fullExamLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-[16px] border border-[#dbe4f3] bg-[#fcfdff] py-16 text-[14px] text-slate-600">
                  <Loader2 className="size-5 animate-spin text-[#0b5cab]" />
                  Асуултуудыг ачаалж байна...
                </div>
              ) : fullExam ? (
                <ExamDetailBody exam={fullExam} />
              ) : (
                <div className="rounded-[16px] border border-dashed border-[#dbe4f3] bg-[#fcfdff] p-8 text-center text-[14px] text-slate-500">
                  Шалгалтын агуулга ачаалагдсангүй.
                </div>
              )}
            </div>
          ) : (
            <>
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
                      : "Нэмэлт шүүлт сонгоогүй байна"}
                  </div>
                  <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff] text-slate-700 hover:border-[#c9d9ef] hover:bg-[#f2f7ff]"
                      >
                        <Filter className="mr-2 h-4 w-4" />
                        Шүүлтүүр
                        {activeFilterChips.length > 0 ? (
                          <span className="ml-2 rounded-full bg-[#0b5cab] px-1.5 py-0.5 text-[11px] text-white">
                            {activeFilterChips.length}
                          </span>
                        ) : null}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-[min(92vw,28rem)] rounded-[18px] border border-[#dbe4f3] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
                    >
                      <div className="mb-3 flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={resetAdvancedFilters}
                          className="h-8 cursor-pointer px-2 text-[12px] text-slate-500 hover:bg-transparent hover:text-slate-800"
                        >
                          Цэвэрлэх
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[11px] font-medium text-slate-500">
                            Хугацаа
                          </p>
                          <Select
                            value={durationFilter}
                            onValueChange={setDurationFilter}
                          >
                            <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                              <SelectValue placeholder="Хугацаа" />
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
                          <p className="text-[11px] font-medium text-slate-500">
                            Хувилбар
                          </p>
                          <Select
                            value={variantFilter}
                            onValueChange={setVariantFilter}
                          >
                            <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                              <SelectValue placeholder="Хувилбар" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Бүгд</SelectItem>
                              <SelectItem value="with">Хувилбартай</SelectItem>
                              <SelectItem value="without">Хувилбаргүй</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[11px] font-medium text-slate-500">
                            Багш
                          </p>
                          <Select
                            value={teacherFilter}
                            onValueChange={setTeacherFilter}
                          >
                            <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                              <SelectValue placeholder="Багш" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Бүх багш</SelectItem>
                              {teacherOptions.map((value) => (
                                <SelectItem
                                  key={`teacher-${value}`}
                                  value={value}
                                >
                                  {value === "unknown"
                                    ? "Тодорхойгүй"
                                    : getSeededTeacherDisplayName(value)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[11px] font-medium text-slate-500">
                            Асуулт
                          </p>
                          <Select
                            value={questionCountFilter}
                            onValueChange={setQuestionCountFilter}
                          >
                            <SelectTrigger className="w-full cursor-pointer rounded-[12px] border-[#dbe4f3] bg-[#f7faff]">
                              <SelectValue placeholder="Асуултын тоо" />
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
                        onClick={() => setDetailExam(exam)}
                        className={cn(
                          "cursor-pointer rounded-[16px] border border-[#dbe4f3] bg-white p-4 text-left transition",
                          "hover:-translate-y-0.5 hover:border-[#b8ccef] hover:bg-[#fbfdff] hover:shadow-[0_10px_22px_rgba(148,163,184,0.14)]",
                        )}
                      >
                        <p className="text-[15px] font-semibold text-slate-900">
                          {exam.title}
                        </p>
                        <p className="mt-1 text-[12px] text-slate-500">
                          {exam.updatedAt?.slice(0, 10) ?? "Огноо байхгүй"}
                        </p>
                        {(exam.firstQuestionPreview || exam.secondQuestionPreview) && (
                          <div className="mt-3 space-y-2 rounded-[12px] border border-[#e8eef8] bg-[#f9fbff] p-3">
                            {exam.firstQuestionPreview ? (
                              <div className="line-clamp-3 text-[12px] leading-snug text-slate-700">
                                <span className="font-medium text-[#0b5cab]">1.</span>{" "}
                                <MathPreviewText
                                  content={collapseRepeatedPreviewContent(
                                    exam.firstQuestionPreview,
                                  )}
                                  contentSource="backend"
                                  className="inline text-[12px] leading-snug text-inherit [&_.katex]:text-inherit"
                                />
                              </div>
                            ) : null}
                            {exam.secondQuestionPreview ? (
                              <div className="line-clamp-3 text-[12px] leading-snug text-slate-700">
                                <span className="font-medium text-[#0b5cab]">2.</span>{" "}
                                <MathPreviewText
                                  content={collapseRepeatedPreviewContent(
                                    exam.secondQuestionPreview,
                                  )}
                                  contentSource="backend"
                                  className="inline text-[12px] leading-snug text-inherit [&_.katex]:text-inherit"
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                        <div className="mt-3 space-y-1 rounded-[12px] border border-[#e3e9f4] bg-[#f9fbff] p-3 text-[12px] text-slate-600">
                          {typeof exam.durationMinutes === "number" ? (
                            <p>Хугацаа: {exam.durationMinutes} мин</p>
                          ) : null}
                          {typeof exam.questionCount === "number" ? (
                            <p>Асуулт: {exam.questionCount}</p>
                          ) : null}
                          {exam.withVariants ? (
                            <p>
                              Хувилбар:{" "}
                              {typeof exam.variantCount === "number" && exam.variantCount > 0
                                ? `${exam.variantCount} хувилбар`
                                : "Хувилбартай"}
                            </p>
                          ) : null}
                          {exam.teacherId ? (
                            <p className="truncate">
                              Багш: {getSeededTeacherDisplayName(exam.teacherId)}
                            </p>
                          ) : null}
                        </div>
                        <p className="mt-3 text-[11px] text-[#0b5cab]">
                          Дарж дэлгэрэнгүй үзэх →
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {detailExam ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 gap-3 rounded-b-[24px] border-t border-[#e6edf7] bg-[#fbfcff] px-5 pt-4 pb-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-w-[6.5rem] cursor-pointer rounded-xl"
              onClick={() => setDetailExam(null)}
            >
              Цуцлах
            </Button>
            <Button
              type="button"
              className="min-w-[6.5rem] cursor-pointer rounded-xl bg-[#0b5cab] hover:bg-[#094a8f]"
              onClick={handleConfirmPick}
              disabled={fullExamLoading || !fullExam}
            >
              Сонгох
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExamDetailBody({ exam }: { exam: NewMathExam }) {
  const meta = exam.sessionMeta;
  return (
    <div className="space-y-4">
      {meta ? (
        <div className="rounded-[14px] border border-[#dbe4f3] bg-[#f7faff] px-4 py-3 text-[13px] text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Мэдээлэл
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {meta.subject ? (
              <li>
                <span className="text-slate-500">Хичээл: </span>
                {getSubjectDisplayName(meta.subject)}
              </li>
            ) : null}
            {meta.grade != null ? (
              <li>
                <span className="text-slate-500">Анги: </span>
                {meta.grade}
                {meta.groupClass ? ` · ${meta.groupClass}` : ""}
              </li>
            ) : null}
            {meta.durationMinutes != null ? (
              <li>
                <span className="text-slate-500">Хугацаа: </span>
                {meta.durationMinutes} мин
              </li>
            ) : null}
            {meta.withVariants ? (
              <li>
                <span className="text-slate-500">Хувилбар: </span>
                {typeof meta.variantCount === "number" && meta.variantCount > 0
                  ? `${meta.variantCount} хувилбар`
                  : "Хувилбартай"}
              </li>
            ) : null}
            {meta.description ? (
              <li className="sm:col-span-2">
                <span className="text-slate-500">Тайлбар: </span>
                {meta.description}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Бүх асуулт ({exam.questions.length})
        </p>
        <div className="mt-2 space-y-3">
          {exam.questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-[14px] border border-[#e3e9f4] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-900">
                  {idx + 1}.
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                    q.type === MathExamQuestionType.Mcq
                      ? "bg-sky-100 text-sky-900"
                      : "bg-violet-100 text-violet-900",
                  )}
                >
                  {q.type === MathExamQuestionType.Mcq ? "Тест" : "Нээлттэй"}
                </span>
                <span className="text-[11px] text-slate-500">{q.points} оноо</span>
              </div>
              <div className="mt-2 text-[13px] leading-relaxed text-slate-800">
                <MathPreviewText
                  content={collapseRepeatedPreviewContent(q.prompt)}
                  contentSource="backend"
                  className="text-[13px] leading-relaxed text-inherit [&_.katex]:text-inherit"
                />
              </div>
              {q.options && q.options.length > 0 ? (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12px] text-slate-700">
                  {q.options.map((opt, i) => (
                    <li key={i} className="pl-1">
                      <MathPreviewText
                        content={collapseRepeatedPreviewContent(opt)}
                        contentSource="backend"
                        className="text-[12px] leading-relaxed text-inherit [&_.katex]:text-inherit"
                      />
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
