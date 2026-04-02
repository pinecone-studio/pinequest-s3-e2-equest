export type ProctoringScreenshotMetadata = {
  attemptId: string;
  capturedAt: string;
  eventCode: string;
  mode?: string;
  studentName?: string | null;
  userId: string;
};

export type ProctoringDirectUploadPlan = {
  strategy: "direct-upload";
  key: string;
  publicUrl: string;
  uploadUrl: string;
};

export type ProctoringInlineFallbackPlan = {
  strategy: "inline-fallback";
  reason: "storage-not-configured" | "upload-disabled";
  message?: string;
  missingEnvKeys?: string[];
};

export type ProctoringPresignPlanResponse =
  | ProctoringDirectUploadPlan
  | ProctoringInlineFallbackPlan;

export const sanitizeProctoringKeySegment = (
  value: string,
  fallback: string,
) => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || fallback;
};

export const buildProctoringScreenshotKey = ({
  attemptId,
  capturedAt,
  eventCode,
  mode,
  studentName,
  userId,
}: ProctoringScreenshotMetadata) => {
  const isoTimestamp = Number.isNaN(new Date(capturedAt).getTime())
    ? new Date().toISOString()
    : new Date(capturedAt).toISOString();
  const safeDate = isoTimestamp.replace(/[:.]/g, "-");
  const safeAttemptId = sanitizeProctoringKeySegment(attemptId, "attempt");
  const safeStudentSegment = sanitizeProctoringKeySegment(
    studentName || userId,
    "user",
  );
  const safeEventCode = sanitizeProctoringKeySegment(eventCode, "event");
  const safeMode = sanitizeProctoringKeySegment(
    mode ?? "limited-monitoring",
    "mode",
  );

  return [
    "proctoring",
    safeAttemptId,
    safeStudentSegment,
    `${safeDate}-${safeEventCode}-${safeMode}.jpg`,
  ].join("/");
};

export const isDirectUploadProctoringPlan = (
  value: unknown,
): value is ProctoringDirectUploadPlan => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "strategy" in value &&
    value.strategy === "direct-upload" &&
    "key" in value &&
    typeof value.key === "string" &&
    "publicUrl" in value &&
    typeof value.publicUrl === "string" &&
    "uploadUrl" in value &&
    typeof value.uploadUrl === "string"
  );
};

export const isInlineFallbackProctoringPlan = (
  value: unknown,
): value is ProctoringInlineFallbackPlan => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "strategy" in value && value.strategy === "inline-fallback";
};
