"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  GraduationCap,
  MoreVertical,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Exam } from "../../live-dashboard/lib/types";

const UNKNOWN_GRADE_VALUE = "__unknown_grade__";
const UNKNOWN_TOPIC_VALUE = "__unknown_topic__";
const UNKNOWN_TYPE_VALUE = "__unknown_type__";
const FILTER_TRIGGER_CLASS =
  "!h-[48px] !w-[152px] !min-w-[152px] !rounded-[12px] !border !border-[#d9e2ec] !bg-white !px-4 !text-[15px] !font-medium !text-slate-800 shadow-none hover:!bg-white focus-visible:ring-0 [&_[data-slot=select-value]]:max-w-[96px] [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-left";

type MockLiveExamCard = {
  exam: Exam;
  updatedAgo: string | null;
};

type ExamProgressOverviewProps = {
  examMetaById: Record<string, ExamProgressExamMeta>;
  exams: Exam[];
  onSelectExam: (exam: Exam) => void;
};
export type ExamProgressExamMeta = {
  reviewState: "approved" | "pending" | null;
  updatedAgo: string | null;
};

export function ExamProgressOverview({
  examMetaById,
  exams,
  onSelectExam,
}: ExamProgressOverviewProps) {
  const [gradeFilter, setGradeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");

  const activeExams = useMemo(
    () =>
      exams
        .filter((exam) => exam.liveStudentCount > 0 && !exam.endTime)
        .map((exam) => ({
          exam,
          updatedAgo: examMetaById[exam.id]?.updatedAgo ?? null,
        })),
    [examMetaById, exams],
  );

  const completedExams = useMemo(
    () =>
      exams
        .filter((exam) => exam.liveStudentCount === 0 || Boolean(exam.endTime))
        .sort((left, right) => right.startTime.getTime() - left.startTime.getTime()),
    [exams],
  );

  const gradeOptions = useMemo(
    () =>
      [...new Set(completedExams.map((exam) => normalizeGradeValue(exam.class)))].sort(),
    [completedExams],
  );
  const topicOptions = useMemo(
    () =>
      [...new Set(completedExams.map((exam) => normalizeTopicValue(exam.topic)))].sort(),
    [completedExams],
  );
  const typeOptions = useMemo(
    () =>
      [...new Set(completedExams.map((exam) => normalizeTypeValue(getExamType(exam))))].sort(
        (left, right) => formatTypeLabel(left).localeCompare(formatTypeLabel(right), "mn"),
      ),
    [completedExams],
  );

  const filteredCompletedExams = useMemo(
    () =>
      completedExams.filter((exam) => {
        const matchesGrade =
          gradeFilter === "all" || normalizeGradeValue(exam.class) === gradeFilter;
        const matchesType =
          typeFilter === "all" ||
          normalizeTypeValue(getExamType(exam)) === typeFilter;
        const matchesTopic =
          topicFilter === "all" || normalizeTopicValue(exam.topic) === topicFilter;

        return matchesGrade && matchesType && matchesTopic;
      }),
    [completedExams, gradeFilter, topicFilter, typeFilter],
  );

  return (
    <section className="min-h-full px-8 py-8">
      <div className="space-y-11">
        <section>
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#17a34a]" />
            <h2 className="text-[19px] font-bold text-slate-900">
              Идэвхтэй шалгалтууд
            </h2>
          </div>

          {activeExams.length > 0 ? (
            <div className="mt-8 grid items-stretch gap-6 xl:grid-cols-3">
              {activeExams.map((card) => (
                <MockLiveExamCardView
                  key={card.exam.id}
                  card={card}
                  onClick={() => onSelectExam(card.exam)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-[15px] text-slate-500">
              Одоогоор идэвхтэй шалгалт бүртгэгдээгүй байна.
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <h2 className="text-[19px] font-bold text-slate-900">
                Дууссан шалгалтууд
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StyledSelect
                placeholder="Анги"
                value={gradeFilter}
                onValueChange={setGradeFilter}
              >
                <SelectItem value="all">Анги</SelectItem>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {formatGradeLabel(grade)}
                  </SelectItem>
                ))}
              </StyledSelect>

              <StyledSelect
                placeholder="Төрөл"
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectItem value="all">Төрөл</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatTypeLabel(type)}
                  </SelectItem>
                ))}
              </StyledSelect>

              <StyledSelect
                placeholder="Сэдэв"
                value={topicFilter}
                onValueChange={setTopicFilter}
              >
                <SelectItem value="all">Сэдэв</SelectItem>
                {topicOptions.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {formatTopicLabel(topic)}
                  </SelectItem>
                ))}
              </StyledSelect>
            </div>
          </div>

          {filteredCompletedExams.length > 0 ? (
            <div className="mt-6 grid items-stretch gap-6 xl:grid-cols-3">
              {filteredCompletedExams.slice(0, 6).map((exam) => (
                <CompletedExamCard
                  key={exam.id}
                  exam={exam}
                  onClick={() => onSelectExam(exam)}
                  badgeVariant={examMetaById[exam.id]?.reviewState}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
              Сонгосон filter-т тохирох шалгалт олдсонгүй.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

type StyledSelectProps = {
  children: React.ReactNode;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
};

function StyledSelect({
  children,
  onValueChange,
  placeholder,
  value,
}: StyledSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={FILTER_TRIGGER_CLASS}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-[14px] border border-[#d9e2ec] p-1 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
        {children}
      </SelectContent>
    </Select>
  );
}

function MockLiveExamCardView({
  card,
  onClick,
}: {
  card: MockLiveExamCard;
  onClick: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="flex h-full min-h-[240px] flex-col cursor-pointer rounded-[24px] border border-slate-200 bg-white px-7 py-8 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#0b5cab]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] px-4 py-1.5 text-[14px] font-semibold text-white">
          <span className="h-2 w-2 rounded-full bg-white" />
          Шууд
        </span>
        <span className="pt-1 text-[14px] text-slate-500">
          {card.updatedAgo ?? "саяхан"}
        </span>
      </div>

      <h3 className="mt-8 text-[18px] font-bold leading-snug text-slate-900">
        {card.exam.title}
      </h3>

      <div className="mt-auto flex items-end justify-between gap-4 pt-8 text-[15px] text-slate-500">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[15px]">
            <Clock3 className="h-4 w-4 text-slate-500" />
            Сүүлд шинэчлэгдсэн:{" "}
            <span className="font-semibold text-slate-700">
              {card.updatedAgo ?? "саяхан"}
            </span>
          </p>
        </div>

        <p className="flex items-center gap-2 text-[18px] font-semibold text-slate-900">
          <Users className="h-4 w-4" />
          {card.exam.liveStudentCount}
        </p>
      </div>
    </article>
  );
}

function CompletedExamCard({
  exam,
  badgeVariant,
  onClick,
}: {
  exam: Exam;
  badgeVariant: "approved" | "pending" | null | undefined;
  onClick: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="flex h-full min-h-[240px] flex-col cursor-pointer rounded-[24px] border border-slate-200 bg-white px-7 py-8 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#0b5cab]"
    >
      <div className="flex items-start justify-between gap-4">
        {badgeVariant ? (
          <span className={completedBadgeClassName(badgeVariant)}>
            {badgeVariant === "approved"
              ? "Батлах хүсэлт: Дууссан"
              : "Батлах хүсэлт: Хүлээгдэж буй"}
          </span>
        ) : (
          <span />
        )}
        <MoreVertical className="mt-1 h-5 w-5 shrink-0 text-slate-700" />
      </div>

      <h3 className="mt-8 text-[18px] font-bold leading-snug text-slate-900">
        {exam.title}
      </h3>

      <div className="mt-auto space-y-3 pt-8 text-[15px] text-slate-500">
        <p className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          {formatCompletedClassLabel(exam.class)}
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Дууссан огноо: {formatExamDate(exam.endTime ?? exam.startTime)}
        </p>
      </div>
    </article>
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

function completedBadgeClassName(tone: "approved" | "pending") {
  return cn(
    "inline-flex w-fit max-w-full whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium leading-none",
    tone === "approved"
      ? "border-[#9de2c1] bg-[#ecfbf2] text-[#169a5f]"
      : "border-[#fed7aa] bg-[#fff7ed] text-[#f97316]",
  );
}

function normalizeGradeValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_GRADE_VALUE;
}

function normalizeTopicValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_TOPIC_VALUE;
}

function normalizeTypeValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_TYPE_VALUE;
}

function getExamType(exam: Exam) {
  const title = exam.title.toLowerCase();

  if (title.includes("явц")) {
    return "Явцын";
  }
  if (title.includes("улирал")) {
    return "Улирлын";
  }
  if (title.includes("жил")) {
    return "Жилийн";
  }
  if (title.includes("давтлага")) {
    return "Давтлага";
  }

  return "";
}

function formatGradeLabel(value: string) {
  return value === UNKNOWN_GRADE_VALUE ? "Тодорхойгүй анги" : value;
}

function formatCompletedClassLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "126 анги";
  }

  if (trimmed.includes("анги")) {
    return trimmed;
  }

  return `${trimmed} анги`;
}

function formatTopicLabel(value: string) {
  return value === UNKNOWN_TOPIC_VALUE ? "Тодорхойгүй сэдэв" : value;
}

function formatTypeLabel(value: string) {
  return value === UNKNOWN_TYPE_VALUE ? "Тодорхойгүй төрөл" : value;
}
