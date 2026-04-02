"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  Calculator,
  Clock3,
  Delete,
  Flag,
  Keyboard,
  LayoutGrid,
  Loader2,
  Minus,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { generateMathExpressionRequest } from "@/app/_pagecomponents/student-page-api";
import MathInput from "@/components/math-input";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type CalculatorAngleMode = "deg" | "rad";
type CalculatorFunctionName =
  | "abs"
  | "acos"
  | "asin"
  | "atan"
  | "cos"
  | "exp"
  | "ln"
  | "log"
  | "sin"
  | "sqrt"
  | "tan";
type CalculatorConstantName = "ans" | "e" | "pi";
type CalculatorOperator =
  | "!"
  | "%"
  | "*"
  | "+"
  | "-"
  | "/"
  | "^"
  | "u+"
  | "u-";
type CalculatorToken =
  | { type: "comma" }
  | { type: "constant"; value: CalculatorConstantName }
  | { type: "function"; value: CalculatorFunctionName }
  | { type: "number"; value: number }
  | { type: "operator"; value: CalculatorOperator }
  | { type: "paren"; value: "(" | ")" };
type CalculatorButtonConfig = {
  ariaLabel?: string;
  label: string;
  tone: "action" | "accent" | "number";
  value: string;
};
type CalculatorLauncherProps = {
  onOpen: () => void;
};

type MobileFloatingControlsProps = {
  activeQuestionId: string | null;
  answers: Record<string, string | null>;
  attempt: StartExamResponse;
  flaggedQuestions: Record<string, boolean>;
  onJumpToQuestion: (questionId: string) => void;
  timeLeftLabel: string;
};

const CALCULATOR_FUNCTION_NAMES = new Set<CalculatorFunctionName>([
  "abs",
  "acos",
  "asin",
  "atan",
  "cos",
  "exp",
  "ln",
  "log",
  "sin",
  "sqrt",
  "tan",
]);

const SCIENTIFIC_CALCULATOR_BUTTONS: CalculatorButtonConfig[][] = [
  [
    { label: "sin", tone: "accent", value: "sin(" },
    { label: "cos", tone: "accent", value: "cos(" },
    { label: "tan", tone: "accent", value: "tan(" },
    { label: "sqrt", tone: "accent", value: "sqrt(" },
    { label: "^", tone: "accent", value: "^" },
  ],
  [
    { label: "asin", tone: "accent", value: "asin(" },
    { label: "acos", tone: "accent", value: "acos(" },
    { label: "atan", tone: "accent", value: "atan(" },
    { label: "ln", tone: "accent", value: "ln(" },
    { label: "log", tone: "accent", value: "log(" },
  ],
  [
    { label: "abs", tone: "accent", value: "abs(" },
    { label: "exp", tone: "accent", value: "exp(" },
    { label: "pi", tone: "accent", value: "pi" },
    { label: "e", tone: "accent", value: "e" },
    { label: "Ans", tone: "accent", value: "ans" },
  ],
  [
    { label: "(", tone: "number", value: "(" },
    { label: ")", tone: "number", value: ")" },
    { label: "n!", tone: "accent", value: "!" },
    {
      ariaLabel: "Сүүлийн тэмдэгт устгах",
      label: "⌫",
      tone: "action",
      value: "__backspace__",
    },
    { label: "C", tone: "action", value: "__clear__" },
  ],
  [
    { label: "7", tone: "number", value: "7" },
    { label: "8", tone: "number", value: "8" },
    { label: "9", tone: "number", value: "9" },
    { label: "/", tone: "accent", value: "/" },
    { label: "*", tone: "accent", value: "*" },
  ],
  [
    { label: "4", tone: "number", value: "4" },
    { label: "5", tone: "number", value: "5" },
    { label: "6", tone: "number", value: "6" },
    { label: "-", tone: "accent", value: "-" },
    { label: "+", tone: "accent", value: "+" },
  ],
  [
    { label: "1", tone: "number", value: "1" },
    { label: "2", tone: "number", value: "2" },
    { label: "3", tone: "number", value: "3" },
    { label: "0", tone: "number", value: "0" },
    { label: ".", tone: "number", value: "." },
  ],
];

