import type { ExamOption, ExamProgress } from "@/lib/exam-service/types";

export const TEST_CACHE_TTL_SECONDS = 60 * 60 * 24;
export const ATTEMPT_CACHE_TTL_SECONDS = 60 * 60 * 12;
export const ATTEMPTS_SUMMARY_CACHE_TTL_SECONDS = 60;
export const EXTERNAL_NEW_MATH_SYNC_CACHE_TTL_SECONDS = 60;
export const AVAILABLE_TESTS_CACHE_TTL_SECONDS = 60;
export const TEST_CACHE_INDEX_KEY = "tests:index:v2";
export const ATTEMPTS_SUMMARY_CACHE_KEY = "attempts:summary";
export const EXTERNAL_NEW_MATH_SYNC_CACHE_KEY_PREFIX = "external:new-math:sync";
export const AVAILABLE_TESTS_CACHE_KEY = "available-tests:v1";

export const createId = (prefix: string) =>
	`${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export const testCacheKey = (testId: string) => `test:${testId}`;
export const attemptStateCacheKey = (attemptId: string) => `attempt:${attemptId}:state`;
export const externalNewMathSyncCacheKey = (limit: number) =>
	`${EXTERNAL_NEW_MATH_SYNC_CACHE_KEY_PREFIX}:${limit}`;

export const computeProgress = (
	answersCount: number,
	totalQuestions: number,
): ExamProgress => ({
	totalQuestions,
	answeredQuestions: answersCount,
	remainingQuestions: totalQuestions - answersCount,
	completionRate: totalQuestions === 0 ? 0 : Math.round((answersCount / totalQuestions) * 100),
});

export const countAnsweredQuestions = (answers: Record<string, string | null>) =>
	Object.values(answers).filter((value) => value !== null && value !== "").length;

export const isUniqueConstraintError = (error: unknown) =>
	error instanceof Error && error.message.toLowerCase().includes("unique");

type LooseOption = { id?: string; text?: string } | string;

export const getQuestionId = (question: { id?: string; questionId?: string }) =>
	question.id ?? question.questionId ?? "";

export const getQuestionOptions = (
	question: { options?: LooseOption[] | string | null },
): ExamOption[] => {
	const normalizeOption = (option: LooseOption): ExamOption =>
		typeof option === "string"
			? { id: option, text: option }
			: {
					id: option.id ?? option.text ?? "",
					text: option.text ?? option.id ?? "",
				};

	if (typeof question.options === "string") {
		try {
			const parsed = JSON.parse(question.options) as unknown;
			return Array.isArray(parsed)
				? (parsed as LooseOption[]).map(normalizeOption)
				: [];
		} catch {
			return [];
		}
	}

	return Array.isArray(question.options)
		? question.options.map(normalizeOption)
		: [];
};

export const getOptionId = (option: LooseOption) =>
	typeof option === "string" ? option : option.id ?? "";

export const normalizeFreeResponseAnswer = (value?: string | null) =>
	(value ?? "")
		.toLowerCase()
		.replace(/\\,/g, ",")
		.replace(/\$+/g, "")
		.replace(/\s+/g, "")
		.trim();

const trimOuterWrappers = (value: string) => {
	let next = value.trim();

	while (next.length >= 2) {
		const pairs: Array<[string, string]> = [
			["(", ")"],
			["[", "]"],
			["{", "}"],
		];
		const wrapper = pairs.find(
			([open, close]) => next.startsWith(open) && next.endsWith(close),
		);

		if (!wrapper) {
			return next;
		}

		next = next.slice(1, -1).trim();
	}

	return next;
};

const normalizeMathComparisonBase = (value?: string | null) =>
	normalizeFreeResponseAnswer(value)
		.replace(/\\left|\\right/g, "")
		.replace(/\\;/g, ",")
		.replace(/\\:/g, ",")
		.replace(/\\!/g, "")
		.replace(/\\times|\\cdot/g, "*")
		.replace(/\\div/g, "/")
		.replace(/\\\{/g, "{")
		.replace(/\\\}/g, "}")
		.replace(/,+/g, ",")
		.replace(/^\+/, "");

const normalizeSolutionToken = (value: string) =>
	trimOuterWrappers(
		value
			.replace(
				/^(?:[a-zа-яёөү](?:_[a-zа-яёөү0-9]+)?\d*)(?:=|\\in|∈)+/iu,
				"",
			)
			.replace(/^\+/, ""),
	);

const canSortAnswerList = (items: string[]) =>
	items.length > 1 &&
	items.every(
		(item) =>
			item.length > 0 &&
			!/^[[(].*[)\]]$/.test(item) &&
			!/[=<>]/.test(item),
	);

const buildFreeResponseComparisonCandidates = (value?: string | null) => {
	const base = normalizeMathComparisonBase(value);
	if (!base) {
		return new Set<string>();
	}

	const candidates = new Set<string>([base, trimOuterWrappers(base)]);
	const withAssignmentsStripped = normalizeSolutionToken(base);
	if (withAssignmentsStripped) {
		candidates.add(withAssignmentsStripped);
	}

	for (const current of [...candidates]) {
		const rhs = current.includes("=") ? current.split("=").slice(1).join("=") : "";
		if (rhs) {
			candidates.add(trimOuterWrappers(rhs));
			candidates.add(normalizeSolutionToken(rhs));
		}

		const parts = current
			.split(/[;,]/)
			.map((item) => normalizeSolutionToken(item))
			.filter(Boolean);
		if (canSortAnswerList(parts)) {
			candidates.add(parts.join(","));
			candidates.add([...parts].sort().join(","));
		}
	}

	candidates.delete("");
	return candidates;
};

export const areEquivalentFreeResponseAnswers = (
	left?: string | null,
	right?: string | null,
) => {
	const leftCandidates = buildFreeResponseComparisonCandidates(left);
	const rightCandidates = buildFreeResponseComparisonCandidates(right);

	if (leftCandidates.size === 0 || rightCandidates.size === 0) {
		return false;
	}

	for (const candidate of leftCandidates) {
		if (rightCandidates.has(candidate)) {
			return true;
		}
	}

	return false;
};
