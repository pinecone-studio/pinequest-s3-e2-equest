import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import { examSchedules } from "../../../db/schema";

type RequestExamScheduleArgs = {
	testId: string;
	classId: string;
	preferredDate: string;
};

export const requestExamScheduleMutation = {
	requestExamSchedule: async (
		_: unknown,
		args: RequestExamScheduleArgs,
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

		const [row] = await ctx.db
			.insert(examSchedules)
			.values({
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
			})
			.returning({ id: examSchedules.id });

		if (!row?.id) {
			throw new GraphQLError("exam_schedules үүсгэж чадсангүй.");
		}

		await q.send({
			examId: row.id,
			classId,
			testId,
		});

		return {
			success: true,
			message:
				"Шалгалтын хуваарь дараалалд орлоо. AI тооцоолол дуустал түр хүлээнэ үү.",
			examId: row.id,
		};
	},
};
