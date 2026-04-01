import type { DashboardApiPayload } from "@/app/test/live-dashboard/lib/dashboard-adapters";
import { getTakeExamGraphqlUrl } from "@/lib/take-exam-graphql";

const DASHBOARD_QUERY = `
query FrontendDashboard($limit: Int!) {
  availableTests {
    id
    title
    description
    updatedAt
    criteria {
      className
      difficulty
      gradeLevel
      questionCount
      subject
      topic
    }
  }
  attempts {
    attemptId
    testId
    title
    studentId
    studentName
    status
    answerKeySource
    score
    maxScore
    percentage
    startedAt
    submittedAt
    monitoring {
      totalEvents
      warningCount
      dangerCount
      lastEventAt
      recentEvents {
        id
        code
        severity
        title
        detail
        occurredAt
        mode
        screenshotCapturedAt
        screenshotStorageKey
        screenshotUrl
      }
    }
    result {
      score
      maxScore
      percentage
      correctCount
      incorrectCount
      unansweredCount
      questionResults {
        questionId
        prompt
        competency
        questionType
        selectedOptionId
        correctOptionId
        isCorrect
        pointsAwarded
        maxPoints
        explanation
        explanationSource
        dwellMs
        answerChangeCount
      }
    }
    answerReview {
      questionId
      prompt
      competency
      questionType
      selectedOptionId
      selectedAnswerText
      correctAnswerText
      points
      responseGuide
      dwellMs
      answerChangeCount
    }
    feedback {
      headline
      summary
      strengths
      improvements
      source
    }
  }
  liveMonitoringFeed(limit: $limit) {
    attemptId
    testId
    title
    studentId
    studentName
    status
    startedAt
    submittedAt
    monitoring {
      totalEvents
      warningCount
      dangerCount
      lastEventAt
    }
    latestEvent {
      id
      code
      severity
      title
      detail
      occurredAt
      mode
      screenshotCapturedAt
      screenshotStorageKey
      screenshotUrl
    }
  }
}
`.trim();

const DASHBOARD_WITH_MATERIAL_QUERY = `
query FrontendDashboardWithMaterial($limit: Int!, $testId: String!) {
  availableTests {
    id
    title
    description
    updatedAt
    criteria {
      className
      difficulty
      gradeLevel
      questionCount
      subject
      topic
    }
  }
  attempts {
    attemptId
    testId
    title
    studentId
    studentName
    status
    answerKeySource
    score
    maxScore
    percentage
    startedAt
    submittedAt
    monitoring {
      totalEvents
      warningCount
      dangerCount
      lastEventAt
      recentEvents {
        id
        code
        severity
        title
        detail
        occurredAt
        mode
        screenshotCapturedAt
        screenshotStorageKey
        screenshotUrl
      }
    }
    result {
      score
      maxScore
      percentage
      correctCount
      incorrectCount
      unansweredCount
      questionResults {
        questionId
        prompt
        competency
        questionType
        selectedOptionId
        correctOptionId
        isCorrect
        pointsAwarded
        maxPoints
        explanation
        explanationSource
        dwellMs
        answerChangeCount
      }
    }
    answerReview {
      questionId
      prompt
      competency
      questionType
      selectedOptionId
      selectedAnswerText
      correctAnswerText
      points
      responseGuide
      dwellMs
      answerChangeCount
    }
    feedback {
      headline
      summary
      strengths
      improvements
      source
    }
  }
  liveMonitoringFeed(limit: $limit) {
    attemptId
    testId
    title
    studentId
    studentName
    status
    startedAt
    submittedAt
    monitoring {
      totalEvents
      warningCount
      dangerCount
      lastEventAt
    }
    latestEvent {
      id
      code
      severity
      title
      detail
      occurredAt
      mode
      screenshotCapturedAt
      screenshotStorageKey
      screenshotUrl
    }
  }
  testMaterial(testId: $testId) {
    testId
    title
    questions {
      questionId
      prompt
      type
      points
      competency
      imageUrl
      audioUrl
      videoUrl
      responseGuide
      options {
        id
        text
      }
    }
  }
}
`.trim();

type GraphqlEnvelope<TData> = {
  data?: TData;
  errors?: Array<{ message?: string }>;
};

const hasMissingFieldError = (
  payload: { errors?: Array<{ message?: string }> },
  fieldName: string,
) =>
  payload.errors?.some((error) =>
    error.message?.includes(`Cannot query field "${fieldName}"`),
  ) ?? false;

