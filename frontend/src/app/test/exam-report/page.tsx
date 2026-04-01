"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRuntimeJson } from "@/lib/runtime-api";
import { fetchTakeExamDashboard } from "@/lib/take-exam-dashboard-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TestShell } from "../_components/test-shell";
import { buildExamList, type DashboardApiPayload } from "../live-dashboard/lib/dashboard-adapters";
import { ExamReport } from "./_components/exam-report";
import {
  buildExamReportData,
  pickDefaultReportExamId,
} from "./lib/report-adapters";

const POLL_INTERVAL_MS = 30_000;

export default function ExamReportPage() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const nextPayload = await fetchTakeExamDashboard(40);

        setPayload(nextPayload);
        setError(null);
        setLastUpdated(new Date());
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Тайлан ачаалах үед алдаа гарлаа.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

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
    if (!payload) {
      return [];
    }

    return buildExamList(payload).filter((exam) => exam.totalStudentCount > 0);
  }, [payload]);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const availableIds = new Set(reportExams.map((exam) => exam.id));
    if (selectedExamId && availableIds.has(selectedExamId)) {
      return;
    }

    setSelectedExamId(pickDefaultReportExamId(payload));
  }, [payload, reportExams, selectedExamId]);

  const report = useMemo(() => {
    if (!payload || !selectedExamId) {
      return null;
    }

    return buildExamReportData(payload, selectedExamId);
  }, [payload, selectedExamId]);

  const headerTitle = report?.exam.title ?? "Шалгалтын тайлан";
  const headerDescription = report?.exam
    ? `${report.exam.subject} • ${report.exam.topic} • ${report.exam.class}`
    : "Шалгалтын дараах нэгтгэсэн дүн, сул асуултууд, ангийн гүйцэтгэлийн тайлан.";
  const headerMeta = (
    <>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success" />
        <span>Тайлан идэвхтэй</span>
      </div>
      <span>Шинэчлэгдсэн {lastUpdated ? formatTimeAgo(lastUpdated) : "саяхан"}</span>
      <span>{reportExams.length} шалгалт бэлэн</span>
    </>
  );
  const headerActions = (
    <>
      <Select
        value={selectedExamId ?? undefined}
        onValueChange={setSelectedExamId}
        disabled={reportExams.length === 0}
      >
        <SelectTrigger className="h-10 min-w-[240px] rounded-xl bg-background">
          <SelectValue placeholder="Шалгалт сонгох" />
        </SelectTrigger>
        <SelectContent>
          {reportExams.map((exam) => (
            <SelectItem key={exam.id} value={exam.id}>
              {exam.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => void loadDashboard(false)}>
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
        />
        Шинэчлэх
      </Button>
    </>
  );

  if (isLoading && !payload) {
    return (
      <TestShell
        title={headerTitle}
        description={headerDescription}
        meta={headerMeta}
        actions={headerActions}
      >
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-dashed border-border bg-card/70 px-6 text-sm text-muted-foreground">
          Exam report өгөгдөл ачаалж байна...
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell
      title={headerTitle}
      description={headerDescription}
      meta={headerMeta}
      actions={headerActions}
      contentClassName="pb-10"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        {error ? (
          <div className="mb-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {report ? (
          <ExamReport report={report} />
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] border border-dashed border-border bg-card/75 p-8 text-center text-sm text-muted-foreground">
            Тайлан харуулах шалгалтын өгөгдөл олдсонгүй.
          </div>
        )}
      </div>
    </TestShell>
  );
}

function formatTimeAgo(date: Date): string {
  const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSecs < 5) return "саяхан";
  if (diffSecs < 60) return `${diffSecs} секундын өмнө`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} минутын өмнө`;

  return `${Math.floor(diffSecs / 3600)} цагийн өмнө`;
}
