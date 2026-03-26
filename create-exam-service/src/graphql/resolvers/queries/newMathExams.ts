import { desc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../context";
import { newExamQuestions, newExams } from "../../../db/schema";
import { MathExamQuestionType } from "../../generated/resolvers-types";

type ListArgs = { limit?: number | null };
type GetArgs = { examId: string };

function gqlQuestionType(t: string): MathExamQuestionType {
  return t === "math" ? MathExamQuestionType.Math : MathExamQuestionType.Mcq;
}

export const newMathExamQueries = {
  listNewMathExams: async (_: unknown, args: ListArgs, ctx: GraphQLContext) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const limitRaw = typeof args.limit === "number" ? args.limit : 50;
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
      : 50;

    const rows = await ctx.db
      .select({
        examId: newExams.id,
        title: newExams.title,
        updatedAt: newExams.updatedAt,
      })
      .from(newExams)
      .orderBy(desc(newExams.updatedAt))
      .limit(limit);

    return rows;
  },

  getNewMathExam: async (_: unknown, args: GetArgs, ctx: GraphQLContext) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const examId = args.examId?.trim();
    if (!examId) {
      throw new GraphQLError("examId шаардлагатай.");
    }

    const examRows = await ctx.db
      .select({
        examId: newExams.id,
        title: newExams.title,
        mcqCount: newExams.mcqCount,
        mathCount: newExams.mathCount,
        totalPoints: newExams.totalPoints,
        difficulty: newExams.difficulty,
        topics: newExams.topics,
        sourceContext: newExams.sourceContext,
        createdAt: newExams.createdAt,
        updatedAt: newExams.updatedAt,
      })
      .from(newExams)
      .where(eq(newExams.id, examId))
      .limit(1);

    const exam = examRows[0];
    if (!exam) {
      return null;
    }

    const questionRows = await ctx.db
      .select({
        id: newExamQuestions.id,
        type: newExamQuestions.type,
        prompt: newExamQuestions.prompt,
        points: newExamQuestions.points,
        imageAlt: newExamQuestions.imageAlt,
        imageDataUrl: newExamQuestions.imageDataUrl,
        optionsJson: newExamQuestions.optionsJson,
        correctOption: newExamQuestions.correctOption,
        responseGuide: newExamQuestions.responseGuide,
        answerLatex: newExamQuestions.answerLatex,
        position: newExamQuestions.position,
      })
      .from(newExamQuestions)
      .where(eq(newExamQuestions.examId, examId))
      .orderBy(newExamQuestions.position);

    const questions = questionRows.map((q) => {
      const options = q.optionsJson
        ? (JSON.parse(q.optionsJson) as string[])
        : null;
      return {
        id: q.id,
        type: gqlQuestionType(q.type),
        prompt: q.prompt,
        points: q.points,
        imageAlt: q.imageAlt || null,
        imageDataUrl: q.imageDataUrl ?? null,
        options,
        correctOption: q.correctOption ?? null,
        responseGuide: q.responseGuide ?? null,
        answerLatex: q.answerLatex ?? null,
      };
    });

    return {
      examId: exam.examId,
      title: exam.title,
      mcqCount: exam.mcqCount,
      mathCount: exam.mathCount,
      totalPoints: exam.totalPoints,
      generator:
        exam.difficulty || exam.topics || exam.sourceContext
          ? {
              difficulty: exam.difficulty ?? null,
              topics: exam.topics ?? null,
              sourceContext: exam.sourceContext ?? null,
            }
          : null,
      questions,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
    };
  },
};
