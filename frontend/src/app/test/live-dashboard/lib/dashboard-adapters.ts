import type {
  AiContentSource,
  ExamAnalytics,
  Exam,
  MonitoringEvent,
  MonitoringMode,
  MonitoringState,
  QuestionReview,
  RiskLevel,
  Student,
  StudentStatus,
  SubmittedAttempt,
} from "./types";
import {
  getTakeExamScreenshotObjectUrl,
  resolveTakeExamScreenshotUrl,
} from "@/lib/take-exam-graphql";
import { isMathQuestionType } from "@/lib/is-math-question-type";
import { localizeMonitoringEventTitle } from "@/lib/monitoring-event-localization";
import { normalizeBackendLatexOnly } from "@/lib/normalize-math-text";

export type DashboardApiPayload = {
  availableTests: Array<{
    id: string;
    title: string;
    description: string;
    updatedAt: string;
    criteria: {
      className: string;
      difficulty: string;
      gradeLevel: number;
      questionCount: number;
      subject: string;
      topic: string;
    };
  }>;
  attempts: Array<{
    answerReview?: Array<{
      answerChangeCount?: number | null;
      competency: string;
      correctAnswerText?: string | null;
      dwellMs?: number | null;
      points: number;
      prompt: string;
      questionId: string;
      questionType: string;
      responseGuide?: string | null;
      selectedAnswerText?: string | null;
      selectedOptionId?: string | null;
    }> | null;
    answerKeySource?: string | null;
    attemptId: string;
    criteria?: {
      className: string;
      difficulty: string;
      gradeLevel: number;
      questionCount: number;
      subject: string;
      topic: string;
    } | null;
    maxScore?: number | null;
    monitoring?: {
      dangerCount: number;
      lastEventAt?: string | null;
      recentEvents?: Array<{
        code: string;
        detail: string;
        id: string;
        mode?: string | null;
        occurredAt: string;
        severity: "info" | "warning" | "danger";
        screenshotCapturedAt?: string | null;
        screenshotStorageKey?: string | null;
        screenshotUrl?: string | null;
        title: string;
      }>;
      totalEvents: number;
      warningCount: number;
    } | null;
    percentage?: number | null;
    progress: {
      answeredQuestions: number;
      completionRate: number;
      remainingQuestions: number;
      totalQuestions: number;
    };
    teacherSync?: {
      lastError?: string | null;
      sentAt?: string | null;
      status: "pending" | "sent" | "failed";
      targetService: string;
    } | null;
    feedback?: {
      headline: string;
      improvements: string[];
      source?: string | null;
      strengths: string[];
      summary: string;
    } | null;
    result?: {
      correctCount: number;
      incorrectCount: number;
      maxScore: number;
      percentage: number;
      questionResults: Array<{
        answerChangeCount?: number | null;
        competency?: string | null;
        correctOptionId?: string | null;
        dwellMs?: number | null;
        explanation?: string | null;
        explanationSource?: string | null;
        isCorrect: boolean;
        maxPoints: number;
        pointsAwarded: number;
        prompt?: string | null;
        questionType?: string | null;
        questionId: string;
        selectedOptionId?: string | null;
      }>;
      score: number;
      unansweredCount: number;
    } | null;
    score?: number | null;
    startedAt: string;
    status: "in_progress" | "processing" | "submitted" | "approved";
    studentId: string;
    studentName: string;
    submittedAt?: string | null;
    testId: string;
    title: string;
  }>;
  liveMonitoringFeed: Array<{
    attemptId: string;
    latestEvent?: {
      code: string;
      detail: string;
      id: string;
      mode?: string | null;
      occurredAt: string;
      severity: "info" | "warning" | "danger";
      screenshotCapturedAt?: string | null;
      screenshotStorageKey?: string | null;
      screenshotUrl?: string | null;
      title: string;
    } | null;
    monitoring?: {
      dangerCount: number;
      lastEventAt?: string | null;
      totalEvents: number;
      warningCount: number;
    } | null;
    startedAt: string;
    status: "in_progress" | "processing" | "submitted" | "approved";
    studentId: string;
    studentName: string;
    submittedAt?: string | null;
    testId: string;
    title: string;
  }>;
  testMaterial?: {
    questions: Array<{
      answerLatex?: string | null;
      competency?: string | null;
      correctOptionId?: string | null;
      options: Array<{ id: string; text: string }>;
      points: number;
      prompt: string;
      questionId: string;
      responseGuide?: string | null;
      type: string;
    }>;
    testId: string;
    title: string;
  } | null;
};

type MaterialQuestion = NonNullable<
  DashboardApiPayload["testMaterial"]
>["questions"][number];
type DashboardAttempt = DashboardApiPayload["attempts"][number];

const isAttemptActivelyRunning = ({
  status,
  submittedAt,
}: {
  status: "in_progress" | "processing" | "submitted" | "approved";
  submittedAt?: string | null;
}) =>
  status === "in_progress" ||
  status === "processing" ||
  (status === "submitted" && !submittedAt);

const toMonitoringMode = (value?: string | null): MonitoringMode | undefined => {
  switch (value) {
    case "screen-capture-enabled":
    case "fallback-dom-capture":
    case "limited-monitoring":
      return value;
    default:
      return undefined;
  }
};

const toStudentStatus = (status: DashboardApiPayload["attempts"][number]["status"]): StudentStatus => {
  switch (status) {
    case "in_progress":
      return "in-progress";
    case "processing":
      return "processing";
    case "submitted":
      return "submitted";
    case "approved":
      return "approved";
    default:
      return "processing";
  }
};

