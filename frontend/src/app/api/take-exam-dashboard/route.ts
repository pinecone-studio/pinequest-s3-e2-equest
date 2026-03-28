import { NextResponse } from "next/server";
import { print } from "graphql";
import { getTakeExamGraphqlUrl } from "@/lib/take-exam-graphql";
import {
  FrontendTakeExamDashboardDocument,
  FrontendTakeExamDashboardWithMaterialDocument,
  type FrontendTakeExamDashboardQuery,
  type FrontendTakeExamDashboardWithMaterialQuery,
} from "@/take-exam-gql/operations";

const DASHBOARD_QUERY = print(FrontendTakeExamDashboardDocument);
const DASHBOARD_WITH_MATERIAL_QUERY = print(
  FrontendTakeExamDashboardWithMaterialDocument,
);

type DashboardQueryData =
  | FrontendTakeExamDashboardQuery
  | FrontendTakeExamDashboardWithMaterialQuery;

const buildProgress = (
  attempt: DashboardQueryData["attempts"][number],
  questionCount: number,
) => {
  const answeredQuestions =
    (attempt.result?.correctCount ?? 0) +
    (attempt.result?.incorrectCount ?? 0) +
    (attempt.result?.unansweredCount ?? 0);
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
    totalQuestions,
    answeredQuestions: safeAnswered,
    remainingQuestions,
    completionRate,
  };
};

const getDerivedAnswerKeySource = (
  _testId: string,
  _attempts: DashboardQueryData["attempts"],
) => "local";

type GraphQlPayload<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const hasMissingFieldError = (
  payload: GraphQlPayload<DashboardQueryData>,
  fieldName: string,
) =>
  payload.errors?.some((error) =>
    error.message?.includes(`Cannot query field "${fieldName}"`),
  ) ?? false;

const fetchDashboardPayload = async (
  targetUrl: string,
  query: string,
  variables: Record<string, string | number>,
) => {
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const payload = (await response.json()) as GraphQlPayload<DashboardQueryData>;

  return { response, payload };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit") ?? "12");
  const testId = searchParams.get("testId");
  const targetUrl = getTakeExamGraphqlUrl();
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 40)
    : 12;

  try {
    let { response, payload } = await fetchDashboardPayload(
      targetUrl,
      testId ? DASHBOARD_WITH_MATERIAL_QUERY : DASHBOARD_QUERY,
      testId ? { limit, testId } : { limit },
    );

    if (
      testId &&
      response.ok &&
      hasMissingFieldError(payload, "testMaterial")
    ) {
      const fallback = await fetchDashboardPayload(targetUrl, DASHBOARD_QUERY, {
        limit,
      });

      response = fallback.response;
      payload = fallback.payload.data
        ? {
            ...fallback.payload,
            data: {
              ...fallback.payload.data,
              testMaterial: null,
            } as FrontendTakeExamDashboardWithMaterialQuery,
          }
        : fallback.payload;
    }

    if (!response.ok || payload.errors?.length || !payload.data) {
      return NextResponse.json(
        {
          message:
            payload.errors?.[0]?.message ??
            "Take exam service-ээс dashboard өгөгдөл авч чадсангүй.",
          targetUrl,
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    const data = payload.data;
    const testsById = new Map(
      data.availableTests.map((test) => [test.id, test] as const),
    );

    const normalizedData = {
      ...data,
      availableTests: data.availableTests.map((test) => ({
        ...test,
        answerKeySource: getDerivedAnswerKeySource(test.id, data.attempts),
      })),
      attempts: data.attempts.map((attempt) => {
        const test = testsById.get(attempt.testId);
        const totalQuestions = test?.criteria.questionCount ?? 0;

        return {
          ...attempt,
          answerKeySource: getDerivedAnswerKeySource(attempt.testId, data.attempts),
          criteria: test?.criteria ?? null,
          progress: buildProgress(attempt, totalQuestions),
          monitoring: attempt.monitoring
            ? {
                ...attempt.monitoring,
                infoCount: 0,
                recentEvents: attempt.monitoring.recentEvents ?? [],
              }
            : null,
          result: attempt.result
            ? {
                ...attempt.result,
                questionResults: attempt.result.questionResults.map((result) => ({
                  ...result,
                  prompt: "",
                  competency: "",
                  questionType: "unknown",
                  dwellMs: null,
                  answerChangeCount: null,
                })),
              }
            : null,
          teacherSync: null,
          answerReview: null,
        };
      }),
      liveMonitoringFeed: data.liveMonitoringFeed.map((item) => ({
        ...item,
        monitoring: item.monitoring
          ? {
              ...item.monitoring,
              infoCount: 0,
            }
          : null,
      })),
    };

    return NextResponse.json(normalizedData, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Dashboard route дуудах үед алдаа гарлаа.",
        targetUrl,
      },
      { status: 500 },
    );
  }
}
