import type {
	AttemptSummary,
	ExamAnswerInput,
	ExamResultSummary,
	ProctoringEventSeverity,
	StartExamResponse,
	StudentExamQuestion,
	StudentInfo,
	SubmitAnswersResponse,
	TeacherTestSummary,
	TestCriteria,
} from "@/lib/exam-service/types";

type DashboardPayload = {
	availableTests: TeacherTestSummary[];
	attempts: AttemptSummary[];
};

type AttemptActivityInput = {
	code: string;
	detail: string;
	occurredAt?: string;
	severity: ProctoringEventSeverity;
	title: string;
};

const MOCK_DELAY_MS = 120;

const defaultCriteria = (
	overrides: Partial<TestCriteria>,
): TestCriteria => ({
	gradeLevel: 12,
	className: "12A",
	subject: "Ерөнхий",
	topic: "Суурь",
	difficulty: "medium",
	questionCount: 5,
	...overrides,
});

const MOCK_STUDENTS: StudentInfo[] = [
	{ id: "std-126", name: "Ганхуяг Анударь", className: "12A" },
	{ id: "std-127", name: "Түвшин Эрдэнэ", className: "12A" },
	{ id: "std-128", name: "Мөнгөнзул Энхмаа", className: "12B" },
];

const MOCK_TESTS: TeacherTestSummary[] = [
	{
		id: "test-physics-foundation",
		title: "Явц-1: Физикийн үндэс",
		description: "Физикийн суурь ойлголтыг шалгана.",
		criteria: defaultCriteria({
			subject: "Физик",
			topic: "Механик",
			questionCount: 12,
		}),
		updatedAt: "2026-03-26T04:00:00.000Z",
	},
	{
		id: "test-english-past",
		title: "Бататгах: Past simple tense",
		description: "Англи хэлний Past Simple дүрмийн шалгалт.",
		criteria: defaultCriteria({
			subject: "Англи хэл",
			topic: "Past Simple",
			questionCount: 10,
		}),
		updatedAt: "2026-03-27T04:00:00.000Z",
	},
	{
		id: "test-chemistry-bond",
		title: "Хими: Bonding fundamentals",
		description: "Холбооны үндэс, бодлого шийдэлт.",
		criteria: defaultCriteria({
			subject: "Хими",
			topic: "Bonding",
			questionCount: 9,
		}),
		updatedAt: "2026-03-25T04:00:00.000Z",
	},
	{
		id: "test-math-functions",
		title: "Математик: Functions",
		description: "Функцийн үндсэн ойлголт.",
		criteria: defaultCriteria({
			subject: "Математик",
			topic: "Functions",
			questionCount: 8,
		}),
		updatedAt: "2026-03-24T04:00:00.000Z",
	},
];

const QUESTION_BANK: Record<string, StudentExamQuestion[]> = {
	"test-physics-foundation": [
		{
			questionId: "q-phy-1",
			type: "single-choice",
			prompt: "SI системд хүчний нэгж аль нь вэ?",
			points: 1,
			options: [
				{ id: "a", text: "Joule" },
				{ id: "b", text: "Newton" },
				{ id: "c", text: "Pascal" },
				{ id: "d", text: "Watt" },
			],
		},
		{
			questionId: "q-phy-2",
			type: "single-choice",
			prompt: "Тогтмол хурдтай хөдөлгөөний хурдатгал хэд вэ?",
			points: 1,
			options: [
				{ id: "a", text: "1 м/с²" },
				{ id: "b", text: "0 м/с²" },
				{ id: "c", text: "10 м/с²" },
				{ id: "d", text: "Хязгааргүй" },
			],
		},
	],
	"test-english-past": [
		{
			questionId: "q-eng-1",
			type: "single-choice",
			prompt: "Choose the correct sentence in Past Simple:",
			points: 1,
			options: [
				{ id: "a", text: "He go to school yesterday." },
				{ id: "b", text: "He went to school yesterday." },
				{ id: "c", text: "He goes to school yesterday." },
				{ id: "d", text: "He going to school yesterday." },
			],
		},
		{
			questionId: "q-eng-2",
			type: "single-choice",
			prompt: "Which is the Past Simple of 'teach'?",
			points: 1,
			options: [
				{ id: "a", text: "teached" },
				{ id: "b", text: "taught" },
				{ id: "c", text: "teach" },
				{ id: "d", text: "teaching" },
			],
		},
	],
	"test-chemistry-bond": [
		{
			questionId: "q-chem-1",
			type: "single-choice",
			prompt: "Ionic bond үүсэх үндсэн шалтгаан юу вэ?",
			points: 1,
			options: [
				{ id: "a", text: "Нейтроны солилцоо" },
				{ id: "b", text: "Электроны шилжилт" },
				{ id: "c", text: "Протоны шилжилт" },
				{ id: "d", text: "Молекулын задрал" },
			],
		},
		{
			questionId: "q-chem-2",
			type: "single-choice",
			prompt: "NaCl холбооны төрөл?",
			points: 1,
			options: [
				{ id: "a", text: "Ковалент" },
				{ id: "b", text: "Металл" },
				{ id: "c", text: "Ион" },
				{ id: "d", text: "Устөрөгчийн" },
			],
		},
	],
	"test-math-functions": [
		{
			questionId: "q-math-1",
			type: "single-choice",
			prompt: "f(x)=2x+1 функцийн f(3)-ийг ол.",
			points: 1,
			options: [
				{ id: "a", text: "5" },
				{ id: "b", text: "6" },
				{ id: "c", text: "7" },
				{ id: "d", text: "8" },
			],
		},
		{
			questionId: "q-math-2",
			type: "single-choice",
			prompt: "y=x^2 функц parity-ийн хувьд ямар вэ?",
			points: 1,
			options: [
				{ id: "a", text: "Тэгш" },
				{ id: "b", text: "Сондгой" },
				{ id: "c", text: "Аль нь ч биш" },
				{ id: "d", text: "Тогтмол" },
			],
		},
	],
};

