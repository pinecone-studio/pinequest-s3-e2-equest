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
	errorLog: text("error_log"),
	// Generation (frontend-ээс ирдэг)
	gradeClass: text("grade_class"),
	subject: text("subject"),
	examType: text("exam_type"),
	topicScope: text("topic_scope"),
	examContent: text("exam_content"),
	examDate: text("exam_date"),
	examTime: text("exam_time"),
	durationMinutes: integer("duration_minutes"),
	totalQuestionCount: integer("total_question_count"),
	// Difficulty distribution
	distEasy: integer("dist_easy"),
	distMedium: integer("dist_medium"),
	distHard: integer("dist_hard"),
	// Legacy formats (deprecated; previously used by difficultyFormats)
	formatEasy: text("format_easy"),
	formatMedium: text("format_medium"),
	formatHard: text("format_hard"),
	// Format distribution (new)
	formatSingleChoice: integer("format_single_choice"),
	formatMultipleChoice: integer("format_multiple_choice"),
	formatMatching: integer("format_matching"),
	formatFillIn: integer("format_fill_in"),
	formatWritten: integer("format_written"),
	// Optional points per difficulty
	pointsEasy: integer("points_easy"),
	pointsMedium: integer("points_medium"),
	pointsHard: integer("points_hard"),

	// Legacy combined payload (optional)
	payloadJson: text("payload_json"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
