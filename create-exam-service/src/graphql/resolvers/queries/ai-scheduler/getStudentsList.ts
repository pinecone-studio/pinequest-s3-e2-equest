import { and, asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { groups, students } from "../../../../db/schema";

type Args = { grade: number; group: string };

function normalizeGrade(input: Args["grade"]): number {
  const g = typeof input === "number" ? Math.floor(input) : NaN;
  if (!Number.isFinite(g) || g < 1 || g > 12) return NaN;
  return g;
}

function normalizeGroupLetter(input: Args["group"]): string {
  const g = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return g.slice(0, 1);
}

export const getStudentsListQuery = {
  getStudentsList: async (_: unknown, args: Args, ctx: GraphQLContext) => {
    if (!ctx.db) {
      throw new GraphQLError("D1 DB холбогдоогүй байна.");
    }

    const grade = normalizeGrade(args.grade);
    const groupLetter = normalizeGroupLetter(args.group);
    if (!Number.isFinite(grade)) {
      throw new GraphQLError("grade буруу байна.");
    }
    if (!groupLetter) {
      throw new GraphQLError("group шаардлагатай (A–Z).");
    }

    const groupId = `${grade}${groupLetter}`;

    // groups.status = ACTIVE, students.status = active-г л харуулна.
    const rows = await ctx.db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        studentCode: students.studentCode,
        groupId: students.groupId,
        status: students.status,
      })
      .from(students)
      .innerJoin(groups, eq(students.groupId, groups.id))
      .where(
        and(
          eq(students.groupId, groupId),
          eq(groups.status, "ACTIVE"),
          eq(students.status, "active"),
        ),
      )
      .orderBy(asc(students.lastName), asc(students.firstName));

    return rows;
  },
};

