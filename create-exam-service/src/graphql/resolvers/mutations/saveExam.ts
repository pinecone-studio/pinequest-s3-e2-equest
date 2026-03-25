import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import { exams } from "../../../db/schema";

type SaveExamArgs = {
	input: {
		examId?: string | null;
		status: string;
		generation: unknown;
		questions: unknown[];
	};
};

export const saveExamMutation = {
	saveExam: async (_: unknown, args: SaveExamArgs, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу)",
			);
		}

		const { input } = args;
		const id =
			input.examId?.trim() ||
			(typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2)}`);

		const now = new Date().toISOString();
		const payloadJson = JSON.stringify({
			generation: input.generation,
			questions: input.questions,
		});

		const existing = await ctx.db
			.select({ createdAt: exams.createdAt })
			.from(exams)
			.where(eq(exams.id, id))
			.limit(1);

		const createdAt = existing[0]?.createdAt ?? now;

		await ctx.db
			.insert(exams)
			.values({
				id,
				status: input.status,
				payloadJson,
				createdAt,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: exams.id,
				set: {
					status: input.status,
					payloadJson,
					updatedAt: now,
				},
			});

		return {
			examId: id,
			status: input.status,
		};
	},
};
