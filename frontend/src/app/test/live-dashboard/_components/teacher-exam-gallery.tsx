"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus2,
  Clock3,
  FlaskConical,
  GraduationCap,
  MoreVertical,
  PencilLine,
  PlusCircle,
  Printer,
  Trash2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Exam } from "../lib/types";

const UNKNOWN_GRADE_VALUE = "__unknown_grade__";
const UNKNOWN_TOPIC_VALUE = "__unknown_topic__";
const FILTER_TRIGGER_CLASS =
  "!h-[41px] !w-[152px] !min-w-[152px] !rounded-[12px] !border !border-[#d9e2ec] !bg-white !px-4 !text-[15px] !font-medium !text-slate-700 shadow-none hover:!bg-white focus-visible:ring-0 [&_[data-slot=select-value]]:max-w-[110px] [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-left";

type TeacherExamGalleryProps = {
  error?: string | null;
  exams: Exam[];
  onSelectExam: (exam: Exam) => void;
};

export function TeacherExamGallery({
  error,
  exams,
  onSelectExam,
}: TeacherExamGalleryProps) {
  const [activeMenuExamId, setActiveMenuExamId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");

  const gradeOptions = useMemo(
    () =>
      [...new Set(exams.map((exam) => normalizeGradeValue(exam.class)))].sort(),
    [exams],
  );
  const topicOptions = useMemo(
    () =>
      [...new Set(exams.map((exam) => normalizeTopicValue(exam.topic)))].sort(),
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
          const matchesTopic =
            topicFilter === "all" ||
            normalizeTopicValue(exam.topic) === topicFilter;

          return matchesGrade && matchesType && matchesTopic;
        })
        .sort(
          (left, right) => right.startTime.getTime() - left.startTime.getTime(),
        ),
    [exams, gradeFilter, topicFilter, typeFilter],
  );

  return (
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

        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger
              className={cn(
                FILTER_TRIGGER_CLASS,
                gradeFilter !== "all" ? "!border-[#b8cbe2] !text-[#0b5cab]" : "",
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
                typeFilter !== "all" ? "!border-[#b8cbe2] !text-[#0b5cab]" : "",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[14px] border border-[#d9e2ec] p-1 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
              <SelectItem value="all">Төрөл</SelectItem>
              <SelectItem value="live">Идэвхтэй</SelectItem>
              <SelectItem value="completed">Дууссан</SelectItem>
            </SelectContent>
          </Select>

          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger
              className={cn(
                FILTER_TRIGGER_CLASS,
                topicFilter !== "all" ? "!border-[#b8cbe2] !text-[#0b5cab]" : "",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[14px] border border-[#d9e2ec] p-1 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
              <SelectItem value="all">Сэдэв</SelectItem>
              {topicOptions.map((topic) => (
                <SelectItem key={topic} value={topic}>
                  {formatTopicLabel(topic)}
                </SelectItem>
              ))}
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
                  examId={exam.id}
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
  );
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

function normalizeGradeValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_GRADE_VALUE;
}

function normalizeTopicValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_TOPIC_VALUE;
}

function formatGradeLabel(value: string) {
  return value === UNKNOWN_GRADE_VALUE ? "Тодорхойгүй анги" : value;
}

function formatTopicLabel(value: string) {
  return value === UNKNOWN_TOPIC_VALUE ? "Тодорхойгүй сэдэв" : value;
}

function formatExamClassLabel(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Тодорхойгүй анги";
}

function ExamActionsMenu({
  examId,
  onOpenChange,
}: {
  examId: string;
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
        className="w-64 rounded-2xl border border-[#dfe5ef] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
      >
        {CARD_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={`${examId}-${action.label}`}
            onClick={(event) => event.stopPropagation()}
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

const CARD_ACTIONS = [
  { icon: PencilLine, label: "Засварлах" },
  { icon: Trash2, label: "Устгах", variant: "destructive" as const },
  { icon: CalendarPlus2, label: "Шалгалт товлох" },
  { icon: FlaskConical, label: "Туршилтаар ажиллах" },
  { icon: Printer, label: "Хэвлэх" },
];
