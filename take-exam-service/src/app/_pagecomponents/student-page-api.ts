"use client";

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";
import {
  GetStudentDashboardDocument,
  GetStudentsDocument,
  LogAttemptActivityDocument,
  ResumeExamDocument,
  SyncExternalNewMathExamsDocument,
  StartExamDocument,
  SubmitAnswersDocument,
  type GetStudentDashboardQuery,
  type GetStudentsQuery,
  type LogAttemptActivityMutationVariables,
  type ResumeExamMutation,
  type StartExamMutation,
  type SubmitAnswersMutation,
} from "@/gql/generated";
import type {
  AiContentSource,
  AttemptAnswerReviewItem,
  AttemptQuestionMetricInput,
  AttemptFeedback,
  AttemptMonitoringEvent,
  AttemptMonitoringSummary,
  AttemptSummary,
  ExamAnswerInput,
  ExamProgress,
  ExamResultSummary,
  MonitoringMode,
  ProctoringEventSeverity,
  StartExamResponse,
  StudentInfo,
  SubmitAnswersResponse,
  TeacherTestSummary,
} from "@/lib/exam-service/types";
import {
  buildProctoringScreenshotKey,
  isDirectUploadProctoringPlan,
  isInlineFallbackProctoringPlan,
  type ProctoringPresignPlanResponse,
  type ProctoringScreenshotMetadata,
} from "@/lib/proctoring-screenshots";
import {
  mockStudentPortalClient,
  USE_MOCK_DATA,
} from "@/lib/mock/student-portal-client";

type GraphQlResult<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type Nullable<T> = T | null | undefined;
type DashboardAttempt = GetStudentDashboardQuery["attempts"][number];
type DashboardAttemptMonitoring = NonNullable<DashboardAttempt["monitoring"]>;
export type DashboardPayload = {
  availableTests: TeacherTestSummary[];
  attempts: AttemptSummary[];
};

const STUDENTS_CACHE_TTL_MS = 60_000;
const DASHBOARD_CACHE_TTL_MS = 10_000;

let studentsCache:
  | {
      expiresAt: number;
      value: StudentInfo[];
    }
  | null = null;
let studentsRequestInFlight: Promise<StudentInfo[]> | null = null;

let dashboardCache:
  | {
      expiresAt: number;
      value: DashboardPayload;
    }
  | null = null;
let dashboardRequestInFlight: Promise<DashboardPayload> | null = null;
let proctoringUploadCapability: "unknown" | "direct-upload" | "inline-fallback" =
  "unknown";
let loggedInlineFallbackReason: string | null = null;

export type AttemptActivityInput = {
  code: string;
  detail: string;
  mode: MonitoringMode;
  occurredAt?: string;
  severity: ProctoringEventSeverity;
  screenshotCapturedAt?: string;
  screenshotStorageKey?: string;
  screenshotUrl?: string;
  title: string;
};

type ProctoringFallbackUploadResponse = {
  key: string;
  publicUrl: string;
};

type ProctoringUploadError = Error & {
  shouldUseInlineFallback?: boolean;
};

export type UploadProctoringScreenshotInput = {
  attemptId: string;
  blob: Blob;
  capturedAt: string;
  eventCode: string;
  mode: MonitoringMode;
  studentName: string;
  userId: string;
};

export type QuestionMetricInput = AttemptQuestionMetricInput;

export type SebCheckResponse = {
  client?: {
    isDetected?: boolean;
    minimumVersion?: string | null;
    platform?: string | null;
    userAgent?: string | null;
    version?: string | null;
  };
  configKey?: string;
  message: string;
  ok: boolean;
};

export type MathNaturalLanguageResponse = {
  explanation: string;
  expression: string;
  source: AiContentSource;
};

export type MathNaturalLanguageProvider = "auto" | "gemini" | "ollama";

const resolveProctoringRouteUrl = (path: string) => {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_R2_PRESIGN_URL?.trim();
  if (!configuredBaseUrl) {
    return path;
  }

  try {
    return new URL(path, configuredBaseUrl).toString();
  } catch {
    return path;
  }
};

const resolveProctoringPresignUrl = () =>
  resolveProctoringRouteUrl("/api/proctoring-screenshots/presign");

const resolveProctoringFallbackUploadUrl = () =>
  "/api/proctoring-screenshots/upload";

