CREATE TABLE `exam_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`format` text NOT NULL,
	`difficulty` text NOT NULL,
	`options_json` text,
	`correct_answer` text,
	`explanation` text,
	`score_point` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`grade_class` text,
	`subject` text,
	`exam_type` text,
	`topic_scope` text,
	`exam_date` text,
	`exam_time` text,
	`duration_minutes` integer,
	`total_question_count` integer,
	`dist_easy` integer,
	`dist_medium` integer,
	`dist_hard` integer,
	`format_easy` text,
	`format_medium` text,
	`format_hard` text,
	`points_easy` integer,
	`points_medium` integer,
	`points_hard` integer,
	`payload_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exams`("id", "status", "grade_class", "subject", "exam_type", "topic_scope", "exam_date", "exam_time", "duration_minutes", "total_question_count", "dist_easy", "dist_medium", "dist_hard", "format_easy", "format_medium", "format_hard", "points_easy", "points_medium", "points_hard", "payload_json", "created_at", "updated_at") SELECT "id", "status", "grade_class", "subject", "exam_type", "topic_scope", "exam_date", "exam_time", "duration_minutes", "total_question_count", "dist_easy", "dist_medium", "dist_hard", "format_easy", "format_medium", "format_hard", "points_easy", "points_medium", "points_hard", "payload_json", "created_at", "updated_at" FROM `exams`;--> statement-breakpoint
DROP TABLE `exams`;--> statement-breakpoint
ALTER TABLE `__new_exams` RENAME TO `exams`;--> statement-breakpoint
PRAGMA foreign_keys=ON;