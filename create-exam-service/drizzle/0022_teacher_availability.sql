CREATE TABLE `teacher_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`period_id` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'AVAILABLE',
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `teacher_availability_teacher_id_idx` ON `teacher_availability` (`teacher_id`);
CREATE INDEX `teacher_availability_day_of_week_idx` ON `teacher_availability` (`day_of_week`);
CREATE INDEX `teacher_availability_period_id_idx` ON `teacher_availability` (`period_id`);
CREATE INDEX `teacher_availability_status_idx` ON `teacher_availability` (`status`);
CREATE UNIQUE INDEX `teacher_availability_teacher_day_period_unique` ON `teacher_availability` (`teacher_id`,`day_of_week`,`period_id`);