const createUploadError = (
  message: string,
  shouldUseInlineFallback = false,
): ProctoringUploadError =>
  Object.assign(new Error(message), {
    shouldUseInlineFallback,
  });

const extractUploadErrorMessage = (payload: unknown, fallbackMessage: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return fallbackMessage;
};

const isStorageUnavailablePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if ("code" in payload && payload.code === "storage_not_configured") {
    return true;
  }

  return isInlineFallbackProctoringPlan(payload);
};

const isInlineFallbackUploadError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "shouldUseInlineFallback" in error &&
      error.shouldUseInlineFallback,
  );

const rememberInlineFallbackCapability = (reason?: string) => {
  proctoringUploadCapability = "inline-fallback";

  if (!reason || loggedInlineFallbackReason === reason) {
    return;
  }

  loggedInlineFallbackReason = reason;
  console.warn(`Proctoring screenshot storage is unavailable. ${reason}`);
};

const uploadProctoringImageDirectly = async ({
  blob,
  uploadUrl,
}: {
  blob: Blob;
  uploadUrl: string;
}) => {
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": blob.type || "image/jpeg",
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("Screenshot хадгалах үед алдаа гарлаа.");
  }
};

const readJsonResponse = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const uploadProctoringImageViaAppRoute = async ({
  blob,
  key,
  metadata,
}: {
  blob: Blob;
  key: string;
  metadata: ProctoringScreenshotMetadata;
}) => {
  const formData = new FormData();
  formData.append("key", key);
  formData.append("attemptId", metadata.attemptId);
  formData.append("capturedAt", metadata.capturedAt);
  formData.append("eventCode", metadata.eventCode);
  formData.append("mode", metadata.mode ?? "limited-monitoring");
  formData.append("studentName", metadata.studentName ?? "");
  formData.append("userId", metadata.userId);
  formData.append("file", blob, `${metadata.eventCode || "capture"}.jpg`);

  const response = await fetch(resolveProctoringFallbackUploadUrl(), {
    method: "POST",
    body: formData,
  });
  const payload = await readJsonResponse<
    | ProctoringFallbackUploadResponse
    | {
        code?: string;
        message?: string;
      }
  >(response);

  if (!response.ok) {
    throw createUploadError(
      extractUploadErrorMessage(
        payload,
        "Screenshot fallback upload амжилтгүй боллоо.",
      ),
      response.status === 503 || isStorageUnavailablePayload(payload),
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("key" in payload) ||
    typeof payload.key !== "string" ||
    !("publicUrl" in payload) ||
    typeof payload.publicUrl !== "string"
  ) {
    throw createUploadError("Screenshot fallback upload хариу дутуу байна.");
  }

  return payload;
};

const blobToDataUrl = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  const base64 =
    typeof window !== "undefined" && typeof window.btoa === "function"
      ? window.btoa(binary)
      : btoa(binary);

  return `data:${blob.type || "image/jpeg"};base64,${base64}`;
};

const buildInlineScreenshotResult = async ({
  attemptId,
  blob,
  eventCode,
}: Pick<UploadProctoringScreenshotInput, "attemptId" | "blob" | "eventCode">) => ({
  key: `inline/${attemptId}/${eventCode}/${Date.now()}.jpg`,
  publicUrl: await blobToDataUrl(blob),
});

const gqlRequest = async <TData, TVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  variables?: TVariables,
): Promise<TData> => {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: print(document),
      variables,
    }),
  });

  const payload = (await response.json()) as GraphQlResult<TData>;

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

const isFreshCache = (expiresAt: number) => expiresAt > Date.now();

const mapMonitoringEvent = (
  event: DashboardAttemptMonitoring["recentEvents"][number],
): AttemptMonitoringEvent => ({
  id: event.id,
  code: event.code,
  severity: event.severity as ProctoringEventSeverity,
  title: event.title,
  detail: event.detail,
  occurredAt: event.occurredAt,
  mode: (event.mode as MonitoringMode | undefined) ?? "limited-monitoring",
  screenshotCapturedAt: event.screenshotCapturedAt ?? undefined,
  screenshotStorageKey: event.screenshotStorageKey ?? undefined,
  screenshotUrl: event.screenshotUrl ?? undefined,
});

