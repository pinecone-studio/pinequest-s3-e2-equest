import type {
  AnalyticsScoreBucket,
  Exam,
  ExamAnalytics,
  RiskLevel,
} from "../../live-dashboard/lib/types";
import type {
  ExamReportData,
  ReportScoreTrendData,
  ReportStudentRow,
  WeakQuestion,
} from "./report-adapters";

const MOCK_CLASS_NAMES = ["8A", "8B", "8C", "8D"] as const;
const TERMS_PER_YEAR = 3;
const WEEKS_PER_TERM = 16;
const MATH_LESSONS_PER_WEEK = 5;
const PROJECTS_PER_TERM = 2;

type MockClassName = (typeof MOCK_CLASS_NAMES)[number];
type MockClassProfile = {
  attendanceShift: number;
  finalBias: number;
  growthRange: readonly [number, number];
  homeworkShift: number;
  midtermBias: number;
  placementBias: number;
  progressBias: number;
  termMomentum: number;
};

const MOCK_CLASS_PROFILES: Record<MockClassName, MockClassProfile> = {
  "8A": {
    attendanceShift: 1,
    finalBias: 6,
    growthRange: [2.4, 5.2],
    homeworkShift: 1.5,
    midtermBias: 3.8,
    placementBias: -2.4,
    progressBias: 1.5,
    termMomentum: 0.8,
  },
  "8B": {
    attendanceShift: -4.5,
    finalBias: -12,
    growthRange: [-3.4, -1.1],
    homeworkShift: -5,
    midtermBias: -5.5,
    placementBias: 7.2,
    progressBias: 0.6,
    termMomentum: -3.2,
  },
  "8C": {
    attendanceShift: 0.4,
    finalBias: 2.8,
    growthRange: [1.1, 3.1],
    homeworkShift: 0.8,
    midtermBias: 1.6,
    placementBias: -1.1,
    progressBias: 0.5,
    termMomentum: 0.4,
  },
  "8D": {
    attendanceShift: 2.1,
    finalBias: 7.2,
    growthRange: [2.8, 5.6],
    homeworkShift: 2.2,
    midtermBias: 4.5,
    placementBias: -3.2,
    progressBias: 2.3,
    termMomentum: 1.2,
  },
};

const MONGOLIAN_FAMILY_NAMES = [
  "Бат-Эрдэнэ",
  "Мөнхбат",
  "Түмэнжаргал",
  "Энхтөр",
  "Алтанхуяг",
  "Цогтбаатар",
  "Баярсайхан",
  "Ганболд",
  "Отгонбаяр",
  "Сүхбат",
  "Баясгалан",
  "Эрдэнэбат",
  "Чинзориг",
  "Төгсжаргал",
  "Наранбат",
  "Даваасүрэн",
  "Мөнгөншагай",
  "Батсайхан",
  "Түвшинбаяр",
  "Гантулга",
  "Эрдэнэсайхан",
  "Ганзориг",
  "Мөнх-Оргил",
  "Содномдорж",
  "Чулуунбат",
  "Тэмүүжин",
  "Жаргалсайхан",
  "Энхболд",
  "Пүрэвдорж",
  "Бямбасүрэн",
] as const;

const MONGOLIAN_GIVEN_NAMES = [
  "Анужин",
  "Номин",
  "Мишээл",
  "Марал",
  "Сувд",
  "Уянга",
  "Тэмүүлэн",
  "Тэнүүн",
  "Билгүүн",
  "Эрхэс",
  "Төгөлдөр",
  "Анар",
  "Ирмүүн",
  "Мөнхжин",
  "Хүслэн",
  "Энгүүн",
  "Дөлгөөн",
  "Содбилэг",
  "Нандин",
  "Намуун",
  "Ариунболд",
  "Саруул",
  "Бат-Оргил",
  "Есүй",
  "Ивээл",
  "Маргад",
  "Энэрэл",
  "Хулан",
  "Индра",
  "Мөнхнасан",
  "Төгсөө",
  "Амин-Эрдэнэ",
  "Одгэрэл",
  "Сүлд",
  "Гэгээн",
  "Мөнх-Учрал",
  "Эрмүүн",
  "Наран",
  "Тэмүжин",
  "Ундрал",
  "Баярмаа",
  "Мөнхсайхан",
  "Жавхлан",
  "Содон",
  "Эрдэнэсувд",
  "Анхмаа",
  "Гэрэл",
  "Тэнгэр",
  "Оюундарь",
  "Бүжинлхам",
] as const;

