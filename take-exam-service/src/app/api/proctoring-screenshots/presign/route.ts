import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type PresignRequestBody = {
  attemptId?: string;
  capturedAt?: string;
  contentType?: string;
  eventCode?: string;
  mode?: string;
  studentName?: string;
  userId?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const sanitizeKeySegment = (value: string, fallback: string) => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || fallback;
};

const getRequiredEnv = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} environment variable is required.`);
  }

  return value;
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

    const bucketName = getRequiredEnv("R2_PROCTORING_BUCKET_NAME");
    const contentType = body.contentType?.trim() || "image/jpeg";
    const isoTimestamp = Number.isNaN(new Date(capturedAt).getTime())
      ? new Date().toISOString()
      : new Date(capturedAt).toISOString();
    const safeDate = isoTimestamp.replace(/[:.]/g, "-");
    const safeAttemptId = sanitizeKeySegment(attemptId, "attempt");
    const safeStudentSegment = sanitizeKeySegment(studentName || userId, "user");
    const safeEventCode = sanitizeKeySegment(eventCode, "event");
    const safeMode = sanitizeKeySegment(body.mode ?? "limited-monitoring", "mode");
    const key = [
      "proctoring",
      safeAttemptId,
      safeStudentSegment,
      `${safeDate}-${safeEventCode}-${safeMode}.jpg`,
    ].join("/");

    const client = new S3Client({
      region: "auto",
      endpoint: getRequiredEnv("R2_S3_API"),
      credentials: {
        accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 60 * 10,
    });

    return Response.json(
      {
        key,
        publicUrl: `${requestUrl.origin}/api/proctoring-screenshots/object?key=${encodeURIComponent(
          key,
        )}`,
        uploadUrl,
      },
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
