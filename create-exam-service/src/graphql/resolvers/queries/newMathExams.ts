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

function sessionMetaFromRow(row: {
  grade: number | null;
  groupClass: string | null;
  examType: string | null;
  sessionSubject: string | null;
  sessionTopicsJson: string | null;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  mixQuestions: number | null;
  withVariants: number | null;
  variantCount: number | null;
  sessionDescription: string | null;
}) {
  const hasAny =
    row.grade != null ||
    (row.groupClass != null && row.groupClass !== "") ||
    (row.examType != null && row.examType !== "") ||
    (row.sessionSubject != null && row.sessionSubject !== "") ||
    (row.sessionTopicsJson != null && row.sessionTopicsJson !== "") ||
    (row.examDate != null && row.examDate !== "") ||
    (row.startTime != null && row.startTime !== "") ||
    (row.endTime != null && row.endTime !== "") ||
    row.durationMinutes != null ||
    row.mixQuestions != null ||
    row.withVariants != null ||
    row.variantCount != null ||
    (row.sessionDescription != null && row.sessionDescription !== "");

  if (!hasAny) {
    return null;
  }

  let topics: string[] = [];
  if (row.sessionTopicsJson) {
    try {
      const parsed = JSON.parse(row.sessionTopicsJson) as unknown;
      topics = Array.isArray(parsed)
        ? parsed.map((t) => String(t))
        : [];
    } catch {
      topics = [];
    }
  }

  return {
    grade: row.grade,
    groupClass: row.groupClass,
    examType: row.examType,
    subject: row.sessionSubject,
    topics,
    examDate: row.examDate,
    startTime: row.startTime,
    endTime: row.endTime,
    durationMinutes: row.durationMinutes,
    mixQuestions:
      row.mixQuestions === 1
        ? true
        : row.mixQuestions === 0
          ? false
          : null,
    withVariants:
      row.withVariants === 1
        ? true
        : row.withVariants === 0
          ? false
          : null,
    variantCount: row.variantCount,
    description: row.sessionDescription,
  };
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
        grade: newExams.grade,
        groupClass: newExams.groupClass,
        examType: newExams.examType,
        sessionSubject: newExams.sessionSubject,
        sessionTopicsJson: newExams.sessionTopicsJson,
        examDate: newExams.examDate,
        startTime: newExams.startTime,
        endTime: newExams.endTime,
        durationMinutes: newExams.durationMinutes,
        mixQuestions: newExams.mixQuestions,
        withVariants: newExams.withVariants,
        variantCount: newExams.variantCount,
        sessionDescription: newExams.sessionDescription,
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

    const sessionMeta = sessionMetaFromRow({
      grade: exam.grade,
      groupClass: exam.groupClass,
      examType: exam.examType,
      sessionSubject: exam.sessionSubject,
      sessionTopicsJson: exam.sessionTopicsJson,
      examDate: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
      durationMinutes: exam.durationMinutes,
      mixQuestions: exam.mixQuestions,
      withVariants: exam.withVariants,
      variantCount: exam.variantCount,
      sessionDescription: exam.sessionDescription,
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
      sessionMeta,
      questions,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
    };
  },
};
