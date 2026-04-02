"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  Clock3,
  Flag,
  Keyboard,
  LayoutGrid,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { generateMathExpressionRequest } from "@/app/_pagecomponents/student-page-api";
import MathInput from "@/components/math-input";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

type QuestionNavigationProps = {
  activeQuestionId: string | null;
  answers: Record<string, string | null>;
  attempt: StartExamResponse;
  compact?: boolean;
  flaggedQuestions: Record<string, boolean>;
  onJumpToQuestion: (questionId: string) => void;
};

type ExamActionButtonsProps = {
  compact?: boolean;
  isMutating: boolean;
  onSubmit: (finalize: boolean) => void;
};

type MobileFloatingControlsProps = {
  activeQuestionId: string | null;
  answers: Record<string, string | null>;
  attempt: StartExamResponse;
  flaggedQuestions: Record<string, boolean>;
  onJumpToQuestion: (questionId: string) => void;
  timeLeftLabel: string;
};

type MathAnswerRenderedLinesProps = {
  text?: string | null;
};

function MathAnswerRenderedLines({ text }: MathAnswerRenderedLinesProps) {
  const value = text?.replace(/\r\n/g, "\n") ?? "";

  if (!value) {
    return null;
  }

  const lines = value.split("\n");

  return (
    <div className="space-y-0.5 sm:space-y-1">
      {lines.map((line, index) =>
        line.length > 0 ? (
          <div
            key={`math-answer-render-${index}`}
            className="min-h-6 break-words text-[13px] leading-6 text-slate-800 sm:min-h-7 sm:text-sm sm:leading-7"
          >
            <MathText
              as="span"
              className="text-inherit leading-inherit"
              displayMode={false}
              text={line}
            />
          </div>
        ) : (
          <div
            key={`math-answer-render-space-${index}`}
            className="h-6 sm:h-7"
            aria-hidden="true"
          />
        ),
      )}
    </div>
  );
}

