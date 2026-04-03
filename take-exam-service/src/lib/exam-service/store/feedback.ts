import type {
	AiContentSource,
	AttemptFeedback,
	ExamProgress,
	ExamResultSummary,
} from "@/lib/exam-service/types";
import type { DbClient } from "@/lib/db";
import { chatWithOllama, DEFAULT_OLLAMA_MODEL } from "@/lib/ollama";
import { getAttemptMonitoringSummaries } from "./activity";
import { getQuestionOptions } from "./common";
import type { AttemptResultRow } from "./results";

type AiBinding = {
	run: (
		model: string,
		input: {
			messages: Array<{ role: "system" | "user"; content: string }>;
			response_format?: { type: "json_object" };
		},
	) => Promise<{ response?: string }>;
};

type AttemptFeedbackContext = {
	attemptId: string;
	progress: ExamProgress;
	result?: ExamResultSummary;
};

const FALLBACK_MODEL = "@cf/openai/gpt-oss-20b";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE_URL =
	"https://generativelanguage.googleapis.com/v1beta";
const MAX_QUESTION_FEEDBACK_CHARS = 140;
const MATH_FALLBACK_TIPS = [
	"Томьёонд орсон тоо, тэмдэг, коэффициентоо нэг мөрөөр дахин шалга.",
	"Сүүлчийн тооцооллын алхмаа дахин нягтал.",
	"Орлуулсан утга бүрээ бодлогодоо буцааж шалга.",
	"Сөрөг тэмдэг, зэрэг, язгуур дээрээ онцгой анхаар.",
	"Тэнцэтгэлийн хоёр талыг ижил дүрмээр хувиргаснаа шалга.",
	"Хариугаа бодлогод буцааж орлуулж баталгаажуул.",
	"Задлах, нэгтгэх алхам дээрээ алдаа байгаа эсэхийг нягтал.",
	"Эцсийн хариугаа бичихийн өмнө завсрын мөрүүдээ нэг шалга.",
	"Тоонуудыг буруу хуулсан эсэхээ дахин нягтал.",
	"Завсрын хариугаа эцсийн мөртэйгээ тулгаж шалга.",
] as const;
type FeedbackOptions = {
	ai?: AiBinding;
	geminiApiKey?: string;
	geminiModel?: string;
	ollamaApiKey?: string;
	ollamaBaseUrl?: string;
	ollamaModel?: string;
};

type QuestionFeedbackItem = {
	baseExplanation: string;
	competency: string;
	correctAnswerText: string;
	prompt: string;
	questionId: string;
	questionType: "single-choice" | "math";
	selectedAnswerText: string;
};

type QuestionFeedbackResponse = {
	questionFeedback: Array<{
		feedback: string;
		questionId: string;
	}>;
};

const safeJsonParse = (value: string): AttemptFeedback | null => {
	try {
		const parsed = JSON.parse(value) as Partial<AttemptFeedback>;
		if (
			typeof parsed.headline !== "string" ||
			typeof parsed.summary !== "string" ||
			!Array.isArray(parsed.strengths) ||
			!Array.isArray(parsed.improvements)
		) {
			return null;
		}

		return {
			headline: parsed.headline.trim(),
			summary: parsed.summary.trim(),
			strengths: parsed.strengths
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
				.slice(0, 3),
			improvements: parsed.improvements
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
				.slice(0, 3),
		};
	} catch {
		return null;
	}
};

const safeQuestionFeedbackParse = (
	value: string,
): QuestionFeedbackResponse | null => {
	try {
		const parsed = JSON.parse(value) as Partial<QuestionFeedbackResponse>;
		if (!Array.isArray(parsed.questionFeedback)) {
			return null;
		}

		return {
			questionFeedback: parsed.questionFeedback
				.filter(
					(
						item,
					): item is {
						feedback: string;
						questionId: string;
					} =>
						Boolean(item) &&
						typeof item.questionId === "string" &&
						typeof item.feedback === "string",
				)
				.map((item) => ({
					questionId: item.questionId.trim(),
					feedback: item.feedback.trim(),
				}))
				.filter((item) => item.questionId.length > 0 && item.feedback.length > 0),
		};
	} catch {
		return null;
	}
};

