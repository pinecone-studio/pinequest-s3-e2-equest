import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { textbookMaterials } from "./textbookMaterials";
import { textbookSections } from "./textbookSections";

export const textbookChunks = sqliteTable(
  "textbook_chunks",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => textbookMaterials.id, { onDelete: "cascade" }),
    sectionId: text("section_id")
      .notNull()
      .references(() => textbookSections.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id"),
    subchapterId: text("subchapter_id"),
    chunkType: text("chunk_type").notNull().default("content"),
    orderIndex: integer("order_index").notNull().default(0),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    charCount: integer("char_count").notNull().default(0),
    pageNumbersJson: text("page_numbers_json").notNull().default("[]"),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueSectionChunkIdx: uniqueIndex("textbook_chunks_section_order_idx").on(
      table.sectionId,
      table.orderIndex,
    ),
    materialChapterOrderIdx: uniqueIndex("textbook_chunks_material_chapter_order_idx").on(
      table.materialId,
      table.chapterId,
      table.orderIndex,
    ),
    materialSubchapterOrderIdx: uniqueIndex(
      "textbook_chunks_material_subchapter_order_idx",
    ).on(table.materialId, table.subchapterId, table.orderIndex),
  }),
);
