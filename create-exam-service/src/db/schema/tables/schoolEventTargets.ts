import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";
import { groups } from "./groups";
import { schoolEvents } from "./schoolEvents";

/**
 * School Event Targets — эвентийн хамрах ангиуд (bridge table).
 * `schoolEvents.isSchoolWide = false` үед ашиглана.
 */
export const schoolEventTargets = sqliteTable("school_event_targets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  eventId: text("event_id")
    .notNull()
    .references(() => schoolEvents.id, { onDelete: "cascade" }),

  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
});

