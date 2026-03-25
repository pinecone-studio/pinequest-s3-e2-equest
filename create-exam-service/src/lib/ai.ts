import { GoogleGenerativeAI } from "@google/generative-ai";
import { GraphQLError } from "graphql";
import type { ExamGenerationInput, GeneratedQuestionPayload } from "../graphql/types";

const MODEL = "gemini-2.0-flash";

function randomUUID(): string {
	return globalThis.crypto.randomUUID();
}

function examTypeLabel(t: string): string {
	switch (t) {
		case "PERIODIC_1":
			return "Явцын шалгалт 1";
		case "PERIODIC_2":
			return "Явцын шалгалт 2";
		case "MIDTERM":
			return "Дундын шалгалт";
		case "FINAL_TERM":
			return "Жилийн эцсийн шалгалт";
		case "MID_TERM":
			return "Дундын шалгалт";
		default:
			return t;
	}
}

function buildPrompt(input: ExamGenerationInput): string {
	const { easy, medium, hard } = input.difficultyDistribution;
	const df = input.difficultyFormats;
	const pts = input.difficultyPoints;
	const pointsText =
		pts &&
		(pts.easyPoints != null || pts.mediumPoints != null || pts.hardPoints != null)
			? `\nОноо (асуулт бүрт): Хялбар=${pts.easyPoints ?? "—"}, Дунд=${pts.mediumPoints ?? "—"}, Хэцүү=${pts.hardPoints ?? "—"}`
			: "";

	return `Та бол Монголын ерөнхий боловсролын сургуулийн шалгалтын асуулт үүсгэгч AI.
Таны даалгавар: JSON массив л буцаах. Өөр текст, markdown, тайлбар бичихгүй.

Шалгалтын мэдээлэл:
- Анги: ${input.gradeClass}
- Хичээл: ${input.subject}
- Төрөл: ${examTypeLabel(input.examType)}
- Хамрах сэдэв: ${input.topicScope}
- Огноо: ${input.examDate}, цаг: ${input.examTime}, хугацаа: ${input.durationMinutes} минут
- Нийт асуултын тоо: ${input.totalQuestionCount} (заавал энэ тоо)
- Хүндлэлийн тоо: хялбар=${easy}, дунд=${medium}, хэцүү=${hard} (нийлбэр нь заавал ${input.totalQuestionCount} байна)
${pointsText}

Асуултын хэлбэр (хатуу дагах):
- Бүх EASY асуулт: format заавал "${df.easy}"
- Бүх MEDIUM асуулт: format заавал "${df.medium}"
- Бүх HARD асуулт: format заавал "${df.hard}"

JSON элемент бүрт талбарууд:
- text: асуултын текст
- format: дээрх хүндлэлийн дагуу яг тэр формат (EASY→${df.easy}, MEDIUM→${df.medium}, HARD→${df.hard})
- difficulty: EASY | MEDIUM | HARD
- options: зөвхөн сонголттой хэлбэрүүдэд (массив), бусад бол null эсвэл хоосон
- correctAnswer: зөв хариулт (текст эсвэл үсэг)
- explanation: товч тайлбар

Журмын дагуу нийт ${easy + medium + hard} асуулт үүсгэ, хүндлэлийн тоо яг дээрхтэй тохироход анхаар.`;
}

function parseJsonArray(raw: string): unknown[] {
	const trimmed = raw.trim();
	const start = trimmed.indexOf("[");
	const end = trimmed.lastIndexOf("]");
	if (start === -1 || end === -1 || end <= start) {
		throw new GraphQLError("AI хариу JSON массив олдсонгүй");
	}
	const json = trimmed.slice(start, end + 1);
	const parsed = JSON.parse(json) as unknown;
	if (!Array.isArray(parsed)) {
		throw new GraphQLError("AI хариу массив биш байна");
	}
	return parsed;
}

function parseQuestionsPayload(text: string): unknown[] {
	const trimmed = text.trim();
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return parseJsonArray(trimmed);
	}
	if (Array.isArray(parsed)) {
		return parsed;
	}
	if (
		parsed &&
		typeof parsed === "object" &&
		"questions" in parsed &&
		Array.isArray((parsed as { questions: unknown }).questions)
	) {
		return (parsed as { questions: unknown[] }).questions;
	}
	throw new GraphQLError("AI хариу JSON массив биш байна");
}

