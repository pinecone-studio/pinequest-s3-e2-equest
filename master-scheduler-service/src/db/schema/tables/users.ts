import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

/**
 * Users — багш нар болон ажилтнууд.
 * Google Calendar синк хийхэд хэрэгтэй token + багшийн эрх.
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),

  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),

  shortName: text("short_name"),

  // Одоохондоо заавал биш (нэг имэйл давтагдахгүй байхад unique)
  email: text("email").unique(),

  department: text("department").notNull(), // 'MATH', 'PHYSICS'

  /**
   * Түвшнийг хадгалах хэлбэр:
   * 1. "ELEMENTARY" (Зөвхөн бага)
   * 2. "MIDDLE,HIGH" (Дунд болон ахлах)
   * 3. "MIDDLE" (Зөвхөн дунд)
   * 4. "ALL" (Бүх ангид)
   */
  teachingLevel: text("teaching_level").notNull().default("MIDDLE"),

  role: text("role").notNull().default("TEACHER"), // 'TEACHER', 'ADMIN'

  /** Өдөрт орох дээд ачааллын хязгаар (AI давж төлөвлөхгүй). */
  // тухайн багшийн өдөрт орж болох хамгийн их "цаг" (Period)-ийн тоо юм
  workLoadLimit: integer("work_load_limit").notNull().default(6),

  // Created/Updated — AI scheduler дээр бат бөх audit хийхэд зориулав
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    // Drizzle update үед автоматаар updated_at refresh хийхэд хэрэглэнэ
    .$onUpdateFn(() => new Date()),
});
