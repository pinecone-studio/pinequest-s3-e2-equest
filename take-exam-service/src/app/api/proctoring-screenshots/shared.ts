import { S3Client } from "@aws-sdk/client-s3";
import type { ProctoringInlineFallbackPlan } from "@/lib/proctoring-screenshots";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const REQUIRED_STORAGE_ENV_KEYS = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_S3_API",
  "R2_PROCTORING_BUCKET_NAME",
] as const;

const formatMissingStorageMessage = (missingEnvKeys: string[]) =>
  `R2 screenshot storage is not configured. Missing: ${missingEnvKeys.join(", ")}.`;

export const getMissingStorageEnvKeys = () =>
  REQUIRED_STORAGE_ENV_KEYS.filter((key) => !process.env[key]?.trim());

export const createInlineFallbackPlan = (
  missingEnvKeys: string[],
): ProctoringInlineFallbackPlan => ({
  strategy: "inline-fallback",
  reason: "storage-not-configured",
  message: formatMissingStorageMessage(missingEnvKeys),
  missingEnvKeys,
});

export const createStorageUnavailableResponse = (
  missingEnvKeys: string[],
  status = 503,
) =>
  Response.json(
    {
      code: "storage_not_configured",
      message: formatMissingStorageMessage(missingEnvKeys),
      missingEnvKeys,
    },
    {
      status,
      headers: corsHeaders,
    },
  );

export const getRequiredEnv = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} environment variable is required.`);
  }

  return value;
};

export const getProctoringStorageClient = () =>
  new S3Client({
    region: "auto",
    endpoint: getRequiredEnv("R2_S3_API"),
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

export const buildProctoringObjectUrl = (requestUrl: URL, key: string) =>
  `${requestUrl.origin}/api/proctoring-screenshots/object?key=${encodeURIComponent(key)}`;
