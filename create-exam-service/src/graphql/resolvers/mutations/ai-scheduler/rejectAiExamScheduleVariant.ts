import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import type { GraphQLContext } from "../../../context";
import { examSchedules } from "../../../../db/schema";
import {
	examScheduleRowToGql,
	parseAiVariantsJson,
} from "../../../../lib/exam-schedule-variants";

type Args = {
	examId: string;
	variantId: string;
	reason?: string | null;
};

export const rejectAiExamScheduleVariantMutation = {
	rejectAiExamScheduleVariant: async (
		_: unknown,
		args: Args,
		ctx: GraphQLContext,
	) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу)",
			);
		}
		const examId = String(args.examId ?? "").trim();
		const variantId = String(args.variantId ?? "").trim();
		const reason = String(args.reason ?? "").trim();
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
				`Зөвхөн "suggested" төлөвт татгалзана. Одоогийн төлөв: ${row.status}`,
			);
		}

		const variants = parseAiVariantsJson(row.aiVariantsJson);
		if (!variants.length) {
			throw new GraphQLError("aiVariants хоосон байна.");
		}

		const remaining = variants.filter((v) => v.id !== variantId);
		if (remaining.length === variants.length) {
			throw new GraphQLError("variantId олдсонгүй.");
		}

		const now = new Date().toISOString();
		const nextStatus = remaining.length ? "suggested" : "rejected";
		const nextReason = reason
			? `${row.aiReasoning ?? ""}${row.aiReasoning ? "\n\n" : ""}Багш татгалзсан (${variantId}): ${reason}`.slice(
					0,
					4000,
				)
			: row.aiReasoning ?? null;

		await ctx.db
			.update(examSchedules)
			.set({
				status: nextStatus,
				aiVariantsJson: remaining.length ? JSON.stringify(remaining) : null,
				aiReasoning: nextReason,
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

