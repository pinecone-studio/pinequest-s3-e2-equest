ALTER TABLE `ai_exam_question_templates` ADD `ai_suggested_type` text;
--> statement-breakpoint
ALTER TABLE `ai_exam_question_templates` ADD `difficulty` text NOT NULL DEFAULT 'MEDIUM';
--> statement-breakpoint
ALTER TABLE `ai_exam_question_templates` ADD `tags` text;
--> statement-breakpoint
ALTER TABLE `ai_exam_question_templates` ADD `skill_level` text;
--> statement-breakpoint
ALTER TABLE `ai_exam_question_templates` ADD `explanation` text;
--> statement-breakpoint
ALTER TABLE `ai_exam_question_templates` ADD `source` text;
