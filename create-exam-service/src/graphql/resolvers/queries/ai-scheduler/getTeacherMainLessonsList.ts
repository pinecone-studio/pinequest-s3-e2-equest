import { and, asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import {
  classrooms,
  curriculum,
  groups,
  masterSchedules,
  periods,
  subjects,
} from "../../../../db/schema";

type Args = {
  teacherId: string;
  semesterId?: string | null;
  includeDraft?: boolean | null;
};

export const getTeacherMainLessonsListQuery = {
  getTeacherMainLessonsList: async (
    _: unknown,
    args: Args,
    ctx: GraphQLContext,
  ) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }
    const db = ctx.db;

    const teacherId = String(args.teacherId ?? "").trim();
    if (!teacherId) {
      throw new GraphQLError("teacherId шаардлагатай.");
    }

    const semesterId = (args.semesterId ?? "2026-SPRING").trim();
    const includeDraft = Boolean(args.includeDraft ?? false);

    const selectQuery = () =>
      db
        .select({
          id: masterSchedules.id,
          dayOfWeek: masterSchedules.dayOfWeek,
          semesterId: masterSchedules.semesterId,
          isDraft: masterSchedules.isDraft,

          groupId: curriculum.groupId,
          gradeLevel: groups.gradeLevel,

          subjectId: curriculum.subjectId,
          subjectName: subjects.name,

          classroomId: masterSchedules.classroomId,
          classroomRoomNumber: classrooms.roomNumber,

          periodId: masterSchedules.periodId,
          periodShift: periods.shift,
          periodNumber: periods.periodNumber,
          startTime: periods.startTime,
          endTime: periods.endTime,
        })
        .from(masterSchedules)
        .innerJoin(curriculum, eq(masterSchedules.curriculumId, curriculum.id))
        .innerJoin(groups, eq(curriculum.groupId, groups.id))
        .innerJoin(subjects, eq(curriculum.subjectId, subjects.id))
        .innerJoin(periods, eq(masterSchedules.periodId, periods.id))
        .innerJoin(classrooms, eq(masterSchedules.classroomId, classrooms.id))
        .orderBy(
          asc(masterSchedules.dayOfWeek),
          asc(periods.shift),
          asc(periods.periodNumber),
        );

    const baseWhere = and(
      eq(curriculum.teacherId, teacherId),
      eq(curriculum.status, "ACTIVE"),
      eq(groups.status, "ACTIVE"),
    );

    // Эхлээд semesterId-тай нь шүүнэ.
    let rows = await selectQuery()
      .where(and(baseWhere, eq(masterSchedules.semesterId, semesterId)));

    // Зарим орчинд semester_id өгөгдөл зөрсөн/хоосон байдаг тул fallback:
    // тухайн багшийн ACTIVE хуваарь байвал semester-ийг түр алгасаж буцаана.
    if (rows.length === 0) {
      rows = await selectQuery().where(baseWhere);
    }

    // isDraft=false нь "primary layer" учраас default-аар draft-уудыг нууж байна.
    return includeDraft ? rows : rows.filter((r) => r.isDraft === false);
  },
};

