"use client";

import { useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Clock3,
  Download,
  Minus,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  ReportScoreTrendData,
  ReportScoreTrendStudent,
  ReportStudentRow,
} from "../lib/report-adapters";

type KnowledgeLevelKey =
  | "excellent"
  | "good"
  | "fair"
  | "needs-improvement"
  | "ungraded";

interface TableDisplayRow extends ReportStudentRow {
  knowledgeLevel: KnowledgeLevel;
  position: number;
  progressComparison: ProgressComparison | null;
  trendPoints: ReportScoreTrendStudent["points"];
}

interface KnowledgeLevel {
  key: KnowledgeLevelKey;
  label: string;
}

interface ProgressComparison {
  currentLabel: string;
  currentScore: number;
  delta: number;
  previousLabel: string;
  previousScore: number;
}

interface ReportResultsTableProps {
  currentClassName: string;
  currentExamId: string;
  rows: ReportStudentRow[];
  trend: ReportScoreTrendData;
}

const KNOWLEDGE_LEVEL_OPTIONS: Array<{
  key: Exclude<KnowledgeLevelKey, "ungraded">;
  label: string;
}> = [
  { key: "excellent", label: "Маш сайн" },
  { key: "good", label: "Сайн" },
  { key: "fair", label: "Хангалттай" },
  { key: "needs-improvement", label: "Сайжруулах шаардлагатай" },
];

