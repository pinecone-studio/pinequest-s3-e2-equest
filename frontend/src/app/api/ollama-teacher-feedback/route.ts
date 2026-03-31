import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type AttemptPayload = {
  attemptId: string;
  studentName: string;
  title: string;
  status: string;
  startedAt: string;
  submittedAt?: string | null;
  criteria?: {
    subject?: string;
    topic?: string;
    difficulty?: string;
    questionCount?: number;
  } | null;
  monitoring?: {
    infoCount?: number;
    totalEvents?: number;
    warningCount?: number;
    dangerCount?: number;
    recentEvents?: Array<{
      code?: string | null;
      detail?: string | null;
      occurredAt?: string | null;
      severity?: string | null;
      title?: string | null;
    }>;
  } | null;
  result?: {
    score: number;
    maxScore: number;
    percentage: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    questionResults?: Array<{
      prompt: string;
      competency: string;
      isCorrect: boolean;
      pointsAwarded: number;
      maxPoints: number;
      explanation?: string | null;
      dwellMs?: number | null;
      answerChangeCount?: number | null;
    }>;
  } | null;
  answerReview?: Array<{
    prompt: string;
    competency: string;
    questionType: string;
    selectedOptionId?: string | null;
    selectedAnswerText?: string | null;
    points: number;
    responseGuide?: string | null;
    dwellMs?: number | null;
    answerChangeCount?: number | null;
  }> | null;
};

type OllamaTeacherFeedback = {
  headline: string;
  summary: string;
  strengths: string[];
  risks: string[];
  interventions: string[];
};

type RouteEnv = {
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
};

const getRouteEnv = () =>
  ((getCloudflareContext() as unknown as { env?: RouteEnv }).env ?? {}) as RouteEnv;

const getEnvValue = (primary?: string, fallback?: string) => {
  const value = primary?.trim() || fallback?.trim();
  return value ? value : undefined;
};

const normalizeBaseUrl = (value?: string) =>
  (value ?? "http://127.0.0.1:11434").replace(/\/+$/, "");

const buildOllamaHeaders = (apiKey?: string) => ({
  "Content-Type": "application/json",
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

async function fetchOllamaStatus(baseUrl: string, model: string, apiKey?: string) {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: buildOllamaHeaders(apiKey),
    });

    const rawText = await response.text();
    const trimmedText = rawText.trim();
    let payload: {
      error?: string;
      models?: Array<{ name?: string | null }>;
    } | null = null;

    if (trimmedText) {
      try {
        payload = JSON.parse(trimmedText) as {
          error?: string;
          models?: Array<{ name?: string | null }>;
        };
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      return {
        baseUrl,
        error:
          response.status === 1016
            ? "Ollama upstream host олдсонгүй (Cloudflare 1016)."
            : `Ollama JSON биш хариу буцаалаа (${response.status}).`,
        hasApiKey: Boolean(apiKey),
        lastCheckedAt: checkedAt,
        model,
        modelAvailable: false,
        models: [],
        reachable: false,
        remote: !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost"),
      };
    }

    const models = (payload.models ?? [])
      .map((item) => item.name?.trim())
      .filter((value): value is string => Boolean(value));

    if (!response.ok || payload.error) {
      return {
        baseUrl,
        error:
          payload.error ??
          `Ollama status авахад алдаа гарлаа (${response.status}).`,
        hasApiKey: Boolean(apiKey),
        lastCheckedAt: checkedAt,
        model,
        modelAvailable: false,
        models,
        reachable: false,
        remote: !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost"),
      };
    }

    return {
      baseUrl,
      hasApiKey: Boolean(apiKey),
      lastCheckedAt: checkedAt,
      model,
      modelAvailable: models.some((item) => item === model || item.startsWith(`${model}:`)),
      models,
      reachable: true,
      remote: !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost"),
    };
  } catch (error) {
    return {
      baseUrl,
      error:
        error instanceof Error ? error.message : "Ollama status шалгаж чадсангүй.",
      hasApiKey: Boolean(apiKey),
      lastCheckedAt: checkedAt,
      model,
      modelAvailable: false,
      models: [],
      reachable: false,
      remote: !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost"),
    };
  }
}

function summarizeTopItems(items: string[], emptyText: string) {
  if (items.length === 0) {
    return emptyText;
  }

  return items.slice(0, 2).join(", ");
}

