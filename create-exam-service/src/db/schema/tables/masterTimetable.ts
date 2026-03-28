import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

import { classrooms } from "./classrooms";

/**
 * Үндсэн хичээлийн хуваарь (Digital Twin) — AI эндээс давхцлыг шалгана.
 */
export const masterTimetable = sqliteTable("master_timetable", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),
	classId: text("class_id").notNull(),
	subjectName: text("subject_name").notNull(),
	/** 1 = Даваа … 5 = Баасан */
	dayOfWeek: integer("day_of_week").notNull(),
	/** 1–8: цагийн дугаар */
	period: integer("period").notNull(),
	teacherId: text("teacher_id").notNull(),
	roomId: text("room_id")
		.notNull()
		.references(() => classrooms.id, { onDelete: "restrict" }),
});