const toRiskLevel = (warningCount = 0, dangerCount = 0): RiskLevel => {
  if (dangerCount > 0 || warningCount >= 3) return "high";
  if (warningCount > 0) return "medium";
  return "low";
};

const toMonitoringState = (
  latestCode?: string | null,
  status?: DashboardApiPayload["attempts"][number]["status"],
): MonitoringState => {
  switch (latestCode) {
    case "connection_lost":
      return "offline";
    case "connection_restored":
      return "reconnected";
    case "tab_hidden":
    case "window_blur":
      return "tab-hidden";
    case "device_change_suspected":
      return "device-switch";
    case "heartbeat":
      return "online";
    default:
      return status === "submitted" || status === "approved" ? "online" : "idle";
  }
};

const toEventType = (code?: string | null): MonitoringEvent["type"] => {
  switch (code) {
    case "tab_hidden":
    case "window_blur":
      return "focus-lost";
    case "connection_lost":
      return "offline";
    case "connection_restored":
      return "reconnected";
    case "device_change_suspected":
      return "device-switch";
    case "attempt-finalize":
      return "submitted";
    case "answer-revised":
      return "answer-revision";
    case "idle-45s":
    case "idle-90s":
      return "idle";
    default:
      return "answer-revision";
  }
};

const getEventTimestamp = (value?: string | null) =>
  new Date(value ?? new Date().toISOString());

const EXCLUDED_LIVE_EVENT_CODES = new Set([
  "attempt-session-open",
  "heartbeat",
  "question-view",
  "tab_visible",
  "window_focus",
]);
const EXCLUDED_LIVE_EVENT_CODE_PREFIXES = [
  "viewport-breakpoint-",
  "viewport-resize-suspicious",
];
const LIVE_EVENT_STACK_WINDOW_MS = 60_000;

const shouldExcludeLiveEventCode = (code: string) =>
  EXCLUDED_LIVE_EVENT_CODES.has(code) ||
  EXCLUDED_LIVE_EVENT_CODE_PREFIXES.some((prefix) => code.startsWith(prefix));

const sanitizeScreenshotKeySegment = (value?: string | null, fallback = "user") => {
  const sanitized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || fallback;
};

const buildFallbackScreenshotStorageKey = ({
  attemptId,
  eventCode,
  mode,
  occurredAt,
  studentName,
}: {
  attemptId?: string | null;
  eventCode?: string | null;
  mode?: string | null;
  occurredAt?: string | null;
  studentName?: string | null;
}) => {
  const resolvedAttemptId = attemptId?.trim();
  const resolvedEventCode = eventCode?.trim();
  const resolvedOccurredAt = occurredAt?.trim();

  if (!resolvedAttemptId || !resolvedEventCode || !resolvedOccurredAt) {
    return undefined;
  }

  const parsedTimestamp = new Date(resolvedOccurredAt);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return undefined;
  }

  const safeDate = parsedTimestamp.toISOString().replace(/[:.]/g, "-");
  const safeAttemptId = sanitizeScreenshotKeySegment(
    resolvedAttemptId,
    "attempt",
  );
  const safeStudentSegment = sanitizeScreenshotKeySegment(studentName, "user");
  const safeEventCode = sanitizeScreenshotKeySegment(
    resolvedEventCode,
    "event",
  );
  const safeMode = sanitizeScreenshotKeySegment(mode ?? "limited-monitoring", "mode");

  return [
    "proctoring",
    safeAttemptId,
    safeStudentSegment,
    `${safeDate}-${safeEventCode}-${safeMode}.jpg`,
  ].join("/");
};

const resolveMonitoringScreenshotUrl = ({
  attemptId,
  eventCode,
  mode,
  occurredAt,
  screenshotStorageKey,
  screenshotUrl,
  studentName,
}: {
  attemptId?: string | null;
  eventCode?: string | null;
  mode?: string | null;
  occurredAt?: string | null;
  screenshotStorageKey?: string | null;
  screenshotUrl?: string | null;
  studentName?: string | null;
}) =>
  resolveTakeExamScreenshotUrl(screenshotUrl, screenshotStorageKey) ??
  getTakeExamScreenshotObjectUrl(
    buildFallbackScreenshotStorageKey({
      attemptId,
      eventCode,
      mode,
      occurredAt,
      studentName,
    }),
  );

const hasScreenshotEvidence = ({
  attemptId,
  code,
  mode,
  occurredAt,
  screenshotStorageKey,
  screenshotUrl,
  studentName,
}: {
  attemptId?: string | null;
  code?: string | null;
  mode?: string | null;
  occurredAt?: string | null;
  screenshotStorageKey?: string | null;
  screenshotUrl?: string | null;
  studentName?: string | null;
}) =>
  Boolean(
    resolveMonitoringScreenshotUrl({
      attemptId,
      eventCode: code,
      mode,
      occurredAt,
      screenshotStorageKey,
      screenshotUrl,
      studentName,
    }),
  );

const shouldExcludeLiveEvent = ({
  attemptId,
  code,
  mode,
  occurredAt,
  screenshotStorageKey,
  screenshotUrl,
  studentName,
}: {
  attemptId?: string | null;
  code: string;
  mode?: string | null;
  occurredAt?: string | null;
  screenshotStorageKey?: string | null;
  screenshotUrl?: string | null;
  studentName?: string | null;
}) =>
  !hasScreenshotEvidence({
    attemptId,
    code,
    mode,
    occurredAt,
    screenshotStorageKey,
    screenshotUrl,
    studentName,
  }) &&
  shouldExcludeLiveEventCode(code);