function buildBehaviorSummary(attempt: AttemptPayload) {
  const recentEvents = attempt.monitoring?.recentEvents ?? [];
  const recentCodes = recentEvents.map((item) => item.code?.trim() ?? "");
  const revisitCount = recentCodes.filter((code) => code === "question-revisit").length;
  const revisionCount = recentCodes.filter((code) => code === "answer-revised").length;
  const idleCount = recentCodes.filter((code) => code.startsWith("idle-")).length;
  const focusLossCount = recentCodes.filter(
    (code) =>
      code === "visibility-hidden" ||
      code === "window-blur" ||
      code === "window-focus-return" ||
      code === "visibility-return",
  ).length;
  const flaggedCount = recentCodes.filter((code) => code === "question-flagged").length;

  const behaviorHighlights = [
    revisitCount > 0 ? `${revisitCount} revisit signal` : null,
    revisionCount > 0 ? `${revisionCount} revision signal` : null,
    idleCount > 0 ? `${idleCount} idle signal` : null,
    focusLossCount > 0 ? `${focusLossCount} focus shift signal` : null,
    flaggedCount > 0 ? `${flaggedCount} flagged question` : null,
  ].filter((item): item is string => Boolean(item));

  const latestTimeline = recentEvents
    .slice(0, 5)
    .map((item) => `${item.title ?? "Event"}: ${item.detail ?? ""}`)
    .filter(Boolean);

  return {
    behaviorHighlights,
    flaggedCount,
    focusLossCount,
    idleCount,
    latestTimeline,
    revisitCount,
    revisionCount,
  };
}

