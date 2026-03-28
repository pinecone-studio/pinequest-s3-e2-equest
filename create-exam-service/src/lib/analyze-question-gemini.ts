import type { Tool } from "@google/generative-ai";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { classifyGeminiError } from "./ai";

/**
 * Google Search / grounding **tool** ашиглах үед `responseMimeType: "application/json"`
 * нь API дээр дэмжигдэхгүй (400: "Tool use with a response mime type: application/json is unsupported").
 * Тиймээс JSON-ийг системийн заавраар шаардаж, хариуг текстээс `extractJsonText` + parse хийнэ.
 */

/**
 * Gemini 2.x grounding: REST дээр `google_search` — `@google/generative-ai` v0.24-ийн
 * `Tool` төрөлд ороогүй тул assertion. Хуучин 1.5.x дээр заримдаа `googleSearchRetrieval` хэрэгтэй.
 */
const TOOL_GOOGLE_SEARCH: Tool[] = [{ googleSearch: {} } as unknown as Tool];

const TOOL_SEARCH_RETRIEVAL: Tool[] = [{ googleSearchRetrieval: {} }];

const GROUNDING_TOOL_CHAINS: Tool[][] = [
  TOOL_GOOGLE_SEARCH,
  TOOL_SEARCH_RETRIEVAL,
];

const DEFAULT_ANALYZE_MODEL_CANDIDATES = [
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
] as const;

export const ANALYZE_QUESTION_SYSTEM_INSTRUCTION = `
Чи бол боловсролын мэргэжилтэн AI. Хэрэглэгчийн асуултыг ойлгоод, боломжтой бол Google Search grounding ашиглан вэбээс бодит эх сурвалж, зөв бодолт ол.
ЗӨВХӨН нэг JSON object буцаа — markdown, тайлбарын текст, code fence бүү хавтай.

JSON талбарууд:
- suggestedType: "MCQ" | "MATCHING" | "FILL_IN" | "MATH" | "FREE_TEXT"
- difficulty: "EASY" | "MEDIUM" | "HARD"
- points: эерэг бүхэл тоо
- correctAnswer: зөв хариулт (MCQ бол options-ийн нэг мөртэй яг ижил)
- options: MCQ бол яг 4 string; бусад төрөлд тохирох массив эсвэл []
- explanation: бодолтыг дэлгэрэнгүй; математик бол заавал зөв LaTeX ($...$ эсвэл $$...$$). Хэрэглэгч буруу хэлбэрээр буулгасан томьёог (жишээ нь "x2-5x+6=0") жинхэнэ LaTeX болгон засаж бич (жишээ нь $x^2-5x+6=0$).
- source: заавал бодит вэбсайтын бүрэн URL (https://...) эсвэл тодорхой материалын нэр; таамаглал бүү бич.
- skillLevel: Bloom — асуултын "IQ" / гүн ойлголтын шаардлагад нийцүүлэн нэгийг сонго: "Мэдлэг" | "Ойлгомж" | "Хэрэглээ" | "Шинжилгээ".
- tags: string массив

MCQ: дөрвөн сонголт өөр өөр, нэг нь зөв.
`.trim();

/** Хэрэглэгчийн prompt + интернэтээс хайх, source-д URL оруулах заавар. */
export function buildAnalyzeQuestionUserContent(userPrompt: string): string {
  const q = userPrompt.trim();
  return `Асуулт: ${q}

Интернэтээс энэ асуулттай холбоотой бодит эх сурвалж, зөв бодолт, хариултыг хайж олоод JSON-оор хариул.
Эх сурвалж (source) талбарт олдсон вэбсайтын линкийг заавал оруул.`;
}

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function shouldRetryOtherSearchTool(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    raw.includes("google_search_retrieval") &&
    raw.includes("google_search")
  ) {
    return true;
  }
  if (
    raw.includes("google_search") &&
    raw.includes("instead") &&
    raw.includes("retrieval")
  ) {
    return true;
  }
  if (raw.includes("unknown") && raw.includes("tool")) {
    return true;
  }
  if (raw.includes("invalid") && raw.includes("tool")) {
    return true;
  }
  return false;
}

const MAX_CLIENT_TECH_DETAIL = 480;

/** Лог / хариуанд түлхүүр, token шиг зүйлс орж ирэхээс сэргийлнэ. */
function redactSecrets(s: string): string {
  return s
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[API_KEY_REDACTED]")
    .replace(/cfut_[A-Za-z0-9_-]+/g, "[CF_TOKEN_REDACTED]");
}

function toolLabel(tools: Tool[]): string {
  const t = tools[0] as Record<string, unknown> | undefined;
  if (!t) return "none";
  if ("googleSearch" in t) return "googleSearch";
  if ("googleSearchRetrieval" in t) return "googleSearchRetrieval";
  return "other";
}

