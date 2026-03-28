"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Play,
  RotateCcw,
  TrendingUp,
  Trophy,
  type LucideIcon,
  UserRound,
} from "lucide-react";
import type {
  AttemptSummary,
  GetProgressResponse,
  StudentInfo,
  SubmitAnswersResponse,
  TeacherTestSummary,
} from "@/lib/exam-service/types";
import { formatDate, estimateDurationMinutes } from "./student-page-utils";

export type NavigationSection = "dashboard" | "tests" | "results";

export type ResultRow = {
  attemptId: string;
  className: string;
  examName: string;
  finishedAt: string;
  scoreText: string;
  startedAt: string;
  subject: string;
  teacher: string;
};

type StudentPageShellProps = {
  activeSection: NavigationSection;
  activeTestsCount: number;
  approvedAttemptsCount: number;
  averageScore: number;
  availableStudents: StudentInfo[];
  completedAttemptsLength: number;
  completionRate: number;
  completedByTestId: Map<string, AttemptSummary>;
  error: string | null;
  filteredTests: TeacherTestSummary[];
  inProgressByTestId: Map<string, AttemptSummary>;
  isInitialLoading: boolean;
  isMutating: boolean;
  latestProgress: GetProgressResponse | SubmitAnswersResponse | null;
  pageTitle: string;
  passRate: number;
  passedAttemptsCount: number;
  resultRows: ResultRow[];
  selectedStudent: StudentInfo | null;
  selectedStudentId: string;
  onResumeExam: (attemptId: string) => void;
  onSectionChange: (section: NavigationSection) => void;
  onSelectStudent: (studentId: string) => void;
  onStartExam: (testId: string) => void;
};

type StatCardProps = {
  caption: string;
  icon: LucideIcon;
  title: string;
  value: string;
};

type FeedbackPanelProps = {
  feedback: NonNullable<GetProgressResponse["feedback"]>;
};

function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-slate-800">
      <div className="flex items-center gap-2 font-semibold text-sky-900">
        <FileText className="h-4 w-4" />
        {feedback.headline}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{feedback.summary}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            Сайн тал
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {feedback.strengths.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            Сайжруулах зүйл
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {feedback.improvements.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ caption, icon: Icon, title, value }: StatCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6f5fd] text-[#1a9cdc]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </article>
  );
}

type TestCardsGridProps = {
  completedByTestId: Map<string, AttemptSummary>;
  emptyMessage: string;
  filteredTests: TeacherTestSummary[];
  inProgressByTestId: Map<string, AttemptSummary>;
  isMutating: boolean;
  selectedStudent: StudentInfo | null;
  onResumeExam: (attemptId: string) => void;
  onStartExam: (testId: string) => void;
};

