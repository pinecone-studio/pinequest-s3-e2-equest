import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

import { classrooms } from "./classrooms";

/**
 * Шалгалтын цагийн санал / батлагдсан хуваарь (AI scheduler үр дүн).
 */
export const examSchedules = sqliteTable("exam_schedules", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),
	/** Scheduler-ээр төлөвлөж буй шалгалтын ID (`new_exams.id` зэрэг upstream эх сурвалжийн ID). */
	testId: text("test_id").notNull(),
	classId: text("class_id").notNull(),
	startTime: integer("start_time", { mode: "timestamp" }).notNull(),
	/** AI батлах хүртэл null (pending) */
	endTime: integer("end_time", { mode: "timestamp" }),
	/** AI танхим сонгох хүртэл null (pending) */
	roomId: text("room_id").references(() => classrooms.id, {
		onDelete: "restrict",
	}),
	status: text("status").notNull().default("pending"),
	/** AI-ийн 2–3 хувилбар (JSON array) — `suggested` үед; баталгаажсны дараа хоосон болно */
	aiVariantsJson: text("ai_variants_json"),
	aiReasoning: text("ai_reasoning"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