/** Cloudflare Workers Logs / wrangler tail дээр бодит шалтгааныг харахын тулд. */
function logGeminiAnalyzeFailure(
  err: unknown,
  ctx: { modelName: string; tool: string },
): void {
  const message = err instanceof Error ? err.message : String(err);
  let causeStr: string | undefined;
  if (err instanceof Error && err.cause != null) {
    causeStr =
      err.cause instanceof Error
        ? err.cause.message
        : String(err.cause);
  }
  const stack =
    err instanceof Error && typeof err.stack === "string"
      ? err.stack.split("\n").slice(0, 4).join("\n")
      : undefined;

  console.error("[analyzeQuestion] Gemini generateContent алдаа (дэлгэрэнгүй):", {
    ...ctx,
    message: redactSecrets(message),
    cause: causeStr ? redactSecrets(causeStr) : undefined,
    stackPreview: stack ? redactSecrets(stack) : undefined,
  });
}

/** Клиент руу богино техникийн нэмэлт (оношлоход). */
function withTechnicalHint(userMessage: string, rawMessage: string): string {
  const detail = redactSecrets(rawMessage).trim().slice(0, MAX_CLIENT_TECH_DETAIL);
  if (!detail) return userMessage;
  return `${userMessage} — Дэлгэрэнгүй: ${detail}`;
}

/**
 * `analyzeQuestion` GraphQL mutation — Gemini + Google Search grounding (JSON MIME-гүй — tool-той хамт API дэмждэггүй).
 */
export async function analyzeQuestionWithGemini(
  apiKey: string,
  userPrompt: string,
  opts?: { model?: string },
): Promise<Record<string, unknown>> {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error(
      "GOOGLE_AI_API_KEY эсвэл GEMINI_API_KEY тохируулаагүй байна (secret эсвэл .dev.vars).",
    );
  }

  const preferred =
    (opts?.model && opts.model.trim()) ||
    (typeof process !== "undefined" && process.env?.GEMINI_ANALYZE_MODEL?.trim()) ||
    "";

  const candidates = Array.from(
    new Set(
      [...(preferred ? [preferred] : []), ...DEFAULT_ANALYZE_MODEL_CANDIDATES].filter(
        Boolean,
      ),
    ),
  );

  const genAI = new GoogleGenerativeAI(key);
  const userContent = buildAnalyzeQuestionUserContent(userPrompt);
  let lastErr: unknown = null;

  for (const modelName of candidates) {
    for (const tools of GROUNDING_TOOL_CHAINS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: ANALYZE_QUESTION_SYSTEM_INSTRUCTION,
          tools,
        });

        const result = await model.generateContent(userContent);
        const text = result.response.text()?.trim();
        if (!text) {
          logGeminiAnalyzeFailure(
            new Error("response.text() хоосон"),
            { modelName, tool: toolLabel(tools) },
          );
          throw new Error("Gemini хариу хоосон байна.");
        }

        const jsonText = extractJsonText(text);
        return JSON.parse(jsonText) as Record<string, unknown>;
      } catch (e) {
        lastErr = e;
        const tool = toolLabel(tools);
        if (e instanceof SyntaxError) {
          logGeminiAnalyzeFailure(e, { modelName, tool });
          throw new Error(
            "Gemini-ийн хариу JSON болж задлахад алдаа гарлаа. Зөвхөн нэг JSON object буцаахыг системийн зааварт давтан шалгана уу.",
          );
        }
        const info = classifyGeminiError(e);
        if (info.kind === "model") {
          logGeminiAnalyzeFailure(e, { modelName, tool });
          console.error(
            "[analyzeQuestion] Model дэмжигдэхгүй, дараагийн model руу:",
            modelName,
            redactSecrets(info.rawMessage).slice(0, 300),
          );
          break;
        }
        if (shouldRetryOtherSearchTool(e)) {
          logGeminiAnalyzeFailure(e, { modelName, tool });
          console.warn(
            "[analyzeQuestion] Search tool солих:",
            redactSecrets(info.rawMessage).slice(0, 200),
          );
          continue;
        }
        logGeminiAnalyzeFailure(e, { modelName, tool });
        throw new Error(
          withTechnicalHint(info.userMessage, info.rawMessage),
        );
      }
    }
  }

  const info = classifyGeminiError(lastErr);
  logGeminiAnalyzeFailure(lastErr, {
    modelName: "(бүх model/tool туршсаны дараа)",
    tool: "—",
  });
  throw new Error(withTechnicalHint(info.userMessage, info.rawMessage));
}
