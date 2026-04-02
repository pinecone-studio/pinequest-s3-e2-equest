import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { textbookMaterials } from "./textbookMaterials";

export const textbookPages = sqliteTable(
  "textbook_pages",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => textbookMaterials.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    rawText: text("raw_text").notNull().default(""),
    normalizedText: text("normalized_text").notNull().default(""),
    charCount: integer("char_count").notNull().default(0),
    tokenCount: integer("token_count").notNull().default(0),
    extractionStatus: text("extraction_status").notNull().default("ready"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueMaterialPageIdx: uniqueIndex("textbook_pages_material_page_idx").on(
      table.materialId,
      table.pageNumber,
    ),
  }),
);
