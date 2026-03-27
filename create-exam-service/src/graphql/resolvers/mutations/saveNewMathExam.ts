import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import { newExamQuestions, newExams } from "../../../db/schema";
import {
	MathExamQuestionType,
	type SaveNewMathExamInput,
} from "../../generated/resolvers-types";
import { stripMathDelimitersForDb } from "../../../lib/normalizeMathExamText";
import { publishExamSaved } from "../../../lib/ably";

type Args = { input: SaveNewMathExamInput };

function dbQuestionType(t: MathExamQuestionType): "mcq" | "math" {
	if (t === MathExamQuestionType.Mcq) return "mcq";
	if (t === MathExamQuestionType.Math) return "math";
	return "mcq";
}

export const saveNewMathExamMutation = {
	saveNewMathExam: async (_: unknown, args: Args, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу)",
			);
		}

		const { input } = args;
		const now = new Date().toISOString();
		const id =
			input.examId?.trim() ||
			(typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2)}`);

		const existing = await ctx.db
			.select({ createdAt: newExams.createdAt })
			.from(newExams)
			.where(eq(newExams.id, id))
			.limit(1);

		const createdAt = existing[0]?.createdAt ?? now;
		const gen = input.generator;

		const payloadJson = JSON.stringify({
			title: input.title,
			mcqCount: input.mcqCount,
			mathCount: input.mathCount,
			totalPoints: input.totalPoints,
			generator: gen,
			questions: input.questions,
		});

		await ctx.db
			.insert(newExams)
			.values({
				id,
				title: input.title.trim() || "Нэргүй шалгалт",
				mcqCount: input.mcqCount,
				mathCount: input.mathCount,
				totalPoints: input.totalPoints,
				difficulty: gen?.difficulty ?? null,
				topics: gen?.topics ?? null,
				sourceContext: gen?.sourceContext ?? null,
				payloadJson,
				createdAt,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: newExams.id,
				set: {
					title: input.title.trim() || "Нэргүй шалгалт",
					mcqCount: input.mcqCount,
					mathCount: input.mathCount,
					totalPoints: input.totalPoints,
					difficulty: gen?.difficulty ?? null,
					topics: gen?.topics ?? null,
					sourceContext: gen?.sourceContext ?? null,
					payloadJson,
					updatedAt: now,
				},
			});

		await ctx.db.delete(newExamQuestions).where(eq(newExamQuestions.examId, id));

		const rows = (input.questions ?? []).map((q, idx) => {
			const qType = dbQuestionType(q.type);
			const prompt = stripMathDelimitersForDb(String(q.prompt ?? ""));
			const imageAlt = String(q.imageAlt ?? "").trim();
			const points =
				typeof q.points === "number" && Number.isFinite(q.points) && q.points >= 1
					? Math.floor(q.points)
					: 1;

			const rowId = `${id}-q-${idx + 1}`;

			if (qType === "mcq") {
				const options = Array.isArray(q.options)
					? q.options.map((o) => stripMathDelimitersForDb(String(o)))
					: [];
				const correctOption =
					typeof q.correctOption === "number" && Number.isFinite(q.correctOption)
						? Math.floor(q.correctOption)
						: null;
				const correctAnswerText =
					correctOption != null &&
					correctOption >= 0 &&
					correctOption < options.length
						? options[correctOption] ?? null
						: null;

				return {
					id: rowId,
					examId: id,
					position: idx + 1,
					type: "mcq" as const,
					prompt,
					points,
					imageAlt: imageAlt || "",
					imageDataUrl: q.imageDataUrl == null ? null : String(q.imageDataUrl),
					optionsJson: JSON.stringify(options),
					correctOption,
					correctAnswer: correctAnswerText,
					responseGuide: null,
					answerLatex: null,
					createdAt: now,
					updatedAt: now,
				};
			}

			return {
				id: rowId,
				examId: id,
				position: idx + 1,
				type: "math" as const,
				prompt,
				points,
				imageAlt: imageAlt || "",
				imageDataUrl: q.imageDataUrl == null ? null : String(q.imageDataUrl),
				optionsJson: null,
				correctOption: null,
				correctAnswer: null,
				responseGuide:
					stripMathDelimitersForDb(String(q.responseGuide ?? "")) || null,
				answerLatex: stripMathDelimitersForDb(String(q.answerLatex ?? "")) || null,
				createdAt: now,
				updatedAt: now,
			};
		});

		if (rows.length) {
			await ctx.db.insert(newExamQuestions).values(rows);
		}

		const result = {
			examId: id,
			title: input.title.trim() || "Нэргүй шалгалт",
			createdAt,
			updatedAt: now,
		};

		await publishExamSaved({
			examId: id,
			title: result.title,
			updatedAt: now,
		});

		return result;
	},
};
