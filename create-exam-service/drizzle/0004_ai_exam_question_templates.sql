CREATE TABLE `ai_exam_question_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options_json` text,
	`correct_answer` text,
	`points` integer NOT NULL DEFAULT 1,
	`vector_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `ai_exam_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
