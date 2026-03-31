import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { groups } from "./groups";
import { schoolEvents } from "./schoolEvents";

/**
 * School Event Targets — эвентийн хамрах ангиуд (bridge table).
 * `schoolEvents.isSchoolWide = false` үед ашиглана.
 */
export const schoolEventTargets = sqliteTable(
  "school_event_targets",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => schoolEvents.id, { onDelete: "cascade" }),

    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventId, table.groupId] }),
  }),
);

