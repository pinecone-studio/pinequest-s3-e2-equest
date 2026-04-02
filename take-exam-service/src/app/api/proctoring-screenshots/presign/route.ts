import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildProctoringScreenshotKey,
  type ProctoringPresignPlanResponse,
} from "@/lib/proctoring-screenshots";
import {
  buildProctoringObjectUrl,
  corsHeaders,
  createInlineFallbackPlan,
  getRequiredEnv,
  getMissingStorageEnvKeys,
  getProctoringStorageClient,
} from "../shared";

type PresignRequestBody = {
  attemptId?: string;
  capturedAt?: string;
  contentType?: string;
  eventCode?: string;
  mode?: string;
  studentName?: string;
  userId?: string;
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const body = (await request.json()) as PresignRequestBody;
    const attemptId = body.attemptId?.trim();
    const eventCode = body.eventCode?.trim();
    const capturedAt = body.capturedAt?.trim();
    const studentName = body.studentName?.trim();
    const userId = body.userId?.trim();

    if (!attemptId || !eventCode || !capturedAt || !userId) {
      return Response.json(
        {
          message: "attemptId, eventCode, capturedAt, userId is required.",
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const missingEnvKeys = getMissingStorageEnvKeys();
    if (missingEnvKeys.length > 0) {
      return Response.json(createInlineFallbackPlan(missingEnvKeys), {
        headers: corsHeaders,
      });
    }

    const contentType = body.contentType?.trim() || "image/jpeg";
    const key = buildProctoringScreenshotKey({
      attemptId,
      capturedAt,
      eventCode,
      mode: body.mode,
      studentName,
      userId,
    });
    const client = getProctoringStorageClient();

    const command = new PutObjectCommand({
      Bucket: getRequiredEnv("R2_PROCTORING_BUCKET_NAME"),
      Key: key,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 60 * 10,
    });

    return Response.json(
      {
        strategy: "direct-upload",
        key,
        publicUrl: buildProctoringObjectUrl(requestUrl, key),
        uploadUrl,
      } satisfies ProctoringPresignPlanResponse,
      {
        headers: corsHeaders,
      },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Screenshot upload URL үүсгэж чадсангүй.",
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
