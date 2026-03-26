"use client";

import { Button } from "@/components/ui/button";

import type { ExamQuestion, GeneratorSettings } from "@/lib/math-exam-model";
import { createMathQuestion, createMcqQuestion } from "@/lib/math-exam-model";
import type { Dispatch, SetStateAction } from "react";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleOne<T>(items: T[]) {
  return items[randInt(0, items.length - 1)] as T;
}

function shuffle<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function toSigned(n: number) {
  return n < 0 ? `-${Math.abs(n)}` : String(n);
}

type DemoGradeConfig = {
  grade: number;
  difficulty: GeneratorSettings["difficulty"];
  topics: string;
  ranges: {
    quadraticRootAbsMax: number;
    linearCoeffAbsMax: number;
    linearBiasAbsMax: number;
    discriminantCoeffAbsMax: number;
  };
};

function pickDemoGrade(): DemoGradeConfig {
  const grade = sampleOne([7, 8, 9, 10, 11, 12]);

  switch (grade) {
    case 7:
      return {
        grade,
        difficulty: "easy",
        topics: "Шугаман функц, Пифагорын теорем, квадрат язгуур",
        ranges: {
          quadraticRootAbsMax: 4,
          linearCoeffAbsMax: 4,
          linearBiasAbsMax: 8,
          discriminantCoeffAbsMax: 6,
        },
      };
    case 8:
      return {
        grade,
        difficulty: "medium",
        topics: "Квадрат язгуур, Пифагорын теорем, илэрхийлэл хялбарчлах",
        ranges: {
          quadraticRootAbsMax: 5,
          linearCoeffAbsMax: 5,
          linearBiasAbsMax: 10,
          discriminantCoeffAbsMax: 7,
        },
      };
    case 10:
      return {
        grade,
        difficulty: "advanced",
        topics: "Квадрат тэгшитгэл, дискриминант, функц",
        ranges: {
          quadraticRootAbsMax: 7,
          linearCoeffAbsMax: 6,
          linearBiasAbsMax: 12,
          discriminantCoeffAbsMax: 9,
        },
      };
    case 11:
      return {
        grade,
        difficulty: "advanced",
        topics: "Квадрат тэгшитгэл, функц, дискриминант",
        ranges: {
          quadraticRootAbsMax: 8,
          linearCoeffAbsMax: 7,
          linearBiasAbsMax: 14,
          discriminantCoeffAbsMax: 10,
        },
      };
    case 12:
      return {
        grade,
        difficulty: "advanced",
        topics: "Квадрат тэгшитгэл, функц, дискриминант",
        ranges: {
          quadraticRootAbsMax: 9,
          linearCoeffAbsMax: 8,
          linearBiasAbsMax: 16,
          discriminantCoeffAbsMax: 12,
        },
      };
    case 9:
    default:
      return {
        grade,
        difficulty: "medium",
        topics: "Квадрат тэгшитгэл, Пифагорын теорем, квадрат язгуур",
        ranges: {
          quadraticRootAbsMax: 6,
          linearCoeffAbsMax: 5,
          linearBiasAbsMax: 10,
          discriminantCoeffAbsMax: 8,
        },
      };
  }
}

function mcqWithShuffledOptions(args: {
  prompt: string;
  correct: string;
  distractors: string[];
}) {
  const optionsRaw = uniq([args.correct, ...args.distractors]).slice(0, 6);
  const options = shuffle(optionsRaw);
  const correctOption = options.findIndex((o) => o === args.correct);
  return { options, correctOption };
}

type DemoButtonProps = {
  onDemo: () => void;
  className?: string;
  disabled?: boolean;
};

export function DemoButton({ onDemo, ...props }: DemoButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={onDemo} {...props}>
      Demo
    </Button>
  );
}

