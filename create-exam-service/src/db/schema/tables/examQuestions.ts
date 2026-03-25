import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Шалгалтын асуултууд (row-per-question).
 *
 * `options_json`: string[] → JSON.stringify хадгална (SQLite/D1-д array төрөл байхгүй).
 */
export const examQuestions = sqliteTable("exam_questions", {
	id: text("id").primaryKey(),
	examId: text("exam_id").notNull(),
	position: integer("position").notNull(),

	text: text("text").notNull(),
	format: text("format").notNull(),
	difficulty: text("difficulty").notNull(),

	optionsJson: text("options_json"),
	correctAnswer: text("correct_answer"),
	explanation: text("explanation"),

	scorePoint: integer("score_point"),

	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

