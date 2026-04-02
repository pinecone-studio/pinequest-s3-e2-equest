import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../context";
import { newExamQuestions, newExams } from "../../../db/schema";
import { MathExamQuestionType } from "../../generated/resolvers-types";

type ListArgs = {
  filters?: {
    durationMinutes?: number | null;
    examType?: string | null;
    grade?: number | null;
    questionCount?: number | null;
    search?: string | null;
    subject?: string | null;
    teacherId?: string | null;
    withVariants?: boolean | null;
  } | null;
  limit?: number | null;
  offset?: number | null;
};
type GetArgs = { examId: string };

function gqlQuestionType(t: string): MathExamQuestionType {
  return t === "math" ? MathExamQuestionType.Math : MathExamQuestionType.Mcq;
}

const PREVIEW_PROMPT_MAX = 220;

function truncatePreviewPrompt(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  if (s.length <= PREVIEW_PROMPT_MAX) return s;
  return `${s.slice(0, PREVIEW_PROMPT_MAX - 1)}…`;
}

function sessionMetaFromRow(row: {
  grade: number | null;
  groupClass: string | null;
  examType: string | null;
  sessionSubject: string | null;
  sessionTopicsJson: string | null;
  teacherId: string | null;
  roomId: string | null;
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
    (row.teacherId != null && row.teacherId !== "") ||
    (row.roomId != null && row.roomId !== "") ||
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
    teacherId: row.teacherId,
    roomId: row.roomId,
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
    const offsetRaw = typeof args.offset === "number" ? args.offset : 0;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const conditions = [];
    if (typeof args.filters?.grade === "number" && Number.isFinite(args.filters.grade)) {
      conditions.push(eq(newExams.grade, Math.floor(args.filters.grade)));
    }
    if (args.filters?.examType?.trim()) {
      conditions.push(eq(newExams.examType, args.filters.examType.trim()));
    }
    if (args.filters?.subject?.trim()) {
      conditions.push(eq(newExams.sessionSubject, args.filters.subject.trim()));
    }
    if (args.filters?.teacherId?.trim()) {
      conditions.push(eq(newExams.teacherId, args.filters.teacherId.trim()));
    }
    if (
      typeof args.filters?.durationMinutes === "number" &&
      Number.isFinite(args.filters.durationMinutes)
    ) {
      conditions.push(eq(newExams.durationMinutes, Math.floor(args.filters.durationMinutes)));
    }
    if (typeof args.filters?.withVariants === "boolean") {
      conditions.push(eq(newExams.withVariants, args.filters.withVariants ? 1 : 0));
    }
    if (
      typeof args.filters?.questionCount === "number" &&
      Number.isFinite(args.filters.questionCount)
    ) {
      conditions.push(
        sql`coalesce(${newExams.mcqCount}, 0) + coalesce(${newExams.mathCount}, 0) = ${Math.floor(args.filters.questionCount)}`,
      );
    }
    if (args.filters?.search?.trim()) {
      const normalizedSearch = `%${args.filters.search.trim().toLowerCase()}%`;
      conditions.push(
        sql`(
          lower(coalesce(${newExams.title}, '')) like ${normalizedSearch}
          or lower(coalesce(${newExams.sessionSubject}, '')) like ${normalizedSearch}
          or lower(coalesce(${newExams.examType}, '')) like ${normalizedSearch}
        )`,
      );
    }

    let query = ctx.db
      .select({
        examId: newExams.id,
        title: newExams.title,
        grade: newExams.grade,
        examType: newExams.examType,
        subject: newExams.sessionSubject,
        teacherId: newExams.teacherId,
        withVariants: newExams.withVariants,
        variantCount: newExams.variantCount,
        mcqCount: newExams.mcqCount,
        mathCount: newExams.mathCount,
        durationMinutes: newExams.durationMinutes,
        updatedAt: newExams.updatedAt,
      })
      .from(newExams)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rows = await query.orderBy(desc(newExams.updatedAt)).limit(limit).offset(offset);

    const examIds = rows.map((r) => r.examId);
    const previewByExam = new Map<string, { first: string | null; second: string | null }>();

    if (examIds.length > 0) {
      const qRows = await ctx.db
        .select({
          examId: newExamQuestions.examId,
          position: newExamQuestions.position,
          prompt: newExamQuestions.prompt,
        })
        .from(newExamQuestions)
        .where(inArray(newExamQuestions.examId, examIds))
        .orderBy(asc(newExamQuestions.examId), asc(newExamQuestions.position));

      const promptsByExam = new Map<string, string[]>();
      for (const r of qRows) {
        const list = promptsByExam.get(r.examId) ?? [];
        if (list.length < 2) {
          list.push(r.prompt);
          promptsByExam.set(r.examId, list);
        }
      }
      for (const [eid, prompts] of promptsByExam) {
        previewByExam.set(eid, {
          first: truncatePreviewPrompt(prompts[0] ?? null),
          second: truncatePreviewPrompt(prompts[1] ?? null),
        });
      }
    }

    return rows.map((row) => {
      const prev = previewByExam.get(row.examId);
      return {
        ...row,
        questionCount: (row.mcqCount ?? 0) + (row.mathCount ?? 0),
        withVariants:
          row.withVariants === 1
            ? true
            : row.withVariants === 0
              ? false
              : null,
        firstQuestionPreview: prev?.first ?? null,
        secondQuestionPreview: prev?.second ?? null,
      };
    });
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
        teacherId: newExams.teacherId,
        roomId: newExams.roomId,
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
      teacherId: exam.teacherId,
      roomId: exam.roomId,
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