type RunMathExamDemoArgs = {
  setGeneratorError: Dispatch<SetStateAction<string>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setSavedExamId: Dispatch<SetStateAction<string | null>>;
  setIsGeneratorOpen: Dispatch<SetStateAction<boolean>>;
  setSourceFiles: Dispatch<SetStateAction<File[]>>;
  setExamTitle: Dispatch<SetStateAction<string>>;
  setGeneratorSettings: Dispatch<SetStateAction<GeneratorSettings>>;
  setQuestions: Dispatch<SetStateAction<ExamQuestion[]>>;
  resetSectionState: () => void;
};

export function runMathExamDemo({
  setGeneratorError,
  setSaveError,
  setSavedExamId,
  setIsGeneratorOpen,
  setSourceFiles,
  setExamTitle,
  setGeneratorSettings,
  setQuestions,
  resetSectionState,
}: RunMathExamDemoArgs) {
  setGeneratorError("");
  setSaveError(null);
  setSavedExamId(null);
  setIsGeneratorOpen(false);
  setSourceFiles([]);

  const demoGrade = pickDemoGrade();

  setExamTitle(`${demoGrade.grade}-р анги — Математик`);
  setGeneratorSettings((current) => ({
    ...current,
    difficulty: demoGrade.difficulty,
    mcqCount: 5,
    mathCount: 1,
    totalPoints: 6,
    topics: demoGrade.topics,
    sourceContext: "",
  }));

  // Q1: Quadratic with integer roots (monic).
  const rootMax = demoGrade.ranges.quadraticRootAbsMax;
  const r1 = randInt(-rootMax, rootMax) || 2;
  const r2 = randInt(-rootMax, rootMax) || -3;
  const sum = r1 + r2;
  const prod = r1 * r2;
  const q1Prompt = `Дараах тэгшитгэлийг бод. $x^2 ${sum < 0 ? `+ ${Math.abs(sum)}` : `- ${sum}`}x ${prod < 0 ? `- ${Math.abs(prod)}` : `+ ${prod}`} = 0$`;
  const q1Correct = `$x=${toSigned(r1)},${toSigned(r2)}$`;
  const q1 = mcqWithShuffledOptions({
    prompt: q1Prompt,
    correct: q1Correct,
    distractors: [
      `$x=${toSigned(r1 + 1)},${toSigned(r2)}$`,
      `$x=${toSigned(r1)},${toSigned(r2 + 1)}$`,
      `$x=${toSigned(-r1)},${toSigned(-r2)}$`,
      `$x=${toSigned(r1)},${toSigned(-r2)}$`,
    ],
  });

  // Q2: Pythagorean triple.
  const triple = sampleOne([
    { a: 3, b: 4, c: 5 },
    { a: 5, b: 12, c: 13 },
    { a: 8, b: 15, c: 17 },
    { a: 7, b: 24, c: 25 },
  ]);
  const q2Prompt = `Пифагорын теоремоор $a=${triple.a}$, $b=${triple.b}$ бол гипотенуз $c$ хэд вэ?`;
  const q2Correct = `$c=${triple.c}$`;
  const q2 = mcqWithShuffledOptions({
    prompt: q2Prompt,
    correct: q2Correct,
    distractors: [
      `$c=${triple.c + 1}$`,
      `$c=${triple.c + 2}$`,
      `$c=${Math.max(1, triple.c - 1)}$`,
      `$c=${triple.a + triple.b}$`,
    ],
  });

  // Q3: Simplify sqrt(m^2 * n) => m*sqrt(n)
  const m = randInt(2, 9);
  const n = sampleOne([2, 3, 5, 6, 7, 10]);
  const radicand = m * m * n;
  const q3Prompt = `Илэрхийллийг хялбарчил. $\\sqrt{${radicand}}$`;
  const q3Correct = `$${m}\\sqrt{${n}}$`;
  const q3 = mcqWithShuffledOptions({
    prompt: q3Prompt,
    correct: q3Correct,
    distractors: [
      `$${m}\\sqrt{${n + 1}}$`,
      `$${m + 1}\\sqrt{${n}}$`,
      `$\\sqrt{${radicand}}$`,
      `$${m * n}\\sqrt{${n}}$`,
    ],
  });

  // Q4: Linear function evaluation.
  const aLin = randInt(-demoGrade.ranges.linearCoeffAbsMax, demoGrade.ranges.linearCoeffAbsMax) || 2;
  const bLin = randInt(-demoGrade.ranges.linearBiasAbsMax, demoGrade.ranges.linearBiasAbsMax);
  const x0 = randInt(-4, 6);
  const y0 = aLin * x0 + bLin;
  const q4Prompt = `Функц $y=${aLin}x${bLin < 0 ? `-${Math.abs(bLin)}` : `+${bLin}`}$ үед $x=${x0}$ бол $y$ хэд вэ?`;
  const q4Correct = String(y0);
  const q4 = mcqWithShuffledOptions({
    prompt: q4Prompt,
    correct: q4Correct,
    distractors: [String(y0 + 1), String(y0 - 1), String(y0 + aLin), String(y0 - aLin)],
  });

  // Q5: Discriminant.
  const aQ = 1;
  const discMax = demoGrade.ranges.discriminantCoeffAbsMax;
  const bQ = randInt(-discMax, discMax) || -4;
  const cQ = randInt(-discMax, discMax) || 1;
  const D = bQ * bQ - 4 * aQ * cQ;
  const q5Prompt = `Квадрат тэгшитгэлийн дискриминант $D=b^2-4ac$ бол $x^2${bQ < 0 ? `${bQ}x` : `+${bQ}x`}${cQ < 0 ? `${cQ}` : `+${cQ}`}=0$ үед $D$ хэд вэ?`;
  const q5Correct = `$${D}$`;
  const q5 = mcqWithShuffledOptions({
    prompt: q5Prompt,
    correct: q5Correct,
    distractors: [`$${D + 4}$`, `$${D - 4}$`, `$${bQ * bQ}$`, `$${-D}$`],
  });

  // Math: another integer-root quadratic.
  const s1 = randInt(-rootMax, rootMax) || 3;
  const s2 = randInt(-rootMax, rootMax) || -1;
  const sSum = s1 + s2;
  const sProd = s1 * s2;
  const mathPrompt = `Задгай: Дараах тэгшитгэлийг бодож, хариуг хялбарчил. $x^2 ${sSum < 0 ? `+ ${Math.abs(sSum)}` : `- ${sSum}`}x ${sProd < 0 ? `- ${Math.abs(sProd)}` : `+ ${sProd}`} = 0$`;
  const rootsSorted = [s1, s2].sort((a, b) => b - a);
  const mathAnswer = `x = ${toSigned(rootsSorted[0] ?? s1)},\\,${toSigned(rootsSorted[1] ?? s2)}`;

  setQuestions([
    createMcqQuestion({
      prompt: q1Prompt,
      points: 1,
      options: q1.options,
      correctOption: q1.correctOption,
    }),
    createMcqQuestion({
      prompt: q2Prompt,
      points: 1,
      options: q2.options,
      correctOption: q2.correctOption,
    }),
    createMcqQuestion({
      prompt: q3Prompt,
      points: 1,
      options: q3.options,
      correctOption: q3.correctOption,
    }),
    createMcqQuestion({
      prompt: q4Prompt,
      points: 1,
      options: q4.options,
      correctOption: q4.correctOption,
    }),
    createMcqQuestion({
      prompt: q5Prompt,
      points: 1,
      options: q5.options,
      correctOption: q5.correctOption,
    }),
    createMathQuestion({
      prompt: mathPrompt,
      points: 1,
      responseGuide:
        "Бодолтын алхмуудаа бичээд, эцсийн хариуг $...$ хэлбэрээр өг.",
      answerLatex: mathAnswer,
    }),
  ]);

  resetSectionState();
}