const isFocusEventCode = (code?: string | null) =>
  code === "tab_hidden" || code === "window_blur";

const getLiveEventStackSignature = (event: MonitoringEvent) => {
  const code = event.code ?? "";

  switch (code) {
    case "fullscreen-not-active":
    case "fullscreen-exit":
      return `${event.studentId}:fullscreen`;
    case "split-view-suspected":
      return `${event.studentId}:split-view`;
    case "parallel-tab-suspected":
      return `${event.studentId}:parallel-tab`;
    case "tab_hidden":
    case "window_blur":
      return `${event.studentId}:focus-lost`;
    case "connection_lost":
      return `${event.studentId}:connection-lost`;
    case "connection_restored":
      return `${event.studentId}:connection-restored`;
    default:
      return [
        event.studentId,
        event.type,
        event.severity,
        event.title,
        event.detail,
      ].join(":");
  }
};

const getLatestActivityAt = (
  attempt: DashboardApiPayload["attempts"][number],
) =>
  attempt.monitoring?.lastEventAt ??
  attempt.submittedAt ??
  attempt.startedAt;

const getAttemptPercentage = (
  attempt: DashboardAttempt,
) => attempt.result?.percentage ?? attempt.percentage ?? attempt.score ?? undefined;

const getOptionLabel = (
  question: MaterialQuestion | undefined,
  optionId?: string | null,
) => {
  if (!optionId) return "Хариу өгөөгүй";
  if (!question) return optionId;

  return (
    question.options.find((option) => option.id === optionId)?.text ?? optionId
  );
};

const getTextAnswer = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeReviewAnswerValue = (
  value: string | null | undefined,
  isMathLikeQuestion: boolean,
) => {
  const trimmed = getTextAnswer(value);
  if (!trimmed) {
    return null;
  }

  return isMathLikeQuestion ? normalizeBackendLatexOnly(trimmed) : trimmed;
};

const isUnansweredReviewAnswer = (value?: string | null) => {
  const trimmed = value?.trim();
  return !trimmed || trimmed === "Хариу өгөөгүй";
};

const getOptionTextFromAnswerValue = (
  question: MaterialQuestion | undefined,
  value?: string | null,
) => {
  const normalizedValue = getTextAnswer(value);
  if (!normalizedValue || !question) {
    return null;
  }

  return (
    question.options.find((option) => option.id === normalizedValue)?.text ?? null
  );
};

const getSelectedAnswerLabel = ({
  isMathLikeQuestion,
  materialQuestion,
  selectedAnswerText,
  selectedOptionId,
}: {
  isMathLikeQuestion: boolean;
  materialQuestion?: MaterialQuestion;
  selectedAnswerText?: string | null;
  selectedOptionId?: string | null;
}) => {
  const directAnswer = normalizeReviewAnswerValue(
    selectedAnswerText,
    isMathLikeQuestion,
  );
  const optionTextFromAnswer = getOptionTextFromAnswerValue(
    materialQuestion,
    directAnswer,
  );

  if (optionTextFromAnswer) {
    return optionTextFromAnswer;
  }

  if (directAnswer) {
    return directAnswer;
  }

  return getOptionLabel(materialQuestion, selectedOptionId ?? null);
};

const isLikelyInstructionText = (value?: string | null) => {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }

  return [
    "бодолтын алхам",
    "алхмуудаа бич",
    "эцсийн хариу",
    "хэлбэрээр өг",
    "тайлбар",
    "show your work",
    "write your steps",
  ].some((phrase) => trimmed.includes(phrase));
};

const isLikelyDirectAnswer = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || isLikelyInstructionText(trimmed)) {
    return false;
  }

  if (trimmed.length <= 32) {
    return true;
  }

  return !/[.?!]/.test(trimmed) && trimmed.split(/\s+/).length <= 6;
};

const getCorrectAnswerLabel = ({
  correctAnswerText,
  correctOptionId,
  isMathLikeQuestion,
  materialQuestion,
  responseGuide,
}: {
  correctAnswerText?: string | null;
  correctOptionId?: string | null;
  isMathLikeQuestion: boolean;
  materialQuestion?: MaterialQuestion;
  responseGuide?: string | null;
}) => {
  const directAnswer = normalizeReviewAnswerValue(
    correctAnswerText,
    isMathLikeQuestion,
  );
  const optionTextFromDirectAnswer = getOptionTextFromAnswerValue(
    materialQuestion,
    directAnswer,
  );
  const materialAnswer = normalizeReviewAnswerValue(
    materialQuestion?.answerLatex,
    isMathLikeQuestion,
  );
  const exactAnswer = directAnswer ?? materialAnswer;
  if (optionTextFromDirectAnswer) {
    return {
      kind: "exact" as const,
      value: optionTextFromDirectAnswer,
    };
  }

  if (isLikelyDirectAnswer(exactAnswer)) {
    return {
      kind: "exact" as const,
      value: exactAnswer ?? "Зөв хариулт ирээгүй",
    };
  }

  const resolvedCorrectOptionId = correctOptionId ?? materialQuestion?.correctOptionId;
  if (resolvedCorrectOptionId) {
    return {
      kind: "exact" as const,
      value: getOptionLabel(materialQuestion, resolvedCorrectOptionId),
    };
  }

  const referenceGuide =
    getTextAnswer(responseGuide) ??
    getTextAnswer(materialQuestion?.responseGuide) ??
    exactAnswer;
  if (referenceGuide) {
    return {
      kind: "reference" as const,
      value: referenceGuide,
    };
  }

  return {
    kind: "missing" as const,
    value: "Зөв хариулт ирээгүй",
  };
};

