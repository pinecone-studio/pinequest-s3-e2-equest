"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Save,
  Send,
  TrendingUp,
  Trophy,
  type LucideIcon,
  UserRound,
} from "lucide-react";
import type {
  AttemptSummary,
  ExamAnswerInput,
  GetProgressResponse,
  StartExamResponse,
  StudentInfo,
  SubmitAnswersResponse,
  TeacherTestSummary,
} from "@/lib/exam-service/types";
import {
  mockStudentPortalClient,
  USE_MOCK_DATA,
} from "@/lib/mock/student-portal-client";

type GraphQlResult<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type NavigationSection = "dashboard" | "tests" | "results";

const STUDENTS_QUERY = `
  query {
    students { id name className }
  }
`;

const DASHBOARD_QUERY = `
  query {
    availableTests {
      id
      title
      description
      updatedAt
      criteria { subject topic className gradeLevel questionCount }
    }
    attempts {
      attemptId
      testId
      title
      studentId
      studentName
      status
      score
      maxScore
      percentage
      startedAt
      submittedAt
      result {
        score
        maxScore
        percentage
        correctCount
        questionResults { questionId isCorrect explanation }
      }
    }
  }
`;

const START_EXAM_MUTATION = `
  mutation StartExam($testId: String!, $sid: String!, $sname: String!) {
    startExam(testId: $testId, studentId: $sid, studentName: $sname) {
      attemptId
      status
      studentId
      studentName
      startedAt
      expiresAt
      exam {
        testId
        title
        description
        timeLimitMinutes
        questions {
          questionId
          prompt
          type
          points
          options { id text }
        }
      }
      progress {
        totalQuestions
        answeredQuestions
        remainingQuestions
        completionRate
      }
    }
  }
`;

const RESUME_EXAM_MUTATION = `
  mutation ResumeExam($attemptId: String!) {
    resumeExam(attemptId: $attemptId) {
      attemptId
      status
      studentId
      studentName
      startedAt
      expiresAt
      exam {
        testId
        title
        description
        timeLimitMinutes
        questions {
          questionId
          prompt
          type
          points
          options { id text }
        }
      }
      progress {
        totalQuestions
        answeredQuestions
        remainingQuestions
        completionRate
      }
    }
  }
`;

const SUBMIT_ANSWERS_MUTATION = `
  mutation SubmitAnswers($attemptId: String!, $answers: [AnswerInput!]!, $finalize: Boolean!) {
    submitAnswers(attemptId: $attemptId, answers: $answers, finalize: $finalize) {
      attemptId
      status
      progress {
        answeredQuestions
        totalQuestions
        completionRate
      }
      result {
        score
        maxScore
        percentage
        correctCount
      }
    }
  }
`;

const gqlRequest = async <T,>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> => {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as GraphQlResult<T>;

  if (!response.ok) {
    throw new Error(
      payload.errors?.[0]?.message || "Сервертэй холбогдож чадсангүй.",
    );
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  if (!payload.data) {
    throw new Error("Хоосон хариу ирлээ.");
  }

  return payload.data;
};

const loadStudentsData = async (): Promise<StudentInfo[]> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.getStudents();
  }

  const { students } = await gqlRequest<{ students: StudentInfo[] }>(
    STUDENTS_QUERY,
  );
  return students ?? [];
};

const loadDashboardPayload = async (): Promise<{
  availableTests: TeacherTestSummary[];
  attempts: AttemptSummary[];
}> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.getDashboard();
  }

  return gqlRequest<{
    availableTests: TeacherTestSummary[];
    attempts: AttemptSummary[];
  }>(DASHBOARD_QUERY);
};

const startExamRequest = async (payload: {
  testId: string;
  studentId: string;
  studentName: string;
}): Promise<StartExamResponse> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.startExam(payload);
  }

  const data = await gqlRequest<{ startExam: StartExamResponse }>(
    START_EXAM_MUTATION,
    {
      testId: payload.testId,
      sid: payload.studentId,
      sname: payload.studentName,
    },
  );
  return data.startExam;
};

const resumeExamRequest = async (
  attemptId: string,
): Promise<StartExamResponse> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.resumeExam(attemptId);
  }

  const data = await gqlRequest<{ resumeExam: StartExamResponse }>(
    RESUME_EXAM_MUTATION,
    {
      attemptId,
    },
  );
  return data.resumeExam;
};

