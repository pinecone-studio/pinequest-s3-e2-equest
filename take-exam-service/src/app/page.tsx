"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TakeExam } from "@/app/_component/take-exam";
import {
  logQuestionMetricsRequest,
  resumeExamRequest,
  startExamRequest,
  submitAnswersRequest,
} from "@/app/_pagecomponents/student-page-api";
import {
  type NavigationSection,
  StudentPageShell,
} from "@/app/_pagecomponents/student-page-shell";
import { SebAccessGate } from "@/app/_pagecomponents/seb-access-gate";
import type {
  GetProgressResponse,
  StartExamResponse,
  SubmitAnswersResponse,
} from "@/lib/exam-service/types";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useAnimatedDocumentTitle } from "@/app/_pagecomponents/use-animated-document-title";
import {
  formatTimeLeft,
  getSebFriendlyWarning,
} from "@/app/_pagecomponents/student-page-utils";
import { useExamMonitoring } from "@/app/_pagecomponents/use-exam-monitoring";
import { useExamSessionMonitoring } from "@/app/_pagecomponents/use-exam-session-monitoring";
import { usePersistedExamAnswers } from "@/app/_pagecomponents/use-persisted-exam-answers";
import { useSebAccess } from "@/app/_pagecomponents/use-seb-access";
import { useStudentDashboardData } from "@/app/_pagecomponents/use-student-dashboard-data";

