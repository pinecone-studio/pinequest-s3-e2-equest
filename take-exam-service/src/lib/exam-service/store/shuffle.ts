import { shuffleWithSeed } from "@/lib/exam-service/shuffle";
import { getOptionId, getQuestionId, getQuestionOptions } from "./common";
import type { AttemptShuffleManifest } from "./internal-types";

export const createShuffleManifest = (
	attemptId: string,
	studentId: string,
	testId: string,
	testQuestions: any[],
): AttemptShuffleManifest => {
	const questionSeed = `${testId}:${studentId}:${attemptId}:questions`;
	const shuffledQuestionIds = shuffleWithSeed(
		testQuestions.map((question) => getQuestionId(question)),
		questionSeed,
	);

	const optionOrderByQuestion = Object.fromEntries(
		testQuestions.map((question, index) => {
			const questionId = getQuestionId(question);
			const shuffledOptionIds = shuffleWithSeed(
				getQuestionOptions(question).map((option: any) => getOptionId(option)),
				`${attemptId}:${questionId}:options:${index}`,
			);

			return [questionId, shuffledOptionIds];
		}),
	);

	return {
		version: 1,
		questionOrder: shuffledQuestionIds,
		optionOrderByQuestion,
	};
};

export const parseShuffleManifest = (
	rawManifest?: string | null,
): AttemptShuffleManifest | null => {
	if (!rawManifest) return null;

	try {
		const parsed = JSON.parse(rawManifest) as AttemptShuffleManifest;
		if (
			parsed.version !== 1 ||
			!Array.isArray(parsed.questionOrder) ||
			!parsed.optionOrderByQuestion
		) {
			return null;
		}

		return parsed;
	} catch (error) {
		console.error("Failed to parse shuffle manifest:", error);
		return null;
	}
};

export const resolveShuffleManifest = (
	attemptId: string,
	studentId: string,
	testId: string,
	testQuestions: any[],
	rawManifest?: string | null,
) =>
	parseShuffleManifest(rawManifest) ??
	createShuffleManifest(attemptId, studentId, testId, testQuestions);

export const applyShuffleManifest = (
	testQuestions: any[],
	manifest: AttemptShuffleManifest,
) => {
	const questionMap = new Map(
		testQuestions.map((question) => [getQuestionId(question), question]),
	);

	const orderedQuestions = manifest.questionOrder
		.map((questionId) => questionMap.get(questionId))
		.filter(Boolean);

	for (const question of testQuestions) {
		const questionId = getQuestionId(question);
		if (!manifest.questionOrder.includes(questionId)) {
			orderedQuestions.push(question);
		}
	}

	return orderedQuestions.map((question) => {
		const questionId = getQuestionId(question);
		const options = getQuestionOptions(question);
		const optionOrder = manifest.optionOrderByQuestion[questionId];

		if (!optionOrder) {
			return {
				...question,
				options,
			};
		}

		const optionMap = new Map(
			options.map((option: any) => [getOptionId(option), option]),
		);
		const orderedOptions = optionOrder
			.map((optionId) => optionMap.get(optionId))
			.filter(Boolean);

		for (const option of options) {
			if (!optionOrder.includes(getOptionId(option))) {
				orderedOptions.push(option);
			}
		}

		return {
			...question,
			options: orderedOptions,
		};
	});
};
