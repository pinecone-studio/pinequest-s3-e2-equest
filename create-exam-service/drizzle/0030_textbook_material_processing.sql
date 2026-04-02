CREATE TABLE `textbook_materials` (
  `id` text PRIMARY KEY NOT NULL,
  `bucket_name` text NOT NULL,
  `r2_key` text NOT NULL,
  `file_name` text NOT NULL,
  `content_type` text,
  `title` text,
  `grade` integer,
  `subject` text,
  `size` integer DEFAULT 0 NOT NULL,
  `page_count` integer DEFAULT 0 NOT NULL,
  `chapter_count` integer DEFAULT 0 NOT NULL,
  `section_count` integer DEFAULT 0 NOT NULL,
  `subchapter_count` integer DEFAULT 0 NOT NULL,
  `progress_current` integer DEFAULT 0 NOT NULL,
  `progress_total` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'uploaded' NOT NULL,
  `stage` text DEFAULT 'uploaded' NOT NULL,
  `status_message` text,
  `error_message` text,
  `warnings_json` text,
  `ocr_needed_page_count` integer DEFAULT 0 NOT NULL,
  `unsupported_reason` text,
  `ready_at` text,
  `last_processed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE UNIQUE INDEX `textbook_materials_bucket_key_idx`
ON `textbook_materials` (`bucket_name`, `r2_key`);

CREATE TABLE `textbook_pages` (
  `id` text PRIMARY KEY NOT NULL,
  `material_id` text NOT NULL,
  `page_number` integer NOT NULL,
  `raw_text` text DEFAULT '' NOT NULL,
  `normalized_text` text DEFAULT '' NOT NULL,
  `char_count` integer DEFAULT 0 NOT NULL,
  `token_count` integer DEFAULT 0 NOT NULL,
  `extraction_status` text DEFAULT 'ready' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`material_id`) REFERENCES `textbook_materials`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `textbook_pages_material_page_idx`
ON `textbook_pages` (`material_id`, `page_number`);

CREATE TABLE `textbook_sections` (
  `id` text PRIMARY KEY NOT NULL,
  `material_id` text NOT NULL,
  `parent_id` text,
  `node_type` text NOT NULL,
  `title` text NOT NULL,
  `normalized_title` text NOT NULL,
  `order_index` integer DEFAULT 0 NOT NULL,
  `depth` integer DEFAULT 0 NOT NULL,
  `start_page` integer,
  `end_page` integer,
  `child_count` integer DEFAULT 0 NOT NULL,
  `page_numbers_json` text DEFAULT '[]' NOT NULL,
  `metadata_json` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`material_id`) REFERENCES `textbook_materials`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `textbook_sections_material_node_idx`
ON `textbook_sections` (`material_id`, `id`);

CREATE TABLE `textbook_chunks` (
  `id` text PRIMARY KEY NOT NULL,
  `material_id` text NOT NULL,
  `section_id` text NOT NULL,
  `chunk_type` text DEFAULT 'content' NOT NULL,
  `order_index` integer DEFAULT 0 NOT NULL,
  `page_start` integer,
  `page_end` integer,
  `char_count` integer DEFAULT 0 NOT NULL,
  `page_numbers_json` text DEFAULT '[]' NOT NULL,
  `text` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`material_id`) REFERENCES `textbook_materials`(`id`) ON DELETE cascade,
  FOREIGN KEY (`section_id`) REFERENCES `textbook_sections`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `textbook_chunks_section_order_idx`
ON `textbook_chunks` (`section_id`, `order_index`);
