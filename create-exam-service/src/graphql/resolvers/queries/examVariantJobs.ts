import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import {
	examVariantJobs,
	examVariantQuestions,
	examVariants,
} from "../../../db/schema";
import type { GraphQLContext } from "../../context";

type GetArgs = { jobId: string };

export const examVariantJobQueries = {
	getExamVariantJob: async (_: unknown, args: GetArgs, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError("D1 DB холбогдоогүй байна.");
		}
		const db = ctx.db;

		const jobId = String(args.jobId ?? "").trim();
		if (!jobId) {
			throw new GraphQLError("jobId шаардлагатай.");
		}

		const [job] = await db
			.select({
				jobId: examVariantJobs.id,
				examId: examVariantJobs.examId,
				status: examVariantJobs.status,
				variantCount: examVariantJobs.variantCount,
				sourceQuestionsJson: examVariantJobs.sourceQuestionsJson,
				resultJson: examVariantJobs.resultJson,
				errorMessage: examVariantJobs.errorMessage,
				requestedBy: examVariantJobs.requestedBy,
				requestedAt: examVariantJobs.requestedAt,
				startedAt: examVariantJobs.startedAt,
				completedAt: examVariantJobs.completedAt,
				updatedAt: examVariantJobs.updatedAt,
			})
			.from(examVariantJobs)
			.where(eq(examVariantJobs.id, jobId))
			.limit(1);

		if (!job) {
			return null;
		}

		const variantRows = await db
			.select({
				id: examVariants.id,
				jobId: examVariants.jobId,
				examId: examVariants.examId,
				variantNumber: examVariants.variantNumber,
				title: examVariants.title,
				status: examVariants.status,
				confirmedAt: examVariants.confirmedAt,
				savedAt: examVariants.savedAt,
				savedExamId: examVariants.savedExamId,
				createdAt: examVariants.createdAt,
				updatedAt: examVariants.updatedAt,
			})
			.from(examVariants)
			.where(eq(examVariants.jobId, jobId));

		const variants = await Promise.all(
			variantRows.map(async (variant) => {
				const questionRows = await db
					.select({
						id: examVariantQuestions.id,
						position: examVariantQuestions.position,
						type: examVariantQuestions.type,
						prompt: examVariantQuestions.prompt,
						optionsJson: examVariantQuestions.optionsJson,
						correctAnswer: examVariantQuestions.correctAnswer,
						explanation: examVariantQuestions.explanation,
					})
					.from(examVariantQuestions)
					.where(eq(examVariantQuestions.variantId, variant.id));

				return {
					...variant,
					questions: questionRows
						.sort((a, b) => a.position - b.position)
						.map((question) => ({
							id: question.id,
							position: question.position,
							type: question.type,
							prompt: question.prompt,
							options: question.optionsJson
								? (JSON.parse(question.optionsJson) as string[])
								: null,
							correctAnswer: question.correctAnswer,
							explanation: question.explanation,
						})),
				};
			}),
		);

		return {
			...job,
			variants: variants.sort((a, b) => a.variantNumber - b.variantNumber),
		};
	},
};
