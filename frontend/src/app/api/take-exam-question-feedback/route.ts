import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type RequestBody = {
  competency?: string | null;
  correctAnswer?: string | null;
  questionText: string;
  questionType?: string | null;
  studentAnswer?: string | null;
};

type ResponseBody = {
  feedback: string;
  model?: string;
  source: "fallback" | "gemini" | "ollama";
};

type RouteEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
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

const safeJsonParse = (value: string): ResponseBody | null => {
  try {
    const parsed = JSON.parse(value) as Partial<ResponseBody>;
    if (typeof parsed.feedback !== "string" || parsed.feedback.trim().length === 0) {
      return null;
    }

    return {
      feedback: parsed.feedback.trim(),
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
    };
  } catch {
    return null;
  }
};

const parseNumericValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, ".").replace(/\s+/g, "");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractSimpleSubtraction = (questionText: string) => {
  const compact = questionText
    .replace(/\s+/g, " ")
    .replace(/[=?:]+/g, " ")
    .replace(/[^\d+\- ]/g, " ");
  const match = compact.match(/(^| )(-?\d+)\s*-\s*(-?\d+)( |$)/);
  if (!match) {
    return null;
  }

  const left = Number(match[2]);
  const right = Number(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return { left, right, result: left - right };
};

const buildHeuristicFeedback = (body: RequestBody) => {
  const questionText = body.questionText.trim();
  const studentAnswer = body.studentAnswer?.trim();
  const correctAnswer = body.correctAnswer?.trim();
  const competency = body.competency?.trim();
  const studentNumeric = parseNumericValue(studentAnswer);
  const correctNumeric = parseNumericValue(correctAnswer);
  const subtraction = extractSimpleSubtraction(questionText);

  if (
    subtraction &&
    studentNumeric !== null &&
    correctNumeric !== null &&
    studentNumeric !== correctNumeric &&
    subtraction.left < subtraction.right &&
    correctNumeric < 0 &&
    studentNumeric >= 0
  ) {
    return `Та ${subtraction.left}-${subtraction.right} үйлдлийг ${studentAnswer} гэж хариулсан байна. Бага тооноос их тоог хасахад хариу сөрөг тэмдэгтэй гардгийг анзаараагүй байна. ${correctAnswer} гэж гарах шалтгааныг тооны шулуун дээр дүрслээд, сөрөг тооны хасалтын 2-3 жишээг дахин бодоорой.`;
  }

  if (
    questionText.match(/(∫|\\int|integral|интеграл)/i) &&
    correctAnswer?.includes("+ C") &&
    studentAnswer &&
    !studentAnswer.includes("+ C")
  ) {
    return `Та интегралын үндсэн илэрхийллээ зөв олсон ч интегралын тогтмол болох +C-г орхигдуулсан байна. Интеграл бодох бүрдээ эцсийн хариундаа +C заавал нэмдэг дүрмээ давтаж, ижил төрлийн 2 жишээ дээр дахин баталгаажуулаарай.`;
  }

  if (studentAnswer && correctAnswer) {
    const topicHint = competency
      ? `${competency} сэдвийн дүрэм,`
      : body.questionType === "math"
        ? "энэ бодлогын суурь дүрэм,"
        : "энэ асуултын гол ойлголт,";

    return `Таны хариулт "${studentAnswer}" байсан ч зөв хариулт нь "${correctAnswer}" байна. ${topicHint} бодолтын алхмуудаа мөр мөрөөр нь шалгаж, яг аль алхам дээр зөрсөнөө тэмдэглээд дахин нэг ижил төстэй дасгал ажиллаарай.`;
  }

  return null;
};

const buildFallbackFeedback = (body: RequestBody) => {
  const heuristicFeedback = buildHeuristicFeedback(body);
  if (heuristicFeedback) {
    return heuristicFeedback;
  }

  const studentAnswer = body.studentAnswer?.trim();
  const correctAnswer = body.correctAnswer?.trim();
  const competency = body.competency?.trim();

  const lead = studentAnswer
    ? correctAnswer
      ? `Таны хариулт "${studentAnswer}" байсан ч зөв хариулт нь "${correctAnswer}" байна.`
      : `Таны хариулт "${studentAnswer}" дээр үндсэн алхмаа дахин шалгах хэрэгтэй байна.`
    : correctAnswer
      ? `Энэ асуултад хариулаагүй байна. Зөв хариулт нь "${correctAnswer}" юм.`
      : "Энэ асуултад өгөх хариултаа дахин нэг нягталж бодоорой.";

  const concept =
    competency && competency.length > 0
      ? `${competency} сэдвийн`
      : body.questionType === "math"
        ? "энэ төрлийн математикийн"
        : "энэ агуулгын";

  return `${lead} Гол алдаа нь ${concept} суурь ойлголт болон бодолтын дараалал дээр байна. Ижил төрлийн 2-3 жишээ бодлого дахин ажиллаж, яагаад ийм хариу гарах ёстойг алхам бүрээр нь тайлбарлаж давтаарай.`;
};

const buildPrompt = (body: RequestBody) =>
  JSON.stringify({
    instruction:
      "feedback гэсэн ганц key-тэй JSON буцаа. feedback нь монгол хэлээр 2-4 өгүүлбэртэй байна. Асуултыг, сурагчийн өгсөн хариултыг, зөв хариуг харьцуулж яг ямар ойлголт эсвэл алхам дээр алдсаныг тодорхой тайлбарла. Ерөнхий үг бүү хэрэглэ. Боломжтой бол яагаад тэр зөв хариу гарах ёстойг 1 богино логикоор тайлбарла. Эцэст нь ямар сэдэв эсвэл дүрмийг давтах ёстойг хэл.",
    payload: {
      competency: body.competency ?? null,
      correctAnswer: body.correctAnswer ?? null,
      questionText: body.questionText,
      questionType: body.questionType ?? null,
      studentAnswer: body.studentAnswer ?? null,
    },
  });

const generateOllamaFeedback = async (
  body: RequestBody,
  env: RouteEnv,
): Promise<ResponseBody | null> => {
  const baseUrl = getEnvValue(env.OLLAMA_BASE_URL, process.env.OLLAMA_BASE_URL);
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.OLLAMA_API_KEY || process.env.OLLAMA_API_KEY
        ? {
            Authorization: `Bearer ${
              env.OLLAMA_API_KEY ?? process.env.OLLAMA_API_KEY
            }`,
          }
        : {}),
    },
    body: JSON.stringify({
      model: getEnvValue(env.OLLAMA_MODEL, process.env.OLLAMA_MODEL) ??
        DEFAULT_OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content:
            "Та сурагчийн буруу хариултад зориулсан монгол хэлний богино тайлбар JSON үүсгэнэ.",
        },
        {
          role: "user",
          content: buildPrompt(body),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama feedback failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: string;
    message?: { content?: string };
    response?: string;
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  const parsed = safeJsonParse(payload.message?.content ?? payload.response ?? "");
  return parsed
    ? {
        ...parsed,
        model:
          parsed.model ??
          getEnvValue(env.OLLAMA_MODEL, process.env.OLLAMA_MODEL) ??
          DEFAULT_OLLAMA_MODEL,
        source: "ollama",
      }
    : null;
};

const generateGeminiFeedback = async (
  body: RequestBody,
  env: RouteEnv,
): Promise<ResponseBody | null> => {
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
                "Та сурагчийн буруу хариултад зориулсан монгол хэлний богино тайлбар JSON үүсгэнэ.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(body) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini feedback failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const parsed = safeJsonParse(
    payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
  );

  return parsed
    ? {
        ...parsed,
        model: parsed.model ?? model,
        source: "gemini",
      }
    : null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!body.questionText?.trim()) {
      return NextResponse.json(
        { message: "questionText шаардлагатай." },
        { status: 400 },
      );
    }

    const env = getRouteEnv();

    try {
      const ollama = await generateOllamaFeedback(body, env);
      if (ollama) {
        return NextResponse.json(ollama, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Try next provider.
    }

    try {
      const gemini = await generateGeminiFeedback(body, env);
      if (gemini) {
        return NextResponse.json(gemini, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Fall through to deterministic feedback.
    }

    return NextResponse.json(
      {
        feedback: buildFallbackFeedback(body),
        source: "fallback",
      } satisfies ResponseBody,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "AI тайлбар бэлдэх үед алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
