import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

import { curriculum } from "./curriculum";
import { classrooms } from "./classrooms";
import { periods } from "./periods";

/**
 * Master Schedules (ШИНЭЧЛЭГДСЭН) — Сургуулийн үндсэн хичээлийн хуваарь.
 * AI-ийн санал (isDraft: true) болон Баталгаажсан (isDraft: false) хуваарь энд байна.
 */
export const masterSchedules = sqliteTable(
	"master_schedules",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => uuidv4()),

		/** Curriculum-тай холбосноор: Багш, Анги, Хичээлийн мэдээллийг Join-оор авна */
		curriculumId: text("curriculum_id")
			.notNull()
			.references(() => curriculum.id, { onDelete: "cascade" }),

		/** Танхим */
		classroomId: text("classroom_id")
			.notNull()
			.references(() => classrooms.id, { onDelete: "restrict" }),

		/** Долоо хоногийн өдөр (1: Даваа, 5: Баасан) */
		dayOfWeek: integer("day_of_week").notNull(),

		/** Хичээл эхлэх цаг (Periods хүснэгтийн ID) */
		periodId: integer("period_id")
			.notNull()
			.references(() => periods.id, { onDelete: "restrict" }),

		/** Хичээлийн жил/улирал (Ж: '2026-SPRING') */
		semesterId: text("semester_id").notNull(),

		/**
		 * 1 (true)  = AI-ийн санал (Frontend: ai_draft layer)
		 * 0 (false) = Сургуулийн баталгаажсан үндсэн хуваарь (Frontend: primary layer)
		 */
		isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(true),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		/** Өрөө, Цаг, Өдрийн давхцлыг баазын түвшинд 100% хаана */
		roomConflictIdx: uniqueIndex("room_conflict_idx").on(
			table.classroomId,
			table.dayOfWeek,
			table.periodId,
			table.semesterId,
		),
	}),
);