export const parseAttemptFeedback = (
	value?: string | null,
): AttemptFeedback | undefined => {
	if (!value) return undefined;
	return safeJsonParse(value) ?? undefined;
};

export const stringifyAttemptFeedback = (
	feedback?: AttemptFeedback,
): string | null => (feedback ? JSON.stringify(feedback) : null);

const getOptionTextById = (
	options: Array<{ id?: string; text?: string }> | string[],
	optionId: string | null,
) => {
	if (!optionId) {
		return null;
	}

	for (const option of options) {
		if (
			option &&
			typeof option === "object" &&
			"id" in option &&
			option.id === optionId
		) {
			return option.text?.trim() || optionId;
		}

		if (typeof option === "string" && option === optionId) {
			return option;
		}
	}

	return optionId;
};

const buildSystemPrompt = () =>
	"Та шалгалтын дараах богино, дэмжсэн өнгө аястай монгол хэлний feedback JSON үүсгэнэ. headline, summary, strengths, improvements гэсэн 4 key ашигла. strengths болон improvements нь тус бүр 1-3 мөртэй массив байна.";

const buildQuestionFeedbackSystemPrompt = () =>
	"Та сурагчийн буруу эсвэл дутуу хариулт бүрт зориулсан маш товч монгол хэлний тайлбар JSON үүсгэнэ. Зөвхөн questionFeedback гэсэн key ашиглаж, массив дотор questionId ба feedback гэсэн 2 талбар өг. feedback нь дээд тал нь 2 маш богино өгүүлбэр, 140 тэмдэгт орчим байна. Эхлээд зөв хариуг товч дурд, дараа нь яг ямар алдаа гарсныг 1 богино өгүүлбэрээр хэл. 'Анхаарах санаа', 'Давтах зөвлөмж' зэрэг шошго бүү хэрэглэ.";

const buildUserPayload = (
	progress: ExamProgress,
	result: ExamResultSummary | undefined,
	monitoringSummary: Awaited<
		ReturnType<typeof getAttemptMonitoringSummaries>
	> extends Map<string, infer TValue>
		? TValue | undefined
		: undefined,
	fallback: AttemptFeedback,
) =>
	JSON.stringify({
		progress,
		result: result ?? null,
		monitoring: monitoringSummary ?? null,
		fallback,
	});