const seedResult = (
	score: number,
	maxScore: number,
	questionCount: number,
): ExamResultSummary => ({
	score,
	maxScore,
	percentage: Math.round((score / maxScore) * 100),
	correctCount: score,
	incorrectCount: Math.max(0, maxScore - score),
	unansweredCount: 0,
	questionResults: Array.from({ length: questionCount }, (_, idx) => ({
		questionId: `seed-q-${idx + 1}`,
		selectedOptionId: "a",
		correctOptionId: idx % 4 === 0 ? "b" : "a",
		isCorrect: idx % 4 !== 0,
		pointsAwarded: idx % 4 !== 0 ? 1 : 0,
		maxPoints: 1,
		explanation: idx % 4 !== 0 ? "Зөв." : "Анхааралтай уншаарай.",
	})),
});

let attemptsStore: AttemptSummary[] = [
	{
		attemptId: "attempt-seed-1",
		testId: "test-math-functions",
		title: "Математик: Functions",
		studentId: "std-126",
		studentName: "Ганхуяг Анударь",
		status: "approved",
		score: 6,
		maxScore: 8,
		percentage: 75,
		startedAt: "2026-03-23T02:00:00.000Z",
		submittedAt: "2026-03-23T03:00:00.000Z",
		result: seedResult(6, 8, 8),
	},
	{
		attemptId: "attempt-seed-2",
		testId: "test-chemistry-bond",
		title: "Хими: Bonding fundamentals",
		studentId: "std-126",
		studentName: "Ганхуяг Анударь",
		status: "submitted",
		startedAt: "2026-03-24T02:00:00.000Z",
		submittedAt: "2026-03-24T03:00:00.000Z",
	},
];

const activeSessionStore = new Map<string, StartExamResponse>();
const answersStore = new Map<string, Record<string, string | null>>();
const monitoringStore = new Map<
	string,
	NonNullable<AttemptSummary["monitoring"]>
>();

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const sleep = (ms = MOCK_DELAY_MS) =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

const makeProgress = (answeredQuestions: number, totalQuestions: number) => ({
	totalQuestions,
	answeredQuestions,
	remainingQuestions: Math.max(0, totalQuestions - answeredQuestions),
	completionRate: totalQuestions
		? Math.round((answeredQuestions / totalQuestions) * 100)
		: 0,
});

const toStartExamPayload = (
	test: TeacherTestSummary,
	studentId: string,
	studentName: string,
	attemptId: string,
	startedAt: string,
	expiresAt: string,
	questions: StudentExamQuestion[],
	answeredQuestions = 0,
): StartExamResponse => ({
	attemptId,
	status: "in_progress",
	studentId,
	studentName,
	startedAt,
	expiresAt,
	exam: {
		testId: test.id,
		title: test.title,
		description: test.description,
		criteria: test.criteria,
		timeLimitMinutes: 90,
		questions: clone(questions),
	},
	progress: makeProgress(answeredQuestions, questions.length),
});