const submitAnswersRequest = async (payload: {
  attemptId: string;
  answers: ExamAnswerInput[];
  finalize: boolean;
}): Promise<SubmitAnswersResponse> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.submitAnswers(payload);
  }

  const data = await gqlRequest<{ submitAnswers: SubmitAnswersResponse }>(
    SUBMIT_ANSWERS_MUTATION,
    payload,
  );
  return data.submitAnswers;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatTimeLeft = (ms: number) => {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const testKey = (test: TeacherTestSummary) =>
  `${test.criteria.subject}-${test.criteria.topic}-${test.title}`.toLowerCase();

const estimateDurationMinutes = (test: TeacherTestSummary) => {
  const subject = test.criteria.subject.toLowerCase();
  if (subject.includes("физик")) return 90;
  if (subject.includes("англи")) return 30;
  return Math.max(30, Math.min(120, test.criteria.questionCount * 5));
};

export default function StudentAppPage() {
  const [availableStudents, setAvailableStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [tests, setTests] = useState<TeacherTestSummary[]>([]);
  const [allAttempts, setAllAttempts] = useState<AttemptSummary[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<StartExamResponse | null>(
    null,
  );
  const [latestProgress, setLatestProgress] = useState<
    GetProgressResponse | SubmitAnswersResponse | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const studentMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedStudent = useMemo(
    () =>
      availableStudents.find((student) => student.id === selectedStudentId) ??
      null,
    [availableStudents, selectedStudentId],
  );

  const studentAttempts = useMemo(() => {
    if (!selectedStudent) return [];
    return allAttempts.filter(
      (attempt) => attempt.studentId === selectedStudent.id,
    );
  }, [allAttempts, selectedStudent]);

  const approvedAttempts = useMemo(
    () => studentAttempts.filter((attempt) => attempt.status === "approved"),
    [studentAttempts],
  );

  const inProgressByTestId = useMemo(() => {
    const map = new Map<string, AttemptSummary>();

    studentAttempts
      .filter((attempt) => attempt.status === "in_progress")
      .forEach((attempt) => {
        const existing = map.get(attempt.testId);
        if (
          !existing ||
          new Date(existing.startedAt) < new Date(attempt.startedAt)
        ) {
          map.set(attempt.testId, attempt);
        }
      });

    return map;
  }, [studentAttempts]);

  const filteredTests = useMemo(() => {
    if (!selectedStudent) return [];

    return Array.from(
      tests
        .filter((test) => {
          const studentClass = selectedStudent.className.trim().toUpperCase();
          const testClass = test.criteria.className.trim().toUpperCase();
          const classMatched = testClass === "" || testClass === studentClass;
          if (!classMatched) return false;

          const alreadyFinished = studentAttempts.some(
            (attempt) =>
              attempt.testId === test.id &&
              (attempt.status === "submitted" || attempt.status === "approved"),
          );

          return !alreadyFinished;
        })
        .reduce((map, test) => {
          const key = testKey(test);
          const existing = map.get(key);

          if (
            !existing ||
            new Date(test.updatedAt) > new Date(existing.updatedAt)
          ) {
            map.set(key, test);
          }

          return map;
        }, new Map<string, TeacherTestSummary>())
        .values(),
    );
  }, [selectedStudent, tests, studentAttempts]);

  const activeTestsCount = filteredTests.length;
  const completionRate = approvedAttempts.length
    ? Math.round(
        (approvedAttempts.length /
          Math.max(
            1,
            studentAttempts.filter(
              (attempt) =>
                attempt.status === "approved" || attempt.status === "submitted",
            ).length,
          )) *
          100,
      )
    : 0;
  const averageScore = approvedAttempts.length
    ? Math.round(
        approvedAttempts.reduce(
          (sum, attempt) => sum + (attempt.percentage ?? 0),
          0,
        ) / approvedAttempts.length,
      )
    : 0;

  const completedAttempts = useMemo(
    () =>
      studentAttempts.filter(
        (attempt) =>
          attempt.status === "approved" || attempt.status === "submitted",
      ),
    [studentAttempts],
  );

  const passedAttemptsCount = useMemo(
    () =>
      approvedAttempts.filter((attempt) => (attempt.percentage ?? 0) >= 60)
        .length,
    [approvedAttempts],
  );

  const passRate = completedAttempts.length
    ? Math.round((passedAttemptsCount / completedAttempts.length) * 100)
    : 0;

  const testsById = useMemo(
    () => new Map(tests.map((test) => [test.id, test])),
    [tests],
  );

  const resultRows = useMemo(
    () =>
      completedAttempts.map((attempt) => {
        const mappedTest = testsById.get(attempt.testId);
        const scoreText =
          attempt.score != null && attempt.maxScore != null
            ? `${attempt.score}/${attempt.maxScore}`
            : attempt.percentage != null
              ? `${attempt.percentage}%`
              : "-";

        return {
          attemptId: attempt.attemptId,
          examName: attempt.title,
          subject: mappedTest?.criteria.subject ?? "Ерөнхий",
          className: selectedStudent?.className ?? "-",
          teacher: "С.Жаргалмаа",
          startedAt: formatDate(attempt.startedAt),
          finishedAt: formatDate(attempt.submittedAt ?? attempt.startedAt),
          scoreText,
        };
      }),
    [completedAttempts, testsById, selectedStudent],
  );

  const activeQuestionIds =
    activeAttempt?.exam.questions.map((question) => question.questionId) ?? [];
  const answeredCount = activeQuestionIds.filter((questionId) =>
    Boolean(answers[questionId]),
  ).length;
  const completionFromLocal = activeQuestionIds.length
    ? Math.round((answeredCount / activeQuestionIds.length) * 100)
    : 0;

  const timeLeftMs = activeAttempt
    ? Math.max(0, new Date(activeAttempt.expiresAt).getTime() - now)
    : 0;

  const loadStudents = async () => {
    const nextStudents = await loadStudentsData();

    setAvailableStudents(nextStudents);
    setSelectedStudentId((prev) => {
      if (prev && nextStudents.some((student) => student.id === prev))
        return prev;
      return nextStudents[0]?.id ?? "";
    });
  };

  const loadDashboardData = async () => {
    const data = await loadDashboardPayload();

    setTests(data.availableTests ?? []);
    setAllAttempts(data.attempts ?? []);
  };

  const initialize = async () => {
    setError(null);
    setIsInitialLoading(true);

    try {
      await Promise.all([loadStudents(), loadDashboardData()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Өгөгдөл ачаалж чадсангүй.",
      );
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!activeAttempt) return;

    const key = `answers_${activeAttempt.attemptId}`;
    const savedValue = localStorage.getItem(key);

    if (!savedValue) {
      setAnswers({});
      return;
    }

    try {
      const parsed = JSON.parse(savedValue) as Record<string, string | null>;
      setAnswers(parsed);
    } catch {
      setAnswers({});
    }
  }, [activeAttempt]);

  useEffect(() => {
    if (!activeAttempt) return;
    localStorage.setItem(
      `answers_${activeAttempt.attemptId}`,
      JSON.stringify(answers),
    );
  }, [answers, activeAttempt]);

  useEffect(() => {
    if (!activeAttempt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt]);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!studentMenuRef.current?.contains(event.target as Node)) {
        setIsStudentMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    const baseTitle = "Сурагч Портал";
    const frames = [
      "📝   🧑‍💻   ✅",
      " ⏳   📝   📚",
      "  ✅   🎯   🧠",
      " 📖   📝   ✅",
      "  ✅   📚   🎯",
      " ⏳   ✅   📚",
    ];

    let frameIndex = 0;
    document.title = `${frames[frameIndex]} | ${baseTitle}`;

    const titleTimer = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      document.title = `${frames[frameIndex]} | ${baseTitle}`;
    }, 700);

    return () => {
      window.clearInterval(titleTimer);
      document.title = baseTitle;
    };
  }, []);

  const handleStartExam = async (testId: string) => {
    if (!selectedStudent) {
      setError("Эхлээд сурагчаа сонгоно уу.");
      return;
    }

    setError(null);
    setIsMutating(true);

    try {
      const startedAttempt = await startExamRequest({
        testId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
      });

      setActiveAttempt(startedAttempt);
      setLatestProgress(null);
      setAnswers({});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Шалгалт эхлүүлэхэд алдаа гарлаа.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleResumeExam = async (attemptId: string) => {
    setError(null);
    setIsMutating(true);

    try {
      const resumedAttempt = await resumeExamRequest(attemptId);

      setActiveAttempt(resumedAttempt);
      setLatestProgress(null);
      setAnswers({});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Шалгалтыг сэргээж чадсангүй.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async (finalize: boolean) => {
    if (!activeAttempt) return;

    setError(null);
    setIsMutating(true);

    try {
      const payloadAnswers = activeAttempt.exam.questions.map((question) => ({
        questionId: question.questionId,
        selectedOptionId: answers[question.questionId] ?? null,
      }));

      const submittedProgress = await submitAnswersRequest({
        attemptId: activeAttempt.attemptId,
        answers: payloadAnswers,
        finalize,
      });

      setLatestProgress(submittedProgress);

      if (finalize) {
        localStorage.removeItem(`answers_${activeAttempt.attemptId}`);
        setActiveAttempt(null);
        setAnswers({});
        setActiveSection("results");
        await loadDashboardData();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Хариулт илгээх үед алдаа гарлаа.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const renderTestCards = (emptyMessage: string) => {
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
                  onClick={() => handleResumeExam(resumableAttempt.attemptId)}
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
              ) : (
                <button
                  onClick={() => handleStartExam(test.id)}
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
  };

  const pageTitle = activeAttempt
    ? "Шалгалт өгч байна"
    : activeSection === "dashboard"
      ? "Хяналтын самбар"
      : activeSection === "tests"
        ? "Идэвхтэй шалгалтууд"
        : "Шалгалтын дүн";

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
              disabled={Boolean(activeAttempt)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                            setSelectedStudentId(student.id);
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
              onClick={() => setActiveSection("dashboard")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-14px text-sm font-medium transition ${
                activeSection === "dashboard"
                  ? "bg-[#e6f5fd] text-[#1287c7]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Хяналтын самбар
            </button>
            <button
              onClick={() => setActiveSection("tests")}
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
              onClick={() => setActiveSection("results")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                activeSection === "results"
                  ? "bg-[#e6f5fd] text-[#1287c7]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Trophy className="h-4 w-4" />
              Шалгалтын дүн
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[11px] font-semibold text-slate-700">
                {completedAttempts.length}
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
            ) : activeAttempt ? (
              <section className="space-y-5">
                <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Шалгалт өгч байна
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">
                      {activeAttempt.exam.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {activeAttempt.exam.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Оролдлогын ID:{" "}
                      <span className="font-semibold">
                        {activeAttempt.attemptId}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#e6f5fd] px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#1287c7]">
                      Үлдсэн хугацаа
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#0a6fa7]">
                      {formatTimeLeft(timeLeftMs)}
                    </p>
                    <p className="text-xs text-[#0a6fa7]">
                      Дуусах: {formatDate(activeAttempt.expiresAt)}
                    </p>
                  </div>
                </header>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">
                      Явц: {completionFromLocal}%
                    </p>
                    <p className="text-sm text-slate-500">
                      {answeredCount}/{activeQuestionIds.length} хариулсан
                    </p>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#18a7eb] transition-all"
                      style={{ width: `${completionFromLocal}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {activeAttempt.exam.questions.map((question, index) => (
                    <article
                      key={question.questionId}
                      className="rounded-2xl border border-slate-200 bg-white p-5"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">
                          {index + 1}. {question.prompt}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {question.points} оноо
                        </span>
                      </div>

                      <div className="space-y-2">
                        {question.options.map((option) => {
                          const selected =
                            answers[question.questionId] === option.id;

                          return (
                            <label
                              key={option.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                                selected
                                  ? "border-[#18a7eb] bg-[#e6f5fd]"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <input
                                type="radio"
                                name={question.questionId}
                                checked={selected}
                                onChange={() =>
                                  handleSelectAnswer(
                                    question.questionId,
                                    option.id,
                                  )
                                }
                                className="h-4 w-4 accent-[#18a7eb]"
                              />
                              <span className="text-sm text-slate-800">
                                {option.text}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>

                <footer className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 backdrop-blur">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isMutating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Явц хадгалах
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#18a7eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f95d6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isMutating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Шалгалт дуусгах
                  </button>
                </footer>
              </section>
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
                        caption={`${approvedAttempts.length} шалгалт батлагдсан`}
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
                        latestProgress.status === "processing") && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                          <div className="flex items-center gap-2 font-semibold">
                            <FileCheck2 className="h-4 w-4" />
                            {latestProgress.status === "processing"
                              ? "Шалгалтыг боловсруулж байна"
                              : "Шалгалт амжилттай илгээгдлээ"}
                          </div>
                          <p className="mt-1 text-sm text-emerald-700/90">
                            Таны хариулт амжилттай бүртгэгдсэн. Батлагдсаны
                            дараа дүн хэсэгт харагдана.
                          </p>
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
                      {renderTestCards(
                        "Танд тохирох идэвхтэй шалгалт олдсонгүй.",
                      )}
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
                    {renderTestCards("Одоогоор шалгалт алга.")}
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
                        value={String(completedAttempts.length)}
                        caption="Дуусгасан шалгалт"
                        icon={Trophy}
                      />
                      <StatCard
                        title="Тэнцсэн хувь"
                        value={`${passRate}%`}
                        caption={`${completedAttempts.length}-с ${passedAttemptsCount} тэнцсэн`}
                        icon={CheckCircle2}
                      />
                      <StatCard
                        title="Дундаж оноо"
                        value={`${averageScore}%`}
                        caption="Бүх шалгалтаар"
                        icon={TrendingUp}
                      />
                    </div>

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

type StatCardProps = {
  title: string;
  value: string;
  caption: string;
  icon: LucideIcon;
};

function StatCard({ title, value, caption, icon: Icon }: StatCardProps) {
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
