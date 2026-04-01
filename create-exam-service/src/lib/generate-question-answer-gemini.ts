import { GoogleGenerativeAI } from "@google/generative-ai";

import { classifyGeminiError } from "./ai";

const DEFAULT_MODEL_CANDIDATES = [
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
] as const;

type GenerateQuestionAnswerInput = {
  prompt: string;
  points?: number | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  format?:
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "MATCHING"
    | "FILL_IN"
    | "WRITTEN"
    | null;
};

const SYSTEM_INSTRUCTION = `
Чи бол Монголын сургуулийн шалгалтын асуултын хариулт боловсруулагч AI.
ЗӨВХӨН нэг JSON object буцаа. Markdown, code fence, нэмэлт тайлбар бүү бич.

JSON талбарууд:
- questionText: хэрэглэгчийн өгсөн асуултыг цэвэрлэж буцаана
- format: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "MATCHING" | "FILL_IN" | "WRITTEN"
- difficulty: "EASY" | "MEDIUM" | "HARD"
- points: эерэг бүхэл тоо
- options: сонголттой асуулт бол боломжит хариултуудын массив, үгүй бол []
- correctAnswer: зөв хариулт
- explanation: зөв хариу болон бодолтын тайлбар

Дүрэм:
- SINGLE_CHOICE бол яг 4 өөр сонголт өг.
- WRITTEN бол options-ийг хоосон массив [] болго.
- Хэрэв хэрэглэгч points, difficulty, format өгсөн бол яг баримтал.
- Хэрэв өгөөгүй бол асуултын агуулгад тулгуурлан өөрөө хамгийн тохирох points, difficulty, format-ийг шийд.
- explanation нь монголоор, ойлгомжтой, алхамтай байна.
`.trim();

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

export async function generateQuestionAnswerWithGemini(
  apiKey: string,
  input: GenerateQuestionAnswerInput,
  opts?: { model?: string },
): Promise<Record<string, unknown>> {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error("GOOGLE_AI_API_KEY эсвэл GEMINI_API_KEY тохируулаагүй байна.");
  }

  const preferred =
    (opts?.model && opts.model.trim()) ||
    (typeof process !== "undefined" && process.env?.GEMINI_ANALYZE_MODEL?.trim()) ||
    "";

  const candidates = Array.from(
    new Set(
      [...(preferred ? [preferred] : []), ...DEFAULT_MODEL_CANDIDATES].filter(Boolean),
    ),
  );

  const genAI = new GoogleGenerativeAI(key);
  const constraints = [
    input.format ? `- format: ${input.format}` : "- format: өөрөө тохируулж сонго",
    input.difficulty
      ? `- difficulty: ${input.difficulty}`
      : "- difficulty: өөрөө тохируулж сонго",
    typeof input.points === "number" && Number.isFinite(input.points)
      ? `- points: ${input.points}`
      : "- points: өөрөө тохируулж сонго",
  ].join("\n");

  const userContent = `Асуулт: ${input.prompt.trim()}

Шаардлага:
${constraints}

Энэ асуултад тохирох зөв хариу, сонголтууд (шаардлагатай бол), бодолтын тайлбарыг JSON object хэлбэрээр буцаа.`;

  let lastErr: unknown = null;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
      });
      const result = await model.generateContent(userContent);
      const text = result.response.text()?.trim();
      if (!text) {
        throw new Error("Gemini хариу хоосон байна.");
      }
      return JSON.parse(extractJsonText(text)) as Record<string, unknown>;
    } catch (e) {
      lastErr = e;
      if (e instanceof SyntaxError) {
        throw new Error("Gemini-ийн хариу JSON болж задрахгүй байна.");
      }
      const info = classifyGeminiError(e);
      if (info.kind === "model") {
        continue;
      }
      throw new Error(info.userMessage);
    }
  }

  const info = classifyGeminiError(lastErr);
  throw new Error(info.userMessage);
}