const buildQuestionFeedbackPayload = (items: QuestionFeedbackItem[]) =>
	JSON.stringify({
		questions: items,
		instruction:
			"questionId бүрийн feedback-ийг монгол хэлээр бич. Дээд тал нь 2 маш богино өгүүлбэр хэрэглэ. Эхний өгүүлбэрт зөв хариуг, хоёр дахь өгүүлбэрт алдааг л товч хэл. Давхардсан тайлбар, урт зөвлөмж, шошго бүү ашигла.",
	});

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const hasMeaningfulAnswerText = (value?: string | null) =>
	normalizeWhitespace(value ?? "").replace(/^["']+|["']+$/g, "").length > 0;

const splitSentences = (value: string) =>
	normalizeWhitespace(value)
		.split(/(?<=[.!?])\s+/)
		.map((sentence) => sentence.trim())
		.filter(Boolean);

const compactExplanation = (value: string, item: QuestionFeedbackItem) => {
	const sentences = splitSentences(
		value
			.replace(/^Анхаарах санаа:\s*/i, "")
			.replace(/^Давтах зөвлөмж:\s*/i, ""),
	);
	if (sentences.length === 0) {
		return "";
	}

	const selectedAnswer = item.selectedAnswerText.trim().toLowerCase();
	const correctAnswer = item.correctAnswerText.trim().toLowerCase();
	const hasSelectedAnswer = hasMeaningfulAnswerText(item.selectedAnswerText);
	const hasCorrectAnswer = hasMeaningfulAnswerText(item.correctAnswerText);

	const filtered = sentences.filter((sentence) => {
		const normalizedSentence = sentence.toLowerCase();
		const isRoutineSentence =
			/^(анхаарах санаа|давтах зөвлөмж)[:\s]/i.test(sentence) ||
			[
				"жишээ бодлого",
				"ижил хэв шинжийн",
				"ахиад ажилла",
				"үндсэн дүрэм",
				"бодолтын алхмуудаа",
				"алхмуудаа бич",
				"хэлбэрээр өг",
			].some((phrase) => normalizedSentence.includes(phrase));
		if (isRoutineSentence || isLikelyInstructionText(sentence)) {
			return false;
		}

		const mentionsSelected =
			selectedAnswer.length > 0 && normalizedSentence.includes(selectedAnswer);
		const mentionsCorrect =
			correctAnswer.length > 0 && normalizedSentence.includes(correctAnswer);
		const mentionsAnswerPattern =
			normalizedSentence.includes("зөв хари") ||
			normalizedSentence.includes("зөв нь");
		const mentionsEmptyCorrectAnswer =
			/зөв(?:\s+хари(?:у|улт)(?:\s+нь)?)?\s*["']{2}/i.test(sentence) ||
			normalizedSentence.includes('зөв нь ""') ||
			normalizedSentence.includes('зөв хариу нь ""') ||
			normalizedSentence.includes('зөв хариулт нь ""');

		if (mentionsEmptyCorrectAnswer) {
			return false;
		}

		if (mentionsSelected && mentionsCorrect && mentionsAnswerPattern) {
			return false;
		}

		if (!hasCorrectAnswer && (normalizedSentence.includes('зөв хари') || normalizedSentence.includes('зөв нь "')))
		{
			return false;
		}

		if (!hasSelectedAnswer && normalizedSentence.startsWith("энэ асуултад хариулаагүй")) {
			return false;
		}

		return true;
	});

	return filtered[0] ?? sentences[0] ?? "";
};

const pickRandomFallbackTip = (
	tips: readonly string[],
) => tips[Math.floor(Math.random() * tips.length)] ?? tips[0] ?? "";

const trimSentence = (value: string, maxLength: number) => {
	const normalized = normalizeWhitespace(value).replace(/^[:\-.,\s]+/, "");
	if (normalized.length <= maxLength) {
		return normalized;
	}

	const sliced = normalized.slice(0, maxLength).replace(/[,\s.:;!?-]+$/g, "");
	return `${sliced}.`;
};

const formatConciseQuestionFeedback = (
	value: string,
	item: QuestionFeedbackItem,
) => {
	const hasCorrectAnswer = hasMeaningfulAnswerText(item.correctAnswerText);
	const hasSelectedAnswer = hasMeaningfulAnswerText(item.selectedAnswerText);
	const coreExplanation = compactExplanation(value, item);
	const conciseExplanation = coreExplanation
		? trimSentence(coreExplanation, 78)
		: "";
	const correctPart = hasCorrectAnswer
		? hasSelectedAnswer
			? `Зөв нь "${item.correctAnswerText}".`
			: `Хариулаагүй. Зөв нь "${item.correctAnswerText}".`
		: hasSelectedAnswer
			? "Хариугаа дахин шалгаарай."
			: "Хариулаагүй байна.";

	const explanationMentionsCorrect =
		hasCorrectAnswer &&
		conciseExplanation
			.toLowerCase()
			.includes(item.correctAnswerText.trim().toLowerCase());
	const parts = [correctPart];
	if (conciseExplanation && !explanationMentionsCorrect) {
		parts.push(conciseExplanation);
	} else if (!parts[0] && conciseExplanation) {
		parts.push(conciseExplanation);
	}

	const merged = normalizeWhitespace(parts.join(" "));
	return trimSentence(merged, MAX_QUESTION_FEEDBACK_CHARS);
};

const sanitizeGeneratedQuestionFeedback = (
	value: string,
	item: QuestionFeedbackItem,
) => {
	const normalized = normalizeWhitespace(value);
	if (!normalized) {
		return "";
	}

	const hasBlockedPattern =
		/анхаарах санаа/i.test(normalized) ||
		/давтах зөвлөмж/i.test(normalized) ||
		/жишээ бодлого/i.test(normalized) ||
		/ижил хэв шинж/i.test(normalized) ||
		/зөв(?:\s+хари(?:у|улт)(?:\s+нь)?)?\s*["']{2}/i.test(normalized);

	if (hasBlockedPattern) {
		return "";
	}

	const formatted = formatConciseQuestionFeedback(normalized, item);
	if (
		!formatted ||
		/анхаарах санаа/i.test(formatted) ||
		/давтах зөвлөмж/i.test(formatted) ||
		/зөв(?:\s+хари(?:у|улт)(?:\s+нь)?)?\s*["']{2}/i.test(formatted)
	) {
		return "";
	}

	return formatted;
};

const isLikelyInstructionText = (value: string) => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	return [
		"бодолтын алхмууд",
		"алхмуудаа бич",
		"эцсийн хариуг",
		"хэлбэрээр өг",
		"тайлбарла",
		"write your steps",
		"show your work",
	].some((phrase) => normalized.includes(phrase));
};

const normalizeStudyTopic = (value: string, questionType: QuestionFeedbackItem["questionType"]) => {
	const trimmed = value.trim();
	if (!trimmed || trimmed === "external-import") {
		return questionType === "math"
			? "энэ төрлийн математикийн бодлого"
			: "энэ агуулга";
	}

	return `${trimmed} сэдэв`;
};

const parseNumericValue = (value: string) => {
	const normalized = value.replace(/,/g, ".").replace(/\s+/g, "");
	if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
		return null;
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
};

const extractSimpleSubtraction = (prompt: string) => {
	const compact = prompt
		.replace(/\s+/g, " ")
		.replace(/[=?:]+/g, " ")
		.replace(/[^\d+\- ]/g, " ");
	const match = compact.match(/(^| )(-?\d+)\s*-\s*(-?\d+)( |$)/);
	if (!match) {
		return null;
	}

	const left = Number(match[2]);
	const right = Number(match[3]);
	if (!Number.isFinite(left) || !Number.isFinite(right)) {
		return null;
	}

	return { left, right, result: left - right };
};

const buildFormulaRelationReminder = (item: QuestionFeedbackItem) => {
	if (hasMeaningfulAnswerText(item.correctAnswerText)) {
		return "";
	}

	const combined = `${item.prompt} ${item.baseExplanation}`.toLowerCase();
	const mentionsFormulaRelation =
		/(томьёо|хамаар|функц|formula|function)/i.test(combined) ||
		(/[xх]/i.test(combined) && /[yу]/i.test(combined));

	if (!mentionsFormulaRelation) {
		return "";
	}

	return "Томьёог уншихдаа аль хувьсагч нь алинаасаа хамаарч байгааг эхэлж зөв тогтоо. Жишээлбэл x-ийг y-ээр илэрхийлсэн бол x нь y-ээс хамаарна.";
};

const buildFallbackQuestionFeedback = (item: QuestionFeedbackItem) => {
	const subtraction = extractSimpleSubtraction(item.prompt);
	const studentNumeric = parseNumericValue(item.selectedAnswerText);
	const correctNumeric = parseNumericValue(item.correctAnswerText);
	if (
		subtraction &&
		studentNumeric !== null &&
		correctNumeric !== null &&
		studentNumeric !== correctNumeric &&
		subtraction.left < subtraction.right &&
		correctNumeric < 0 &&
		studentNumeric >= 0
	) {
		return `Зөв нь "${item.correctAnswerText}". Сөрөг тэмдгээ алдсан байна.`;
	}

	if (
		item.questionType === "math" &&
		item.correctAnswerText.includes("+ C") &&
		item.selectedAnswerText &&
		!item.selectedAnswerText.includes("+ C")
	) {
		return `Зөв нь "${item.correctAnswerText}". Интегралын +C-г орхигдуулсан байна.`;
	}

	const formulaRelationReminder = buildFormulaRelationReminder(item);
	if (formulaRelationReminder) {
		return formatConciseQuestionFeedback(formulaRelationReminder, item);
	}

	const explanation = item.baseExplanation
		? compactExplanation(item.baseExplanation, item)
		: "";
	if (
		!hasMeaningfulAnswerText(item.correctAnswerText) &&
		!explanation
	) {
		return hasMeaningfulAnswerText(item.selectedAnswerText)
			? "Хариугаа дахин шалгаарай."
			: "Хариулаагүй байна.";
	}

	const studyTopic = normalizeStudyTopic(item.competency, item.questionType);
	const reminder =
		explanation ||
		(item.questionType === "math"
			? pickRandomFallbackTip(MATH_FALLBACK_TIPS)
			: `${studyTopic}-ийн үндсэн ойлголтоо дахин шалгаарай.`);

	return formatConciseQuestionFeedback(reminder, item);
};

const buildQuestionFeedbackItems = (
	rows: AttemptResultRow[],
	result: ExamResultSummary,
) => {
	const rowByQuestionId = new Map(rows.map((row) => [row.questionId, row] as const));

	return result.questionResults
		.filter(
			(question) =>
				!question.isCorrect || question.pointsAwarded < question.maxPoints,
		)
		.map((question) => {
			const row = rowByQuestionId.get(question.questionId);
			const options = row
				? (getQuestionOptions({ options: row.options }) as
						| Array<{ id?: string; text?: string }>
						| string[])
				: [];
			const selectedAnswerText =
				question.questionType === "math"
					? question.selectedOptionId?.trim() || ""
					: getOptionTextById(options, question.selectedOptionId) ?? "";
			const correctAnswerText =
				question.questionType === "math"
					? row?.answerLatex?.trim() ||
						(!isLikelyInstructionText(question.correctOptionId?.trim() || "")
							? question.correctOptionId?.trim() || ""
							: "")
					: getOptionTextById(options, question.correctOptionId) ?? "";

			return {
				baseExplanation:
					question.explanation?.trim() ||
					(!isLikelyInstructionText(row?.responseGuide?.trim() || "")
						? row?.responseGuide?.trim() || ""
						: "") ||
					row?.explanation?.trim() ||
					"",
				competency: question.competency?.trim() || row?.competency?.trim() || "",
				correctAnswerText,
				prompt: question.prompt?.trim() || row?.prompt?.trim() || question.questionId,
				questionId: question.questionId,
				questionType: question.questionType,
				selectedAnswerText,
			} satisfies QuestionFeedbackItem;
		})
		.filter((item) => item.correctAnswerText.length > 0 || item.baseExplanation.length > 0);
};

const generateGeminiQuestionFeedback = async (
	items: QuestionFeedbackItem[],
	options: FeedbackOptions,
) => {
	if (!options.geminiApiKey || items.length === 0) {
		return null;
	}

	const response = await fetch(
		`${GEMINI_API_BASE_URL}/models/${options.geminiModel ?? DEFAULT_GEMINI_MODEL}:generateContent?key=${options.geminiApiKey}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: buildQuestionFeedbackSystemPrompt() }],
				},
				contents: [
					{
						role: "user",
						parts: [{ text: buildQuestionFeedbackPayload(items) }],
					},
				],
				generationConfig: {
					responseMimeType: "application/json",
					temperature: 0.3,
				},
			}),
		},
	);

	if (!response.ok) {
		throw new Error(`Gemini question feedback failed with status ${response.status}`);
	}

	const payload = (await response.json()) as {
		candidates?: Array<{
			content?: {
				parts?: Array<{ text?: string }>;
			};
		}>;
	};
	const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
	return text ? safeQuestionFeedbackParse(text) : null;
};

const generateOllamaQuestionFeedback = async (
	items: QuestionFeedbackItem[],
	options: FeedbackOptions,
) => {
	if (!options.ollamaBaseUrl || items.length === 0) {
		return null;
	}

	const ollama = await chatWithOllama({
		apiKey: options.ollamaApiKey,
		baseUrl: options.ollamaBaseUrl,
		context: "Question feedback",
		messages: [
			{ role: "system", content: buildQuestionFeedbackSystemPrompt() },
			{ role: "user", content: buildQuestionFeedbackPayload(items) },
		],
		model: options.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
	});
	return safeQuestionFeedbackParse(ollama.content);
};

export const enrichResultWithQuestionFeedback = async (
	rows: AttemptResultRow[],
	result: ExamResultSummary,
	options: FeedbackOptions = {},
): Promise<ExamResultSummary> => {
	const items = buildQuestionFeedbackItems(rows, result);
	const aiEligibleItems = items.filter((item) => item.questionType !== "math");
	const itemByQuestionId = new Map(
		items.map((item) => [item.questionId, item] as const),
	);
	if (items.length === 0) {
		return result;
	}

	const feedbackByQuestionId = new Map<string, string>();
	const feedbackSourceByQuestionId = new Map<string, AiContentSource>();
	const applyGeneratedFeedback = (
		questionFeedback: QuestionFeedbackResponse["questionFeedback"],
		source: AiContentSource,
	) => {
		for (const item of questionFeedback) {
			const targetItem = itemByQuestionId.get(item.questionId);
			if (!targetItem) {
				continue;
			}

			const sanitized = sanitizeGeneratedQuestionFeedback(
				item.feedback,
				targetItem,
			);
			if (!sanitized) {
				continue;
			}

			feedbackByQuestionId.set(item.questionId, sanitized);
			feedbackSourceByQuestionId.set(item.questionId, source);
		}
	};

	try {
		try {
			const ollamaFeedback = await generateOllamaQuestionFeedback(
				aiEligibleItems,
				options,
			);
			if (ollamaFeedback) {
				applyGeneratedFeedback(ollamaFeedback.questionFeedback, "ollama");
			}
		} catch {
			// Try the next provider.
		}

		if (feedbackByQuestionId.size === 0) {
			try {
				const geminiFeedback = await generateGeminiQuestionFeedback(
					aiEligibleItems,
					options,
				);
				if (geminiFeedback) {
					applyGeneratedFeedback(geminiFeedback.questionFeedback, "gemini");
				}
			} catch {
				// Fall through to deterministic fallback.
			}
		}
	} catch {
		// Fall through to deterministic fallback.
	}

	for (const item of items) {
		if (feedbackByQuestionId.has(item.questionId)) {
			continue;
		}

		feedbackByQuestionId.set(item.questionId, buildFallbackQuestionFeedback(item));
		feedbackSourceByQuestionId.set(item.questionId, "fallback");
	}

	return {
		...result,
		questionResults: result.questionResults.map((question) => {
			if (question.isCorrect && question.pointsAwarded >= question.maxPoints) {
				return question;
			}

			return {
				...question,
				explanation:
					feedbackByQuestionId.get(question.questionId) ||
					question.explanation,
				explanationSource:
					feedbackSourceByQuestionId.get(question.questionId) ??
					question.explanationSource,
			};
		}),
	};
};

const generateGeminiFeedback = async (
	systemPrompt: string,
	userPayload: string,
	options: FeedbackOptions,
) => {
	if (!options.geminiApiKey) {
		return null;
	}

	const response = await fetch(
		`${GEMINI_API_BASE_URL}/models/${options.geminiModel ?? DEFAULT_GEMINI_MODEL}:generateContent?key=${options.geminiApiKey}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				systemInstruction: {
					parts: [{ text: systemPrompt }],
				},
				contents: [
					{
						role: "user",
						parts: [{ text: userPayload }],
					},
				],
				generationConfig: {
					responseMimeType: "application/json",
					temperature: 0.4,
				},
			}),
		},
	);

	if (!response.ok) {
		throw new Error(`Gemini feedback failed with status ${response.status}`);
	}

	const payload = (await response.json()) as {
		candidates?: Array<{
			content?: {
				parts?: Array<{
					text?: string;
				}>;
			};
		}>;
	};
	const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
	return text ? safeJsonParse(text) : null;
};

const generateOllamaFeedback = async (
	systemPrompt: string,
	userPayload: string,
	options: FeedbackOptions,
) => {
	if (!options.ollamaBaseUrl) {
		return null;
	}

	const ollama = await chatWithOllama({
		apiKey: options.ollamaApiKey,
		baseUrl: options.ollamaBaseUrl,
		context: "Attempt feedback",
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPayload },
		],
		model: options.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
	});
	return safeJsonParse(ollama.content);
};

