import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type FocusAnalysisRequest = {
  attempts: Array<{
    answerReview?: Array<{
      competency?: string | null;
      prompt: string;
      questionId: string;
    }> | null;
    result?: {
      questionResults: Array<{
        competency?: string | null;
        isCorrect: boolean;
        maxPoints: number;
        pointsAwarded: number;
        prompt?: string | null;
        questionId: string;
        selectedOptionId?: string | null;
      }>;
    } | null;
    studentId: string;
    studentName: string;
  }>;
  exam: {
    id: string;
    subject: string;
    title: string;
    topic: string;
  };
  testMaterial?: {
    questions: Array<{
      competency?: string | null;
      points: number;
      prompt: string;
      questionId: string;
      type: string;
    }>;
  } | null;
};

type FocusAnalysisResponse = {
  areas: Array<{
    affectedStudents?: number;
    avgScore: number;
    insight?: string;
    topic: string;
  }>;
  generatedAt: string;
  model?: string;
  source: "fallback" | "gemini" | "ollama";
  summary?: string;
};

type RouteEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
};

type TopicAggregate = {
  affectedStudentIds: Set<string>;
  earnedPoints: number;
  incorrectCount: number;
  maxPoints: number;
  prompts: string[];
  questionCount: number;
  unansweredCount: number;
};

const DEFAULT_OLLAMA_MODEL = "llama3.1:latest";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

const getRouteEnv = () =>
  ((getCloudflareContext() as unknown as { env?: RouteEnv }).env ?? {}) as RouteEnv;

const getEnvValue = (primary?: string, fallback?: string) => {
  const value = primary?.trim() || fallback?.trim();
  return value ? value : undefined;
};

const normalizeBaseUrl = (value?: string) =>
  (value ?? "http://127.0.0.1:11434").replace(/\/+$/, "");

const safeJsonParse = (value: string): FocusAnalysisResponse | null => {
  try {
    const parsed = JSON.parse(value) as Partial<FocusAnalysisResponse>;
    if (!Array.isArray(parsed.areas)) {
      return null;
    }

    const areas = parsed.areas
      .filter(
        (
          area,
        ): area is {
          affectedStudents?: number;
          avgScore: number;
          insight?: string;
          topic: string;
        } =>
          Boolean(area) &&
          typeof area.topic === "string" &&
          typeof area.avgScore === "number",
      )
      .map((area) => ({
        topic: area.topic.trim(),
        avgScore: Math.max(0, Math.min(100, Math.round(area.avgScore))),
        insight:
          typeof area.insight === "string" && area.insight.trim().length > 0
            ? area.insight.trim()
            : undefined,
        affectedStudents:
          typeof area.affectedStudents === "number"
            ? Math.max(0, Math.round(area.affectedStudents))
            : undefined,
      }))
      .filter((area) => area.topic.length > 0)
      .slice(0, 4);

    return {
      areas,
      generatedAt:
        typeof parsed.generatedAt === "string"
          ? parsed.generatedAt
          : new Date().toISOString(),
      model:
        typeof parsed.model === "string" && parsed.model.trim().length > 0
          ? parsed.model.trim()
          : undefined,
      source:
        parsed.source === "ollama"
          ? "ollama"
          : parsed.source === "gemini"
            ? "gemini"
            : "fallback",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : undefined,
    };
  } catch {
    return null;
  }
};

const uniquePrompts = (prompts: string[]) =>
  [...new Set(prompts.map((item) => item.trim()).filter(Boolean))];

const buildFallbackInsight = (topic: string, aggregate: TopicAggregate) => {
  const promptSnippet = uniquePrompts(aggregate.prompts)[0];
  const studentCount = aggregate.affectedStudentIds.size;

  if (promptSnippet) {
    return `${studentCount} сурагч энэ сэдэв дээр оноо алдсан. Гол алдаа гарсан асуулт: ${promptSnippet}`;
  }

  return `${studentCount} сурагч ${topic} сэдэв дээр оноо алдсан байна.`;
};

const buildFallbackResponse = (
  exam: FocusAnalysisRequest["exam"],
  aggregates: Map<string, TopicAggregate>,
): FocusAnalysisResponse => {
  const areas = [...aggregates.entries()]
    .map(([topic, aggregate]) => ({
      topic,
      avgScore:
        aggregate.maxPoints > 0
          ? Math.round((aggregate.earnedPoints / aggregate.maxPoints) * 100)
          : 0,
      affectedStudents: aggregate.affectedStudentIds.size,
      insight: buildFallbackInsight(topic, aggregate),
    }))
    .sort((left, right) => left.avgScore - right.avgScore)
    .slice(0, 4);

  const summary =
    areas.length > 0
      ? `${exam.title} дээр хамгийн их алдаа гарч буй сэдвүүдийг онооны бууралтаар эрэмбэллээ.`
      : `${exam.title} дээр AI шинжилгээ хийхэд хангалттай дүнтэй асуултын data хараахан үүсээгүй байна.`;

  return {
    areas,
    generatedAt: new Date().toISOString(),
    source: "fallback",
    summary,
  };
};

