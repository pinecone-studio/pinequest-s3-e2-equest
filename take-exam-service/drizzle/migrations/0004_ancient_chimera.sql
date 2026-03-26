PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`generator_test_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`grade_level` integer NOT NULL,
	`class_name` text NOT NULL,
	`topic` text NOT NULL,
	`subject` text NOT NULL,
	`time_limit_minutes` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tests`("id", "generator_test_id", "title", "description", "grade_level", "class_name", "topic", "subject", "time_limit_minutes", "status", "created_at", "updated_at") SELECT "id", "generator_test_id", "title", "description", "grade_level", "class_name", "topic", "subject", "time_limit_minutes", "status", "created_at", "updated_at" FROM `tests`;--> statement-breakpoint
DROP TABLE `tests`;--> statement-breakpoint
ALTER TABLE `__new_tests` RENAME TO `tests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `attempts` ADD `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
CREATE INDEX `attempts_student_idx` ON `attempts` (`student_id`);--> statement-breakpoint
CREATE INDEX `questions_test_order_idx` ON `questions` (`test_id`,`order_slot`);