const mapMonitoringSummary = (
  monitoring: Nullable<DashboardAttempt["monitoring"]>,
): AttemptMonitoringSummary | undefined => {
  if (!monitoring) return undefined;

  return {
    totalEvents: monitoring.totalEvents,
    warningCount: monitoring.warningCount,
    dangerCount: monitoring.dangerCount,
    lastEventAt: monitoring.lastEventAt ?? undefined,
    recentEvents: monitoring.recentEvents.map(mapMonitoringEvent),
  };
};

const mapAttemptFeedback = (
  feedback:
    | Nullable<DashboardAttempt["feedback"]>
    | Nullable<SubmitAnswersMutation["submitAnswers"]["feedback"]>,
): AttemptFeedback | undefined => {
  if (!feedback) return undefined;

  return {
    headline: feedback.headline,
    summary: feedback.summary,
    strengths: [...feedback.strengths],
    improvements: [...feedback.improvements],
    source: (feedback.source as AiContentSource | undefined) ?? undefined,
  };
};

const computeFrontendResultSummary = (
  questionResults: Array<{
    answerChangeCount?: number;
    competency?: string;
    correctOptionId: string;
    dwellMs?: number;
    explanation?: string | null;
    explanationSource?: string | null;
    isCorrect?: boolean;
    maxPoints: number;
    pointsAwarded?: number;
    prompt?: string;
    questionId: string;
    questionType?: "single-choice" | "math";
    selectedOptionId?: string | null;
  }>,
): ExamResultSummary => {
  const normalizedQuestionResults = questionResults.map((questionResult) => {
    const isCorrect =
      typeof questionResult.isCorrect === "boolean"
        ? questionResult.isCorrect
        : (questionResult.selectedOptionId ?? null) ===
          questionResult.correctOptionId;
    const maxPoints = questionResult.maxPoints ?? 0;
    const pointsAwarded = Math.max(
      0,
      Math.min(questionResult.pointsAwarded ?? (isCorrect ? maxPoints : 0), maxPoints),
    );

    return {
      answerChangeCount: questionResult.answerChangeCount ?? 0,
      competency: questionResult.competency ?? "",
      dwellMs: questionResult.dwellMs ?? 0,
      prompt: questionResult.prompt ?? "",
      questionId: questionResult.questionId,
      questionType: questionResult.questionType ?? "single-choice",
      selectedOptionId: questionResult.selectedOptionId ?? null,
      correctOptionId: questionResult.correctOptionId,
      isCorrect,
      pointsAwarded,
      maxPoints,
      explanation: questionResult.explanation ?? "",
      explanationSource:
        (questionResult.explanationSource as AiContentSource | undefined) ??
        undefined,
    };
  });

  const score = normalizedQuestionResults.reduce(
    (sum, questionResult) => sum + questionResult.pointsAwarded,
    0,
  );
  const maxScore = normalizedQuestionResults.reduce(
    (sum, questionResult) => sum + questionResult.maxPoints,
    0,
  );

  return {
    score,
    maxScore,
    percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
    correctCount: normalizedQuestionResults.filter((item) => item.isCorrect)
      .length,
    incorrectCount: normalizedQuestionResults.filter(
      (item) => item.selectedOptionId !== null && !item.isCorrect,
    ).length,
    unansweredCount: normalizedQuestionResults.filter(
      (item) => item.selectedOptionId === null,
    ).length,
    questionResults: normalizedQuestionResults,
  };
};

const mapExamResultSummary = (
  result: Nullable<DashboardAttempt["result"]>,
): ExamResultSummary | undefined => {
  if (!result) return undefined;

  return computeFrontendResultSummary(
    result.questionResults.map((questionResult) => ({
      answerChangeCount: 0,
      competency: "",
      dwellMs: 0,
      prompt: "",
      questionId: questionResult.questionId,
      questionType: "single-choice",
      selectedOptionId: questionResult.selectedOptionId ?? null,
      correctOptionId: questionResult.correctOptionId,
      isCorrect: questionResult.isCorrect,
      pointsAwarded: questionResult.pointsAwarded,
      maxPoints: questionResult.maxPoints,
      explanation: questionResult.explanation ?? "",
      explanationSource:
        (questionResult.explanationSource as AiContentSource | undefined) ??
        undefined,
    })),
  );
};

const mapStudent = (
  student: GetStudentsQuery["students"][number],
): StudentInfo => ({
  id: student.id,
  name: student.name,
  className: student.className,
});

