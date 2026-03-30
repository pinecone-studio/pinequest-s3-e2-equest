CREATE TABLE `school_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`event_type` text NOT NULL DEFAULT 'EVENT',
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`is_full_lock` integer NOT NULL DEFAULT 0,
	`is_school_wide` integer NOT NULL DEFAULT 1,
	`description` text
);

CREATE TABLE `school_event_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`group_id` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `school_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `school_event_targets_event_id_idx` ON `school_event_targets` (`event_id`);
CREATE INDEX `school_event_targets_group_id_idx` ON `school_event_targets` (`group_id`);
CREATE UNIQUE INDEX `school_event_targets_event_group_unique` ON `school_event_targets` (`event_id`,`group_id`);