type MockTermRecord = {
  attendanceRate: number;
  attendanceSessions: {
    attended: number;
    total: number;
  };
  finalExamScore: number;
  homeworkAverage: number;
  homeworkScores: number[];
  mathLessonsPerWeek: number;
  midtermExamScore: number;
  placementExamScore: number;
  progressExamScore: number;
  projectScores: number[];
  termNumber: number;
  weeks: number;
};

type MockStudentAcademicRecord = {
  className: string;
  id: string;
  name: string;
  studentCode: string;
  terms: MockTermRecord[];
};

type MockWeakQuestionSeed = {
  label: string;
  prompt: string;
  questionType?: string | null;
  weight: number;
};

const MOCK_SUBJECT = "Математик";
const MOCK_TOPIC = "Жилийн тайлан";
const MOCK_REPORT_QUESTION_COUNT = 40;
const MOCK_REPORT_YEAR = 2026;
const MOCK_WEAK_QUESTION_BANK: MockWeakQuestionSeed[] = [
  {
    label: "A03",
    prompt: "Тэгшитгэл $2x + 5 = 17$-ыг бодож, $x$-ийн утгыг ол.",
    questionType: "math",
    weight: 1.1,
  },
  {
    label: "A07",
    prompt:
      "Илэрхийлэл $\\frac{3}{4}x + \\frac{1}{2} = 5$ үед $x$-ийг зөв олсон эсэхийг шалгах бодлого.",
    questionType: "math",
    weight: 1.25,
  },
  {
    label: "A11",
    prompt: "Координатын хавтгай дээр цэгийн байрлал унших даалгавар",
    weight: 0.95,
  },
  {
    label: "A16",
    prompt: "Функцийн $y = 2x^2 - 3x + 1$ графикаас утга уншиж дүгнэлт хийх асуулт",
    questionType: "math",
    weight: 1.3,
  },
  {
    label: "A21",
    prompt: "Геометрийн дүрсийн талбай, периметрийг хослуулсан бодлого",
    weight: 1.2,
  },
  {
    label: "A28",
    prompt: "Өгөгдлийн дундаж, медиан, моод тооцох даалгавар",
    weight: 0.9,
  },
];

export const MOCK_SCORE_TREND_SUMMARY =
  "Mock data: 4 анги • анги бүр 30 сурагч • 3 улирал • улирал бүр 4 шалгалт";

const MOCK_ACADEMIC_RECORDS = buildMockAcademicRecords();

export const MOCK_SCORE_TREND_DATA =
  buildMockScoreTrendData(MOCK_ACADEMIC_RECORDS);
export const MOCK_REPORT_EXAMS = buildMockReportExams(
  MOCK_ACADEMIC_RECORDS,
  MOCK_SCORE_TREND_DATA,
);

export function pickDefaultMockReportExamId(): string | null {
  return MOCK_REPORT_EXAMS[0]?.id ?? null;
}

export function buildMockExamReportData(examId: string): ExamReportData | null {
  const exam = MOCK_REPORT_EXAMS.find((item) => item.id === examId) ?? null;
  if (!exam) {
    return null;
  }

  const classRecords = MOCK_ACADEMIC_RECORDS.filter(
    (record) => record.className === exam.class,
  );
  const trendStudentsById = new Map(
    MOCK_SCORE_TREND_DATA.students.map((student) => [student.id, student] as const),
  );

  const students: ReportStudentRow[] = classRecords
    .map((record) => {
      const trendStudent = trendStudentsById.get(record.id);
      const score = trendStudent?.latestScore ?? null;
      const signals = buildMockSignals(record, score);
      const submittedAt = buildMockSubmissionDate(exam, record.studentCode);

      return {
        className: record.className,
        dangerCount: signals.dangerCount,
        id: record.id,
        lastActivity: submittedAt,
        name: record.name,
        riskLevel: signals.riskLevel,
        score,
        status: "approved",
        studentCode: record.studentCode,
        submittedAt,
        warningCount: signals.warningCount,
      } satisfies ReportStudentRow;
    })
    .sort((left, right) => {
      const rightScore = right.score ?? -1;
      const leftScore = left.score ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.name.localeCompare(left.name, "mn");
    });

  const scores = students.flatMap((student) => {
    return typeof student.score === "number" ? [student.score] : [];
  });
  const summaryAverage =
    scores.length > 0 ? roundToOneDecimal(average(scores)) : null;
  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : null;
  const failingCount = students.filter((student) => {
    return typeof student.score === "number" && student.score < 60;
  }).length;
  const weakQuestions = buildMockWeakQuestions(exam.class, classRecords, scores);
  const analytics = buildMockAnalytics(students);

  return {
    analytics,
    exam,
    failingCount,
    highestScore,
    lowestScore,
    scoreDistribution: analytics.scoreDistribution,
    scoreTrend: MOCK_SCORE_TREND_DATA,
    students,
    summaryAverage,
    weakQuestions,
  };
}

