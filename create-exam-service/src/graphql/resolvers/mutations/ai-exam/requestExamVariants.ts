import { GraphQLError } from "graphql";

import { examVariantJobs } from "../../../../db/schema";
import type { GraphQLContext } from "../../../context";

type Args = {
	input: {
		examId?: string | null;
		variantCount: number;
		questions: Array<{
			order: number;
			prompt: string;
			type: string;
			options?: string[] | null;
			correctAnswer?: string | null;
			explanation?: string | null;
		}>;
	};
};

export const requestExamVariantsMutation = {
	requestExamVariants: async (_: unknown, args: Args, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError("D1 DB холбогдоогүй байна.");
		}

		if (!ctx.env.EXAM_VARIANT_QUEUE) {
			throw new GraphQLError("EXAM_VARIANT_QUEUE binding олдсонгүй.");
		}

		const variantCount = Number(args.input.variantCount ?? 0);
		if (!Number.isFinite(variantCount) || variantCount < 1) {
			throw new GraphQLError("variantCount 1-ээс их байх ёстой.");
		}

		const questions = Array.isArray(args.input.questions) ? args.input.questions : [];
		if (!questions.length) {
			throw new GraphQLError("questions хоосон байна.");
		}

		const jobId =
			typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const now = new Date().toISOString();
		const examId = args.input.examId?.trim() || null;

		await ctx.db.insert(examVariantJobs).values({
			id: jobId,
			examId,
			status: "pending",
			variantCount: Math.floor(variantCount),
			requestedBy: null,
			sourceQuestionsJson: JSON.stringify(questions),
			resultJson: null,
			errorMessage: null,
			requestedAt: now,
			startedAt: null,
			completedAt: null,
			updatedAt: now,
		});

		await ctx.env.EXAM_VARIANT_QUEUE.send({
			jobId,
			examId,
			variantCount: Math.floor(variantCount),
		});

		return {
			success: true,
			message: "AI хувилбар үүсгэх хүсэлт дараалалд орлоо.",
			jobId,
		};
	},
};