const mapTest = (
  test: GetStudentDashboardQuery["availableTests"][number],
): TeacherTestSummary => ({
  id: test.id,
  title: test.title,
  description: test.description,
  updatedAt: test.updatedAt,
  criteria: {
    gradeLevel: test.criteria.gradeLevel,
    className: test.criteria.className,
    subject: test.criteria.subject,
    topic: test.criteria.topic,
    difficulty: test.criteria.difficulty,
    questionCount: test.criteria.questionCount,
  },
});

const mapAttemptSummary = (
  attempt: GetStudentDashboardQuery["attempts"][number],
): AttemptSummary => ({
  attemptId: attempt.attemptId,
  testId: attempt.testId,
  title: attempt.title,
  studentId: attempt.studentId,
  studentName: attempt.studentName,
  status: attempt.status as AttemptSummary["status"],
  score: attempt.score ?? undefined,
  maxScore: attempt.maxScore ?? undefined,
  percentage: attempt.percentage ?? undefined,
  startedAt: attempt.startedAt,
  submittedAt: attempt.submittedAt ?? undefined,
  monitoring: mapMonitoringSummary(attempt.monitoring),
  result: mapExamResultSummary(attempt.result),
  feedback: mapAttemptFeedback(attempt.feedback),
  answerReview: attempt.answerReview?.map(
    (item): AttemptAnswerReviewItem => ({
      answerChangeCount: item.answerChangeCount ?? 0,
      competency: item.competency,
      correctAnswerText: item.correctAnswerText ?? undefined,
      dwellMs: item.dwellMs ?? 0,
      points: item.points,
      prompt: item.prompt,
      questionId: item.questionId,
      questionType: item.questionType as "single-choice" | "math",
      responseGuide: item.responseGuide ?? undefined,
      selectedAnswerText: item.selectedAnswerText ?? undefined,
      selectedOptionId: item.selectedOptionId ?? null,
    }),
  ),
});

export const mapDashboardPayload = (
  data: GetStudentDashboardQuery,
): DashboardPayload => ({
  availableTests: data.availableTests.map(mapTest),
  attempts: data.attempts.map(mapAttemptSummary),
});

const mapExamProgress = (
  progress:
    | StartExamMutation["startExam"]["progress"]
    | ResumeExamMutation["resumeExam"]["progress"]
    | SubmitAnswersMutation["submitAnswers"]["progress"],
): ExamProgress => ({
  totalQuestions: progress.totalQuestions,
  answeredQuestions: progress.answeredQuestions,
  remainingQuestions: progress.remainingQuestions,
  completionRate: progress.completionRate,
});

const mapStartExamResponse = (
  payload: StartExamMutation["startExam"] | ResumeExamMutation["resumeExam"],
): StartExamResponse => ({
  attemptId: payload.attemptId,
  status: payload.status as StartExamResponse["status"],
  studentId: payload.studentId,
  studentName: payload.studentName,
  startedAt: payload.startedAt,
  expiresAt: payload.expiresAt,
  existingAnswers: Object.fromEntries(
    (payload.existingAnswers ?? []).map((answer) => [
      answer.questionId,
      answer.selectedOptionId ?? null,
    ]),
  ),
  exam: {
    testId: payload.exam.testId,
    title: payload.exam.title,
    description: payload.exam.description,
    timeLimitMinutes: payload.exam.timeLimitMinutes,
    criteria: {
      gradeLevel: payload.exam.criteria.gradeLevel,
      className: payload.exam.criteria.className,
      subject: payload.exam.criteria.subject,
      topic: payload.exam.criteria.topic,
      difficulty: payload.exam.criteria.difficulty,
      questionCount: payload.exam.criteria.questionCount,
    },
    questions: payload.exam.questions.map((question) => ({
      questionId: question.questionId,
      type: question.type as "single-choice" | "math",
      prompt: question.prompt,
      points: question.points,
      competency: question.competency ?? undefined,
      imageUrl: question.imageUrl ?? undefined,
      audioUrl: question.audioUrl ?? undefined,
      videoUrl: question.videoUrl ?? undefined,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
      })),
    })),
  },
  progress: mapExamProgress(payload.progress),
});

