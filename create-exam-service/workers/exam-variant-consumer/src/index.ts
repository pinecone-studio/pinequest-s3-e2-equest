import { GoogleGenerativeAI } from "@google/generative-ai";
import { asc, eq } from "drizzle-orm";

import { getDb } from "../../../src/db";
import {
  examVariantJobs,
  examVariantQuestions,
  examVariants,
  newExamQuestions,
  newExams,
} from "../../../src/db/schema";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  GEMINI_MODEL: string;
}

type ExamVariantMessageBody = {
  jobId: string;
  examId?: string | null;
  variantCount: number;
  requestedBy?: string;
};

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
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(extracted) as Record<string, unknown>;
}

function uuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeVariantQuestion(
  sourceQuestion: {
    order: number;
    prompt: string;
    type: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    explanation?: string | null;
  },
  generatedQuestion: Record<string, unknown>,
) {
  const sourceOptions = Array.isArray(sourceQuestion.options)
    ? sourceQuestion.options.map((option) => String(option))
    : [];
  const expectedOptionCount =
    sourceQuestion.type === "single-choice" ? sourceOptions.length : 0;

  const rawOptions = Array.isArray(generatedQuestion.options)
    ? generatedQuestion.options.map((option) => String(option).trim())
    : [];
  const rawCorrectOptionIndex =
    typeof generatedQuestion.correctOptionIndex === "number" &&
    Number.isFinite(generatedQuestion.correctOptionIndex)
      ? Math.floor(generatedQuestion.correctOptionIndex)
      : null;

  const uniqueOptions: string[] = [];
  for (const option of rawOptions) {
    if (!option) continue;
    if (!uniqueOptions.includes(option)) {
      uniqueOptions.push(option);
    }
  }

  let normalizedOptions =
    sourceQuestion.type === "single-choice"
      ? uniqueOptions.slice(0, expectedOptionCount)
      : [];

  if (
    sourceQuestion.type === "single-choice" &&
    normalizedOptions.length < expectedOptionCount
  ) {
    for (const fallbackOption of sourceOptions) {
      const trimmedFallback = fallbackOption.trim();
      if (!trimmedFallback) continue;
      if (!normalizedOptions.includes(trimmedFallback)) {
        normalizedOptions.push(trimmedFallback);
      }
      if (normalizedOptions.length === expectedOptionCount) {
        break;
      }
    }
  }

  let normalizedCorrectAnswer =
    String(generatedQuestion.correctAnswer ?? "").trim() || null;

  if (sourceQuestion.type === "single-choice") {
    if (
      rawCorrectOptionIndex !== null &&
      rawCorrectOptionIndex >= 0 &&
      rawCorrectOptionIndex < normalizedOptions.length
    ) {
      normalizedCorrectAnswer = normalizedOptions[rawCorrectOptionIndex] ?? null;
    }

    if (
      !normalizedCorrectAnswer ||
      !normalizedOptions.some((option) => option === normalizedCorrectAnswer)
    ) {
      normalizedCorrectAnswer =
        normalizedOptions[0] ??
        sourceQuestion.correctAnswer?.trim() ??
        sourceOptions[0]?.trim() ??
        null;
    }
  } else {
    normalizedCorrectAnswer =
      normalizedCorrectAnswer || sourceQuestion.correctAnswer?.trim() || null;
  }

  return {
    order:
      typeof generatedQuestion.order === "number"
        ? Math.floor(generatedQuestion.order)
        : sourceQuestion.order,
    prompt: String(generatedQuestion.prompt ?? "").trim() || sourceQuestion.prompt,
    type: sourceQuestion.type,
    options: normalizedOptions,
    correctAnswer: normalizedCorrectAnswer,
    explanation: String(generatedQuestion.explanation ?? "").trim() || null,
  };
}

