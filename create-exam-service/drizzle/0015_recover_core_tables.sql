-- Recovery migration (remote): if tables were dropped manually, recreate them.
-- Safe to run even if tables already exist.
PRAGMA foreign_keys = ON;

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

CREATE TABLE IF NOT EXISTS `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`capacity` integer NOT NULL DEFAULT 30,
	`floor` integer,
	`type` text NOT NULL DEFAULT 'NORMAL',
	`has_projector` integer NOT NULL DEFAULT 0,
	`has_smart_board` integer NOT NULL DEFAULT 0,
	`is_shared` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'AVAILABLE',
	`created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	-- legacy columns (still referenced by older seed/scripts)
	`room_number` text NOT NULL,
	`is_lab` integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`grade_level` integer NOT NULL,
	`student_count` integer NOT NULL DEFAULT 0,
	`advisor_id` text,
	`home_classroom_id` text,
	`shift` integer NOT NULL DEFAULT 1,
	`is_advanced` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'ACTIVE',
	`created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	FOREIGN KEY (`advisor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`home_classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE restrict
);

