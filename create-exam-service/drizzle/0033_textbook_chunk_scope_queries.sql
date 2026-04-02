ALTER TABLE `textbook_chunks` ADD COLUMN `chapter_id` text;
ALTER TABLE `textbook_chunks` ADD COLUMN `subchapter_id` text;

CREATE UNIQUE INDEX `textbook_chunks_material_chapter_order_idx`
ON `textbook_chunks` (`material_id`, `chapter_id`, `order_index`);

CREATE UNIQUE INDEX `textbook_chunks_material_subchapter_order_idx`
ON `textbook_chunks` (`material_id`, `subchapter_id`, `order_index`);
