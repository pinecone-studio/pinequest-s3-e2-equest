import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

import { groups } from "./groups";
import { subjects } from "./subjects";
import { users } from "./users";

/**
 * Curriculum — анги+хичээл+багшийн хослол, долоо хоногийн норм.
 * Үндсэн хуваарь (master_timetable) үүсгэх/баталгаажуулахад суурь болно.
 */
export const curriculum = sqliteTable("curriculum", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "restrict" }),

  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "restrict" }),

  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  /** 7 хоногийн нийт цаг */
  // 7 хоногийн турш нийт орох ёстой хичээлийн тоо.
  weeklyHours: integer("weekly_hours").notNull(),

  /** 1: дан, 2: блок */
  hoursPerSession: integer("hours_per_session").notNull().default(1),

  /** '2026-SPRING' гэх мэт */
  semesterId: text("semester_id").notNull(),

  status: text("status").notNull().default("ACTIVE"),
});
