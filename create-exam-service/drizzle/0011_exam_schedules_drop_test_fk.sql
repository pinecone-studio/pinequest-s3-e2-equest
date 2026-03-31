PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_exam_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`class_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`room_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`ai_reasoning` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`ai_variants_json` text,
	FOREIGN KEY (`room_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_exam_schedules`(`id`, `test_id`, `class_id`, `start_time`, `end_time`, `room_id`, `status`, `ai_reasoning`, `created_at`, `updated_at`, `ai_variants_json`)
SELECT `id`, `test_id`, `class_id`, `start_time`, `end_time`, `room_id`, `status`, `ai_reasoning`, `created_at`, `updated_at`, `ai_variants_json` FROM `exam_schedules`;
--> statement-breakpoint
DROP TABLE `exam_schedules`;
--> statement-breakpoint
ALTER TABLE `__new_exam_schedules` RENAME TO `exam_schedules`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