const getVisibleAttemptRecentEvents = (attempt: DashboardAttempt) =>
  (attempt.monitoring?.recentEvents ?? []).filter(
    (event) =>
      !shouldExcludeLiveEvent({
        attemptId: attempt.attemptId,
        code: event.code,
        mode: event.mode,
        occurredAt: event.screenshotCapturedAt ?? event.occurredAt,
        screenshotStorageKey: event.screenshotStorageKey,
        screenshotUrl: event.screenshotUrl,
        studentName: attempt.studentName,
      }),
  );

const buildQuestionReviews = (
  attempt: DashboardAttempt,
  materialQuestionsById: Map<string, MaterialQuestion>,
): QuestionReview[] => {
  const isApprovedAttempt = attempt.status === "approved";
  const answerReviewByQuestionId = new Map(
    (attempt.answerReview ?? []).map((question) => [question.questionId, question] as const),
  );

  const resultQuestions = attempt.result?.questionResults ?? [];

  if (resultQuestions.length > 0) {
    return resultQuestions.map((questionResult, index) => {
      const materialQuestion = materialQuestionsById.get(questionResult.questionId);
      const answerReview = answerReviewByQuestionId.get(questionResult.questionId);
      const selectedAnswerText = getTextAnswer(answerReview?.selectedAnswerText);
      const questionType =
        materialQuestion?.type ??
        questionResult.questionType ??
        answerReview?.questionType ??
        "single-choice";
      const isMathLikeQuestion = isMathQuestionType(questionType);
      const responseGuide =
        questionResult.explanation ??
        answerReview?.responseGuide ??
        materialQuestion?.responseGuide ??
        null;
      const studentAnswer = getSelectedAnswerLabel({
        isMathLikeQuestion,
        materialQuestion,
        selectedAnswerText,
        selectedOptionId:
          questionResult.selectedOptionId ?? answerReview?.selectedOptionId ?? null,
      });
      const isUnansweredMathQuestion =
        isMathLikeQuestion && isUnansweredReviewAnswer(studentAnswer);
      const shouldKeepUnansweredTeacherReviewPending =
        attempt.answerKeySource === "teacher_service" &&
        isUnansweredMathQuestion &&
        !isApprovedAttempt;
      const correctAnswer = getCorrectAnswerLabel({
        correctAnswerText: answerReview?.correctAnswerText ?? null,
        materialQuestion,
        correctOptionId: questionResult.correctOptionId ?? null,
        isMathLikeQuestion,
        responseGuide,
      });
      const hasScoredResult = typeof questionResult.isCorrect === "boolean";
      const requiresManualReview =
        attempt.answerKeySource === "teacher_service" &&
        isMathLikeQuestion &&
        !isUnansweredMathQuestion &&
        attempt.status !== "approved";

      return {
        competency:
          questionResult.competency ??
          answerReview?.competency ??
          materialQuestion?.competency ??
          undefined,
        id: questionResult.questionId,
        questionNumber: index + 1,
        questionText:
          materialQuestion?.prompt ??
          questionResult.prompt ??
          answerReview?.prompt ??
          `Асуулт ${index + 1}`,
        studentAnswer,
        correctAnswer: correctAnswer.value,
        correctAnswerKind: correctAnswer.kind,
        aiAnalysis: requiresManualReview
          ? responseGuide ?? "AI дүгнэлт хараахан ирээгүй байна."
          : undefined,
        aiSource: questionResult.explanationSource as AiContentSource | undefined,
        questionType,
        requiresManualReview,
        reviewState: requiresManualReview
          ? "pending"
          : shouldKeepUnansweredTeacherReviewPending
          ? "pending"
          : hasScoredResult
          ? questionResult.isCorrect
            ? "correct"
            : "incorrect"
          : isUnansweredMathQuestion
          ? "incorrect"
          : "pending",
        reviewed: isApprovedAttempt,
        points: hasScoredResult ? questionResult.pointsAwarded : 0,
        maxPoints: questionResult.maxPoints,
        explanation: responseGuide ?? undefined,
      };
    });
  }

  return (attempt.answerReview ?? []).map((answerReview, index) => {
    const materialQuestion = materialQuestionsById.get(answerReview.questionId);
    const selectedAnswerText = getTextAnswer(answerReview.selectedAnswerText);
    const questionType =
      materialQuestion?.type ?? answerReview.questionType ?? "single-choice";
    const isMathLikeQuestion = isMathQuestionType(questionType);
    const requiresManualReview =
      attempt.answerKeySource === "teacher_service" && isMathLikeQuestion;
    const responseGuide =
      answerReview.responseGuide ??
      materialQuestion?.responseGuide ??
      null;
    const studentAnswer = getSelectedAnswerLabel({
      isMathLikeQuestion,
      materialQuestion,
      selectedAnswerText,
      selectedOptionId: answerReview.selectedOptionId ?? null,
    });
    const isUnansweredMathQuestion =
      isMathLikeQuestion && isUnansweredReviewAnswer(studentAnswer);
    const shouldKeepUnansweredTeacherReviewPending =
      attempt.answerKeySource === "teacher_service" &&
      isUnansweredMathQuestion &&
      !isApprovedAttempt;
    const correctAnswer = getCorrectAnswerLabel({
      correctAnswerText: answerReview.correctAnswerText ?? null,
      materialQuestion,
      correctOptionId: null,
      isMathLikeQuestion,
      responseGuide,
    });

    const needsManualReview = requiresManualReview && !isUnansweredMathQuestion;

    return {
      competency:
        answerReview.competency ?? materialQuestion?.competency ?? undefined,
      id: answerReview.questionId,
      questionNumber: index + 1,
      questionText:
        materialQuestion?.prompt ??
        answerReview.prompt ??
        `Асуулт ${index + 1}`,
      studentAnswer,
      correctAnswer: correctAnswer.value,
      correctAnswerKind: correctAnswer.kind,
      aiAnalysis: needsManualReview
        ? responseGuide ?? "AI дүгнэлт хараахан ирээгүй байна."
        : undefined,
      aiSource: undefined,
      questionType,
      requiresManualReview: needsManualReview,
      reviewState: shouldKeepUnansweredTeacherReviewPending
        ? "pending"
        : isUnansweredMathQuestion
        ? "incorrect"
        : "pending",
      reviewed: isApprovedAttempt,
      points: 0,
      maxPoints: materialQuestion?.points ?? answerReview.points ?? 0,
      explanation: responseGuide ?? undefined,
    };
  });
};

