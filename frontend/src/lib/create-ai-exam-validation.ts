import * as Yup from "yup";

import { Difficulty } from "@/gql/graphql";

const DIFFICULTY_VALUES = Object.values(Difficulty) as Difficulty[];

/** Асуулт бүрийн баталгаажуулалт (GraphQL `AiQuestionTemplateInput`-тай тааруулсан). */
export const questionSchema = Yup.object().shape({
  /** React key — GraphQL руу илгээхгүй */
  id: Yup.string().optional(),
  type: Yup.string().required("Төрөл шаардлагатай"),
  aiSuggestedType: Yup.string().nullable(),
  prompt: Yup.string().required("Асуултын текст шаардлагатай"),
  points: Yup.number()
    .integer("Бүхэл тоо байх ёстой")
    .min(1, "Минимум 1 оноо")
    .required("Оноо шаардлагатай"),
  difficulty: Yup.mixed<Difficulty>()
    .oneOf(DIFFICULTY_VALUES, "Хүндрэлийг сонгоно уу")
    .required("Түвшин шаардлагатай"),
  optionsJson: Yup.string()
    .nullable()
    .test(
      "options-json",
      "Сонголтууд нь хоосон биш бол зөв JSON массив байх ёстой",
      (value) => {
        if (value == null || value.trim() === "") return true;
        try {
          const parsed = JSON.parse(value) as unknown;
          return Array.isArray(parsed);
        } catch {
          return false;
        }
      },
    ),
  correctAnswer: Yup.string()
    .nullable()
    .test(
      "mcq-correct-in-options",
      "MCQ-д зөв хариулт нь дээрх сонголтуудын нэгтэй яг таарах ёстой",
      function (value) {
        const parent = this.parent as {
          type?: string;
          optionsJson?: string | null;
        };
        if (parent.type !== "MCQ") return true;
        const answer = (value ?? "").trim();
        if (!answer) return true;
        const raw = parent.optionsJson?.trim();
        if (!raw) return true;
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return true;
          const opts = parsed.map((x) => String(x).trim());
          if (opts.every((o) => o === "")) return true;
          return opts.includes(answer);
        } catch {
          return true;
        }
      },
    ),
  explanation: Yup.string().nullable(),
  tags: Yup.string().nullable(),
  source: Yup.string().ensure().default(""),
  skillLevel: Yup.string().ensure().default("Мэдлэг"),
});

/** Шалгалтын ерөнхий мэдээлэл + асуултууд (`createAiExamTemplate` input). */
export const createAiExamSchema = Yup.object().shape({
  title: Yup.string().required("Шалгалтын нэр шаардлагатай"),
  subject: Yup.string().required("Хичээл шаардлагатай"),
  grade: Yup.number().integer().min(1).max(12).required("Анги шаардлагатай"),
  teacherId: Yup.string().required("Багшийн ID шаардлагатай"),
  durationMinutes: Yup.number()
    .integer()
    .min(1, "Минимум 1 минут")
    .required("Хугацаа шаардлагатай"),
  questions: Yup.array()
    .of(questionSchema)
    .min(1, "Асуултгүй шалгалт байж болохгүй")
    .required(),
});

export type CreateAiExamFormValues = Yup.InferType<typeof createAiExamSchema>;
