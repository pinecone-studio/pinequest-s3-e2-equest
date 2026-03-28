import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

import { aiExamTemplates } from "./aiExamTemplates";

/**
 * Асуултын нарийвчилсан сан: AI-ийн санал (сонголт, хариулт, түвшин, tag г.м.)
 * багш засаж баталгаажуулна. Vector search — `vectorId`.
 */
export const aiExamQuestionTemplates = sqliteTable("ai_exam_question_templates", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),

	templateId: text("template_id")
		.notNull()
		.references(() => aiExamTemplates.id, { onDelete: "cascade" }),

	position: integer("position").notNull(),
	/** MCQ | MATH | MATCHING | FILL_IN | FREE_TEXT */
	type: text("type").notNull(),
	aiSuggestedType: text("ai_suggested_type"),

	prompt: text("prompt").notNull(),
	optionsJson: text("options_json"),
	correctAnswer: text("correct_answer"),

	points: integer("points").notNull().default(1),
	difficulty: text("difficulty").notNull().default("MEDIUM"),
	tags: text("tags"),
	skillLevel: text("skill_level"),
	explanation: text("explanation"),
	source: text("source"),

	vectorId: text("vector_id"),

	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
