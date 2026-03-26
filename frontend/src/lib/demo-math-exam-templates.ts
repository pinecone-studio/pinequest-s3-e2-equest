import type { GeneratorSettings } from "@/lib/math-exam-model";
import type { QuestionType } from "@/lib/math-exam-contract";

export type DemoExamSpec = {
  title: string;
  settings: Pick<
    GeneratorSettings,
    "difficulty" | "mcqCount" | "mathCount" | "totalPoints" | "topics" | "sourceContext"
  >;
  questions: Array<
    | {
        type: "mcq";
        prompt: string;
        points: number;
        options: string[];
        correctOption: number;
        imageAlt?: string;
      }
    | {
        type: "math";
        prompt: string;
        points: number;
        responseGuide: string;
        answerLatex: string;
        imageAlt?: string;
      }
  >;
};

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
  style: {
    useEnglishLetters: boolean;
  };
};

type Rng = {
  int: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
  shuffle: <T>(items: T[]) => T[];
};

function createRng(): Rng {
  const int = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = <T,>(items: T[]) => items[int(0, items.length - 1)] as T;
  const shuffle = <T,>(items: T[]) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  return { int, pick, shuffle };
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function toSigned(n: number) {
  return n < 0 ? `-${Math.abs(n)}` : String(n);
}

function mcqOptions(rng: Rng, correct: string, distractors: string[], max = 6) {
  const raw = uniq([correct, ...distractors]).slice(0, max);
  const options = rng.shuffle(raw);
  const correctOption = options.findIndex((o) => o === correct);
  return { correctOption, options };
}

function gradeConfigFor(grade: number): DemoGradeConfig {
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
        style: { useEnglishLetters: true },
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
        style: { useEnglishLetters: true },
      };
    case 9:
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
        style: { useEnglishLetters: true },
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
        style: { useEnglishLetters: true },
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
        style: { useEnglishLetters: true },
      };
    case 12:
    default:
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
        style: { useEnglishLetters: true },
      };
  }
}

type TemplateContext = {
  grade: DemoGradeConfig;
  rng: Rng;
};

type GeneratedMcq = {
  type: "mcq";
  prompt: string;
  options: string[];
  correctOption: number;
};

type GeneratedMath = {
  type: "math";
  prompt: string;
  responseGuide: string;
  answerLatex: string;
};

type Template = {
  id: string;
  gradeMin: number;
  gradeMax: number;
  type: QuestionType;
  generate: (ctx: TemplateContext) => GeneratedMcq | GeneratedMath;
};

function inGrade(t: Template, grade: number) {
  return grade >= t.gradeMin && grade <= t.gradeMax;
}

