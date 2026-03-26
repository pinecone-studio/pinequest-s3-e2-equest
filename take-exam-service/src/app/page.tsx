"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  AttemptSummary,
  GetProgressResponse,
  StartExamResponse,
  SubmitAnswersResponse,
  TeacherTestSummary,
  StudentInfo,
} from "@/lib/exam-service/types";

const gqlRequest = async <T,>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> => {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = (await res.json()) as {
    data: T;
    errors?: Array<{ message: string }>;
  };

  if (errors) throw new Error(errors[0].message);
  return data;
};
export default function StudentApp() {
  const [availableStudents, setAvailableStudents] = useState<StudentInfo[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState({ topic: "" });
  const [tests, setTests] = useState<TeacherTestSummary[]>([]);
  const [allAttempts, setAllAttempts] = useState<AttemptSummary[]>([]);
  const [attempt, setAttempt] = useState<StartExamResponse | null>(null);
  const [progress, setProgress] = useState<
    GetProgressResponse | SubmitAnswersResponse | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      const { students } = await gqlRequest<{ students: StudentInfo[] }>(
        `query { students { id name className } }`,
      );
      setAvailableStudents(students || []);
    } catch (err) {
      console.error("Fetch students failed", err);
    }
  };

  const filteredTests = Array.from(
    tests
      .filter((t) => {
        if (!selectedStudent) return false;

        // 1. Filter by Class
        const studentClass = selectedStudent.className.trim().toUpperCase();
        const testClass = (t.criteria.className || "").trim().toUpperCase();
        const classMatch = testClass === studentClass || testClass === "";
        if (!classMatch) return false;

        // 2. Filter by Topic Search
        const topicMatch = t.criteria.topic
          .toLowerCase()
          .includes(searchQuery.topic.toLowerCase());
        if (!topicMatch) return false;

        // 3. Filter out if already submitted by this student
        const alreadySubmitted = allAttempts.some(
          (a) =>
            a.studentId === selectedStudent.id &&
            a.testId === t.id &&
            (a.status === "submitted" || a.status === "approved"),
        );
        if (alreadySubmitted) return false;

        return true;
      })
      // 4. Deduplicate (only show latest version of same Title+Topic)
      .reduce((map, t) => {
        const key =
          `${t.criteria.subject}-${t.criteria.topic}-${t.title}`.toLowerCase();
        const existing = map.get(key);
        if (
          !existing ||
          new Date(t.updatedAt ?? 0) > new Date(existing.updatedAt ?? 0)
        ) {
          map.set(key, t);
        }
        return map;
      }, new Map<string, TeacherTestSummary>())
      .values(),
  );

  const fetchEverything = async () => {
    try {
      const data = await gqlRequest<{
        availableTests: TeacherTestSummary[];
        attempts: AttemptSummary[];
      }>(`
        query {
          availableTests {
            id title description updatedAt
            criteria { subject topic className gradeLevel questionCount }
          }
          attempts {
            attemptId testId title studentId status score maxScore percentage submittedAt
            result { score maxScore percentage correctCount questionResults { questionId isCorrect explanation } }
          }
        }
      `);
      setTests(data.availableTests || []);
      setAllAttempts(data.attempts || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Мэдээллийг уншиж чадсангүй.",
      );
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchEverything();
  }, []);

  useEffect(() => {
    if (attempt) {
      const saved = localStorage.getItem(`answers_${attempt.attemptId}`);
      if (saved) {
        setAnswers(JSON.parse(saved));
      }
    }
  }, [attempt]);

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    const newAnswers = { ...answers, [questionId]: optionId };
    setAnswers(newAnswers);
    if (attempt) {
      localStorage.setItem(
        `answers_${attempt.attemptId}`,
        JSON.stringify(newAnswers),
      );
    }
  };

  const handleStartExam = (testId: string) => {
    startTransition(async () => {
      try {
        const data = await gqlRequest<{ startExam: StartExamResponse }>(
          `
          mutation Start($testId: String!, $sid: String!, $sname: String!) {
            startExam(testId: $testId, studentId: $sid, studentName: $sname) {
              attemptId status studentId studentName startedAt expiresAt
              exam {
                testId title description timeLimitMinutes
                questions { questionId prompt type points options { id text } }
              }
              progress { totalQuestions answeredQuestions remainingQuestions completionRate }
            }
          }
        `,
          { testId, sid: selectedStudent?.id, sname: selectedStudent?.name },
        );

        setAttempt(data.startExam);
        setAnswers({});
        setProgress(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
      }
    });
  };

  const handleSubmit = (finalize: boolean) => {
    if (!attempt) return;
    startTransition(async () => {
      try {
        const inputAnswers = Object.entries(answers).map(
          ([questionId, selectedOptionId]) => ({
            questionId,
            selectedOptionId,
          }),
        );

        const data = await gqlRequest<{ submitAnswers: SubmitAnswersResponse }>(
          `
          mutation Submit($aid: String!, $ans: [AnswerInput!]!, $fin: Boolean!) {
            submitAnswers(attemptId: $aid, answers: $ans, finalize: $fin) {
              attemptId status 
              progress { answeredQuestions totalQuestions completionRate }
              result { score maxScore percentage correctCount }
            }
          }
        `,
          { aid: attempt.attemptId, ans: inputAnswers, fin: finalize },
        );

        setProgress(data.submitAnswers);
        if (finalize) {
          if (attempt) localStorage.removeItem(`answers_${attempt.attemptId}`);
          setAttempt(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
      }
    });
  };

  const handleResumeExam = (attemptId: string) => {
    startTransition(async () => {
      try {
        const data = await gqlRequest<{ resumeExam: StartExamResponse }>(
          `
          mutation Resume($aid: String!) {
            resumeExam(attemptId: $aid) {
              attemptId status studentId studentName startedAt expiresAt
              exam {
                testId title description timeLimitMinutes
                questions { questionId prompt type points options { id text } }
              }
              progress { totalQuestions answeredQuestions remainingQuestions completionRate }
            }
          }
        `,
          { aid: attemptId },
        );

        setAttempt(data.resumeExam);
        setAnswers({});
        setProgress(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
      }
    });
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8 text-center">
          <p className="text-xl">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-rose-500 px-6 py-2"
          >
            Дахин ачаалах
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 font-sans">
      <main className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">
            Шалгалт Өгөх Портал (Порт 3002)
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Оюутны Шалгалтын Танхим
          </h1>
          <p className="text-slate-400">
            Энд зөвхөн оюутнууд тестээ бөглөж, дүнгээ харах боломжтой.
          </p>
        </header>

        {!attempt ? (
          <section className="space-y-6">
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-slate-500">
                  Оюутан Сонгох (ID-гаар)
                </label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500"
                  value={selectedStudent?.id || ""}
                  onChange={(e) => {
                    const student = availableStudents.find(
                      (s) => s.id === e.target.value,
                    );
                    setSelectedStudent(student || null);
                  }}
                >
                  <option value="">Сонгоно уу...</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.className})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-slate-500">
                  Сэдэвээр хайх
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Бүгд"
                  value={searchQuery.topic}
                  onChange={(e) =>
                    setSearchQuery((s) => ({ ...s, topic: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Шүүгдсэн тестүүд</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredTests.length === 0 ? (
                  <p className="text-slate-500 italic">
                    Таны оруулсан бүлэг, сэдэвт тохирох тест олдсонгүй.
                  </p>
                ) : (
                  filteredTests.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 transition duration-300"
                    >
                      <h3 className="text-lg font-medium">{t.title}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {t.criteria.subject}
                      </p>
                      <button
                        onClick={() => handleStartExam(t.id)}
                        disabled={isPending}
                        className="mt-4 w-full rounded-full bg-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                      >
                        Шалгалт эхлэх
                      </button>

                      {allAttempts.find(
                        (a) =>
                          a.testId === t.id &&
                          a.studentId === selectedStudent?.id &&
                          a.status === "in_progress",
                      ) && (
                        <button
                          onClick={() =>
                            handleResumeExam(
                              allAttempts.find(
                                (a) =>
                                  a.testId === t.id &&
                                  a.studentId === selectedStudent?.id &&
                                  a.status === "in_progress",
                              )!.attemptId,
                            )
                          }
                          disabled={isPending}
                          className="mt-2 w-full rounded-full border border-cyan-500/50 bg-cyan-500/10 py-3 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/20 disabled:opacity-50"
                        >
                          Үргэлжлүүлэх (Дуусаагүй байна)
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {(progress?.status === "submitted" ||
              progress?.status === "processing") && (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-12 text-center space-y-4 animate-in zoom-in duration-500">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                  {progress?.status === "processing" ? (
                    <div className="h-10 w-10 border-4 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="h-10 w-10 text-slate-950"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <h2 className="text-3xl font-bold text-emerald-400">
                  {progress?.status === "processing"
                    ? "Шалгалтыг боловсруулж байна..."
                    : "Шалгалт амжилттай дууслаа!"}
                </h2>
                <p className="text-slate-400 text-lg">
                  {progress?.status === "processing"
                    ? "Таны хариултуудыг хүлээн авлаа. Олон хүн зэрэг шалгалт өгч байгаа тул дүн бодолтыг дараалалд орууллаа."
                    : "Таны хариултуудыг хүлээн авлаа. Багш таны дүнг баталсны дараа та үр дүнгээ харах боломжтой болно."}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-8 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm hover:bg-white/10 transition"
                >
                  Буцах
                </button>
              </div>
            )}

            {allAttempts.some(
              (a) =>
                a.studentId === selectedStudent?.id && a.status === "approved",
            ) && (
              <div className="space-y-4 pt-8">
                <h2 className="text-xl font-semibold text-emerald-400">
                  Миний батлагдсан дүнгүүд
                </h2>
                <div className="grid gap-4">
                  {allAttempts
                    .filter(
                      (a) =>
                        a.studentId === selectedStudent?.id &&
                        a.status === "approved",
                    )
                    .map((a) => (
                      <div
                        key={a.attemptId}
                        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 animate-in fade-in duration-300"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-bold">{a.title}</h3>
                            <p className="text-xs text-slate-500">
                              {new Date(
                                a.submittedAt || "",
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-400">
                              {a.score}/{a.maxScore}
                            </p>
                            <p className="text-[10px] uppercase font-bold text-slate-500">
                              {a.percentage}% АМЖИЛТ
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                          {a.result?.questionResults.map((r, i) => (
                            <div
                              key={r.questionId}
                              className={`flex items-center gap-3 p-2 rounded-lg text-xs ${r.isCorrect ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
                            >
                              <span className="font-bold">{i + 1}.</span>
                              <span>
                                {r.isCorrect ? "Зөв хариулсан" : "Алдсан"}
                              </span>
                              {r.explanation && (
                                <span className="opacity-50 italic">
                                  - {r.explanation}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-8">
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-lg">
              <div>
                <h2 className="text-2xl font-bold">{attempt.exam.title}</h2>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-slate-400">{attempt.exam.description}</p>
                  <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Асуултуудыг хольсон
                  </span>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs uppercase text-slate-500 mb-1">
                  Оролдлогын Seed ID
                </p>
                <code className="rounded bg-black/40 px-3 py-1 text-xs font-mono text-cyan-500 select-all">
                  {attempt.attemptId}
                </code>
              </div>
            </div>

            <div className="space-y-6">
              {attempt.exam.questions.map((q, idx) => (
                <div
                  key={q.questionId}
                  className="rounded-3xl border border-white/10 bg-black/40 p-8 space-y-6 shadow-xl"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-medium leading-relaxed max-w-[85%]">
                      <span className="mr-4 text-cyan-400 font-bold">
                        {idx + 1}.
                      </span>{" "}
                      {q.prompt}
                    </h3>
                    <span className="text-xs bg-cyan-900/50 text-cyan-200 px-3 py-1 rounded-full">
                      {q.points} оноо
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {q.options.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-6 py-4 transition-all duration-200 ${
                          answers[q.questionId] === opt.id
                            ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                            : "border-white/5 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <input
                          type="radio"
                          className="hidden"
                          checked={answers[q.questionId] === opt.id}
                          onChange={() =>
                            handleSelectAnswer(q.questionId, opt.id)
                          }
                        />
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            answers[q.questionId] === opt.id
                              ? "border-cyan-400 bg-cyan-400"
                              : "border-slate-600"
                          }`}
                        >
                          {answers[q.questionId] === opt.id && (
                            <div className="h-2 w-2 rounded-full bg-slate-950" />
                          )}
                        </div>
                        <span className="text-lg">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-8 flex gap-4 rounded-full border border-white/10 bg-black/80 p-4 backdrop-blur shadow-2xl justify-center">
              <button
                onClick={() => handleSubmit(false)}
                disabled={isPending}
                className="rounded-full border border-white/20 bg-white/5 px-8 py-4 text-sm font-semibold hover:bg-white/10 transition"
              >
                Явц хадгалах
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isPending}
                className="rounded-full bg-emerald-500 px-10 py-4 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition transform hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(16,185,129,0.3)]"
              >
                Шалгалт дуусгах
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
