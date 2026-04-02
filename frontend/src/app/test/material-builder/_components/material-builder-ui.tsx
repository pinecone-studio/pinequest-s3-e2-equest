"use client";

import { CircleDot, Database, RefreshCcw, Repeat2 } from "lucide-react";
import { type ReactNode } from "react";
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
import {
  explanationClassName,
  optionFieldClassName,
  textareaClassName,
  type SharedLibraryContent,
  type SharedLibraryMaterial,
} from "./material-builder-config";

export function TextbookStatField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[15px] font-medium text-slate-900">{label}</p>
      <div className="flex min-h-[44px] items-center justify-between rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
        <span>{value}</span>
      </div>
    </div>
  );
}

export function TextbookBadgeField({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-between rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
      <span>{label}</span>
      <span className="inline-flex min-w-8 items-center justify-center rounded-[10px] border border-[#c7d3e7] bg-white px-2 py-1 text-[14px]">
        {value}
      </span>
    </div>
  );
}

export function TextbookQuestionCard({
  answerMode = "single-choice",
  answerText,
  answers,
  content,
  countValue = "1",
  difficultyValue = "easy",
  explanation,
  focusValue = "recall",
  formatValue = "single-choice",
  onRegenerate,
  renderAnswer,
  renderExplanation,
}: {
  answerMode?: "single-choice" | "written";
  answerText?: string;
  answers: string[];
  content: ReactNode;
  countValue?: string;
  difficultyValue?: "easy" | "medium" | "hard";
  explanation?: string;
  focusValue?: "recall" | "concept" | "practice" | "proof";
  formatValue?: "single-choice" | "multiple-choice" | "written";
  onRegenerate?: () => void;
  renderAnswer?: (answer: string) => ReactNode;
  renderExplanation?: (explanation: string) => ReactNode;
}) {
  const selectedAnswer = answerText || answers[0] || "";

  return (
    <section className="rounded-[18px] border border-[#e3e9f4] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="grid gap-3 xl:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Select value={countValue} onValueChange={() => undefined}>
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Тоо" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, index) => String(index + 1)).map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formatValue} onValueChange={() => undefined}>
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <CircleDot className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Асуултын төрөл" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
            <SelectItem value="multiple-choice">Олон сонголттой</SelectItem>
            <SelectItem value="written">Задгай</SelectItem>
          </SelectContent>
        </Select>

        <Select value={difficultyValue} onValueChange={() => undefined}>
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Түвшин" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Энгийн</SelectItem>
            <SelectItem value="medium">Дунд</SelectItem>
            <SelectItem value="hard">Хүнд</SelectItem>
          </SelectContent>
        </Select>

        <Select value={focusValue} onValueChange={() => undefined}>
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <Repeat2 className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Сонголт" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recall">Сэргээн санах</SelectItem>
            <SelectItem value="concept">Ойлголтын</SelectItem>
            <SelectItem value="practice">Дасгалын</SelectItem>
            <SelectItem value="proof">Баталгаа</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">{content}</div>

      <Separator className="my-4 bg-[#e6edf7]" />

      <div>
        <p className="mb-3 text-[14px] font-medium text-slate-800">Хариулт</p>
        {answerMode === "written" ? (
          <div className="min-h-[56px] rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 py-4 text-[14px] text-slate-800">
            {renderAnswer ? renderAnswer(selectedAnswer) : selectedAnswer}
          </div>
        ) : (
          <RadioGroup value={selectedAnswer} className="gap-3">
            {answers.map((answer, index) => (
              <label
                key={`${answer}-${index}`}
                className="flex min-h-[56px] items-center gap-4 rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 text-[14px] text-slate-800"
              >
                <RadioGroupItem
                  value={answer}
                  className="border-[#cdd8ea] text-[#0b5cab] data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                />
                <span className="min-w-0 flex-1">
                  {renderAnswer ? renderAnswer(answer) : answer}
                </span>
              </label>
            ))}
          </RadioGroup>
        )}
      </div>

      {explanation ? (
        <div className="mt-4">
          <p className="mb-3 text-[14px] font-medium text-slate-800">
            Зөв хариултын тайлбар
          </p>
          {renderExplanation ? (
            <div
              className={`${explanationClassName} min-h-[88px] whitespace-pre-wrap`}
            >
              {renderExplanation(explanation)}
            </div>
          ) : (
            <Textarea value={explanation} readOnly className={explanationClassName} />
          )}
        </div>
      ) : null}

      {onRegenerate ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-2 text-[14px] font-medium text-slate-700 transition hover:text-slate-900"
          >
            <RefreshCcw className="h-4 w-4" />
            Дахин үүсгүүлэх
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function SharedLibraryStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-h-[108px] w-full flex-col items-center justify-center rounded-[16px] border border-[#cadcfb] bg-[#e6efff] px-3 py-3 text-center">
      <p className="max-w-[104px] text-[13px] leading-5 text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function SharedLibraryQuestionCard({
  material,
  content,
  index,
}: {
  material: SharedLibraryMaterial;
  content: SharedLibraryContent;
  index: number;
}) {
  return (
    <section className="rounded-[18px] border border-[#e3e9f4] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium text-[#2563eb]">
              Хэсэг {index + 1}
            </p>
            <h4 className="mt-1 text-[22px] font-semibold text-slate-900">
              {content.title}
            </h4>
          </div>

          <div className="flex flex-wrap gap-2 text-[12px] text-slate-600">
            <span className="rounded-full border border-[#d7e3fb] bg-[#e8f0ff] px-3 py-1.5">
              {content.score} оноо
            </span>
          </div>
        </div>

        <p className="mt-2 text-[14px] leading-6 text-slate-600">
          {material.title} материалын энэ хэсгийг `Ном`-ын баруун
          талын асуултын card-уудтай төстэй байдлаар харуулж байна.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Select defaultValue={String(content.questionCount)}>
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Тоо" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={String(content.questionCount)}>
              {content.questionCount}
            </SelectItem>
            <SelectItem value={String(content.questionCount + 1)}>
              {content.questionCount + 1}
            </SelectItem>
            <SelectItem value={String(content.questionCount + 2)}>
              {content.questionCount + 2}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue={content.type}>
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <CircleDot className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Асуултын төрөл" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {material.contents.map((item) => (
              <SelectItem key={item.id} value={item.type}>
                {item.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue={content.difficulty}>
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Түвшин" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Энгийн">Энгийн</SelectItem>
            <SelectItem value="Дунд">Дунд</SelectItem>
            <SelectItem value="Хүнд">Хүнд</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue={content.previewFocus}>
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <Repeat2 className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Сонголт" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Сэргээн санах">Сэргээн санах</SelectItem>
            <SelectItem value="Ойлголтын">Ойлголтын</SelectItem>
            <SelectItem value="Дасгалын">Дасгалын</SelectItem>
            <SelectItem value="Баталгаа">Баталгаа</SelectItem>
            <SelectItem value="Хэрэглээний">Хэрэглээний</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <Textarea defaultValue={content.previewPrompt} className={textareaClassName} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] leading-6 text-slate-500">
          {content.description}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="!h-[36px] min-w-[176px] rounded-[10px] border border-[#d6e4fb] bg-[#edf4ff] px-4 text-[#1659a6] hover:bg-[#e5efff]"
        >
          <Database className="h-4 w-4" />
          Материалаас ашиглах
        </Button>
      </div>

      <Separator className="my-4 bg-[#e6edf7]" />

      <div>
        <p className="mb-3 text-[14px] font-medium text-slate-800">Хариулт</p>
        <RadioGroup defaultValue={content.previewAnswers[0]} className="gap-3">
          {content.previewAnswers.map((answer, answerIndex) => (
            <label
              key={`${content.id}-answer-${answerIndex}`}
              className="flex min-h-[56px] items-center gap-4 rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 text-[14px] text-slate-800"
            >
              <RadioGroupItem
                value={answer}
                className="border-[#cdd8ea] text-[#0b5cab] data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
              />
              <span>{answer}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="mt-4">
        <Label className="mb-3 block text-[14px] font-medium text-slate-800">
          Зөв хариултын тайлбар
        </Label>
        <Textarea
          defaultValue={content.previewExplanation}
          className={explanationClassName}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-slate-700 transition hover:text-slate-900"
        >
          <RefreshCcw className="h-4 w-4" />
          Өөр хэсэг сонгох
        </button>

        <Button
          type="button"
          variant="outline"
          className="!h-[38px] min-w-[170px] rounded-[10px] border-[#0b5cab] bg-white px-5 text-[#0b5cab] hover:bg-[#f4f8ff]"
        >
          Энэ хэсгийг нэмэх
        </Button>
      </div>
    </section>
  );
}
