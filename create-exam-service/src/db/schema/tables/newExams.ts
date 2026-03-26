import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Багш `math-exam` UI-аас үүсгэсэн шалгалт (header).
 * mcq_count / math_count / total_points нь хадгалах үеийн бодит тоо.
 */
export const newExams = sqliteTable("new_exams", {
	id: text("id").primaryKey(),

	title: text("title").notNull(),

	mcqCount: integer("mcq_count").notNull(),
	mathCount: integer("math_count").notNull(),
	totalPoints: integer("total_points").notNull(),

	// Нэмэлт (AI generator тохиргоо — optional)
	difficulty: text("difficulty"),
	topics: text("topics"),
	sourceContext: text("source_context"),

	payloadJson: text("payload_json"),

	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
