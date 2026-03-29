import { GraphQLError } from "graphql";
import { v4 as uuidv4 } from "uuid";

import { aiExamQuestionTemplates } from "../../../../db/schema/tables/aiExamQuestionTemplates";
import { aiExamTemplates } from "../../../../db/schema/tables/aiExamTemplates";
import type { GraphQLContext } from "../../../context";
import {
	Difficulty,
	type AiQuestionTemplateInput,
	type CreateAiExamTemplateInput,
} from "../../../generated/resolvers-types";

type Args = { input: CreateAiExamTemplateInput };

const DIFF_MAP: Record<string, number> = {
	EASY: 1,
	MEDIUM: 2,
	HARD: 3,
};

function difficultyStringToEnum(s: string): Difficulty {
	const u = s.toUpperCase();
	if (u === Difficulty.Hard) return Difficulty.Hard;
	if (u === Difficulty.Easy) return Difficulty.Easy;
	return Difficulty.Medium;
}

function questionDifficultyScore(d: Difficulty | null | undefined): number {
	if (!d) return 2;
	return DIFF_MAP[d] ?? 2;
}

function resolvePoints(q: AiQuestionTemplateInput): number {
	if (typeof q.points === "number" && Number.isFinite(q.points)) {
		return Math.max(1, Math.floor(q.points));
	}
	return 1;
}

function resolveDifficultyForDb(d: Difficulty | null | undefined): string {
	const v = d ?? Difficulty.Medium;
	return typeof v === "string" ? v : String(v);
}

export const createAiExamTemplateMutation = {
	createAiExamTemplate: async (_: unknown, args: Args, ctx: GraphQLContext) => {
		if (!ctx.db) {
			throw new GraphQLError(
				"D1 DB холбогдоогүй байна (локалд .dev.vars + wrangler, production-д binding шалгана уу).",
			);
		}

		const { input } = args;
		const {
			title,
			subject,
			grade,
			teacherId,
			durationMinutes,
			questions,
		} = input;

		if (!title?.trim()) {
			throw new GraphQLError("title шаардлагатай.");
		}
		if (!subject?.trim()) {
			throw new GraphQLError("subject шаардлагатай.");
		}
		if (!teacherId?.trim()) {
			throw new GraphQLError("teacherId шаардлагатай.");
		}

		const gradeInt =
			typeof grade === "number" && Number.isFinite(grade)
				? Math.floor(grade)
				: NaN;
		if (!Number.isFinite(gradeInt)) {
			throw new GraphQLError("grade зөв тоо байх ёстой.");
		}

		const duration =
			typeof durationMinutes === "number" &&
			Number.isFinite(durationMinutes)
				? Math.max(1, Math.floor(durationMinutes))
				: 60;

		const list = [...(questions ?? [])];

		const totalPoints = list.reduce((sum, q) => {
			if (typeof q.points === "number" && Number.isFinite(q.points)) {
				return sum + Math.max(0, Math.floor(q.points));
			}
			return sum;
		}, 0);

		let finalDifficultyStr = "MEDIUM";
		if (list.length > 0) {
			const avgDiff =
				list.reduce(
					(acc, q) => acc + questionDifficultyScore(q.difficulty ?? undefined),
					0,
				) / list.length;
			if (avgDiff <= 1.5) finalDifficultyStr = "EASY";
			else if (avgDiff >= 2.5) finalDifficultyStr = "HARD";
		}

		const templateId = uuidv4();
		const now = new Date().toISOString();

		const questionData =
			list.length > 0
				? list.map((q, index) => {
						const pos = index + 1;
						const qType = String(q.type ?? "").trim().toUpperCase();
						if (!qType) {
							throw new GraphQLError(
								`Асуултын type хоосон (дараалал ${pos}).`,
							);
						}
						const pts = resolvePoints(q);
						const opt = q.optionsJson?.trim();
						return {
							id: uuidv4(),
							templateId,
							position: pos,
							type: qType,
							aiSuggestedType: q.aiSuggestedType?.trim() || null,
							prompt: String(q.prompt ?? "").trim() || "(хоосон)",
							optionsJson: opt || null,
							correctAnswer: q.correctAnswer?.trim() || null,
							points: pts,
							difficulty: resolveDifficultyForDb(q.difficulty ?? undefined),
							tags: q.tags?.trim() || null,
							explanation: q.explanation?.trim() || null,
							skillLevel: q.skillLevel?.trim() || null,
							source: q.source?.trim() || null,
							vectorId: null as string | null,
							createdAt: now,
							updatedAt: now,
						};
					})
				: [];

		try {
			// D1 + зарим орчинд drizzle `transaction()` (BEGIN/COMMIT) амжилтгүй байж болно.
			await ctx.db.insert(aiExamTemplates).values({
				id: templateId,
				title: title.trim(),
				subject: subject.trim(),
				grade: gradeInt,
				teacherId: teacherId.trim(),
				durationMinutes: duration,
				difficulty: finalDifficultyStr,
				totalPoints,
				createdAt: now,
				updatedAt: now,
			});

			if (questionData.length > 0) {
				await ctx.db.insert(aiExamQuestionTemplates).values(questionData);
			}

			return {
				templateId,
				title: title.trim(),
				totalPoints,
				difficulty: difficultyStringToEnum(finalDifficultyStr),
				createdAt: now,
			};
		} catch (error) {
			console.error("createAiExamTemplate Error:", error);
			if (error instanceof GraphQLError) throw error;
			const detail = error instanceof Error ? error.message : String(error);
			throw new GraphQLError(`AI Загварыг хадгалахад алдаа: ${detail}`);
		}
	},
};
