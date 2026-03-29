import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { examSchedules } from "../../../../db/schema";
import { examScheduleRowToGql } from "../../../../lib/exam-schedule-variants";

type Args = { examId: string };

export const getAiExamScheduleQuery = {
	getAiExamSchedule: async (_: unknown, args: Args, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу)",
			);
		}
		const examId = String(args.examId ?? "").trim();
		if (!examId) {
			throw new GraphQLError("examId заавал бөглөнө.");
		}

		const [row] = await ctx.db
			.select()
			.from(examSchedules)
			.where(eq(examSchedules.id, examId))
			.limit(1);

		if (!row) {
			return null;
		}

		return examScheduleRowToGql(row);
	},
};
