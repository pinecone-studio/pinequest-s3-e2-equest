import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Сургуулийн танхим — AI scheduler танхимын багтаамж, давхцлыг тооцно.
 */
export const classrooms = sqliteTable("classrooms", {
  /**
   * Танхимын ID (Ж: '304', '405', 'LAB_PHYSICS').
   * Primary Key.
   */
  id: text("id").primaryKey(),

  /**
   * Legacy (хуучин migration-уудтай нийцүүлэх зорилготой).
   * Зарим орчинд `room_number` NOT NULL хэвээр байгаа тул schema-д тусгав.
   */
  roomNumber: text("room_number").notNull(),

  /** Танхимын нэр (нэмэлт). Ж: 'Математикийн кабинет'. */
  name: text("name"),

  /** Суудлын тоо. AI ангийн хүүхдийн тоотой харьцуулж шалгана. */
  capacity: integer("capacity").notNull().default(30),

  /** Байрлах давхар. */
  floor: integer("floor"),

  /**
   * Төрөл: 'NORMAL' | 'LAB' | 'GYM' | 'LECTURE'
   */
  type: text("type").notNull().default("NORMAL"),

  /**
   * D1 boolean-уудыг 0/1 integer-ээр хадгална.
   * 0 = false, 1 = true
   */
  hasProjector: integer("has_projector").notNull().default(0),
  hasSmartBoard: integer("has_smart_board").notNull().default(0),
  // Дундаа ашиглах боломжтой эсвэл олон зорилгоор ашиглагддаг
  isShared: integer("is_shared").notNull().default(0),

  /** Legacy boolean (хуучин migration-уудын `is_lab`). */
  isLab: integer("is_lab", { mode: "boolean" }).notNull().default(false),

  /**
   * Танхимын төлөв:
   * 'AVAILABLE' | 'MAINTENANCE' | 'RESERVED'
   */
  status: text("status").notNull().default("AVAILABLE"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$onUpdateFn(() => new Date()),

});
