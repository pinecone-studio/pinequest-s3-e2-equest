"use client";

import { useRef } from "react";
import { AlertCircle, Flag, Loader2, Save, Send } from "lucide-react";
import { MathText } from "@/components/math-text";
import type { StartExamResponse } from "@/lib/exam-service/types";

type TakeExamProps = {
  answers: Record<string, string | null>;
  attempt: StartExamResponse;
  error: string | null;
  flaggedQuestions: Record<string, boolean>;
  isMutating: boolean;
  timeLeftLabel: string;
  onSelectAnswer: (questionId: string, value: string) => void;
  onSubmit: (finalize: boolean) => void;
  onToggleFlag: (questionId: string) => void;
};

export function TakeExam({
  answers,
  attempt,
  error,
  flaggedQuestions,
  isMutating,
  timeLeftLabel,
  onSelectAnswer,
  onSubmit,
  onToggleFlag,
}: TakeExamProps) {
  const questionCardRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollToQuestion = (questionId: string) => {
    questionCardRefs.current[questionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-900">
      <main className="mx-auto max-w-430 px-6 py-10 lg:px-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">
            {attempt.exam.title}
          </h1>
          <div className="rounded-[10px] border border-[#ff8d8d] bg-white px-4 py-2 text-[15px] font-medium text-slate-900 shadow-sm">
            Үлдсэн хугацаа {timeLeftLabel}
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[120px_minmax(0,1fr)_256px] lg:items-start">
          <div className="space-y-5">
            {attempt.exam.questions.map((question, index) => {
              const isAnswered = Boolean(answers[question.questionId]);
              const isFlagged = Boolean(flaggedQuestions[question.questionId]);

              return (
                <aside
                  key={`meta-${question.questionId}`}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-[14px] font-semibold text-slate-900">
                    Сорил {index + 1}
                  </p>
                  <p className="mt-3 text-[12px] leading-4 text-slate-600">
                    {isAnswered ? "Хариулсан" : "Хариулаагүй байна"}
                  </p>
                  <p className="mt-3 text-[12px] text-slate-600">
                    Бүтэн оноо {question.points.toFixed(1)}
                  </p>
                  <button
                    onClick={() => onToggleFlag(question.questionId)}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[12px] font-medium transition ${
                      isFlagged
                        ? "border-[#2a9ee9] bg-[#e7f5ff] text-[#1385c6]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {isFlagged ? "Тэмдэглэсэн" : "Сорил тэмдэглэх"}
                  </button>
                </aside>
              );
            })}
          </div>

          <div className="space-y-6">
            {attempt.exam.questions.map((question, index) => {
              const selectedOptionId = answers[question.questionId];

              return (
                <article
                  key={question.questionId}
                  ref={(node) => {
                    questionCardRefs.current[question.questionId] = node;
                  }}
                  className="rounded-[28px] border border-[#dfe7ef] bg-[#f4fbff] px-7 py-8 shadow-[0_8px_20px_rgba(148,163,184,0.12)]"
                >
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <MathText
                      as="h2"
                      className="text-[18px] font-medium leading-8 text-slate-900"
                      displayMode={question.type === "math"}
                      text={question.prompt}
                    />
                  </div>

                  {question.imageUrl && (
                    <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={question.imageUrl}
                        alt={`Question ${index + 1}`}
                        className="max-h-80 w-auto max-w-full object-contain"
                      />
                    </div>
                  )}

                  <div className="space-y-5 pl-1">
                    {question.type === "math" ? (
                      <div className="space-y-3">
                        <textarea
                          value={selectedOptionId ?? ""}
                          onChange={(event) =>
                            onSelectAnswer(
                              question.questionId,
                              event.target.value,
                            )
                          }
                          placeholder="Хариугаа энд бичнэ үү..."
                          className="min-h-32 w-full rounded-2xl border border-[#bfe2f5] bg-white px-4 py-3 text-[16px] text-slate-900 outline-none transition focus:border-[#2a9ee9]"
                        />
                        {question.responseGuide && (
                          <MathText
                            as="p"
                            className="text-sm leading-6 text-slate-500"
                            text={question.responseGuide}
                          />
                        )}
                      </div>
                    ) : (
                      question.options.map((option) => {
                        const selected = selectedOptionId === option.id;

                        return (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-center gap-4 text-[18px] text-slate-800"
                          >
                            <span
                              className={`grid h-8 w-8 place-items-center rounded-full border-2 transition ${
                                selected
                                  ? "border-[#2a9ee9] bg-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              <span
                                className={`h-3.5 w-3.5 rounded-full transition ${
                                  selected ? "bg-[#2a9ee9]" : "bg-transparent"
                                }`}
                              />
                            </span>
                            <input
                              type="radio"
                              name={question.questionId}
                              checked={selected}
                              onChange={() =>
                                onSelectAnswer(question.questionId, option.id)
                              }
                              className="sr-only"
                            />
                            <MathText
                              as="span"
                              className="leading-7"
                              text={option.text}
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(148,163,184,0.10)]">
              <h3 className="text-[15px] font-semibold text-slate-900">
                Шалгалтын навигаци
              </h3>
              <div className="mt-4 grid grid-cols-6 gap-2">
                {attempt.exam.questions.map((question, index) => {
                  const isAnswered = Boolean(answers[question.questionId]);
                  const isFlagged = Boolean(
                    flaggedQuestions[question.questionId],
                  );

                  return (
                    <button
                      key={`nav-${question.questionId}`}
                      onClick={() => scrollToQuestion(question.questionId)}
                      className={`flex h-12 items-center justify-center rounded-md border text-[15px] font-semibold transition ${
                        isFlagged
                          ? "border-[#2a9ee9] bg-[#e7f5ff] text-[#1385c6]"
                          : isAnswered
                            ? "border-[#9dcff2] bg-[#eef8ff] text-slate-900"
                            : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => onSubmit(true)}
                  disabled={isMutating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27a7ea] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1199de] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMutating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Сорилыг дуусгах
                </button>
                <button
                  onClick={() => onSubmit(false)}
                  disabled={isMutating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMutating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Явц хадгалах
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
