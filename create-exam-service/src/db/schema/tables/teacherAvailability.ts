import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";
import { periods } from "./periods";
import { users } from "./users";

/**
 * Teacher Availability — багшийн боломжит/завгүй/сонголттой цаг.
 * AI scheduler энэ хүснэгтийг "busy/preference" сигнал болгон ашиглана.
 */
export const teacherAvailability = sqliteTable("teacher_availability", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /** 1 = Даваа … 7 = Ням (эсвэл 1–5 ажлын өдрүүд). */
  dayOfWeek: integer("day_of_week").notNull(),

  periodId: integer("period_id")
    .notNull()
    .references(() => periods.id, { onDelete: "restrict" }),

  /**
   * 'AVAILABLE'  - Хичээл тавьж болно
   * 'BUSY'       - Багш завгүй (AI энд хичээл төлөвлөхгүй)
   * 'PREFERENCE' - Багш орох дуртай цаг
   */
  status: text("status").notNull().default("AVAILABLE"),

  /** Багшийн оруулсан тайлбар (Ж: "Хувийн ажилтай", "Google Calendar-аас") */
  reason: text("reason"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

