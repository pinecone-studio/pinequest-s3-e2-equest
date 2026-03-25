import type { GraphQLContext } from "../../context";
import {
	ExamStatus,
} from "../../generated/resolvers-types";
import type {
	Difficulty,
	EditableQuestionInput,
	ExamGenerationInput,
	QuestionFormat,
} from "../../generated/resolvers-types";
import { generateExamQuestionsWithAI, type AiGenerationInput } from "../../../lib/ai";
import { saveExamMutation } from "./saveExam";

/** AI руу явуулахаас өмнө ирсэн GraphQL `input`-ийг харах (терминал / `wrangler tail`) */
function logGenerationInputIfEnabled(
	input: ExamGenerationInput,
	envFlag?: string,
): void {
	const flag = envFlag ?? process.env.LOG_GRAPHQL_GENERATION;
	if (flag === "0" || flag === "false") {
		return;
	}
	const enabled =
		flag === "1" ||
		flag === "true" ||
		process.env.NODE_ENV === "development";
	if (!enabled) {
		return;
	}
	console.info(
		"[generateExamQuestions] GraphQL input (AI-аас өмнө):\n",
		JSON.stringify(input, null, 2),
	);
}

export const generateExamQuestionsMutation = {
	generateExamQuestions: async (
		_: unknown,
		args: { input: ExamGenerationInput },
		ctx: GraphQLContext,
	) => {
		logGenerationInputIfEnabled(args.input, ctx.env.LOG_GRAPHQL_GENERATION);
		const apiKey = ctx.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
		const examId =
			typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		// DB дээр "GENERATING" статустай эхлээд хадгална (AI унасан ч анхны мэдээлэл үлдэнэ)
		const generating = await saveExamMutation.saveExam(
			_,
			{
				input: {
					examId,
					status: ExamStatus.Generating,
					generation: args.input,
					questions: [],
				},
			},
			ctx,
		);
		try {
			// AI-д зориулсан "цэвэр" input — зөвхөн агуулгад нөлөөлөх талбарууд.
			const aiInput: AiGenerationInput = {
				gradeClass: args.input.gradeClass,
				subject: args.input.subject,
				topicScope: args.input.topicScope,
				examContent: args.input.examContent,
				totalQuestionCount: args.input.totalQuestionCount,
				difficultyDistribution: args.input.difficultyDistribution,
				formatDistribution: args.input.formatDistribution ?? null,
			};
			const questions = await generateExamQuestionsWithAI(apiKey, aiInput);

			const toDifficulty = (raw: string): Difficulty => {
				if (raw === "EASY") return "EASY" as Difficulty;
				if (raw === "MEDIUM") return "MEDIUM" as Difficulty;
				if (raw === "HARD") return "HARD" as Difficulty;
				return "MEDIUM" as Difficulty;
			};
			const toFormat = (raw: string): QuestionFormat => {
				if (raw === "SINGLE_CHOICE") return "SINGLE_CHOICE" as QuestionFormat;
				if (raw === "MULTIPLE_CHOICE") return "MULTIPLE_CHOICE" as QuestionFormat;
				if (raw === "MATCHING") return "MATCHING" as QuestionFormat;
				if (raw === "FILL_IN") return "FILL_IN" as QuestionFormat;
				if (raw === "WRITTEN") return "WRITTEN" as QuestionFormat;
				return "SINGLE_CHOICE" as QuestionFormat;
			};
			const editableQuestions: EditableQuestionInput[] = questions.map((q) => ({
				id: q.id,
				text: q.text,
				format: toFormat(q.format),
				difficulty: toDifficulty(q.difficulty),
				options: q.options ?? undefined,
				correctAnswer: q.correctAnswer ?? undefined,
				explanation: q.explanation ?? undefined,
			}));
			// AI амжилттай: DRAFT + questions update
			const saved = await saveExamMutation.saveExam(
				_,
				{
					input: {
						examId,
						status: ExamStatus.Draft,
						generation: args.input,
						questions: editableQuestions,
					},
				},
				ctx,
			);
			return {
				examId: saved.examId,
				status: saved.status,
				errorLog: saved.errorLog ?? null,
				createdAt: generating.createdAt ?? saved.createdAt,
				updatedAt: saved.updatedAt,
				questions,
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await saveExamMutation.saveExam(
				_,
				{
					input: {
						examId,
						status: ExamStatus.Failed,
						errorLog: msg,
						generation: args.input,
						questions: [],
					},
				},
				ctx,
			);
			throw e;
		}
	},
};
