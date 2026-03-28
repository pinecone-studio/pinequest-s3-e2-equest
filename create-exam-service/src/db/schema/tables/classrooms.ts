import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

/**
 * Сургуулийн танхим — AI scheduler танхимын багтаамж, давхцлыг тооцно.
 */
export const classrooms = sqliteTable("classrooms", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),
	roomNumber: text("room_number").notNull(),
	capacity: integer("capacity").notNull(),
	isLab: integer("is_lab", { mode: "boolean" }).notNull().default(false),
});
