import { GraphQLError } from "graphql";

import { generateQuestionAnswerWithGemini } from "../../../../lib/generate-question-answer-gemini";
import { normalizeGeneratedQuestionAnswer } from "../../../../lib/normalize-generated-question-answer";
import type { GraphQLContext } from "../../../context";
import { Difficulty, QuestionFormat } from "../../../generated/resolvers-types";

type Args = {
  input: {
    prompt: string;
    points?: number | null;
    difficulty?: Difficulty | null;
    format?: QuestionFormat | null;
    previousOptions?: string[] | null;
    previousCorrectAnswer?: string | null;
    previousExplanation?: string | null;
  };
};

function parseDifficulty(v: unknown): Difficulty {
  const s = String(v ?? "").toUpperCase();
  if (s === Difficulty.Easy) return Difficulty.Easy;
  if (s === Difficulty.Hard) return Difficulty.Hard;
  return Difficulty.Medium;
}

function parseFormat(v: unknown): QuestionFormat {
  const s = String(v ?? "").toUpperCase().replace(/-/g, "_");
  if (s === QuestionFormat.MultipleChoice) return QuestionFormat.MultipleChoice;
  if (s === QuestionFormat.Matching) return QuestionFormat.Matching;
  if (s === QuestionFormat.FillIn) return QuestionFormat.FillIn;
  if (s === QuestionFormat.Written) return QuestionFormat.Written;
  return QuestionFormat.SingleChoice;
}

export const regenerateQuestionAnswerMutation = {
  regenerateQuestionAnswer: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    const input = args.input;
    const prompt = input.prompt?.trim();
    if (!prompt) {
      throw new GraphQLError("Асуултын текст хоосон байж болохгүй.");
    }

    const points =
      typeof input.points === "number" && Number.isFinite(input.points)
        ? Math.max(1, Math.floor(input.points))
        : null;

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
        "Gemini түлхүүр тохируулаагүй. Cloudflare дээр: wrangler secret put GOOGLE_AI_API_KEY (эсвэл GEMINI_API_KEY).",
      );
    }

    try {
      const parsed = await generateQuestionAnswerWithGemini(
        apiKey,
        {
          prompt,
          points,
          difficulty: input.difficulty
            ? (String(input.difficulty) as "EASY" | "MEDIUM" | "HARD")
            : null,
          format: input.format
            ? (String(input.format) as
                | "SINGLE_CHOICE"
                | "MULTIPLE_CHOICE"
                | "MATCHING"
                | "FILL_IN"
                | "WRITTEN")
            : null,
          previousOptions: input.previousOptions ?? [],
          previousCorrectAnswer: input.previousCorrectAnswer ?? null,
          previousExplanation: input.previousExplanation ?? null,
          mode: "regenerate",
        },
        {
          model: ctx.env.GEMINI_ANALYZE_MODEL?.trim() || ctx.env.GEMINI_MODEL?.trim(),
        },
      );

      const format = parseFormat(parsed.format ?? input.format);
      const difficulty = parseDifficulty(parsed.difficulty ?? input.difficulty);
      const resolvedPoints =
        typeof parsed.points === "number" && Number.isFinite(parsed.points)
          ? Math.max(1, Math.floor(parsed.points))
          : points ?? 1;
      const normalizedGenerated = normalizeGeneratedQuestionAnswer(parsed);
      const explanation = normalizedGenerated.explanation || "Тайлбар үүсгээгүй.";
      const correctAnswer = normalizedGenerated.correctAnswer;
      const questionText = normalizedGenerated.questionText || prompt;

      if (format === QuestionFormat.Written) {
        return {
          questionText,
          format,
          difficulty,
          points: resolvedPoints,
          options: null,
          correctAnswer,
          explanation,
        };
      }

      return {
        questionText,
        format,
        difficulty,
        points: resolvedPoints,
        options: normalizedGenerated.options,
        correctAnswer:
          normalizedGenerated.options.includes(correctAnswer)
            ? correctAnswer
            : (normalizedGenerated.options[0] ?? ""),
        explanation,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
      throw new GraphQLError(`AI хариултыг дахин үүсгэхэд алдаа: ${msg}`);
    }
  },
};
