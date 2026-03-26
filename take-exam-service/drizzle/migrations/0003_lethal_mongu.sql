PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_answers` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option_id` text,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_answers`("attempt_id", "question_id", "selected_option_id") SELECT "attempt_id", "question_id", "selected_option_id" FROM `answers`;--> statement-breakpoint
DROP TABLE `answers`;--> statement-breakpoint
ALTER TABLE `__new_answers` RENAME TO `answers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`shuffle_manifest` text,
	`status` text NOT NULL,
	`score` integer,
	`max_score` integer,
	`percentage` integer,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "test_id", "student_id", "student_name", "shuffle_manifest", "status", "score", "max_score", "percentage", "started_at", "expires_at", "submitted_at") SELECT "id", "test_id", "student_id", "student_name", "shuffle_manifest", "status", "score", "max_score", "percentage", "started_at", "expires_at", "submitted_at" FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_test_student_unique_idx` ON `attempts` (`test_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`correct_option_id` text NOT NULL,
	`explanation` text NOT NULL,
	`points` integer NOT NULL,
	`competency` text NOT NULL,
	`image_url` text,
	`audio_url` text,
	`video_url` text,
	`order_slot` integer NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `tests`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "test_id", "prompt", "options", "correct_option_id", "explanation", "points", "competency", "image_url", "audio_url", "video_url", "order_slot") SELECT "id", "test_id", "prompt", "options", "correct_option_id", "explanation", "points", "competency", "image_url", "audio_url", "video_url", "order_slot" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;