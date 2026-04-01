"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  Flag,
  Keyboard,
  Loader2,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { generateMathExpressionRequest } from "@/app/_pagecomponents/student-page-api";
import MathInput from "@/components/math-input";
import { MathText } from "@/components/math-text";
import type { AiContentSource, StartExamResponse } from "@/lib/exam-service/types";
import { formatQuestionPrompt } from "@/app/_pagecomponents/student-page-utils";

type TakeExamProps = {
  answers: Record<string, string | null>;
  attempt: StartExamResponse;
  containerRef?: RefObject<HTMLDivElement | null>;
  error: string | null;
  flaggedQuestions: Record<string, boolean>;
  isMutating: boolean;
  onQuestionInteract?: () => void;
  timeLeftLabel: string;
  onQuestionFocus?: (questionId: string) => void;
  onSelectAnswer: (questionId: string, value: string) => void;
  onSubmit: (finalize: boolean) => void;
  onToggleFlag: (questionId: string) => void;
};

export function TakeExam({
  answers,
  attempt,
  containerRef,
  error,
  flaggedQuestions,
  isMutating,
  onQuestionInteract,
  timeLeftLabel,
  onQuestionFocus,
  onSelectAnswer,
  onSubmit,
  onToggleFlag,
}: TakeExamProps) {
  const questionCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [assistTextByQuestion, setAssistTextByQuestion] = useState<
    Record<string, string>
  >({});
  const [assistResultByQuestion, setAssistResultByQuestion] = useState<
    Record<
      string,
      {
        explanation: string;
        expression: string;
        source: AiContentSource;
      }
    >
  >({});
  const [assistLoadingByQuestion, setAssistLoadingByQuestion] = useState<
    Record<string, boolean>
  >({});
  const [assistProviderByQuestion, setAssistProviderByQuestion] = useState<
    Record<string, "auto" | "gemini" | "ollama">
  >({});
  const [activeInputModeByQuestion, setActiveInputModeByQuestion] = useState<
    Record<string, "keyboard" | "ai" | "none">
  >({});
  const [keyboardDraftByQuestion, setKeyboardDraftByQuestion] = useState<
    Record<string, string>
  >({});

  const normalizePlainAnswer = (value: string) => value.replace(/\r\n/g, "\n");

  const getLastEditableLine = (value: string) => {
    const normalized = normalizePlainAnswer(value);
    const lines = normalized.split("\n");
    return lines[lines.length - 1] ?? "";
  };

  const replaceLastEditableLine = (value: string, replacement: string) => {
    const normalized = normalizePlainAnswer(value);
    const lines = normalized.split("\n");

    if (lines.length === 0) {
      return replacement;
    }

    lines[lines.length - 1] = replacement;
    return lines.join("\n");
  };

  const plainTextToMathInputValue = (value: string) =>
    normalizePlainAnswer(value).replace(/\n/g, "\\\\ ");

  const mathInputValueToPlainText = (value: string) =>
    value.replace(/\\\\\s*/g, "\n");

  useEffect(() => {
    if (!onQuestionFocus) {
      return;
    }

    const nodes = Object.entries(questionCardRefs.current).filter(
      (entry): entry is [string, HTMLElement] => Boolean(entry[1]),
    );

    if (nodes.length === 0) {
      return;
    }

    onQuestionFocus(nodes[0][0]);

    const observer = new IntersectionObserver(
      (entries) => {
        const topEntry = [...entries]
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          )[0];

        if (!topEntry) {
          return;
        }

        const questionId = (topEntry.target as HTMLElement).dataset.questionId;
        if (questionId) {
          onQuestionFocus(questionId);
        }
      },
      {
        rootMargin: "-12% 0px -45% 0px",
        threshold: [0.25, 0.5, 0.75],
      },
    );

    nodes.forEach(([, node]) => observer.observe(node));

    return () => observer.disconnect();
  }, [attempt.exam.questions, onQuestionFocus]);

  const scrollToQuestion = (questionId: string) => {
    questionCardRefs.current[questionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const renderQuestionMedia = (
    question: StartExamResponse["exam"]["questions"][number],
    index: number,
  ) => {
    if (!question.imageUrl && !question.audioUrl && !question.videoUrl) {
      return null;
    }

    return (
      <div className="mb-8 space-y-4">
        {question.imageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={question.imageUrl}
              alt={`Question ${index + 1}`}
              className="max-h-80 w-auto max-w-full object-contain"
            />
          </div>
        ) : null}

        {question.videoUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
            <div className="overflow-hidden rounded-xl bg-slate-950">
              <video
                controls
                playsInline
                preload="metadata"
                className="aspect-video h-auto max-h-[420px] w-full"
                src={question.videoUrl}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        ) : null}

        {question.audioUrl ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <audio
              controls
              preload="metadata"
              className="w-full max-w-full"
              src={question.audioUrl}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#f7f7f8] text-slate-900"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-5 flex items-start justify-between gap-4 rounded-[18px] border border-slate-200/80 bg-[#f7f7f8] px-4 py-3 sm:mb-8">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-[20px]">
            Явцын шалгалт
          </h1>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_256px] lg:items-start lg:gap-5">
          <div className="order-2 space-y-4 lg:order-1 lg:space-y-6">
            {attempt.exam.questions.map((question, index) => {
              const selectedOptionId = answers[question.questionId];
              const isAnswered = Boolean(answers[question.questionId]);
              const isFlagged = Boolean(flaggedQuestions[question.questionId]);
              const activeInputMode =
                activeInputModeByQuestion[question.questionId] ?? "none";

              return (
                <div
                  key={question.questionId}
                  className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start lg:gap-5"
                >
                  <aside className=" bg-transparent"></aside>

                  <article
                    data-question-id={question.questionId}
                    onPointerDownCapture={() => onQuestionInteract?.()}
                    ref={(node) => {
                      questionCardRefs.current[question.questionId] = node;
                    }}
                    className="rounded-[24px] border border-[#dfe7ef] bg-[#f4fbff] px-4 py-5 shadow-[0_8px_20px_rgba(148,163,184,0.12)] sm:px-6 sm:py-7 lg:rounded-[28px] lg:px-7 lg:py-8"
                  >
                    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-[#cfe0ef] bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                          Сорил {index + 1}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="rounded-full border border-[#d7e6f2] bg-white px-3 py-1 text-[12px] font-semibold text-slate-700">
                          Бүтэн оноо {question.points.toFixed(1)}
                        </span>
                        <button
                          onClick={() => onToggleFlag(question.questionId)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                            isFlagged
                              ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-[#b9d8ed] bg-white text-[#1e6d99] hover:bg-[#eef8ff]"
                          }`}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          {isFlagged ? "Тэмдэглэсэн" : "Тэмдэглэх"}
                        </button>
                      </div>
                    </div>

                    <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
                      <MathText
                        as="h2"
                        className="text-base font-medium leading-7 text-slate-900 sm:text-[18px] sm:leading-8"
                        displayMode={question.type === "math"}
                        text={formatQuestionPrompt(question.prompt)}
                      />
                    </div>

                    {renderQuestionMedia(question, index)}

                    <div className="space-y-4 pl-0 sm:space-y-5 sm:pl-1">
                      {question.type === "math" ? (
                        <div className="space-y-3">
                          <textarea
                            value={selectedOptionId ?? ""}
                            onChange={(event) => {
                              const nextValue = event.target.value
                              onSelectAnswer(question.questionId, nextValue)

                              if (activeInputMode === "keyboard") {
                                setKeyboardDraftByQuestion((prev) => ({
                                  ...prev,
                                  [question.questionId]:
                                    plainTextToMathInputValue(nextValue),
                                }))
                              }
                            }}
                            onInput={(event) => {
                              const target = event.currentTarget
                              target.style.height = "auto"
                              target.style.height = `${Math.max(target.scrollHeight, 112)}px`
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.stopPropagation()
                              }
                            }}
                            placeholder="Хариугаа энд бичнэ үү..."
                            className="min-h-28 w-full resize-none overflow-hidden rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 shadow-[0_10px_24px_rgba(148,163,184,0.10)] outline-none transition focus:border-sky-300 sm:rounded-[24px]"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                {
                                  const nextMode =
                                    activeInputMode === "keyboard"
                                      ? "none"
                                      : "keyboard"

                                  if (nextMode === "keyboard") {
                                    setKeyboardDraftByQuestion((prev) => ({
                                      ...prev,
                                      [question.questionId]:
                                        plainTextToMathInputValue(
                                          getLastEditableLine(
                                            selectedOptionId ?? "",
                                          ),
                                        ),
                                    }))
                                  }

                                  setActiveInputModeByQuestion((prev) => ({
                                    ...prev,
                                    [question.questionId]: nextMode,
                                  }))
                                }
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                activeInputMode === "keyboard"
                                  ? "border-sky-300 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Keyboard className="h-3.5 w-3.5" />
                              Keyboard
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveInputModeByQuestion((prev) => ({
                                  ...prev,
                                  [question.questionId]:
                                    activeInputMode === "ai" ? "none" : "ai",
                                }))
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                activeInputMode === "ai"
                                  ? "border-sky-300 bg-sky-50 text-sky-700 shadow-[0_6px_14px_rgba(56,189,248,0.18)]"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                              }`}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              AI
                            </button>
                          </div>

                          {activeInputMode === "keyboard" ? (
                            <MathInput
                              value={
                                keyboardDraftByQuestion[question.questionId] ??
                                plainTextToMathInputValue(
                                  getLastEditableLine(selectedOptionId ?? ""),
                                )
                              }
                              onChange={(nextValue) => {
                                setKeyboardDraftByQuestion((prev) => ({
                                  ...prev,
                                  [question.questionId]: nextValue,
                                }))

                                const nextPlainLine =
                                  mathInputValueToPlainText(nextValue)
                                onSelectAnswer(
                                  question.questionId,
                                  replaceLastEditableLine(
                                    selectedOptionId ?? "",
                                    nextPlainLine,
                                  ),
                                )
                              }}
                              placeholder="Хариугаа энд бичнэ үү..."
                              className="shadow-[0_10px_24px_rgba(148,163,184,0.10)]"
                            />
                          ) : activeInputMode === "ai" ? (
                            <div className="grid gap-3 rounded-[20px] border border-slate-200 bg-white p-4 sm:rounded-[24px] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Sparkles className="h-4 w-4 text-sky-600" />
                                    Энгийн текстээс томьёо болгох
                                  </div>
                                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                                    {(["auto", "gemini", "ollama"] as const).map(
                                      (provider) => {
                                        const isActive =
                                          (assistProviderByQuestion[
                                            question.questionId
                                          ] ?? "auto") === provider;

                                        return (
                                          <button
                                            key={provider}
                                            type="button"
                                            onClick={() =>
                                              setAssistProviderByQuestion((prev) => ({
                                                ...prev,
                                                [question.questionId]: provider,
                                              }))
                                            }
                                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                              isActive
                                                ? "bg-slate-900 text-white"
                                                : "text-slate-600 hover:bg-white"
                                            }`}
                                          >
                                            {provider === "auto"
                                              ? "Авто"
                                              : provider === "gemini"
                                                ? "Gemini"
                                                : "Ollama"}
                                          </button>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                                <textarea
                                  value={
                                    assistTextByQuestion[question.questionId] ?? ""
                                  }
                                  onChange={(event) =>
                                    setAssistTextByQuestion((prev) => ({
                                      ...prev,
                                      [question.questionId]: event.target.value,
                                    }))
                                  }
                                  onInput={(event) => {
                                    const target = event.currentTarget
                                    target.style.height = "auto"
                                    target.style.height = `${Math.max(target.scrollHeight, 112)}px`
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.stopPropagation()
                                    }
                                  }}
                                  placeholder="Жишээ нь: x квадрат дээр нэмэх нь 1x хасах нь 2 тэнцүү 0"
                                  className="min-h-28 w-full resize-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const sourceText =
                                    assistTextByQuestion[question.questionId]?.trim() ??
                                    "";
                                  if (!sourceText) {
                                    return;
                                  }

                                  setAssistLoadingByQuestion((prev) => ({
                                    ...prev,
                                    [question.questionId]: true,
                                  }));

                                  try {
                                    const result =
                                      await generateMathExpressionRequest(
                                        sourceText,
                                        assistProviderByQuestion[
                                          question.questionId
                                        ] ?? "auto",
                                      );
                                    setAssistResultByQuestion((prev) => ({
                                      ...prev,
                                      [question.questionId]: result,
                                    }));
                                    onSelectAnswer(
                                      question.questionId,
                                      result.expression,
                                    );
                                    setActiveInputModeByQuestion((prev) => ({
                                      ...prev,
                                      [question.questionId]: "ai",
                                    }));
                                  } catch (error) {
                                    setAssistResultByQuestion((prev) => ({
                                      ...prev,
                                      [question.questionId]: {
                                        explanation:
                                          error instanceof Error
                                            ? error.message
                                            : "Томьёо болгож чадсангүй.",
                                        expression: "",
                                        source: "fallback",
                                      },
                                    }));
                                  } finally {
                                    setAssistLoadingByQuestion((prev) => ({
                                      ...prev,
                                      [question.questionId]: false,
                                    }));
                                  }
                                }}
                                disabled={
                                  !assistTextByQuestion[question.questionId]?.trim() ||
                                  assistLoadingByQuestion[question.questionId]
                                }
                              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                            >
                                {assistLoadingByQuestion[question.questionId] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "AI-р томьёо болгох"
                                )}
                              </button>
                            </div>
                          ) : null}

                          {assistResultByQuestion[question.questionId] ? (
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                              <p className="mt-3 text-sm leading-6 text-slate-600">
                                {
                                  assistResultByQuestion[question.questionId]
                                    .explanation
                                }
                              </p>
                            </div>
                          ) : null}
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
                              className="flex cursor-pointer items-center gap-3 text-base text-slate-800 sm:gap-4 sm:text-[18px]"
                            >
                              <span
                                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition sm:h-8 sm:w-8 ${
                                  selected
                                    ? "border-[#2a9ee9] bg-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                <span
                                  className={`h-3 w-3 rounded-full transition sm:h-3.5 sm:w-3.5 ${
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
                </div>
              );
            })}
          </div>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(148,163,184,0.10)] sm:p-5">
              <div className="sticky top-3 z-20 mb-4 rounded-[10px] border border-[#ff8d8d] bg-white/95 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm backdrop-blur sm:text-[15px]">
                Үлдсэн хугацаа {timeLeftLabel}
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Шалгалтын навигаци
              </h3>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {attempt.exam.questions.map((question, index) => {
                  const isAnswered = Boolean(answers[question.questionId]);
                  const isFlagged = Boolean(
                    flaggedQuestions[question.questionId],
                  );

                  return (
                    <button
                      key={`nav-${question.questionId}`}
                      onClick={() => scrollToQuestion(question.questionId)}
                      className={`flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition sm:h-12 sm:text-[15px] ${
                        isFlagged
                          ? "border-rose-300 bg-rose-50 text-rose-700"
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

              <div className="mt-5 grid gap-2 sm:space-y-0">
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
