import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { textbookMaterials } from "./textbookMaterials";

export const textbookSections = sqliteTable(
  "textbook_sections",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => textbookMaterials.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    nodeType: text("node_type").notNull(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    depth: integer("depth").notNull().default(0),
    startPage: integer("start_page"),
    endPage: integer("end_page"),
    childCount: integer("child_count").notNull().default(0),
    pageNumbersJson: text("page_numbers_json").notNull().default("[]"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueMaterialNodeIdx: uniqueIndex("textbook_sections_material_node_idx").on(
      table.materialId,
      table.id,
    ),
  }),
);
