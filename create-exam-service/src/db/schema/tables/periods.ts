import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Periods — 1/2-р ээлжийн цагийн бүтэц.
 * Ж: Өглөө 1–7, Өдөр 1–7 (нийт 14 мөр гэх мэт).
 */
export const periods = sqliteTable("periods", {
	/** 1..14 гэх мэт (global unique) */
	id: integer("id").primaryKey(),

	/** 1: Өглөө, 2: Өдөр */
	shift: integer("shift").notNull(),

	/** Ээлж доторх дугаар: 1–7 */
	periodNumber: integer("period_number").notNull(),

	/** "07:45" */
	startTime: text("start_time").notNull(),

	/** "08:25" */
	endTime: text("end_time").notNull(),

	breakMinutes: integer("break_minutes").notNull().default(5),
});

