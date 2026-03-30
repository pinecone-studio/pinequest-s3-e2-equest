import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";
import { aiExamTemplates } from "./aiExamTemplates";
import { classrooms } from "./classrooms";
import { groups } from "./groups";
import { periods } from "./periods";
import { users } from "./users";

/**
 * Ancillary Activities — Шалгалт, давтлага, секц зэрэг үндсэн бус үйл ажиллагаа.
 * AI-ийн санал (ai_draft) болон баталгаажсан (confirmed_exam, ancillary_confirmed)
 * layer-үүдэд ашиглана.
 */
export const ancillaryActivities = sqliteTable("ancillary_activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  /** 'EXAM' | 'TUTORIAL' | 'CLUB' */
  type: text("type").notNull(),

  /**
   * Нэмэлт гарчиг (optional). null бол frontend дээр join хийж display title үүсгэнэ.
   */
  title: text("title"),

  /** Хэрэв type === 'EXAM' бол AI Exam Template-тэй холбогдоно. */
  examTemplateId: text("exam_template_id").references(() => aiExamTemplates.id, {
    onDelete: "set null",
  }),

  /** Нөөцүүд: Хэн, Хаана, Аль ангид */
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),

  classroomId: text("classroom_id")
    .notNull()
    .references(() => classrooms.id, { onDelete: "cascade" }),

  /** Хугацаа (өдөр/агшин) */
  date: integer("date", { mode: "timestamp" }).notNull(),

  /** Хичээл эхлэх цаг (Period-ийн ID) */
  periodId: integer("period_id")
    .notNull()
    .references(() => periods.id, { onDelete: "restrict" }),

  /**
   * Үргэлжлэх хугацаа (минутаар):
   * NULL эсвэл 0 бол 1 стандарт period гэж үзнэ.
   */
  durationMinutes: integer("duration_minutes"),

  /** 'DRAFT' | 'CONFIRMED' */
  status: text("status").notNull().default("DRAFT"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

