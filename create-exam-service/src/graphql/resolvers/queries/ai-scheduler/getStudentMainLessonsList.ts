import { and, asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import {
  classrooms,
  curriculum,
  groups,
  masterSchedules,
  periods,
  students,
  subjects,
  users,
} from "../../../../db/schema";

type Args = {
  studentId: string;
  semesterId?: string | null;
  includeDraft?: boolean | null;
};

export const getStudentMainLessonsListQuery = {
  getStudentMainLessonsList: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const studentId = String(args.studentId ?? "").trim();
    if (!studentId) {
      throw new GraphQLError("studentId шаардлагатай.");
    }

    const semesterId = (args.semesterId ?? "2026-SPRING").trim();
    const includeDraft = Boolean(args.includeDraft ?? false);

    const studentRow = await ctx.db
      .select({ groupId: students.groupId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    const groupId = studentRow[0]?.groupId ?? "";
    if (!groupId) {
      throw new GraphQLError("Сурагч олдсонгүй.");
    }

    const rows = await ctx.db
      .select({
        id: masterSchedules.id,
        dayOfWeek: masterSchedules.dayOfWeek,
        semesterId: masterSchedules.semesterId,
        isDraft: masterSchedules.isDraft,

        groupId: curriculum.groupId,
        gradeLevel: groups.gradeLevel,

        subjectId: curriculum.subjectId,
        subjectName: subjects.name,

        teacherId: curriculum.teacherId,
        teacherShortName: users.shortName,

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
      .innerJoin(users, eq(curriculum.teacherId, users.id))
      .innerJoin(periods, eq(masterSchedules.periodId, periods.id))
      .innerJoin(classrooms, eq(masterSchedules.classroomId, classrooms.id))
      .where(
        and(
          eq(curriculum.groupId, groupId),
          eq(masterSchedules.semesterId, semesterId),
          eq(curriculum.status, "ACTIVE"),
          eq(groups.status, "ACTIVE"),
        ),
      )
      .orderBy(
        asc(masterSchedules.dayOfWeek),
        asc(periods.shift),
        asc(periods.periodNumber),
      );

    return includeDraft ? rows : rows.filter((r) => r.isDraft === false);
  },
};

