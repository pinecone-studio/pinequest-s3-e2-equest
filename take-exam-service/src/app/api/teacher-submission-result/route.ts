import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { createDb } from "@/lib/db";
import { ensureExamSchema } from "@/lib/db/bootstrap";
import { publishAttemptRealtimeUpdate } from "@/lib/exam-service/realtime";
import {
  importTeacherCheckedAttempt,
  invalidateAttemptsSummaryCache,
  type TeacherCheckedAttemptPayload,
} from "@/lib/exam-service/store";

type RouteEnv = {
  AI?: {
    run: (
      model: string,
      input: {
        messages: Array<{ role: "system" | "user"; content: string }>;
        response_format?: { type: "json_object" };
      },
    ) => Promise<{ response?: string }>;
  };
  DB: D1Database;
  EXAM_CACHE?: KVNamespace;
  ABLY_API_KEY?: string;
  ABLY_CHANNEL_PREFIX?: string;
  ABLY_REST_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  TEACHER_RESULT_WEBHOOK_SECRET?: string;
};

const getEnv = () =>
  (getCloudflareContext() as unknown as { env: RouteEnv }).env;

const getGeminiApiKey = (env: RouteEnv) =>
  env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

const getGeminiModel = (env: RouteEnv) =>
  env.GEMINI_MODEL ?? process.env.GEMINI_MODEL;

const getOllamaApiKey = (env: RouteEnv) =>
  env.OLLAMA_API_KEY ?? process.env.OLLAMA_API_KEY;

const getOllamaBaseUrl = (env: RouteEnv) =>
  env.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL;

const getOllamaModel = (env: RouteEnv) =>
  env.OLLAMA_MODEL ?? process.env.OLLAMA_MODEL;

export async function POST(request: Request) {
  const env = getEnv();
  const expectedSecret = env.TEACHER_RESULT_WEBHOOK_SECRET?.trim();
  const receivedSecret =
    request.headers.get("x-teacher-result-secret")?.trim() ?? "";

  if (expectedSecret && receivedSecret !== expectedSecret) {
    return NextResponse.json(
      { message: "Teacher result secret буруу байна." },
      { status: 401 },
    );
  }

  try {
    const payload = (await request.json()) as TeacherCheckedAttemptPayload;
    const db = createDb(env.DB);
    await ensureExamSchema(env.DB);

    const result = await importTeacherCheckedAttempt(db, payload, {
      ai: env.AI,
      geminiApiKey: getGeminiApiKey(env),
      geminiModel: getGeminiModel(env),
      kv: env.EXAM_CACHE,
      ollamaApiKey: getOllamaApiKey(env),
      ollamaBaseUrl: getOllamaBaseUrl(env),
      ollamaModel: getOllamaModel(env),
    });
    await invalidateAttemptsSummaryCache(env.EXAM_CACHE);
    await publishAttemptRealtimeUpdate(
      db,
      env,
      payload.attemptId,
      "attempt.approved",
      {
        source: "teacher-submission-result",
      },
    );

    return NextResponse.json(result, {
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
            : "Teacher result import дээр алдаа гарлаа.",
      },
      { status: 400 },
    );
  }
}