const mapSubmitAnswersResponse = (
  payload: SubmitAnswersMutation["submitAnswers"],
): SubmitAnswersResponse => ({
  attemptId: payload.attemptId,
  status: payload.status as SubmitAnswersResponse["status"],
  progress: mapExamProgress(payload.progress),
  result: payload.status === "approved" && payload.result
    ? computeFrontendResultSummary(
        payload.result.questionResults.map((questionResult) => ({
          answerChangeCount: 0,
          competency: "",
          dwellMs: 0,
          prompt: "",
          questionId: questionResult.questionId,
          questionType: "single-choice",
          selectedOptionId: questionResult.selectedOptionId ?? null,
          correctOptionId: questionResult.correctOptionId,
          isCorrect: questionResult.isCorrect,
          pointsAwarded: questionResult.pointsAwarded,
          maxPoints: questionResult.maxPoints,
          explanation: questionResult.explanation ?? "",
          explanationSource:
            (questionResult.explanationSource as AiContentSource | undefined) ??
            undefined,
        })),
      )
    : undefined,
  feedback:
    payload.status === "approved" ? mapAttemptFeedback(payload.feedback) : undefined,
});

export const loadStudentsData = async (
  options?: { force?: boolean },
): Promise<StudentInfo[]> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.getStudents();
  }

  if (!options?.force && studentsCache && isFreshCache(studentsCache.expiresAt)) {
    return studentsCache.value;
  }

  if (!options?.force && studentsRequestInFlight) {
    return studentsRequestInFlight;
  }

  studentsRequestInFlight = (async () => {
    const data = await gqlRequest(GetStudentsDocument);
    const nextStudents = data.students.map(mapStudent);
    studentsCache = {
      expiresAt: Date.now() + STUDENTS_CACHE_TTL_MS,
      value: nextStudents,
    };
    return nextStudents;
  })();

  try {
    return await studentsRequestInFlight;
  } finally {
    studentsRequestInFlight = null;
  }
};

export const loadDashboardPayload = async (
  options?: { force?: boolean },
): Promise<DashboardPayload> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.getDashboard();
  }

  if (!options?.force && dashboardCache && isFreshCache(dashboardCache.expiresAt)) {
    return dashboardCache.value;
  }

  if (!options?.force && dashboardRequestInFlight) {
    return dashboardRequestInFlight;
  }

  dashboardRequestInFlight = (async () => {
    const data = await gqlRequest(GetStudentDashboardDocument);

    if (data.availableTests.length > 0) {
      const nextPayload = mapDashboardPayload(data);
      dashboardCache = {
        expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
        value: nextPayload,
      };
      return nextPayload;
    }

    try {
      await gqlRequest(SyncExternalNewMathExamsDocument, { limit: 1 });
      const syncedData = await gqlRequest(GetStudentDashboardDocument);

      const nextPayload = mapDashboardPayload(syncedData);
      dashboardCache = {
        expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
        value: nextPayload,
      };
      return nextPayload;
    } catch (error) {
      console.error(
        "Failed to sync external exams before loading dashboard:",
        error,
      );
    }

    const nextPayload = mapDashboardPayload(data);
    dashboardCache = {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
      value: nextPayload,
    };
    return nextPayload;
  })();

  try {
    return await dashboardRequestInFlight;
  } finally {
    dashboardRequestInFlight = null;
  }
};

export const invalidateStudentDashboardCache = () => {
  dashboardCache = null;
};

export const generateMathExpressionRequest = async (
  text: string,
  preferredProvider: MathNaturalLanguageProvider = "auto",
): Promise<MathNaturalLanguageResponse> => {
  const response = await fetch("/api/math-natural-language", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferredProvider, text }),
  });

  const payload = (await response.json()) as
    | MathNaturalLanguageResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      "message" in payload && payload.message
        ? payload.message
        : "Текстийг томьёо болгож чадсангүй.",
    );
  }

  return payload as MathNaturalLanguageResponse;
};

export const startExamRequest = async (payload: {
  testId: string;
  studentId: string;
  studentName: string;
}): Promise<StartExamResponse> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.startExam(payload);
  }

  const data = await gqlRequest(StartExamDocument, payload);
  return mapStartExamResponse(data.startExam);
};

export const resumeExamRequest = async (
  attemptId: string,
): Promise<StartExamResponse> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.resumeExam(attemptId);
  }

  const data = await gqlRequest(ResumeExamDocument, { attemptId });
  return mapStartExamResponse(data.resumeExam);
};

export const submitAnswersRequest = async (payload: {
  attemptId: string;
  answers: ExamAnswerInput[];
  finalize: boolean;
}): Promise<SubmitAnswersResponse> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.submitAnswers(payload);
  }

  const data = await gqlRequest(SubmitAnswersDocument, payload);
  return mapSubmitAnswersResponse(data.submitAnswers);
};