function buildMockScoreTrendData(
  students: MockStudentAcademicRecord[],
): ReportScoreTrendData {
  return {
    phases: [
      {
        examId: "mock-baseline",
        examTitle: "3 улирлын түвшин тогтоох шалгалтын дундаж",
        key: "baseline",
        label: "Түвшин тогтоох",
      },
      {
        examId: "mock-progress",
        examTitle: "3 улирлын явцын шалгалтын дундаж",
        key: "progress",
        label: "Явц",
      },
      {
        examId: "mock-midterm",
        examTitle: "3 улирлын улирлын дунд шалгалтын дундаж",
        key: "midterm",
        label: "Улирлын дунд",
      },
      {
        examId: "mock-final",
        examTitle: "3 улирлын жилийн эцсийн шалгалтын дундаж",
        key: "final",
        label: "Жилийн эцэс",
      },
    ],
    students: students.map((student) => {
      const baselineScore = roundToOneDecimal(
        average(student.terms.map((term) => term.placementExamScore)),
      );
      const progressScore = roundToOneDecimal(
        average(student.terms.map((term) => term.progressExamScore)),
      );
      const midtermScore = roundToOneDecimal(
        average(student.terms.map((term) => term.midtermExamScore)),
      );
      const finalScore = roundToOneDecimal(
        average(student.terms.map((term) => term.finalExamScore)),
      );

      return {
        className: student.className,
        id: student.id,
        latestScore: finalScore,
        name: student.name,
        overallDelta: roundToOneDecimal(finalScore - baselineScore),
        points: [
          {
            examId: "mock-baseline",
            examTitle: "3 улирлын түвшин тогтоох шалгалтын дундаж",
            key: "baseline",
            label: "Түвшин тогтоох",
            score: baselineScore,
          },
          {
            examId: "mock-progress",
            examTitle: "3 улирлын явцын шалгалтын дундаж",
            key: "progress",
            label: "Явц",
            score: progressScore,
          },
          {
            examId: "mock-midterm",
            examTitle: "3 улирлын улирлын дунд шалгалтын дундаж",
            key: "midterm",
            label: "Улирлын дунд",
            score: midtermScore,
          },
          {
            examId: "mock-final",
            examTitle: "3 улирлын жилийн эцсийн шалгалтын дундаж",
            key: "final",
            label: "Жилийн эцэс",
            score: finalScore,
          },
        ],
        recentDelta: roundToOneDecimal(finalScore - midtermScore),
        studentCode: student.studentCode,
      };
    }),
  };
}

function buildMockReportExams(
  students: MockStudentAcademicRecord[],
  trend: ReportScoreTrendData,
): Exam[] {
  return MOCK_CLASS_NAMES.map((className) => {
    const classStudents = students.filter((student) => student.className === className);
    const latestScores = classStudents
      .map((student) => {
        return (
          trend.students.find((trendStudent) => trendStudent.id === student.id)
            ?.latestScore ?? null
        );
      })
      .filter((score): score is number => typeof score === "number");
    const averageScore =
      latestScores.length > 0 ? roundToOneDecimal(average(latestScores)) : undefined;

    return {
      id: `mock-report-${className.toLowerCase()}`,
      title: `${MOCK_SUBJECT} · ${className} · ${MOCK_TOPIC}`,
      subject: MOCK_SUBJECT,
      topic: MOCK_TOPIC,
      questionCount: MOCK_REPORT_QUESTION_COUNT,
      liveStudentCount: 0,
      totalStudentCount: classStudents.length,
      averageScore,
      startTime: new Date(`${MOCK_REPORT_YEAR}-03-10T08:30:00+08:00`),
      endTime: new Date(`${MOCK_REPORT_YEAR}-03-10T10:00:00+08:00`),
      class: className,
    };
  });
}