export async function generateExamQuestionsWithAI(
	apiKey: string,
	input: ExamGenerationInput,
): Promise<
	Array<{
		id: string;
		text: string;
		format: string;
		difficulty: string;
		options: string[] | null;
		correctAnswer: string | null;
		explanation: string | null;
	}>
> {
	if (!apiKey?.trim()) {
		throw new GraphQLError(
			"GEMINI_API_KEY тохируулаагүй байна (.dev.vars эсвэл Cloudflare secret)",
		);
	}

	const { easy, medium, hard } = input.difficultyDistribution;
	const sum = easy + medium + hard;
	if (sum !== input.totalQuestionCount) {
		throw new GraphQLError(
			`Хүндлэлийн нийлбэр (${sum}) нийт асуултын тоо (${input.totalQuestionCount})-тай тэнцүү байх ёстой`,
		);
	}
	if (
		!input.difficultyFormats?.easy ||
		!input.difficultyFormats?.medium ||
		!input.difficultyFormats?.hard
	) {
		throw new GraphQLError("Хүндлэл бүрт асуултын хэлбэр сонгоно уу");
	}

	const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({
		model: MODEL,
		generationConfig: {
			responseMimeType: "application/json",
		},
	});

	const prompt = buildPrompt(input);
	let text: string;
	try {
		const result = await model.generateContent(prompt);
		text = result.response.text();
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new GraphQLError(`AI алдаа: ${msg}`);
	}

	let rows: unknown[];
	try {
		rows = parseQuestionsPayload(text);
	} catch (e) {
		if (e instanceof GraphQLError) {
			throw e;
		}
		throw new GraphQLError("AI хариу задлахад алдаа гарлаа");
	}

	const validated: GeneratedQuestionPayload[] = [];
	for (const row of rows) {
		if (!row || typeof row !== "object") continue;
		const r = row as Record<string, unknown>;
		const textQ = typeof r.text === "string" ? r.text : "";
		const format = typeof r.format === "string" ? r.format : "SINGLE_CHOICE";
		const difficulty = typeof r.difficulty === "string" ? r.difficulty : "MEDIUM";
		let options: string[] | null = null;
		if (Array.isArray(r.options)) {
			options = r.options.filter((x): x is string => typeof x === "string");
		}
		const correctAnswer =
			r.correctAnswer == null
				? null
				: String(r.correctAnswer);
		const explanation =
			r.explanation == null
				? null
				: String(r.explanation);
		validated.push({
			text: textQ,
			format,
			difficulty,
			options,
			correctAnswer,
			explanation,
		});
	}

	if (validated.length !== input.totalQuestionCount) {
		throw new GraphQLError(
			`AI ${validated.length} асуулт үүсгэсэн, гэхдээ хүссэн тоо ${input.totalQuestionCount} байна. Дахин оролдоно уу.`,
		);
	}

	const countEasy = validated.filter((q) => q.difficulty === "EASY").length;
	const countMed = validated.filter((q) => q.difficulty === "MEDIUM").length;
	const countHard = validated.filter((q) => q.difficulty === "HARD").length;
	if (countEasy !== easy || countMed !== medium || countHard !== hard) {
		throw new GraphQLError(
			`Хүндлэлийн тоо таарахгүй байна: AI (хялбар ${countEasy}, дунд ${countMed}, хэцүү ${countHard}), хүсэлт (${easy}, ${medium}, ${hard})`,
		);
	}

	const df = input.difficultyFormats;
	const formatFor = (d: string): string => {
		if (d === "EASY") {
			return df.easy;
		}
		if (d === "MEDIUM") {
			return df.medium;
		}
		if (d === "HARD") {
			return df.hard;
		}
		return df.medium;
	};

	return validated.map((q) => ({
		id: randomUUID(),
		text: q.text,
		format: formatFor(q.difficulty),
		difficulty: q.difficulty,
		options: q.options ?? null,
		correctAnswer: q.correctAnswer ?? null,
		explanation: q.explanation ?? null,
	}));
}
