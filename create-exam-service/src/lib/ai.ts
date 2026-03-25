import { GoogleGenerativeAI } from "@google/generative-ai";
import { GraphQLError } from "graphql";
import type {
  ExamGenerationInput,
  GeneratedQuestionPayload,
} from "../graphql/types";

const MODEL = "gemini-1.5-flash";

function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GeminiErrorInfo = {
  kind:
    | "leaked_key"
    | "quota"
    | "rate_limited"
    | "auth"
    | "network"
    | "unknown";
  retryAfterSeconds?: number;
  userMessage: string;
  rawMessage: string;
};

function parseRetryDelaySeconds(raw: string): number | undefined {
  // Examples seen in messages:
  // - Please retry in 50.647662517s.
  // - "retryDelay":"50s"
  const m1 = raw.match(/Please retry in\s+([\d.]+)s/i);
  if (m1?.[1]) {
    const n = Number(m1[1]);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  const m2 = raw.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (m2?.[1]) {
    const n = Number(m2[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function classifyGeminiError(e: unknown): GeminiErrorInfo {
  const rawMessage = e instanceof Error ? e.message : String(e);
  const msg = rawMessage.toLowerCase();
  const retryAfterSeconds = parseRetryDelaySeconds(rawMessage);

  // Leaked/compromised key
  if (
    msg.includes("api key was reported as leaked") ||
    msg.includes("reported as leaked")
  ) {
    return {
      kind: "leaked_key",
      userMessage:
        "Gemini API түлхүүр (GEMINI_API_KEY) ил гарсан гэж Google блоклосон байна. Шинэ түлхүүр үүсгээд Cloudflare Worker secret-ээ шинэчилнэ үү (wrangler secret put GEMINI_API_KEY).",
      rawMessage,
    };
  }

  // Quota/rate limiting
  if (msg.includes("quota") || msg.includes("exceeded your current quota")) {
    return {
      kind: "quota",
      retryAfterSeconds,
      userMessage:
        "Gemini quota хэтэрсэн/0 байна (billing/plan/quota шалгана уу). " +
        (retryAfterSeconds
          ? `${retryAfterSeconds}s хүлээгээд дахин оролдоно уу.`
          : "Дахин оролдоно уу."),
      rawMessage,
    };
  }
  if (msg.includes("429") || msg.includes("too many requests")) {
    return {
      kind: "rate_limited",
      retryAfterSeconds,
      userMessage:
        "Gemini rate limit (429). " +
        (retryAfterSeconds
          ? `${retryAfterSeconds}s хүлээгээд дахин оролдоно уу.`
          : "Түр хүлээгээд дахин оролдоно уу."),
      rawMessage,
    };
  }

  // Auth-ish failures
  if (
    msg.includes("403") ||
    msg.includes("forbidden") ||
    msg.includes("unauthorized")
  ) {
    return {
      kind: "auth",
      userMessage:
        "Gemini руу хандах эрхгүй байна (403/Unauthorized). GEMINI_API_KEY болон project-ийн permission/billing-ийг шалгана уу.",
      rawMessage,
    };
  }

  // Generic network
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout")
  ) {
    return {
      kind: "network",
      retryAfterSeconds,
      userMessage:
        "Gemini руу хүсэлт явуулах үед сүлжээний алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.",
      rawMessage,
    };
  }

  return {
    kind: "unknown",
    retryAfterSeconds,
    userMessage: "Gemini AI алдаа гарлаа. Дахин оролдоно уу.",
    rawMessage,
  };
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
    case "PRACTICE":
      return "Давтлага шалгалт";
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
  const fd = input.formatDistribution ?? null;
  const pointsText =
    pts &&
    (pts.easyPoints != null ||
      pts.mediumPoints != null ||
      pts.hardPoints != null)
      ? `\nОноо (асуулт бүрт): Хялбар=${pts.easyPoints ?? "—"}, Дунд=${pts.mediumPoints ?? "—"}, Хэцүү=${pts.hardPoints ?? "—"}`
      : "";

  const formatText = fd
    ? `\nАсуултын хэлбэр — тоо (нийлбэр нь заавал ${input.totalQuestionCount} байна):\n- SINGLE_CHOICE: ${fd.singleChoice}\n- MULTIPLE_CHOICE: ${fd.multipleChoice}\n- MATCHING: ${fd.matching}\n- FILL_IN: ${fd.fillIn}\n- WRITTEN: ${fd.written}`
    : "";

  const formatRules = fd
    ? `\nАсуултын хэлбэр (хатуу дагах):\n- Дээрх формат бүрийн ТОГТООСОН ТОО-г яг баримтал (нийлбэр нь ${input.totalQuestionCount}).\n- Асуулт бүрийн "format" талбар нь заавал QuestionFormat enum-ын нэг байна: SINGLE_CHOICE | MULTIPLE_CHOICE | MATCHING | FILL_IN | WRITTEN`
    : `\nАсуултын хэлбэр (хатуу дагах):\n- Бүх EASY асуулт: format заавал "${df.easy}"\n- Бүх MEDIUM асуулт: format заавал "${df.medium}"\n- Бүх HARD асуулт: format заавал "${df.hard}"`;

  return `Та бол Монголын ерөнхий боловсролын сургуулийн шалгалтын асуулт үүсгэгч AI.
Таны даалгавар: JSON массив л буцаах. Өөр текст, markdown, тайлбар бичихгүй.
Математик томьёог заавал $...$ тэмдэгтээр хүрээлж LaTeX форматаар бичнэ үү.

Шалгалтын мэдээлэл:
- Анги: ${input.gradeClass}
- Хичээл: ${input.subject}
- Төрөл: ${examTypeLabel(input.examType)}
- Хамрах сэдэв: ${input.topicScope}
- Огноо: ${input.examDate}, цаг: ${input.examTime}, хугацаа: ${input.durationMinutes} минут
- Нийт асуултын тоо: ${input.totalQuestionCount} (заавал энэ тоо)
- Хүндлэлийн тоо: хялбар=${easy}, дунд=${medium}, хэцүү=${hard} (нийлбэр нь заавал ${input.totalQuestionCount} байна)
${pointsText}
${formatText}

${formatRules}

JSON элемент бүрт талбарууд:
- text: асуултын текст
- format: ${fd ? "дээрх формат-тооны шаардлагыг баримтал" : `дээрх хүндлэлийн дагуу яг тэр формат (EASY→${df.easy}, MEDIUM→${df.medium}, HARD→${df.hard})`}
- difficulty: EASY | MEDIUM | HARD
- options:
  - format нь SINGLE_CHOICE эсвэл MULTIPLE_CHOICE бол заавал массив байна, дор хаяж 4 сонголттой байна
  - бусад формат (MATCHING/FILL_IN/WRITTEN) бол null эсвэл [] байна
- correctAnswer:
  - SINGLE_CHOICE/MULTIPLE_CHOICE бол зөв хариултын текст (сонголтуудын нэгтэй таарах)
  - бусад үед богино зөв хариу (эсвэл шаардлагагүй бол null)
- explanation: товч тайлбар

Гаралтын яг формат (зөвхөн энэ JSON массив; өөр wrapper object бүү ашигла):
[
  {
    "text": "string",
    "format": "${df.medium}",
    "difficulty": "MEDIUM",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "B",
    "explanation": "string эсвэл null"
  }
]

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
    const info = classifyGeminiError(e);
    // Debug: Cloudflare/Workers log дээр Gemini-ийн үндсэн шалтгааныг харах (API key value хэвлэхгүй)
    console.error(
      "[generateExamQuestions] Gemini error:",
      info.kind,
      info.rawMessage,
    );
    // 429/Quota үед серверээс өгсөн retryDelay байвал 1 удаа retry.
    if (
      (info.kind === "quota" || info.kind === "rate_limited") &&
      info.retryAfterSeconds &&
      info.retryAfterSeconds > 0 &&
      info.retryAfterSeconds <= 120
    ) {
      try {
        await sleep(info.retryAfterSeconds * 1000);
        const retryResult = await model.generateContent(prompt);
        text = retryResult.response.text();
      } catch (e2) {
        const info2 = classifyGeminiError(e2);
        console.error(
          "[generateExamQuestions] Gemini error (retry):",
          info2.kind,
          info2.rawMessage,
        );
        throw new GraphQLError(`AI алдаа: ${info2.userMessage}`);
      }
    } else {
      throw new GraphQLError(`AI алдаа: ${info.userMessage}`);
    }
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
    const difficulty =
      typeof r.difficulty === "string" ? r.difficulty : "MEDIUM";
    let options: string[] | null = null;
    if (Array.isArray(r.options)) {
      options = r.options.filter((x): x is string => typeof x === "string");
    }
    const correctAnswer =
      r.correctAnswer == null ? null : String(r.correctAnswer);
    const explanation = r.explanation == null ? null : String(r.explanation);
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

  const allowedFormats = new Set([
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "MATCHING",
    "FILL_IN",
    "WRITTEN",
  ]);

  const fd = input.formatDistribution ?? null;
  if (fd) {
    const sumFormats =
      fd.singleChoice + fd.multipleChoice + fd.matching + fd.fillIn + fd.written;
    if (sumFormats !== input.totalQuestionCount) {
      throw new GraphQLError(
        `Асуултын хэлбэрийн нийлбэр (${sumFormats}) нийт асуултын тоо (${input.totalQuestionCount})-тай тэнцүү байх ёстой`,
      );
    }
    const counts = {
      SINGLE_CHOICE: 0,
      MULTIPLE_CHOICE: 0,
      MATCHING: 0,
      FILL_IN: 0,
      WRITTEN: 0,
    } as Record<string, number>;
    for (const q of validated) {
      if (!allowedFormats.has(q.format)) {
        throw new GraphQLError(`AI format буруу байна: ${q.format}`);
      }
      counts[q.format] = (counts[q.format] ?? 0) + 1;
    }
    if (
      counts.SINGLE_CHOICE !== fd.singleChoice ||
      counts.MULTIPLE_CHOICE !== fd.multipleChoice ||
      counts.MATCHING !== fd.matching ||
      counts.FILL_IN !== fd.fillIn ||
      counts.WRITTEN !== fd.written
    ) {
      throw new GraphQLError(
        `Асуултын хэлбэрийн тоо таарахгүй байна: AI (SINGLE_CHOICE ${counts.SINGLE_CHOICE}, MULTIPLE_CHOICE ${counts.MULTIPLE_CHOICE}, MATCHING ${counts.MATCHING}, FILL_IN ${counts.FILL_IN}, WRITTEN ${counts.WRITTEN}), хүсэлт (SINGLE_CHOICE ${fd.singleChoice}, MULTIPLE_CHOICE ${fd.multipleChoice}, MATCHING ${fd.matching}, FILL_IN ${fd.fillIn}, WRITTEN ${fd.written})`,
      );
    }

    return validated.map((q) => ({
      id: randomUUID(),
      text: q.text,
      format: q.format,
      difficulty: q.difficulty,
      options: q.options ?? null,
      correctAnswer: q.correctAnswer ?? null,
      explanation: q.explanation ?? null,
    }));
  }

  const df = input.difficultyFormats;
  const formatFor = (d: string): string => {
    if (d === "EASY") return df.easy;
    if (d === "MEDIUM") return df.medium;
    if (d === "HARD") return df.hard;
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