function sanitizeCalculatorInput(value: string) {
  return value.replace(/[^0-9+\-*/%^().,!a-zA-Zπ×÷√\s]/g, "");
}

function formatCalculatorResult(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return parseFloat(value.toFixed(8)).toString();
}

function normalizeCalculatorExpression(expression: string) {
  return expression
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/[×x]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
}

function needsImplicitMultiplication(
  left: CalculatorToken,
  right: CalculatorToken,
) {
  const leftCanEnd =
    left.type === "number" ||
    left.type === "constant" ||
    (left.type === "paren" && left.value === ")") ||
    (left.type === "operator" && left.value === "!");
  const rightCanStart =
    right.type === "number" ||
    right.type === "constant" ||
    right.type === "function" ||
    (right.type === "paren" && right.value === "(");

  return leftCanEnd && rightCanStart;
}

function tokenizeCalculatorExpression(expression: string): CalculatorToken[] {
  const normalized = normalizeCalculatorExpression(expression);

  if (!normalized) {
    return [];
  }

  const tokens: CalculatorToken[] = [];
  let index = 0;

  while (index < normalized.length) {
    const character = normalized[index];

    if (/\d|\./.test(character)) {
      let nextIndex = index + 1;

      while (
        nextIndex < normalized.length &&
        /[\d.]/.test(normalized[nextIndex])
      ) {
        nextIndex += 1;
      }

      const rawNumber = normalized.slice(index, nextIndex);

      if (
        rawNumber === "." ||
        Number.isNaN(Number(rawNumber)) ||
        rawNumber.split(".").length > 2
      ) {
        throw new Error("Тооны формат буруу байна.");
      }

      tokens.push({ type: "number", value: Number(rawNumber) });
      index = nextIndex;
      continue;
    }

    if (/[a-zA-Z]/.test(character)) {
      let nextIndex = index + 1;

      while (
        nextIndex < normalized.length &&
        /[a-zA-Z]/.test(normalized[nextIndex])
      ) {
        nextIndex += 1;
      }

      const word = normalized.slice(index, nextIndex).toLowerCase();

      if (CALCULATOR_FUNCTION_NAMES.has(word as CalculatorFunctionName)) {
        tokens.push({
          type: "function",
          value: word as CalculatorFunctionName,
        });
        index = nextIndex;
        continue;
      }

      if (word === "pi" || word === "e" || word === "ans") {
        tokens.push({
          type: "constant",
          value: word as CalculatorConstantName,
        });
        index = nextIndex;
        continue;
      }

      throw new Error(`"${word}" функцийг calculator танихгүй байна.`);
    }

    if (character === "(" || character === ")") {
      tokens.push({ type: "paren", value: character });
      index += 1;
      continue;
    }

    if (character === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }

    if ("+-*/%^!".includes(character)) {
      tokens.push({
        type: "operator",
        value: character as Exclude<CalculatorOperator, "u+" | "u-">,
      });
      index += 1;
      continue;
    }

    throw new Error(`"${character}" тэмдэгт зөвшөөрөгдөхгүй.`);
  }

  const result: CalculatorToken[] = [];

  for (const [tokenIndex, token] of tokens.entries()) {
    if (tokenIndex === 0) {
      result.push(token);
      continue;
    }

    const previousToken = tokens[tokenIndex - 1];

    if (needsImplicitMultiplication(previousToken, token)) {
      result.push({ type: "operator", value: "*" });
    }

    result.push(token);
  }

  return result;
}

function getCalculatorOperatorPrecedence(operator: CalculatorOperator) {
  switch (operator) {
    case "!":
      return 5;
    case "^":
      return 4;
    case "u+":
    case "u-":
      return 3;
    case "*":
    case "/":
    case "%":
      return 2;
    case "+":
    case "-":
      return 1;
  }
}

function isRightAssociativeOperator(operator: CalculatorOperator) {
  return operator === "^" || operator === "u+" || operator === "u-";
}

