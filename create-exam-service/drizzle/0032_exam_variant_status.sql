ALTER TABLE `exam_variants` ADD `status` text NOT NULL DEFAULT 'generated';
ALTER TABLE `exam_variants` ADD `confirmed_at` text;
ALTER TABLE `exam_variants` ADD `saved_at` text;
ALTER TABLE `exam_variants` ADD `saved_exam_id` text REFERENCES `new_exams`(`id`) ON DELETE set null;
