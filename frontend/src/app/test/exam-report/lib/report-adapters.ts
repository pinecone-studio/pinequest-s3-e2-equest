import {
  buildExamDashboardData,
  buildExamList,
  type DashboardApiPayload,
} from "../../live-dashboard/lib/dashboard-adapters";
import type {
  AnalyticsScoreBucket,
  Exam,
  ExamAnalytics,
  RiskLevel,
  StudentStatus,
} from "../../live-dashboard/lib/types";

const FAILING_SCORE_THRESHOLD = 60;

export interface ReportStudentRow {
  className: string;
  dangerCount: number;
  id: string;
  lastActivity: Date;
  name: string;
  riskLevel: RiskLevel;
  score: number | null;
  status: StudentStatus;
  studentCode: string;
  submittedAt: Date | null;
  warningCount: number;
}

export interface WeakQuestion {
  errorRate: number;
  label: string;
  missedCount: number;
  prompt: string;
  totalCount: number;
}

export type ScoreTrendPhaseKey =
  | "baseline"
  | "progress"
  | "midterm"
  | "final";

export interface ReportScoreTrendPhase {
  examId: string | null;
  examTitle: string | null;
  key: ScoreTrendPhaseKey;
  label: string;
}

export interface ReportScoreTrendPoint extends ReportScoreTrendPhase {
  score: number | null;
}

export interface ReportScoreTrendStudent {
  className: string;
  id: string;
  latestScore: number | null;
  name: string;
  overallDelta: number | null;
  points: ReportScoreTrendPoint[];
  recentDelta: number | null;
  studentCode: string;
}

export interface ReportScoreTrendData {
  phases: ReportScoreTrendPhase[];
  students: ReportScoreTrendStudent[];
}

export interface ExamReportData {
  analytics: ExamAnalytics;
  exam: Exam;
  failingCount: number;
  highestScore: number | null;
  lowestScore: number | null;
  scoreDistribution: AnalyticsScoreBucket[];
  scoreTrend: ReportScoreTrendData;
  students: ReportStudentRow[];
  summaryAverage: number | null;
  weakQuestions: WeakQuestion[];
}

const SCORE_TREND_PHASES: Array<{
  key: ScoreTrendPhaseKey;
  label: string;
}> = [
  { key: "baseline", label: "Түвшин тогтоох" },
  { key: "progress", label: "Явц" },
  { key: "midterm", label: "Улирлын дунд" },
  { key: "final", label: "Жилийн эцэс" },
];

type TrendExamCandidate = Exam & {
  description: string;
  phaseHint: ScoreTrendPhaseKey | null;
  sortTime: number;
};

export function pickDefaultReportExamId(
  payload: DashboardApiPayload | null,
): string | null {
  if (!payload) {
    return null;
  }

  const exams = buildExamList(payload).filter((exam) => exam.totalStudentCount > 0);
  const completedExam =
    exams
      .filter((exam) => Boolean(exam.endTime))
      .sort((left, right) => {
        return (
          (right.endTime?.getTime() ?? right.startTime.getTime()) -
          (left.endTime?.getTime() ?? left.startTime.getTime())
        );
      })[0] ?? null;

  return completedExam?.id ?? exams[0]?.id ?? null;
}

export function buildExamReportData(
  payload: DashboardApiPayload,
  examId: string,
): ExamReportData | null {
  const dashboardData = buildExamDashboardData(payload, examId);
  if (!dashboardData.exam) {
    return null;
  }
  const reportExam = dashboardData.exam;

  const reportStudents = payload.attempts
    .filter((attempt) => attempt.testId === examId)
    .map((attempt) => {
      const student = dashboardData.students.find(
        (item) => item.id === attempt.studentId,
      );

      return {
        className: reportExam.class,
        dangerCount: student?.dangerCount ?? 0,
        id: attempt.studentId,
        lastActivity:
          student?.lastActivity ??
          new Date(attempt.submittedAt ?? attempt.startedAt),
        name: attempt.studentName,
        riskLevel: student?.riskLevel ?? "low",
        score:
          student?.score ??
          attempt.result?.percentage ??
          attempt.percentage ??
          attempt.score ??
          null,
        status: student?.status ?? toStudentStatus(attempt.status),
        studentCode: attempt.studentId,
        submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt) : null,
        warningCount: student?.warningCount ?? 0,
      };
    })
    .sort((left, right) => {
      return compareReportStudents(left, right);
    });

  const scoredStudents = reportStudents.filter(
    (student) => typeof student.score === "number",
  );
  const scores = scoredStudents.map((student) => student.score ?? 0);
  const summaryAverage =
    scores.length > 0
      ? Number(
          (
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          ).toFixed(1),
        )
      : null;

  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : null;
  const failingCount = scoredStudents.filter(
    (student) => (student.score ?? 0) < FAILING_SCORE_THRESHOLD,
  ).length;

  return {
    analytics: dashboardData.analytics,
    exam: reportExam,
    failingCount,
    highestScore,
    lowestScore,
    scoreDistribution: dashboardData.analytics.scoreDistribution,
    scoreTrend: buildScoreTrendData(payload, reportExam),
    students: reportStudents,
    summaryAverage,
    weakQuestions: buildWeakQuestions(payload, examId),
  };
}

