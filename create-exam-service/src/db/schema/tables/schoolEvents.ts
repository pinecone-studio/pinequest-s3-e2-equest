import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";
import { periods } from "./periods";

/**
 * School Events — сургуулийн нийтлэг үйл ажиллагаа, амралт, шалгалт.
 * AI planning болон frontend layer-үүд event metadata-г эндээс уншина.
 */
export const schoolEvents = sqliteTable("school_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  /** Ж: "Шинэ жил", "Секцийн нээлт" */
  title: text("title").notNull(),

  /** Event taxonomy: AI locking behavior болон UI тайлбарт ашиглана. */
  eventType: text("event_type", {
    enum: [
      "HOLIDAY",
      "EXAM",
      "TEACHER_DEVELOPMENT",
      "EXTRACURRICULAR",
      "PARENT_MEETING",
      "MAINTENANCE",
      "TRIP",
      "EVENT",
    ],
  })
    .notNull()
    .default("EVENT"),

  /**
   * Priority (1-4):
   * 1=Low, 2=Normal, 3=High, 4=Critical/Hard Lock.
   */
  // (Алинаас нь эхлэх вэ?): Энэ нь "ач холбогдлын дараалал".
  priority: integer("priority").notNull().default(2),

  /**
   * Urgency:
   * - REQUIRED: AI заавал мөрдөнө
   * - FLEXIBLE: шаардлагатай бол өөрчилж/шилжүүлж болно
   */
  // тухайн эвент "хөдөлж болох уу?" гэдгийг заана.
  urgencyLevel: text("urgency_level", {
    enum: ["REQUIRED", "FLEXIBLE"],
  })
    .notNull()
    .default("REQUIRED"),

  /**
   * Хэнд хамааралтай вэ:
   * - ALL: Сургууль даяар (Багш + Сурагч)
   * - TEACHERS: Зөвхөн багш нар
   * - STUDENTS: Зөвхөн сурагчид (анги)
   */
  // Энэ нь тухайн эвент хэнд хамааралтай вэ гэдгийг шүүнэ.
  // Энэ талбар байхгүй бол бүх эвент бүх хүнд харагдаж, бүх хүний хуваарийг түгжих гээд байдаг.
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

  /**
   * Давтагдах хэв маяг:
   * NONE | DAILY | WEEKLY | MONTHLY
   */
  repeatPattern: text("repeat_pattern", {
    enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY"],
  })
    .notNull()
    .default("NONE"),

  /** 1 бол AI энэ цонхонд юу ч төлөвлөхгүй (hard lock). */
  isFullLock: integer("is_full_lock", { mode: "boolean" })
    .notNull()
    .default(true),

  /**
   * Нийт сургууль даяар уу?
   * - true: бүх ангид хамаарна (targets хүснэгт ашиглахгүй байж болно)
   * - false: зөвхөн schoolEventTargets дээрх ангиудад хамаарна
   */
  isSchoolWide: integer("is_school_wide", { mode: "boolean" })
    .notNull()
    .default(true),

  /** UI layer дээр event-ийг ялгах override өнгө. */
  colorCode: text("color_code").default("#3b82f6"),

  description: text("description"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