const buildSubmittedAttempt = (
  attempt: DashboardAttempt,
  materialQuestionsById: Map<string, MaterialQuestion>,
): SubmittedAttempt => {
  const questions = buildQuestionReviews(attempt, materialQuestionsById);
  const recentEvents = getVisibleAttemptRecentEvents(attempt);

  return {
    id: attempt.attemptId,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    submissionTime: getEventTimestamp(attempt.submittedAt ?? attempt.startedAt),
    status:
      attempt.status === "approved"
        ? "reviewed"
        : attempt.status === "processing"
        ? "in-review"
        : "pending",
    completionRate: attempt.progress.completionRate,
    hasPublishedResult: Boolean(attempt.result),
    reviewableItems:
      (attempt.result?.incorrectCount ?? 0) +
        (attempt.result?.unansweredCount ?? 0) || questions.length,
    answerKeySource: attempt.answerKeySource ?? "local",
    score: getAttemptPercentage(attempt),
    teacherSync: attempt.teacherSync ?? null,
    questions,
    feedback: attempt.feedback ?? undefined,
    monitoringSummary: {
      warningCount: recentEvents.filter(
        (event) => event.severity === "warning" && !isFocusEventCode(event.code),
      ).length,
      dangerCount: recentEvents.filter((event) => event.severity === "danger")
        .length,
      focusLostCount: recentEvents.filter(
        (event) => event.code === "tab_hidden" || event.code === "window_blur",
      ).length,
      deviceSwitchCount: recentEvents.filter(
        (event) => event.code === "device_change_suspected",
      ).length,
      events: recentEvents
        .map((event) => ({
          code: event.code,
          detail: event.detail,
          id: event.id,
          mode: toMonitoringMode(event.mode),
          occurredAt: getEventTimestamp(event.occurredAt),
          severity: event.severity,
          screenshotCapturedAt: event.screenshotCapturedAt
            ? getEventTimestamp(event.screenshotCapturedAt)
            : undefined,
          screenshotUrl: resolveMonitoringScreenshotUrl({
            attemptId: attempt.attemptId,
            eventCode: event.code,
            mode: event.mode,
            occurredAt: event.screenshotCapturedAt ?? event.occurredAt,
            screenshotStorageKey: event.screenshotStorageKey,
            screenshotUrl: event.screenshotUrl,
            studentName: attempt.studentName,
          }),
          title: localizeMonitoringEventTitle(event.code, event.title),
          type:
            event.code === "tab_hidden" || event.code === "window_blur"
              ? ("focus" as const)
              : event.severity === "danger"
                ? ("danger" as const)
                : ("warning" as const),
        }))
        .filter(
          (event) =>
            event.type === "focus" ||
            event.severity === "warning" ||
            event.severity === "danger" ||
            Boolean(event.screenshotUrl),
        ),
    },
  };
};

const buildScoreDistribution = (students: Student[]) => {
  const studentsWithScores = students.filter((student) => student.score !== undefined);
  const ranges = [
    { label: "0-20", max: 20, min: 0 },
    { label: "21-40", max: 40, min: 21 },
    { label: "41-60", max: 60, min: 41 },
    { label: "61-80", max: 80, min: 61 },
    { label: "81-100", max: 100, min: 81 },
  ];

  return ranges.map((range) => ({
    range: range.label,
    count: studentsWithScores.filter((student) => {
      const score = student.score ?? -1;
      return score >= range.min && score <= range.max;
    }).length,
  }));
};

const buildRiskDistribution = (students: Student[]) => {
  const low = students.filter((student) => student.riskLevel === "low").length;
  const medium = students.filter((student) => student.riskLevel === "medium").length;
  const high = students.filter((student) => student.riskLevel === "high").length;

  return [
    { name: "Бага", value: low, color: "hsl(var(--success))" },
    { name: "Дунд", value: medium, color: "hsl(var(--warning))" },
    { name: "Өндөр", value: high, color: "hsl(var(--danger))" },
  ];
};

const getQuestionLabel = (
  questionId: string,
  questionNumbersById: Map<string, number>,
) => `Q${questionNumbersById.get(questionId) ?? "?"}`;

