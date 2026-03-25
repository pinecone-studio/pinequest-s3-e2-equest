type DifficultyLevel = "easy" | "medium" | "advanced";

type GenerateExamRequest = {
  difficulty?: DifficultyLevel;
  mathCount?: number;
  mcqCount?: number;
  topics?: string;
  totalPoints?: number;
};

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateExamRequest;
    const mcqCount = Math.max(0, Number(body.mcqCount ?? 0));
    const mathCount = Math.max(0, Number(body.mathCount ?? 0));
    const totalPoints = Math.max(1, Number(body.totalPoints ?? 1));
    const difficulty = body.difficulty ?? "medium";
    const topics = body.topics?.trim() ?? "";

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
    const prompt = `
Чи Монгол хэл дээр жишиг математикийн шалгалт үүсгэдэг туслах.

Дараах шаардлагыг яг баримтал:
- Тестийн тоо: ${mcqCount}
- Задгай даалгаврын тоо: ${mathCount}
- Нийт оноо: ${totalPoints}
- Түвшин: ${difficultyLabel(difficulty)}
- Заасан дэд сэдвүүд: ${topics}

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
              parts: [{ text: prompt }],
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
      return Response.json(
        {
          error:
            geminiPayload.error?.message ??
            "Gemini-с хариу авах үед алдаа гарлаа.",
        },
        { status: geminiResponse.status },
      );
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

    const exam = JSON.parse(cleanJsonBlock(text));

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