function toCalculatorRpn(tokens: CalculatorToken[]) {
  const output: CalculatorToken[] = [];
  const stack: CalculatorToken[] = [];
  let previousToken: CalculatorToken | null = null;

  for (const token of tokens) {
    if (token.type === "number" || token.type === "constant") {
      output.push(token);
      previousToken = token;
      continue;
    }

    if (token.type === "function") {
      stack.push(token);
      previousToken = token;
      continue;
    }

    if (token.type === "comma") {
      while (stack.length > 0) {
        const topToken = stack[stack.length - 1];

        if (topToken.type === "paren" && topToken.value === "(") {
          break;
        }

        output.push(stack.pop()!);
      }

      if (stack.length === 0) {
        throw new Error("Хаалт эсвэл аргументын бүтэц буруу байна.");
      }

      previousToken = token;
      continue;
    }

    if (token.type === "paren" && token.value === "(") {
      stack.push(token);
      previousToken = token;
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      while (stack.length > 0) {
        const topToken = stack[stack.length - 1];

        if (topToken.type === "paren" && topToken.value === "(") {
          break;
        }

        output.push(stack.pop()!);
      }

      if (stack.length === 0) {
        throw new Error("Хаалт буруу байна.");
      }

      stack.pop();

      if (stack[stack.length - 1]?.type === "function") {
        output.push(stack.pop()!);
      }

      previousToken = token;
      continue;
    }

    if (token.type === "operator") {
      const shouldTreatAsUnary: boolean =
        (token.value === "+" || token.value === "-") &&
        (!previousToken ||
          previousToken.type === "comma" ||
          previousToken.type === "function" ||
          previousToken.type === "operator" ||
          (previousToken.type === "paren" && previousToken.value === "("));
      const currentToken: CalculatorToken = shouldTreatAsUnary
        ? {
            type: "operator",
            value: token.value === "+" ? "u+" : "u-",
          }
        : token;

      while (stack.length > 0) {
        const topToken = stack[stack.length - 1];

        if (topToken.type === "function") {
          output.push(stack.pop()!);
          continue;
        }

        if (topToken.type !== "operator") {
          break;
        }

        const currentPrecedence = getCalculatorOperatorPrecedence(
          currentToken.value,
        );
        const topPrecedence = getCalculatorOperatorPrecedence(topToken.value);
        const shouldPop = isRightAssociativeOperator(currentToken.value)
          ? topPrecedence > currentPrecedence
          : topPrecedence >= currentPrecedence;

        if (!shouldPop) {
          break;
        }

        output.push(stack.pop()!);
      }

      stack.push(currentToken);
      previousToken = currentToken;
    }
  }

  while (stack.length > 0) {
    const topToken = stack.pop()!;

    if (topToken.type === "paren") {
      throw new Error("Хаалтаа гүйцээж бичнэ үү.");
    }

    output.push(topToken);
  }

  return output;
}

function toRadians(value: number, angleMode: CalculatorAngleMode) {
  return angleMode === "deg" ? (value * Math.PI) / 180 : value;
}

function fromRadians(value: number, angleMode: CalculatorAngleMode) {
  return angleMode === "deg" ? (value * 180) / Math.PI : value;
}

function calculateFactorial(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("n! зөвхөн 0-ээс их бүхэл тоон дээр ажиллана.");
  }

  if (value > 170) {
    throw new Error("Хэт том factorial бодож чадсангүй.");
  }

  let result = 1;

  for (let current = 2; current <= value; current += 1) {
    result *= current;
  }

  return result;
}

function applyCalculatorFunction(
  fn: CalculatorFunctionName,
  value: number,
  angleMode: CalculatorAngleMode,
) {
  let result: number;

  switch (fn) {
    case "sin":
      result = Math.sin(toRadians(value, angleMode));
      break;
    case "cos":
      result = Math.cos(toRadians(value, angleMode));
      break;
    case "tan":
      result = Math.tan(toRadians(value, angleMode));
      break;
    case "asin":
      result = fromRadians(Math.asin(value), angleMode);
      break;
    case "acos":
      result = fromRadians(Math.acos(value), angleMode);
      break;
    case "atan":
      result = fromRadians(Math.atan(value), angleMode);
      break;
    case "sqrt":
      result = Math.sqrt(value);
      break;
    case "ln":
      result = Math.log(value);
      break;
    case "log":
      result = Math.log10(value);
      break;
    case "abs":
      result = Math.abs(value);
      break;
    case "exp":
      result = Math.exp(value);
      break;
  }

  if (!Number.isFinite(result)) {
    throw new Error(`${fn} функцийг энэ утгад бодож чадсангүй.`);
  }

  return result;
}

