import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Subjects — хичээлийн төрөл (MATH_HS, PHYS_LAB гэх мэт).
 * AI нь classroom.type болон requires_lab-г харьцуулж өрөө сонгоно.
 */
export const subjects = sqliteTable("subjects", {
	/** 'MATH_HS', 'PHYS_LAB' гэх мэт */
	id: text("id").primaryKey(),

	name: text("name").notNull(),

	/** 0: энгийн, 1: лаборатори */
	requiresLab: integer("requires_lab").notNull().default(0),

	/** 'STEM' | 'LANGUAGE' | 'HUMANITY' | 'ART_SPORT' */
	category: text("category").notNull(),

	/**
	 * Ангийн түвшин:
	 * 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'ALL'
	 */
	level: text("level").notNull().default("MIDDLE"),

	status: text("status").notNull().default("ACTIVE"),
});

