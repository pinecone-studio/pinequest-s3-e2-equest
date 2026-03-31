import { eq, sql } from "drizzle-orm";
import type { ExamResultSummary } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { cacheAttemptState, resolveAttemptState } from "./cache";
import { computeProgress, countAnsweredQuestions, createId } from "./common";
import {
  enrichResultWithQuestionFeedback,
  generateAttemptFeedback,
  stringifyAttemptFeedback,
} from "./feedback";
import { getAttemptResults } from "./results";

export type TeacherSubmissionPayload = {
  attemptId: string;
  externalExamId: string;
  submittedAt: string;
  startedAt: string;
  expiresAt: string;
  sourceService: string;
  student: {
    id: string;
    name: string;
  };
  shuffleManifest?: string | null;
  answers: Array<{
    questionId: string;
    selectedOptionId: string | null;
  }>;
};

type AiBinding = {
  run: (
    model: string,
    input: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      response_format?: { type: "json_object" };
    },
  ) => Promise<{ response?: string }>;
};

export type TeacherCheckedQuestionPayload = {
  questionId: string;
  correctOptionId?: string | null;
  explanation?: string | null;
  isCorrect: boolean;
  maxPoints?: number | null;
  pointsAwarded?: number | null;
};

export type TeacherCheckedAttemptPayload = {
  attemptId: string;
  checkedAt?: string;
  externalExamId: string;
  maxScore?: number | null;
  percentage?: number | null;
  questionResults: TeacherCheckedQuestionPayload[];
  score?: number | null;
};

type TeacherCheckOptions = {
  ai?: AiBinding;
  geminiApiKey?: string;
  geminiModel?: string;
  kv?: KVNamespace;
  ollamaApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
};

export const parseStoredTeacherResult = (
  value?: string | null,
): ExamResultSummary | undefined => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as ExamResultSummary;
  } catch {
    return undefined;
  }
};

const buildTeacherCheckedResult = async (
  db: DbClient,
  attemptId: string,
  payload: TeacherCheckedAttemptPayload,
): Promise<ExamResultSummary> => {
  const rows = await getAttemptResults(db, attemptId);
  const teacherResultByQuestionId = new Map(
    payload.questionResults.map((question) => [question.questionId, question]),
  );

  const questionResults = rows.map((row) => {
    const teacherQuestion = teacherResultByQuestionId.get(row.questionId);
    const maxPoints = teacherQuestion?.maxPoints ?? row.points;
    const pointsAwarded =
      teacherQuestion?.pointsAwarded ??
      (teacherQuestion?.isCorrect ? maxPoints : 0);

    return {
      answerChangeCount: row.answerChangeCount ?? 0,
      competency: row.competency,
      correctOptionId: teacherQuestion?.correctOptionId ?? row.correctOptionId,
      dwellMs: row.dwellMs ?? 0,
      explanation: teacherQuestion?.explanation ?? row.explanation,
      isCorrect: teacherQuestion?.isCorrect ?? false,
      maxPoints,
      pointsAwarded,
      prompt: row.prompt,
      questionId: row.questionId,
      questionType: (row.questionType as "single-choice" | "math") ?? "single-choice",
      selectedOptionId: row.selectedOptionId,
    };
  });

  const score =
    payload.score ??
    questionResults.reduce((total, question) => total + question.pointsAwarded, 0);
  const maxScore =
    payload.maxScore ??
    questionResults.reduce((total, question) => total + question.maxPoints, 0);

  return {
    score,
    maxScore,
    percentage:
      payload.percentage ??
      (maxScore === 0 ? 0 : Math.round((score / maxScore) * 100)),
    correctCount: questionResults.filter((question) => question.isCorrect).length,
    incorrectCount: questionResults.filter(
      (question) => question.selectedOptionId !== null && !question.isCorrect,
    ).length,
    unansweredCount: questionResults.filter(
      (question) => question.selectedOptionId === null,
    ).length,
    questionResults,
  };
};

const buildTeacherSubmissionPayload = async (
  db: DbClient,
  attemptId: string,
  submittedAt: string,
): Promise<{
  payload: TeacherSubmissionPayload;
  targetService: string;
  testId: string;
} | null> => {
  const attempt = await db.query.attempts.findFirst({
    where: eq(schema.attempts.id, attemptId),
  });

  if (!attempt) {
    throw new Error("Оролдлого олдсонгүй.");
  }

  const test = await db.query.tests.findFirst({
    where: eq(schema.tests.id, attempt.testId),
  });

  if (!test || test.answerKeySource !== "teacher_service") {
    return null;
  }

  const answers = await db.query.answers.findMany({
    where: eq(schema.answers.attemptId, attemptId),
  });

  return {
    testId: test.id,
    targetService: test.sourceService ?? "teacher-service",
    payload: {
      attemptId,
      externalExamId: test.generatorTestId,
      submittedAt,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      sourceService: test.sourceService ?? "teacher-service",
      student: {
        id: attempt.studentId,
        name: attempt.studentName,
      },
      shuffleManifest: attempt.shuffleManifest ?? null,
      answers: answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
      })),
    },
  };
};