function buildMockSignals(
  student: MockStudentAcademicRecord,
  score: number | null,
): { dangerCount: number; riskLevel: RiskLevel; warningCount: number } {
  const latestTerm = student.terms[student.terms.length - 1];
  const attendancePenalty = latestTerm.attendanceRate < 92 ? 1 : 0;
  const lowScorePenalty = typeof score === "number" && score < 75 ? 1 : 0;
  const warningCount =
    attendancePenalty +
    lowScorePenalty +
    (latestTerm.homeworkAverage < 72 ? 1 : 0);
  const dangerCount =
    (typeof score === "number" && score < 60 ? 1 : 0) +
    (latestTerm.attendanceRate < 84 ? 1 : 0);

  return {
    dangerCount,
    riskLevel:
      dangerCount > 0 || warningCount >= 3
        ? "high"
        : warningCount > 0
          ? "medium"
          : "low",
    warningCount,
  };
}

function buildMockSubmissionDate(exam: Exam, studentCode: string): Date {
  const seed = createSeededRandom(`submission-${exam.class}-${studentCode}`);
  const submittedAt = new Date(exam.endTime ?? exam.startTime);
  submittedAt.setMinutes(submittedAt.getMinutes() - Math.floor(seed() * 32));
  submittedAt.setSeconds(Math.floor(seed() * 60), 0);
  return submittedAt;
}

function buildMockWeakQuestions(
  className: string,
  students: MockStudentAcademicRecord[],
  scores: number[],
): WeakQuestion[] {
  const averageScore = scores.length > 0 ? average(scores) : 70;
  const classDifficultyShift = Math.round((74 - averageScore) * 0.55);

  return MOCK_WEAK_QUESTION_BANK.map((item) => {
    const random = createSeededRandom(`weak-${className}-${item.label}`);
    const errorRate = Math.round(
      clamp(
        28 + item.weight * 12 + classDifficultyShift + randomBetween(random, -6, 9),
        16,
        88,
      ),
    );

    return {
      errorRate,
      label: item.label,
      missedCount: Math.round((students.length * errorRate) / 100),
      prompt: item.prompt,
      questionType: item.questionType ?? null,
      totalCount: students.length,
    };
  })
    .sort((left, right) => right.errorRate - left.errorRate);
}

function buildMockAnalytics(students: ReportStudentRow[]): ExamAnalytics {
  return {
    answerChanges: [],
    dangerTimeline: [],
    focusAreas: [],
    riskDistribution: buildMockRiskDistribution(students),
    scoreDistribution: buildMockScoreDistribution(students),
    slowestQuestions: [],
  };
}

function buildMockScoreDistribution(
  students: ReportStudentRow[],
): AnalyticsScoreBucket[] {
  const ranges = [
    { label: "0-20", max: 20, min: 0 },
    { label: "21-40", max: 40, min: 21 },
    { label: "41-60", max: 60, min: 41 },
    { label: "61-80", max: 80, min: 61 },
    { label: "81-100", max: 100, min: 81 },
  ];

  return ranges.map((range) => ({
    range: range.label,
    count: students.filter((student) => {
      const score = student.score ?? -1;
      return score >= range.min && score <= range.max;
    }).length,
  }));
}

function buildMockRiskDistribution(students: ReportStudentRow[]) {
  const low = students.filter((student) => student.riskLevel === "low").length;
  const medium = students.filter((student) => student.riskLevel === "medium").length;
  const high = students.filter((student) => student.riskLevel === "high").length;

  return [
    { name: "Бага", value: low, color: "hsl(var(--success))" },
    { name: "Дунд", value: medium, color: "hsl(var(--warning))" },
    { name: "Өндөр", value: high, color: "hsl(var(--danger))" },
  ];
}

