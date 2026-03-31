import { asc, inArray, sql } from "drizzle-orm";
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

function normalizeEpochMs(value: number): number | null {
  if (!Number.isFinite(value)) return null;

  let ms = Math.trunc(value);

  // Remote D1/driver decoding may occasionally reinterpret stored ms timestamps
  // as if they were a larger unit, producing far-future dates. Reduce until it
  // lands in a realistic JS epoch-ms range.
  while (Math.abs(ms) > 1e13) {
    ms = Math.trunc(ms / 1000);
  }

  return ms;
}

function normalizeStoredTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    const ms = normalizeEpochMs(value.getTime());
    return ms === null ? null : new Date(ms);
  }

  if (typeof value === "number") {
    const ms = normalizeEpochMs(value);
    return ms === null ? null : new Date(ms);
  }

  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isFinite(num)) {
      const ms = normalizeEpochMs(num);
      return ms === null ? null : new Date(ms);
    }
    return toDate(value);
  }

  return null;
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
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    // Overlap: start_date < end && end_date > start
    const rows = await ctx.db
      .select()
      .from(schoolEvents)
      .where(
        sql`${schoolEvents.startDate} < ${endMs} and ${schoolEvents.endDate} > ${startMs}`,
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

    return rows.map((r) => {
      const normalizedStart = normalizeStoredTimestamp(r.startDate);
      const normalizedEnd = normalizeStoredTimestamp(r.endDate);

      return {
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
      startDate: normalizedStart?.toISOString() ?? "",
      endDate: normalizedEnd?.toISOString() ?? "",
      startPeriodId: r.startPeriodId ?? null,
      endPeriodId: r.endPeriodId ?? null,
      colorCode: r.colorCode ?? null,
      groupIds: groupMap.get(r.id) ?? [],
      teacherIds: teacherMap.get(r.id) ?? [],
    };
    });
  },
};