const TEMPLATES: Template[] = [
  {
    id: "mcq-quadratic-integer-roots-v1",
    gradeMin: 8,
    gradeMax: 12,
    type: "mcq",
    generate: ({ grade, rng }) => {
      const rootMax = grade.ranges.quadraticRootAbsMax;
      const r1 = rng.int(-rootMax, rootMax) || 2;
      const r2 = rng.int(-rootMax, rootMax) || -3;
      const sum = r1 + r2;
      const prod = r1 * r2;
      const signSum = sum < 0 ? `+ ${Math.abs(sum)}` : `- ${sum}`;
      const signProd = prod < 0 ? `- ${Math.abs(prod)}` : `+ ${prod}`;

      const prompt = rng.pick([
        `Дараах тэгшитгэлийг бод. $x^2 ${signSum}x ${signProd} = 0$`,
        `Тэгшитгэлийг бод. $x^2 ${signSum}x ${signProd} = 0$`,
      ]);

      const correct = `$x=${toSigned(r1)},${toSigned(r2)}$`;
      const { options, correctOption } = mcqOptions(rng, correct, [
        `$x=${toSigned(r1 + 1)},${toSigned(r2)}$`,
        `$x=${toSigned(r1)},${toSigned(r2 + 1)}$`,
        `$x=${toSigned(-r1)},${toSigned(-r2)}$`,
        `$x=${toSigned(r1)},${toSigned(-r2)}$`,
      ]);

      return { type: "mcq", prompt, options, correctOption };
    },
  },
  {
    id: "mcq-pythagorean-triple-v1",
    gradeMin: 7,
    gradeMax: 12,
    type: "mcq",
    generate: ({ rng }) => {
      const triple = rng.pick([
        { a: 3, b: 4, c: 5 },
        { a: 5, b: 12, c: 13 },
        { a: 8, b: 15, c: 17 },
        { a: 7, b: 24, c: 25 },
      ]);
      const prompt = rng.pick([
        `Пифагорын теоремоор $a=${triple.a}$, $b=${triple.b}$ бол гипотенуз $c$ хэд вэ?`,
        `Тэгш өнцөгт гурвалжинд $a=${triple.a}$, $b=${triple.b}$. Гипотенуз $c$-г ол.`,
      ]);
      const correct = `$c=${triple.c}$`;
      const { options, correctOption } = mcqOptions(rng, correct, [
        `$c=${triple.c + 1}$`,
        `$c=${triple.c + 2}$`,
        `$c=${Math.max(1, triple.c - 1)}$`,
        `$c=${triple.a + triple.b}$`,
      ]);
      return { type: "mcq", prompt, options, correctOption };
    },
  },
  {
    id: "mcq-sqrt-simplify-mn-v1",
    gradeMin: 7,
    gradeMax: 12,
    type: "mcq",
    generate: ({ rng }) => {
      const m = rng.int(2, 9);
      const n = rng.pick([2, 3, 5, 6, 7, 10]);
      const radicand = m * m * n;
      const prompt = rng.pick([
        `Илэрхийллийг хялбарчил. $\\sqrt{${radicand}}$`,
        `Язгуурыг хялбарчил. $\\sqrt{${radicand}}$`,
      ]);
      const correct = `$${m}\\sqrt{${n}}$`;
      const { options, correctOption } = mcqOptions(rng, correct, [
        `$${m}\\sqrt{${n + 1}}$`,
        `$${m + 1}\\sqrt{${n}}$`,
        `$\\sqrt{${radicand}}$`,
        `$${m * n}\\sqrt{${n}}$`,
      ]);
      return { type: "mcq", prompt, options, correctOption };
    },
  },
  {
    id: "mcq-linear-eval-v1",
    gradeMin: 7,
    gradeMax: 12,
    type: "mcq",
    generate: ({ grade, rng }) => {
      const a = rng.int(-grade.ranges.linearCoeffAbsMax, grade.ranges.linearCoeffAbsMax) || 2;
      const b = rng.int(-grade.ranges.linearBiasAbsMax, grade.ranges.linearBiasAbsMax);
      const x0 = rng.int(-4, 6);
      const y0 = a * x0 + b;
      const prompt = `Функц $y=${a}x${b < 0 ? `-${Math.abs(b)}` : `+${b}`}$ үед $x=${x0}$ бол $y$ хэд вэ?`;
      const correct = String(y0);
      const { options, correctOption } = mcqOptions(rng, correct, [
        String(y0 + 1),
        String(y0 - 1),
        String(y0 + a),
        String(y0 - a),
      ]);
      return { type: "mcq", prompt, options, correctOption };
    },
  },
  {
    id: "mcq-discriminant-v1",
    gradeMin: 9,
    gradeMax: 12,
    type: "mcq",
    generate: ({ grade, rng }) => {
      const a = 1;
      const lim = grade.ranges.discriminantCoeffAbsMax;
      const b = rng.int(-lim, lim) || -4;
      const c = rng.int(-lim, lim) || 1;
      const D = b * b - 4 * a * c;
      const prompt = rng.pick([
        `Квадрат тэгшитгэлийн дискриминант $D=b^2-4ac$ бол $x^2${b < 0 ? `${b}x` : `+${b}x`}${c < 0 ? `${c}` : `+${c}`}=0$ үед $D$ хэд вэ?`,
        `Дискриминант $D=b^2-4ac$-г ашигла. $x^2${b < 0 ? `${b}x` : `+${b}x`}${c < 0 ? `${c}` : `+${c}`}=0$ үед $D$-г ол.`,
      ]);
      const correct = `$${D}$`;
      const { options, correctOption } = mcqOptions(rng, correct, [
        `$${D + 4}$`,
        `$${D - 4}$`,
        `$${b * b}$`,
        `$${-D}$`,
      ]);
      return { type: "mcq", prompt, options, correctOption };
    },
  },
  {
    id: "math-quadratic-integer-roots-v1",
    gradeMin: 8,
    gradeMax: 12,
    type: "math",
    generate: ({ grade, rng }) => {
      const rootMax = grade.ranges.quadraticRootAbsMax;
      const s1 = rng.int(-rootMax, rootMax) || 3;
      const s2 = rng.int(-rootMax, rootMax) || -1;
      const sum = s1 + s2;
      const prod = s1 * s2;
      const signSum = sum < 0 ? `+ ${Math.abs(sum)}` : `- ${sum}`;
      const signProd = prod < 0 ? `- ${Math.abs(prod)}` : `+ ${prod}`;

      const prompt = rng.pick([
        `Задгай: Дараах тэгшитгэлийг бодож, хариуг хялбарчил. $x^2 ${signSum}x ${signProd} = 0$`,
        `Задгай: $x^2 ${signSum}x ${signProd} = 0$ тэгшитгэлийн шийдийг ол.`,
      ]);

      const rootsSorted = [s1, s2].sort((a, b) => b - a);
      const answerLatex = `x = ${toSigned(rootsSorted[0] ?? s1)},\\,${toSigned(
        rootsSorted[1] ?? s2,
      )}`;
      const responseGuide = rng.pick([
        "Бодолтын алхмуудаа бичээд, эцсийн хариуг \(x=...\) хэлбэрээр өг.",
        "Ялгалт хийж бодоод, шийдийг бич.",
      ]);

      return { type: "math", prompt, responseGuide, answerLatex };
    },
  },
];