function QuestionNavigation({
  activeQuestionId,
  answers,
  attempt,
  compact = false,
  flaggedQuestions,
  onJumpToQuestion,
}: QuestionNavigationProps) {
  const answeredCount = attempt.exam.questions.filter(
    (question) => Boolean(answers[question.questionId]),
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3
          className={
            compact
              ? "text-[13px] font-semibold text-slate-900"
              : "text-[15px] font-semibold text-slate-900"
          }
        >
          Шалгалтын навигаци
        </h3>
        <span className="text-[11px] font-medium text-slate-500 sm:text-xs">
          {answeredCount}/{attempt.exam.questions.length}
        </span>
      </div>

      <div
        className={
          compact
            ? "mt-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6"
        }
      >
        {attempt.exam.questions.map((question, index) => {
          const isActive = activeQuestionId === question.questionId;
          const isAnswered = Boolean(answers[question.questionId]);
          const isFlagged = Boolean(flaggedQuestions[question.questionId]);

          return (
            <button
              key={`nav-${question.questionId}`}
              type="button"
              onClick={() => onJumpToQuestion(question.questionId)}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center justify-center border text-sm font-semibold transition ${
                compact
                  ? "h-9 w-9 shrink-0 rounded-lg text-[13px]"
                  : "h-11 rounded-md sm:h-12 sm:text-[15px]"
              } ${
                isFlagged
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : isAnswered
                    ? "border-[#9dcff2] bg-[#eef8ff] text-slate-900"
                    : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
              } ${isActive ? "ring-2 ring-[#2a9ee9] ring-offset-2" : ""}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExamActionButtons({
  compact = false,
  isMutating,
  onSubmit,
}: ExamActionButtonsProps) {
  return (
    <div className={compact ? "mt-4" : "mt-5"}>
      <button
        type="button"
        onClick={() => onSubmit(true)}
        disabled={isMutating}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27a7ea] px-4 font-semibold text-white transition hover:bg-[#1199de] disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "py-2 text-[11px] sm:py-2.5 sm:text-sm" : "py-3 text-sm"
        }`}
      >
        {isMutating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Сорилыг дуусгах
      </button>
    </div>
  );
}

function MobileFloatingControls({
  activeQuestionId,
  answers,
  attempt,
  flaggedQuestions,
  onJumpToQuestion,
  timeLeftLabel,
}: MobileFloatingControlsProps) {
  const [openPanel, setOpenPanel] = useState<"time" | "navigation" | null>(
    null,
  );

  return (
    <div className="fixed top-3 right-3 z-40 flex flex-col gap-1.5 sm:top-5 lg:hidden">
      <Popover
        open={openPanel === "time"}
        onOpenChange={(open) => {
          setOpenPanel(open ? "time" : null);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="h-10 w-10 rounded-xl border-slate-200 bg-[rgba(255,255,255,0.95)] shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur sm:h-11 sm:w-11 sm:rounded-2xl"
            aria-label="Хугацаа харах"
          >
            <Clock3 className="h-[18px] w-[18px] text-slate-700 sm:h-5 sm:w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={12}
          className="w-[min(16rem,calc(100vw-5rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_16px_32px_rgba(15,23,42,0.16)] sm:w-[min(18rem,calc(100vw-5.5rem))] sm:rounded-2xl sm:p-4"
        >
          <div className="rounded-xl border border-[#ff8d8d] bg-white px-3 py-2.5 text-xs font-medium text-slate-900 shadow-sm sm:rounded-[14px] sm:px-4 sm:py-3 sm:text-sm">
            Үлдсэн хугацаа {timeLeftLabel}
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={openPanel === "navigation"}
        onOpenChange={(open) => {
          setOpenPanel(open ? "navigation" : null);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="relative h-10 w-10 rounded-xl border-slate-200 bg-[rgba(255,255,255,0.95)] shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur sm:h-11 sm:w-11 sm:rounded-2xl"
            aria-label="Навигаци нээх"
          >
            <LayoutGrid className="h-[18px] w-[18px] text-slate-700 sm:h-5 sm:w-5" />
            <span className="absolute -top-1 -left-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#27a7ea] px-1 text-[9px] font-bold text-white sm:min-w-5 sm:text-[10px]">
              {attempt.exam.questions.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={12}
          className="max-h-[70vh] w-[min(17rem,calc(100vw-5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-[0_16px_32px_rgba(15,23,42,0.16)] sm:w-[min(19rem,calc(100vw-5.5rem))] sm:rounded-2xl sm:p-4"
        >
          <QuestionNavigation
            activeQuestionId={activeQuestionId}
            answers={answers}
            attempt={attempt}
            flaggedQuestions={flaggedQuestions}
            onJumpToQuestion={(questionId) => {
              onJumpToQuestion(questionId);
              setOpenPanel(null);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    attempt.exam.questions[0]?.questionId ?? null,
  );
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
    setActiveQuestionId(attempt.exam.questions[0]?.questionId ?? null);
  }, [attempt.attemptId, attempt.exam.questions]);

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

    setActiveQuestionId(nodes[0][0]);
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
          setActiveQuestionId(questionId);
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
    setActiveQuestionId(questionId);
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
      data-proctoring-capture-root
      className="min-h-screen bg-[#f7f7f8] text-slate-900"
    >
      <main className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-4 flex items-start justify-between gap-4 rounded-2xl border border-[rgba(226,232,240,0.8)] bg-[#f7f7f8] px-3.5 py-2.5 sm:mb-8 sm:rounded-[18px] sm:px-4 sm:py-3">
          <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-[20px]">
            Явцын шалгалт
          </h1>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 sm:mb-5 sm:px-4 sm:py-3 sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_256px] lg:items-start lg:gap-5">
          <aside className="order-1 hidden self-start lg:order-2 lg:block lg:sticky lg:top-10">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_20px_rgba(148,163,184,0.10)]">
              <div className="rounded-[10px] border border-[#ff8d8d] bg-[rgba(255,255,255,0.95)] px-4 py-2 text-sm font-medium text-slate-900 shadow-sm sm:text-[15px]">
                Үлдсэн хугацаа {timeLeftLabel}
              </div>

              <div className="mt-4">
                <QuestionNavigation
                  activeQuestionId={activeQuestionId}
                  answers={answers}
                  attempt={attempt}
                  flaggedQuestions={flaggedQuestions}
                  onJumpToQuestion={scrollToQuestion}
                />
              </div>

              <ExamActionButtons isMutating={isMutating} onSubmit={onSubmit} />
            </div>
          </aside>

          <div className="order-2 space-y-3 lg:order-1 lg:space-y-6">
            {attempt.exam.questions.map((question, index) => {
              const selectedOptionId = answers[question.questionId];
              const isAnswered = Boolean(answers[question.questionId]);
              const isFlagged = Boolean(flaggedQuestions[question.questionId]);
              const activeInputMode =
                activeInputModeByQuestion[question.questionId] ?? "none";
              const isKeyboardInputActive = activeInputMode === "keyboard";
              const hasMathAnswer = Boolean(selectedOptionId?.trim());

              return (
                <div
                  key={question.questionId}
                  className="grid gap-2.5 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start lg:gap-5"
                >
                  <aside className=" bg-transparent"></aside>

                  <article
                    data-question-id={question.questionId}
                    onPointerDownCapture={() => onQuestionInteract?.()}
                    ref={(node) => {
                      questionCardRefs.current[question.questionId] = node;
                    }}
                    className="scroll-mt-24 rounded-[20px] border border-[#dfe7ef] bg-[#f4fbff] px-3.5 py-4 shadow-[0_8px_20px_rgba(148,163,184,0.12)] sm:scroll-mt-28 sm:rounded-[24px] sm:px-6 sm:py-7 lg:scroll-mt-12 lg:rounded-[28px] lg:px-7 lg:py-8"
                  >
                    <div className="mb-4 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-[#cfe0ef] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 sm:px-3 sm:text-[12px]">
                          Сорил {index + 1}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                        <span className="rounded-full border border-[#d7e6f2] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 sm:px-3 sm:text-[12px]">
                          Бүтэн оноо {question.points.toFixed(1)}
                        </span>
                        <button
                          onClick={() => onToggleFlag(question.questionId)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:text-[12px] ${
                            isFlagged
                              ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-[#b9d8ed] bg-white text-[#1e6d99] hover:bg-[#eef8ff]"
                          }`}
                        >
                          <Flag className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {isFlagged ? "Тэмдэглэсэн" : "Тэмдэглэх"}
                        </button>
                      </div>
                    </div>

                    <div className="mb-5 flex items-start justify-between gap-4 sm:mb-8">
                      <MathText
                        as="h2"
                        className="text-[15px] font-medium leading-[1.45] text-slate-900 sm:text-[18px] sm:leading-8"
                        displayMode={question.type === "math"}
                        text={formatQuestionPrompt(question.prompt)}
                      />
                    </div>

                    {renderQuestionMedia(question, index)}

                    <div className="space-y-3.5 pl-0 sm:space-y-5 sm:pl-1">
                      {question.type === "math" ? (
                        <div className="space-y-2.5 sm:space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              setKeyboardDraftByQuestion((prev) => ({
                                ...prev,
                                [question.questionId]: plainTextToMathInputValue(
                                  getLastEditableLine(selectedOptionId ?? ""),
                                ),
                              }));
                              setActiveInputModeByQuestion((prev) => ({
                                ...prev,
                                [question.questionId]: "keyboard",
                              }));
                            }}
                            className={`min-h-24 w-full rounded-[18px] border px-3 py-2.5 text-left shadow-[0_10px_24px_rgba(148,163,184,0.10)] transition sm:min-h-28 sm:rounded-[24px] sm:px-4 sm:py-3 ${
                              isKeyboardInputActive
                                ? "border-sky-300 bg-sky-50/60"
                                : "border-slate-200 bg-white hover:border-sky-200"
                            }`}
                          >
                            {hasMathAnswer ? (
                              <MathAnswerRenderedLines text={selectedOptionId} />
                            ) : (
                              <span className="text-[13px] leading-6 text-slate-400 sm:text-sm sm:leading-7">
                                Хариугаа энд бичнэ үү...
                              </span>
                            )}
                          </button>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${
                                activeInputMode === "keyboard"
                                  ? "border-sky-300 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Keyboard className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${
                                activeInputMode === "ai"
                                  ? "border-sky-300 bg-sky-50 text-sky-700 shadow-[0_6px_14px_rgba(56,189,248,0.18)]"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                              }`}
                            >
                              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
                            <div className="grid gap-2.5 rounded-[18px] border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-[24px] sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                              <div className="space-y-2.5 sm:space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 sm:text-sm">
                                    <Sparkles className="h-4 w-4 text-sky-600" />
                                    Энгийн текстээс томьёо болгох
                                  </div>
                                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 sm:p-1">
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
                                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
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
                                  className="min-h-24 w-full resize-none overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] leading-6 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white sm:min-h-28 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm sm:leading-7"
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
                              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:text-sm lg:w-auto"
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
                            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3 sm:rounded-[22px] sm:p-4">
                              <p className="mt-2 text-[13px] leading-[1.45] text-slate-600 sm:mt-3 sm:text-sm sm:leading-6">
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
                              className="text-[13px] leading-[1.45] text-slate-500 sm:text-sm sm:leading-6"
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
                              className="flex cursor-pointer items-center gap-2.5 text-[15px] text-slate-800 sm:gap-4 sm:text-[18px]"
                            >
                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition sm:h-8 sm:w-8 ${
                                  selected
                                    ? "border-[#2a9ee9] bg-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 rounded-full transition sm:h-3.5 sm:w-3.5 ${
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
                                className="leading-6 sm:leading-7"
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

            <div className="lg:hidden">
              <section className="rounded-[20px] border border-slate-200 bg-white px-3.5 py-4 shadow-[0_8px_20px_rgba(148,163,184,0.10)] sm:rounded-[24px] sm:px-6 sm:py-6 lg:rounded-[28px] lg:px-7">
                <div className="flex flex-col gap-2">
                  <h3 className="text-[15px] font-semibold text-slate-900 sm:text-[18px]">
                    Шалгалтаа дуусгах
                  </h3>
                  <p className="text-[13px] leading-[1.45] text-slate-500 sm:text-sm sm:leading-6">
                    Бүх хариултаа шалгаад сорилоо дуусгана уу.
                  </p>
                </div>
                <ExamActionButtons
                  compact={true}
                  isMutating={isMutating}
                  onSubmit={onSubmit}
                />
              </section>
            </div>
          </div>
        </div>
      </main>

      <MobileFloatingControls
        activeQuestionId={activeQuestionId}
        answers={answers}
        attempt={attempt}
        flaggedQuestions={flaggedQuestions}
        onJumpToQuestion={scrollToQuestion}
        timeLeftLabel={timeLeftLabel}
      />
    </div>
  );
}