function buildMockAcademicRecords(): MockStudentAcademicRecord[] {
  return MOCK_CLASS_NAMES.flatMap((className, classIndex) => {
    return Array.from({ length: 30 }, (_, studentIndex) => {
      const globalIndex = classIndex * 30 + studentIndex;
      const random = createSeededRandom(`${className}-${studentIndex + 1}`);
      const classProfile = MOCK_CLASS_PROFILES[className];
      const baseSkill = randomBetween(random, 52, 88);
      const growthPerTerm = randomBetween(random, ...classProfile.growthRange);
      const attendanceDiscipline = randomBetween(random, 0.88, 1.06);
      const homeworkDiscipline = randomBetween(random, 0.82, 1.08);
      const projectStrength = randomBetween(random, -4, 7);

      const terms = Array.from({ length: TERMS_PER_YEAR }, (_, termIndex) => {
        const termNumber = termIndex + 1;
        const termRandom = createSeededRandom(
          `${className}-${studentIndex + 1}-term-${termNumber}`,
        );
        const totalSessions = WEEKS_PER_TERM * MATH_LESSONS_PER_WEEK;
        const termBase = clamp(
          baseSkill +
            growthPerTerm * termIndex +
            classProfile.termMomentum * termIndex +
            randomBetween(termRandom, -5, 6),
          45,
          98,
        );
        const attendanceRate = clamp(
          78 +
            attendanceDiscipline * 12 +
            classProfile.attendanceShift +
            termIndex * 1.5 +
            randomBetween(termRandom, -6, 6),
          76,
          100,
        );
        const attendedSessions = Math.round(
          (attendanceRate / 100) * totalSessions,
        );
        const homeworkScores = Array.from({ length: WEEKS_PER_TERM }, (_, weekIndex) => {
          return clamp(
            termBase * 0.74 +
              attendanceRate * 0.18 +
              homeworkDiscipline * 7 +
              classProfile.homeworkShift +
              weekIndex * 0.2 +
              randomBetween(termRandom, -10, 9),
            45,
            100,
          );
        });
        const homeworkAverage = roundToOneDecimal(average(homeworkScores));
        const projectScores = Array.from({ length: PROJECTS_PER_TERM }, (_, projectIndex) => {
          return clamp(
            termBase * 0.72 +
              homeworkAverage * 0.14 +
              projectStrength +
              projectIndex * 1.2 +
              randomBetween(termRandom, -8, 9),
            48,
            100,
          );
        });
        const placementExamScore = clamp(
          termBase * 0.67 +
            attendanceRate * 0.05 +
            homeworkAverage * 0.04 +
            classProfile.placementBias +
            randomBetween(termRandom, -10, 8),
          38,
          100,
        );
        const progressExamScore = clamp(
          termBase * 0.5 +
            placementExamScore * 0.24 +
            homeworkAverage * 0.08 +
            attendanceRate * 0.07 +
            classProfile.progressBias +
            randomBetween(termRandom, -9, 7),
          42,
          100,
        );
        const midtermExamScore = clamp(
          termBase * 0.44 +
            progressExamScore * 0.28 +
            homeworkAverage * 0.1 +
            average(projectScores) * 0.07 +
            classProfile.midtermBias +
            termIndex * 0.7 +
            randomBetween(termRandom, -7, 7),
          40,
          100,
        );
        const finalExamScore = clamp(
          termBase * 0.36 +
            placementExamScore * 0.1 +
            progressExamScore * 0.18 +
            midtermExamScore * 0.22 +
            attendanceRate * 0.06 +
            homeworkAverage * 0.08 +
            average(projectScores) * 0.08 +
            classProfile.finalBias +
            termIndex * 0.9 +
            randomBetween(termRandom, -5, 6),
          40,
          100,
        );

        return {
          attendanceRate: roundToOneDecimal(attendanceRate),
          attendanceSessions: {
            attended: attendedSessions,
            total: totalSessions,
          },
          finalExamScore: roundToOneDecimal(finalExamScore),
          homeworkAverage,
          homeworkScores: homeworkScores.map(roundToOneDecimal),
          mathLessonsPerWeek: MATH_LESSONS_PER_WEEK,
          midtermExamScore: roundToOneDecimal(midtermExamScore),
          placementExamScore: roundToOneDecimal(placementExamScore),
          progressExamScore: roundToOneDecimal(progressExamScore),
          projectScores: projectScores.map(roundToOneDecimal),
          termNumber,
          weeks: WEEKS_PER_TERM,
        };
      });

      return {
        className,
        id: `mock-${className.toLowerCase()}-${studentIndex + 1}`,
        name: buildMongolianStudentName(globalIndex),
        studentCode: `${className}-${String(studentIndex + 1).padStart(2, "0")}`,
        terms,
      };
    });
  });
}

function buildMongolianStudentName(index: number): string {
  const familyName = MONGOLIAN_FAMILY_NAMES[index % MONGOLIAN_FAMILY_NAMES.length];
  const givenName =
    MONGOLIAN_GIVEN_NAMES[
      (index * 7 + Math.floor(index / MONGOLIAN_FAMILY_NAMES.length)) %
        MONGOLIAN_GIVEN_NAMES.length
    ];

  return `${familyName} ${givenName}`;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed);

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function randomBetween(
  random: () => number,
  min: number,
  max: number,
): number {
  return min + (max - min) * random();
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}
