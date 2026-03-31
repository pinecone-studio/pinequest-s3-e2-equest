import { eq } from "drizzle-orm";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type RealtimeEnv = {
  ABLY_API_KEY?: string;
  ABLY_CHANNEL_PREFIX?: string;
  ABLY_REST_URL?: string;
};

type AttemptRealtimeEventName =
  | "attempt.started"
  | "attempt.saved"
  | "attempt.submitted"
  | "attempt.approved"
  | "monitoring.updated";

type AttemptRealtimePayload = {
  attemptId: string;
  event: AttemptRealtimeEventName;
  metadata?: Record<string, unknown>;
  occurredAt: string;
  startedAt: string;
  status: string;
  studentId: string;
  studentName: string;
  submittedAt: string | null;
  testId: string;
};

const getEnvValue = (primary?: string, fallback?: string) => {
  const value = primary?.trim() || fallback?.trim();
  return value ? value : undefined;
};

const getAblyApiKey = (env: RealtimeEnv) =>
  getEnvValue(env.ABLY_API_KEY, process.env.ABLY_API_KEY);

const getAblyRestUrl = (env: RealtimeEnv) =>
  (getEnvValue(env.ABLY_REST_URL, process.env.ABLY_REST_URL) ??
    "https://rest.ably.io")
    .replace(/\/+$/, "");

const getChannelPrefix = (env: RealtimeEnv) =>
  getEnvValue(env.ABLY_CHANNEL_PREFIX, process.env.ABLY_CHANNEL_PREFIX) ?? "";

const withChannelPrefix = (prefix: string, channel: string) =>
  prefix ? `${prefix}:${channel}` : channel;

const publishMessage = async (
  apiKey: string,
  baseUrl: string,
  channel: string,
  payload: AttemptRealtimePayload,
) => {
  const authToken = Buffer.from(apiKey).toString("base64");

  await fetch(`${baseUrl}/channels/${encodeURIComponent(channel)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        name: payload.event,
        data: payload,
      },
    ]),
  });
};

export const publishAttemptRealtimeUpdate = async (
  db: DbClient,
  env: RealtimeEnv,
  attemptId: string,
  event: AttemptRealtimeEventName,
  metadata?: Record<string, unknown>,
) => {
  const apiKey = getAblyApiKey(env);

  if (!apiKey) {
    return false;
  }

  const attempt = await db.query.attempts.findFirst({
    where: eq(schema.attempts.id, attemptId),
    columns: {
      id: true,
      startedAt: true,
      status: true,
      studentId: true,
      studentName: true,
      submittedAt: true,
      testId: true,
    },
  });

  if (!attempt) {
    return false;
  }

  const payload: AttemptRealtimePayload = {
    attemptId: attempt.id,
    event,
    metadata,
    occurredAt: new Date().toISOString(),
    startedAt: attempt.startedAt,
    status: attempt.status,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    submittedAt: attempt.submittedAt ?? null,
    testId: attempt.testId,
  };

  const baseUrl = getAblyRestUrl(env);
  const channelPrefix = getChannelPrefix(env);
  const channels = [
    withChannelPrefix(channelPrefix, "exam-monitoring"),
    withChannelPrefix(channelPrefix, `exam-monitoring:${attempt.testId}`),
  ];

  await Promise.allSettled(
    channels.map((channel) => publishMessage(apiKey, baseUrl, channel, payload)),
  );

  return true;
};
