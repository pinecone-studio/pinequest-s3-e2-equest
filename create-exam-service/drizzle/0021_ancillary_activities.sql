CREATE TABLE `ancillary_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`exam_template_id` text,
	`teacher_id` text NOT NULL,
	`group_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`date` integer NOT NULL,
	`period_id` integer NOT NULL,
	`duration_minutes` integer,
	`status` text NOT NULL DEFAULT 'DRAFT',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`exam_template_id`) REFERENCES `ai_exam_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX `ancillary_activities_teacher_id_idx` ON `ancillary_activities` (`teacher_id`);
CREATE INDEX `ancillary_activities_group_id_idx` ON `ancillary_activities` (`group_id`);
CREATE INDEX `ancillary_activities_classroom_id_idx` ON `ancillary_activities` (`classroom_id`);
CREATE INDEX `ancillary_activities_date_idx` ON `ancillary_activities` (`date`);
CREATE INDEX `ancillary_activities_status_idx` ON `ancillary_activities` (`status`);
CREATE INDEX `ancillary_activities_period_id_idx` ON `ancillary_activities` (`period_id`);

