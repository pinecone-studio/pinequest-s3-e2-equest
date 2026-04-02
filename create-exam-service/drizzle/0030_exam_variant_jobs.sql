CREATE TABLE `exam_variant_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `exam_id` text,
  `status` text NOT NULL,
  `variant_count` integer NOT NULL,
  `requested_by` text,
  `source_questions_json` text NOT NULL,
  `result_json` text,
  `error_message` text,
  `requested_at` text NOT NULL,
  `started_at` text,
  `completed_at` text,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`exam_id`) REFERENCES `new_exams`(`id`) ON UPDATE no action ON DELETE set null
);
