import { GoogleGenerativeAI } from "@google/generative-ai";

import { classifyGeminiError } from "./ai";

const DEFAULT_MODEL_CANDIDATES = [
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
] as const;

type GenerateQuestionAnswerInput = {
  prompt: string;
  points?: number | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  format?:
    | "SINGLE_CHOICE"
    | "MULTIPLE_CHOICE"
    | "MATCHING"
    | "FILL_IN"
    | "WRITTEN"
    | null;
  previousOptions?: string[] | null;
  previousCorrectAnswer?: string | null;
  previousExplanation?: string | null;
  mode?: "generate" | "regenerate";
};

const SYSTEM_INSTRUCTION = `
Чи бол Монголын сургуулийн шалгалтын асуултын хариулт боловсруулагч AI.
ЗӨВХӨН нэг JSON object буцаа. Markdown, code fence, нэмэлт тайлбар бүү бич.
JSON object-оос өөр ямар ч текст БҮҮ нэм.

JSON талбарууд:
- questionText: хэрэглэгчийн өгсөн асуултыг цэвэрлэж буцаана
- format: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "MATCHING" | "FILL_IN" | "WRITTEN"
- difficulty: "EASY" | "MEDIUM" | "HARD"
- points: эерэг бүхэл тоо
- options: сонголттой асуулт бол боломжит хариултуудын массив, үгүй бол []
- correctAnswer: зөв хариулт
- explanation: зөв хариу болон бодолтын тайлбар

Дүрэм:
- SINGLE_CHOICE бол яг 4 өөр сонголт өг.
- 4 сонголт хоорондоо давхцахгүй, утгын хувьд ч хэт ойролцоо байж болохгүй.
- Сонголт бүр богино, цэвэр байна. "A.", "B.", "Сонголт 1:", "Зөв хариулт:" гэх мэт шошго бүү нэм.
- correctAnswer нь options доторх яг НЭГ утгатай үг үсэг, зай, тэмдэгтийн хувьд таарч байх ёстой.
- questionText талбарт зөвхөн хэрэглэгчийн асуултыг цэвэрлэж буцаа. Хэрэггүй тайлбар, "доорхоос сонго", "зөв хариулт нь" зэрэг нэмэлт өгүүлбэр бүү нэм.
- explanation талбарт options-ийг дахин жагсааж бүү хуул. Зөвхөн богино бодолт, тайлбар өг.
- WRITTEN бол options-ийг хоосон массив [] болго.
- WRITTEN бол correctAnswer талбарт зөвхөн эцсийн хариуг богино бич.
- WRITTEN бол explanation талбарт зөвхөн гол бодолтын 3-5 алхмыг товч бич.
- WRITTEN explanation нь урт эсээ, илүүдэл өгүүлбэр, давтсан тайлбар, нэг санааг олон янзаар хэлсэн текст байж болохгүй.
- WRITTEN explanation-д "өгөгдсөн", "тиймээс", "иймд" гэх зэрэг холбоосыг хэт олноор давтаж сунжруулахгүй.
- WRITTEN explanation нь шалгалтын материалд шууд харагдахаар богино, цэвэр, багшид хурдан уншигдахуйц байна.
- Хэрэв хэрэглэгч points, difficulty, format өгсөн бол яг баримтал.
- Хэрэв өгөөгүй бол асуултын агуулгад тулгуурлан өөрөө хамгийн тохирох points, difficulty, format-ийг шийд.
- explanation нь монголоор, ойлгомжтой, алхамтай байна.
- Math/LaTeX тэмдэгт байвал JSON string дотор backslash-ийг заавал escape хий. Жишээ: \sqrt{x} гэж бичих бол JSON дээр "\\sqrt{x}" гэж буцаа.
- Дотор нь newline хэрэгтэй бол JSON string дээр \n escape ашигла. Бодит line break-ийг string дотор шууд бүү оруул.
- Хэрэв format нь SINGLE_CHOICE бол options ба correctAnswer заавал хоосон биш байна.
- Хэрэв асуулт дан бодлогын өгүүлбэр байвал questionText-д түүнийг өөрчилж тайлбарлахгүй, утгыг нь л цэвэрлэж буцаа.

Жишээ бүтэц:
{"questionText":"x^2+5x+6 олон гишүүнтийг үржигдэхүүн болгон задал.","format":"SINGLE_CHOICE","difficulty":"EASY","points":1,"options":["(x+5)(x+1)","(x+4)(x+2)","(x+2)(x+3)","(x+2)(x+6)"],"correctAnswer":"(x+2)(x+3)","explanation":"x^2+5x+6=(x+2)(x+3). Учир нь 2 ба 3-ын нийлбэр 5, үржвэр 6 байна."}
`.trim();

