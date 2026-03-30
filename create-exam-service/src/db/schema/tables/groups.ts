import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { classrooms } from "./classrooms";

/**
 * Groups — ангиуд (жишээ: 10A, 12B).
 * AI-д хамгийн гол "Нөөц" болгон ашиглана (student_count workload math).
 */
export const groups = sqliteTable("groups", {
	/**
	 * Ангийн нэр (ID). Жишээ: '10A', '11B', '9G'.
	 * 1-р сургуулийн дотор давхцахгүй тул Primary Key.
	 */
	id: text("id").primaryKey(),

	/** Хэддүгээр анги вэ (1–12). */
	gradeLevel: integer("grade_level").notNull(),

	/** Ангийн сурагчдын тоо. Танхимын багтаамжтай харьцуулна. */
	studentCount: integer("student_count").notNull().default(0),

	/**
	 * Анги удирдсан багш (Advisor) — users.id.
	 * Одоохондоо заавал биш.
	 */
	advisorId: text("advisor_id").references(() => users.id, {
		onDelete: "restrict",
	}),

	/**
	 * Ангийн үндсэн кабинет (Home Classroom) — classrooms.id.
	 * Одоохондоо заавал биш.
	 */
	homeClassroomId: text("home_classroom_id").references(() => classrooms.id, {
		onDelete: "restrict",
	}),

	/**
	 * Хичээллэх ээлж:
	 * 1: Өглөө (08:00–13:00)
	 * 2: Өдөр (13:00–18:00)
	 * 3: Бүтэн өдөр / Орой (сонголт)
	 */
	shift: integer("shift").notNull().default(1),

	/** 1-р сургуулийн онцлог: гүнзгий (Advanced) анги эсэх. */
	isAdvanced: integer("is_advanced", { mode: "boolean" })
		.notNull()
		.default(false),

	/** Ангийн статус: 'ACTIVE' | 'GRADUATED'. */
	status: text("status").notNull().default("ACTIVE"),

	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$onUpdateFn(() => new Date()),
});

