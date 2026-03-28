CREATE TABLE `ai_exam_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`grade` integer NOT NULL,
	`teacher_id` text NOT NULL,
	`duration_minutes` integer NOT NULL DEFAULT 60,
	`difficulty` text NOT NULL DEFAULT 'MEDIUM',
	`total_points` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
