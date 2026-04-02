import { and, asc, eq, exists, gte, lte, or } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { curriculum, examSchedules, newExams } from "../../../../db/schema";
import { examScheduleRowToGql } from "../../../../lib/exam-schedule-variants";

type Args = {
  teacherId: string;
  startDate: string;
  endDate: string;
};

export const listTeacherConfirmedExamSchedulesQuery = {
  listTeacherConfirmedExamSchedules: async (
    _: unknown,
    args: Args,
    ctx: GraphQLContext,
  ) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const teacherId = String(args.teacherId ?? "").trim();
    const startDate = String(args.startDate ?? "").trim();
    const endDate = String(args.endDate ?? "").trim();

    if (!teacherId || !startDate || !endDate) {
      throw new GraphQLError("teacherId, startDate, endDate шаардлагатай.");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new GraphQLError("startDate, endDate нь ISO 8601 форматтай байна.");
    }

    /**
     * `new_exams.teacher_id` ихэнх тохиолдолд хоосон байж болно (math-exam save flow).
     * Тэгэхэд ч баталгаажсан хуваарь харагдах ёстой тул `exam_schedules.class_id` =
     * `curriculum.group_id` болон `curriculum.teacher_id`-аар нэмэлтээр тааруулна.
     */
    const teacherMatch = or(
      // new_exams олдвол шууд teacherId-гаар тааруулна
      eq(newExams.teacherId, teacherId),
      // new_exams олдохгүй/teacher_id хоосон үед classId → curriculum.teacherId-аар тааруулна
      exists(
        ctx.db
          .select({ id: curriculum.id })
          .from(curriculum)
          .where(
            and(
              eq(curriculum.groupId, examSchedules.classId),
              eq(curriculum.teacherId, teacherId),
            ),
          ),
      ),
    );

    const rows = await ctx.db
      .select({
        id: examSchedules.id,
        testId: examSchedules.testId,
        classId: examSchedules.classId,
        startTime: examSchedules.startTime,
        endTime: examSchedules.endTime,
        roomId: examSchedules.roomId,
        status: examSchedules.status,
        aiVariantsJson: examSchedules.aiVariantsJson,
        aiReasoning: examSchedules.aiReasoning,
        createdAt: examSchedules.createdAt,
        updatedAt: examSchedules.updatedAt,
      })
      .from(examSchedules)
      // exam_schedules.test_id нь үргэлж new_exams.id байх албагүй (upstream эх сурвалж).
      // innerJoin хийвэл new_exams олдохгүй мөрүүд бүрэн унах тул leftJoin болгоно.
      .leftJoin(newExams, eq(examSchedules.testId, newExams.id))
      .where(
        and(
          teacherMatch,
          eq(examSchedules.status, "confirmed"),
          gte(examSchedules.startTime, start),
          lte(examSchedules.startTime, end),
        ),
      )
      .orderBy(asc(examSchedules.startTime));

    return rows.map((row) => examScheduleRowToGql(row));
  },
};
