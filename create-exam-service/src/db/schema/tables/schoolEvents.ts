import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";
import { periods } from "./periods";

/**
 * School Events (simplified) — holiday / event / meeting.
 * `isFullLock` + targeting logic is used by AI and frontend layers.
 */
export const schoolEvents = sqliteTable("school_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  /** Ж: "Шинэ жил", "Секцийн нээлт" */
  title: text("title").notNull(),

  /**
   * 'HOLIDAY' (Амралт), 'EVENT' (Үйл ажиллагаа), 'MEETING' (Хурал).
   * Frontend дээр `school_event` layer-ийн өнгө/дэд тайлбарт ашиглаж болно.
   */
  eventType: text("event_type").notNull().default("EVENT"),

  /**
   * Хэнд хамааралтай вэ:
   * - ALL: Сургууль даяар (Багш + Сурагч)
   * - TEACHERS: Зөвхөн багш нар
   * - STUDENTS: Зөвхөн сурагчид (анги)
   */
  targetType: text("target_type").notNull().default("ALL"),

  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),

  /**
   * Тодорхой цагийн (Period) хязгаарлалт:
   * Хэрэв эвент өдрийн дундуур эхлэх бол (Ж: 3-р цагаас хойш хуралтай).
   */
  startPeriodId: integer("start_period_id").references(() => periods.id, {
    onDelete: "restrict",
  }),
  endPeriodId: integer("end_period_id").references(() => periods.id, {
    onDelete: "restrict",
  }),

  /** 1 бол хичээл/төлөвлөлт хийхгүй (AI-д full lock), 0 бол зөвхөн мэдээлэл */
  isFullLock: integer("is_full_lock", { mode: "boolean" })
    .notNull()
    .default(false),

  /**
   * Нийт сургууль даяар уу?
   * - true: бүх ангид хамаарна (targets хүснэгт ашиглахгүй байж болно)
   * - false: зөвхөн schoolEventTargets дээрх ангиудад хамаарна
   */
  isSchoolWide: integer("is_school_wide", { mode: "boolean" })
    .notNull()
    .default(true),

  description: text("description"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
