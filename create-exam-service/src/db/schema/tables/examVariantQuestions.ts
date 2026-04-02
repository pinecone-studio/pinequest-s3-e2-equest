import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { examVariants } from "./examVariants";

export const examVariantQuestions = sqliteTable("exam_variant_questions", {
	id: text("id").primaryKey(),
	variantId: text("variant_id")
		.notNull()
		.references(() => examVariants.id, { onDelete: "cascade" }),
	position: integer("position").notNull(),
	type: text("type").notNull(),
	prompt: text("prompt").notNull(),
	optionsJson: text("options_json"),
	correctAnswer: text("correct_answer"),
	explanation: text("explanation"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