function buildVariantPrompt(args: {
  examTitle: string;
  variantCount: number;
  questions: Array<{
    order: number;
    prompt: string;
    type: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    explanation?: string | null;
  }>;
}) {
  return `
Чи Монгол хэл дээр шалгалтын ижил бүтэцтэй шинэ хувилбар үүсгэдэг AI.
ЗӨВХӨН нэг JSON object буцаа. Markdown, code fence, нэмэлт тайлбар бүү бич.

Даалгавар:
- Өгөгдсөн асуултуудын бүтцийг хадгал.
- Асуултын дараалал, төрөл, ерөнхий загвар, хүндрэлийн түвшинг хадгал.
- Томьёоны бүтэц, хувьсагчийн логик, бодлогын хэлбэрийг өөрчлөхгүй.
- Зөвхөн доторх тоонууд, тогтмолууд, шаардлагатай бол сонголтын утгуудыг өөрчил.
- Нэг variant дотор асуултын order, type-ийг яг хэвээр хадгал.
- Хариуг монголоор өг.
- Асуулт бүрийн options-ийн тоог ЭХ АСУУЛТТАЙ ЯГ ИЖИЛ хадгал. Илүү/дутуу option огт бүү гарга.

 SINGLE_CHOICE дүрэм:
- options-ийн тоо эх асуулттай ижил байна.
- options-ийг шинэ тоонд тааруулж шинэчил.
- duplicate option бүү гарга.
- яг нэг зөв хариулттай байна.
- correctAnswer нь options доторх нэг string-тэй яг ижил таарч байна.
- correctOptionIndex талбарыг заавал буцаа. Энэ нь 0-ээс эхэлсэн индекс байна.
- correctAnswer болон correctOptionIndex хоёр хоорондоо таарч байх ёстой.
- Жишээ: эх асуулт 4 option-той бол шинэ хувилбар МӨН 4 option-той байна. 5 эсвэл 3 болгож болохгүй.

 WRITTEN дүрэм:
- options хоосон массив [] байна.
- correctAnswer-ийг шинээр бодож ол.
- explanation нь богино боловч шалгах боломжтой байна.

 Ерөнхий дүрэм:
- Хэрэв эх асуултын prompt-д LaTeX/томьёо байвал түүнийг хадгал.
- Боломжгүй, буруу, шийдгүй утга бүү сонго.
- JSON-оос гадуур юу ч бүү нэм.

JSON бүтэц:
{
  "variants": [
    {
      "variantNumber": 1,
      "title": "Хувилбар 1",
      "questions": [
        {
          "order": 1,
          "prompt": "...",
          "type": "single-choice" | "written",
          "options": ["...", "..."],
          "correctOptionIndex": 0,
          "correctAnswer": "...",
          "explanation": "..."
        }
      ]
    }
  ]
}

Шалгалтын нэр: ${args.examTitle}
Үүсгэх хувилбарын тоо: ${args.variantCount}

Анхаар:
- Хэрэв нэг асуулт байсан ч variants массивд ${args.variantCount} ширхэг бүрэн variant буцаа.
- Асуулт бүр дээр шинэ тоон утга сонгосны дараа зөв хариуг дахин бод.
- Хэрэв type нь "written" бол options=[] буцаа.
- SINGLE_CHOICE асуулт бүр дээр options.length нь эх асуултын options.length-тэй тэнцүү байх ёстой.
- SINGLE_CHOICE асуулт бүр дээр correctOptionIndex-г заавал бөглө.

Эх асуултууд:
${JSON.stringify(args.questions, null, 2)}
`.trim();
}

