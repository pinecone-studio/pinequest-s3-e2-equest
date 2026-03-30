CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`requires_lab` integer NOT NULL DEFAULT 0,
	`category` text NOT NULL,
	`status` text NOT NULL DEFAULT 'ACTIVE'
);

