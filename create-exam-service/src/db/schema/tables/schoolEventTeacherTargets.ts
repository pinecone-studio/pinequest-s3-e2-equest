import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";
import { users } from "./users";
import { schoolEvents } from "./schoolEvents";

/**
 * School Event Teacher Targets — эвент зөвхөн тодорхой багш нарт хамаарах үед.
 * `schoolEvents.targetType = 'TEACHERS'` + `isSchoolWide = false` үед ашиглана.
 */
export const schoolEventTeacherTargets = sqliteTable(
  "school_event_teacher_targets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv4()),

    eventId: text("event_id")
      .notNull()
      .references(() => schoolEvents.id, { onDelete: "cascade" }),

    teacherId: text("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
);