const createAttemptId = () =>
	`mock-attempt-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

const appendMockMonitoringEvent = (
	attemptId: string,
	input: AttemptActivityInput,
) => {
	const current = monitoringStore.get(attemptId) ?? {
		totalEvents: 0,
		warningCount: 0,
		dangerCount: 0,
		lastEventAt: undefined,
		recentEvents: [],
	};

	const occurredAt = input.occurredAt ?? new Date().toISOString();
	const event = {
		id: `mock-evt-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`,
		code: input.code,
		detail: input.detail,
		severity: input.severity,
		title: input.title,
		occurredAt,
	};

	current.totalEvents += 1;
	current.lastEventAt = occurredAt;
	current.recentEvents = [event, ...current.recentEvents].slice(0, 8);

	if (input.severity === "danger") {
		current.dangerCount += 1;
	} else {
		current.warningCount += 1;
	}

	monitoringStore.set(attemptId, current);
};

export const mockStudentPortalClient = {
	async getStudents() {
		await sleep();
		return clone(MOCK_STUDENTS);
	},

	async getDashboard(): Promise<DashboardPayload> {
		await sleep();
		const sortedAttempts = [...attemptsStore].sort(
			(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
		);

		return {
			availableTests: clone(MOCK_TESTS),
			attempts: clone(
				sortedAttempts.map((attempt) => ({
					...attempt,
					monitoring: monitoringStore.get(attempt.attemptId),
				})),
			),
		};
	},

	async startExam({
		testId,
		studentId,
		studentName,
	}: {
		testId: string;
		studentId: string;
		studentName: string;
	}) {
		await sleep();
		const test = MOCK_TESTS.find((item) => item.id === testId);
		if (!test) throw new Error("Шалгалт олдсонгүй.");

		const existingDone = attemptsStore.find(
			(attempt) =>
				attempt.studentId === studentId &&
				attempt.testId === testId &&
				(attempt.status === "submitted" || attempt.status === "approved"),
		);
		if (existingDone) throw new Error("Энэ сурагч энэ шалгалтыг аль хэдийн өгсөн байна.");

		const existingActive = attemptsStore.find(
			(attempt) =>
				attempt.studentId === studentId &&
				attempt.testId === testId &&
				attempt.status === "in_progress",
		);
		if (existingActive) {
			const session = activeSessionStore.get(existingActive.attemptId);
			if (session) return clone(session);
		}

		const questionSet = QUESTION_BANK[testId] ?? QUESTION_BANK["test-physics-foundation"];
		const attemptId = createAttemptId();
		const startedAt = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();
		const payload = toStartExamPayload(
			test,
			studentId,
			studentName,
			attemptId,
			startedAt,
			expiresAt,
			questionSet,
		);

		attemptsStore = [
			{
				attemptId,
				testId,
				title: test.title,
				studentId,
				studentName,
				status: "in_progress",
				startedAt,
			},
			...attemptsStore,
		];

		activeSessionStore.set(attemptId, clone(payload));
		answersStore.set(attemptId, {});

		return clone(payload);
	},

	async resumeExam(attemptId: string) {
		await sleep();
		const session = activeSessionStore.get(attemptId);
		if (!session) throw new Error("Оролдлого олдсонгүй.");
		return clone(session);
	},

	async submitAnswers({
		attemptId,
		answers,
		finalize,
	}: {
		attemptId: string;
		answers: ExamAnswerInput[];
		finalize: boolean;
	}): Promise<SubmitAnswersResponse> {
		await sleep();

		const attempt = attemptsStore.find((item) => item.attemptId === attemptId);
		if (!attempt) throw new Error("Оролдлого олдсонгүй.");
		if (attempt.status === "submitted" || attempt.status === "approved") {
			throw new Error("Энэ оролдлого аль хэдийн дууссан байна.");
		}

		const session = activeSessionStore.get(attemptId);
		if (!session) throw new Error("Шалгалтын session олдсонгүй.");

		const currentAnswers = answersStore.get(attemptId) ?? {};
		for (const answer of answers) {
			currentAnswers[answer.questionId] = answer.selectedOptionId ?? null;
		}
		answersStore.set(attemptId, currentAnswers);

		const answeredQuestions = Object.values(currentAnswers).filter(Boolean).length;
		const totalQuestions = session.exam.questions.length;

		if (!finalize) {
			return {
				attemptId,
				status: "in_progress",
				progress: makeProgress(answeredQuestions, totalQuestions),
			};
		}

		attempt.status = "submitted";
		attempt.submittedAt = new Date().toISOString();
		activeSessionStore.delete(attemptId);

		return {
			attemptId,
			status: "submitted",
			progress: makeProgress(answeredQuestions, totalQuestions),
		};
	},

	async logAttemptActivity(attemptId: string, input: AttemptActivityInput) {
		await sleep();
		const attempt = attemptsStore.find((item) => item.attemptId === attemptId);
		if (!attempt) throw new Error("Оролдлого олдсонгүй.");
		appendMockMonitoringEvent(attemptId, input);
		return true;
	},
};

export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