const buildAggregates = (body: FocusAnalysisRequest) => {
  const materialQuestionsById = new Map(
    (body.testMaterial?.questions ?? []).map((question) => [
      question.questionId,
      question,
    ] as const),
  );
  const aggregates = new Map<string, TopicAggregate>();

  for (const attempt of body.attempts) {
    const answerReviewById = new Map(
      (attempt.answerReview ?? []).map((item) => [item.questionId, item] as const),
    );

    for (const question of attempt.result?.questionResults ?? []) {
      const materialQuestion = materialQuestionsById.get(question.questionId);
      const answerReview = answerReviewById.get(question.questionId);
      const topic =
        question.competency?.trim() ||
        answerReview?.competency?.trim() ||
        materialQuestion?.competency?.trim() ||
        body.exam.topic ||
        materialQuestion?.type ||
        "Тодорхойгүй";

      const current = aggregates.get(topic) ?? {
        affectedStudentIds: new Set<string>(),
        earnedPoints: 0,
        incorrectCount: 0,
        maxPoints: 0,
        prompts: [],
        questionCount: 0,
        unansweredCount: 0,
      };

      current.earnedPoints += question.pointsAwarded;
      current.maxPoints += question.maxPoints;
      current.questionCount += 1;

      if (!question.isCorrect || question.pointsAwarded < question.maxPoints) {
        current.affectedStudentIds.add(attempt.studentId);
        current.incorrectCount += question.selectedOptionId ? 1 : 0;
        current.unansweredCount += question.selectedOptionId ? 0 : 1;
        current.prompts.push(
          question.prompt?.trim() ||
            answerReview?.prompt?.trim() ||
            materialQuestion?.prompt?.trim() ||
            "",
        );
      }

      aggregates.set(topic, current);
    }
  }

  return aggregates;
};

const buildOllamaPrompt = (
  exam: FocusAnalysisRequest["exam"],
  fallback: FocusAnalysisResponse,
) =>
  JSON.stringify({
    exam,
    fallback,
    instruction:
      "Монгол хэлээр summary болон areas JSON буцаа. areas нь хамгийн сул 4 хүртэл competency/topic байна. insight нь яг ямар төрлийн алдаа давамгай байгааг 1 өгүүлбэрээр тайлбарла.",
  });

const generateOllamaAnalysis = async (
  body: FocusAnalysisRequest,
  fallback: FocusAnalysisResponse,
) => {
  const env = getRouteEnv();
  const ollamaApiKey = getEnvValue(
    env.OLLAMA_API_KEY,
    process.env.OLLAMA_API_KEY,
  );
  const ollamaBaseUrl = normalizeBaseUrl(
    getEnvValue(env.OLLAMA_BASE_URL, process.env.OLLAMA_BASE_URL),
  );
  const model =
    getEnvValue(env.OLLAMA_MODEL, process.env.OLLAMA_MODEL) ??
    DEFAULT_OLLAMA_MODEL;

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ollamaApiKey ? { Authorization: `Bearer ${ollamaApiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content:
            "Та шалгалтын аналитикийн туслах. Зөвхөн JSON буцаана. summary, areas гэсэн key ашигла. areas дотор topic, avgScore, affectedStudents, insight байна.",
        },
        {
          role: "user",
          content: buildOllamaPrompt(body.exam, fallback),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama analysis failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: string;
    message?: { content?: string };
    response?: string;
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  const content = payload.message?.content ?? payload.response;
  const parsed = content ? safeJsonParse(content) : null;

  if (!parsed) {
    throw new Error("Ollama analysis JSON parse хийж чадсангүй.");
  }

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
    model,
    source: "ollama" as const,
  };
};

const generateGeminiAnalysis = async (
  body: FocusAnalysisRequest,
  fallback: FocusAnalysisResponse,
) => {
  const env = getRouteEnv();
  const apiKey = getEnvValue(env.GEMINI_API_KEY, process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return null;
  }

  const model =
    getEnvValue(env.GEMINI_MODEL, process.env.GEMINI_MODEL) ??
    DEFAULT_GEMINI_MODEL;

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "Та шалгалтын аналитикийн туслах. Зөвхөн JSON буцаана. summary, areas гэсэн key ашигла. areas дотор topic, avgScore, affectedStudents, insight байна.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildOllamaPrompt(body.exam, fallback),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    },
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ??
        `Gemini analysis failed with status ${response.status}`,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  const parsed = text ? safeJsonParse(text) : null;

  if (!parsed) {
    throw new Error("Gemini analysis JSON parse хийж чадсангүй.");
  }

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
    model,
    source: "gemini" as const,
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FocusAnalysisRequest;

    if (!body.exam?.id) {
      return NextResponse.json(
        { message: "testId байхгүй байна." },
        { status: 400 },
      );
    }

    const aggregates = buildAggregates(body);
    const fallback = buildFallbackResponse(body.exam, aggregates);

    if (aggregates.size === 0) {
      return NextResponse.json(fallback);
    }

    try {
      const aiAnalysis = await generateOllamaAnalysis(body, fallback);
      return NextResponse.json(aiAnalysis, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      try {
        const geminiAnalysis = await generateGeminiAnalysis(body, fallback);
        if (geminiAnalysis) {
          return NextResponse.json(geminiAnalysis, {
            headers: { "Cache-Control": "no-store" },
          });
        }
      } catch {
        // Fall back below.
      }

      return NextResponse.json(fallback, {
        headers: { "Cache-Control": "no-store" },
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        areas: [],
        generatedAt: new Date().toISOString(),
        message:
          error instanceof Error
            ? error.message
            : "AI focus analysis үүсгэж чадсангүй.",
        source: "fallback",
      },
      { status: 500 },
    );
  }
}