const formatDuration = (averageMs: number) => {
  const totalSeconds = Math.max(Math.round(averageMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

const formatTimelineBucket = (date: Date) =>
  date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });

const bucketEventTimestamp = (date: Date) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(Math.floor(next.getMinutes() / 15) * 15);
  return next;
};

const buildExamAnalytics = ({
  attempts,
  events,
  materialQuestionsById,
  questionNumbersById,
  students,
}: {
  attempts: DashboardAttempt[];
  events: MonitoringEvent[];
  materialQuestionsById: Map<string, MaterialQuestion>;
  questionNumbersById: Map<string, number>;
  students: Student[];
}): ExamAnalytics => {
  const competencyStats = new Map<
    string,
    { earnedPoints: number; maxPoints: number }
  >();
  const dwellStats = new Map<string, { count: number; totalMs: number }>();
  const answerChangeStats = new Map<
    string,
    { changes: number; students: number }
  >();

  for (const attempt of attempts) {
    const answerReviewByQuestionId = new Map(
      (attempt.answerReview ?? []).map((question) => [question.questionId, question] as const),
    );
    const resultByQuestionId = new Map(
      (attempt.result?.questionResults ?? []).map((question) => [question.questionId, question] as const),
    );
    const questionIds = new Set([
      ...answerReviewByQuestionId.keys(),
      ...resultByQuestionId.keys(),
    ]);

    for (const questionId of questionIds) {
      const answerReview = answerReviewByQuestionId.get(questionId);
      const result = resultByQuestionId.get(questionId);
      const materialQuestion = materialQuestionsById.get(questionId);

      if (result) {
        const competency =
          result.competency ??
          answerReview?.competency ??
          materialQuestion?.type ??
          "Тодорхойгүй";
        const current = competencyStats.get(competency) ?? {
          earnedPoints: 0,
          maxPoints: 0,
        };
        current.earnedPoints += result.pointsAwarded;
        current.maxPoints += result.maxPoints;
        competencyStats.set(competency, current);
      }

      const dwellMs = result?.dwellMs ?? answerReview?.dwellMs ?? null;
      if (typeof dwellMs === "number" && Number.isFinite(dwellMs) && dwellMs > 0) {
        const current = dwellStats.get(questionId) ?? { count: 0, totalMs: 0 };
        current.count += 1;
        current.totalMs += dwellMs;
        dwellStats.set(questionId, current);
      }

      const answerChanges =
        result?.answerChangeCount ?? answerReview?.answerChangeCount ?? null;
      if (
        typeof answerChanges === "number" &&
        Number.isFinite(answerChanges) &&
        answerChanges > 0
      ) {
        const current = answerChangeStats.get(questionId) ?? {
          changes: 0,
          students: 0,
        };
        current.changes += answerChanges;
        current.students += 1;
        answerChangeStats.set(questionId, current);
      }
    }
  }

  const focusAreas = [...competencyStats.entries()]
    .map(([topic, stat]) => ({
      topic,
      avgScore:
        stat.maxPoints > 0
          ? Math.round((stat.earnedPoints / stat.maxPoints) * 100)
          : 0,
    }))
    .sort((left, right) => left.avgScore - right.avgScore)
    .slice(0, 4);

  const slowestQuestionsRaw = [...dwellStats.entries()]
    .map(([questionId, stat]) => ({
      avgMs: Math.round(stat.totalMs / Math.max(stat.count, 1)),
      question: getQuestionLabel(questionId, questionNumbersById),
    }))
    .sort((left, right) => right.avgMs - left.avgMs)
    .slice(0, 4);
  const slowestMaxMs = slowestQuestionsRaw[0]?.avgMs ?? 0;
  const slowestQuestions = slowestQuestionsRaw.map((item) => ({
    question: item.question,
    avgTime: formatDuration(item.avgMs),
    relativeTime:
      slowestMaxMs > 0
        ? Math.max(Math.round((item.avgMs / slowestMaxMs) * 96), 28)
        : 28,
  }));

  const answerChanges = [...answerChangeStats.entries()]
    .map(([questionId, stat]) => ({
      question: getQuestionLabel(questionId, questionNumbersById),
      changes: stat.changes,
      students: stat.students,
    }))
    .sort((left, right) => right.changes - left.changes)
    .slice(0, 4);

  const dangerTimelineBuckets = new Map<
    string,
    { dangers: number; timestamp: Date; warnings: number }
  >();

  for (const event of events) {
    if (event.severity !== "warning" && event.severity !== "danger") {
      continue;
    }

    const bucketDate = bucketEventTimestamp(event.timestamp);
    const bucketKey = bucketDate.toISOString();
    const current = dangerTimelineBuckets.get(bucketKey) ?? {
      dangers: 0,
      timestamp: bucketDate,
      warnings: 0,
    };

    if (event.severity === "danger") {
      current.dangers += 1;
    } else {
      current.warnings += 1;
    }

    dangerTimelineBuckets.set(bucketKey, current);
  }

  const dangerTimeline = [...dangerTimelineBuckets.values()]
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
    .slice(-8)
    .map((bucket) => ({
      time: formatTimelineBucket(bucket.timestamp),
      warnings: bucket.warnings,
      dangers: bucket.dangers,
    }));

  return {
    answerChanges,
    dangerTimeline,
    focusAreas,
    riskDistribution: buildRiskDistribution(students),
    scoreDistribution: buildScoreDistribution(students),
    slowestQuestions,
  };
};

