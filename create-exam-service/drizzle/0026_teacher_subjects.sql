CREATE TABLE `teacher_subjects` (
	`teacher_id` text NOT NULL,
	`subject_id` text NOT NULL,
	PRIMARY KEY (`teacher_id`, `subject_id`),
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);