function buildFallbackFeedback(attempt: AttemptPayload): OllamaTeacherFeedback {
  const result = attempt.result;
  const answerReview = attempt.answerReview ?? [];
  const behaviorSummary = buildBehaviorSummary(attempt);
  const questionResults = result?.questionResults ?? [];
  const fallbackQuestions =
    questionResults.length > 0
      ? questionResults
      : answerReview.map((item) => ({
          answerChangeCount: item.answerChangeCount ?? 0,
          competency: item.competency,
          dwellMs: item.dwellMs ?? 0,
          isCorrect: false,
          maxPoints: item.points,
          pointsAwarded: 0,
          prompt: item.prompt,
        }));
  const missedQuestions = questionResults.filter((item) => !item.isCorrect);
  const slowQuestions = [...fallbackQuestions]
    .filter((item) => typeof item.dwellMs === "number" && (item.dwellMs ?? 0) > 0)
    .sort((left, right) => (right.dwellMs ?? 0) - (left.dwellMs ?? 0))
    .slice(0, 2);
  const changedQuestions = [...fallbackQuestions]
    .filter(
      (item) =>
        typeof item.answerChangeCount === "number" &&
        (item.answerChangeCount ?? 0) > 0,
    )
    .sort(
      (left, right) =>
        (right.answerChangeCount ?? 0) - (left.answerChangeCount ?? 0),
    )
    .slice(0, 2);

  const missedTopics = Array.from(
    new Set(
      missedQuestions
        .map((item) => item.competency?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const scoreText = result
    ? `${result.score}/${result.maxScore} (${result.percentage}%)`
    : "дүн хараахан батлагдаагүй";
  const monitoringText = attempt.monitoring
    ? `info ${attempt.monitoring.infoCount ?? 0}, warning ${attempt.monitoring.warningCount ?? 0}, danger ${attempt.monitoring.dangerCount ?? 0}`
    : "monitoring event бүртгэгдээгүй";

  return {
    headline: `${attempt.studentName} - ${scoreText}`,
    summary: `${attempt.title} дээр ${scoreText} үзүүлэлттэй байна. ${
      result
        ? `Анхаарах competency: ${summarizeTopItems(missedTopics, "тод ялгарах сул сэдэв алга")}.`
        : `Teacher-side result ирээгүй байна. Гэхдээ ${answerReview.length} асуултын өгсөн хариу, dwell time, answer change дээр тулгуурласан урьдчилсан analysis гаргав.`
    } Monitoring: ${monitoringText}. Behavior: ${summarizeTopItems(
      behaviorSummary.behaviorHighlights,
      "тод behavioral signal бага байна",
    )}.`,
    strengths: [
      result && result.correctCount > 0
        ? `${result.correctCount} асуултад зөв хариулсан.`
        : "Оролдлого бүртгэгдсэн бөгөөд цаашид result-тай уялдуулж шинэчилж болно.",
      attempt.criteria?.topic
        ? `Шалгалтын сэдэв: ${attempt.criteria.topic}.`
        : "Шалгалтын сэдвийн мэдээлэл dashboard дээр бүртгэгдсэн.",
      slowQuestions.length > 0
        ? `Хамгийн удаан саатсан асуултууд: ${slowQuestions
            .map((item) => item.prompt)
            .join(", ")}.`
        : "Timing data дээр ноцтой саатал илрээгүй.",
    ].slice(0, 3),
    risks: [
      missedTopics.length > 0
        ? `Анхаарах competency: ${summarizeTopItems(missedTopics, "")}.`
        : "Алдсан асуултын competency цөөн эсвэл жигд тархсан байна.",
      changedQuestions.length > 0
        ? `Олон өөрчилсөн асуултууд: ${changedQuestions
            .map((item) => item.prompt)
            .join(", ")}.`
        : "Хариултаа олон давтамжаар өөрчилсөн асуулт бага байна.",
      behaviorSummary.focusLossCount > 0
        ? `Фокус тасалдсан эсвэл tab сольсон ${behaviorSummary.focusLossCount} signal байна.`
        : "Фокус тогтвортой байсан signal давамгай.",
      result && result.unansweredCount > 0
        ? `${result.unansweredCount} асуулт хоосон үлдсэн байна.`
        : "Хоосон үлдсэн асуулт ажиглагдсангүй.",
    ].slice(0, 3),
    interventions: [
      missedTopics.length > 0
        ? `${summarizeTopItems(missedTopics, "Сэдвийн")} дээр богино давтлага, жишиг бодлого ажиллуулах.`
        : "Алдсан асуултуудын тайлбарыг нэг бүрчлэн ярилцаж бататгах.",
      slowQuestions.length > 0
        ? `Удаан саатсан ${slowQuestions.length} асуултын бодолтын алхмыг задлуулж ажиллуулах.`
        : "Цагийн менежментийн богино дасгал ажиллуулах.",
      changedQuestions.length > 0 || behaviorSummary.revisionCount > 0
        ? "Эргэлзээтэй асуултууд дээр сонголтоо баталгаажуулах шалгах checklist ашиглуулах."
        : "Зөв бодолт баталгаажуулах алхамтай ажлын хуудас өгөх.",
    ].slice(0, 3),
  };
}

function cleanJsonBlock(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return trimmed;
}

function buildPrompt(attempt: AttemptPayload) {
  const behaviorSummary = buildBehaviorSummary(attempt);

  return `
Та Монгол хэл дээр багшид зориулсан шалгалтын задлан feedback үүсгэнэ.
Зөвхөн JSON буцаа.

JSON бүтэц:
{
  "headline": "string",
  "summary": "string",
  "strengths": ["string"],
  "risks": ["string"],
  "interventions": ["string"]
}

Дүрэм:
- strengths, risks, interventions нь тус бүр 2-4 богино мөр байна.
- risks хэсэгт аль сэдэв/competency дээр анхаарахыг тодорхой бич.
- interventions хэсэгт багшид өгөх практик дараагийн алхмуудыг бич.
- Хэрэв questionResults байгаа бол хамгийн их алдсан, хамгийн удаан саатсан, хамгийн олон өөрчилсөн асуултын хэв шинжийг дүгнэ.
- Хэрэв monitoring recentEvents байгаа бол focus shift, idle, revisit, answer revision signal-уудыг ашиглаж cheating risk ба hesitation pattern-ийг бодитой тайлбарла.
- Хэт ерөнхий магтаал бүү өг. Бодит өгөгдөлд тулгуурла.

Behavior summary:
${JSON.stringify(behaviorSummary, null, 2)}

Attempt өгөгдөл:
${JSON.stringify(attempt, null, 2)}
`.trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { attempt?: AttemptPayload };
    const attempt = body.attempt;

    if (!attempt) {
      return NextResponse.json(
        { error: "attempt payload шаардлагатай." },
        { status: 400 },
      );
    }

    const env = getRouteEnv();
    const model = getEnvValue(env.OLLAMA_MODEL, process.env.OLLAMA_MODEL) ?? "llama3.1";
    const baseUrl = normalizeBaseUrl(
      getEnvValue(env.OLLAMA_BASE_URL, process.env.OLLAMA_BASE_URL),
    );
    const apiKey = getEnvValue(env.OLLAMA_API_KEY, process.env.OLLAMA_API_KEY);
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: buildOllamaHeaders(apiKey),
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          messages: [
            {
              role: "system",
              content:
                "Та багшид зориулсан шалгалтын аналитик feedback-ийг зөвхөн JSON хэлбэрээр буцаана.",
            },
            {
              role: "user",
              content: buildPrompt(attempt),
            },
          ],
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: {
          content?: string;
        };
      };

      if (!response.ok || payload.error || !payload.message?.content) {
        throw new Error(
          payload.error ??
            "Ollama-с teacher feedback авч чадсангүй. `ollama run llama3.1` ажиллаж байгаа эсэхийг шалгана уу.",
        );
      }

      const feedback = JSON.parse(
        cleanJsonBlock(payload.message.content),
      ) as OllamaTeacherFeedback;

      return NextResponse.json({
        feedback,
        ollama: {
          baseUrl,
          hasApiKey: Boolean(apiKey),
          model,
          reachable: true,
          remote: !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost"),
        },
        provider: "ollama",
      });
    } catch (ollamaError) {
      const feedback = buildFallbackFeedback(attempt);
      const message =
        ollamaError instanceof Error
          ? ollamaError.message
          : "Ollama unavailable";

      return NextResponse.json(
        {
          feedback,
          provider: "fallback",
          warning: `Ollama холбогдсонгүй, fallback analysis ашиглалаа: ${message}`,
          ollama: {
            baseUrl,
            model,
            remote: !baseUrl.includes("127.0.0.1") && !baseUrl.includes("localhost"),
          },
        },
        { status: 200 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ollama teacher feedback route дээр алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const env = getRouteEnv();
  const model = getEnvValue(env.OLLAMA_MODEL, process.env.OLLAMA_MODEL) ?? "llama3.1";
  const baseUrl = normalizeBaseUrl(
    getEnvValue(env.OLLAMA_BASE_URL, process.env.OLLAMA_BASE_URL),
  );
  const apiKey = getEnvValue(env.OLLAMA_API_KEY, process.env.OLLAMA_API_KEY);
  const status = await fetchOllamaStatus(baseUrl, model, apiKey);

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
