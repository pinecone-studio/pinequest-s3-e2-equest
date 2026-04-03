"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MOCK_SCORE_TREND_DATA } from "../lib/report-mock-data";
import { formatClassLabel } from "../lib/report-format";
import type {
  ReportScoreTrendData,
  ReportScoreTrendStudent,
} from "../lib/report-adapters";

interface ReportScoreChartProps {
  currentClassName: string;
  dataSource: "mock" | "real";
  aggregateClassLabel?: string | null;
  selectedClassName?: string | null;
  trend: ReportScoreTrendData;
}

interface TrendChartPoint {
  examTitle: string | null;
  label: string;
  score: number | null;
}

interface ResolvedTrendStudent extends ReportScoreTrendStudent {
  resolvedClassName: string;
}

interface ClassTrend {
  className: string;
  latestScore: number | null;
  overallDelta: number | null;
  points: TrendChartPoint[];
  recentDelta: number | null;
  studentCount: number;
}

interface ScoreTrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TrendChartPoint;
    value: number | null;
  }>;
}

interface ScoreAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    value?: string;
  };
}

export function ReportScoreChart({
  currentClassName,
  dataSource,
  aggregateClassLabel,
  selectedClassName: forcedClassName,
  trend,
}: ReportScoreChartProps) {
  const activeTrend = dataSource === "mock" ? MOCK_SCORE_TREND_DATA : trend;
  const resolvedStudents = useMemo(() => {
    return resolveTrendStudents(activeTrend, dataSource, currentClassName);
  }, [activeTrend, currentClassName, dataSource]);
  const allClassTrends = useMemo(() => {
    return buildClassTrends(activeTrend.phases, resolvedStudents);
  }, [activeTrend.phases, resolvedStudents]);
  const classTrends = useMemo(() => {
    if (aggregateClassLabel) {
      const aggregate = buildAggregateTrend(
        activeTrend.phases,
        resolvedStudents,
        aggregateClassLabel,
      );
      return aggregate ? [aggregate] : [];
    }

    if (!forcedClassName) {
      return allClassTrends;
    }

    return allClassTrends.filter((item) => item.className === forcedClassName);
  }, [
    activeTrend.phases,
    aggregateClassLabel,
    allClassTrends,
    forcedClassName,
    resolvedStudents,
  ]);
  const [selectedClassName, setSelectedClassName] = useState<string | null>(
    classTrends[0]?.className ?? currentClassName,
  );

  useEffect(() => {
    if (classTrends.length === 0) {
      if (selectedClassName !== null) {
        setSelectedClassName(null);
      }
      return;
    }

    if (forcedClassName) {
      if (selectedClassName !== forcedClassName) {
        setSelectedClassName(forcedClassName);
      }
      return;
    }

    if (!classTrends.some((item) => item.className === selectedClassName)) {
      setSelectedClassName(classTrends[0].className);
    }
  }, [classTrends, forcedClassName, selectedClassName]);

  const selectedClass = useMemo(() => {
    return (
      classTrends.find((item) => item.className === selectedClassName) ??
      classTrends[0] ??
      null
    );
  }, [classTrends, selectedClassName]);

  const chartPoints = selectedClass?.points ?? [];
  const scoredPoints = chartPoints.filter(
    (point): point is TrendChartPoint & { score: number } =>
      typeof point.score === "number",
  );
  const chartLineType =
    scoredPoints.length === chartPoints.length ? "natural" : "monotone";
  const overallTone = getDeltaTone(selectedClass?.overallDelta ?? null);
  const hasTrendData = classTrends.some((item) => {
    return item.points.some((point) => typeof point.score === "number");
  });
  const selectedClassLabel = selectedClass
    ? formatClassLabel(selectedClass.className)
    : "Бүгд";

  return (
    <Card className="h-[295px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
      <CardContent className="flex h-full flex-col pt-2 pb-1">
        {hasTrendData ? (
          selectedClass ? (
            <div className="flex h-full min-h-0 flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className=" gap-3">
                    <div className="flex items-center gap-3 text-[#1f2937]">
                      <LineChartIcon
                        className="h-6 w-6  text-[#0b5cad]"
                        strokeWidth={2.1}
                      />
                      <CardTitle className="text-lg font-semibold tracking-tight text-[#1f2937]">
                        Ангийн ахиц
                      </CardTitle>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {selectedClassLabel}
                      </span>
                    </div>

                    <div className="mt-0.5 pl-8" />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-1.5">
                  <HeaderStatCard
                    label="Дундаж"
                    tone="primary"
                    value={formatScore(selectedClass.latestScore)}
                  />
                  <HeaderStatCard
                    label="Нийт өсөлт"
                    tone={overallTone}
                    value={formatDelta(selectedClass.overallDelta)}
                  />
                  <HeaderStatCard
                    label="Сүүлийн өсөлт"
                    tone={getDeltaTone(selectedClass.recentDelta)}
                    value={formatDelta(selectedClass.recentDelta)}
                  />
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)]">
                <div className="h-full min-h-[156px] sm:min-h-[164px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={chartPoints}
                      margin={{ bottom: 18, left: 5, right: 0, top: 10 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="#eef3f8"
                        strokeDasharray="0"
                        strokeWidth={1}
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={{ stroke: "#c7d8ec", strokeWidth: 1.5 }}
                        interval={0}
                        padding={{ left: 22, right: 18 }}
                        tick={<ScoreAxisTick />}
                        tickLine={false}
                        tickMargin={18}
                      />
                      <YAxis
                        axisLine={false}
                        domain={[0, 100]}
                        tick={{
                          fill: "#6b7280",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(value) => `${value}`}
                        tickLine={false}
                        tickMargin={22}
                        width={54}
                      />
                      <Tooltip
                        content={<ScoreTrendTooltip />}
                        cursor={false}
                        offset={8}
                        wrapperStyle={{
                          outline: "none",
                          pointerEvents: "none",
                        }}
                      />
                      <Line
                        type={chartLineType}
                        dataKey="score"
                        stroke="#0b5cad"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        connectNulls={false}
                        dot={{
                          fill: "#ffffff",
                          r: 5.5,
                          stroke: "#0b5cad",
                          strokeWidth: 3,
                        }}
                        activeDot={{
                          fill: "#ffffff",
                          r: 6.5,
                          stroke: "#0b5cad",
                          strokeWidth: 3,
                        }}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
              Харагдах ангийн ахицын өгөгдөл алга.
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            Ангийн ахицын график гаргах хангалттай өгөгдөл алга.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreTrendTooltip({ active, payload }: ScoreTrendTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm">
      <p className="text-[10px] font-medium text-slate-600">
        {formatTooltipPhaseLabel(point.label)}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-none text-[#0b5cad]">
        {formatScore(point.score)}
      </p>
    </div>
  );
}

function formatTooltipPhaseLabel(label: string): string {
  switch (label) {
    case "Т/Т":
      return "Түвшин тогтоох";
    case "У/Д":
      return "Улирлын дунд";
    case "У/Э":
      return "Жилийн эцэс";
    default:
      return label;
  }
}

function ScoreAxisTick({ payload, x = 0, y = 0 }: ScoreAxisTickProps) {
  const value = payload?.value ?? "";
  const words = value.split(" ");
  const shouldWrap = value.length > 16 && words.length > 2;
  const splitIndex = shouldWrap ? Math.ceil(words.length / 2) : words.length;
  const lines = shouldWrap
    ? [words.slice(0, splitIndex).join(" "), words.slice(splitIndex).join(" ")]
    : [value];

  return (
    <text
      x={x}
      y={y + 18}
      textAnchor="middle"
      fill="#4b5563"
      fontSize="13"
      fontWeight="600"
    >
      {lines.slice(0, 2).map((line, index) => (
        <tspan key={`${value}-${index}`} x={x} dy={index === 0 ? 0 : 16}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function HeaderStatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "down" | "neutral" | "primary" | "up";
  value: string;
}) {
  const toneClassName =
    tone === "primary"
      ? "text-[#0b5cad]"
      : tone === "up"
        ? "text-emerald-600"
        : tone === "down"
          ? "text-rose-600"
          : "text-slate-700";

  return (
    <div className="min-w-[72px] rounded-[16px] border border-slate-200 bg-white px-2.5 py-2 text-center shadow-[0_12px_22px_-24px_rgba(15,23,42,0.28)]">
      <p className={cn("text-[0.82rem] font-bold leading-none", toneClassName)}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">
        {label}
      </p>
    </div>
  );
}

function buildClassTrends(
  phases: ReportScoreTrendData["phases"],
  students: ResolvedTrendStudent[],
): ClassTrend[] {
  const groups = new Map<string, ResolvedTrendStudent[]>();

  for (const student of students) {
    const current = groups.get(student.resolvedClassName) ?? [];
    current.push(student);
    groups.set(student.resolvedClassName, current);
  }

  return [...groups.entries()]
    .map(([className, classStudents]) =>
      buildTrendSummary(className, phases, classStudents),
    )
    .sort((left, right) => {
      return formatClassLabel(left.className).localeCompare(
        formatClassLabel(right.className),
        "mn",
      );
    });
}

function buildAggregateTrend(
  phases: ReportScoreTrendData["phases"],
  students: ResolvedTrendStudent[],
  label: string,
): ClassTrend | null {
  if (students.length === 0) {
    return null;
  }

  return buildTrendSummary(label, phases, students);
}

function buildTrendSummary(
  className: string,
  phases: ReportScoreTrendData["phases"],
  students: ResolvedTrendStudent[],
): ClassTrend {
  const points = phases.map((phase) => {
    const scores = students
      .map((student) => {
        return (
          student.points.find((point) => point.key === phase.key)?.score ?? null
        );
      })
      .filter((score): score is number => typeof score === "number");

    return {
      examTitle: phase.examTitle,
      label: formatPhaseLabel(phase.label),
      score: scores.length > 0 ? roundToOneDecimal(average(scores)) : null,
    };
  });

  const availableScores = points
    .map((point) => point.score)
    .filter((score): score is number => typeof score === "number");
  const latestScore =
    availableScores.length > 0
      ? availableScores[availableScores.length - 1]
      : null;
  const overallDelta =
    availableScores.length >= 2
      ? roundToOneDecimal(
          availableScores[availableScores.length - 1] - availableScores[0],
        )
      : null;
  const recentDelta =
    availableScores.length >= 2
      ? roundToOneDecimal(
          availableScores[availableScores.length - 1] -
            availableScores[availableScores.length - 2],
        )
      : null;

  return {
    className,
    latestScore,
    overallDelta,
    points,
    recentDelta,
    studentCount: students.length,
  };
}

function formatPhaseLabel(label: string): string {
  switch (label) {
    case "Түвшин тогтоох":
      return "Т/Т";
    case "Явц":
      return "Явц";
    case "Улирлын дунд":
      return "У/Д";
    case "Жилийн эцэс":
    case "Улирлын эцэс":
      return "У/Э";
    default:
      return label;
  }
}

function resolveStudentClassName(
  student: ReportScoreTrendStudent,
  dataSource: "mock" | "real",
  fallbackClassName: string,
): string {
  if (student.className.trim().length > 0) {
    return student.className;
  }

  if (dataSource === "mock") {
    const prefix = student.studentCode.match(/^\d+[A-Z]/)?.[0];
    if (prefix) {
      return prefix;
    }
  }

  return fallbackClassName;
}

function resolveTrendStudents(
  trend: ReportScoreTrendData,
  dataSource: "mock" | "real",
  fallbackClassName: string,
): ResolvedTrendStudent[] {
  return trend.students.map((student) => ({
    ...student,
    resolvedClassName: resolveStudentClassName(
      student,
      dataSource,
      fallbackClassName,
    ),
  }));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function formatScore(value: number | null): string {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number | null): string {
  if (typeof value !== "number") {
    return "--";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getDeltaTone(value: number | null): "down" | "neutral" | "up" {
  if (typeof value !== "number" || value === 0) {
    return "neutral";
  }

  return value > 0 ? "up" : "down";
}
