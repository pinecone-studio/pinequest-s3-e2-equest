type ColumnInfo = {
	name: string;
};

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

	await db
		.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${sqlDefinition}`)
		.run();
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
				prompt text NOT NULL,
				options text NOT NULL,
				correct_option_id text NOT NULL,
				explanation text NOT NULL,
				points integer NOT NULL,
				competency text NOT NULL,
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
}