const upsertTeacherSubmissionExport = async (
  db: DbClient,
  attemptId: string,
  testId: string,
  targetService: string,
  payloadJson: string,
  status: "pending" | "sent" | "failed",
  lastError?: string | null,
  sentAt?: string | null,
) => {
  await db
    .insert(schema.teacherSubmissionExports)
    .values({
      id: createId("teacher_sync"),
      attemptId,
      testId,
      targetService,
      status,
      payloadJson,
      lastError: lastError ?? null,
      sentAt: sentAt ?? null,
    })
    .onConflictDoUpdate({
      target: schema.teacherSubmissionExports.attemptId,
      set: {
        targetService,
        status,
        payloadJson,
        lastError: lastError ?? null,
        sentAt: sentAt ?? null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });
};

export const syncAttemptSubmissionToTeacherService = async (
  db: DbClient,
  attemptId: string,
  submittedAt: string,
  submissionWebhookUrl?: string,
) => {
  const prepared = await buildTeacherSubmissionPayload(db, attemptId, submittedAt);

  if (!prepared) {
    return;
  }

  const payloadJson = JSON.stringify(prepared.payload);

  if (!submissionWebhookUrl) {
    await upsertTeacherSubmissionExport(
      db,
      attemptId,
      prepared.testId,
      prepared.targetService,
      payloadJson,
      "pending",
    );
    return;
  }

  try {
    const response = await fetch(submissionWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payloadJson,
    });

    if (!response.ok) {
      throw new Error(`Teacher submission failed with status ${response.status}`);
    }

    await upsertTeacherSubmissionExport(
      db,
      attemptId,
      prepared.testId,
      prepared.targetService,
      payloadJson,
      "sent",
      null,
      new Date().toISOString(),
    );
  } catch (error) {
    await upsertTeacherSubmissionExport(
      db,
      attemptId,
      prepared.testId,
      prepared.targetService,
      payloadJson,
      "failed",
      error instanceof Error ? error.message : "Teacher submission failed",
    );
  }
};

export const importTeacherCheckedAttempt = async (
  db: DbClient,
  payload: TeacherCheckedAttemptPayload,
  options: TeacherCheckOptions = {},
) => {
  const attempt = await db.query.attempts.findFirst({
    where: eq(schema.attempts.id, payload.attemptId),
  });

  if (!attempt) {
    throw new Error("Teacher result-д харгалзах attempt олдсонгүй.");
  }

  const test = await db.query.tests.findFirst({
    where: eq(schema.tests.id, attempt.testId),
  });

  if (!test || test.answerKeySource !== "teacher_service") {
    throw new Error("Энэ attempt teacher_service шалгалт биш байна.");
  }

  if (payload.externalExamId !== test.generatorTestId) {
    throw new Error("externalExamId таарахгүй байна.");
  }

  const resultRows = await getAttemptResults(db, payload.attemptId);
  const result = await enrichResultWithQuestionFeedback(
    resultRows,
    await buildTeacherCheckedResult(db, payload.attemptId, payload),
    {
      ai: options.ai,
      geminiApiKey: options.geminiApiKey,
      geminiModel: options.geminiModel,
      ollamaApiKey: options.ollamaApiKey,
      ollamaBaseUrl: options.ollamaBaseUrl,
      ollamaModel: options.ollamaModel,
    },
  );
  const attemptState = await resolveAttemptState(db, payload.attemptId, options.kv);
  const progress = computeProgress(
    countAnsweredQuestions(attemptState.answers),
    attemptState.totalQuestions,
  );
  const feedback = await generateAttemptFeedback(
    db,
    { attemptId: payload.attemptId, progress, result },
    {
      ai: options.ai,
      geminiApiKey: options.geminiApiKey,
      geminiModel: options.geminiModel,
      ollamaApiKey: options.ollamaApiKey,
      ollamaBaseUrl: options.ollamaBaseUrl,
      ollamaModel: options.ollamaModel,
    },
  );

  await db
    .update(schema.attempts)
    .set({
      status: "approved",
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      feedbackJson: stringifyAttemptFeedback(feedback),
      teacherResultJson: JSON.stringify(result),
    })
    .where(eq(schema.attempts.id, payload.attemptId));

  await cacheAttemptState(options.kv, {
    ...attemptState,
    status: "approved",
  });

  return {
    attemptId: payload.attemptId,
    feedback,
    result,
    status: "approved" as const,
  };
};
