import type { GraphQLContext } from "../../context";
import type { ExamGenerationInput } from "../../types";
import { generateExamQuestionsWithAI } from "../../../lib/ai";

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
		const questions = await generateExamQuestionsWithAI(apiKey, args.input);
		return { questions };
	},
};
