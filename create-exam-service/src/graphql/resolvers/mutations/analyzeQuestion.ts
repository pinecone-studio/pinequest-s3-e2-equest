/**
 * `analyzeQuestion` mutation: **Google Gemini** + Google Search grounding
 * (`@google/generative-ai`, `googleSearchRetrieval`). API түлхүүр: `GOOGLE_AI_API_KEY`
 * (эсвэл одоогийн `GEMINI_API_KEY`).
 */
import { GraphQLError } from "graphql";

import { analyzeQuestionWithGemini } from "../../../lib/analyze-question-gemini";
import type { GraphQLContext } from "../../context";
import {
  Difficulty,
  QuestionAnalysisSuggestedType,
} from "../../generated/resolvers-types";

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
  if (s === "FILL_IN" || s === "FILLIN")
    return QuestionAnalysisSuggestedType.FillIn;
  if (s === "MATH") return QuestionAnalysisSuggestedType.Math;
  if (s === "FREE_TEXT" || s === "FREETEXT")
    return QuestionAnalysisSuggestedType.FreeText;
  return QuestionAnalysisSuggestedType.Mcq;
}

const MCQ_OPTION_LABELS = ["А", "Б", "В", "Г"] as const;

function ensureFourMcqOptions(
  options: string[] | null,
  correctAnswer: string,
): { options: string[]; correctAnswer: string } {
  const cleaned = (options ?? [])
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0);
  const four: string[] = cleaned.slice(0, 4);
  while (four.length < 4) {
    const label = MCQ_OPTION_LABELS[four.length];
    four.push(`${label} хувилбар (засах)`);
  }

  let answer = correctAnswer.trim();
  if (answer && !four.includes(answer)) {
    const lower = answer.toLowerCase();
    const byCase = four.find((o) => o.toLowerCase() === lower);
    if (byCase) answer = byCase;
    else {
      const contains = four.find(
        (o) => o.includes(answer) || answer.includes(o),
      );
      answer = contains ?? four[0] ?? answer;
    }
  }
  if (!answer) answer = four[0] ?? "";

  return { options: four, correctAnswer: answer };
}

function normalizeNonMcqOptions(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const list = raw.map((x) => String(x).trim()).filter((s) => s.length > 0);
  return list.length ? list : null;
}

type Args = { prompt: string };

export const analyzeQuestionMutation = {
  analyzeQuestion: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    const prompt = args.prompt?.trim();
    if (!prompt) {
      throw new GraphQLError("prompt хоосон байж болохгүй.");
    }

    const apiKey =
      ctx.env.GOOGLE_AI_API_KEY?.trim() ||
      ctx.env.GEMINI_API_KEY?.trim() ||
      (typeof process !== "undefined"
        ? process.env.GOOGLE_AI_API_KEY?.trim() ||
          process.env.GEMINI_API_KEY?.trim()
        : "") ||
      "";

    if (!apiKey) {
      throw new GraphQLError(
        "Gemini түлхүүр тохируулаагүй. Cloudflare дээр: wrangler secret put GOOGLE_AI_API_KEY (эсвэл одоогийн GEMINI_API_KEY).",
      );
    }

    const analyzeModel =
      ctx.env.GEMINI_ANALYZE_MODEL?.trim() ||
      ctx.env.GEMINI_MODEL?.trim() ||
      undefined;

    try {
      const parsed = await analyzeQuestionWithGemini(apiKey, prompt, {
        model: analyzeModel,
      });

      const pointsRaw = parsed.points;
      const points =
        typeof pointsRaw === "number" && Number.isFinite(pointsRaw)
          ? Math.max(0, Math.floor(pointsRaw))
          : 1;

      const tagsRaw = parsed.tags;
      const tags = Array.isArray(tagsRaw) ? tagsRaw.map((x) => String(x)) : [];

      const suggestedType = parseSuggestedType(parsed.suggestedType);

      const optionsRaw = parsed.options;
      const optionsFromAi =
        optionsRaw === null || optionsRaw === undefined
          ? null
          : Array.isArray(optionsRaw)
            ? optionsRaw.map((x) => String(x))
            : null;

      const correctRaw = String(parsed.correctAnswer ?? "");

      let optionsOut: string[] | null;
      let correctOut: string;

      if (suggestedType === QuestionAnalysisSuggestedType.Mcq) {
        const fixed = ensureFourMcqOptions(optionsFromAi, correctRaw);
        optionsOut = fixed.options;
        correctOut = fixed.correctAnswer;
      } else {
        optionsOut = normalizeNonMcqOptions(optionsRaw);
        correctOut = correctRaw.trim();
      }

      return {
        difficulty: parseDifficulty(parsed.difficulty),
        points,
        tags,
        explanation: String(parsed.explanation ?? ""),
        options: optionsOut,
        correctAnswer: correctOut,
        suggestedType,
        source: String(parsed.source ?? "Тодорхойгүй").trim() || "Тодорхойгүй",
        skillLevel: String(parsed.skillLevel ?? "Ойлгомж").trim() || "Ойлгомж",
      };
    } catch (err) {
      console.error("analyzeQuestion (Gemini) error:", err);
      const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
      throw new GraphQLError(`AI асуултыг шинжлэхэд алдаа: ${msg}`);
    }
  },
};
