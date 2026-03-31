import { NextResponse } from "next/server";
import { getTakeExamGraphqlUrl } from "@/lib/take-exam-graphql";

const APPROVE_ATTEMPT_MUTATION = `
  mutation ApproveAttempt($attemptId: String!, $review: AttemptReviewInput) {
    approveAttempt(attemptId: $attemptId, review: $review)
  }
`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      attemptId?: string;
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
    };
    const attemptId = body.attemptId?.trim();

    if (!attemptId) {
      return NextResponse.json(
        { message: "attemptId шаардлагатай." },
        { status: 400 },
      );
    }

    const response = await fetch(getTakeExamGraphqlUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        query: APPROVE_ATTEMPT_MUTATION,
        variables: {
          attemptId,
          review: body.review ?? null,
        },
      }),
    });
    const payload = (await response.json()) as {
      data?: { approveAttempt?: boolean };
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok || payload.errors?.length || !payload.data?.approveAttempt) {
      return NextResponse.json(
        {
          message:
            payload.errors?.[0]?.message ?? "Attempt approve хийж чадсангүй.",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Attempt approve хийх үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
