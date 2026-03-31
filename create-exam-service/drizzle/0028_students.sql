CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`student_code` text NOT NULL,
	`email` text,
	`group_id` text NOT NULL,
	`gender` text,
	`status` text NOT NULL DEFAULT 'active',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `students_student_code_unique` ON `students` (`student_code`);
CREATE UNIQUE INDEX `students_email_unique` ON `students` (`email`);