function evaluateCalculatorExpression(
  expression: string,
  angleMode: CalculatorAngleMode,
  lastResult: number | null,
) {
  const tokens = tokenizeCalculatorExpression(expression);

  if (tokens.length === 0) {
    return null;
  }

  const rpnTokens = toCalculatorRpn(tokens);
  const stack: number[] = [];

  for (const token of rpnTokens) {
    if (token.type === "number") {
      stack.push(token.value);
      continue;
    }

    if (token.type === "constant") {
      if (token.value === "pi") {
        stack.push(Math.PI);
        continue;
      }

      if (token.value === "e") {
        stack.push(Math.E);
        continue;
      }

      if (lastResult === null) {
        throw new Error("Өмнөх хариу алга. Эхлээд нэг бодлого бодно уу.");
      }

      stack.push(lastResult);
      continue;
    }

    if (token.type === "function") {
      const value = stack.pop();

      if (value === undefined) {
        throw new Error("Функцийн оролт дутуу байна.");
      }

      stack.push(applyCalculatorFunction(token.value, value, angleMode));
      continue;
    }

    if (token.type !== "operator") {
      throw new Error("Тооцооллын бүтэц буруу байна.");
    }

    if (token.value === "u+" || token.value === "u-" || token.value === "!") {
      const value = stack.pop();

      if (value === undefined) {
        throw new Error("Unary үйлдлийн оролт дутуу байна.");
      }

      if (token.value === "u+") {
        stack.push(value);
        continue;
      }

      if (token.value === "u-") {
        stack.push(-value);
        continue;
      }

      stack.push(calculateFactorial(value));
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();

    if (left === undefined || right === undefined) {
      throw new Error("Тооцооллын илэрхийлэл дутуу байна.");
    }

    let nextValue: number;

    switch (token.value) {
      case "+":
        nextValue = left + right;
        break;
      case "-":
        nextValue = left - right;
        break;
      case "*":
        nextValue = left * right;
        break;
      case "/":
        if (right === 0) {
          throw new Error("0-ээр хувааж болохгүй.");
        }

        nextValue = left / right;
        break;
      case "%":
        if (right === 0) {
          throw new Error("0-ээр үлдэгдэл бодож болохгүй.");
        }

        nextValue = left % right;
        break;
      case "^":
        nextValue = left ** right;
        break;
      default:
        throw new Error("Танигдаагүй үйлдэл байна.");
    }

    if (!Number.isFinite(nextValue)) {
      throw new Error("Тооцооллыг гүйцэтгэж чадсангүй.");
    }

    stack.push(nextValue);
  }

  if (stack.length !== 1) {
    throw new Error("Илэрхийлэл буруу байна.");
  }

  return stack[0];
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

function CalculatorLauncher({
  onOpen,
}: CalculatorLauncherProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#b9d8ed] bg-white px-4 py-3 text-sm font-semibold text-[#1e6d99] shadow-[0_8px_18px_rgba(148,163,184,0.12)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
    >
      <Calculator className="h-4 w-4" />
      Calculator
    </button>
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
  const answerTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>(
    {},
  );
  const answerSelectionRefs = useRef<
    Record<string, { end: number; start: number }>
  >({});
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
  const [calculatorAngleMode, setCalculatorAngleMode] =
    useState<CalculatorAngleMode>("deg");
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calculatorExpression, setCalculatorExpression] = useState("");
  const [calculatorLastResult, setCalculatorLastResult] = useState<number | null>(
    null,
  );
  const [calculatorResult, setCalculatorResult] = useState("");
  const [calculatorError, setCalculatorError] = useState<string | null>(null);

  const normalizePlainAnswer = (value: string) => value.replace(/\r\n/g, "\n");

  const syncAnswerTextareaHeight = (questionId: string) => {
    const textarea = answerTextareaRefs.current[questionId];

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 112)}px`;
  };

  const storeAnswerSelection = (questionId: string) => {
    const textarea = answerTextareaRefs.current[questionId];

    if (!textarea) {
      return;
    }

    answerSelectionRefs.current[questionId] = {
      end: textarea.selectionEnd ?? textarea.value.length,
      start: textarea.selectionStart ?? textarea.value.length,
    };
  };

  const focusAnswerTextarea = (
    questionId: string,
    selection?: { end: number; start: number },
  ) => {
    requestAnimationFrame(() => {
      const textarea = answerTextareaRefs.current[questionId];

      if (!textarea) {
        return;
      }

      textarea.focus();

      if (selection) {
        textarea.setSelectionRange(selection.start, selection.end);
        answerSelectionRefs.current[questionId] = selection;
      }

      syncAnswerTextareaHeight(questionId);
    });
  };

  const insertIntoAnswer = (
    questionId: string,
    insertedValue: string,
    moveLeftAfterWrite = 0,
  ) => {
    const currentValue = normalizePlainAnswer(answers[questionId] ?? "");
    const textarea = answerTextareaRefs.current[questionId];
    const fallbackIndex = currentValue.length;
    const selection =
      answerSelectionRefs.current[questionId] ?? {
        end: textarea?.selectionEnd ?? fallbackIndex,
        start: textarea?.selectionStart ?? fallbackIndex,
      };

    const nextValue =
      currentValue.slice(0, selection.start) +
      insertedValue +
      currentValue.slice(selection.end);
    const nextCaret = Math.max(
      selection.start,
      selection.start + insertedValue.length - moveLeftAfterWrite,
    );

    onSelectAnswer(questionId, nextValue);
    focusAnswerTextarea(questionId, {
      end: nextCaret,
      start: nextCaret,
    });
  };

  const moveAnswerCursor = (questionId: string, direction: "left" | "right") => {
    const currentValue = normalizePlainAnswer(answers[questionId] ?? "");
    const textarea = answerTextareaRefs.current[questionId];
    const fallbackIndex = currentValue.length;
    const baseSelection =
      answerSelectionRefs.current[questionId] ?? {
        end: textarea?.selectionEnd ?? fallbackIndex,
        start: textarea?.selectionStart ?? fallbackIndex,
      };
    const anchor =
      direction === "left"
        ? Math.min(baseSelection.start, baseSelection.end)
        : Math.max(baseSelection.start, baseSelection.end);
    const nextCaret =
      direction === "left"
        ? Math.max(0, anchor - 1)
        : Math.min(currentValue.length, anchor + 1);

    focusAnswerTextarea(questionId, {
      end: nextCaret,
      start: nextCaret,
    });
  };

  const resetCalculatorFeedback = () => {
    setCalculatorError(null);
    setCalculatorResult("");
  };

  const openCalculator = () => {
    setIsCalculatorOpen(true);
  };

  const appendCalculatorValue = (value: string) => {
    resetCalculatorFeedback();
    setCalculatorExpression((current) => `${current}${value}`);
  };

  const handleCalculatorBackspace = () => {
    resetCalculatorFeedback();
    setCalculatorExpression((current) => current.slice(0, -1));
  };

  const handleCalculatorClear = () => {
    setCalculatorExpression("");
    resetCalculatorFeedback();
  };

  const handleCalculatorEvaluate = () => {
    try {
      const nextResult = evaluateCalculatorExpression(
        calculatorExpression,
        calculatorAngleMode,
        calculatorLastResult,
      );

      if (nextResult === null) {
        resetCalculatorFeedback();
        return;
      }

      setCalculatorLastResult(nextResult);
      setCalculatorResult(formatCalculatorResult(nextResult));
      setCalculatorError(null);
    } catch (error) {
      setCalculatorResult("");
      setCalculatorError(
        error instanceof Error ? error.message : "Тооцоолол буруу байна.",
      );
    }
  };

  useEffect(() => {
    setActiveQuestionId(attempt.exam.questions[0]?.questionId ?? null);
  }, [attempt.attemptId, attempt.exam.questions]);

  useEffect(() => {
    for (const question of attempt.exam.questions) {
      if (question.type === "math") {
        syncAnswerTextareaHeight(question.questionId);
      }
    }
  }, [answers, attempt.exam.questions]);

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

              <div className="mt-3">
                <CalculatorLauncher onOpen={openCalculator} />
              </div>
            </div>
          </aside>

          <div className="order-2 space-y-3 lg:order-1 lg:space-y-6">
            {attempt.exam.questions.map((question, index) => {
              const selectedOptionId = answers[question.questionId];
              const isFlagged = Boolean(flaggedQuestions[question.questionId]);
              const activeInputMode =
                activeInputModeByQuestion[question.questionId] ?? "none";
              const isKeyboardInputActive = activeInputMode === "keyboard";

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
                          type="button"
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
                          <div
                            className={`rounded-[18px] border bg-white px-3 py-2.5 shadow-[0_10px_24px_rgba(148,163,184,0.10)] transition sm:rounded-[24px] sm:px-4 sm:py-3 ${
                              isKeyboardInputActive
                                ? "border-sky-300 bg-sky-50/40"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="min-h-24 sm:min-h-28">
                              <textarea
                                ref={(node) => {
                                  answerTextareaRefs.current[question.questionId] = node;
                                }}
                                value={selectedOptionId ?? ""}
                                onChange={(event) =>
                                  onSelectAnswer(
                                    question.questionId,
                                    normalizePlainAnswer(event.target.value),
                                  )
                                }
                                onFocus={() => {
                                  onQuestionInteract?.();
                                  storeAnswerSelection(question.questionId);
                                  syncAnswerTextareaHeight(question.questionId);
                                }}
                                onClick={() => storeAnswerSelection(question.questionId)}
                                onKeyUp={() => storeAnswerSelection(question.questionId)}
                                onSelect={() => storeAnswerSelection(question.questionId)}
                                onInput={() =>
                                  syncAnswerTextareaHeight(question.questionId)
                                }
                                onKeyDown={(event) => {
                                  onQuestionInteract?.();

                                  if (event.key === "Enter") {
                                    event.stopPropagation();
                                  }
                                }}
                                placeholder="Хариугаа энд шууд бичнэ үү..."
                                spellCheck={false}
                                className="min-h-24 w-full resize-none overflow-hidden border-0 bg-transparent text-[13px] leading-6 text-slate-900 caret-slate-900 outline-none placeholder:text-slate-400 selection:bg-sky-200/60 sm:min-h-28 sm:text-sm sm:leading-7"
                              />
                            </div>
                            <p className="mt-2 text-[11px] font-medium text-slate-500 sm:text-xs">
                              Энд энгийн текст эсвэл LaTeX-ээ бичнэ. Доорх
                              Keyboard дээрээс тэмдэгт, томьёо нэмж болно.
                            </p>
                            {isKeyboardInputActive && selectedOptionId?.trim() ? (
                              <div className="mt-3 rounded-[16px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:rounded-[18px] sm:px-4 sm:py-3">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">
                                  Томьёоны харагдац
                                </p>
                                <MathText
                                  as="div"
                                  className="text-[13px] leading-6 text-slate-900 sm:text-sm sm:leading-7"
                                  text={selectedOptionId}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const nextMode =
                                  activeInputMode === "keyboard"
                                    ? "none"
                                    : "keyboard";

                                setActiveInputModeByQuestion((prev) => ({
                                  ...prev,
                                  [question.questionId]: nextMode,
                                }));
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${
                                activeInputMode === "keyboard"
                                  ? "border-sky-300 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <Keyboard className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              {activeInputMode === "keyboard" ? (
                                <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              ) : (
                                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              )}
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
                              mode="palette"
                              onInsertLatex={(nextValue, moveLeftAfterWrite) =>
                                insertIntoAnswer(
                                  question.questionId,
                                  nextValue,
                                  moveLeftAfterWrite,
                                )
                              }
                              onInsertSystemLine={() =>
                                insertIntoAnswer(question.questionId, "\n")
                              }
                              onMoveLeft={() =>
                                moveAnswerCursor(question.questionId, "left")
                              }
                              onMoveRight={() =>
                                moveAnswerCursor(question.questionId, "right")
                              }
                              onClear={() => {
                                onSelectAnswer(question.questionId, "");
                                focusAnswerTextarea(question.questionId, {
                                  end: 0,
                                  start: 0,
                                });
                              }}
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
                                                ? "bg-[#27a7ea] text-white"
                                                : "text-slate-600 hover:bg-white hover:text-sky-700"
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
                              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#18b8ff] px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(24,184,255,0.28)] transition hover:bg-[#07a9f0] disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:text-sm lg:w-auto"
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
                <div className="mt-3">
                  <CalculatorLauncher onOpen={openCalculator} />
                </div>
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

      <Dialog
        open={isCalculatorOpen}
        onOpenChange={(open) => {
          setIsCalculatorOpen(open);

          if (!open) {
            setCalculatorError(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100vw-1.5rem)] border-slate-200 bg-white p-0 sm:max-w-2xl">
          <DialogHeader className="px-4 py-3">
            <div className="flex items-center justify-between gap-3 pr-10">
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <Calculator className="h-5 w-5 text-sky-600" />
                Тооны машин
              </DialogTitle>

              <div className="mr-2 inline-flex rounded-full border border-sky-200 bg-sky-50 p-1">
                {(["deg", "rad"] as const).map((mode) => {
                  const isActive = calculatorAngleMode === mode;

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCalculatorAngleMode(mode)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "bg-sky-600 text-white"
                          : "text-sky-700 hover:bg-white/80"
                      }`}
                    >
                      {mode.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-4 pb-4">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
              <input
                type="text"
                inputMode="text"
                value={calculatorExpression}
                onChange={(event) => {
                  resetCalculatorFeedback();
                  setCalculatorExpression(
                    sanitizeCalculatorInput(event.target.value),
                  );
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCalculatorEvaluate();
                  }
                }}
                placeholder="Жишээ: sin(45)"
                className="h-10 w-full border-0 bg-transparent text-right text-xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400"
              />

              <div className="mt-2 flex min-h-5 items-center justify-end">
                {calculatorError ? (
                  <p className="text-xs font-medium text-rose-600 sm:ml-auto">
                    {calculatorError}
                  </p>
                ) : calculatorResult ? (
                  <p className="text-sm font-semibold text-sky-700 sm:ml-auto">
                    = {calculatorResult}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 sm:ml-auto">
                    Enter дарж эсвэл доорх `=` товчоор бодно.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {SCIENTIFIC_CALCULATOR_BUTTONS.flat().map((button) => {
                const toneClasses =
                  button.tone === "action"
                    ? "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : button.tone === "accent"
                      ? "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100"
                      : "border-slate-200 bg-white text-slate-900 hover:border-sky-200 hover:bg-sky-50";

                return (
                  <button
                    key={`${button.label}-${button.value}`}
                    type="button"
                    onClick={() => {
                      if (button.value === "__clear__") {
                        handleCalculatorClear();
                        return;
                      }

                      if (button.value === "__backspace__") {
                        handleCalculatorBackspace();
                        return;
                      }

                      appendCalculatorValue(button.value);
                    }}
                    className={`inline-flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold transition ${toneClasses}`}
                    aria-label={button.ariaLabel ?? button.label}
                  >
                    {button.label === "⌫" ? (
                      <Delete className="h-4 w-4" />
                    ) : button.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <button
                type="button"
                onClick={handleCalculatorClear}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Цэвэрлэх
              </button>
              <button
                type="button"
                onClick={handleCalculatorEvaluate}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-[#27a7ea] bg-[#27a7ea] text-lg font-bold text-white transition hover:bg-[#1199de]"
                aria-label="Хариуг бодох"
              >
                =
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