export function ReportResultsTable({
  currentClassName,
  currentExamId,
  rows,
  trend,
}: ReportResultsTableProps) {
  const [search, setSearch] = useState("");
  const [knowledgeFilter, setKnowledgeFilter] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const tableRows = useMemo(() => {
    const trendStudentsById = new Map(
      trend.students.map((student) => [student.id, student] as const),
    );

    return rows.map((row, index): TableDisplayRow => {
      const studentTrend = trendStudentsById.get(row.id);

      return {
        ...row,
        knowledgeLevel: getKnowledgeLevel(row.score),
        position: index + 1,
        progressComparison: getSelectedExamProgress(
          studentTrend,
          trend,
          currentExamId,
        ),
        trendPoints: studentTrend?.points ?? [],
      };
    });
  }, [currentExamId, rows, trend]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tableRows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.studentCode.toLowerCase().includes(normalizedSearch);
      const matchesKnowledge =
        knowledgeFilter === "all" || row.knowledgeLevel.key === knowledgeFilter;

      return matchesSearch && matchesKnowledge;
    });
  }, [knowledgeFilter, search, tableRows]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) {
      return null;
    }

    return tableRows.find((row) => row.id === selectedStudentId) ?? null;
  }, [selectedStudentId, tableRows]);

  const handleExport = () => {
    const csv = [
      [
        "№",
        "Сурагч",
        "Код",
        "Анги",
        "Мэдлэгийн түвшин",
        "Оноо",
        "Байр",
        "Ахиц",
      ].join(","),
      ...filteredRows.map((row) =>
        [
          row.position,
          escapeCsv(row.name),
          escapeCsv(row.studentCode),
          escapeCsv(row.className),
          escapeCsv(row.knowledgeLevel.label),
          row.score?.toFixed(1) ?? "",
          escapeCsv(formatPosition(row.position)),
          escapeCsv(formatProgressForExport(row.progressComparison)),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `exam-report-${currentClassName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="overflow-hidden rounded-[24px] border border-[#e6edf7] bg-white py-0 shadow-[0_20px_48px_-40px_rgba(15,23,42,0.24)]">
        <CardHeader className="border-b border-[#e9eef6] px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="relative min-w-[240px] flex-1 sm:flex-none">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a94a6]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Сурагчийн нэрээр хайх..."
                  className="h-11 rounded-xl border-0 bg-[#f5f7fb] pl-10 text-sm text-[#1f2937] shadow-none placeholder:text-[#9aa3b2] focus-visible:ring-2 focus-visible:ring-[#bfdbfe]"
                />
              </div>
              <Select value={knowledgeFilter} onValueChange={setKnowledgeFilter}>
                <SelectTrigger className="h-11 min-w-[210px] rounded-xl border-0 bg-[#f5f7fb] px-4 text-sm font-medium text-[#1f2937] shadow-none focus-visible:ring-2 focus-visible:ring-[#bfdbfe]">
                  <span className="truncate">
                    {knowledgeFilter === "all"
                      ? "Мэдлэгийн түвшин"
                      : KNOWLEDGE_LEVEL_OPTIONS.find(
                          (option) => option.key === knowledgeFilter,
                        )?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Бүх түвшин</SelectItem>
                  {KNOWLEDGE_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleExport}
                className="h-11 rounded-xl bg-[#0b5cad] px-4 text-sm font-semibold text-white shadow-[0_16px_24px_-20px_rgba(11,92,173,0.9)] hover:bg-[#0a4d92]"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Татах
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <ScrollArea className="max-h-[500px]">
            <Table className="min-w-[1160px]">
              <TableHeader className="sticky top-0 z-10 bg-[#f5f7fb]">
                <TableRow className="border-[#e9eef6] hover:bg-[#f5f7fb]">
                  <TableHead className="w-[64px] px-6 py-4 text-center text-[13px] font-semibold text-[#4b5563]">
                    №
                  </TableHead>
                  <TableHead className="py-4 text-[13px] font-semibold text-[#4b5563]">
                    Сурагчийн нэр
                  </TableHead>
                  <TableHead className="py-4 text-[13px] font-semibold text-[#4b5563]">
                    Анги
                  </TableHead>
                  <TableHead className="py-4 text-[13px] font-semibold text-[#4b5563]">
                    Мэдлэгийн түвшин
                  </TableHead>
                  <TableHead className="py-4 text-[13px] font-semibold text-[#4b5563]">
                    Дундаж оноо
                  </TableHead>
                  <TableHead className="py-4 text-[13px] font-semibold text-[#4b5563]">
                    Байр
                  </TableHead>
                  <TableHead className="py-4 text-[13px] font-semibold text-[#4b5563]">
                    Ахиц
                  </TableHead>
                  <TableHead className="pr-6 py-4 text-right text-[13px] font-semibold text-[#4b5563]">
                    Үйлдэл
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-[#e9eef6] bg-white hover:bg-[#fbfcfe]"
                  >
                    <TableCell className="px-6 py-4 text-center">
                      <span className="text-[15px] font-semibold text-[#1f2937]">
                        {row.position}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size="default"
                          className="h-8 w-8 border border-[#e5e7eb] bg-[#d7d9dd] shadow-none after:border-white/50"
                        >
                          <AvatarFallback className="bg-[#d7d9dd] text-xs font-semibold text-[#4b5563]">
                            {getInitials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-[#111827]">
                            {row.name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-[15px] font-semibold text-[#1f2937]">
                      {row.className}
                    </TableCell>
                    <TableCell className="py-4">
                      <KnowledgeLevelBadge level={row.knowledgeLevel} />
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-[15px] font-semibold text-[#1f2937]">
                        {row.score !== null ? `${row.score.toFixed(1)}%` : "--"}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-[15px] font-semibold text-[#1f2937]">
                        {formatPosition(row.position)}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <ProgressSummary comparison={row.progressComparison} />
                    </TableCell>
                    <TableCell className="pr-6 py-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg border-[#dbe4f0] bg-white px-3 text-[13px] font-semibold text-[#0b5cad] shadow-none hover:bg-[#eff6ff] hover:text-[#0b5cad]"
                        onClick={() => setSelectedStudentId(row.id)}
                      >
                        Дэлгэрэнгүй
                        <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-6 py-16 text-center text-sm text-[#8a94a6]"
                    >
                      Шүүлтүүртэй тохирох дүн олдсонгүй.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudentId(null);
          }
        }}
      >
        {selectedStudent ? (
          <DialogContent className="max-w-4xl overflow-hidden rounded-[28px] border border-[#e6edf7] bg-white p-0 sm:max-w-4xl">
            <DialogHeader className="border-b border-[#e9eef6] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <Avatar
                    size="default"
                    className="h-14 w-14 border border-[#d8e2ef] bg-[#d7d9dd] shadow-none after:border-white/50"
                  >
                    <AvatarFallback className="bg-[#d7d9dd] text-base font-semibold text-[#4b5563]">
                      {getInitials(selectedStudent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-semibold text-[#111827]">
                      {selectedStudent.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-[#6b7280]">
                      {selectedStudent.studentCode} • {selectedStudent.className}{" "}
                      анги
                    </DialogDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <KnowledgeLevelBadge level={selectedStudent.knowledgeLevel} />
                      <StatusBadge status={selectedStudent.status} />
                      <RiskBadge risk={selectedStudent.riskLevel} />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e6edf7] bg-[#f8fbff] px-4 py-3 text-left sm:min-w-[180px] sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a94a6]">
                    Одоогийн оноо
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[#0f172a]">
                    {formatScoreValue(selectedStudent.score)}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 px-5 py-5 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailStatCard
                    label="Шалгалтын оноо"
                    value={formatScoreValue(selectedStudent.score)}
                    description="Тухайн тайланд харагдаж буй шалгалтын оноо"
                  />
                  <DetailStatCard
                    label="Анги доторх байр"
                    value={formatPosition(selectedStudent.position)}
                    description="Онооны эрэмбээр автоматаар тооцоолсон"
                  />
                  <DetailStatCard
                    label="Ахиц"
                    value={formatDeltaValue(selectedStudent.progressComparison?.delta)}
                    valueClassName={getDeltaValueClassName(
                      selectedStudent.progressComparison?.delta ?? null,
                    )}
                    description={formatProgressDescription(
                      selectedStudent.progressComparison,
                    )}
                  />
                  <DetailStatCard
                    label="Хяналтын дохио"
                    value={`${selectedStudent.warningCount + selectedStudent.dangerCount}`}
                    description={`${selectedStudent.warningCount} анхааруулга • ${selectedStudent.dangerCount} аюултай дохио`}
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] border border-[#e6edf7] bg-[#fbfcfe] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-[#111827]">
                          Шалгалтын явц
                        </h3>
                        <p className="mt-1 text-sm text-[#8a94a6]">
                          Өмнөх шалгалтуудтай харьцуулсан онооны түүх
                        </p>
                      </div>
                      <ProgressChip
                        delta={selectedStudent.progressComparison?.delta ?? null}
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedStudent.trendPoints.length > 0 ? (
                        selectedStudent.trendPoints.map((point) => (
                          <TrendPointCard
                            key={`${selectedStudent.id}-${point.key}`}
                            point={point}
                            isCurrent={point.examId === currentExamId}
                          />
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[#dbe4f0] bg-white px-4 py-10 text-center text-sm text-[#8a94a6]">
                          Энэ сурагчийн өмнөх онооны мэдээлэл олдсонгүй.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-[#e6edf7] bg-white p-4 sm:p-5">
                      <h3 className="text-base font-semibold text-[#111827]">
                        Сурагчийн мэдээлэл
                      </h3>
                      <div className="mt-4 space-y-4">
                        <DetailField
                          icon={CalendarClock}
                          label="Илгээсэн хугацаа"
                          value={formatOptionalDateTime(selectedStudent.submittedAt)}
                        />
                        <DetailField
                          icon={Clock3}
                          label="Сүүлийн идэвх"
                          value={formatDateTime(selectedStudent.lastActivity)}
                        />
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#e6edf7] bg-white p-4 sm:p-5">
                      <h3 className="text-base font-semibold text-[#111827]">
                        Хяналтын тэмдэглэгээ
                      </h3>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MonitoringStatCard
                          icon={AlertTriangle}
                          label="Анхааруулга"
                          tone="warning"
                          value={selectedStudent.warningCount}
                        />
                        <MonitoringStatCard
                          icon={AlertOctagon}
                          label="Аюултай дохио"
                          tone="danger"
                          value={selectedStudent.dangerCount}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function ProgressSummary({
  comparison,
}: {
  comparison: ProgressComparison | null;
}) {
  return <ProgressChip delta={comparison?.delta ?? null} />;
}

function KnowledgeLevelBadge({ level }: { level: KnowledgeLevel }) {
  const styles: Record<KnowledgeLevelKey, string> = {
    excellent:
      "border-transparent bg-[#d8ead9] text-[#14711d] shadow-[0_10px_22px_-18px_rgba(20,113,29,0.75)]",
    fair: "border-transparent bg-[#e5e7eb] text-[#4b5563]",
    good: "border-transparent bg-[#d7e7f8] text-[#0b5cad]",
    "needs-improvement":
      "border-transparent bg-[#fde2d4] text-[#ef6b20] shadow-[0_10px_22px_-18px_rgba(239,107,32,0.65)]",
    ungraded: "border-transparent bg-[#eef2f7] text-[#64748b]",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-auto rounded-full px-3 py-1 text-xs font-semibold",
        styles[level.key],
      )}
    >
      {level.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: ReportStudentRow["status"] }) {
  const styles: Record<string, { className: string; label: string }> = {
    "in-progress": {
      className: "border-transparent bg-[#dceefe] text-[#0b5cad]",
      label: "Явагдаж байна",
    },
    approved: {
      className: "border-transparent bg-[#d8ead9] text-[#14711d]",
      label: "Баталгаажсан",
    },
    processing: {
      className: "border-transparent bg-[#fff2d8] text-[#b7791f]",
      label: "Боловсруулж байна",
    },
    submitted: {
      className: "border-transparent bg-[#ecebff] text-[#5b57d1]",
      label: "Илгээсэн",
    },
  };

  const config = styles[status] ?? {
    className: "border-transparent bg-[#eef2f7] text-[#64748b]",
    label: status,
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-auto rounded-full px-3 py-1 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}

function RiskBadge({ risk }: { risk: ReportStudentRow["riskLevel"] }) {
  const styles: Record<ReportStudentRow["riskLevel"], string> = {
    high: "border-transparent bg-[#fde2d4] text-[#ef6b20]",
    low: "border-transparent bg-[#d8ead9] text-[#14711d]",
    medium: "border-transparent bg-[#fff2d8] text-[#b7791f]",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-auto rounded-full px-3 py-1 text-xs font-semibold",
        styles[risk],
      )}
    >
      {formatRiskLabel(risk)}
    </Badge>
  );
}

function DetailStatCard({
  description,
  label,
  value,
  valueClassName,
}: {
  description: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#e6edf7] bg-white px-4 py-4 shadow-[0_14px_30px_-30px_rgba(15,23,42,0.45)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94a6]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold text-[#0f172a]",
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">{description}</p>
    </div>
  );
}

function TrendPointCard({
  isCurrent,
  point,
}: {
  isCurrent: boolean;
  point: ReportScoreTrendStudent["points"][number];
}) {
  const score = typeof point.score === "number" ? point.score : null;
  const hasScore = score !== null;

  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-4 transition-colors",
        isCurrent
          ? "border-[#bfdbfe] bg-[#eff6ff]"
          : "border-[#e6edf7] bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#111827]">{point.label}</p>
          <p className="mt-1 text-xs leading-5 text-[#8a94a6]">
            {point.examTitle ?? "Шалгалтын нэргүй"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-[#111827]">
            {hasScore ? `${score.toFixed(1)}%` : "--"}
          </p>
          {isCurrent ? (
            <span className="mt-1 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[#0b5cad] shadow-[0_12px_24px_-18px_rgba(11,92,173,0.6)]">
              Одоогийн
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5edf7]">
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-300",
            hasScore
              ? isCurrent
                ? "bg-[#0b5cad]"
                : "bg-[#8dbcf0]"
              : "bg-[#d7dde7]",
          )}
          style={{
            width: hasScore ? `${clampPercentage(score)}%` : "0%",
          }}
        />
      </div>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-[#f8fafc] px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0b5cad] shadow-[0_10px_24px_-20px_rgba(11,92,173,0.9)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94a6]">
          {label}
        </p>
        <p className="mt-1 text-sm font-medium leading-6 text-[#111827]">
          {value}
        </p>
      </div>
    </div>
  );
}

function MonitoringStatCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof AlertTriangle;
  label: string;
  tone: "danger" | "warning";
  value: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4",
        tone === "warning"
          ? "border-[#fde7c2] bg-[#fff8eb]"
          : "border-[#f6d3c4] bg-[#fff4ef]",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            tone === "warning" ? "bg-[#fff1d6]" : "bg-[#fee5d9]",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "warning" ? "text-[#b7791f]" : "text-[#ef6b20]",
            )}
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">{label}</p>
          <p className="text-xs text-[#8a94a6]">Автомат хяналтын тэмдэглэгээ</p>
        </div>
      </div>

      <p className="mt-4 text-2xl font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function ProgressChip({ delta }: { delta: number | null }) {
  if (typeof delta !== "number") {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#eef2f7] px-2 py-1 text-[11px] font-semibold text-[#64748b]">
        <Minus className="h-3 w-3" />
        --
      </span>
    );
  }

  if (delta === 0) {
    return (
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#eef2f7] px-2 py-1 text-[11px] font-semibold text-[#64748b]">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80">
          <Minus className="h-3 w-3" />
        </span>
        0.0%
      </span>
    );
  }

  const isPositive = delta > 0;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
        isPositive
          ? "bg-[#e8f7ee] text-[#15803d] shadow-[0_16px_30px_-20px_rgba(21,128,61,0.95)]"
          : "bg-[#fdecec] text-[#dc2626] shadow-[0_16px_30px_-20px_rgba(220,38,38,0.9)]",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full",
          isPositive ? "bg-[#c9edd8]" : "bg-[#f9d2d2]",
        )}
      >
        {isPositive ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownRight className="h-3 w-3" />
        )}
      </span>
      {`${Math.abs(delta).toFixed(1)}%`}
    </span>
  );
}

function getKnowledgeLevel(score: number | null): KnowledgeLevel {
  if (typeof score !== "number") {
    return { key: "ungraded", label: "Үнэлгээгүй" };
  }

  if (score >= 90) {
    return { key: "excellent", label: "Маш сайн" };
  }

  if (score >= 75) {
    return { key: "good", label: "Сайн" };
  }

  if (score >= 60) {
    return { key: "fair", label: "Хангалттай" };
  }

  return { key: "needs-improvement", label: "Сайжруулах шаардлагатай" };
}

function getSelectedExamProgress(
  studentTrend: ReportScoreTrendStudent | undefined,
  trend: ReportScoreTrendData,
  currentExamId: string,
): ProgressComparison | null {
  if (!studentTrend) {
    return null;
  }

  const currentIndex = trend.phases.findIndex(
    (phase) => phase.examId === currentExamId,
  );

  if (currentIndex !== -1) {
    const currentPoint = studentTrend.points[currentIndex];
    if (typeof currentPoint?.score !== "number") {
      return null;
    }

    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const previousPoint = studentTrend.points[index];

      if (typeof previousPoint?.score === "number") {
        return {
          currentLabel: currentPoint.label,
          currentScore: currentPoint.score,
          delta: Number((currentPoint.score - previousPoint.score).toFixed(1)),
          previousLabel: previousPoint.label,
          previousScore: previousPoint.score,
        };
      }
    }

    return null;
  }

  const availablePoints = studentTrend.points.filter(
    (point): point is typeof point & { score: number } =>
      typeof point.score === "number",
  );
  if (availablePoints.length < 2) {
    return null;
  }

  const currentPoint = availablePoints[availablePoints.length - 1];
  const previousPoint = availablePoints[availablePoints.length - 2];

  return {
    currentLabel: currentPoint.label,
    currentScore: currentPoint.score,
    delta: Number((currentPoint.score - previousPoint.score).toFixed(1)),
    previousLabel: previousPoint.label,
    previousScore: previousPoint.score,
  };
}

function formatPosition(position: number) {
  return `${position}-р байр`;
}

function formatProgressForExport(comparison: ProgressComparison | null) {
  if (!comparison) {
    return "--";
  }

  const sign = comparison.delta > 0 ? "+" : "";

  return `${comparison.previousLabel} ${comparison.previousScore.toFixed(1)}% -> ${comparison.currentLabel} ${comparison.currentScore.toFixed(1)}% (${sign}${comparison.delta.toFixed(1)}%)`;
}

function formatProgressDescription(comparison: ProgressComparison | null) {
  if (!comparison) {
    return "Өмнөх харьцуулах шалгалтын оноо олдсонгүй.";
  }

  return `${comparison.previousLabel} ${comparison.previousScore.toFixed(1)}%-аас ${comparison.currentLabel} ${comparison.currentScore.toFixed(1)}% болсон.`;
}

function formatDeltaValue(delta: number | null | undefined) {
  if (typeof delta !== "number") {
    return "--";
  }

  if (delta > 0) {
    return `+${delta.toFixed(1)}%`;
  }

  return `${delta.toFixed(1)}%`;
}

function getDeltaValueClassName(delta: number | null) {
  if (typeof delta !== "number") {
    return "text-[#64748b]";
  }

  if (delta > 0) {
    return "text-[#15803d]";
  }

  if (delta < 0) {
    return "text-[#dc2626]";
  }

  return "text-[#64748b]";
}

function formatScoreValue(score: number | null) {
  return typeof score === "number" ? `${score.toFixed(1)}%` : "--";
}

function formatOptionalDateTime(date: Date | null) {
  if (!date) {
    return "Мэдээлэлгүй";
  }

  return formatDateTime(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("mn-MN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRiskLabel(risk: ReportStudentRow["riskLevel"]) {
  const labels: Record<ReportStudentRow["riskLevel"], string> = {
    high: "Өндөр эрсдэл",
    low: "Бага эрсдэл",
    medium: "Дунд эрсдэл",
  };

  return labels[risk];
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