const buildFallbackFeedback = (
	progress: ExamProgress,
	result: ExamResultSummary | undefined,
	monitoringSummary: Awaited<
		ReturnType<typeof getAttemptMonitoringSummaries>
	> extends Map<string, infer TValue>
		? TValue | undefined
		: undefined,
): AttemptFeedback => {
	const strengths: string[] = [];
	const improvements: string[] = [];

	if (progress.completionRate >= 100) {
		strengths.push("Бүх асуултад хариулахыг оролдсон байна.");
	} else if (progress.completionRate >= 75) {
		strengths.push("Ихэнх асуултаа бүрэн бөглөсөн байна.");
	} else {
		improvements.push("Хариулаагүй үлдсэн асуултуудаа дахин шалгаж хэвшээрэй.");
	}

	if (result) {
		if (result.percentage >= 80) {
			strengths.push("Ойлголт сайн, үндсэн агуулгаа зөв барьжээ.");
		} else if (result.percentage >= 60) {
			strengths.push("Суурь ойлголт байгаа ч зарим асуултад нягтлах хэрэгтэй байна.");
		} else {
			improvements.push("Сэдвийн суурь ухагдахуунаа дахин давтаж баталгаажуулаарай.");
		}

		if (result.unansweredCount > 0) {
			improvements.push("Хугацааны менежментээ сайжруулбал дутуу асуулт багасна.");
		}
	}

	if ((monitoringSummary?.dangerCount ?? 0) === 0) {
		strengths.push("Шалгалтын явцад анхаарлаа харьцангуй тогтвортой хадгалжээ.");
	} else {
		improvements.push("Tab солих, fullscreen гарах зэрэг үйлдлээ багасгаарай.");
	}

	if (strengths.length === 0) {
		strengths.push("Шалгалтаа дуусгаж, хариултаа амжилттай илгээлээ.");
	}

	if (improvements.length === 0) {
		improvements.push("Дараагийн удаа шийдлээ дахин нэг нягталж хэвшээрэй.");
	}

	return {
		headline: result
			? "Шалгалтын дараах зөвлөмж"
			: "Хариулт амжилттай илгээгдлээ",
		summary: result
			? `Та ${result.maxScore} онооноос ${result.score} авч, ${result.percentage}% гүйцэтгэл үзүүллээ.`
			: "Таны хариулт багшийн систем рүү илгээгдсэн. Дүн батлагдахаас өмнө ерөнхий зөвлөмжийг хүргэж байна.",
		strengths: strengths.slice(0, 3),
		improvements: improvements.slice(0, 3),
		source: "fallback",
	};
};

