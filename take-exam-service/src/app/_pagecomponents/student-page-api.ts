"use client";

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";
import {
  GetStudentDashboardDocument,
  GetStudentsDocument,
  LogAttemptActivityDocument,
  ResumeExamDocument,
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
  AttemptMonitoringEvent,
  AttemptMonitoringSummary,
  AttemptSummary,
  ExamAnswerInput,
  ExamProgress,
  ExamResultSummary,
  ProctoringEventSeverity,
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

type Nullable<T> = T | null | undefined;
type DashboardAttempt = GetStudentDashboardQuery["attempts"][number];
type DashboardAttemptMonitoring = NonNullable<DashboardAttempt["monitoring"]>;

export type AttemptActivityInput = {
  code: string;
  detail: string;
  occurredAt?: string;
  severity: ProctoringEventSeverity;
  title: string;
};

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

const mapMonitoringEvent = (
  event: DashboardAttemptMonitoring["recentEvents"][number],
): AttemptMonitoringEvent => ({
  id: event.id,
  code: event.code,
  severity: event.severity as ProctoringEventSeverity,
  title: event.title,
  detail: event.detail,
  occurredAt: event.occurredAt,
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

const mapExamResultSummary = (
  result: Nullable<DashboardAttempt["result"]>,
): ExamResultSummary | undefined => {
  if (!result) return undefined;

  return {
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.percentage,
    correctCount: result.correctCount,
    incorrectCount: result.incorrectCount,
    unansweredCount: result.unansweredCount,
    questionResults: result.questionResults.map((questionResult) => ({
      questionId: questionResult.questionId,
      selectedOptionId: questionResult.selectedOptionId ?? null,
      correctOptionId: questionResult.correctOptionId,
      isCorrect: questionResult.isCorrect,
      pointsAwarded: questionResult.pointsAwarded,
      maxPoints: questionResult.maxPoints,
      explanation: questionResult.explanation ?? "",
    })),
  };
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
      type: question.type as "single-choice",
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
  result: payload.result
    ? {
        score: payload.result.score,
        maxScore: payload.result.maxScore,
        percentage: payload.result.percentage,
        correctCount: payload.result.correctCount,
        incorrectCount: payload.result.incorrectCount,
        unansweredCount: payload.result.unansweredCount,
        questionResults: payload.result.questionResults.map(
          (questionResult) => ({
            questionId: questionResult.questionId,
            selectedOptionId: questionResult.selectedOptionId ?? null,
            correctOptionId: questionResult.correctOptionId,
            isCorrect: questionResult.isCorrect,
            pointsAwarded: questionResult.pointsAwarded,
            maxPoints: questionResult.maxPoints,
            explanation: questionResult.explanation ?? "",
          }),
        ),
      }
    : undefined,
});

export const loadStudentsData = async (): Promise<StudentInfo[]> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.getStudents();
  }

  const data = await gqlRequest(GetStudentsDocument);
  return data.students.map(mapStudent);
};

export const loadDashboardPayload = async (): Promise<{
  availableTests: TeacherTestSummary[];
  attempts: AttemptSummary[];
}> => {
  if (USE_MOCK_DATA) {
    return mockStudentPortalClient.getDashboard();
  }

  const data = await gqlRequest(GetStudentDashboardDocument);

  return {
    availableTests: data.availableTests.map(mapTest),
    attempts: data.attempts.map(mapAttemptSummary),
  };
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
