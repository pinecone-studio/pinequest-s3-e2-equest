import type {
  DifficultyLevel,
  GenerateExamRequest,
  GeneratedExamPayload,
} from "@/lib/math-exam-contract";
import { buildGeminiErrorResponse } from "@/lib/gemini-error";

function cleanJsonBlock(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return trimmed;
}

function difficultyLabel(level: DifficultyLevel) {
  if (level === "easy") {
    return "Амархан";
  }

  if (level === "advanced") {
    return "Ахисан";
  }

  return "Дунд";
}

async function uploadGeminiFile({
  apiKey,
  data,
  mimeType,
  name,
}: {
  apiKey: string;
  data: string;
  mimeType: string;
  name: string;
}) {
  const fileBytes = Buffer.from(data, "base64");
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      body: JSON.stringify({
        file: {
          display_name: name,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileBytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "X-Goog-Upload-Protocol": "resumable",
      },
      method: "POST",
    },
  );

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");

  if (!startResponse.ok || !uploadUrl) {
    throw new Error(`${name} файлыг Gemini рүү upload хийж чадсангүй.`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    body: fileBytes,
    headers: {
      "Content-Length": String(fileBytes.byteLength),
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    method: "POST",
  });

  const uploadPayload = (await uploadResponse.json()) as {
    file?: {
      mimeType?: string;
      uri?: string;
    };
  };

  if (!uploadResponse.ok || !uploadPayload.file?.uri) {
    throw new Error(`${name} файлыг finalize хийж чадсангүй.`);
  }

  return {
    mimeType: uploadPayload.file.mimeType ?? mimeType,
    uri: uploadPayload.file.uri,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateExamRequest;
    const mcqCount = Math.max(0, Number(body.mcqCount ?? 0));
    const mathCount = Math.max(0, Number(body.mathCount ?? 0));
    const totalPoints = Math.max(1, Number(body.totalPoints ?? 1));
    const difficulty = body.difficulty ?? "medium";
    const sourceContext = body.sourceContext?.trim() ?? "";
    const topics = body.topics?.trim() ?? "";
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (mcqCount + mathCount <= 0) {
      return Response.json(
        { error: "Дор хаяж нэг асуултын тоо оруулна уу." },
        { status: 400 },
      );
    }

    if (!topics) {
      return Response.json(
        { error: "Заасан дэд сэдвүүдийг оруулна уу." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY тохируулаагүй байна." },
        { status: 500 },
      );
    }

    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const textAttachments = attachments.filter((attachment) => attachment.text?.trim());
    const binaryAttachments = attachments.filter((attachment) => attachment.data?.trim());
    const uploadedFiles = await Promise.all(
      binaryAttachments.map((attachment) =>
        uploadGeminiFile({
          apiKey,
          data: attachment.data ?? "",
          mimeType: attachment.mimeType ?? "application/octet-stream",
          name: attachment.name ?? "attachment",
        }),
      ),
    );

    const prompt = `
Чи Монгол хэл дээр жишиг математикийн шалгалт үүсгэдэг туслах.

Дараах шаардлагыг яг баримтал:
- Тестийн тоо: ${mcqCount}
- Задгай даалгаврын тоо: ${mathCount}
- Нийт оноо: ${totalPoints}
- Түвшин: ${difficultyLabel(difficulty)}
- Заасан дэд сэдвүүд: ${topics}
${sourceContext ? `- Материалаас уншсан агуулга:\n${sourceContext}` : ""}

Дүрэм:
- Зөвхөн JSON буцаа. Тайлбар, markdown, code fence бүү нэм.
- title гэсэн талбарт шалгалтын нэр өг.
- questions нь массив байна.
- type нь зөвхөн "mcq" эсвэл "math".
- mcq асуулт бүр options массивтай, дор хаяж 4 сонголттой байна.
- mcq асуулт бүр correctOption талбарт 0-ээс эхэлсэн зөв индекс өг.
- math асуулт бүр answerLatex болон responseGuide талбартай байна.
- points нь бүх асуулт дээр эерэг бүхэл тоо байна.
- Асуултууд нь зөвхөн өгсөн дэд сэдвүүдийн хүрээнд байна.
- Хэрэв хавсаргасан зураг, pdf, document материал байвал түүний доторх агуулгыг уншаад асуулт үүсгэ.
- Агуулга нь сурагчдад ойлгомжтой, цэгцтэй Монгол хэл дээр байна.

JSON бүтэц:
{
  "title": "string",
  "questions": [
    {
      "type": "mcq",
      "prompt": "string",
      "points": 2,
      "options": ["string", "string", "string", "string"],
      "correctOption": 1
    },
    {
      "type": "math",
      "prompt": "string",
      "points": 4,
      "responseGuide": "string",
      "answerLatex": "string"
    }
  ]
}
`.trim();

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                ...textAttachments.map((attachment) => ({
                  text: `Хавсаргасан текст материал (${attachment.name ?? "text"}):\n${attachment.text}`,
                })),
                ...uploadedFiles.map((file) => ({
                  file_data: {
                    file_uri: file.uri,
                    mime_type: file.mimeType,
                  },
                })),
              ],
              role: "user",
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    const geminiPayload = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!geminiResponse.ok) {
      return buildGeminiErrorResponse({
        fallbackMessage: "Gemini-с хариу авах үед алдаа гарлаа.",
        providerMessage: geminiPayload.error?.message,
        status: geminiResponse.status,
      });
    }

    const text = geminiPayload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return Response.json(
        { error: "Gemini хоосон хариу буцаалаа." },
        { status: 502 },
      );
    }

    const exam = JSON.parse(cleanJsonBlock(text)) as GeneratedExamPayload;

    return Response.json({ exam });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI шалгалт үүсгэхэд алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
