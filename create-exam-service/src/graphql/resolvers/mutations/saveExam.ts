import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../../context";
import { examQuestions, exams } from "../../../db/schema";
import type { SaveExamInput } from "../../generated/resolvers-types";

type SaveExamArgs = { input: SaveExamInput };

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
		const points = gen?.difficultyPoints as any;
		const fmt = gen?.formatDistribution as any;
		const errorLog =
			input.errorLog == null ? null : String(input.errorLog).slice(0, 5000);

		await ctx.db
			.insert(exams)
			.values({
				id,
				status: input.status,
				errorLog,
				gradeClass: typeof gen?.gradeClass === "string" ? gen.gradeClass : null,
				subject: typeof gen?.subject === "string" ? gen.subject : null,
				examType: typeof gen?.examType === "string" ? gen.examType : null,
				topicScope: typeof gen?.topicScope === "string" ? gen.topicScope : null,
				examContent:
					typeof gen?.examContent === "string" ? gen.examContent : null,
				examDate: typeof gen?.examDate === "string" ? gen.examDate : null,
				examTime: typeof gen?.examTime === "string" ? gen.examTime : null,
				durationMinutes:
					typeof gen?.durationMinutes === "number" ? gen.durationMinutes : null,
				totalQuestionCount:
					typeof gen?.totalQuestionCount === "number" ? gen.totalQuestionCount : null,
				distEasy: typeof dist?.easy === "number" ? dist.easy : null,
				distMedium: typeof dist?.medium === "number" ? dist.medium : null,
				distHard: typeof dist?.hard === "number" ? dist.hard : null,
				formatEasy: null,
				formatMedium: null,
				formatHard: null,
				formatSingleChoice:
					typeof fmt?.singleChoice === "number" ? fmt.singleChoice : null,
				formatMultipleChoice:
					typeof fmt?.multipleChoice === "number" ? fmt.multipleChoice : null,
				formatMatching: typeof fmt?.matching === "number" ? fmt.matching : null,
				formatFillIn: typeof fmt?.fillIn === "number" ? fmt.fillIn : null,
				formatWritten: typeof fmt?.written === "number" ? fmt.written : null,
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
					errorLog,
					gradeClass: typeof gen?.gradeClass === "string" ? gen.gradeClass : null,
					subject: typeof gen?.subject === "string" ? gen.subject : null,
					examType: typeof gen?.examType === "string" ? gen.examType : null,
					topicScope: typeof gen?.topicScope === "string" ? gen.topicScope : null,
					examContent:
						typeof gen?.examContent === "string" ? gen.examContent : null,
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
					formatEasy: null,
					formatMedium: null,
					formatHard: null,
					formatSingleChoice:
						typeof fmt?.singleChoice === "number" ? fmt.singleChoice : null,
					formatMultipleChoice:
						typeof fmt?.multipleChoice === "number" ? fmt.multipleChoice : null,
					formatMatching:
						typeof fmt?.matching === "number" ? fmt.matching : null,
					formatFillIn: typeof fmt?.fillIn === "number" ? fmt.fillIn : null,
					formatWritten:
						typeof fmt?.written === "number" ? fmt.written : null,
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

		const rows = (input.questions ?? []).map((q, idx: number) => {
			const qq = q as any;
			const options =
				Array.isArray(qq?.options) && qq.options.length
					? (qq.options as unknown[]).filter((x) => typeof x === "string")
					: null;
			return {
				id: typeof qq?.id === "string" ? qq.id : `${id}-${idx + 1}`,
				examId: id,
				position: idx + 1,
				text: typeof qq?.text === "string" ? qq.text : "",
				format: typeof qq?.format === "string" ? qq.format : "SINGLE_CHOICE",
				difficulty: typeof qq?.difficulty === "string" ? qq.difficulty : "MEDIUM",
				optionsJson: options ? JSON.stringify(options) : null,
				correctAnswer: qq?.correctAnswer == null ? null : String(qq.correctAnswer),
				explanation: qq?.explanation == null ? null : String(qq.explanation),
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
			errorLog,
			createdAt,
			updatedAt: now,
		};
	},
};
