CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`error_log` text,
	`grade_class` text,
	`subject` text,
	`exam_type` text,
	`topic_scope` text,
	`exam_content` text,
	`exam_date` text,
	`exam_time` text,
	`duration_minutes` integer,
	`total_question_count` integer,
	`dist_easy` integer,
	`dist_medium` integer,
	`dist_hard` integer,
	`format_single_choice` integer,
	`format_multiple_choice` integer,
	`format_matching` integer,
	`format_fill_in` integer,
	`format_written` integer,
	`points_easy` integer,
	`points_medium` integer,
	`points_hard` integer,
	`payload_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
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
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `new_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`mcq_count` integer NOT NULL,
	`math_count` integer NOT NULL,
	`total_points` integer NOT NULL,
	`difficulty` text,
	`topics` text,
	`source_context` text,
	`payload_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `new_exam_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`points` integer NOT NULL,
	`image_alt` text NOT NULL,
	`image_data_url` text,
	`options_json` text,
	`correct_option` integer,
	`correct_answer` text,
	`response_guide` text,
	`answer_latex` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `new_exams`(`id`) ON UPDATE no action ON DELETE cascade
);