export function combineExamReports(
  reports: ExamReportData[],
  className: string,
): ExamReportData | null {
  if (reports.length === 0) {
    return null;
  }

  const students = [...reports.flatMap((report) => report.students)].sort(
    compareReportStudents,
  );
  const scores = students.flatMap((student) => {
    return typeof student.score === "number" ? [student.score] : [];
  });
  const summaryAverage =
    scores.length > 0
      ? Number(
          (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(
            1,
          ),
        )
      : null;
  const highestScore = scores.length > 0 ? Math.max(...scores) : null;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : null;
  const failingCount = students.filter((student) => {
    return typeof student.score === "number" && student.score < FAILING_SCORE_THRESHOLD;
  }).length;
  const scoreDistribution = combineScoreDistribution(reports);
  const startTime = Math.min(...reports.map((report) => report.exam.startTime.getTime()));
  const endTimes = reports
    .map((report) => report.exam.endTime?.getTime())
    .filter((value): value is number => typeof value === "number");

  return {
    analytics: {
      answerChanges: [],
      dangerTimeline: [],
      focusAreas: [],
      riskDistribution: combineRiskDistribution(reports),
      scoreDistribution,
      slowestQuestions: [],
    },
    exam: {
      averageScore: summaryAverage ?? undefined,
      class: className,
      endTime:
        endTimes.length > 0 ? new Date(Math.max(...endTimes)) : undefined,
      id: `combined-${reports.map((report) => report.exam.id).join("-")}`,
      liveStudentCount: reports.reduce((sum, report) => {
        return sum + report.exam.liveStudentCount;
      }, 0),
      questionCount: Math.max(...reports.map((report) => report.exam.questionCount)),
      startTime: new Date(startTime),
      subject: resolveCombinedExamField(
        reports.map((report) => report.exam.subject),
        "Нэгдсэн",
      ),
      title:
        className === "Бүгд"
          ? "Бүх ангийн шалгалтын тайлан"
          : `${className} ангийн шалгалтын тайлан`,
      topic: resolveCombinedExamField(
        reports.map((report) => report.exam.topic),
        "Нэгдсэн тайлан",
      ),
      totalStudentCount: students.length,
    },
    failingCount,
    highestScore,
    lowestScore,
    scoreDistribution,
    scoreTrend: combineScoreTrendData(reports),
    students,
    summaryAverage,
    weakQuestions: combineWeakQuestions(reports),
  };
}

function buildScoreTrendData(
  payload: DashboardApiPayload,
  selectedExam: Exam,
): ReportScoreTrendData {
  const availableTestById = new Map(
    payload.availableTests.map((test) => [test.id, test] as const),
  );
  const candidates = buildExamList(payload)
    .filter((exam) => {
      return (
        exam.totalStudentCount > 0 &&
        exam.class === selectedExam.class &&
        exam.subject === selectedExam.subject
      );
    })
    .map((exam) => {
      const source = availableTestById.get(exam.id);

      return {
        ...exam,
        description: source?.description ?? "",
        phaseHint: inferScoreTrendPhase(exam.title, exam.topic, source?.description),
        sortTime: exam.endTime?.getTime() ?? exam.startTime.getTime(),
      };
    })
    .sort((left, right) => left.sortTime - right.sortTime);

  const phases = pickScoreTrendPhases(candidates, selectedExam.id);
  const studentMap = new Map<
    string,
    {
      className: string;
      id: string;
      name: string;
      phaseScores: Map<
        ScoreTrendPhaseKey,
        { examTitle: string | null; score: number | null; sortTime: number }
      >;
      studentCode: string;
    }
  >();

  for (const phase of phases) {
    if (!phase.examId) {
      continue;
    }

    for (const attempt of payload.attempts.filter((item) => item.testId === phase.examId)) {
      const current = studentMap.get(attempt.studentId) ?? {
        className: attempt.criteria?.className ?? selectedExam.class,
        id: attempt.studentId,
        name: attempt.studentName,
        phaseScores: new Map(),
        studentCode: attempt.studentId,
      };
      const nextSortTime = new Date(
        attempt.submittedAt ?? attempt.startedAt,
      ).getTime();
      const existing = current.phaseScores.get(phase.key);

      if (!existing || nextSortTime >= existing.sortTime) {
        current.phaseScores.set(phase.key, {
          examTitle: phase.examTitle,
          score: getAttemptScore(attempt),
          sortTime: nextSortTime,
        });
      }

      studentMap.set(attempt.studentId, current);
    }
  }

  const students = [...studentMap.values()]
    .map((student) => {
      const points = phases.map((phase) => {
        const point = student.phaseScores.get(phase.key);

        return {
          ...phase,
          examTitle: point?.examTitle ?? phase.examTitle,
          score: point?.score ?? null,
        };
      });
      const availableScores = points
        .map((point) => point.score)
        .filter((score): score is number => typeof score === "number");
      const latestScore =
        availableScores.length > 0 ? availableScores[availableScores.length - 1] : null;
      const overallDelta =
        availableScores.length >= 2
          ? Number(
              (availableScores[availableScores.length - 1] - availableScores[0]).toFixed(
                1,
              ),
            )
          : null;
      const recentDelta =
        availableScores.length >= 2
          ? Number(
              (
                availableScores[availableScores.length - 1] -
                availableScores[availableScores.length - 2]
              ).toFixed(1),
            )
          : null;

      return {
        className: student.className,
        id: student.id,
        latestScore,
        name: student.name,
        overallDelta,
        points,
        recentDelta,
        studentCode: student.studentCode,
      };
    })
    .filter((student) => {
      return student.points.some((point) => typeof point.score === "number");
    })
    .sort((left, right) => {
      return left.name.localeCompare(right.name, "mn");
    });

  return {
    phases,
    students,
  };
}

function buildWeakQuestions(
  payload: DashboardApiPayload,
  examId: string,
): WeakQuestion[] {
  const materialQuestions =
    payload.testMaterial?.testId === examId ? payload.testMaterial.questions : [];
  const questionOrder = new Map(
    materialQuestions.map((question, index) => [question.questionId, index] as const),
  );
  const questionPrompt = new Map(
    materialQuestions.map((question) => [question.questionId, question.prompt] as const),
  );

  const questionStats = new Map<
    string,
    { missedCount: number; order: number; prompt: string; totalCount: number }
  >();

  for (const attempt of payload.attempts.filter((item) => item.testId === examId)) {
    for (const result of attempt.result?.questionResults ?? []) {
      const current = questionStats.get(result.questionId) ?? {
        missedCount: 0,
        order: questionOrder.get(result.questionId) ?? Number.MAX_SAFE_INTEGER,
        prompt:
          questionPrompt.get(result.questionId) ??
          result.prompt ??
          `Асуулт ${result.questionId}`,
        totalCount: 0,
      };

      current.totalCount += 1;
      if (!result.isCorrect || result.pointsAwarded < result.maxPoints) {
        current.missedCount += 1;
      }

      questionStats.set(result.questionId, current);
    }
  }

  return [...questionStats.entries()]
    .map(([questionId, stat]) => ({
      errorRate:
        stat.totalCount > 0
          ? Math.round((stat.missedCount / stat.totalCount) * 100)
          : 0,
      label: formatQuestionLabel(stat.order, questionId),
      missedCount: stat.missedCount,
      prompt: stat.prompt,
      totalCount: stat.totalCount,
    }))
    .filter((question) => question.missedCount > 0)
    .sort((left, right) => {
      if (right.errorRate !== left.errorRate) {
        return right.errorRate - left.errorRate;
      }

      return right.missedCount - left.missedCount;
    });
}

function formatQuestionLabel(order: number, questionId: string): string {
  if (Number.isFinite(order) && order !== Number.MAX_SAFE_INTEGER) {
    return `A${String(order + 1).padStart(2, "0")}`;
  }

  const questionSuffix = questionId.match(/((?:q|Q)[-_]?\d+)$/)?.[1];
  if (questionSuffix) {
    return questionSuffix.toLowerCase().replaceAll("_", "-");
  }

  return questionId;
}

function inferScoreTrendPhase(
  title: string,
  topic: string,
  description?: string,
): ScoreTrendPhaseKey | null {
  const haystack = `${title} ${topic} ${description ?? ""}`.toLowerCase();

  if (
    hasScoreTrendKeyword(haystack, [
      "түвшин тогтоох",
      "түвшин",
      "placement",
      "baseline",
      "diagnostic",
      "entry",
      "pretest",
      "pre-test",
      "level test",
    ])
  ) {
    return "baseline";
  }

  if (
    hasScoreTrendKeyword(haystack, [
      "улирал эцэс",
      "улирлын эцэс",
      "жилийн эцэс",
      "жилийн эцсийн",
      "final",
      "year_final",
      "year final",
      "эцс",
    ])
  ) {
    return "final";
  }

  if (
    hasScoreTrendKeyword(haystack, [
      "улирал дунд",
      "улирлын дунд",
      "midterm",
      "mid term",
      "term",
      "дунд",
    ])
  ) {
    return "midterm";
  }

  if (
    hasScoreTrendKeyword(haystack, [
      "явц",
      "progress",
      "practice",
      "давтлага",
    ])
  ) {
    return "progress";
  }

  return null;
}

function hasScoreTrendKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function pickScoreTrendPhases(
  candidates: TrendExamCandidate[],
  selectedExamId: string,
): ReportScoreTrendPhase[] {
  if (candidates.length === 0) {
    return SCORE_TREND_PHASES.map((phase) => ({
      examId: null,
      examTitle: null,
      key: phase.key,
      label: phase.label,
    }));
  }

  const usedIds = new Set<string>();
  const picks = new Map<ScoreTrendPhaseKey, TrendExamCandidate>();
  const selectedExam =
    candidates.find((candidate) => candidate.id === selectedExamId) ?? null;

  for (const phase of SCORE_TREND_PHASES) {
    const explicitMatches = candidates.filter(
      (candidate) => candidate.phaseHint === phase.key,
    );
    const selectedMatch = explicitMatches.find(
      (candidate) => candidate.id === selectedExamId,
    );
    const preferred = selectedMatch ?? explicitMatches.at(-1);

    if (preferred && !usedIds.has(preferred.id)) {
      picks.set(phase.key, preferred);
      usedIds.add(preferred.id);
    }
  }

  if (selectedExam && !usedIds.has(selectedExam.id)) {
    const fallbackPhase =
      selectedExam.phaseHint ?? inferPhaseByPosition(candidates, selectedExam.id);
    if (!picks.has(fallbackPhase)) {
      picks.set(fallbackPhase, selectedExam);
      usedIds.add(selectedExam.id);
    }
  }

  fillMissingScoreTrendPhase(picks, usedIds, "baseline", candidates[0] ?? null);
  fillMissingScoreTrendPhase(
    picks,
    usedIds,
    "final",
    candidates.at(-1) ?? null,
  );

  fillMissingScoreTrendPhase(
    picks,
    usedIds,
    "progress",
    candidates.find((candidate, index) => {
      return (
        index > 0 &&
        index < candidates.length - 1 &&
        !usedIds.has(candidate.id)
      );
    }) ??
      candidates.find((candidate) => !usedIds.has(candidate.id)) ??
      null,
  );
  fillMissingScoreTrendPhase(
    picks,
    usedIds,
    "midterm",
    pickMidtermScoreTrendCandidate(candidates, usedIds),
  );

  return SCORE_TREND_PHASES.map((phase) => {
    const picked = picks.get(phase.key);

    return {
      examId: picked?.id ?? null,
      examTitle: picked?.title ?? null,
      key: phase.key,
      label: phase.label,
    };
  });
}

function fillMissingScoreTrendPhase(
  picks: Map<ScoreTrendPhaseKey, TrendExamCandidate>,
  usedIds: Set<string>,
  phaseKey: ScoreTrendPhaseKey,
  candidate: TrendExamCandidate | null,
) {
  if (!candidate || picks.has(phaseKey) || usedIds.has(candidate.id)) {
    return;
  }

  picks.set(phaseKey, candidate);
  usedIds.add(candidate.id);
}

function pickMidtermScoreTrendCandidate(
  candidates: TrendExamCandidate[],
  usedIds: Set<string>,
): TrendExamCandidate | null {
  const remaining = candidates.filter((candidate) => !usedIds.has(candidate.id));
  if (remaining.length === 0) {
    return null;
  }

  return remaining[Math.floor((remaining.length - 1) / 2)] ?? null;
}

function inferPhaseByPosition(
  candidates: TrendExamCandidate[],
  selectedExamId: string,
): ScoreTrendPhaseKey {
  const index = candidates.findIndex((candidate) => candidate.id === selectedExamId);

  if (index <= 0) {
    return "baseline";
  }

  if (index >= candidates.length - 1) {
    return "final";
  }

  const ratio = index / Math.max(candidates.length - 1, 1);
  return ratio <= 0.45 ? "progress" : "midterm";
}

function getAttemptScore(
  attempt: DashboardApiPayload["attempts"][number],
): number | null {
  return attempt.result?.percentage ?? attempt.percentage ?? attempt.score ?? null;
}

function toStudentStatus(status: DashboardApiPayload["attempts"][number]["status"]): StudentStatus {
  switch (status) {
    case "in_progress":
      return "in-progress";
    case "processing":
      return "processing";
    case "submitted":
      return "submitted";
    case "approved":
      return "approved";
    default:
      return "processing";
  }
}

function compareReportStudents(left: ReportStudentRow, right: ReportStudentRow) {
  const rightScore = right.score ?? -1;
  const leftScore = left.score ?? -1;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  return left.name.localeCompare(right.name, "mn");
}

function combineWeakQuestions(reports: ExamReportData[]): WeakQuestion[] {
  const totals = new Map<
    string,
    { label: string; missedCount: number; prompt: string; totalCount: number }
  >();

  for (const question of reports.flatMap((report) => report.weakQuestions)) {
    const key = `${question.label}::${question.prompt}`;
    const current = totals.get(key) ?? {
      label: question.label,
      missedCount: 0,
      prompt: question.prompt,
      totalCount: 0,
    };

    current.missedCount += question.missedCount;
    current.totalCount += question.totalCount;
    totals.set(key, current);
  }

  return [...totals.values()]
    .map((question) => ({
      errorRate:
        question.totalCount > 0
          ? Math.round((question.missedCount / question.totalCount) * 100)
          : 0,
      label: question.label,
      missedCount: question.missedCount,
      prompt: question.prompt,
      totalCount: question.totalCount,
    }))
    .sort((left, right) => {
      if (right.errorRate !== left.errorRate) {
        return right.errorRate - left.errorRate;
      }

      return right.missedCount - left.missedCount;
    })
    .slice(0, 5);
}

function combineScoreTrendData(reports: ExamReportData[]): ReportScoreTrendData {
  const phases =
    reports.find((report) => report.scoreTrend.phases.length > 0)?.scoreTrend.phases ??
    SCORE_TREND_PHASES.map((phase) => ({
      examId: null,
      examTitle: null,
      key: phase.key,
      label: phase.label,
    }));

  return {
    phases,
    students: reports.flatMap((report) => report.scoreTrend.students),
  };
}

function combineRiskDistribution(reports: ExamReportData[]) {
  const totals = new Map<string, { color: string; name: string; value: number }>();

  for (const slice of reports.flatMap((report) => report.analytics.riskDistribution)) {
    const current = totals.get(slice.name) ?? {
      color: slice.color,
      name: slice.name,
      value: 0,
    };

    current.value += slice.value;
    totals.set(slice.name, current);
  }

  return [...totals.values()];
}

function combineScoreDistribution(reports: ExamReportData[]) {
  const totals = new Map<string, number>();

  for (const bucket of reports.flatMap((report) => report.scoreDistribution)) {
    totals.set(bucket.range, (totals.get(bucket.range) ?? 0) + bucket.count);
  }

  return [...totals.entries()].map(([range, count]) => ({
    count,
    range,
  }));
}

function resolveCombinedExamField(values: string[], fallback: string) {
  const uniqueValues = [...new Set(values.filter(Boolean))];

  return uniqueValues.length === 1 ? uniqueValues[0] : fallback;
}
