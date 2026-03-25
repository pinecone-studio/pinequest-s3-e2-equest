import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    className: text("class_name").notNull(),
});

export const tests = sqliteTable("tests", {
    id: text("id").primaryKey(),
    generatorTestId: text("generator_test_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    gradeLevel: integer("grade_level").notNull(),
    className: text("class_name").notNull(),
    topic: text("topic").notNull(),
    subject: text("subject").notNull(),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    status: text("status", { enum: ["published"] }).default("published").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const questions = sqliteTable("questions", {
    id: text("id").primaryKey(),
    testId: text("test_id").notNull(),
    prompt: text("prompt").notNull(),
    options: text("options").notNull(), // JSON string
    correctOptionId: text("correct_option_id").notNull(),
    explanation: text("explanation").notNull(),
    points: integer("points").notNull(),
    competency: text("competency").notNull(),
    imageUrl: text("image_url"),
    audioUrl: text("audio_url"),
    videoUrl: text("video_url"),
    orderSlot: integer("order_slot").notNull(),
});

export const attempts = sqliteTable("attempts", {
    id: text("id").primaryKey(),
    testId: text("test_id").notNull(),
    studentId: text("student_id").notNull(),
    studentName: text("student_name").notNull(),
    shuffleManifest: text("shuffle_manifest"),
    status: text("status", { enum: ["in_progress", "processing", "submitted", "approved"] }).notNull(),
    score: integer("score"),
    maxScore: integer("max_score"),
    percentage: integer("percentage"),
    startedAt: text("started_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    submittedAt: text("submitted_at"),
}, (table) => ({
    studentPerTestUniqueIdx: uniqueIndex("attempts_test_student_unique_idx").on(table.testId, table.studentId),
}));

export const answers = sqliteTable("answers", {
    attemptId: text("attempt_id").notNull(),
    questionId: text("question_id").notNull(),
    selectedOptionId: text("selected_option_id"),
}, (table) => ({
    pk: primaryKey({ columns: [table.attemptId, table.questionId] }),
}));
