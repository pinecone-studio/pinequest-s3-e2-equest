import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Шалгалт (header / metadata).
 *
 * MVP backward-compat:
 * - `payload_json`-ийг үлдээж байгаа (хуучин өгөгдөлд).
 * - Шинэ урсгал дээр `payload_json` нь optional.
 */
export const exams = sqliteTable("exams", {
	id: text("id").primaryKey(),
	status: text("status").notNull(),
	// Generation (frontend-ээс ирдэг)
	gradeClass: text("grade_class"),
	subject: text("subject"),
	examType: text("exam_type"),
	topicScope: text("topic_scope"),
	examDate: text("exam_date"),
	examTime: text("exam_time"),
	durationMinutes: integer("duration_minutes"),
	totalQuestionCount: integer("total_question_count"),
	// Difficulty distribution
	distEasy: integer("dist_easy"),
	distMedium: integer("dist_medium"),
	distHard: integer("dist_hard"),
	// Formats
	formatEasy: text("format_easy"),
	formatMedium: text("format_medium"),
	formatHard: text("format_hard"),
	// Optional points per difficulty
	pointsEasy: integer("points_easy"),
	pointsMedium: integer("points_medium"),
	pointsHard: integer("points_hard"),

	// Legacy combined payload (optional)
	payloadJson: text("payload_json"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