export const buildExamList = (payload: DashboardApiPayload): Exam[] =>
  payload.availableTests.map((test) => {
    const attempts = payload.attempts.filter((attempt) => attempt.testId === test.id);
    const liveFeedItems = payload.liveMonitoringFeed.filter(
      (feedItem) => feedItem.testId === test.id,
    );
    const activeAttempts = attempts.filter((attempt) =>
      isAttemptActivelyRunning(attempt),
    );
    const activeFeedItems = liveFeedItems.filter((feedItem) =>
      isAttemptActivelyRunning(feedItem),
    );
    const approvedAttempts = attempts.filter(
      (attempt) => attempt.status === "approved",
    );
    const averageScore =
      approvedAttempts.length > 0
        ? Math.round(
            approvedAttempts.reduce(
              (sum, attempt) => sum + (getAttemptPercentage(attempt) ?? 0),
              0,
            ) / approvedAttempts.length,
          )
        : undefined;
    const sortedAttemptTimes = [...attempts]
      .map((attempt) => new Date(attempt.startedAt).getTime())
      .concat(liveFeedItems.map((feedItem) => new Date(feedItem.startedAt).getTime()))
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => right - left);
    const latestSubmittedAt = [...attempts]
      .map((attempt) => attempt.submittedAt)
      .concat(liveFeedItems.map((feedItem) => feedItem.submittedAt))
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => right - left)[0];
    const activeStudentIds = new Set([
      ...activeAttempts.map((attempt) => attempt.studentId),
      ...activeFeedItems.map((feedItem) => feedItem.studentId),
    ]);
    const totalStudentIds = new Set([
      ...attempts.map((attempt) => attempt.studentId),
      ...liveFeedItems.map((feedItem) => feedItem.studentId),
    ]);

    return {
      id: test.id,
      title: test.title,
      subject: test.criteria.subject,
      topic: test.criteria.topic,
      questionCount: test.criteria.questionCount,
      liveStudentCount: activeStudentIds.size,
      totalStudentCount: totalStudentIds.size,
      averageScore,
      startTime: new Date(sortedAttemptTimes[0] ?? test.updatedAt),
      endTime:
        activeStudentIds.size === 0 && latestSubmittedAt
          ? new Date(latestSubmittedAt)
          : undefined,
      class: test.criteria.className,
    };
  });

