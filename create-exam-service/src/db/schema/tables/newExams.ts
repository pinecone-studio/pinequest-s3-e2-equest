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

	/** Ерөнхий мэдээлэл (math-exam session metadata) */
	grade: integer("grade"),
	groupClass: text("group_class"),
	examType: text("exam_type"),
	sessionSubject: text("session_subject"),
	sessionTopicsJson: text("session_topics_json"),
	/** AI scheduler / багш — сонголттой */
	teacherId: text("teacher_id"),
	/** Өрөө — сонголттой */
	roomId: text("room_id"),
	examDate: text("exam_date"),
	startTime: text("start_time"),
	endTime: text("end_time"),
	durationMinutes: integer("duration_minutes"),
	mixQuestions: integer("mix_questions"),
	withVariants: integer("with_variants"),
	variantCount: integer("variant_count"),
	sessionDescription: text("session_description"),

	payloadJson: text("payload_json"),

	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
