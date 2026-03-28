/**
 * `analyzeQuestion` mutation: Cloudflare **Workers AI** (`ctx.env.AI`, `wrangler.jsonc` → `ai.binding`).
 * Модель: `@cf/meta/llama-3-8b-instruct`. **Google Gemini / GEMINI_API_KEY энд ашиглагдахгүй**
 * — зөвхөн `generateExamQuestions` (`src/lib/ai.ts`) нь Gemini API руу явдаг.
 */
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../context";
import {
  Difficulty,
  QuestionAnalysisSuggestedType,
} from "../../generated/resolvers-types";

const MODEL = "@cf/meta/llama-3-8b-instruct" as const;

const SYSTEM_MESSAGE = `
Чи бол боловсролын эксперт. Өгөгдсөн асуултыг уншаад заавал МОНГОЛ хэлээр (explanation, tags, options, correctAnswer, source, skillLevel) хариул.
Агуулгад нь тулгуурлан хамгийн тохиромжтой suggestedType-ийг өөрөө сонго:
- MCQ: Олон сонголттой асуулт бол. Заавал яг 4 сонголт зохиож options массивт оруул.
- MATCHING: Хоёр багана холбох асуулт бол. options-д ["A-1", "B-2"] хэлбэртэй массив оруул.
- FILL_IN: Нөхөх зайтай асуулт бол. options: null.
- MATH: Математик бодлого бол.
- FREE_TEXT: Нээлттэй асуулт бол.

JSON бүтэц (жишээ утгууд; skillLevel-д зөвхөн Мэдлэг | Ойлгомж | Хэрэглээ | Шинжилгээ-ийн нэг):
{
  "difficulty": "MEDIUM",
  "points": 2,
  "suggestedType": "MCQ",
  "options": ["А", "Б", "В", "Г"],
  "correctAnswer": "Зөв хариултын текст",
  "explanation": "Монгол хэлээрх аргачлал",
  "tags": ["сэдэв"],
  "source": "ЭЕШ",
  "skillLevel": "Ойлгомж"
}
source талбарт асуултын эх сурвалжийг таамагла (жишээ нь: ЭЕШ, Сурах бичиг, Олимпиад).
Зөвхөн цэвэр JSON буцаа.
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

function parseDifficulty(v: unknown): Difficulty {
  const s = String(v ?? "").toUpperCase();
  if (s === Difficulty.Easy) return Difficulty.Easy;
  if (s === Difficulty.Hard) return Difficulty.Hard;
  return Difficulty.Medium;
}

function parseSuggestedType(v: unknown): QuestionAnalysisSuggestedType {
  const s = String(v ?? "")
    .toUpperCase()
    .replace(/-/g, "_");
  if (s === "MCQ") return QuestionAnalysisSuggestedType.Mcq;
  if (s === "MATCHING") return QuestionAnalysisSuggestedType.Matching;
  if (s === "FILL_IN" || s === "FILLIN") return QuestionAnalysisSuggestedType.FillIn;
  if (s === "MATH") return QuestionAnalysisSuggestedType.Math;
  if (s === "FREE_TEXT" || s === "FREETEXT")
    return QuestionAnalysisSuggestedType.FreeText;
  return QuestionAnalysisSuggestedType.FreeText;
}

type Args = { prompt: string };

export const analyzeQuestionMutation = {
  analyzeQuestion: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    const prompt = args.prompt?.trim();
    if (!prompt) {
      throw new GraphQLError("prompt хоосон байж болохгүй.");
    }

    const ai = ctx.env.AI;
    if (!ai) {
      throw new GraphQLError(
        "Workers AI binding (AI) идэвхгүй байна. wrangler.jsonc болон Cloudflare орчинд deploy хийнэ үү.",
      );
    }

    try {
      const response = await ai.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: prompt },
        ],
      });

      const text = response.response?.trim();
      if (!text) {
        throw new Error("AI хариу хоосон байна.");
      }

      const jsonText = extractJsonText(text);
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      const pointsRaw = parsed.points;
      const points =
        typeof pointsRaw === "number" && Number.isFinite(pointsRaw)
          ? Math.max(0, Math.floor(pointsRaw))
          : 1;

      const tagsRaw = parsed.tags;
      const tags = Array.isArray(tagsRaw) ? tagsRaw.map((x) => String(x)) : [];

      const optionsRaw = parsed.options;
      const options =
        optionsRaw === null || optionsRaw === undefined
          ? null
          : Array.isArray(optionsRaw)
            ? optionsRaw.map((x) => String(x))
            : null;

      return {
        difficulty: parseDifficulty(parsed.difficulty),
        points,
        tags,
        explanation: String(parsed.explanation ?? ""),
        options,
        correctAnswer: String(parsed.correctAnswer ?? ""),
        suggestedType: parseSuggestedType(parsed.suggestedType),
        source: String(parsed.source ?? "Тодорхойгүй").trim() || "Тодорхойгүй",
        skillLevel: String(parsed.skillLevel ?? "Ойлгомж").trim() || "Ойлгомж",
      };
    } catch (err) {
      console.error("AI Analysis Error:", err);
      const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
      throw new GraphQLError(`AI асуултыг шинжлэхэд алдаа: ${msg}`);
    }
  },
};