export const buildExamDashboardData = (
  payload: DashboardApiPayload,
  examId: string,
) => {
  const exams = buildExamList(payload);
  const exam = exams.find((item) => item.id === examId) ?? null;
  const examAttempts = payload.attempts.filter((attempt) => attempt.testId === examId);
  const examLiveFeed = payload.liveMonitoringFeed.filter(
    (feedItem) => feedItem.testId === examId,
  );
  const materialQuestionsById = new Map(
    (payload.testMaterial?.testId === examId
      ? payload.testMaterial.questions
      : []
    ).map((question) => [question.questionId, question] as const),
  );
  const questionNumbersById = new Map(
    (payload.testMaterial?.testId === examId
      ? payload.testMaterial.questions
      : []
    ).map((question, index) => [question.questionId, index + 1] as const),
  );
  const activeAttemptIds = new Set([
    ...examAttempts
      .filter((attempt) => isAttemptActivelyRunning(attempt))
      .map((attempt) => attempt.attemptId),
    ...examLiveFeed
      .filter((feedItem) => isAttemptActivelyRunning(feedItem))
      .map((feedItem) => feedItem.attemptId),
  ]);

  const students = examAttempts
    .map((attempt) => {
      const visibleRecentEvents = (attempt.monitoring?.recentEvents ?? []).filter(
        (event) =>
          !shouldExcludeLiveEvent({
            attemptId: attempt.attemptId,
            code: event.code,
            mode: event.mode,
            occurredAt: event.screenshotCapturedAt ?? event.occurredAt,
            screenshotStorageKey: event.screenshotStorageKey,
            screenshotUrl: event.screenshotUrl,
            studentName: attempt.studentName,
          }),
      );
      const latestEvent = visibleRecentEvents[0] ?? attempt.monitoring?.recentEvents?.[0];
      const warningCount = visibleRecentEvents.filter(
        (event) => event.severity === "warning" && !isFocusEventCode(event.code),
      ).length;
      const dangerCount = visibleRecentEvents.filter(
        (event) => event.severity === "danger",
      ).length;

      return {
        id: attempt.studentId,
        name: attempt.studentName,
        studentId: attempt.studentId,
        status: toStudentStatus(attempt.status),
        progress: attempt.progress.completionRate,
        riskLevel: toRiskLevel(warningCount, dangerCount),
        warningCount,
        dangerCount,
        score: getAttemptPercentage(attempt),
        lastActivity: getEventTimestamp(getLatestActivityAt(attempt)),
        monitoringState: toMonitoringState(latestEvent?.code, attempt.status),
      };
    })
    .concat(
      examLiveFeed
        .filter(
          (feedItem) =>
            !examAttempts.some((attempt) => attempt.attemptId === feedItem.attemptId),
        )
        .map((feedItem) => {
          const warningCount = feedItem.monitoring?.warningCount ?? 0;
          const dangerCount = feedItem.monitoring?.dangerCount ?? 0;

          return {
            id: feedItem.studentId,
            name: feedItem.studentName,
            studentId: feedItem.studentId,
            status: toStudentStatus(feedItem.status),
            progress: 0,
            riskLevel: toRiskLevel(warningCount, dangerCount),
            warningCount,
            dangerCount,
            score: undefined,
            lastActivity: getEventTimestamp(
              feedItem.monitoring?.lastEventAt ??
                feedItem.submittedAt ??
                feedItem.startedAt,
            ),
            monitoringState: toMonitoringState(
              feedItem.latestEvent?.code,
              feedItem.status,
            ),
          };
        }),
    )
    .sort(
      (left, right) =>
        right.lastActivity.getTime() - left.lastActivity.getTime(),
    );

  const eventMap = new Map<string, MonitoringEvent>();

  for (const item of payload.liveMonitoringFeed.filter(
    (feedItem) =>
      feedItem.testId === examId &&
      feedItem.latestEvent &&
      activeAttemptIds.has(feedItem.attemptId),
  )) {
    const latestEvent = item.latestEvent;
    if (
      !latestEvent ||
      shouldExcludeLiveEvent({
        attemptId: item.attemptId,
        code: latestEvent.code,
        mode: latestEvent.mode,
        occurredAt: latestEvent.screenshotCapturedAt ?? latestEvent.occurredAt,
        screenshotStorageKey: latestEvent.screenshotStorageKey,
        screenshotUrl: latestEvent.screenshotUrl,
        studentName: item.studentName,
      })
    ) {
      continue;
    }

    eventMap.set(latestEvent.id, {
      code: latestEvent.code,
      count: 1,
      id: latestEvent.id,
      mode: toMonitoringMode(latestEvent.mode),
      screenshotCapturedAt: latestEvent.screenshotCapturedAt
        ? getEventTimestamp(latestEvent.screenshotCapturedAt)
        : undefined,
      screenshotUrl: resolveMonitoringScreenshotUrl({
        attemptId: item.attemptId,
        eventCode: latestEvent.code,
        mode: latestEvent.mode,
        occurredAt: latestEvent.screenshotCapturedAt ?? latestEvent.occurredAt,
        screenshotStorageKey: latestEvent.screenshotStorageKey,
        screenshotUrl: latestEvent.screenshotUrl,
        studentName: item.studentName,
      }),
      studentId: item.studentId,
      studentName: item.studentName,
      type: toEventType(latestEvent.code),
      severity: latestEvent.severity,
      title: localizeMonitoringEventTitle(latestEvent.code, latestEvent.title),
      detail: latestEvent.detail,
      timestamp: getEventTimestamp(latestEvent.occurredAt),
    });
  }

  for (const attempt of examAttempts.filter((item) =>
    activeAttemptIds.has(item.attemptId),
  )) {
    for (const event of attempt.monitoring?.recentEvents ?? []) {
      if (
        shouldExcludeLiveEvent({
          attemptId: attempt.attemptId,
          code: event.code,
          mode: event.mode,
          occurredAt: event.screenshotCapturedAt ?? event.occurredAt,
          screenshotStorageKey: event.screenshotStorageKey,
          screenshotUrl: event.screenshotUrl,
          studentName: attempt.studentName,
        })
      ) {
        continue;
      }
      eventMap.set(event.id, {
        code: event.code,
        count: 1,
        id: event.id,
        mode: toMonitoringMode(event.mode),
        screenshotCapturedAt: event.screenshotCapturedAt
          ? getEventTimestamp(event.screenshotCapturedAt)
          : undefined,
        screenshotUrl: resolveMonitoringScreenshotUrl({
          attemptId: attempt.attemptId,
          eventCode: event.code,
          mode: event.mode,
          occurredAt: event.screenshotCapturedAt ?? event.occurredAt,
          screenshotStorageKey: event.screenshotStorageKey,
          screenshotUrl: event.screenshotUrl,
          studentName: attempt.studentName,
        }),
        studentId: attempt.studentId,
        studentName: attempt.studentName,
        type: toEventType(event.code),
        severity: event.severity,
        title: localizeMonitoringEventTitle(event.code, event.title),
        detail: event.detail,
        timestamp: getEventTimestamp(event.occurredAt),
      });
    }
  }

  const events = [...eventMap.values()].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const stackedEvents: MonitoringEvent[] = [];

  for (const event of events) {
    const previousEvent = stackedEvents[stackedEvents.length - 1];
    if (!previousEvent) {
      stackedEvents.push(event);
      continue;
    }

    const isSameSignature =
      getLiveEventStackSignature(previousEvent) ===
      getLiveEventStackSignature(event);
    const isWithinStackWindow =
      previousEvent.timestamp.getTime() - event.timestamp.getTime() <=
      LIVE_EVENT_STACK_WINDOW_MS;

    if (isSameSignature && isWithinStackWindow) {
      previousEvent.count = (previousEvent.count ?? 1) + (event.count ?? 1);
      previousEvent.timestamp = new Date(
        Math.max(previousEvent.timestamp.getTime(), event.timestamp.getTime()),
      );
      continue;
    }

    stackedEvents.push(event);
  }

  const attempts = examAttempts
    .filter(
      (attempt) =>
        attempt.status === "submitted" ||
        attempt.status === "processing" ||
        attempt.status === "approved",
    )
    .map((attempt) => buildSubmittedAttempt(attempt, materialQuestionsById))
    .sort(
      (left, right) =>
        right.submissionTime.getTime() - left.submissionTime.getTime(),
    );
  const analytics = buildExamAnalytics({
    attempts: examAttempts,
    events: stackedEvents,
    materialQuestionsById,
    questionNumbersById,
    students,
  });

  return {
    analytics,
    exam,
    students,
    events: stackedEvents,
    attempts,
  };
};
