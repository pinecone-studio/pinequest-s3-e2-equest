import type { GeneratorSettings, ExamQuestion } from "@/lib/math-exam-model";
import { createMathQuestion, createMcqQuestion } from "@/lib/math-exam-model";

type Difficulty = GeneratorSettings["difficulty"];

type DemoExam = {
  title: string;
  settings: Pick<
    GeneratorSettings,
    "difficulty" | "mcqCount" | "mathCount" | "totalPoints" | "topics" | "sourceContext"
  >;
  questions: ExamQuestion[];
};

type DemoGrade = 7 | 8 | 9 | 10 | 11 | 12;

type Ranges = {
  quadraticRootAbsMax: number;
  linearCoeffAbsMax: number;
  linearBiasAbsMax: number;
  discriminantCoeffAbsMax: number;
};

type GradeConfig = {
  grade: DemoGrade;
  difficulty: Difficulty;
  topics: string;
  ranges: Ranges;
  templates: {
    mcq: Array<() => ReturnType<typeof createMcqQuestion>>;
    math: Array<() => ReturnType<typeof createMathQuestion>>;
  };
};

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

function template_quadraticIntegerRoots(ranges: Ranges) {
  const rootMax = ranges.quadraticRootAbsMax;
  const r1 = randInt(-rootMax, rootMax) || 2;
  const r2 = randInt(-rootMax, rootMax) || -3;
  const sum = r1 + r2;
  const prod = r1 * r2;
  const prompt = `Дараах тэгшитгэлийг бод. $x^2 ${sum < 0 ? `+ ${Math.abs(sum)}` : `- ${sum}`}x ${prod < 0 ? `- ${Math.abs(prod)}` : `+ ${prod}`} = 0$`;
  const correct = `$x=${toSigned(r1)},${toSigned(r2)}$`;
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [
      `$x=${toSigned(r1 + 1)},${toSigned(r2)}$`,
      `$x=${toSigned(r1)},${toSigned(r2 + 1)}$`,
      `$x=${toSigned(-r1)},${toSigned(-r2)}$`,
      `$x=${toSigned(r1)},${toSigned(-r2)}$`,
    ],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_pythagorean() {
  const triple = sampleOne([
    { a: 3, b: 4, c: 5 },
    { a: 5, b: 12, c: 13 },
    { a: 8, b: 15, c: 17 },
    { a: 7, b: 24, c: 25 },
  ]);
  const prompt = `Пифагорын теоремоор $a=${triple.a}$, $b=${triple.b}$ бол гипотенуз $c$ хэд вэ?`;
  const correct = `$c=${triple.c}$`;
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [
      `$c=${triple.c + 1}$`,
      `$c=${triple.c + 2}$`,
      `$c=${Math.max(1, triple.c - 1)}$`,
      `$c=${triple.a + triple.b}$`,
    ],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_simplifySqrt() {
  const m = randInt(2, 9);
  const n = sampleOne([2, 3, 5, 6, 7, 10]);
  const radicand = m * m * n;
  const prompt = `Илэрхийллийг хялбарчил. $\\sqrt{${radicand}}$`;
  const correct = `$${m}\\sqrt{${n}}$`;
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [
      `$${m}\\sqrt{${n + 1}}$`,
      `$${m + 1}\\sqrt{${n}}$`,
      `$\\sqrt{${radicand}}$`,
      `$${m * n}\\sqrt{${n}}$`,
    ],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_linearFunctionValue(ranges: Ranges) {
  const a = randInt(-ranges.linearCoeffAbsMax, ranges.linearCoeffAbsMax) || 2;
  const b = randInt(-ranges.linearBiasAbsMax, ranges.linearBiasAbsMax);
  const x0 = randInt(-4, 6);
  const y0 = a * x0 + b;
  const prompt = `Функц $y=${a}x${b < 0 ? `-${Math.abs(b)}` : `+${b}`}$ үед $x=${x0}$ бол $y$ хэд вэ?`;
  const correct = String(y0);
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [
      String(y0 + 1),
      String(y0 - 1),
      String(y0 + a),
      String(y0 - a),
    ],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_discriminant(ranges: Ranges) {
  const aQ = 1;
  const bQ = randInt(-ranges.discriminantCoeffAbsMax, ranges.discriminantCoeffAbsMax) || -4;
  const cQ = randInt(-ranges.discriminantCoeffAbsMax, ranges.discriminantCoeffAbsMax) || 1;
  const D = bQ * bQ - 4 * aQ * cQ;
  const prompt = `Квадрат тэгшитгэлийн дискриминант $D=b^2-4ac$ бол $x^2${bQ < 0 ? `${bQ}x` : `+${bQ}x`}${cQ < 0 ? `${cQ}` : `+${cQ}`}=0$ үед $D$ хэд вэ?`;
  const correct = `$${D}$`;
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [`$${D + 4}$`, `$${D - 4}$`, `$${bQ * bQ}$`, `$${-D}$`],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_logBasic() {
  let base = sampleOne([2, 3, 4, 5, 10]);
  let exponent = randInt(1, 6);
  let value = Math.pow(base, exponent);

  // Avoid the same classic example showing up too often (5^4 = 625).
  // Keep it bounded to a few retries so we never loop indefinitely.
  for (let i = 0; i < 6 && value === 625; i += 1) {
    base = sampleOne([2, 3, 4, 5, 10]);
    exponent = randInt(1, 6);
    value = Math.pow(base, exponent);
  }
  const prompt = `Логарифмыг ол. $\\log_{${base}} ${value}$`;
  const correct = `$${exponent}$`;
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [`$${exponent + 1}$`, `$${Math.max(0, exponent - 1)}$`, `$${base}$`, `$${value}$`],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_exponentRules() {
  const a = randInt(-6, 8);
  const b = randInt(-6, 8);
  const c = randInt(-6, 8);
  const expr = `2^{${a}}\\cdot 2^{${b}}:2^{${c}}`;
  const result = a + b - c;
  const prompt = `Илэрхийллийг хялбарчил. $${expr}$`;
  const correct = `$2^{${result}}$`;
  const { options, correctOption } = mcqWithShuffledOptions({
    prompt,
    correct,
    distractors: [
      `$2^{${a - b - c}}$`,
      `$2^{${a + b + c}}$`,
      `$2^{${a - b + c}}$`,
      `$2^{${a + b - c + 1}}$`,
    ],
  });
  return createMcqQuestion({ prompt, options, correctOption, points: 1 });
}

function template_mathSolveQuadratic(ranges: Ranges) {
  const rootMax = ranges.quadraticRootAbsMax;
  const s1 = randInt(-rootMax, rootMax) || 3;
  const s2 = randInt(-rootMax, rootMax) || -1;
  const sSum = s1 + s2;
  const sProd = s1 * s2;
  const prompt = `Задгай: Дараах тэгшитгэлийг бодож, хариуг хялбарчил. $x^2 ${sSum < 0 ? `+ ${Math.abs(sSum)}` : `- ${sSum}`}x ${sProd < 0 ? `- ${Math.abs(sProd)}` : `+ ${sProd}`} = 0$`;
  const rootsSorted = [s1, s2].sort((a, b) => b - a);
  const answerLatex = `x = ${toSigned(rootsSorted[0] ?? s1)},\\,${toSigned(rootsSorted[1] ?? s2)}`;
  return createMathQuestion({
    prompt,
    points: 1,
    responseGuide: "Бодолтын алхмуудаа бичээд, эцсийн хариуг $...$ хэлбэрээр өг.",
    answerLatex,
  });
}

function buildGradeConfig(grade: DemoGrade): GradeConfig {
  // Keep topics/difficulty roughly aligned with actual school progression.
  // Templates are selected from a per-grade pool to keep wording & structure realistic.
  const base: Omit<GradeConfig, "grade" | "difficulty" | "topics" | "ranges" | "templates"> = {
    templates: { mcq: [], math: [] },
  };

  if (grade === 7) {
    const ranges: Ranges = {
      quadraticRootAbsMax: 4,
      linearCoeffAbsMax: 4,
      linearBiasAbsMax: 8,
      discriminantCoeffAbsMax: 6,
    };
    return {
      ...base,
      grade,
      difficulty: "easy",
      topics: "Шугаман функц, Пифагорын теорем, квадрат язгуур",
      ranges,
      templates: {
        mcq: [
          () => template_linearFunctionValue(ranges),
          () => template_pythagorean(),
          () => template_simplifySqrt(),
          () => template_discriminant(ranges),
          () => template_quadraticIntegerRoots(ranges),
        ],
        math: [() => template_mathSolveQuadratic(ranges)],
      },
    };
  }

  if (grade === 8) {
    const ranges: Ranges = {
      quadraticRootAbsMax: 5,
      linearCoeffAbsMax: 5,
      linearBiasAbsMax: 10,
      discriminantCoeffAbsMax: 7,
    };
    return {
      ...base,
      grade,
      difficulty: "medium",
      topics: "Квадрат язгуур, Пифагорын теорем, илэрхийлэл хялбарчлах",
      ranges,
      templates: {
        mcq: [
          () => template_simplifySqrt(),
          () => template_pythagorean(),
          () => template_linearFunctionValue(ranges),
          () => template_discriminant(ranges),
          () => template_quadraticIntegerRoots(ranges),
        ],
        math: [() => template_mathSolveQuadratic(ranges)],
      },
    };
  }

  if (grade === 9) {
    const ranges: Ranges = {
      quadraticRootAbsMax: 6,
      linearCoeffAbsMax: 5,
      linearBiasAbsMax: 10,
      discriminantCoeffAbsMax: 8,
    };
    return {
      ...base,
      grade,
      difficulty: "medium",
      topics: "Квадрат тэгшитгэл, Пифагорын теорем, квадрат язгуур",
      ranges,
      templates: {
        mcq: [
          () => template_quadraticIntegerRoots(ranges),
          () => template_discriminant(ranges),
          () => template_simplifySqrt(),
          () => template_linearFunctionValue(ranges),
          () => template_pythagorean(),
        ],
        math: [() => template_mathSolveQuadratic(ranges)],
      },
    };
  }

  if (grade === 10) {
    const ranges: Ranges = {
      quadraticRootAbsMax: 7,
      linearCoeffAbsMax: 6,
      linearBiasAbsMax: 12,
      discriminantCoeffAbsMax: 9,
    };
    return {
      ...base,
      grade,
      difficulty: "advanced",
      topics: "Квадрат тэгшитгэл, дискриминант, функц",
      ranges,
      templates: {
        mcq: [
          () => template_discriminant(ranges),
          () => template_quadraticIntegerRoots(ranges),
          () => template_linearFunctionValue(ranges),
          () => template_simplifySqrt(),
          () => template_pythagorean(),
        ],
        math: [() => template_mathSolveQuadratic(ranges)],
      },
    };
  }

  if (grade === 11) {
    const ranges: Ranges = {
      quadraticRootAbsMax: 8,
      linearCoeffAbsMax: 7,
      linearBiasAbsMax: 14,
      discriminantCoeffAbsMax: 10,
    };
    return {
      ...base,
      grade,
      difficulty: "advanced",
      topics: "Квадрат тэгшитгэл, функц, геометр",
      ranges,
      templates: {
        mcq: [
          () => template_pythagorean(),
          () => template_discriminant(ranges),
          () => template_quadraticIntegerRoots(ranges),
          () => template_linearFunctionValue(ranges),
          () => template_simplifySqrt(),
        ],
        math: [() => template_mathSolveQuadratic(ranges)],
      },
    };
  }

  // grade === 12
  const ranges: Ranges = {
    quadraticRootAbsMax: 9,
    linearCoeffAbsMax: 8,
    linearBiasAbsMax: 16,
    discriminantCoeffAbsMax: 12,
  };
  return {
    ...base,
    grade,
    difficulty: "advanced",
    topics: "Квадрат тэгшитгэл, функц, геометр",
    ranges,
    templates: {
      mcq: [
        () => template_pythagorean(),
        () => template_discriminant(ranges),
        () => template_quadraticIntegerRoots(ranges),
        () => template_linearFunctionValue(ranges),
        () => template_simplifySqrt(),
      ],
      math: [() => template_mathSolveQuadratic(ranges)],
    },
  };
}

export function generateDemoExam(): DemoExam {
  const grade = sampleOne([7, 8, 9, 10, 11, 12] as const);
  const config = buildGradeConfig(grade);

  // Pick 5 MCQ templates without repeating the same template function too often.
  const mcqTemplates = shuffle(config.templates.mcq).slice(0, 5);
  while (mcqTemplates.length < 5) {
    mcqTemplates.push(sampleOne(config.templates.mcq));
  }

  const mathTemplate = sampleOne(config.templates.math);

  const questions: ExamQuestion[] = [
    ...mcqTemplates.map((fn) => fn()),
    mathTemplate(),
  ];

  return {
    title: `${config.grade}-р анги — Математик`,
    settings: {
      difficulty: config.difficulty,
      mcqCount: 5,
      mathCount: 1,
      totalPoints: 6,
      topics: config.topics,
      sourceContext: "",
    },
    questions,
  };
}

