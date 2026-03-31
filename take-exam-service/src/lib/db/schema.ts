import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    className: text("class_name").notNull(),
});

export const tests = sqliteTable("tests", {
    id: text("id").primaryKey(),
    generatorTestId: text("generator_test_id").notNull(),
    answerKeySource: text("answer_key_source", { enum: ["local", "teacher_service"] }).default("local").notNull(),
    sourceService: text("source_service"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    gradeLevel: integer("grade_level").notNull(),
    className: text("class_name").notNull(),
    topic: text("topic").notNull(),
    subject: text("subject").notNull(),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    status: text("status", { enum: ["draft", "published", "archived"] }).default("draft").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const questions = sqliteTable("questions", {
    id: text("id").primaryKey(),
    testId: text("test_id").notNull().references(() => tests.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    type: text("type").notNull().default("single-choice"),
    prompt: text("prompt").notNull(),
    options: text("options").notNull(), // JSON string
    correctOptionId: text("correct_option_id").notNull(),
    explanation: text("explanation").notNull(),
    points: integer("points").notNull(),
    competency: text("competency").notNull(),
    responseGuide: text("response_guide"),
    answerLatex: text("answer_latex"),
    imageUrl: text("image_url"),
    audioUrl: text("audio_url"),
    videoUrl: text("video_url"),
    orderSlot: integer("order_slot").notNull(),
}, (table) => ({
    testOrderIdx: index("questions_test_order_idx").on(table.testId, table.orderSlot),
}));

export const attempts = sqliteTable("attempts", {
    id: text("id").primaryKey(),
    testId: text("test_id").notNull().references(() => tests.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    studentId: text("student_id").notNull().references(() => students.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    studentName: text("student_name").notNull(),
    shuffleManifest: text("shuffle_manifest"),
    status: text("status", { enum: ["in_progress", "processing", "submitted", "approved"] }).notNull(),
    score: integer("score"),
    maxScore: integer("max_score"),
    percentage: integer("percentage"),
    feedbackJson: text("feedback_json"),
    teacherResultJson: text("teacher_result_json"),
    startedAt: text("started_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    submittedAt: text("submitted_at"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
    studentPerTestUniqueIdx: uniqueIndex("attempts_test_student_unique_idx").on(table.testId, table.studentId),
    studentIdx: index("attempts_student_idx").on(table.studentId),
}));

export const answers = sqliteTable("answers", {
    attemptId: text("attempt_id").notNull().references(() => attempts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    questionId: text("question_id").notNull().references(() => questions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    selectedOptionId: text("selected_option_id"),
}, (table) => ({
    pk: primaryKey({ columns: [table.attemptId, table.questionId] }),
}));

export const attemptQuestionMetrics = sqliteTable("attempt_question_metrics", {
    attemptId: text("attempt_id").notNull().references(() => attempts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    questionId: text("question_id").notNull().references(() => questions.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    dwellMs: integer("dwell_ms").notNull().default(0),
    answerChangeCount: integer("answer_change_count").notNull().default(0),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.attemptId, table.questionId] }),
    attemptUpdatedIdx: index("attempt_question_metrics_attempt_updated_idx").on(table.attemptId, table.updatedAt),
}));

export const proctoringEvents = sqliteTable("proctoring_events", {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull().references(() => attempts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    code: text("code").notNull(),
    severity: text("severity", { enum: ["info", "warning", "danger"] }).notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
    attemptOccurredIdx: index("proctoring_events_attempt_occurred_idx").on(table.attemptId, table.occurredAt),
}));

export const teacherSubmissionExports = sqliteTable("teacher_submission_exports", {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull().references(() => attempts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    testId: text("test_id").notNull().references(() => tests.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    targetService: text("target_service").notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
    payloadJson: text("payload_json").notNull(),
    lastError: text("last_error"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
    attemptUniqueIdx: uniqueIndex("teacher_submission_exports_attempt_unique_idx").on(table.attemptId),
    statusIdx: index("teacher_submission_exports_status_idx").on(table.status),
}));

export const studentsRelations = relations(students, ({ many }) => ({
    attempts: many(attempts),
}));

export const testsRelations = relations(tests, ({ many }) => ({
    questions: many(questions),
    attempts: many(attempts),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
    test: one(tests, {
        fields: [questions.testId],
        references: [tests.id],
    }),
    answers: many(answers),
    attemptQuestionMetrics: many(attemptQuestionMetrics),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
    test: one(tests, {
        fields: [attempts.testId],
        references: [tests.id],
    }),
    student: one(students, {
        fields: [attempts.studentId],
        references: [students.id],
    }),
    answers: many(answers),
    attemptQuestionMetrics: many(attemptQuestionMetrics),
    proctoringEvents: many(proctoringEvents),
    teacherSubmissionExports: many(teacherSubmissionExports),
}));

export const answersRelations = relations(answers, ({ one }) => ({
    attempt: one(attempts, {
        fields: [answers.attemptId],
        references: [attempts.id],
    }),
    question: one(questions, {
        fields: [answers.questionId],
        references: [questions.id],
    }),
}));

export const attemptQuestionMetricsRelations = relations(attemptQuestionMetrics, ({ one }) => ({
    attempt: one(attempts, {
        fields: [attemptQuestionMetrics.attemptId],
        references: [attempts.id],
    }),
    question: one(questions, {
        fields: [attemptQuestionMetrics.questionId],
        references: [questions.id],
    }),
}));

export const proctoringEventsRelations = relations(proctoringEvents, ({ one }) => ({
    attempt: one(attempts, {
        fields: [proctoringEvents.attemptId],
        references: [attempts.id],
    }),
}));

export const teacherSubmissionExportsRelations = relations(teacherSubmissionExports, ({ one }) => ({
    attempt: one(attempts, {
        fields: [teacherSubmissionExports.attemptId],
        references: [attempts.id],
    }),
    test: one(tests, {
        fields: [teacherSubmissionExports.testId],
        references: [tests.id],
    }),
}));
