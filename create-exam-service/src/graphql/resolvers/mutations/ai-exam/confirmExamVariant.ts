import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { examVariantQuestions, examVariants } from "../../../../db/schema";
import type { GraphQLContext } from "../../../context";

type QuestionInput = {
	order: number;
	prompt: string;
	type: string;
	options?: string[] | null;
	correctAnswer?: string | null;
	explanation?: string | null;
};

type Args = {
	input: {
		variantId: string;
		questions: QuestionInput[];
	};
};

export async function performConfirmExamVariant(
	input: Args["input"],
	ctx: GraphQLContext,
) {
	if (!ctx.db) {
		throw new GraphQLError("D1 DB холбогдоогүй байна.");
	}

	const variantId = String(input.variantId ?? "").trim();
	if (!variantId) {
		throw new GraphQLError("variantId шаардлагатай.");
	}
	const questions = Array.isArray(input.questions) ? input.questions : [];
	if (!questions.length) {
		throw new GraphQLError("questions хоосон байна.");
	}

		const [existingVariant] = await ctx.db
			.select()
			.from(examVariants)
			.where(eq(examVariants.id, variantId))
			.limit(1);

		if (!existingVariant) {
			throw new GraphQLError("Variant олдсонгүй.");
		}

		const now = new Date().toISOString();
		const existingConfirmedAt = existingVariant.confirmedAt ?? now;
		await ctx.db
			.delete(examVariantQuestions)
			.where(eq(examVariantQuestions.variantId, variantId));
		await ctx.db.insert(examVariantQuestions).values(
			questions.map((question, index) => ({
				id: `${variantId}-confirmed-q-${index + 1}-${Math.random().toString(36).slice(2)}`,
				variantId,
				position: Math.max(1, Math.floor(Number(question.order) || index + 1)),
				type: String(question.type ?? "single-choice"),
				prompt: String(question.prompt ?? "").trim(),
				optionsJson: Array.isArray(question.options)
					? JSON.stringify(question.options)
					: JSON.stringify([]),
				correctAnswer: question.correctAnswer?.trim() || null,
				explanation: question.explanation?.trim() || null,
				createdAt: existingConfirmedAt,
				updatedAt: now,
			})),
		);
		await ctx.db
			.update(examVariants)
			.set({
				status: existingVariant.status === "saved" ? "saved" : "confirmed",
				confirmedAt: existingConfirmedAt,
				updatedAt: now,
			})
			.where(eq(examVariants.id, variantId));

		const [variant] = await ctx.db
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
			.where(eq(examVariants.id, variantId))
			.limit(1);

		const savedQuestions = await ctx.db
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
			.where(eq(examVariantQuestions.variantId, variantId));

	return {
		success: true,
		message: "AI хувилбар батлагдлаа.",
		variant: variant
			? {
					...variant,
					questions: savedQuestions
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
			  }
			: null,
	};
}

type BatchArgs = {
	inputs: Args["input"][];
};

export const confirmExamVariantMutation = {
	confirmExamVariant: async (_: unknown, args: Args, ctx: GraphQLContext) =>
		performConfirmExamVariant(args.input, ctx),
	confirmExamVariants: async (_: unknown, args: BatchArgs, ctx: GraphQLContext) => {
		const inputs = Array.isArray(args.inputs) ? args.inputs : [];
		if (!inputs.length) {
			throw new GraphQLError("inputs хоосон байна.");
		}

		const results = await Promise.all(
			inputs.map((input) => performConfirmExamVariant(input, ctx)),
		);

		return {
			success: true,
			message: `${results.length} AI хувилбар батлагдлаа.`,
			variants: results
				.map((result) => result.variant)
				.filter(Boolean),
		};
	},
};
