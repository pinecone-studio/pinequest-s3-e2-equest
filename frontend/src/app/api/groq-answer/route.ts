import { NextResponse } from "next/server";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };
    const trimmedPrompt = String(prompt ?? "").trim();

    if (!trimmedPrompt) {
      return NextResponse.json(
        { error: "Prompt хоосон байна." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY тохируулаагүй байна." },
        { status: 500 },
      );
    }

    const model = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
    const messages: GroqMessage[] = [
      {
        role: "system",
        content:
          "Та зөвхөн JSON хэлбэрээр хариул. Англи үг бүү ашигла. Формат: {\"options\":[\"...\"],\"correctAnswer\":\"...\"}",
      },
      { role: "user", content: trimmedPrompt },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || "Groq хүсэлт амжилтгүй боллоо." },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as GroqChatResponse;
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      options?: string[];
      correctAnswer?: string;
    };

    return NextResponse.json({
      options: parsed.options ?? [],
      correctAnswer: parsed.correctAnswer ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Groq хүсэлт боловсруулахад алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
