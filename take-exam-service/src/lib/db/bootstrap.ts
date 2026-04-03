type ColumnInfo = {
	name: string;
};

function isDuplicateColumnError(error: unknown, columnName: string) {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes("duplicate column name") &&
		message.includes(columnName.toLowerCase())
	);
}

async function getColumnNames(db: D1Database, tableName: string) {
	const result = await db
		.prepare(`PRAGMA table_info(${tableName})`)
		.all<ColumnInfo>();

	return new Set((result.results ?? []).map((column) => column.name));
}

async function addColumnIfMissing(
	db: D1Database,
	tableName: string,
	columnNames: Set<string>,
	columnName: string,
	sqlDefinition: string,
) {
	if (columnNames.has(columnName)) {
		return;
	}

	try {
		await db
			.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${sqlDefinition}`)
			.run();
	} catch (error) {
		if (!isDuplicateColumnError(error, columnName)) {
			throw error;
		}
	}

	columnNames.add(columnName);
}

export async function ensureExamSchema(db: D1Database) {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS students (
				id text PRIMARY KEY NOT NULL,
				name text NOT NULL,
				class_name text NOT NULL DEFAULT ''
			)`,
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS tests (
				id text PRIMARY KEY NOT NULL,
				generator_test_id text NOT NULL,
				answer_key_source text NOT NULL DEFAULT 'local',
				source_service text,
				title text NOT NULL,
				description text NOT NULL,
				grade_level integer NOT NULL,
				class_name text NOT NULL,
				topic text NOT NULL,
				subject text NOT NULL,
				time_limit_minutes integer NOT NULL,
				status text NOT NULL DEFAULT 'draft',
				created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
				updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
			)`,
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS questions (
				id text PRIMARY KEY NOT NULL,
				test_id text NOT NULL,
				type text NOT NULL DEFAULT 'single-choice',
				prompt text NOT NULL,
				options text NOT NULL,
				correct_option_id text NOT NULL,
				explanation text NOT NULL,
				points integer NOT NULL,
				competency text NOT NULL,
				response_guide text,
				answer_latex text,
				image_url text,
				audio_url text,
				video_url text,
				order_slot integer NOT NULL
			)`,
		)
		.run();

	await db
		.prepare(
				`CREATE TABLE IF NOT EXISTS attempts (
					id text PRIMARY KEY NOT NULL,
					test_id text NOT NULL,
					student_id text NOT NULL,
					student_name text NOT NULL,
					shuffle_manifest text,
					status text NOT NULL,
					score integer,
					max_score integer,
					percentage integer,
					feedback_json text,
					teacher_result_json text,
					started_at text NOT NULL,
					expires_at text NOT NULL,
					submitted_at text,
					created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
				)`,
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS answers (
				attempt_id text NOT NULL,
				question_id text NOT NULL,
				selected_option_id text,
				PRIMARY KEY(attempt_id, question_id)
			)`,
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS proctoring_events (
				id text PRIMARY KEY NOT NULL,
				attempt_id text NOT NULL,
				code text NOT NULL,
				severity text NOT NULL,
				title text NOT NULL,
				detail text NOT NULL,
				occurred_at text NOT NULL,
				mode text NOT NULL DEFAULT 'limited-monitoring',
				screenshot_captured_at text,
				screenshot_storage_key text,
				screenshot_url text,
				created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
			)`,
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS attempt_question_metrics (
				attempt_id text NOT NULL,
				question_id text NOT NULL,
				dwell_ms integer NOT NULL DEFAULT 0,
				answer_change_count integer NOT NULL DEFAULT 0,
				updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
				PRIMARY KEY(attempt_id, question_id)
			)`,
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS teacher_submission_exports (
				id text PRIMARY KEY NOT NULL,
				attempt_id text NOT NULL,
				test_id text NOT NULL,
				target_service text NOT NULL,
				status text NOT NULL DEFAULT 'pending',
				payload_json text NOT NULL,
				last_error text,
				sent_at text,
				created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
				updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
			)`,
		)
		.run();

	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_tests_status_updated_at
			 ON tests (status, updated_at)`,
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_questions_test_id
			 ON questions (test_id)`,
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_answers_attempt_id
			 ON answers (attempt_id)`,
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_attempts_started_at
			 ON attempts (started_at)`,
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_attempts_test_started_at
			 ON attempts (test_id, started_at)`,
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt_occurred_at
			 ON proctoring_events (attempt_id, occurred_at)`,
		)
		.run();
	await db
		.prepare(
			`CREATE INDEX IF NOT EXISTS idx_teacher_submission_exports_attempt_id
			 ON teacher_submission_exports (attempt_id)`,
		)
		.run();

	const studentColumns = await getColumnNames(db, "students");
	await addColumnIfMissing(
		db,
		"students",
		studentColumns,
		"class_name",
		"class_name text NOT NULL DEFAULT ''",
	);
	if (studentColumns.has("className")) {
		await db
			.prepare(
				`UPDATE students
				 SET class_name = COALESCE(NULLIF(class_name, ''), className, '')
				 WHERE class_name = ''`,
			)
			.run();
	}

	const testColumns = await getColumnNames(db, "tests");
	await addColumnIfMissing(
		db,
		"tests",
		testColumns,
		"class_name",
		"class_name text NOT NULL DEFAULT ''",
	);
	await addColumnIfMissing(
		db,
		"tests",
		testColumns,
		"answer_key_source",
		"answer_key_source text NOT NULL DEFAULT 'local'",
	);
	await addColumnIfMissing(
		db,
		"tests",
		testColumns,
		"source_service",
		"source_service text",
	);
	await addColumnIfMissing(
		db,
		"tests",
		testColumns,
		"status",
		"status text NOT NULL DEFAULT 'draft'",
	);
	await addColumnIfMissing(
		db,
		"tests",
		testColumns,
		"created_at",
		"created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);
	await addColumnIfMissing(
		db,
		"tests",
		testColumns,
		"updated_at",
		"updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);

	const questionColumns = await getColumnNames(db, "questions");
	await addColumnIfMissing(
		db,
		"questions",
		questionColumns,
		"type",
		"type text NOT NULL DEFAULT 'single-choice'",
	);
	await addColumnIfMissing(
		db,
		"questions",
		questionColumns,
		"response_guide",
		"response_guide text",
	);
	await addColumnIfMissing(
		db,
		"questions",
		questionColumns,
		"answer_latex",
		"answer_latex text",
	);
	await addColumnIfMissing(
		db,
		"questions",
		questionColumns,
		"image_url",
		"image_url text",
	);
	await addColumnIfMissing(
		db,
		"questions",
		questionColumns,
		"audio_url",
		"audio_url text",
	);
	await addColumnIfMissing(
		db,
		"questions",
		questionColumns,
		"video_url",
		"video_url text",
	);

	const attemptColumns = await getColumnNames(db, "attempts");
	await addColumnIfMissing(
		db,
		"attempts",
		attemptColumns,
		"shuffle_manifest",
		"shuffle_manifest text",
	);
	await addColumnIfMissing(
		db,
		"attempts",
		attemptColumns,
		"created_at",
		"created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);
	await addColumnIfMissing(
		db,
		"attempts",
		attemptColumns,
		"feedback_json",
		"feedback_json text",
	);
	await addColumnIfMissing(
		db,
		"attempts",
		attemptColumns,
		"teacher_result_json",
		"teacher_result_json text",
	);

	const proctoringEventColumns = await getColumnNames(db, "proctoring_events");
	await addColumnIfMissing(
		db,
		"proctoring_events",
		proctoringEventColumns,
		"mode",
		"mode text NOT NULL DEFAULT 'limited-monitoring'",
	);
	await addColumnIfMissing(
		db,
		"proctoring_events",
		proctoringEventColumns,
		"screenshot_captured_at",
		"screenshot_captured_at text",
	);
	await addColumnIfMissing(
		db,
		"proctoring_events",
		proctoringEventColumns,
		"screenshot_storage_key",
		"screenshot_storage_key text",
	);
	await addColumnIfMissing(
		db,
		"proctoring_events",
		proctoringEventColumns,
		"screenshot_url",
		"screenshot_url text",
	);
	await addColumnIfMissing(
		db,
		"proctoring_events",
		proctoringEventColumns,
		"created_at",
		"created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);

	const attemptQuestionMetricColumns = await getColumnNames(
		db,
		"attempt_question_metrics",
	);
	await addColumnIfMissing(
		db,
		"attempt_question_metrics",
		attemptQuestionMetricColumns,
		"dwell_ms",
		"dwell_ms integer NOT NULL DEFAULT 0",
	);
	await addColumnIfMissing(
		db,
		"attempt_question_metrics",
		attemptQuestionMetricColumns,
		"answer_change_count",
		"answer_change_count integer NOT NULL DEFAULT 0",
	);
	await addColumnIfMissing(
		db,
		"attempt_question_metrics",
		attemptQuestionMetricColumns,
		"updated_at",
		"updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);

	const teacherSubmissionExportColumns = await getColumnNames(
		db,
		"teacher_submission_exports",
	);
	await addColumnIfMissing(
		db,
		"teacher_submission_exports",
		teacherSubmissionExportColumns,
		"last_error",
		"last_error text",
	);
	await addColumnIfMissing(
		db,
		"teacher_submission_exports",
		teacherSubmissionExportColumns,
		"sent_at",
		"sent_at text",
	);
	await addColumnIfMissing(
		db,
		"teacher_submission_exports",
		teacherSubmissionExportColumns,
		"created_at",
		"created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);
	await addColumnIfMissing(
		db,
		"teacher_submission_exports",
		teacherSubmissionExportColumns,
		"updated_at",
		"updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL",
	);

	await db.prepare(
		`UPDATE tests
		 SET answer_key_source = 'teacher_service',
		     source_service = COALESCE(source_service, 'create-exam-service')
		 WHERE id IN (
		   SELECT DISTINCT test_id
		   FROM questions
		   WHERE competency = 'external-import'
		 )`,
	).run();

	await db.prepare(
		`UPDATE questions
		 SET correct_option_id = '',
		     explanation = '',
		     answer_latex = NULL
		 WHERE competency = 'external-import'`,
	).run();

	await db
		.prepare(
			"CREATE UNIQUE INDEX IF NOT EXISTS attempts_test_student_unique_idx ON attempts (test_id, student_id)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS attempts_student_idx ON attempts (student_id)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS questions_test_order_idx ON questions (test_id, order_slot)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS proctoring_events_attempt_occurred_idx ON proctoring_events (attempt_id, occurred_at)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS attempt_question_metrics_attempt_updated_idx ON attempt_question_metrics (attempt_id, updated_at)",
		)
		.run();
	await db
		.prepare(
			"CREATE UNIQUE INDEX IF NOT EXISTS teacher_submission_exports_attempt_unique_idx ON teacher_submission_exports (attempt_id)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS teacher_submission_exports_status_idx ON teacher_submission_exports (status)",
		)
		.run();
}
