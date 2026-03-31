import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { examSchedules } from "../../../../db/schema";
import {
	examScheduleRowToGql,
	parseAiVariantsJson,
} from "../../../../lib/exam-schedule-variants";

const EXAM_DURATION_MS = 90 * 60 * 1000;

type Args = { examId: string; variantId: string };

export const approveAiExamScheduleMutation = {
	approveAiExamSchedule: async (_: unknown, args: Args, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу)",
			);
		}
		const examId = String(args.examId ?? "").trim();
		const variantId = String(args.variantId ?? "").trim();
		if (!examId || !variantId) {
			throw new GraphQLError("examId, variantId заавал бөглөнө.");
		}

		const [row] = await ctx.db
			.select()
			.from(examSchedules)
			.where(eq(examSchedules.id, examId))
			.limit(1);

		if (!row) {
			throw new GraphQLError("exam_schedules олдсонгүй.");
		}
		if (row.status !== "suggested") {
			throw new GraphQLError(
				`Зөвхөн "suggested" төлөвт батална. Одоогийн төлөв: ${row.status}`,
			);
		}

		const variants = parseAiVariantsJson(row.aiVariantsJson);
		const chosen = variants.find((v) => v.id === variantId);
		if (!chosen) {
			throw new GraphQLError("Сонгосон variantId олдсонгүй.");
		}

		const start = new Date(chosen.startTime);
		if (Number.isNaN(start.getTime())) {
			throw new GraphQLError("Сонгосон хувилбарын startTime буруу байна.");
		}

		const end = new Date(start.getTime() + EXAM_DURATION_MS);
		const now = new Date().toISOString();

		await ctx.db
			.update(examSchedules)
			.set({
				startTime: start,
				endTime: end,
				roomId: chosen.roomId,
				status: "confirmed",
				aiReasoning: chosen.reason ?? row.aiReasoning,
				aiVariantsJson: null,
				updatedAt: now,
			})
			.where(eq(examSchedules.id, examId));

		const [updated] = await ctx.db
			.select()
			.from(examSchedules)
			.where(eq(examSchedules.id, examId))
			.limit(1);

		if (!updated) {
			throw new GraphQLError("Шинэчлэлт амжилтгүй.");
		}

		return examScheduleRowToGql(updated);
	},
};