export const generateAttemptFeedback = async (
	db: DbClient,
	context: AttemptFeedbackContext,
	options: FeedbackOptions = {},
): Promise<AttemptFeedback> => {
	const monitoringSummary = (
		await getAttemptMonitoringSummaries(db, [context.attemptId])
	).get(context.attemptId);

	const fallback = buildFallbackFeedback(
		context.progress,
		context.result,
		monitoringSummary,
	);

	try {
		const systemPrompt = buildSystemPrompt();
		const userPayload = buildUserPayload(
			context.progress,
			context.result,
			monitoringSummary,
			fallback,
		);

		try {
			const geminiFeedback = await generateGeminiFeedback(
				systemPrompt,
				userPayload,
				options,
			);
			if (geminiFeedback) {
				return { ...geminiFeedback, source: "gemini" };
			}
		} catch {
			// Try the next provider.
		}

		try {
			const ollamaFeedback = await generateOllamaFeedback(
				systemPrompt,
				userPayload,
				options,
			);
			if (ollamaFeedback) {
				return { ...ollamaFeedback, source: "ollama" };
			}
		} catch {
			// Fall through to the next provider.
		}

		if (!options.ai) {
			return fallback;
		}

		const response = await options.ai.run(FALLBACK_MODEL, {
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPayload },
			],
			response_format: { type: "json_object" },
		});

		const parsed = response.response ? safeJsonParse(response.response) : null;
		return parsed ? { ...parsed, source: "cf-ai" } : fallback;
	} catch {
		return fallback;
	}
};
