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
import {
  buildExamReportData,
  combineExamReports,
} from "./lib/report-adapters";
import {
  buildMockExamReportData,
  MOCK_REPORT_EXAMS,
} from "./lib/report-mock-data";

const POLL_INTERVAL_MS = 30_000;
const ALL_CLASSES_VALUE = "all";
type ReportDataSource = "mock" | "real";

export default function ExamReportPage() {
  const [dataSource, setDataSource] = useState<ReportDataSource>("real");
  const [selectedClassName, setSelectedClassName] =
    useState<string>(ALL_CLASSES_VALUE);
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/take-exam-dashboard?limit=80", {
        cache: "no-store",
      });
      const nextPayload = (await response.json()) as DashboardApiPayload & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          nextPayload.message ?? "Тайлангийн өгөгдөл ачаалж чадсангүй.",
        );
      }

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
    void loadDashboard(true);

    const intervalId = window.setInterval(() => {
      void loadDashboard(false);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDashboard]);

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
    return [...new Set(reportExams.map((exam) => exam.class))].sort((left, right) => {
      return left.localeCompare(right, "mn");
    });
  }, [reportExams]);

  useEffect(() => {
    if (
      selectedClassName !== ALL_CLASSES_VALUE &&
      !classOptions.includes(selectedClassName)
    ) {
      setSelectedClassName(ALL_CLASSES_VALUE);
    }
  }, [classOptions, selectedClassName]);

  const selectedExamIds = useMemo(() => {
    if (reportExams.length === 0) {
      return [];
    }

    if (selectedClassName === ALL_CLASSES_VALUE) {
      return pickLatestExamIdsByClass(reportExams);
    }

    const selectedExam = pickLatestExamForClass(reportExams, selectedClassName);
    return selectedExam ? [selectedExam.id] : [];
  }, [reportExams, selectedClassName]);

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

    if (selectedClassName === ALL_CLASSES_VALUE) {
      return combineExamReports(reports, "Бүгд");
    }

    return reports[0] ?? null;
  }, [dataSource, payload, selectedClassName, selectedExamIds]);

  const headerTitle = "Шалгалтын тайлан";
  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Select
        value={selectedClassName}
        onValueChange={setSelectedClassName}
        disabled={reportExams.length === 0}
      >
        <SelectTrigger
          aria-label="Анги сонгох"
          className="h-11 min-w-[140px] rounded-xl border-0 bg-[#dfeaf8] px-5 text-sm font-semibold text-[#0b5cad] shadow-none focus-visible:border-[#bfdbfe] focus-visible:ring-[#bfdbfe]/60"
        >
          <SelectValue placeholder="Бүгд" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CLASSES_VALUE}>Бүгд</SelectItem>
          {classOptions.map((className) => (
            <SelectItem key={className} value={className}>
              {className}
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
        className="rounded-xl border-0 bg-[#f4efe8] p-1"
      >
        <ToggleGroupItem
          value="real"
          className="rounded-lg border-0 px-4 text-sm font-semibold text-[#8a6a57] data-[state=on]:bg-white data-[state=on]:text-[#892200] data-[state=on]:shadow-sm"
        >
          Real data
        </ToggleGroupItem>
        <ToggleGroupItem
          value="mock"
          className="rounded-lg border-0 px-4 text-sm font-semibold text-[#8a6a57] data-[state=on]:bg-white data-[state=on]:text-[#892200] data-[state=on]:shadow-sm"
        >
          Mock data
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
          <ExamReport report={report} dataSource={dataSource} />
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
