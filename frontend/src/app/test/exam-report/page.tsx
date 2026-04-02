"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  normalizeGroupValue,
  parseClassName,
} from "./lib/report-format";

const POLL_INTERVAL_MS = 30_000;
const REPORT_CACHE_KEY = "test-exam-report-dashboard-cache-v1";
const REPORT_CACHE_TTL_MS = 2 * 60 * 1000;
const ALL_GRADES_VALUE = "all";
const ALL_GROUPS_VALUE = "all";
const ALL_TYPES_VALUE = "all";
const UNKNOWN_CLASS_VALUE = "__unknown_class__";
type ReportDataSource = "mock" | "real";
const TAKE_EXAM_GRAPHQL_URL =
  "https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

export default function ExamReportPage() {
  const [dataSource, setDataSource] = useState<ReportDataSource>("real");
  const [selectedGrade, setSelectedGrade] = useState<string>(ALL_GRADES_VALUE);
  const [selectedGroup, setSelectedGroup] = useState<string>(ALL_GROUPS_VALUE);
  const [selectedType, setSelectedType] = useState<string>(ALL_TYPES_VALUE);
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
      writeReportPayloadCache(nextPayload);
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

    const cached = readReportPayloadCache();

    if (cached) {
      setPayload(cached.payload);
      setError(null);
      setIsLoading(false);
    }

    const shouldRefreshImmediately =
      !cached || Date.now() - cached.cachedAt > REPORT_CACHE_TTL_MS;

    if (shouldRefreshImmediately) {
      void loadDashboard(!cached);
    }

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
    const groups = new Set<string>();
    for (const item of classMeta) {
      if (
        item.group &&
        (selectedGrade === ALL_GRADES_VALUE || item.grade === selectedGrade)
      ) {
        groups.add(normalizeGroupValue(item.group));
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

    const gradeScopedExams =
      selectedGrade === ALL_GRADES_VALUE
        ? reportExams
        : reportExams.filter((exam) => {
            return parseClassName(exam.class).grade === selectedGrade;
          });

    if (selectedGroup === ALL_GROUPS_VALUE) {
      return pickLatestExamIdsByClass(gradeScopedExams);
    }

    if (selectedGrade === ALL_GRADES_VALUE) {
      const groupExams = reportExams.filter((exam) => {
        return (
          normalizeGroupValue(parseClassName(exam.class).group) ===
          selectedGroup
        );
      });
      return pickLatestExamIdsByClass(groupExams);
    }

    const selectedClassName = classMeta.find(
      (item) =>
        item.grade === selectedGrade &&
        normalizeGroupValue(item.group) === selectedGroup,
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
        (item) =>
          item.grade === selectedGrade &&
          normalizeGroupValue(item.group) === selectedGroup,
      )?.className ?? null
    );
  }, [classMeta, selectedGrade, selectedGroup]);

  const aggregateClassLabelForChart = useMemo(() => {
    if (
      selectedGrade === ALL_GRADES_VALUE &&
      selectedGroup === ALL_GROUPS_VALUE
    ) {
      return null;
    }

    if (
      selectedGrade === ALL_GRADES_VALUE &&
      selectedGroup !== ALL_GROUPS_VALUE
    ) {
      return `${formatGroupLabel(selectedGroup)} бүлэг`;
    }

    if (selectedGroup !== ALL_GROUPS_VALUE) {
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

    if (
      selectedGrade === ALL_GRADES_VALUE &&
      selectedGroup === ALL_GROUPS_VALUE
    ) {
      return combineExamReports(reports, "Бүгд");
    }

    if (
      selectedGrade === ALL_GRADES_VALUE &&
      selectedGroup !== ALL_GROUPS_VALUE
    ) {
      return combineExamReports(
        reports,
        `${formatGroupLabel(selectedGroup)} бүлэг`,
      );
    }

    if (selectedGroup === ALL_GROUPS_VALUE) {
      return combineExamReports(reports, `${selectedGrade}-р анги`);
    }

    return reports[0] ?? null;
  }, [dataSource, payload, selectedExamIds, selectedGrade, selectedGroup]);

  const headerTitle = "Шалгалтын тайлан";
  const headerBreadcrumb = <HeaderTitle title={headerTitle} />;
  const filterBar = (
    <div className="mb-6 flex min-h-[76px] w-full items-center rounded-[20px] border-0 bg-transparent px-5 py-4 sm:px-6">
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        <ToggleGroup
          aria-label="Өгөгдлийн төрөл"
          type="single"
          value={dataSource}
          onValueChange={(value) => {
            if (value === "real" || value === "mock") {
              setDataSource(value);
            }
          }}
          className="rounded-[14px] border border-[#dbe3ee] bg-white p-1 shadow-none"
        >
          <ToggleGroupItem
            value="real"
            className="rounded-[10px] border-0 px-3 py-2 text-sm font-semibold text-slate-500 aria-pressed:bg-transparent data-[state=on]:bg-[#edf5ff] data-[state=on]:text-[#0b5cab] data-[state=on]:shadow-none"
          >
            Бодит дата
          </ToggleGroupItem>
          <ToggleGroupItem
            value="mock"
            className="rounded-[10px] border-0 px-3 py-2 text-sm font-semibold text-slate-500 aria-pressed:bg-transparent data-[state=on]:bg-[#edf5ff] data-[state=on]:text-[#0b5cab] data-[state=on]:shadow-none"
          >
            Жишиг дата
          </ToggleGroupItem>
        </ToggleGroup>

        <Select
          value={selectedGrade}
          onValueChange={setSelectedGrade}
          disabled={reportExams.length === 0}
        >
          <SelectTrigger
            aria-label="Анги сонгох"
            className={FILTER_TRIGGER_CLASSNAME}
          >
            <SelectValue placeholder="Анги" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            className="min-w-[110px] max-w-[180px]"
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
          disabled={reportExams.length === 0}
        >
          <SelectTrigger
            aria-label="Бүлэг сонгох"
            className={FILTER_TRIGGER_CLASSNAME}
          >
            <SelectValue
              placeholder={
                selectedGroup === ALL_GROUPS_VALUE
                  ? "Бүлэг"
                  : formatGroupLabel(selectedGroup)
              }
            />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            className="min-w-[110px] max-w-[180px]"
          >
            <SelectItem value={ALL_GROUPS_VALUE}>Бүлэг</SelectItem>
            {groupOptions.map((group) => (
              <SelectItem key={group} value={group}>
                {formatGroupLabel(group)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger
            aria-label="Төрөл сонгох"
            className={FILTER_TRIGGER_CLASSNAME}
          >
            <SelectValue placeholder="Төрөл" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            className="min-w-[110px] max-w-[180px]"
          >
            <SelectItem value={ALL_TYPES_VALUE}>Төрөл</SelectItem>
            <SelectItem value="progress">Явц</SelectItem>
            <SelectItem value="quarter">Улирал</SelectItem>
            <SelectItem value="state">Улсын</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (dataSource === "real" && isLoading && !payload) {
    return (
      <TestShell
        breadcrumb={headerBreadcrumb}
        title={headerTitle}
        sidebarCollapsible
      >
        {filterBar}
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-dashed border-border bg-card/70 px-6 text-sm text-muted-foreground">
          Exam report өгөгдөл ачаалж байна...
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell
      breadcrumb={headerBreadcrumb}
      title={headerTitle}
      contentClassName="!px-8 !pb-10"
      sidebarCollapsible
    >
      {filterBar}
      <div className="w-full">
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

const FILTER_TRIGGER_CLASSNAME =
  "!h-[41px] w-[108px] min-w-[108px] shrink-0  border border-[#d9e2ec] !bg-white px-4 text-[15px] font-medium text-slate-700 shadow-none hover:bg-white focus-visible:border-[#d9e2ec] focus-visible:ring-0 data-[placeholder]:text-slate-700 [&_[data-slot=select-value]]:max-w-[60px] [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:text-left";

type ReportPayloadCache = {
  cachedAt: number;
  payload: DashboardApiPayload;
};

function HeaderTitle({ title }: { title: string }): ReactNode {
  return (
    <div className="text-[18px] font-bold tracking-tight text-slate-900 sm:text-[20px]">
      {title}
    </div>
  );
}

function pickLatestExamIdsByClass(exams: Exam[]): string[] {
  return [...new Set(exams.map((exam) => normalizeClassValue(exam.class)))]
    .map((className) => pickLatestExamForClass(exams, className)?.id ?? null)
    .filter((examId): examId is string => Boolean(examId));
}

function pickLatestExamForClass(exams: Exam[], className: string): Exam | null {
  return (
    exams
      .filter((exam) => normalizeClassValue(exam.class) === className)
      .sort((left, right) => {
        return getExamSortTime(right) - getExamSortTime(left);
      })[0] ?? null
  );
}

function getExamSortTime(exam: Exam): number {
  return exam.endTime?.getTime() ?? exam.startTime.getTime();
}

function normalizeClassValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN_CLASS_VALUE;
}

function readReportPayloadCache(): ReportPayloadCache | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(REPORT_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<ReportPayloadCache>;
    if (
      typeof parsed.cachedAt !== "number" ||
      !parsed.payload ||
      typeof parsed.payload !== "object"
    ) {
      window.sessionStorage.removeItem(REPORT_CACHE_KEY);
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      payload: parsed.payload as DashboardApiPayload,
    };
  } catch {
    window.sessionStorage.removeItem(REPORT_CACHE_KEY);
    return null;
  }
}

function writeReportPayloadCache(payload: DashboardApiPayload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      REPORT_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        payload,
      } satisfies ReportPayloadCache),
    );
  } catch {
    // Ignore storage errors and keep the page functional.
  }
}
