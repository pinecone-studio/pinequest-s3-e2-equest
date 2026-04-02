import { asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { periods, teacherAvailability } from "../../../../db/schema";

type Args = {
  teacherId: string;
};

export const getTeacherAvailabilityQuery = {
  getTeacherAvailability: async (
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

    const rows = await db
      .select({
        id: teacherAvailability.id,
        dayOfWeek: teacherAvailability.dayOfWeek,
        periodId: teacherAvailability.periodId,
        status: teacherAvailability.status,
        reason: teacherAvailability.reason,
        startTime: periods.startTime,
        endTime: periods.endTime,
      })
      .from(teacherAvailability)
      .innerJoin(periods, eq(teacherAvailability.periodId, periods.id))
      .where(eq(teacherAvailability.teacherId, teacherId))
      .orderBy(
        asc(teacherAvailability.dayOfWeek),
        asc(teacherAvailability.periodId),
      );

    return rows.map((r) => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      periodId: r.periodId,
      status: r.status,
      reason: r.reason ?? null,
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  },
};
