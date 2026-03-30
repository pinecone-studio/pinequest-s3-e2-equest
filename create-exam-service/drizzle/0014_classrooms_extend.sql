-- If the table was dropped manually on remote, recreate minimal legacy table first.
-- Keep legacy columns because other tables (and seed) still reference them.
CREATE TABLE IF NOT EXISTS `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`room_number` text NOT NULL,
	`capacity` integer NOT NULL DEFAULT 30,
	`is_lab` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `name` text;
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `floor` integer;
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `type` text NOT NULL DEFAULT 'NORMAL';
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `has_projector` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `has_smart_board` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `is_shared` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `status` text NOT NULL DEFAULT 'AVAILABLE';
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000);
--> statement-breakpoint
ALTER TABLE `classrooms` ADD `updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000);

