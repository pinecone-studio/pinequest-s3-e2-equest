import { and, asc, eq, inArray } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { curriculum, groups, users } from "../../../../db/schema";

type Args = { grades?: Array<number | null> | null };

const DEFAULT_GRADES = [9, 10, 11, 12] as const;

function normalizeGrades(input: Args["grades"]): number[] {
  const raw = Array.isArray(input) ? input : DEFAULT_GRADES;
  const grades = raw
    .map((g) => (typeof g === "number" ? Math.floor(g) : NaN))
    .filter((g) => Number.isFinite(g) && g >= 1 && g <= 12);
  return Array.from(new Set(grades));
}

export const getTeachersListQuery = {
  getTeachersList: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const grades = normalizeGrades(args.grades);
    if (grades.length === 0) {
      return [];
    }

    const rows = await ctx.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        shortName: users.shortName,
        email: users.email,
        department: users.department,
        teachingLevel: users.teachingLevel,
        role: users.role,
        workLoadLimit: users.workLoadLimit,
      })
      .from(curriculum)
      .innerJoin(groups, eq(curriculum.groupId, groups.id))
      .innerJoin(users, eq(curriculum.teacherId, users.id))
      .where(
        and(
          eq(curriculum.subjectId, "MATH_HS"),
          eq(curriculum.status, "ACTIVE"),
          eq(users.role, "TEACHER"),
          inArray(groups.gradeLevel, grades),
          eq(groups.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(users.lastName), asc(users.firstName));

    const dedup = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!dedup.has(r.id)) dedup.set(r.id, r);
    }
    return Array.from(dedup.values());
  },
};