const buildProgress = (attempt: Record<string, any>, questionCount: number) => {
  const answeredQuestionsFromResult =
    (attempt.result?.correctCount ?? 0) +
    (attempt.result?.incorrectCount ?? 0) +
    (attempt.result?.unansweredCount ?? 0);
  const answeredQuestionsFromReview =
    attempt.answerReview?.filter(
      (item: Record<string, any>) =>
        item.selectedOptionId || item.selectedAnswerText,
    ).length ?? 0;
  const answeredQuestions = Math.max(
    answeredQuestionsFromResult,
    answeredQuestionsFromReview,
  );
  const totalQuestions =
    questionCount > 0
      ? questionCount
      : answeredQuestions > 0
        ? answeredQuestions
        : 0;
  const safeAnswered = Math.min(answeredQuestions, totalQuestions);
  const remainingQuestions = Math.max(totalQuestions - safeAnswered, 0);
  const completionRate =
    totalQuestions > 0 ? Math.round((safeAnswered / totalQuestions) * 100) : 0;

  return {
    answeredQuestions: safeAnswered,
    completionRate,
    remainingQuestions,
    totalQuestions,
  };
};

const fetchGraphqlPayload = async <TData>(
  query: string,
  variables: Record<string, unknown>,
) => {
  const response = await fetch(getTakeExamGraphqlUrl(), {
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const rawText = await response.text();
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    throw new Error("Take exam service хоосон хариу буцаалаа.");
  }

  let payload: GraphqlEnvelope<TData> | null = null;

  try {
    payload = JSON.parse(trimmedText) as GraphqlEnvelope<TData>;
  } catch {
    if (/<!doctype html|<html/i.test(trimmedText)) {
      throw new Error("Take exam service JSON биш HTML буцаалаа.");
    }

    throw new Error("Take exam service JSON parse хийж чадсангүй.");
  }

  return { payload, response };
};

export const fetchTakeExamDashboard = async (
  limit: number,
  testId?: string | null,
): Promise<DashboardApiPayload> => {
  let { payload, response } = await fetchGraphqlPayload<any>(
    testId ? DASHBOARD_WITH_MATERIAL_QUERY : DASHBOARD_QUERY,
    testId ? { limit, testId } : { limit },
  );

  if (
    testId &&
    response.ok &&
    payload &&
    hasMissingFieldError(payload, "testMaterial")
  ) {
    const fallback = await fetchGraphqlPayload<any>(DASHBOARD_QUERY, { limit });
    response = fallback.response;
    payload = fallback.payload?.data
      ? {
          ...fallback.payload,
          data: {
            ...fallback.payload.data,
            testMaterial: null,
          },
        }
      : fallback.payload;
  }

  if (!response.ok || payload?.errors?.length || !payload?.data) {
    throw new Error(
      payload?.errors?.[0]?.message ??
        "Take exam service-ээс dashboard өгөгдөл авч чадсангүй.",
    );
  }

  const data = payload.data;
  const testsById = new Map<string, Record<string, any>>(
    data.availableTests.map((test: Record<string, any>) => [test.id, test]),
  );

  return {
    ...data,
    attempts: data.attempts.map((attempt: Record<string, any>) => {
      const test = testsById.get(attempt.testId);
      const totalQuestions = test?.criteria.questionCount ?? 0;

      return {
        ...attempt,
        answerReview: attempt.answerReview ?? null,
        criteria: test?.criteria ?? null,
        monitoring: attempt.monitoring
          ? {
              ...attempt.monitoring,
              infoCount: 0,
              recentEvents: attempt.monitoring.recentEvents ?? [],
            }
          : null,
        progress: buildProgress(attempt, totalQuestions),
        result: attempt.result
          ? {
              ...attempt.result,
              questionResults: attempt.result.questionResults.map(
                (result: Record<string, any>) => ({
                  ...result,
                  answerChangeCount: result.answerChangeCount ?? null,
                  competency: result.competency,
                  dwellMs: result.dwellMs ?? null,
                  prompt: result.prompt,
                  questionType: result.questionType,
                }),
              ),
            }
          : null,
        teacherSync: null,
      };
    }),
    availableTests: data.availableTests.map((test: Record<string, any>) => ({
      ...test,
    })),
    liveMonitoringFeed: data.liveMonitoringFeed.map((item: Record<string, any>) => ({
      ...item,
      monitoring: item.monitoring
        ? {
            ...item.monitoring,
            infoCount: 0,
          }
        : null,
    })),
  } satisfies DashboardApiPayload;
};

export const approveTakeExamAttempt = async (input: {
  attemptId: string;
  review?: {
    questionReviews?: Array<{
      correctOptionId?: string | null;
      explanation?: string | null;
      isCorrect?: boolean | null;
      maxPoints?: number | null;
      pointsAwarded?: number | null;
      questionId: string;
    }>;
  };
}) => {
  const { payload, response } = await fetchGraphqlPayload<{
    approveAttempt?: boolean;
  }>(
    `
      mutation ApproveAttempt($attemptId: String!, $review: AttemptReviewInput) {
        approveAttempt(attemptId: $attemptId, review: $review)
      }
    `,
    {
      attemptId: input.attemptId,
      review: input.review ?? null,
    },
  );

  if (!response.ok || payload?.errors?.length || !payload?.data?.approveAttempt) {
    throw new Error(
      payload?.errors?.[0]?.message ?? "Attempt approve хийж чадсангүй.",
    );
  }
};
