import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Draft / батлагдсан шалгалт — `payload_json` дотор generation + questions (JSON).
 */
export const exams = sqliteTable("exams", {
	id: text("id").primaryKey(),
	status: text("status").notNull(),
	payloadJson: text("payload_json").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
