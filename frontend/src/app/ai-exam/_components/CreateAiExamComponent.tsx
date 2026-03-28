"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation } from "@apollo/client/react";
import {
  ErrorMessage,
  Field,
  FieldArray,
  Form,
  Formik,
  type FormikHelpers,
} from "formik";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MathPreviewText from "@/components/math-preview-text";
import {
  ANALYZE_QUESTION,
  CREATE_AI_EXAM_TEMPLATE,
} from "@/gql/create-exam-documents";
import {
  Difficulty,
  QuestionAnalysisSuggestedType,
  type CreateAiExamTemplateInput,
  type QuestionAnalysisResult,
} from "@/gql/graphql";

import {
  createAiExamSchema,
  type CreateAiExamFormValues,
} from "@/lib/ai-exam-form-validation";

import { AiExamAnalyzePromptField } from "./AiExamAnalyzePromptField";

const BLOOM_SKILL_LEVELS = [
  "Мэдлэг",
  "Ойлгомж",
  "Хэрэглээ",
  "Шинжилгээ",
] as const;

function suggestedTypeToString(t: QuestionAnalysisSuggestedType): string {
  switch (t) {
    case QuestionAnalysisSuggestedType.Mcq:
      return "MCQ";
    case QuestionAnalysisSuggestedType.Matching:
      return "MATCHING";
    case QuestionAnalysisSuggestedType.FillIn:
      return "FILL_IN";
    case QuestionAnalysisSuggestedType.Math:
      return "MATH";
    case QuestionAnalysisSuggestedType.FreeText:
      return "FREE_TEXT";
    default:
      return "FREE_TEXT";
  }
}

const initialValues: CreateAiExamFormValues = {
  title: "Шинэ AI Сорил",
  subject: "Математик",
  grade: 10,
  teacherId: "teacher-123",
  durationMinutes: 60,
  questions: [],
};

type QuestionRow = CreateAiExamFormValues["questions"][number];

function createEmptyQuestionRow(): QuestionRow {
  return {
    id: uuidv4(),
    type: "MCQ",
    aiSuggestedType: null,
    prompt: "",
    points: 1,
    difficulty: Difficulty.Medium,
    correctAnswer: "",
    explanation: "",
    tags: "",
    source: "",
    skillLevel: "Мэдлэг",
    optionsJson: null,
  };
}

function parseMcqFourSlots(
  optionsJson: string | null | undefined,
): [string, string, string, string] {
  const empty: [string, string, string, string] = ["", "", "", ""];
  const raw = optionsJson?.trim();
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return empty;
    return [
      String(p[0] ?? ""),
      String(p[1] ?? ""),
      String(p[2] ?? ""),
      String(p[3] ?? ""),
    ];
  } catch {
    return empty;
  }
}

