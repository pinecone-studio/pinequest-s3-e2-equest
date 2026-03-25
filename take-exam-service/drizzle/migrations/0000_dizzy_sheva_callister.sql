CREATE TABLE `answers` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option_id` text,
	PRIMARY KEY(`attempt_id`, `question_id`)
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`status` text NOT NULL,
	`score` integer,
	`max_score` integer,
	`percentage` integer,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE TABLE `questions` (
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
	`order_slot` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`class_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`generator_test_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`grade_level` integer NOT NULL,
	`class_name` text NOT NULL,
	`topic` text NOT NULL,
	`subject` text NOT NULL,
	`time_limit_minutes` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
