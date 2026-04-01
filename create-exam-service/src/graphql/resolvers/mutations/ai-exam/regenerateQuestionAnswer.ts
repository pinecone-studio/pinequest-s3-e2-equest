import { GraphQLError } from "graphql";

import { generateQuestionAnswerWithGemini } from "../../../../lib/generate-question-answer-gemini";
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

function ensureChoiceOptions(
  raw: unknown,
  correctAnswer: string,
): { options: string[]; correctAnswer: string } {
  const cleaned = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const four = cleaned.slice(0, 4);
  while (four.length < 4) {
    four.push(`${String.fromCharCode(1040 + four.length)} хувилбар`);
  }
  const answer = four.includes(correctAnswer) ? correctAnswer : (four[0] ?? "");
  return { options: four, correctAnswer: answer };
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
      const explanation =
        String(parsed.explanation ?? "").trim() || "Тайлбар үүсгээгүй.";
      const correctAnswer = String(parsed.correctAnswer ?? "").trim();
      const questionText = String(parsed.questionText ?? prompt).trim() || prompt;

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

      const normalized = ensureChoiceOptions(parsed.options, correctAnswer);
      return {
        questionText,
        format,
        difficulty,
        points: resolvedPoints,
        options: normalized.options,
        correctAnswer: normalized.correctAnswer,
        explanation,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
      throw new GraphQLError(`AI хариултыг дахин үүсгэхэд алдаа: ${msg}`);
    }
  },
};
