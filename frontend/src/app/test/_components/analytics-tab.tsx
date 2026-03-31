"use client";

import { AiContentBadge } from "@/components/ai-content-badge";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExamAnalytics, ExamFocusAnalysis } from "../lib/types";

interface AnalyticsTabProps {
  analytics: ExamAnalytics;
  focusAnalysis?: ExamFocusAnalysis | null;
  focusAnalysisError?: string | null;
  isFocusAnalysisLoading?: boolean;
}

export function AnalyticsTab({
  analytics,
  focusAnalysis,
  focusAnalysisError,
  isFocusAnalysisLoading = false,
}: AnalyticsTabProps) {
  const riskTotal = analytics.riskDistribution.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const focusAreas =
    focusAnalysis && focusAnalysis.areas.length > 0
      ? focusAnalysis.areas
      : analytics.focusAreas;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            Онооны хуваарилалт
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.scoreDistribution}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="range"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--accent))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            Эрсдэлийн профайл
          </h3>
          <div className="h-64">
            {riskTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {analytics.riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="Эрсдэлийн өгөгдөл алга" />
            )}
          </div>
          <div className="mt-4 flex justify-center gap-6">
            {analytics.riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Сул чадварууд
              </h3>
              <div className="mt-2">
                <AiContentBadge source={focusAnalysis?.source} />
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isFocusAnalysisLoading
                  ? "Ollama анализ шинэчилж байна..."
                  : focusAnalysisError
                    ? focusAnalysisError
                    : focusAnalysis?.summary ??
                      "Шалгалтын асуулт, competency, алдааны давтамжаас гаргасан AI analysis"}
              </p>
            </div>
            <div className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {focusAnalysis?.source === "ollama"
                ? "Ollama AI"
                : focusAnalysis?.source === "gemini"
                  ? "Gemini AI"
                  : "Rule fallback"}
            </div>
          </div>
          <div className="space-y-3">
            {focusAreas.length > 0 ? (
              focusAreas.map((area) => (
                <div
                  key={area.topic}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{area.topic}</p>
                    {area.insight ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {area.insight}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-danger"
                        style={{ width: `${100 - area.avgScore}%` }}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">
                        {area.avgScore}%
                      </p>
                      {typeof area.affectedStudents === "number" ? (
                        <p className="text-[11px] text-muted-foreground">
                          {area.affectedStudents} сурагч
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyList label="Чадварын задаргаа хараахан үүсээгүй" />
            )}
          </div>
        </Card>

        <Card className="border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            Удаан хариулсан асуултууд
          </h3>
          <div className="space-y-3">
            {analytics.slowestQuestions.length > 0 ? (
              analytics.slowestQuestions.map((question) => (
                <div
                  key={question.question}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-muted-foreground">
                    {question.question}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {question.avgTime}
                    </span>
                    <div
                      className="h-1.5 rounded-full bg-warning"
                      style={{ width: `${question.relativeTime}px` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyList label="Хугацааны metric алга" />
            )}
          </div>
        </Card>

        <Card className="border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            Хамгийн их өөрчилсөн хариултууд
          </h3>
          <div className="space-y-3">
            {analytics.answerChanges.length > 0 ? (
              analytics.answerChanges.map((answer) => (
                <div
                  key={answer.question}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-muted-foreground">
                    {answer.question}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {answer.changes} өөрчлөлт
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({answer.students} оролдлого)
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyList label="Хариу өөрчилсөн түүх алга" />
            )}
          </div>
        </Card>
      </div>

      <Card className="border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Аюултай үйлдлийн цаг хугацаа
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Цагийн огтлол дээр warning болон danger signal хэрхэн өссөнийг
              харуулна
            </p>
          </div>
          <div className="rounded-full border border-danger/20 bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
            High visibility mode
          </div>
        </div>
        <div className="rounded-2xl border border-danger/15 bg-[linear-gradient(180deg,rgba(255,247,237,0.85),rgba(255,255,255,1))] p-4">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-3 py-1.5 text-xs font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-warning" />
              Анхааруулга
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-danger/20 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" />
              Аюултай үйлдэл
            </div>
          </div>
          <div className="h-56">
            {analytics.dangerTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.dangerTimeline}>
                  <defs>
                    <linearGradient
                      id="warningTimelineFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--warning))"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--warning))"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient
                      id="dangerTimelineFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--danger))"
                        stopOpacity={0.38}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--danger))"
                        stopOpacity={0.06}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="4 4"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="time"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="warnings"
                    stroke="hsl(var(--warning))"
                    fill="url(#warningTimelineFill)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "hsl(var(--card))",
                      fill: "hsl(var(--warning))",
                    }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 3,
                      stroke: "hsl(var(--card))",
                      fill: "hsl(var(--warning))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="dangers"
                    stroke="hsl(var(--danger))"
                    fill="url(#dangerTimelineFill)"
                    strokeWidth={4}
                    dot={{
                      r: 4.5,
                      strokeWidth: 2,
                      stroke: "hsl(var(--card))",
                      fill: "hsl(var(--danger))",
                    }}
                    activeDot={{
                      r: 7,
                      strokeWidth: 3,
                      stroke: "hsl(var(--card))",
                      fill: "hsl(var(--danger))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dangers"
                    stroke="hsl(var(--danger))"
                    strokeWidth={4}
                    dot={false}
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="Хяналтын үйл явдлын timeline алга" />
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Анхааруулга</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-danger" />
            <span className="text-xs text-muted-foreground">
              Аюултай үйлдэл
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/30 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function EmptyList({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
