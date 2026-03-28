CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`room_number` text NOT NULL,
	`capacity` integer NOT NULL,
	`is_lab` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `master_timetable` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`subject_name` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`period` integer NOT NULL,
	`teacher_id` text NOT NULL,
	`room_id` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `exam_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`class_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`room_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`ai_reasoning` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `ai_exam_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE restrict
);