function TestCardsGrid({
  completedByTestId,
  emptyMessage,
  filteredTests,
  inProgressByTestId,
  isMutating,
  selectedStudent,
  onResumeExam,
  onStartExam,
}: TestCardsGridProps) {
  if (!selectedStudent) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        Сурагч сонгоогүй байна.
      </div>
    );
  }

  if (filteredTests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {filteredTests.map((test) => {
        const resumableAttempt = inProgressByTestId.get(test.id);
        const completedAttempt = completedByTestId.get(test.id);

        return (
          <article
            key={test.id}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 pt-6 shadow-[0_6px_22px_rgba(15,23,42,0.06)]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-[#59c9ee]" />
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {test.title}
              </h3>
              {completedAttempt && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Дууссан
                </span>
              )}
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <BookOpen className="h-4 w-4" />
                {test.criteria.subject}
              </p>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-4 w-4" />
                {estimateDurationMinutes(test)} мин
              </p>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarClock className="h-4 w-4" />
                Хаагдах хугацаа: {formatDate(test.updatedAt)}
              </p>
            </div>

            {resumableAttempt ? (
              <button
                onClick={() => onResumeExam(resumableAttempt.attemptId)}
                disabled={isMutating}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#18a7eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Үргэлжлүүлэх
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : completedAttempt ? (
              <button
                disabled={true}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500"
              >
                <CheckCircle2 className="h-4 w-4" />
                Өгсөн шалгалт
              </button>
            ) : (
              <button
                onClick={() => onStartExam(test.id)}
                disabled={isMutating}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#18a7eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Шалгалт эхлүүлэх
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function StudentPageShell({
  activeSection,
  activeTestsCount,
  approvedAttemptsCount,
  averageScore,
  availableStudents,
  completedAttemptsLength,
  completedByTestId,
  completionRate,
  error,
  filteredTests,
  inProgressByTestId,
  isInitialLoading,
  isMutating,
  latestProgress,
  pageTitle,
  passRate,
  passedAttemptsCount,
  resultRows,
  selectedStudent,
  selectedStudentId,
  onResumeExam,
  onSectionChange,
  onSelectStudent,
  onStartExam,
}: StudentPageShellProps) {
  const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);
  const studentMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!studentMenuRef.current?.contains(event.target as Node)) {
        setIsStudentMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#eceff3]">
      <div className="grid h-full grid-cols-[228px_1fr] grid-rows-[58px_1fr]">
        <aside className="row-start-1 col-start-1 flex items-center gap-3 border-r border-b border-slate-200 bg-white px-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#16a4e5] text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <p className="text-xl font-semibold text-slate-900">Сурагч Портал</p>
        </aside>

        <header className="row-start-1 col-start-2 flex items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>

          <div className="relative" ref={studentMenuRef}>
            <button
              onClick={() => setIsStudentMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50"
            >
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-700">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedStudent?.name ?? "Сурагч сонгох"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedStudent?.className ?? "Анги"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 transition ${isStudentMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isStudentMenuOpen && (
              <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.15)]">
                <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Сурагч сонгох
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {availableStudents.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-500">
                      Сурагч олдсонгүй.
                    </p>
                  ) : (
                    availableStudents.map((student) => {
                      const isSelected = student.id === selectedStudentId;
                      return (
                        <button
                          key={student.id}
                          onClick={() => {
                            onSelectStudent(student.id);
                            setIsStudentMenuOpen(false);
                          }}
                          className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                            isSelected
                              ? "bg-[#e6f5fd] font-semibold text-[#1287c7]"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{student.name}</span>
                          <span className="text-xs text-slate-500">
                            {student.className}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <aside className="row-start-2 col-start-1 overflow-y-auto border-r border-slate-200 bg-[#f3f6f9] p-2">
          <nav className="space-y-1">
            <button
              onClick={() => onSectionChange("dashboard")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeSection === "dashboard"
                  ? "bg-[#e6f5fd] text-[#1287c7]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Хяналтын самбар
            </button>
            <button
              onClick={() => onSectionChange("tests")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                activeSection === "tests"
                  ? "bg-[#e6f5fd] text-[#1287c7]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <FileText className="h-4 w-4" />
              Идэвхтэй шалгалтууд
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[11px] font-semibold text-slate-700">
                {activeTestsCount}
              </span>
            </button>
            <button
              onClick={() => onSectionChange("results")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                activeSection === "results"
                  ? "bg-[#e6f5fd] text-[#1287c7]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Trophy className="h-4 w-4" />
              Шалгалтын дүн
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[11px] font-semibold text-slate-700">
                {completedAttemptsLength}
              </span>
            </button>
          </nav>
        </aside>

        <main className="row-start-2 col-start-2 overflow-y-auto bg-[#f5f7fa] p-5">
          <div className="w-full space-y-6">
            {isInitialLoading ? (
              <div className="flex h-[500px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Өгөгдөл ачаалж байна...
              </div>
            ) : (
              <section className="space-y-6">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {activeSection === "dashboard" && (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <StatCard
                        title="Идэвхтэй шалгалт"
                        value={String(activeTestsCount)}
                        caption="Дуусгах хүлээгдэж буй"
                        icon={ClipboardList}
                      />
                      <StatCard
                        title="Тэнцсэн хувь"
                        value={`${completionRate}%`}
                        caption={`${approvedAttemptsCount} шалгалт батлагдсан`}
                        icon={Trophy}
                      />
                      <StatCard
                        title="Дундаж оноо"
                        value={`${averageScore}%`}
                        caption="Бүх шалгалтаар"
                        icon={TrendingUp}
                      />
                    </div>

                    {latestProgress &&
                      (latestProgress.status === "submitted" ||
                        latestProgress.status === "processing" ||
                        latestProgress.status === "approved") && (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                            <div className="flex items-center gap-2 font-semibold">
                              <FileCheck2 className="h-4 w-4" />
                              {latestProgress.status === "processing"
                                ? "Шалгалтыг боловсруулж байна"
                                : latestProgress.status === "approved"
                                  ? "Шалгалтын дүн бэлэн боллоо"
                                  : "Шалгалт амжилттай илгээгдлээ"}
                            </div>
                            <p className="mt-1 text-sm text-emerald-700/90">
                              {latestProgress.status === "approved" &&
                              latestProgress.result
                                ? `${latestProgress.result.maxScore} онооноос ${latestProgress.result.score} авч, ${latestProgress.result.percentage}% гүйцэтгэл үзүүллээ.`
                                : latestProgress.feedback?.summary
                                  ? latestProgress.feedback.summary
                                : "Таны хариулт амжилттай бүртгэгдсэн. Батлагдсаны дараа дүн хэсэгт харагдана."}
                            </p>
                          </div>

                          {latestProgress.feedback && (
                            <FeedbackPanel feedback={latestProgress.feedback} />
                          )}
                        </div>
                      )}

                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-slate-900">
                        <span className="status-dot-breathe h-3 w-3 rounded-full bg-emerald-500" />
                        <h3 className="text-lg font-semibold">
                          Идэвхтэй шалгалтууд
                        </h3>
                        <span className="text-sm text-slate-500">
                          {filteredTests.length} боломжтой
                        </span>
                      </div>
                      <TestCardsGrid
                        completedByTestId={completedByTestId}
                        emptyMessage="Танд тохирох идэвхтэй шалгалт олдсонгүй."
                        filteredTests={filteredTests}
                        inProgressByTestId={inProgressByTestId}
                        isMutating={isMutating}
                        selectedStudent={selectedStudent}
                        onResumeExam={onResumeExam}
                        onStartExam={onStartExam}
                      />
                    </section>
                  </>
                )}

                {activeSection === "tests" && (
                  <section className="space-y-5">
                    <div className="flex items-start gap-3">
                      <span className="status-dot-breathe mt-2 h-3 w-3 rounded-full bg-emerald-500" />
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">
                          Идэвхтэй шалгалтууд
                        </h3>
                        <p className="text-lg text-slate-500">
                          Хугацаа дуусахаас өмнө шалгалтуудаа дуусгана уу
                        </p>
                      </div>
                    </div>
                    <TestCardsGrid
                      completedByTestId={completedByTestId}
                      emptyMessage="Одоогоор шалгалт алга."
                      filteredTests={filteredTests}
                      inProgressByTestId={inProgressByTestId}
                      isMutating={isMutating}
                      selectedStudent={selectedStudent}
                      onResumeExam={onResumeExam}
                      onStartExam={onStartExam}
                    />
                  </section>
                )}

                {activeSection === "results" && (
                  <section className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        Миний үр дүн
                      </h3>
                      <p className="text-lg text-slate-500">
                        Шалгалтын гүйцэтгэл болон оноогоо харах
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <StatCard
                        title="Нийт шалгалт"
                        value={String(completedAttemptsLength)}
                        caption="Дуусгасан шалгалт"
                        icon={Trophy}
                      />
                      <StatCard
                        title="Тэнцсэн хувь"
                        value={`${passRate}%`}
                        caption={`${completedAttemptsLength}-с ${passedAttemptsCount} тэнцсэн`}
                        icon={CheckCircle2}
                      />
                      <StatCard
                        title="Дундаж оноо"
                        value={`${averageScore}%`}
                        caption="Бүх шалгалтаар"
                        icon={TrendingUp}
                      />
                    </div>

                    {latestProgress?.feedback && (
                      <FeedbackPanel feedback={latestProgress.feedback} />
                    )}

                    <div className="space-y-2">
                      <h4 className="text-2xl font-semibold text-slate-900">
                        Шалгалтын дүнгүүд
                      </h4>

                      {resultRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
                          Дүнгийн мэдээлэл одоогоор алга.
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-slate-100 text-left text-slate-700">
                                <tr>
                                  <th className="px-4 py-3 font-semibold">
                                    Шалгалтын нэр
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Хичээл
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Анги
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Багш
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Эхэлсэн огноо
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Дууссан огноо
                                  </th>
                                  <th className="px-4 py-3 font-semibold">
                                    Авсан оноо
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {resultRows.map((row) => (
                                  <tr
                                    key={row.attemptId}
                                    className="border-t border-slate-100 text-slate-800"
                                  >
                                    <td className="px-4 py-3">
                                      {row.examName}
                                    </td>
                                    <td className="px-4 py-3">{row.subject}</td>
                                    <td className="px-4 py-3">
                                      {row.className}
                                    </td>
                                    <td className="px-4 py-3">{row.teacher}</td>
                                    <td className="px-4 py-3">
                                      {row.startedAt}
                                    </td>
                                    <td className="px-4 py-3">
                                      {row.finishedAt}
                                    </td>
                                    <td className="px-4 py-3">
                                      {row.scoreText}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
