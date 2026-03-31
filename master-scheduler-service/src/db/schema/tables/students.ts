import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

import { groups } from "./groups";

/**
 * Students — сурагчид; ангийн холбоос (`group_id`) + AI-д шүүлт (gender, status).
 */
export const students = sqliteTable("students", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),

	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),

	studentCode: text("student_code").notNull().unique(),
	email: text("email").unique(),

	groupId: text("group_id")
		.notNull()
		.references(() => groups.id, { onDelete: "cascade" }),

	/** `male` | `female` | `other` */
	gender: text("gender", { enum: ["male", "female", "other"] }),

	/** `active` | `inactive` | `graduated` | `transferred` */
	status: text("status", {
		enum: ["active", "inactive", "graduated", "transferred"],
	})
		.notNull()
		.default("active"),

	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$onUpdateFn(() => new Date()),
});
