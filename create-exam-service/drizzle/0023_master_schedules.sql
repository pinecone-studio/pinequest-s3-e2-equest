CREATE TABLE `master_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`period_id` integer NOT NULL,
	`semester_id` text NOT NULL,
	`is_draft` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curriculum`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE UNIQUE INDEX `room_conflict_idx` ON `master_schedules` (`classroom_id`,`day_of_week`,`period_id`,`semester_id`);
CREATE INDEX `master_schedules_curriculum_id_idx` ON `master_schedules` (`curriculum_id`);
CREATE INDEX `master_schedules_semester_id_idx` ON `master_schedules` (`semester_id`);
CREATE INDEX `master_schedules_is_draft_idx` ON `master_schedules` (`is_draft`);

