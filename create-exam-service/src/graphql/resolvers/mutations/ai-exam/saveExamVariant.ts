import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { examVariantQuestions, examVariants } from "../../../../db/schema";
import type { GraphQLContext } from "../../../context";
import { MathExamQuestionType } from "../../../generated/resolvers-types";
import { performSaveNewMathExam } from "../saveNewMathExam";

type Args = {
	input: {
		variantId: string;
		examId?: string | null;
		title: string;
		grade?: number | null;
		examType?: string | null;
		subject?: string | null;
		durationMinutes?: number | null;
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

function uuid() {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const saveExamVariantMutation = {
	saveExamVariant: async (_: unknown, args: Args, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError("D1 DB холбогдоогүй байна.");
		}

		const variantId = String(args.input.variantId ?? "").trim();
		if (!variantId) {
			throw new GraphQLError("variantId шаардлагатай.");
		}

		const title = String(args.input.title ?? "").trim();
		if (!title) {
			throw new GraphQLError("title шаардлагатай.");
		}

		const questions = Array.isArray(args.input.questions)
			? args.input.questions
			: [];
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

		await ctx.db.delete(examVariantQuestions).where(eq(examVariantQuestions.variantId, variantId));
		await ctx.db.insert(examVariantQuestions).values(
			questions.map((question, index) => ({
				id: `${variantId}-q-${index + 1}-${uuid()}`,
				variantId,
				position: Math.max(1, Math.floor(Number(question.order) || index + 1)),
				type: String(question.type ?? "single-choice"),
				prompt: String(question.prompt ?? "").trim(),
				optionsJson: Array.isArray(question.options)
					? JSON.stringify(question.options)
					: JSON.stringify([]),
				correctAnswer: question.correctAnswer?.trim() || null,
				explanation: question.explanation?.trim() || null,
				createdAt: now,
				updatedAt: now,
			})),
		);

		const mcqCount = questions.filter((question) => question.type !== "written").length;
		const mathCount = questions.filter((question) => question.type === "written").length;

		const savedExam = await performSaveNewMathExam(
			{
				examId: args.input.examId?.trim() || existingVariant.savedExamId || undefined,
				title,
				mcqCount,
				mathCount,
				totalPoints: questions.length,
				sessionMeta: {
					grade:
						typeof args.input.grade === "number" ? Math.floor(args.input.grade) : undefined,
					examType: args.input.examType?.trim() || undefined,
					subject: args.input.subject?.trim() || undefined,
					durationMinutes:
						typeof args.input.durationMinutes === "number"
							? Math.floor(args.input.durationMinutes)
							: undefined,
					withVariants: true,
					variantCount: existingVariant.variantNumber,
				},
				questions: questions.map((question) => {
					if (question.type === "written") {
						return {
							type: MathExamQuestionType.Math,
							prompt: question.prompt,
							points: 1,
							responseGuide: question.explanation?.trim() || undefined,
							answerLatex: question.correctAnswer?.trim() || undefined,
						};
					}

					const options = Array.isArray(question.options) ? question.options : [];
					const correctOption = options.findIndex(
						(option) => option.trim() === (question.correctAnswer ?? "").trim(),
					);

					return {
						type: MathExamQuestionType.Mcq,
						prompt: question.prompt,
						points: 1,
						options,
						correctOption: correctOption >= 0 ? correctOption : undefined,
					};
				}),
			},
			ctx,
		);

		await ctx.db
			.update(examVariants)
			.set({
				status: "saved",
				confirmedAt: existingVariant.confirmedAt ?? now,
				savedAt: now,
				savedExamId: savedExam.examId,
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
			message: "AI хувилбар үндсэн шалгалт болж хадгалагдлаа.",
			examId: savedExam.examId,
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
	},
};
