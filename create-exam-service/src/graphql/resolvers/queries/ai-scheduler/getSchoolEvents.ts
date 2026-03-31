import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import {
  schoolEvents,
  schoolEventTargets,
  schoolEventTeacherTargets,
} from "../../../../db/schema";

type Args = { startDate: string; endDate: string };

function toDate(iso: string): Date | null {
  const d = new Date(String(iso ?? "").trim());
  return Number.isFinite(d.getTime()) ? d : null;
}

export const getSchoolEventsQuery = {
  getSchoolEvents: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const startDate = toDate(args.startDate);
    const endDate = toDate(args.endDate);
    if (!startDate || !endDate || endDate <= startDate) {
      throw new GraphQLError("startDate/endDate буруу байна.");
    }

    // Overlap: start_date < end && end_date > start
    const rows = await ctx.db
      .select()
      .from(schoolEvents)
      .where(
        and(
          lt(schoolEvents.startDate, endDate),
          gt(schoolEvents.endDate, startDate),
        ),
      )
      .orderBy(asc(schoolEvents.startDate), asc(schoolEvents.priority));

    const eventIds = rows.map((r) => r.id);

    const groupTargets =
      eventIds.length === 0
        ? []
        : await ctx.db
            .select({ eventId: schoolEventTargets.eventId, groupId: schoolEventTargets.groupId })
            .from(schoolEventTargets)
            .where(inArray(schoolEventTargets.eventId, eventIds));

    const teacherTargets =
      eventIds.length === 0
        ? []
        : await ctx.db
            .select({
              eventId: schoolEventTeacherTargets.eventId,
              teacherId: schoolEventTeacherTargets.teacherId,
            })
            .from(schoolEventTeacherTargets)
            .where(inArray(schoolEventTeacherTargets.eventId, eventIds));

    const groupMap = new Map<string, string[]>();
    for (const t of groupTargets) {
      const cur = groupMap.get(t.eventId) ?? [];
      cur.push(t.groupId);
      groupMap.set(t.eventId, cur);
    }

    const teacherMap = new Map<string, string[]>();
    for (const t of teacherTargets) {
      const cur = teacherMap.get(t.eventId) ?? [];
      cur.push(t.teacherId);
      teacherMap.set(t.eventId, cur);
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      eventType: r.eventType,
      priority: r.priority,
      urgencyLevel: r.urgencyLevel,
      targetType: r.targetType,
      isSchoolWide: Boolean(r.isSchoolWide),
      isFullLock: Boolean(r.isFullLock),
      repeatPattern: r.repeatPattern,
      startDate: new Date(r.startDate).toISOString(),
      endDate: new Date(r.endDate).toISOString(),
      startPeriodId: r.startPeriodId ?? null,
      endPeriodId: r.endPeriodId ?? null,
      colorCode: r.colorCode ?? null,
      groupIds: groupMap.get(r.id) ?? [],
      teacherIds: teacherMap.get(r.id) ?? [],
    }));
  },
};