export const logAttemptActivityRequest = async (
  attemptId: string,
  input: AttemptActivityInput,
) => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.logAttemptActivity(attemptId, input);
  }

  const variables: LogAttemptActivityMutationVariables = {
    attemptId,
    input,
  };
  const data = await gqlRequest(LogAttemptActivityDocument, variables);

  return data.logAttemptActivity;
};

export const uploadProctoringScreenshotRequest = async ({
  attemptId,
  blob,
  capturedAt,
  eventCode,
  mode,
  studentName,
  userId,
}: UploadProctoringScreenshotInput) => {
  if (USE_MOCK_DATA) {
    return {
      key: `mock/${attemptId}/${eventCode}/${Date.now()}.jpg`,
      publicUrl: URL.createObjectURL(blob),
    };
  }

  if (proctoringUploadCapability === "inline-fallback") {
    return buildInlineScreenshotResult({
      attemptId,
      blob,
      eventCode,
    });
  }

  const metadata: ProctoringScreenshotMetadata = {
    attemptId,
    capturedAt,
    eventCode,
    mode,
    studentName,
    userId,
  };
  const fallbackKey = buildProctoringScreenshotKey(metadata);

  try {
    const presignUrl = resolveProctoringPresignUrl();
    const presignResponse = await fetch(presignUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attemptId,
        capturedAt,
        contentType: blob.type || "image/jpeg",
        eventCode,
        mode,
        studentName,
        userId,
      }),
    });

    const presignPayload = await readJsonResponse<
      | ProctoringPresignPlanResponse
      | {
          code?: string;
          error?: string;
          message?: string;
        }
    >(presignResponse);

    if (isInlineFallbackProctoringPlan(presignPayload)) {
      rememberInlineFallbackCapability(
        presignPayload.message ||
          "Presign endpoint client-side inline fallback руу шилжлээ.",
      );
      return buildInlineScreenshotResult({
        attemptId,
        blob,
        eventCode,
      });
    }

    if (!presignResponse.ok || !isDirectUploadProctoringPlan(presignPayload)) {
      const fallbackUpload = await uploadProctoringImageViaAppRoute({
        blob,
        key: fallbackKey,
        metadata,
      });

      return fallbackUpload;
    }

    proctoringUploadCapability = "direct-upload";

    const { key, publicUrl, uploadUrl } = presignPayload;

    try {
      await uploadProctoringImageDirectly({
        blob,
        uploadUrl,
      });
    } catch (error) {
      console.warn(
        "Direct R2 upload failed, falling back to app upload route.",
        error,
      );

      const fallbackUpload = await uploadProctoringImageViaAppRoute({
        blob,
        key,
        metadata,
      });

      return fallbackUpload;
    }

    return {
      key,
      publicUrl,
    };
  } catch (error) {
    if (isInlineFallbackUploadError(error) || isStorageUnavailablePayload(error)) {
      rememberInlineFallbackCapability(
        error instanceof Error
          ? error.message
          : "Screenshot storage temporarily unavailable.",
      );
    }

    console.warn(
      "Screenshot upload failed, falling back to inline data URL evidence.",
      error,
    );
    return buildInlineScreenshotResult({
      attemptId,
      blob,
      eventCode,
    });
  }
};

export const logQuestionMetricsRequest = async (
  attemptId: string,
  input: QuestionMetricInput[],
) => {
  if (USE_MOCK_DATA) {
    return true;
  }

  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        mutation LogQuestionMetrics(
          $attemptId: String!
          $input: [QuestionMetricInput!]!
        ) {
          logQuestionMetrics(attemptId: $attemptId, input: $input)
        }
      `,
      variables: { attemptId, input },
    }),
  });

  const payload = (await response.json()) as GraphQlResult<{
    logQuestionMetrics: boolean;
  }>;

  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.[0]?.message || "Question metrics хадгалж чадсангүй.",
    );
  }

  return payload.data.logQuestionMetrics;
};

export const checkSebAccessRequest = async (): Promise<SebCheckResponse> => {
  const response = await fetch("/api/seb/check", {
    cache: "no-store",
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json()) as SebCheckResponse;

  if (response.ok) {
    return payload;
  }

  return {
    ...payload,
    ok: false,
    message: payload.message || "SEB шалгалт амжилтгүй боллоо.",
  };
};