function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parseGeminiJson(raw: string): Record<string, unknown> {
  const extracted = extractJsonText(raw)
    .replace(/^\uFEFF/, "")
    .trim();

  try {
    return JSON.parse(extracted) as Record<string, unknown>;
  } catch {
    const normalized = extracted
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");

    return JSON.parse(normalized) as Record<string, unknown>;
  }
}

export async function generateQuestionAnswerWithGemini(
  apiKey: string,
  input: GenerateQuestionAnswerInput,
  opts?: { model?: string },
): Promise<Record<string, unknown>> {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error("GOOGLE_AI_API_KEY эсвэл GEMINI_API_KEY тохируулаагүй байна.");
  }

  const preferred =
    (opts?.model && opts.model.trim()) ||
    (typeof process !== "undefined" && process.env?.GEMINI_ANALYZE_MODEL?.trim()) ||
    "";

  const candidates = Array.from(
    new Set(
      [...(preferred ? [preferred] : []), ...DEFAULT_MODEL_CANDIDATES].filter(Boolean),
    ),
  );

  const genAI = new GoogleGenerativeAI(key);
  const constraints = [
    input.format ? `- format: ${input.format}` : "- format: өөрөө тохируулж сонго",
    input.difficulty
      ? `- difficulty: ${input.difficulty}`
      : "- difficulty: өөрөө тохируулж сонго",
    typeof input.points === "number" && Number.isFinite(input.points)
      ? `- points: ${input.points}`
      : "- points: өөрөө тохируулж сонго",
  ].join("\n");

  const regenerateContext =
    input.mode === "regenerate"
      ? `

Өмнөх AI хувилбар:
- options: ${
          input.previousOptions?.filter(Boolean).join(" | ") || "байхгүй"
        }
- correctAnswer: ${input.previousCorrectAnswer?.trim() || "байхгүй"}
- explanation: ${input.previousExplanation?.trim() || "байхгүй"}

Нэмэлт дүрэм:
- Өмнөх хувилбарыг шууд давтаж болохгүй.
- Боломжтой бол сонголтуудын найруулга, зөв хариу, тайлбарын хэлбэрийг шинэчил.
- Асуултын гол утгыг алдагдуулахгүйгээр шинэ AI хувилбар гарга.
`.trim()
      : "";

  const userContent = `Асуулт: ${input.prompt.trim()}

Шаардлага:
${constraints}

${regenerateContext}

Энэ асуултад тохирох зөв хариу, сонголтууд (шаардлагатай бол), бодолтын тайлбарыг JSON object хэлбэрээр буцаа.
Сонголтуудыг шалгалтын материалд шууд тавихаар цэвэр, давхардалгүй, товч бич.
JSON-оос гадуур ямар ч тайлбар, markdown, code fence бүү нэм.
Хэрэв math тэмдэгт, LaTeX ашиглавал JSON escape-ийг зөв хий.
correctAnswer нь options доторх НЭГ элементийн яг ижил string байх ёстой.
Хэрэв format нь WRITTEN бол explanation-ийг гол санаа, гол хувиргалт, эцсийн дүгнэлтэд төвлөрүүлж, илүү нуршуу тайлбар бүү өг.`;

  let lastErr: unknown = null;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      const result = await model.generateContent(userContent);
      const text = result.response.text()?.trim();
      if (!text) {
        throw new Error("Gemini хариу хоосон байна.");
      }
      return parseGeminiJson(text);
    } catch (e) {
      lastErr = e;
      if (e instanceof SyntaxError) {
        continue;
      }
      const info = classifyGeminiError(e);
      if (info.kind === "model") {
        continue;
      }
      throw new Error(info.userMessage);
    }
  }

  const info = classifyGeminiError(lastErr);
  throw new Error(info.userMessage);
}
