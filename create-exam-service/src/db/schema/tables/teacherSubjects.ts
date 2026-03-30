import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { subjects } from "./subjects";
import { users } from "./users";

/**
 * Teacher ↔ Subject холбоос (many-to-many).
 * Нэг багш нэг хичээл дээр 2 удаа бүртгэгдэхээс хамгаалж composite PK ашиглана.
 */
export const teacherSubjects = sqliteTable(
  "teacher_subjects",
  {
    teacherId: text("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teacherId, table.subjectId] }),
  }),
);

