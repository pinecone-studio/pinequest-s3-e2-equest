import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const textbookMaterials = sqliteTable(
  "textbook_materials",
  {
    id: text("id").primaryKey(),
    bucketName: text("bucket_name").notNull(),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    title: text("title"),
    grade: integer("grade"),
    subject: text("subject"),
    size: integer("size").notNull().default(0),
    pageCount: integer("page_count").notNull().default(0),
    chapterCount: integer("chapter_count").notNull().default(0),
    sectionCount: integer("section_count").notNull().default(0),
    subchapterCount: integer("subchapter_count").notNull().default(0),
    progressCurrent: integer("progress_current").notNull().default(0),
    progressTotal: integer("progress_total").notNull().default(0),
    status: text("status").notNull().default("uploaded"),
    stage: text("stage").notNull().default("uploaded"),
    statusMessage: text("status_message"),
    errorMessage: text("error_message"),
    warningsJson: text("warnings_json"),
    ocrNeededPageCount: integer("ocr_needed_page_count").notNull().default(0),
    unsupportedReason: text("unsupported_reason"),
    readyAt: text("ready_at"),
    lastProcessedAt: text("last_processed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueObjectIdx: uniqueIndex("textbook_materials_bucket_key_idx").on(
      table.bucketName,
      table.r2Key,
    ),
  }),
);