function McqOptionsFourFields({
  index,
  optionsJson,
  setFieldValue,
}: {
  index: number;
  optionsJson: string | null | undefined;
  setFieldValue: FormikHelpers<CreateAiExamFormValues>["setFieldValue"];
}) {
  const slots = parseMcqFourSlots(optionsJson);
  const labels = ["А", "Б", "В", "Г"] as const;

  const commit = (next: [string, string, string, string]) => {
    void setFieldValue(
      `questions.${index}.optionsJson`,
      JSON.stringify(next, null, 2),
    );
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {labels.map((lbl, i) => (
        <div key={lbl} className="space-y-2">
          <Label htmlFor={`mcq-opt-${index}-${lbl}`}>Сонголт {lbl}</Label>
          <Input
            id={`mcq-opt-${index}-${lbl}`}
            value={slots[i]}
            onChange={(e) => {
              const next = [...slots] as [string, string, string, string];
              next[i] = e.target.value;
              commit(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function MathExamFieldsPreview({
  correctAnswer,
  explanation,
}: {
  correctAnswer: string | null | undefined;
  explanation: string | null | undefined;
}) {
  const parts: string[] = [];
  if (correctAnswer?.trim()) {
    parts.push(`Зөв хариулт: ${correctAnswer.trim()}`);
  }
  if (explanation?.trim()) {
    parts.push(explanation.trim());
  }
  const content = parts.join("\n\n");

  return (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/85 p-4 dark:border-emerald-900 dark:bg-emerald-950/35">
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        Математик — урьдчилан харах (LaTeX)
      </p>
      <p className="text-muted-foreground text-xs">
        Зөв хариултад эцсийн үр дүн (жишээ нь x = 2), тайлбарт бодолтыг $...$
        эсвэл $$...$$ хэлбэрээр бичнэ.
      </p>
      {content ? (
        <div className="rounded-md border border-emerald-200/80 bg-background/90 p-3 dark:border-emerald-800">
          <MathPreviewText
            content={content}
            contentSource="preview"
            className="text-sm leading-relaxed text-foreground"
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Зөв хариулт эсвэл тайлбар оруулбал энд харагдана.
        </p>
      )}
    </div>
  );
}

export function CreateAiExamComponent() {
  const [currentPrompt, setCurrentPrompt] = React.useState("");

  const [analyzeQuestion, { loading: analyzing }] =
    useMutation(ANALYZE_QUESTION);
  const [createAiExamTemplate, { loading: saving }] = useMutation(
    CREATE_AI_EXAM_TEMPLATE,
  );

  const handleAnalyzeQuestion = async (
    setFieldValue: FormikHelpers<CreateAiExamFormValues>["setFieldValue"],
    existingQuestions: QuestionRow[],
  ) => {
    const prompt = currentPrompt.trim();
    if (!prompt) {
      toast.error("Асуултын текстээ оруулна уу.");
      return;
    }

    if (
      existingQuestions.some(
        (q) => q.prompt.trim().length > 0 && q.prompt.trim() === prompt,
      )
    ) {
      toast.warning("Энэ асуултын текст аль хэдийн жагсаалтад байна.");
      return;
    }

    try {
      const { data } = await analyzeQuestion({
        variables: { prompt },
      });
      const result = (
        data as { analyzeQuestion?: QuestionAnalysisResult } | null | undefined
      )?.analyzeQuestion;

      if (!result) {
        toast.error("AI хариу ирсэнгүй.");
        return;
      }

      const typeStr = suggestedTypeToString(result.suggestedType);

      const newQuestion: QuestionRow = {
        id: uuidv4(),
        type: typeStr,
        aiSuggestedType: typeStr,
        prompt,
        points: result.points,
        difficulty: result.difficulty,
        correctAnswer: result.correctAnswer ?? "",
        explanation: result.explanation ?? "",
        tags: (result.tags ?? []).join(", "),
        source: result.source ?? "",
        skillLevel: result.skillLevel ?? "Мэдлэг",
        optionsJson: result.options?.length
          ? JSON.stringify(result.options, null, 2)
          : null,
      };

      setFieldValue("questions", [...existingQuestions, newQuestion]);
      setCurrentPrompt("");
      toast.success("Асуулт амжилттай шинжлэгдлээ.");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Алдаа";
      toast.error(`AI шинжилгээнд алдаа: ${msg}`);
    }
  };

  const handleSubmit = async (values: CreateAiExamFormValues) => {
    try {
      const questions: CreateAiExamTemplateInput["questions"] =
        values.questions.map((q) => {
          let optionsJson: string | undefined;
          const raw = q.optionsJson?.trim();
          if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) {
              throw new Error("Сонголтууд JSON массив байх ёстой.");
            }
            optionsJson = JSON.stringify(parsed.map((x) => String(x)));
          }

          return {
            type: q.type,
            prompt: q.prompt,
            aiSuggestedType: q.aiSuggestedType?.trim() || undefined,
            points: Math.max(1, Math.floor(Number(q.points))),
            difficulty: q.difficulty,
            correctAnswer: q.correctAnswer?.trim() || undefined,
            explanation: q.explanation?.trim() || undefined,
            tags: q.tags?.trim() || undefined,
            source: q.source?.trim() || undefined,
            skillLevel: q.skillLevel?.trim() || undefined,
            optionsJson,
          };
        });

      const input: CreateAiExamTemplateInput = {
        title: values.title.trim(),
        subject: values.subject.trim(),
        grade: values.grade,
        teacherId: values.teacherId.trim(),
        durationMinutes: values.durationMinutes,
        questions,
      };

      const { data } = await createAiExamTemplate({ variables: { input } });
      const payload = (
        data as
          | { createAiExamTemplate?: { templateId: string } }
          | null
          | undefined
      )?.createAiExamTemplate;

      if (!payload) {
        toast.error("Хадгалалтын хариу ирсэнгүй.");
        return;
      }

      toast.success(`Шалгалт амжилттай хадгалагдлаа: ${payload.templateId}`);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Алдаа";
      toast.error(`Шалгалт хадгалахад алдаа: ${msg}`);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100/80 px-4 py-8 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Шинэ AI сорил үүсгэх
          </h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Нүүр рүү</Link>
          </Button>
        </div>

        <Formik
          initialValues={initialValues}
          validationSchema={createAiExamSchema}
          onSubmit={(vals, { setSubmitting }) => {
            void handleSubmit(vals).finally(() => setSubmitting(false));
          }}
        >
          {({ values, setFieldValue, isSubmitting }) => (
            <Form className="space-y-6">
              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Шалгалтын толгой мэдээлэл
                  </CardTitle>
                  <CardDescription>
                    Гарчиг, хичээл, анги, багш, хугацаа
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="title">Шалгалтын нэр</Label>
                    <Field
                      as={Input}
                      id="title"
                      name="title"
                      className="w-full"
                    />
                    <ErrorMessage
                      name="title"
                      component="p"
                      className="text-xs text-destructive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Хичээл</Label>
                    <Field as={Input} id="subject" name="subject" />
                    <ErrorMessage
                      name="subject"
                      component="p"
                      className="text-xs text-destructive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Анги</Label>
                    <Field
                      as={Input}
                      id="grade"
                      name="grade"
                      type="number"
                      min={1}
                      max={12}
                    />
                    <ErrorMessage
                      name="grade"
                      component="p"
                      className="text-xs text-destructive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacherId">Багшийн ID</Label>
                    <Field as={Input} id="teacherId" name="teacherId" />
                    <ErrorMessage
                      name="teacherId"
                      component="p"
                      className="text-xs text-destructive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="durationMinutes">Хугацаа (мин)</Label>
                    <Field
                      as={Input}
                      id="durationMinutes"
                      name="durationMinutes"
                      type="number"
                      min={1}
                    />
                    <ErrorMessage
                      name="durationMinutes"
                      component="p"
                      className="text-xs text-destructive"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed border-primary/25 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-primary">
                    AI-аар асуулт шинжлүүлэх
                  </CardTitle>
                  <CardDescription>
                    Бодлого / асуултаа бичээд доорх товчоор шинжлүүлнэ. Хариу нь
                    сервер дээрх{" "}
                    <span className="font-medium text-foreground">
                      Google Gemini
                    </span>{" "}
                    (эх сурвалжийг вэбээс татах grounding-тай).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AiExamAnalyzePromptField
                    value={currentPrompt}
                    onChange={setCurrentPrompt}
                    disabled={analyzing}
                  />
                  <Button
                    type="button"
                    variant="default"
                    disabled={analyzing || !currentPrompt.trim()}
                    onClick={() =>
                      void handleAnalyzeQuestion(
                        setFieldValue,
                        values.questions,
                      )
                    }
                  >
                    {analyzing ? (
                      <>
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                        Шинжилж байна…
                      </>
                    ) : (
                      "AI-аар шинжлэх"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <FieldArray name="questions">
                {({ remove, push }) => (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => push(createEmptyQuestionRow())}
                      >
                        Гараар асуулт нэмэх
                      </Button>
                    </div>
                    {values.questions.map((question, index) => (
                      <Card
                        key={question.id ?? `${index}-${question.prompt}`}
                        className="border-border/70 shadow-sm"
                      >
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                          <CardTitle className="text-base">
                            Асуулт {index + 1}
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            Устгах
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Асуултын текст</Label>
                            <Field
                              as={Textarea}
                              name={`questions.${index}.prompt`}
                              rows={3}
                              className="resize-y"
                            />
                            <ErrorMessage
                              name={`questions.${index}.prompt`}
                              component="p"
                              className="text-xs text-destructive"
                            />
                            {question.prompt.trim() ? (
                              <div className="space-y-2 rounded-md border border-border/80 bg-muted/25 p-3">
                                <p className="text-muted-foreground text-xs font-medium">
                                  Асуултын урьдчилан харах (LaTeX)
                                </p>
                                <MathPreviewText
                                  content={question.prompt}
                                  contentSource="preview"
                                  className="text-sm leading-relaxed text-foreground"
                                />
                              </div>
                            ) : null}
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Оноо</Label>
                              <Field
                                as={Input}
                                name={`questions.${index}.points`}
                                type="number"
                                min={1}
                              />
                              <ErrorMessage
                                name={`questions.${index}.points`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Хүндрэл</Label>
                              <Field
                                as="select"
                                name={`questions.${index}.difficulty`}
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                              >
                                <option value={Difficulty.Easy}>Хялбар</option>
                                <option value={Difficulty.Medium}>Дунд</option>
                                <option value={Difficulty.Hard}>Хүнд</option>
                              </Field>
                              <ErrorMessage
                                name={`questions.${index}.difficulty`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Төрөл</Label>
                              <Field
                                as="select"
                                name={`questions.${index}.type`}
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                              >
                                <option value="MCQ">Сонгох (MCQ)</option>
                                <option value="MATCHING">
                                  Холбох (matching)
                                </option>
                                <option value="FILL_IN">Нөхөх</option>
                                <option value="MATH">Математик</option>
                                <option value="FREE_TEXT">Задгай бичвэр</option>
                              </Field>
                              <ErrorMessage
                                name={`questions.${index}.type`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                          </div>

                          {question.type === "MCQ" ? (
                            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/90 p-4 dark:border-blue-900 dark:bg-blue-950/40">
                              <div>
                                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                  Дөрвөн сонголт (А–Г)
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  Оруулсан утгууд автоматаар JSON болж
                                  хадгалагдана.
                                </p>
                              </div>
                              <McqOptionsFourFields
                                index={index}
                                optionsJson={question.optionsJson}
                                setFieldValue={setFieldValue}
                              />
                              <ErrorMessage
                                name={`questions.${index}.optionsJson`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                              {(() => {
                                const slots = parseMcqFourSlots(
                                  question.optionsJson,
                                );
                                if (!slots.some((s) => s.trim().length > 0)) {
                                  return null;
                                }
                                const mcqPreviewBody = (
                                  ["А", "Б", "В", "Г"] as const
                                )
                                  .map((lbl, i) => `${lbl}) ${slots[i]}`)
                                  .join("\n");
                                return (
                                  <div className="space-y-2 rounded-md border border-blue-200/80 bg-background/90 p-3 dark:border-blue-800">
                                    <p className="text-muted-foreground text-xs font-medium">
                                      Сонголтууд — урьдчилан харах (LaTeX)
                                    </p>
                                    <MathPreviewText
                                      content={mcqPreviewBody}
                                      contentSource="preview"
                                      className="text-sm leading-relaxed text-foreground"
                                    />
                                  </div>
                                );
                              })()}
                            </div>
                          ) : null}

                          {question.type === "MATCHING" ? (
                            <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/90 p-4 dark:border-violet-900 dark:bg-violet-950/40">
                              <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                                Холбох мөрүүд (AI санал)
                              </p>
                              <p className="text-muted-foreground text-xs">
                                JSON массив — жишээ: [&quot;А — 1&quot;, &quot;Б
                                — 2&quot;]
                              </p>
                              <Field
                                as={Textarea}
                                name={`questions.${index}.optionsJson`}
                                rows={4}
                                className="font-mono text-sm"
                              />
                              <ErrorMessage
                                name={`questions.${index}.optionsJson`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                          ) : null}

                          {question.type === "FILL_IN" ? (
                            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                                Нөхөх асуулт
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Зөв нөхөх үгийг доорх &quot;Зөв хариулт&quot;
                                талбарт бичнэ. Хэрэв олон зөв хувилбар байвал
                                JSON массивыг энд оруулж болно (сонголттой).
                              </p>
                              <Field
                                as={Textarea}
                                name={`questions.${index}.optionsJson`}
                                rows={3}
                                className="font-mono text-sm"
                                placeholder='["зөв1", "зөв2"] эсвэл хоосон'
                              />
                              <ErrorMessage
                                name={`questions.${index}.optionsJson`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <Label>Зөв хариулт</Label>
                            <Field
                              as={Input}
                              name={`questions.${index}.correctAnswer`}
                            />
                            <ErrorMessage
                              name={`questions.${index}.correctAnswer`}
                              component="p"
                              className="text-xs text-destructive"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Тайлбар (бодолт)</Label>
                            <Field
                              as={Textarea}
                              name={`questions.${index}.explanation`}
                              rows={3}
                              className="resize-y"
                            />
                          </div>
                          {question.type !== "MATH" &&
                          (question.correctAnswer?.trim() ||
                            question.explanation?.trim()) ? (
                            <div className="space-y-2 rounded-md border border-border/80 bg-muted/25 p-3">
                              <p className="text-muted-foreground text-xs font-medium">
                                Зөв хариулт, тайлбар — урьдчилан харах (LaTeX)
                              </p>
                              <MathPreviewText
                                content={[
                                  question.correctAnswer?.trim()
                                    ? `Зөв хариулт: ${question.correctAnswer.trim()}`
                                    : "",
                                  question.explanation?.trim() ?? "",
                                ]
                                  .filter(Boolean)
                                  .join("\n\n")}
                                contentSource="preview"
                                className="text-sm leading-relaxed text-foreground"
                              />
                            </div>
                          ) : null}
                          {question.type === "MATH" ? (
                            <MathExamFieldsPreview
                              correctAnswer={question.correctAnswer}
                              explanation={question.explanation}
                            />
                          ) : null}
                          <div className="space-y-2">
                            <Label>Түлхүүр үг (таслалаар)</Label>
                            <Field
                              as={Input}
                              name={`questions.${index}.tags`}
                            />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Эх сурвалж (таамаглал)</Label>
                              <Field
                                as={Input}
                                name={`questions.${index}.source`}
                                placeholder="Жишээ: ЭЕШ, сурах бичиг"
                              />
                              <ErrorMessage
                                name={`questions.${index}.source`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Bloom — мэдлэгийн түвшин</Label>
                              <Field
                                as="select"
                                name={`questions.${index}.skillLevel`}
                                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                              >
                                {BLOOM_SKILL_LEVELS.map((lvl) => (
                                  <option key={lvl} value={lvl}>
                                    {lvl}
                                  </option>
                                ))}
                              </Field>
                              <ErrorMessage
                                name={`questions.${index}.skillLevel`}
                                component="p"
                                className="text-xs text-destructive"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <ErrorMessage
                      name="questions"
                      component="p"
                      className="text-sm text-destructive"
                    />
                  </div>
                )}
              </FieldArray>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    saving || isSubmitting || values.questions.length === 0
                  }
                  className="min-w-[200px]"
                >
                  {saving || isSubmitting ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      Хадгалж байна…
                    </>
                  ) : (
                    "Шалгалтыг хадгалах"
                  )}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default CreateAiExamComponent;
