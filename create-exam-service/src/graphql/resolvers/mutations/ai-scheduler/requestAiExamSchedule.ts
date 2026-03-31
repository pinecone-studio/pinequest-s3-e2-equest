import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../../context";
import { examSchedules } from "../../../../db/schema";

type RequestAiExamScheduleArgs = {
	testId: string;
	classId: string;
	preferredDate: string;
};

export const requestAiExamScheduleMutation = {
	requestAiExamSchedule: async (
		_: unknown,
		args: RequestAiExamScheduleArgs,
		ctx: GraphQLContext,
	) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу)",
			);
		}
		const q = ctx.env.SCHEDULER_QUEUE;
		if (!q) {
			throw new GraphQLError(
				"SCHEDULER_QUEUE binding тохируулаагүй байна (wrangler.jsonc → queues.producers).",
			);
		}

		const testId = String(args.testId ?? "").trim();
		const classId = String(args.classId ?? "").trim();
		const preferredDate = String(args.preferredDate ?? "").trim();
		if (!testId || !classId || !preferredDate) {
			throw new GraphQLError("testId, classId, preferredDate заавал бөглөнө.");
		}

		const start = new Date(preferredDate);
		if (Number.isNaN(start.getTime())) {
			throw new GraphQLError(
				"preferredDate буруу формат (ISO 8601 string ашиглана уу).",
			);
		}

		const examId =
			typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const now = new Date().toISOString();

		try {
			await ctx.db.insert(examSchedules).values({
				id: examId,
				testId,
				classId,
				startTime: start,
				endTime: null,
				roomId: null,
				status: "pending",
				aiReasoning: null,
				createdAt: now,
				updatedAt: now,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "exam_schedules insert алдаа";
			throw new GraphQLError(`Шалгалтын request хадгалж чадсангүй: ${message}`);
		}

		try {
			await q.send({
				examId,
				classId,
				testId,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "SCHEDULER_QUEUE send алдаа";
			await ctx.db
				.update(examSchedules)
				.set({
					status: "failed",
					aiReasoning: `Queue илгээхэд алдаа гарлаа: ${message.slice(0, 2000)}`,
					updatedAt: new Date().toISOString(),
				})
				.where(eq(examSchedules.id, examId));
			throw new GraphQLError(`Шалгалтын request queue руу орж чадсангүй: ${message}`);
		}

		return {
			success: true,
			message:
				"Шалгалтын хуваарь дараалалд орлоо. AI тооцоолол дуустал түр хүлээнэ үү.",
			examId,
		};
	},
};