export function generateDemoExam(options?: { grade?: number }): DemoExamSpec {
  const rng = createRng();
  const gradeNumber = options?.grade ?? rng.pick([7, 8, 9, 10, 11, 12]);
  const grade = gradeConfigFor(gradeNumber);

  const mcqTemplates = TEMPLATES.filter(
    (t) => t.type === "mcq" && inGrade(t, gradeNumber),
  );
  const mathTemplates = TEMPLATES.filter(
    (t) => t.type === "math" && inGrade(t, gradeNumber),
  );

  // Pick unique templates for MCQ where possible.
  const pickedMcq: Template[] = [];
  const mcqPool = [...mcqTemplates];
  while (pickedMcq.length < 5 && mcqPool.length > 0) {
    const t = rng.pick(mcqPool);
    pickedMcq.push(t);
    mcqPool.splice(mcqPool.findIndex((x) => x.id === t.id), 1);
  }
  while (pickedMcq.length < 5 && mcqTemplates.length > 0) {
    pickedMcq.push(rng.pick(mcqTemplates));
  }

  const pickedMath = mathTemplates.length > 0 ? rng.pick(mathTemplates) : null;

  const ctx: TemplateContext = { grade, rng };
  const mcqQuestions = pickedMcq.map((t) => t.generate(ctx) as GeneratedMcq);
  const mathQuestion = pickedMath ? (pickedMath.generate(ctx) as GeneratedMath) : null;

  return {
    title: `${grade.grade}-р анги — Математик`,
    settings: {
      difficulty: grade.difficulty,
      mcqCount: 5,
      mathCount: 1,
      totalPoints: 6,
      topics: grade.topics,
      sourceContext: "",
    },
    questions: [
      ...mcqQuestions.map((q) => ({
        type: "mcq" as const,
        prompt: q.prompt,
        points: 1,
        options: q.options,
        correctOption: q.correctOption,
      })),
      ...(mathQuestion
        ? [
            {
              type: "math" as const,
              prompt: mathQuestion.prompt,
              points: 1,
              responseGuide: mathQuestion.responseGuide,
              answerLatex: mathQuestion.answerLatex,
            },
          ]
        : []),
    ],
  };
}

