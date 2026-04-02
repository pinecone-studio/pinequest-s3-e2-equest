import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { newExams } from "./newExams";

export const examVariantJobs = sqliteTable("exam_variant_jobs", {
	id: text("id").primaryKey(),

	examId: text("exam_id").references(() => newExams.id, { onDelete: "set null" }),
	status: text("status").notNull(),
	variantCount: integer("variant_count").notNull(),

	requestedBy: text("requested_by"),
	sourceQuestionsJson: text("source_questions_json").notNull(),
	resultJson: text("result_json"),
	errorMessage: text("error_message"),

	requestedAt: text("requested_at").notNull(),
	startedAt: text("started_at"),
	completedAt: text("completed_at"),
	updatedAt: text("updated_at").notNull(),
});
