import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { newExams } from "./newExams";

/**
 * Асуулт бүр — `type`: mcq | math.
 * MCQ: options_json = string[], correct_option = index, correct_answer = зөв сонголтын текст (LaTeX-гүй $).
 */
export const newExamQuestions = sqliteTable("new_exam_questions", {
	id: text("id").primaryKey(),

	examId: text("exam_id")
		.notNull()
		.references(() => newExams.id, { onDelete: "cascade" }),
	position: integer("position").notNull(),

	type: text("type").notNull(),
	prompt: text("prompt").notNull(),
	points: integer("points").notNull(),

	imageAlt: text("image_alt").notNull(),
	imageDataUrl: text("image_data_url"),

	optionsJson: text("options_json"),
	correctOption: integer("correct_option"),
	/** MCQ: зөв сонголтын текст (эх сонголтын LaTeX-аас $ хассан) */
	correctAnswer: text("correct_answer"),

	responseGuide: text("response_guide"),
	answerLatex: text("answer_latex"),

	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