export default function StudentAppPage() {
  const ACTIVE_ATTEMPT_STORAGE_KEY = "active_exam_attempt";
  const FREE_TEXT_COMMIT_DELAY_MS = 900;
  const [activeAttempt, setActiveAttempt] = useState<StartExamResponse | null>(
    null,
  );
  const [latestProgress, setLatestProgress] = useState<
    GetProgressResponse | SubmitAnswersResponse | null
  >(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<
    Record<string, boolean>
  >({});
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isFinalizingAttempt, setIsFinalizingAttempt] = useState(false);
  const autosaveInFlightRef = useRef(false);
  const autoResumeAttemptIdRef = useRef<string | null>(null);
  const mathAnswerCommitTimersRef = useRef<Record<string, number>>({});
  const committedMathAnswersRef = useRef<Record<string, string>>({});
  const questionMetricsRef = useRef<
    Record<string, { answerChangeCount: number; dwellMs: number }>
  >({});
  const activeQuestionTimingRef = useRef<{
    questionId: string;
    startedAt: number;
  } | null>(null);
  const { isSebChecking, verifySebAccess } = useSebAccess();
  const {
    activeTestsCount,
    approvedAttempts,
    availableStudents,
    averageScore,
    completedAttempts,
    completedByTestId,
    completionRate,
    filteredTests,
    inProgressByTestId,
    isInitialLoading,
    loadDashboardData,
    passRate,
    passedAttemptsCount,
    resultRows,
    selectedStudent,
    selectedStudentId,
    setSelectedStudentId,
  } = useStudentDashboardData({ setError });
  const {
    markInteraction,
    recordBehaviorEvent,
    resetActivityTracking,
    timeLeftMs,
    trackQuestionView,
  } = useExamMonitoring(activeAttempt, !isFinalizingAttempt);
  const { answers, clearAnswers, setAnswers } = usePersistedExamAnswers(
    activeAttempt?.attemptId ?? null,
    activeAttempt?.existingAnswers ?? null,
  );
  const { clearMonitoringState } = useExamSessionMonitoring({
    attemptId: activeAttempt?.attemptId ?? null,
    enabled: Boolean(activeAttempt) && !isFinalizingAttempt,
  });

  useAnimatedDocumentTitle("Сурагч Портал");

  const normalizeFreeTextAnswer = useCallback((value?: string | null) => {
    return value?.replace(/\s+/g, " ").trim() ?? "";
  }, []);

  const resetQuestionMetricsTracking = useCallback(() => {
    Object.values(mathAnswerCommitTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    mathAnswerCommitTimersRef.current = {};
    committedMathAnswersRef.current = {};
    questionMetricsRef.current = {};
    activeQuestionTimingRef.current = null;
  }, []);

  const getQuestionMeta = useCallback(
    (questionId: string) => {
      const index = activeAttempt?.exam.questions.findIndex(
        (question) => question.questionId === questionId,
      );
      const question = activeAttempt?.exam.questions[index ?? -1];

      return {
        index: index != null && index >= 0 ? index + 1 : null,
        totalQuestions: activeAttempt?.exam.questions.length ?? 0,
        type: question?.type ?? "single-choice",
      };
    },
    [activeAttempt],
  );

  const commitActiveQuestionDwell = useCallback((endedAt = Date.now()) => {
    const activeQuestion = activeQuestionTimingRef.current;
    if (!activeQuestion) {
      return;
    }

    const elapsedMs = Math.max(0, endedAt - activeQuestion.startedAt);
    if (elapsedMs > 0) {
      const current = questionMetricsRef.current[activeQuestion.questionId] ?? {
        answerChangeCount: 0,
        dwellMs: 0,
      };
      current.dwellMs += elapsedMs;
      questionMetricsRef.current[activeQuestion.questionId] = current;
    }

    activeQuestionTimingRef.current = {
      questionId: activeQuestion.questionId,
      startedAt: endedAt,
    };
  }, []);

  const commitMathAnswerSnapshot = useCallback(
    (questionId: string, nextRawValue: string | null | undefined) => {
      delete mathAnswerCommitTimersRef.current[questionId];

      const normalizedNext = normalizeFreeTextAnswer(nextRawValue);
      const previousCommitted =
        committedMathAnswersRef.current[questionId] ?? "";

      if (!normalizedNext) {
        committedMathAnswersRef.current[questionId] = "";
        return;
      }

      const { index } = getQuestionMeta(questionId);

      if (!previousCommitted) {
        committedMathAnswersRef.current[questionId] = normalizedNext;
        if (index) {
          recordBehaviorEvent({
            code: "answer-selected",
            cooldownMs: 0,
            detail: `${index} дугаар асуултад бичгийн хариу өгч эхэллээ.`,
            severity: "info",
            title: "Answer activity",
          });
        }
        return;
      }

      if (previousCommitted === normalizedNext) {
        return;
      }

      const current = questionMetricsRef.current[questionId] ?? {
        answerChangeCount: 0,
        dwellMs: 0,
      };
      current.answerChangeCount += 1;
      questionMetricsRef.current[questionId] = current;
      committedMathAnswersRef.current[questionId] = normalizedNext;

      if (
        (current.answerChangeCount === 3 || current.answerChangeCount === 5) &&
        index
      ) {
        recordBehaviorEvent({
          code: "answer-revised",
          cooldownMs: 0,
          detail: `${index} дугаар асуултын хариуг ${current.answerChangeCount} удаа өөрчиллөө.`,
          severity: current.answerChangeCount >= 5 ? "warning" : "info",
          title: "Answer revised",
        });
      }
    },
    [getQuestionMeta, normalizeFreeTextAnswer, recordBehaviorEvent],
  );

  const flushPendingMathAnswerCommits = useCallback(() => {
    Object.values(mathAnswerCommitTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    mathAnswerCommitTimersRef.current = {};

    if (!activeAttempt) {
      return;
    }

    for (const question of activeAttempt.exam.questions) {
      if (question.type !== "math") {
        continue;
      }

      commitMathAnswerSnapshot(question.questionId, answers[question.questionId]);
    }
  }, [activeAttempt, answers, commitMathAnswerSnapshot]);

  const handleQuestionFocus = useCallback(
    (questionId: string) => {
      const activeQuestion = activeQuestionTimingRef.current;
      if (activeQuestion?.questionId === questionId) {
        return;
      }

      commitActiveQuestionDwell();
      activeQuestionTimingRef.current = {
        questionId,
        startedAt: Date.now(),
      };

      const { index, totalQuestions } = getQuestionMeta(questionId);
      if (index && totalQuestions > 0) {
        trackQuestionView(questionId, index, totalQuestions);
      }
    },
    [commitActiveQuestionDwell, getQuestionMeta, trackQuestionView],
  );

  const flushQuestionMetrics = useCallback(async (attemptId: string) => {
    flushPendingMathAnswerCommits();
    commitActiveQuestionDwell();

    const payload = Object.entries(questionMetricsRef.current)
      .map(([questionId, metric]) => ({
        questionId,
        answerChangeCount: metric.answerChangeCount,
        dwellMs: metric.dwellMs,
      }))
      .filter(
        (metric) =>
          (metric.answerChangeCount ?? 0) > 0 || (metric.dwellMs ?? 0) > 0,
      );

    if (payload.length === 0) {
      return;
    }

    questionMetricsRef.current = {};
    const activeQuestion = activeQuestionTimingRef.current;
    if (activeQuestion) {
      activeQuestionTimingRef.current = {
        questionId: activeQuestion.questionId,
        startedAt: Date.now(),
      };
    }

    try {
      await logQuestionMetricsRequest(attemptId, payload);
    } catch (error) {
      console.error("Failed to persist question metrics:", error);
    }
  }, [commitActiveQuestionDwell, flushPendingMathAnswerCommits]);

  const openAttempt = useCallback(
    (attempt: StartExamResponse) => {
      setActiveAttempt(attempt);
      setLatestProgress(null);
      setFlaggedQuestions({});
      resetQuestionMetricsTracking();
      committedMathAnswersRef.current = Object.fromEntries(
        attempt.exam.questions
          .filter((question) => question.type === "math")
          .map((question) => [
            question.questionId,
            normalizeFreeTextAnswer(
              attempt.existingAnswers?.[question.questionId] ?? null,
            ),
          ]),
      );
      resetActivityTracking();
      sessionStorage.setItem(
        ACTIVE_ATTEMPT_STORAGE_KEY,
        JSON.stringify({
          attemptId: attempt.attemptId,
          studentId: attempt.studentId,
        }),
      );
    },
    [
      ACTIVE_ATTEMPT_STORAGE_KEY,
      normalizeFreeTextAnswer,
      resetActivityTracking,
      resetQuestionMetricsTracking,
    ],
  );

  const showSebFriendlyWarning = useCallback((message?: string) => {
    const warning = getSebFriendlyWarning(message);
    setError(warning.description);
    toast.warning(warning.title, {
      description: warning.description,
    });
  }, []);

  const handleStartExam = async (testId: string) => {
    if (!selectedStudent) {
      setError("Эхлээд сурагчаа сонгоно уу.");
      return;
    }

    setError(null);
    setIsMutating(true);

    try {
      const sebCheck = await verifySebAccess();
      if (!sebCheck.ok) {
        showSebFriendlyWarning(sebCheck.message);
        return;
      }

      const startedAttempt = await startExamRequest({
        testId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
      });

      openAttempt(startedAttempt);
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
      const sebCheck = await verifySebAccess();
      if (!sebCheck.ok) {
        showSebFriendlyWarning(sebCheck.message);
        return;
      }

      const resumedAttempt = await resumeExamRequest(attemptId);
      openAttempt(resumedAttempt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Шалгалтыг сэргээж чадсангүй.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    markInteraction();

    const previousValue = answers[questionId];
    const { index, type } = getQuestionMeta(questionId);

    if (type === "math") {
      const existingTimer = mathAnswerCommitTimersRef.current[questionId];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      mathAnswerCommitTimersRef.current[questionId] = window.setTimeout(() => {
        commitMathAnswerSnapshot(questionId, optionId);
      }, FREE_TEXT_COMMIT_DELAY_MS);
    } else {
      const current = questionMetricsRef.current[questionId] ?? {
        answerChangeCount: 0,
        dwellMs: 0,
      };
      current.answerChangeCount += 1;
      questionMetricsRef.current[questionId] = current;

      if (current.answerChangeCount === 1 && index) {
        recordBehaviorEvent({
          code: "answer-selected",
          cooldownMs: 0,
          detail: `${index} дугаар асуултад сонголтын хариу өгч эхэллээ.`,
          severity: "info",
          title: "Answer activity",
        });
      }

      if (
        (current.answerChangeCount === 3 || current.answerChangeCount === 5) &&
        index
      ) {
        recordBehaviorEvent({
          code: "answer-revised",
          cooldownMs: 0,
          detail: `${index} дугаар асуултын хариуг ${current.answerChangeCount} удаа өөрчиллөө.`,
          severity: current.answerChangeCount >= 5 ? "warning" : "info",
          title: "Answer revised",
        });
      }
    }

    if (type === "math" && previousValue === optionId) {
      return;
    }

    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleToggleFlag = (questionId: string) => {
    const nextFlagState = !flaggedQuestions[questionId];
    const { index } = getQuestionMeta(questionId);
    if (index) {
      recordBehaviorEvent({
        code: nextFlagState ? "question-flagged" : "question-unflagged",
        cooldownMs: 0,
        detail: `${index} дугаар асуултыг ${
          nextFlagState ? "эргэж харахаар тэмдэглэлээ" : "тэмдэглэлээс гаргалаа"
        }.`,
        severity: "info",
        title: nextFlagState ? "Question flagged" : "Question unflagged",
      });
    }

    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleSubmit = async (finalize: boolean) => {
    if (!activeAttempt) return;

    setError(null);
    setIsMutating(true);

    try {
      markInteraction();
      await flushQuestionMetrics(activeAttempt.attemptId);

      const payloadAnswers = activeAttempt.exam.questions.map((question) => ({
        questionId: question.questionId,
        selectedOptionId: answers[question.questionId] ?? null,
      }));

      recordBehaviorEvent({
        code: finalize ? "attempt-finalize" : "attempt-save",
        cooldownMs: 0,
        detail: finalize
          ? `${payloadAnswers.filter((item) => item.selectedOptionId).length}/${
              payloadAnswers.length
            } асуулттайгаар эцсийн илгээлт хийлээ.`
          : `${payloadAnswers.filter((item) => item.selectedOptionId).length}/${
              payloadAnswers.length
            } асуулт хадгалагдлаа.`,
        severity: "info",
        title: finalize ? "Final submit" : "Save progress",
      });

      if (finalize) {
        setIsFinalizingAttempt(true);
      }

      const submittedProgress = await submitAnswersRequest({
        attemptId: activeAttempt.attemptId,
        answers: payloadAnswers,
        finalize,
      });

      setLatestProgress(submittedProgress);

      if (finalize) {
        clearMonitoringState(activeAttempt.attemptId);
        clearAnswers(activeAttempt.attemptId);
        setActiveAttempt(null);
        setFlaggedQuestions({});
        resetQuestionMetricsTracking();
        resetActivityTracking();
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        setActiveSection("results");
        await loadDashboardData({ force: true });
      }
    } catch (err) {
      setIsFinalizingAttempt(false);
      setError(
        err instanceof Error ? err.message : "Хариулт илгээх үед алдаа гарлаа.",
      );
    } finally {
      if (!finalize) {
        setIsFinalizingAttempt(false);
      }
      setIsMutating(false);
    }
  };

  const pageTitle = activeAttempt
    ? "Шалгалт өгч байна"
    : activeSection === "dashboard"
      ? "Хяналтын самбар"
      : activeSection === "tests"
        ? "Идэвхтэй шалгалтууд"
        : "Шалгалтын дүн";

  useEffect(() => {
    const shouldPollForDashboard =
      activeSection === "results" ||
      latestProgress?.status === "submitted" ||
      latestProgress?.status === "processing";

    if (
      activeAttempt ||
      isInitialLoading ||
      isMutating ||
      !selectedStudent ||
      !shouldPollForDashboard
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadDashboardData();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeAttempt,
    activeSection,
    isInitialLoading,
    isMutating,
    latestProgress?.status,
    loadDashboardData,
    selectedStudent,
  ]);

  useEffect(() => {
    if (activeAttempt || isInitialLoading || availableStudents.length === 0) {
      return;
    }

    const savedAttempt = sessionStorage.getItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    if (!savedAttempt) {
      return;
    }

    try {
      const parsed = JSON.parse(savedAttempt) as {
        attemptId?: string;
        studentId?: string;
      };

      if (
        parsed.studentId &&
        parsed.studentId !== selectedStudentId &&
        availableStudents.some((student) => student.id === parsed.studentId)
      ) {
        setSelectedStudentId(parsed.studentId);
      }
    } catch {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    }
  }, [
    activeAttempt,
    availableStudents,
    isInitialLoading,
    selectedStudentId,
    setSelectedStudentId,
  ]);

  useEffect(() => {
    if (
      isInitialLoading ||
      isSebChecking ||
      isMutating ||
      activeAttempt ||
      !selectedStudent
    ) {
      return;
    }

    const savedAttempt = sessionStorage.getItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    if (!savedAttempt) {
      return;
    }

    try {
      const parsed = JSON.parse(savedAttempt) as {
        attemptId?: string;
        studentId?: string;
      };

      if (!parsed.attemptId || !parsed.studentId) {
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        return;
      }

      if (parsed.studentId !== selectedStudent.id) {
        return;
      }

      if (autoResumeAttemptIdRef.current === parsed.attemptId) {
        return;
      }

      const attemptId = parsed.attemptId;
      if (!attemptId) {
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        return;
      }

      autoResumeAttemptIdRef.current = attemptId;

      void (async () => {
        setError(null);
        setIsMutating(true);

        try {
          const sebCheck = await verifySebAccess();
          if (!sebCheck.ok) {
            showSebFriendlyWarning(sebCheck.message);
            return;
          }

          const resumedAttempt = await resumeExamRequest(attemptId);
          openAttempt(resumedAttempt);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Шалгалтыг сэргээж чадсангүй.",
          );
        } finally {
          setIsMutating(false);
        }
      })();
    } catch {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    }
  }, [
    activeAttempt,
    isInitialLoading,
    isMutating,
    isSebChecking,
    openAttempt,
    selectedStudent,
    showSebFriendlyWarning,
    verifySebAccess,
  ]);

  useEffect(() => {
    if (!activeAttempt || isMutating || autosaveInFlightRef.current) {
      return;
    }

    const hasAnswers = Object.values(answers).some(
      (value) => value !== null && value !== "",
    );
    if (!hasAnswers) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      autosaveInFlightRef.current = true;

      try {
        markInteraction();
        await flushQuestionMetrics(activeAttempt.attemptId);
        await submitAnswersRequest({
          attemptId: activeAttempt.attemptId,
          answers: activeAttempt.exam.questions.map((question) => ({
            questionId: question.questionId,
            selectedOptionId: answers[question.questionId] ?? null,
          })),
          finalize: false,
        });

        recordBehaviorEvent({
          code: "autosave-sync",
          cooldownMs: 60_000,
          detail: "Autosave snapshot сервертэй синк хийгдлээ.",
          severity: "info",
          title: "Autosave",
        });
      } catch (err) {
        console.error("Failed to autosave exam answers:", err);
      } finally {
        autosaveInFlightRef.current = false;
      }
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeAttempt,
    answers,
    flushQuestionMetrics,
    isMutating,
    markInteraction,
    recordBehaviorEvent,
  ]);

  useEffect(() => {
    return () => {
      resetQuestionMetricsTracking();
    };
  }, [resetQuestionMetricsTracking]);

  if (activeAttempt) {
    return (
      <>
        <Toaster richColors position="top-center" />
        <TakeExam
          attempt={activeAttempt}
          answers={answers}
          error={error}
          flaggedQuestions={flaggedQuestions}
          isMutating={isMutating}
          timeLeftLabel={formatTimeLeft(timeLeftMs)}
          onQuestionFocus={handleQuestionFocus}
          onSelectAnswer={handleSelectAnswer}
          onSubmit={handleSubmit}
          onToggleFlag={handleToggleFlag}
        />
      </>
    );
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      {isSebChecking ? (
        <SebAccessGate isChecking={true} message={null} onRetry={() => {}} />
      ) : (
        <StudentPageShell
          activeSection={activeSection}
          activeTestsCount={activeTestsCount}
          approvedAttempts={approvedAttempts}
          approvedAttemptsCount={approvedAttempts.length}
          averageScore={averageScore}
          availableStudents={availableStudents}
          completedAttemptsLength={completedAttempts.length}
          completedByTestId={completedByTestId}
          completionRate={completionRate}
          error={error}
          filteredTests={filteredTests}
          inProgressByTestId={inProgressByTestId}
          isInitialLoading={isInitialLoading}
          isMutating={isMutating}
          latestProgress={latestProgress}
          pageTitle={pageTitle}
          passRate={passRate}
          passedAttemptsCount={passedAttemptsCount}
          resultRows={resultRows}
          selectedStudent={selectedStudent}
          selectedStudentId={selectedStudentId}
          onResumeExam={handleResumeExam}
          onSectionChange={setActiveSection}
          onSelectStudent={setSelectedStudentId}
          onStartExam={handleStartExam}
        />
      )}
    </>
  );
}
