CREATE TABLE `curriculum` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`weekly_hours` integer NOT NULL,
	`hours_per_session` integer NOT NULL DEFAULT 1,
	`semester_id` text NOT NULL,
	`status` text NOT NULL DEFAULT 'ACTIVE',
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);

