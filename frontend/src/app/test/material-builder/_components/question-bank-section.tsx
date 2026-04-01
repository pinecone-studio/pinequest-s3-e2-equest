"use client";

import { useMutation } from "@apollo/client/react";
import { CircleDot, Loader2, RefreshCcw, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { GenerateQuestionAnswerDocument } from "@/gql/create-exam-documents";
import { Difficulty, QuestionFormat } from "@/gql/graphql";
import {
  answerOptions,
  explanationClassName,
  optionFieldClassName,
  textareaClassName,
} from "./material-builder-config";

export function QuestionBankSection() {
  const DEFAULT_GENERATED = {
    options: answerOptions.map((option) => option.value),
    correctAnswer: "3",
    explanation: `Бодолт:
1. +5-ыг нөгөө тал руу шилжүүлнэ:
   2x = 13 - 5
2. Хасна:
   2x = 8
3. 2-оор хуваана:
   x = 4`,
    format: "single-choice" as const,
  };
  const [points, setPoints] = useState("");
  const [format, setFormat] = useState<"single-choice" | "written" | "">("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "">(
    "",
  );
  const [questionText, setQuestionText] = useState("");
  const [generated, setGenerated] = useState<{
    options: string[];
    correctAnswer: string;
    explanation: string;
    format: "single-choice" | "written";
  }>(DEFAULT_GENERATED);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [generateAnswer, { loading: generating }] = useMutation(
    GenerateQuestionAnswerDocument,
  );

  async function handleGenerateAnswer() {
    const trimmedPrompt = questionText.trim();
    if (!trimmedPrompt) {
      toast.error("Асуултаа эхлээд оруулна уу.");
      return;
    }

    try {
      const { data } = await generateAnswer({
        variables: {
          input: {
            prompt: trimmedPrompt,
            points: points ? Number(points) : undefined,
            difficulty:
              difficulty === "easy"
                ? Difficulty.Easy
                : difficulty === "hard"
                  ? Difficulty.Hard
                  : difficulty === "medium"
                    ? Difficulty.Medium
                    : undefined,
            format:
              format === "written"
                ? QuestionFormat.Written
                : format === "single-choice"
                  ? QuestionFormat.SingleChoice
                  : undefined,
          },
        },
      });

      const payload = (
        data as
          | {
              generateQuestionAnswer?: {
                questionText: string;
                format: QuestionFormat;
                difficulty: Difficulty;
                points: number;
                options?: string[] | null;
                correctAnswer: string;
                explanation: string;
              };
            }
          | null
          | undefined
      )?.generateQuestionAnswer;
      if (!payload) {
        toast.error("AI хариу үүсгэсэнгүй.");
        return;
      }

      const nextFormat =
        payload.format === QuestionFormat.Written ? "written" : "single-choice";

      setGenerated({
        options: payload.options ?? [],
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation,
        format: nextFormat,
      });
      setPoints(String(payload.points ?? ""));
      setDifficulty(
        payload.difficulty === Difficulty.Easy
          ? "easy"
          : payload.difficulty === Difficulty.Hard
            ? "hard"
            : "medium",
      );
      setFormat(nextFormat);
      setQuestionText(payload.questionText);
      setHasGenerated(true);
      toast.success("AI хариулт үүсгэлээ.");
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "AI хариулт үүсгэхэд алдаа гарлаа.";
      toast.error(message);
    }
  }

  function handleFillDemo() {
    setPoints("2");
    setFormat("single-choice");
    setDifficulty("medium");
    setQuestionText(
      "Тэгшитгэлийг бод. 3x3 -8x2 +14x = 0",
    );
    setGenerated(DEFAULT_GENERATED);
    setHasGenerated(false);
  }

  function handleReset() {
    setPoints("");
    setFormat("");
    setDifficulty("");
    setQuestionText("");
    setGenerated(DEFAULT_GENERATED);
    setHasGenerated(false);
  }

  return (
    <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-6 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-[#2563eb]" />
          Гараар
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleFillDemo}
            className="h-[34px]! rounded-[10px] border-slate-100 bg-transparent px-2.5 text-[12px] font-normal text-slate-400 shadow-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-500"
          >
            Demo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="h-[34px]! rounded-[10px] border-slate-100 bg-transparent px-2.5 text-[12px] font-normal text-slate-400 shadow-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-500"
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)]">
        <Select value={points} onValueChange={setPoints}>
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Оноо" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={format}
          onValueChange={(value: "single-choice" | "written") =>
            setFormat(value)
          }
        >
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <CircleDot className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Асуултын төрөл" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
            <SelectItem value="written">Задгай</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={difficulty}
          onValueChange={(value: "easy" | "medium" | "hard") =>
            setDifficulty(value)
          }
        >
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Асуултын хүндрэлийн түвшин" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Энгийн</SelectItem>
            <SelectItem value="medium">Дунд</SelectItem>
            <SelectItem value="hard">Хүнд</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <Textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Асуултаа оруулна уу."
          className={textareaClassName}
        />
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleGenerateAnswer()}
          disabled={generating}
          className="h-[36px]! min-w-[158px] rounded-[10px] border border-[#d6e4fb] bg-[#edf4ff] font-semibold px-4 text-[#1659a6] hover:bg-[#e5efff]"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="h-4 w-4" />
          )}
          {generating ? "Үүсгэж байна..." : "Хариулт үүсгэх"}
        </Button>
      </div>

      {hasGenerated ? (
        <>
          <Separator className="my-4 bg-[#e6edf7]" />

          <div>
            <p className="mb-3 text-[14px] font-medium text-slate-800">Хариулт</p>
            {generated.format === "written" ? (
              <div className="min-h-[44px] rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 py-3 text-[14px] text-slate-800">
                {generated.correctAnswer}
              </div>
            ) : (
              <RadioGroup defaultValue={generated.correctAnswer} className="gap-3">
                {generated.options.map((option, index) => (
                  <label
                    key={`${option}-${index}`}
                    htmlFor={`generated-option-${index}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 text-[14px] text-slate-800"
                  >
                    <RadioGroupItem
                      id={`generated-option-${index}`}
                      value={option}
                      className="border-[#cdd8ea] text-[#0b5cab] data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>

          <div className="mt-4">
            <Label
              htmlFor="answer-explanation"
              className="mb-3 block text-[14px] font-medium text-slate-800"
            >
              Зөв хариултын тайлбар
            </Label>
            <Textarea
              id="answer-explanation"
              value={generated.explanation}
              readOnly
              className={explanationClassName}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => void handleGenerateAnswer()}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-slate-700 transition hover:text-slate-900"
            >
              <RefreshCcw className="h-4 w-4" />
              Дахин үүсгүүлэх
            </button>

            <Button
              type="button"
              variant="outline"
              className="h-[38px]! min-w-[140px] rounded-[10px] border-[#0b5cab] bg-white px-5 text-[#0b5cab] hover:bg-[#f4f8ff]"
            >
              Асуулт нэмэх
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
