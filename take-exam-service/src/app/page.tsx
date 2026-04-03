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
import { ExamMonitoringConsentDialog } from "@/app/_pagecomponents/exam-monitoring-consent-dialog";
import { SebAccessGate } from "@/app/_pagecomponents/seb-access-gate";
import type {
  GetProgressResponse,
  StartExamResponse,
  SubmitAnswersResponse,
} from "@/lib/exam-service/types";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useScreenCapture } from "@/app/_pagecomponents/use-screen-capture";
import { useStudentDashboardData } from "@/app/_pagecomponents/use-student-dashboard-data";

type PendingMonitoringAction =
  {
    kind: "start";
    studentId: string;
    studentName: string;
    testId: string;
  };

export default function StudentAppPage() {
  const ACTIVE_ATTEMPT_STORAGE_KEY = "active_exam_attempt";
  const FREE_TEXT_COMMIT_DELAY_MS = 900;
  const getPersistedAnswersStorageKey = (attemptId: string) =>
    `answers_${attemptId}`;
  const [activeAttempt, setActiveAttempt] = useState<StartExamResponse | null>(
    null,
  );
  const [latestProgress, setLatestProgress] = useState<
    GetProgressResponse | SubmitAnswersResponse | null
  >(null);
  const [latestSubmittedExamTitle, setLatestSubmittedExamTitle] = useState<
    string | null
  >(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<
    Record<string, boolean>
  >({});
  const [activeSection, setActiveSection] =
    useState<NavigationSection>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isFinalizingAttempt, setIsFinalizingAttempt] = useState(false);
  const [pendingMonitoringAction, setPendingMonitoringAction] =
    useState<PendingMonitoringAction | null>(null);
  const [pendingResumeAttempt, setPendingResumeAttempt] = useState<{
    attemptId: string;
    studentId: string;
  } | null>(null);
  const autosaveInFlightRef = useRef(false);
  const examShellRef = useRef<HTMLDivElement | null>(null);
  const promptedResumeAttemptIdRef = useRef<string | null>(null);
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
    completedByTestId,
    filteredTests,
    hasPendingApprovalAttempts,
    inProgressByTestId,
    isInitialLoading,
    loadDashboardData,
    passRate,
    passedAttemptsCount,
    resultAttempts,
    resultRows,
    selectedStudent,
    selectedStudentId,
    setSelectedStudentId,
    visibleCompletedAttempts,
  } = useStudentDashboardData({ setError });
  const monitoringUserId =
    activeAttempt?.studentId ??
    (pendingMonitoringAction?.kind === "start"
      ? pendingMonitoringAction.studentId
      : (pendingResumeAttempt?.studentId ?? selectedStudent?.id ?? null));
  const monitoringStudentName =
    activeAttempt?.studentName ??
    (pendingMonitoringAction?.kind === "start"
      ? pendingMonitoringAction.studentName
      : selectedStudent?.name ?? null);
  const screenCapture = useScreenCapture({
    attemptId: activeAttempt?.attemptId ?? null,
    examContainerRef: examShellRef,
    studentName: monitoringStudentName,
    userId: monitoringUserId,
  });
  const {
    markInteraction,
    recordBehaviorEvent,
    resetActivityTracking,
    timeLeftMs,
    trackQuestionView,
  } = useExamMonitoring(activeAttempt, {
    captureEvidence: screenCapture.captureEvidence,
    enabled: !isFinalizingAttempt,
    monitoringMode: screenCapture.mode,
  });
  const { answers, clearAnswers, setAnswers } = usePersistedExamAnswers(
    activeAttempt?.attemptId ?? null,
    activeAttempt?.existingAnswers ?? null,
  );
  const { clearMonitoringState } = useExamSessionMonitoring({
    attemptId: activeAttempt?.attemptId ?? null,
    enabled: Boolean(activeAttempt) && !isFinalizingAttempt,
    monitoringMode: screenCapture.mode,
  });

  useAnimatedDocumentTitle("Сурагч Портал");

  const normalizeFreeTextAnswer = useCallback((value?: string | null) => {
    return value?.replace(/\s+/g, " ").trim() ?? "";
  }, []);

  const readPersistedAnswersSnapshot = useCallback((attemptId: string) => {
    try {
      const rawValue = localStorage.getItem(
        getPersistedAnswersStorageKey(attemptId),
      );
      if (!rawValue) {
        return {} as Record<string, string | null>;
      }

      const parsed = JSON.parse(rawValue) as Record<string, string | null>;
      return parsed ?? {};
    } catch {
      localStorage.removeItem(getPersistedAnswersStorageKey(attemptId));
      return {} as Record<string, string | null>;
    }
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
            title: "Хариулж эхэлсэн",
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
          title: "Хариу өөрчилсөн",
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

      commitMathAnswerSnapshot(
        question.questionId,
        answers[question.questionId],
      );
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

  const flushQuestionMetrics = useCallback(
    async (attemptId: string) => {
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
    },
    [commitActiveQuestionDwell, flushPendingMathAnswerCommits],
  );

  const openAttempt = useCallback(
    (attempt: StartExamResponse) => {
      setActiveAttempt(attempt);
      setLatestProgress(null);
      setLatestSubmittedExamTitle(null);
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

  const finalizeSavedAttempt = useCallback(
    async (attemptId: string) => {
      setError(null);
      setIsMutating(true);
      setIsFinalizingAttempt(true);

      try {
        const persistedAnswers = readPersistedAnswersSnapshot(attemptId);
        const submittedProgress = await submitAnswersRequest({
          attemptId,
          answers: Object.entries(persistedAnswers).map(
            ([questionId, selectedOptionId]) => ({
              questionId,
              selectedOptionId: selectedOptionId ?? null,
            }),
          ),
          finalize: true,
        });

        setLatestProgress(submittedProgress);
        clearMonitoringState(attemptId);
        screenCapture.resetMonitoringCapture();
        clearAnswers(attemptId);
        setActiveAttempt(null);
        setPendingResumeAttempt(null);
        setFlaggedQuestions({});
        resetQuestionMetricsTracking();
        resetActivityTracking();
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        setActiveSection("results");
        await loadDashboardData({ force: true });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Шалгалтыг дуусгах үед алдаа гарлаа.",
        );
      } finally {
        setIsFinalizingAttempt(false);
        setIsMutating(false);
      }
    },
    [
      ACTIVE_ATTEMPT_STORAGE_KEY,
      clearAnswers,
      clearMonitoringState,
      loadDashboardData,
      readPersistedAnswersSnapshot,
      resetActivityTracking,
      resetQuestionMetricsTracking,
      screenCapture,
    ],
  );

  const resumeAttemptWithoutMonitoringConsent = useCallback(
    async (attemptId: string) => {
      setError(null);
      setIsMutating(true);

      try {
        const sebCheck = await verifySebAccess();
        if (!sebCheck.ok) {
          showSebFriendlyWarning(sebCheck.message);
          setPendingResumeAttempt(null);
          return;
        }

        screenCapture.resetMonitoringCapture();
        const permissionRequest = screenCapture
          .requestScreenCaptureAccess()
          .catch((error) => {
            console.error("Failed to request screen capture access:", error);
            return "fallback-dom-capture" as const;
          });
        const nextAttempt = await resumeExamRequest(attemptId);
        setPendingResumeAttempt(null);
        setPendingMonitoringAction(null);
        openAttempt(nextAttempt);
        void permissionRequest;
      } catch (err) {
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        setPendingResumeAttempt(null);
        setError(
          err instanceof Error ? err.message : "Шалгалтыг сэргээж чадсангүй.",
        );
      } finally {
        setIsMutating(false);
      }
    },
    [
      ACTIVE_ATTEMPT_STORAGE_KEY,
      openAttempt,
      screenCapture,
      showSebFriendlyWarning,
      verifySebAccess,
    ],
  );

  const handleConfirmResumeAttempt = useCallback(() => {
    if (!pendingResumeAttempt) {
      return;
    }

    void resumeAttemptWithoutMonitoringConsent(pendingResumeAttempt.attemptId);
  }, [pendingResumeAttempt, resumeAttemptWithoutMonitoringConsent]);

  const handleDeclineResumeAttempt = useCallback(async () => {
    if (!pendingResumeAttempt) {
      return;
    }

    await finalizeSavedAttempt(pendingResumeAttempt.attemptId);
  }, [finalizeSavedAttempt, pendingResumeAttempt]);

  const handleStartExam = (testId: string) => {
    if (!selectedStudent) {
      setError("Эхлээд сурагчаа сонгоно уу.");
      return;
    }

    setError(null);
    setPendingMonitoringAction({
      kind: "start",
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      testId,
    });
  };

  const handleResumeExam = (attemptId: string) => {
    void resumeAttemptWithoutMonitoringConsent(attemptId);
  };

  const requestExamFullscreen = useCallback(async () => {
    if (typeof document === "undefined" || document.fullscreenElement) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers may still reject fullscreen requests.
    }
  }, []);

  const handleMonitoringConsentContinue = useCallback(async () => {
    if (!pendingMonitoringAction) {
      return;
    }

    setError(null);
    setIsMutating(true);

    try {
      const sebCheck = await verifySebAccess();
      if (!sebCheck.ok) {
        showSebFriendlyWarning(sebCheck.message);
        setPendingMonitoringAction(null);
        return;
      }

      const permissionRequest = screenCapture
        .requestScreenCaptureAccess()
        .catch((error) => {
          console.error("Failed to request screen capture access:", error);
          return "fallback-dom-capture" as const;
        });

      const nextAttempt = await startExamRequest({
        testId: pendingMonitoringAction.testId,
        studentId: pendingMonitoringAction.studentId,
        studentName: pendingMonitoringAction.studentName,
      });

      setPendingMonitoringAction(null);
      setPendingResumeAttempt(null);
      openAttempt(nextAttempt);
      void permissionRequest;
    } catch (err) {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
      setPendingMonitoringAction(null);
      setError(
        err instanceof Error
          ? err.message
          : "Шалгалт эхлүүлэхэд алдаа гарлаа.",
      );
    } finally {
      setIsMutating(false);
    }
  }, [
    ACTIVE_ATTEMPT_STORAGE_KEY,
    openAttempt,
    pendingMonitoringAction,
    screenCapture,
    showSebFriendlyWarning,
    verifySebAccess,
  ]);

  const handleMonitoringConsentDecline = useCallback(async () => {
    if (!pendingMonitoringAction) {
      return;
    }

    setError(null);
    setIsMutating(true);

    try {
      const sebCheck = await verifySebAccess();
      if (!sebCheck.ok) {
        showSebFriendlyWarning(sebCheck.message);
        setPendingMonitoringAction(null);
        return;
      }

      screenCapture.resetMonitoringCapture();

      const nextAttempt = await startExamRequest({
        testId: pendingMonitoringAction.testId,
        studentId: pendingMonitoringAction.studentId,
        studentName: pendingMonitoringAction.studentName,
      });

      setPendingMonitoringAction(null);
      setPendingResumeAttempt(null);
      openAttempt(nextAttempt);
    } catch (err) {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
      setPendingMonitoringAction(null);
      setError(
        err instanceof Error
          ? err.message
          : "Шалгалт эхлүүлэхэд алдаа гарлаа.",
      );
    } finally {
      setIsMutating(false);
    }
  }, [
    ACTIVE_ATTEMPT_STORAGE_KEY,
    openAttempt,
    pendingMonitoringAction,
    screenCapture,
    showSebFriendlyWarning,
    verifySebAccess,
  ]);

  const handleMonitoringConsentOpenChange = useCallback((open: boolean) => {
    if (!open && !isMutating && !screenCapture.isRequestingPermission) {
      setPendingMonitoringAction(null);
    }
  }, [isMutating, screenCapture.isRequestingPermission]);

  const handleDismissMonitoringWarning = useCallback(() => {
    screenCapture.dismissPermissionWarning();
  }, [screenCapture]);

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
          title: "Хариулж эхэлсэн",
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
          title: "Хариу өөрчилсөн",
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
        title: nextFlagState
          ? "Асуулт тэмдэглэсэн"
          : "Тэмдэглэгээ цуцалсан",
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
        title: finalize ? "Эцэслэн илгээсэн" : "Явц хадгалсан",
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
        setLatestSubmittedExamTitle(activeAttempt.exam.title);
      }

      if (finalize) {
        clearMonitoringState(activeAttempt.attemptId);
        screenCapture.resetMonitoringCapture();
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
    if (
      !latestProgress ||
      latestProgress.status === "approved" ||
      approvedAttempts.length === 0
    ) {
      return;
    }

    const approvedAttempt = approvedAttempts.find(
      (attempt) => attempt.attemptId === latestProgress.attemptId,
    );
    if (!approvedAttempt?.result) {
      return;
    }

    setLatestProgress((current) => {
      if (
        !current ||
        current.attemptId !== approvedAttempt.attemptId ||
        current.status === "approved"
      ) {
        return current;
      }

      return {
        attemptId: approvedAttempt.attemptId,
        status: "approved",
        progress: current.progress,
        result: approvedAttempt.result,
        feedback: approvedAttempt.feedback,
      };
    });
  }, [approvedAttempts, latestProgress]);

  useEffect(() => {
    const shouldRefreshResults =
      activeSection === "results" ||
      latestProgress?.status === "submitted" ||
      latestProgress?.status === "processing" ||
      hasPendingApprovalAttempts;

    if (
      activeAttempt ||
      isInitialLoading ||
      isMutating ||
      !selectedStudent ||
      !shouldRefreshResults ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    void loadDashboardData({ force: true });
  }, [
    activeAttempt,
    activeSection,
    hasPendingApprovalAttempts,
    isInitialLoading,
    isMutating,
    latestProgress?.status,
    loadDashboardData,
    selectedStudent,
  ]);

  useEffect(() => {
    const shouldPollForDashboard =
      activeSection === "results" ||
      latestProgress?.status === "submitted" ||
      latestProgress?.status === "processing" ||
      hasPendingApprovalAttempts;

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

      void loadDashboardData({ force: true });
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeAttempt,
    activeSection,
    hasPendingApprovalAttempts,
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

      if (promptedResumeAttemptIdRef.current === parsed.attemptId) {
        return;
      }

      const attemptId = parsed.attemptId;
      if (!attemptId) {
        sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
        return;
      }

      promptedResumeAttemptIdRef.current = attemptId;
      setPendingResumeAttempt({
        attemptId,
        studentId: parsed.studentId,
      });
    } catch {
      sessionStorage.removeItem(ACTIVE_ATTEMPT_STORAGE_KEY);
    }
  }, [
    activeAttempt,
    isInitialLoading,
    isMutating,
    isSebChecking,
    pendingResumeAttempt,
    selectedStudent,
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
          detail: "Автомат хадгалалтын төлөв сервертэй синк хийгдлээ.",
          severity: "info",
          title: "Автомат хадгалалт",
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
        <AlertDialog
          open={screenCapture.isPermissionWarningOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleDismissMonitoringWarning();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Дэлгэц хуваалцах зөвшөөрөл олгогдсонгүй
              </AlertDialogTitle>
              <AlertDialogDescription>
                Дэлгэц хуваалцах зөвшөөрөл өгвөл шалгалтын хяналт илүү бүрэн
                ажиллана. Дараа дахин зөвшөөрөх бол <strong>Entire screen</strong>
                {" "}буюу <strong>Бүтэн дэлгэц</strong>-ийг сонгоно уу.
                Одоогоор боломжтой тохиолдолд fallback хяналт ашиглан шалгалт
                хэвийн үргэлжилнэ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleDismissMonitoringWarning}>
                Ойлголоо
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <TakeExam
          attempt={activeAttempt}
          answers={answers}
          containerRef={examShellRef}
          error={error}
          flaggedQuestions={flaggedQuestions}
          isMutating={isMutating}
          onQuestionInteract={() => void requestExamFullscreen()}
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
      <ExamMonitoringConsentDialog
        isSubmitting={isMutating || screenCapture.isRequestingPermission}
        open={pendingMonitoringAction?.kind === "start"}
        onAccept={() => void handleMonitoringConsentContinue()}
        onOpenChange={handleMonitoringConsentOpenChange}
        onDecline={() => void handleMonitoringConsentDecline()}
      />
      <AlertDialog
        open={screenCapture.isPermissionWarningOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleDismissMonitoringWarning();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Дэлгэц хуваалцах зөвшөөрөл олгогдсонгүй
            </AlertDialogTitle>
            <AlertDialogDescription>
              Дэлгэц хуваалцах зөвшөөрөл өгвөл шалгалтын хяналт илүү бүрэн
              ажиллана. Дараа дахин зөвшөөрөх бол <strong>Entire screen</strong>
              {" "}буюу <strong>Бүтэн дэлгэц</strong>-ийг сонгоно уу. Одоогоор
              боломжтой тохиолдолд fallback хяналт ашиглан шалгалт хэвийн
              үргэлжилнэ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDismissMonitoringWarning}>
              Ойлголоо
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(pendingResumeAttempt)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Шалгалтаа үргэлжлүүлэх үү?</AlertDialogTitle>
            <AlertDialogDescription>
              Таны эхлүүлсэн шалгалт олдлоо. Үргэлжлүүлбэл өмнөх хариултууд
              болон асуултын дараалал хэвээр сэргэнэ. Үгүй гэвэл одоогийн
              оролдлогыг шууд дууссан гэж тэмдэглэнэ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isMutating}
              onClick={(event) => {
                event.preventDefault();
                void handleDeclineResumeAttempt();
              }}
            >
              Үгүй, дуусга
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutating}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmResumeAttempt();
              }}
            >
              Үргэлжлүүлье
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isSebChecking ? (
        <SebAccessGate isChecking={true} message={null} onRetry={() => {}} />
      ) : (
        <StudentPageShell
          activeSection={activeSection}
          activeTestsCount={activeTestsCount}
          averageScore={averageScore}
          availableStudents={availableStudents}
          completedAttemptsLength={visibleCompletedAttempts.length}
          completedByTestId={completedByTestId}
          error={error}
          filteredTests={filteredTests}
          inProgressByTestId={inProgressByTestId}
          isInitialLoading={isInitialLoading}
          isMutating={isMutating}
          latestProgress={latestProgress}
          latestSubmittedExamTitle={latestSubmittedExamTitle}
          pageTitle={pageTitle}
          passRate={passRate}
          passedAttemptsCount={passedAttemptsCount}
          resultAttempts={resultAttempts}
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
