"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TestShell } from "../_components/test-shell";
import {
  buildExamList,
  type DashboardApiPayload,
} from "../live-dashboard/lib/dashboard-adapters";
import type { Exam } from "../live-dashboard/lib/types";
import { ExamReport } from "./_components/exam-report";
import { buildExamReportData, combineExamReports } from "./lib/report-adapters";
import {
  buildMockExamReportData,
  MOCK_REPORT_EXAMS,
} from "./lib/report-mock-data";
import { fetchTakeExamDashboard } from "@/lib/take-exam-dashboard-api";
import {
  formatGroupLabel,
  getMongolianLetterOrder,
  parseClassName,
} from "./lib/report-format";

const POLL_INTERVAL_MS = 30_000;
const ALL_GRADES_VALUE = "all";
const ALL_GROUPS_VALUE = "all";
type ReportDataSource = "mock" | "real";
const TAKE_EXAM_GRAPHQL_URL =
  "https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

export default function ExamReportPage() {
  const [dataSource, setDataSource] = useState<ReportDataSource>("real");
  const [selectedGrade, setSelectedGrade] = useState<string>(ALL_GRADES_VALUE);
  const [selectedGroup, setSelectedGroup] = useState<string>(ALL_GROUPS_VALUE);
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const nextPayload = await fetchTakeExamDashboard(
        80,
        null,
        TAKE_EXAM_GRAPHQL_URL,
      );

      setPayload(nextPayload);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Тайлан ачаалах үед алдаа гарлаа.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dataSource !== "real") {
      setIsLoading(false);
      setError(null);
      return;
    }

    void loadDashboard(true);

    const intervalId = window.setInterval(() => {
      void loadDashboard(false);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dataSource, loadDashboard]);

  const reportExams = useMemo(() => {
    if (dataSource === "mock") {
      return MOCK_REPORT_EXAMS;
    }

    if (!payload) {
      return [];
    }

    return buildExamList(payload).filter((exam) => exam.totalStudentCount > 0);
  }, [dataSource, payload]);

  const classOptions = useMemo(() => {
    return [...new Set(reportExams.map((exam) => exam.class))].sort(
      (left, right) => {
        return left.localeCompare(right, "mn");
      },
    );
  }, [reportExams]);

  const classMeta = useMemo(() => {
    return classOptions.map((className) => ({
      className,
      ...parseClassName(className),
    }));
  }, [classOptions]);

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>();
    for (const item of classMeta) {
      if (item.grade) {
        grades.add(item.grade);
      }
    }

    return [...grades].sort((left, right) => Number(left) - Number(right));
  }, [classMeta]);

  const groupOptions = useMemo(() => {
    if (selectedGrade === ALL_GRADES_VALUE) {
      return [];
    }

    const groups = new Set<string>();
    for (const item of classMeta) {
      if (item.grade === selectedGrade && item.group) {
        groups.add(item.group);
      }
    }

    return [...groups].sort((left, right) => {
      return getMongolianLetterOrder(left) - getMongolianLetterOrder(right);
    });
  }, [classMeta, selectedGrade]);

  useEffect(() => {
    if (
      selectedGrade !== ALL_GRADES_VALUE &&
      !gradeOptions.includes(selectedGrade)
    ) {
      setSelectedGrade(ALL_GRADES_VALUE);
    }
  }, [gradeOptions, selectedGrade]);

  useEffect(() => {
    if (selectedGrade === ALL_GRADES_VALUE) {
      if (selectedGroup !== ALL_GROUPS_VALUE) {
        setSelectedGroup(ALL_GROUPS_VALUE);
      }
      return;
    }

    if (
      selectedGroup !== ALL_GROUPS_VALUE &&
      !groupOptions.includes(selectedGroup)
    ) {
      setSelectedGroup(ALL_GROUPS_VALUE);
    }
  }, [groupOptions, selectedGrade, selectedGroup]);

  const selectedExamIds = useMemo(() => {
    if (reportExams.length === 0) {
      return [];
    }

    if (selectedGrade === ALL_GRADES_VALUE) {
      return pickLatestExamIdsByClass(reportExams);
    }

    if (selectedGroup === ALL_GROUPS_VALUE) {
      const gradeExams = reportExams.filter((exam) => {
        return parseClassName(exam.class).grade === selectedGrade;
      });
      return pickLatestExamIdsByClass(gradeExams);
    }

    const selectedClassName = classMeta.find(
      (item) => item.grade === selectedGrade && item.group === selectedGroup,
    )?.className;
    if (!selectedClassName) {
      return [];
    }

    const selectedExam = pickLatestExamForClass(reportExams, selectedClassName);
    return selectedExam ? [selectedExam.id] : [];
  }, [classMeta, reportExams, selectedGrade, selectedGroup]);

  const selectedClassNameForChart = useMemo(() => {
    if (
      selectedGrade === ALL_GRADES_VALUE ||
      selectedGroup === ALL_GROUPS_VALUE
    ) {
      return null;
    }

    return (
      classMeta.find(
        (item) => item.grade === selectedGrade && item.group === selectedGroup,
      )?.className ?? null
    );
  }, [classMeta, selectedGrade, selectedGroup]);

  const aggregateClassLabelForChart = useMemo(() => {
    if (
      selectedGrade === ALL_GRADES_VALUE ||
      selectedGroup !== ALL_GROUPS_VALUE
    ) {
      return null;
    }

    return `${selectedGrade}-р анги`;
  }, [selectedGrade, selectedGroup]);

  const report = useMemo(() => {
    if (selectedExamIds.length === 0) {
      return null;
    }

    const reports = selectedExamIds.flatMap((examId) => {
      if (dataSource === "mock") {
        const mockReport = buildMockExamReportData(examId);
        return mockReport ? [mockReport] : [];
      }

      if (!payload) {
        return [];
      }

      const realReport = buildExamReportData(payload, examId);
      return realReport ? [realReport] : [];
    });

    if (reports.length === 0) {
      return null;
    }

    if (selectedGrade === ALL_GRADES_VALUE) {
      return combineExamReports(reports, "Бүгд");
    }

    if (selectedGroup === ALL_GROUPS_VALUE) {
      return combineExamReports(reports, `${selectedGrade}-р анги`);
    }

    return reports[0] ?? null;
  }, [dataSource, payload, selectedExamIds, selectedGrade, selectedGroup]);

  const headerTitle = "Шалгалтын тайлан";
  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Select
        value={selectedGrade}
        onValueChange={setSelectedGrade}
        disabled={reportExams.length === 0}
      >
        <SelectTrigger
          aria-label="Анги сонгох"
          className="h-11 min-w-[140px] rounded-xl border-0 bg-[#dfeaf8] px-5 text-sm font-semibold text-[#0b5cad] shadow-none focus-visible:border-[#bfdbfe] focus-visible:ring-[#bfdbfe]/60"
        >
          <SelectValue placeholder="Анги" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className="min-w-[140px] max-w-[180px]"
        >
          <SelectItem value={ALL_GRADES_VALUE}>Анги</SelectItem>
          {gradeOptions.map((grade) => (
            <SelectItem key={grade} value={grade}>
              {grade}-р анги
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedGroup}
        onValueChange={setSelectedGroup}
        disabled={
          reportExams.length === 0 || selectedGrade === ALL_GRADES_VALUE
        }
      >
        <SelectTrigger
          aria-label="Бүлэг сонгох"
          className="relative h-11 min-w-[140px] rounded-xl border-0 bg-[#eef4fb] px-5 text-sm font-semibold text-[#0b5cad] shadow-none focus-visible:border-[#bfdbfe] focus-visible:ring-[#bfdbfe]/60 [&_[data-slot=select-value]]:hidden"
        >
          <SelectValue />
          <span className="truncate">
            {selectedGroup === ALL_GROUPS_VALUE
              ? "Бүлэг"
              : formatGroupLabel(selectedGroup)}
          </span>
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className="min-w-[140px] max-w-[180px]"
        >
          <SelectItem value={ALL_GROUPS_VALUE}>Бүгд</SelectItem>
          {groupOptions.map((group) => (
            <SelectItem key={group} value={group}>
              {formatGroupLabel(group)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToggleGroup
        aria-label="Өгөгдлийн төрөл"
        type="single"
        value={dataSource}
        onValueChange={(value) => {
          if (value === "real" || value === "mock") {
            setDataSource(value);
          }
        }}
        className="rounded-none border-0 bg-transparent p-0 shadow-none"
      >
        <ToggleGroupItem
          value="real"
          className="rounded-none border-0 px-4 py-2 text-sm font-semibold text-[#8a6a57] aria-pressed:bg-transparent data-[state=on]:bg-[#f1e6dc] data-[state=on]:text-[#7b2d18] data-[state=on]:shadow-[0_8px_16px_-12px_rgba(139,34,0,0.35)]"
        >
          Бодит дата
        </ToggleGroupItem>
        <ToggleGroupItem
          value="mock"
          className="rounded-none border-0 px-4 py-2 text-sm font-semibold text-[#8a6a57] aria-pressed:bg-transparent data-[state=on]:bg-[#f1e6dc] data-[state=on]:text-[#7b2d18] data-[state=on]:shadow-[0_8px_16px_-12px_rgba(139,34,0,0.35)]"
        >
          Жишиг дата
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );

  if (dataSource === "real" && isLoading && !payload) {
    return (
      <TestShell title={headerTitle} actions={headerActions}>
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-dashed border-border bg-card/70 px-6 text-sm text-muted-foreground">
          Exam report өгөгдөл ачаалж байна...
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell
      title={headerTitle}
      actions={headerActions}
      contentClassName="pb-10"
    >
      <div className="mx-auto w-full ">
        {dataSource === "real" && error ? (
          <div className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {report ? (
          <ExamReport
            report={report}
            dataSource={dataSource}
            selectedClassNameForChart={selectedClassNameForChart}
            aggregateClassLabelForChart={aggregateClassLabelForChart}
          />
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] border border-dashed border-border bg-card/75 p-8 text-center text-sm text-muted-foreground">
            Тайлан харуулах шалгалтын өгөгдөл олдсонгүй.
          </div>
        )}
      </div>
    </TestShell>
  );
}

function pickLatestExamIdsByClass(exams: Exam[]): string[] {
  return [...new Set(exams.map((exam) => exam.class))]
    .map((className) => pickLatestExamForClass(exams, className)?.id ?? null)
    .filter((examId): examId is string => Boolean(examId));
}

function pickLatestExamForClass(exams: Exam[], className: string): Exam | null {
  return (
    exams
      .filter((exam) => exam.class === className)
      .sort((left, right) => {
        return getExamSortTime(right) - getExamSortTime(left);
      })[0] ?? null
  );
}

function getExamSortTime(exam: Exam): number {
  return exam.endTime?.getTime() ?? exam.startTime.getTime();
}