async function runVariantGeneration(
  env: Env,
  body: ExamVariantMessageBody,
): Promise<void> {
  const db = getDb(env.DB);
  const jobId = String(body.jobId ?? "").trim();
  const variantCount = Number(body.variantCount ?? 0);

  if (!jobId) {
    throw new Error("jobId хоосон байна.");
  }

  if (!Number.isFinite(variantCount) || variantCount < 1) {
    throw new Error("variantCount 1-ээс их байх ёстой.");
  }

  const [job] = await db
    .select()
    .from(examVariantJobs)
    .where(eq(examVariantJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`exam_variant_jobs дээр job олдсонгүй: ${jobId}`);
  }

  const examId = String(job.examId ?? body.examId ?? "").trim() || null;
  const now = new Date().toISOString();

  await db
    .update(examVariantJobs)
    .set({
      status: "processing",
      startedAt: job.startedAt ?? now,
      updatedAt: now,
      errorMessage: null,
    })
    .where(eq(examVariantJobs.id, jobId));

  const [exam] = examId
    ? await db
        .select({
          id: newExams.id,
          title: newExams.title,
          payloadJson: newExams.payloadJson,
          withVariants: newExams.withVariants,
          variantCount: newExams.variantCount,
        })
        .from(newExams)
        .where(eq(newExams.id, examId))
        .limit(1)
    : [];

  const questions = await db
    .select({
      id: newExamQuestions.id,
      position: newExamQuestions.position,
      type: newExamQuestions.type,
      prompt: newExamQuestions.prompt,
      points: newExamQuestions.points,
      optionsJson: newExamQuestions.optionsJson,
      correctOption: newExamQuestions.correctOption,
      correctAnswer: newExamQuestions.correctAnswer,
      responseGuide: newExamQuestions.responseGuide,
      answerLatex: newExamQuestions.answerLatex,
    })
    .from(newExamQuestions)
    .where(eq(newExamQuestions.examId, examId ?? ""))
    .orderBy(asc(newExamQuestions.position));

  const apiKey = env.GOOGLE_AI_API_KEY?.trim() || env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY эсвэл GEMINI_API_KEY тохируулаагүй.");
  }

  const modelName = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  const sourceQuestions =
    questions.length > 0
      ? questions.map((question) => ({
          order: question.position,
          prompt: question.prompt,
          type: question.type === "math" ? "written" : "single-choice",
          options: question.optionsJson
            ? (JSON.parse(question.optionsJson) as string[])
            : null,
          correctOptionIndex:
            typeof question.correctOption === "number" ? question.correctOption : null,
          correctAnswer:
            question.correctAnswer ??
            (typeof question.answerLatex === "string" && question.answerLatex.trim()
              ? question.answerLatex
              : null),
          explanation: question.responseGuide ?? null,
        }))
      : (() => {
          try {
            const parsed = JSON.parse(job.sourceQuestionsJson) as {
              order: number;
              prompt: string;
              type: string;
              options?: string[] | null;
              correctOptionIndex?: number | null;
              correctAnswer?: string | null;
              explanation?: string | null;
            }[];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();

  if (!sourceQuestions.length) {
    throw new Error("Variant үүсгэх эх асуулт олдсонгүй.");
  }

  console.log(
    JSON.stringify({
      worker: "exam-variant-consumer",
      stage: "processing",
      jobId,
      examId,
      examTitle: exam?.title ?? "Шалгалтын AI хувилбар",
      questionCount: sourceQuestions.length,
      variantCount,
      requestedBy: body.requestedBy ?? job.requestedBy ?? null,
      modelName,
    }),
  );

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = buildVariantPrompt({
    examTitle: exam?.title ?? "Шалгалтын AI хувилбар",
    variantCount,
    questions: sourceQuestions,
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();
  if (!text) {
    throw new Error("Gemini хариу хоосон байна.");
  }

  const parsed = parseGeminiJson(text);
  const completedAt = new Date().toISOString();

  const variants = Array.isArray(parsed.variants) ? parsed.variants : [];

  await db.delete(examVariants).where(eq(examVariants.jobId, jobId));

  for (const [variantIndex, variant] of variants.entries()) {
    const variantId = uuid();
    const rawQuestions =
      variant && typeof variant === "object" && Array.isArray((variant as { questions?: unknown[] }).questions)
        ? ((variant as { questions: unknown[] }).questions ?? [])
        : [];

    await db.insert(examVariants).values({
      id: variantId,
      jobId,
      examId: exam?.id?.trim() || null,
      variantNumber:
        typeof (variant as { variantNumber?: unknown })?.variantNumber === "number"
          ? Math.floor((variant as { variantNumber: number }).variantNumber)
          : variantIndex + 1,
      title:
        String((variant as { title?: unknown })?.title ?? "").trim() ||
        `Хувилбар ${variantIndex + 1}`,
      createdAt: completedAt,
      updatedAt: completedAt,
    });

    if (rawQuestions.length > 0) {
      const normalizedQuestions = rawQuestions.map((question, questionIndex) =>
        normalizeVariantQuestion(
          sourceQuestions[questionIndex] ?? {
            order: questionIndex + 1,
            prompt: "",
            type: "single-choice",
            options: [],
            correctAnswer: null,
            explanation: null,
          },
          (question as Record<string, unknown>) ?? {},
        ),
      );

      await db.insert(examVariantQuestions).values(
        normalizedQuestions.map((question, questionIndex) => ({
          id: uuid(),
          variantId,
          position: question.order || questionIndex + 1,
          type: question.type,
          prompt: question.prompt,
          optionsJson: JSON.stringify(question.options),
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          createdAt: completedAt,
          updatedAt: completedAt,
        })),
      );
    }
  }

  await db
    .update(examVariantJobs)
    .set({
      status: "completed",
      resultJson: JSON.stringify(parsed),
      completedAt,
      updatedAt: completedAt,
      errorMessage: null,
    })
    .where(eq(examVariantJobs.id, jobId));

  if (exam?.id) {
    await db
      .update(newExams)
      .set({
        withVariants: 1,
        variantCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(newExams.id, exam.id));
  }
}

export default {
  async queue(batch: MessageBatch<ExamVariantMessageBody>, env: Env) {
    for (const message of batch.messages) {
      try {
        await runVariantGeneration(env, message.body);
        message.ack();
      } catch (error) {
        console.error("exam-variant-consumer error", error);
        const db = getDb(env.DB);
        const jobId = String(message.body.jobId ?? "").trim();
        if (jobId) {
          await db
            .update(examVariantJobs)
            .set({
              status: "failed",
              errorMessage: error instanceof Error ? error.message : String(error),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(examVariantJobs.id, jobId));
        }
        message.ack();
      }
    }
  },
};
