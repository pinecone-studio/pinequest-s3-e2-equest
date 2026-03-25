import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import { examQuestions, exams } from "../../../db/schema";

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

		const gen = input.generation as any;
		const dist = gen?.difficultyDistribution as any;
		const formats = gen?.difficultyFormats as any;
		const points = gen?.difficultyPoints as any;

		await ctx.db
			.insert(exams)
			.values({
				id,
				status: input.status,
				gradeClass: typeof gen?.gradeClass === "string" ? gen.gradeClass : null,
				subject: typeof gen?.subject === "string" ? gen.subject : null,
				examType: typeof gen?.examType === "string" ? gen.examType : null,
				topicScope: typeof gen?.topicScope === "string" ? gen.topicScope : null,
				examDate: typeof gen?.examDate === "string" ? gen.examDate : null,
				examTime: typeof gen?.examTime === "string" ? gen.examTime : null,
				durationMinutes:
					typeof gen?.durationMinutes === "number" ? gen.durationMinutes : null,
				totalQuestionCount:
					typeof gen?.totalQuestionCount === "number" ? gen.totalQuestionCount : null,
				distEasy: typeof dist?.easy === "number" ? dist.easy : null,
				distMedium: typeof dist?.medium === "number" ? dist.medium : null,
				distHard: typeof dist?.hard === "number" ? dist.hard : null,
				formatEasy: typeof formats?.easy === "string" ? formats.easy : null,
				formatMedium: typeof formats?.medium === "string" ? formats.medium : null,
				formatHard: typeof formats?.hard === "string" ? formats.hard : null,
				pointsEasy:
					typeof points?.easyPoints === "number" ? Math.round(points.easyPoints) : null,
				pointsMedium:
					typeof points?.mediumPoints === "number"
						? Math.round(points.mediumPoints)
						: null,
				pointsHard:
					typeof points?.hardPoints === "number" ? Math.round(points.hardPoints) : null,
				payloadJson,
				createdAt,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: exams.id,
				set: {
					status: input.status,
					gradeClass: typeof gen?.gradeClass === "string" ? gen.gradeClass : null,
					subject: typeof gen?.subject === "string" ? gen.subject : null,
					examType: typeof gen?.examType === "string" ? gen.examType : null,
					topicScope: typeof gen?.topicScope === "string" ? gen.topicScope : null,
					examDate: typeof gen?.examDate === "string" ? gen.examDate : null,
					examTime: typeof gen?.examTime === "string" ? gen.examTime : null,
					durationMinutes:
						typeof gen?.durationMinutes === "number" ? gen.durationMinutes : null,
					totalQuestionCount:
						typeof gen?.totalQuestionCount === "number"
							? gen.totalQuestionCount
							: null,
					distEasy: typeof dist?.easy === "number" ? dist.easy : null,
					distMedium: typeof dist?.medium === "number" ? dist.medium : null,
					distHard: typeof dist?.hard === "number" ? dist.hard : null,
					formatEasy: typeof formats?.easy === "string" ? formats.easy : null,
					formatMedium: typeof formats?.medium === "string" ? formats.medium : null,
					formatHard: typeof formats?.hard === "string" ? formats.hard : null,
					pointsEasy:
						typeof points?.easyPoints === "number"
							? Math.round(points.easyPoints)
							: null,
					pointsMedium:
						typeof points?.mediumPoints === "number"
							? Math.round(points.mediumPoints)
							: null,
					pointsHard:
						typeof points?.hardPoints === "number"
							? Math.round(points.hardPoints)
							: null,
					payloadJson,
					updatedAt: now,
				},
			});

		// Questions: simplify by replace-all per examId.
		await ctx.db.delete(examQuestions).where(eq(examQuestions.examId, id));

		const rows = (input.questions ?? []).map((q: any, idx: number) => {
			const options =
				Array.isArray(q?.options) && q.options.length
					? (q.options as unknown[]).filter((x) => typeof x === "string")
					: null;
			return {
				id: typeof q?.id === "string" ? q.id : `${id}-${idx + 1}`,
				examId: id,
				position: idx + 1,
				text: typeof q?.text === "string" ? q.text : "",
				format: typeof q?.format === "string" ? q.format : "SINGLE_CHOICE",
				difficulty: typeof q?.difficulty === "string" ? q.difficulty : "MEDIUM",
				optionsJson: options ? JSON.stringify(options) : null,
				correctAnswer: q?.correctAnswer == null ? null : String(q.correctAnswer),
				explanation: q?.explanation == null ? null : String(q.explanation),
				scorePoint: null,
				createdAt: now,
				updatedAt: now,
			};
		});

		if (rows.length) {
			await ctx.db.insert(examQuestions).values(rows);
		}

		return {
			examId: id,
			status: input.status,
		};
	},
};
