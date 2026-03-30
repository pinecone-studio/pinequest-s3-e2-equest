-- Extend `school_events` for AI targeting + partial-day locks.
ALTER TABLE `school_events` ADD COLUMN `target_type` text NOT NULL DEFAULT 'ALL';
ALTER TABLE `school_events` ADD COLUMN `start_period_id` integer;
ALTER TABLE `school_events` ADD COLUMN `end_period_id` integer;
ALTER TABLE `school_events` ADD COLUMN `created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000);

-- Add teacher-specific targeting.
CREATE TABLE `school_event_teacher_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `school_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `school_event_teacher_targets_event_id_idx` ON `school_event_teacher_targets` (`event_id`);
CREATE INDEX `school_event_teacher_targets_teacher_id_idx` ON `school_event_teacher_targets` (`teacher_id`);
CREATE UNIQUE INDEX `school_event_teacher_targets_event_teacher_unique` ON `school_event_teacher_targets` (`event_id`,`teacher_id`);

-- Helpful indexes for filtering.
CREATE INDEX `school_events_target_type_idx` ON `school_events` (`target_type`);
CREATE INDEX `school_events_date_range_idx` ON `school_events` (`start_date`,`end_date`);

