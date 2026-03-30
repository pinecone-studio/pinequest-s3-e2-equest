CREATE TABLE `periods` (
	`id` integer PRIMARY KEY NOT NULL,
	`shift` integer NOT NULL,
	`period_number` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_minutes` integer NOT NULL DEFAULT 5
);

