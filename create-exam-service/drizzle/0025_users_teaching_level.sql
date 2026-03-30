-- Remote drift guard: some DBs may be missing `users` table.
-- Create minimal `users` table (legacy shape) if absent, then add `teaching_level`.
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`short_name` text,
	`email` text UNIQUE,
	`department` text NOT NULL,
	`role` text NOT NULL DEFAULT 'TEACHER',
	`work_load_limit` integer NOT NULL DEFAULT 6,
	`created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

ALTER TABLE `users` ADD COLUMN `teaching_level` text NOT NULL DEFAULT 'MIDDLE';