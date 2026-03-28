import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

/**
 * AI-assisted шалгалтын ерөнхий загвар: багш санал болгосон утгуудыг засаж баталгаажуулна.
 * (Vector search-ийн асуултын мета — `ai_exam_question_templates`.)
 */
export const aiExamTemplates = sqliteTable("ai_exam_templates", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),

	// 1. Үндсэн мэдээлэл
	title: text("title").notNull(),
	subject: text("subject").notNull(),
	grade: integer("grade").notNull(),
	teacherId: text("teacher_id").notNull(),

	// 2. AI-ийн санал + багшийн баталгаажуулсан утгууд
	durationMinutes: integer("duration_minutes").notNull().default(60),
	difficulty: text("difficulty").notNull().default("MEDIUM"),
	totalPoints: integer("total_points").notNull().default(0),

	// 3. Түүх
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
