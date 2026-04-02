CREATE TABLE `exam_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL,
  `exam_id` text,
  `variant_number` integer NOT NULL,
  `title` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`job_id`) REFERENCES `exam_variant_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`exam_id`) REFERENCES `new_exams`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE `exam_variant_questions` (
  `id` text PRIMARY KEY NOT NULL,
  `variant_id` text NOT NULL,
  `position` integer NOT NULL,
  `type` text NOT NULL,
  `prompt` text NOT NULL,
  `options_json` text,
  `correct_answer` text,
  `explanation` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`variant_id`) REFERENCES `exam_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
