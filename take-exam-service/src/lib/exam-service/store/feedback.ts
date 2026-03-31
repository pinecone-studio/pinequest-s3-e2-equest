import type {
	AiContentSource,
	AttemptFeedback,
	ExamProgress,
	ExamResultSummary,
} from "@/lib/exam-service/types";
import type { DbClient } from "@/lib/db";
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
const DEFAULT_OLLAMA_MODEL = "llama3.1";

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

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

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
	"Та сурагчийн буруу эсвэл дутуу хариулт бүрт зориулсан богино монгол хэлний тайлбар JSON үүсгэнэ. Зөвхөн questionFeedback гэсэн key ашиглаж, массив дотор questionId ба feedback гэсэн 2 талбар өг. feedback нь 2-4 өгүүлбэртэй, юун дээр алдсан, зөв хариу юу байсан, ямар сэдвийг гүнзгийрүүлж давтах ёстойг ойлгомжтой тайлбарлана.";

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
			"questionId бүрийн feedback-ийг монгол хэлээр бич. Асуултын prompt, сурагчийн өгсөн хариулт, зөв хариуг хооронд нь харьцуулж яг аль алхам эсвэл ойлголт дээр алдсаныг тодорхой тайлбарла. Хэт ерөнхий тайлбар бүү өг. Зөв хариуг дурд. Ямар дүрэм, сэдэв, эсвэл аргачлалаа давтах хэрэгтэйг заавал хэл.",
	});

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
		return `Та ${subtraction.left}-${subtraction.right} үйлдлийг ${item.selectedAnswerText} гэж бодсон байна. Бага тооноос их тоог хасахад хариу сөрөг тэмдэгтэй гардгийг алдсан байна. ${item.correctAnswerText} гэж гарах шалтгааныг тооны шулуун дээр дүрслээд, сөрөг тооны хасалтын жишээ бодлогуудыг дахин ажиллаарай.`;
	}

	if (
		item.questionType === "math" &&
		item.correctAnswerText.includes("+ C") &&
		item.selectedAnswerText &&
		!item.selectedAnswerText.includes("+ C")
	) {
		return `Та үндсэн илэрхийллээ зөв олсон байж болох ч интегралын тогтмол болох +C-г орхигдуулсан байна. Зөв хариу нь "${item.correctAnswerText}" гэдгийг анзаараад, интеграл бодох бүрдээ эцсийн мөрөндөө +C нэмэх дүрмээ бататгаарай.`;
	}

	const lead = item.selectedAnswerText
		? `Таны хариулт "${item.selectedAnswerText}" байсан ч зөв хариу нь "${item.correctAnswerText}" байна.`
		: `Энэ асуултад хариулаагүй байна. Зөв хариу нь "${item.correctAnswerText}" юм.`;
	const explanation = item.baseExplanation
		? `Анхаарах санаа: ${item.baseExplanation}`
		: "Үндсэн ойлголтоо нэгтгэж, бодох алхмаа дахин шалгах хэрэгтэй.";
	const studyTopic = normalizeStudyTopic(item.competency, item.questionType);

	return `${lead} ${explanation} Давтах зөвлөмж: ${studyTopic}-ийн үндсэн дүрэм, жишээ бодлого болон ижил хэв шинжийн даалгавруудыг ахиад ажиллаарай.`;
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
					row?.responseGuide?.trim() ||
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

	const response = await fetch(`${normalizeBaseUrl(options.ollamaBaseUrl)}/api/chat`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(options.ollamaApiKey
				? { Authorization: `Bearer ${options.ollamaApiKey}` }
				: {}),
		},
		body: JSON.stringify({
			model: options.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
			stream: false,
			format: "json",
			messages: [
				{ role: "system", content: buildQuestionFeedbackSystemPrompt() },
				{ role: "user", content: buildQuestionFeedbackPayload(items) },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Ollama question feedback failed with status ${response.status}`);
	}

	const payload = (await response.json()) as {
		error?: string;
		message?: { content?: string };
		response?: string;
	};

	if (payload.error) {
		throw new Error(payload.error);
	}

	const content = payload.message?.content ?? payload.response;
	return content ? safeQuestionFeedbackParse(content) : null;
};

export const enrichResultWithQuestionFeedback = async (
	rows: AttemptResultRow[],
	result: ExamResultSummary,
	options: FeedbackOptions = {},
): Promise<ExamResultSummary> => {
	const items = buildQuestionFeedbackItems(rows, result);
	if (items.length === 0) {
		return result;
	}

	let feedbackByQuestionId = new Map<string, string>();
	let feedbackSourceByQuestionId = new Map<string, AiContentSource>();

	try {
		try {
			const ollamaFeedback = await generateOllamaQuestionFeedback(items, options);
			if (ollamaFeedback) {
				feedbackByQuestionId = new Map(
					ollamaFeedback.questionFeedback.map((item) => [item.questionId, item.feedback] as const),
				);
				feedbackSourceByQuestionId = new Map(
					ollamaFeedback.questionFeedback.map((item) => [
						item.questionId,
						"ollama" as const,
					] as const),
				);
			}
		} catch {
			// Try the next provider.
		}

		if (feedbackByQuestionId.size === 0) {
			try {
				const geminiFeedback = await generateGeminiQuestionFeedback(items, options);
				if (geminiFeedback) {
					feedbackByQuestionId = new Map(
						geminiFeedback.questionFeedback.map((item) => [item.questionId, item.feedback] as const),
					);
					feedbackSourceByQuestionId = new Map(
						geminiFeedback.questionFeedback.map((item) => [
							item.questionId,
							"gemini" as const,
						] as const),
					);
				}
			} catch {
				// Fall through to deterministic fallback.
			}
		}
	} catch {
		// Fall through to deterministic fallback.
	}

	if (feedbackByQuestionId.size === 0) {
		feedbackByQuestionId = new Map();
		for (const item of items) {
			feedbackByQuestionId.set(item.questionId, buildFallbackQuestionFeedback(item));
			feedbackSourceByQuestionId.set(item.questionId, "fallback");
		}
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

	const response = await fetch(`${normalizeBaseUrl(options.ollamaBaseUrl)}/api/chat`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(options.ollamaApiKey
				? { Authorization: `Bearer ${options.ollamaApiKey}` }
				: {}),
		},
		body: JSON.stringify({
			model: options.ollamaModel ?? DEFAULT_OLLAMA_MODEL,
			stream: false,
			format: "json",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPayload },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Ollama feedback failed with status ${response.status}`);
	}

	const payload = (await response.json()) as {
		error?: string;
		message?: {
			content?: string;
		};
		response?: string;
	};

	if (payload.error) {
		throw new Error(payload.error);
	}

	const content = payload.message?.content ?? payload.response;
	return content ? safeJsonParse(content) : null;
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
