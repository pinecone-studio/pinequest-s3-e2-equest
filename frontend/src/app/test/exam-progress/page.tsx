"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchTakeExamDashboard } from "@/lib/take-exam-dashboard-api";
import { TestShell } from "../_components/test-shell";
import type { BreadcrumbItem } from "../_components/test-header-bar";
import { ExamProgressMonitoring } from "./_components/exam-progress-monitoring-mock";
import { ExamProgressOverview, type ExamProgressExamMeta } from "./_components/exam-progress-overview";
import {
  buildExamDashboardData,
  buildExamList,
  type DashboardApiPayload,
} from "../live-dashboard/lib/dashboard-adapters";

const POLL_INTERVAL_MS = 30_000;
const ACTIVE_CACHE_TTL_MS = 30_000;
const INACTIVE_CACHE_TTL_MS = 2 * 60 * 1000;
const EXAM_PROGRESS_CACHE_PREFIX = "test-exam-progress-dashboard";
const EMPTY_DASHBOARD_PAYLOAD: DashboardApiPayload = {
  availableTests: [],
  attempts: [],
  liveMonitoringFeed: [],
  testMaterial: null,
};

type ExamProgressCacheEntry = {
  expiresAt: number;
  payload: DashboardApiPayload;
};

export default function ExamProgressPage() {
  const [payload, setPayload] = useState<DashboardApiPayload | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dashboardRequestIdRef = useRef(0);

  const loadDashboard = useCallback(async ({
    force = false,
    showLoader = false,
  }: {
    force?: boolean;
    showLoader?: boolean;
  } = {}) => {
    const requestId = dashboardRequestIdRef.current + 1;
    dashboardRequestIdRef.current = requestId;
    const freshCachedPayload = force
      ? null
      : readExamProgressCache(selectedExamId, { allowExpired: false });

    if (freshCachedPayload) {
      setPayload(freshCachedPayload);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const staleCachedPayload = force
      ? null
      : readExamProgressCache(selectedExamId, { allowExpired: true });
    const shouldShowLoader = showLoader && !staleCachedPayload;

    if (staleCachedPayload) {
      setPayload(staleCachedPayload);
      setError(null);
      setIsLoading(false);
    }

    if (shouldShowLoader) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const nextPayload = await fetchTakeExamDashboard(40, selectedExamId);
      if (dashboardRequestIdRef.current !== requestId) {
        return;
      }

      writeExamProgressCache(selectedExamId, nextPayload);
      setPayload(nextPayload);
      setError(null);
    } catch (nextError) {
      if (dashboardRequestIdRef.current !== requestId) {
        return;
      }

      setError(
        nextError instanceof Error
          ? nextError.message
          : "Шалгалтын явц ачаалах үед алдаа гарлаа.",
      );
    } finally {
      if (dashboardRequestIdRef.current === requestId) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedExamId]);

  useEffect(() => {
    void loadDashboard({ showLoader: true });
  }, [loadDashboard]);

  useEffect(() => {
    return () => {
      dashboardRequestIdRef.current += 1;
    };
  }, []);

  const exams = useMemo(
    () => buildExamList(payload ?? EMPTY_DASHBOARD_PAYLOAD),
    [payload],
  );
  const hasAnyActiveExam = useMemo(
    () => exams.some((exam) => exam.liveStudentCount > 0),
    [exams],
  );
  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  );
  const breadcrumbItems: BreadcrumbItem[] = selectedExam
    ? [
        { href: "/test/live-dashboard", label: "Нүүр" },
        { href: "/test/exam-progress", label: "Шалгалтын явц" },
        { active: true, label: selectedExam.title },
      ]
    : [
        { href: "/test/live-dashboard", label: "Нүүр" },
        { active: true, label: "Шалгалтын явц" },
      ];
  const shouldPoll = useMemo(() => {
    if (selectedExam) {
      return selectedExam.liveStudentCount > 0;
    }

    return hasAnyActiveExam;
  }, [hasAnyActiveExam, selectedExam]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadDashboard();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDashboard, shouldPoll]);
  const activityExamIds = useMemo(() => {
    const ids = new Set<string>();

    for (const attempt of payload?.attempts ?? []) {
      ids.add(attempt.testId);
    }

    for (const feedItem of payload?.liveMonitoringFeed ?? []) {
      ids.add(feedItem.testId);
    }

    return ids;
  }, [payload]);
  const progressExams = useMemo(
    () =>
      exams
        .filter((exam) => activityExamIds.has(exam.id))
        .sort((left, right) => right.startTime.getTime() - left.startTime.getTime()),
    [activityExamIds, exams],
  );
  const selectedExamData = useMemo(
    () =>
      selectedExamId && payload
        ? buildExamDashboardData(payload, selectedExamId)
        : null,
    [payload, selectedExamId],
  );
  const selectedExamLastUpdated = useMemo(() => {
    if (!selectedExamData?.exam) {
      return null;
    }

    const timestamps = [
      ...selectedExamData.events.map((event) => event.timestamp.getTime()),
      ...selectedExamData.attempts.map((attempt) => attempt.submissionTime.getTime()),
      ...selectedExamData.students.map((student) => student.lastActivity.getTime()),
      selectedExamData.exam.startTime.getTime(),
    ].filter((value) => Number.isFinite(value));

    const latestTimestamp = timestamps.sort((left, right) => right - left)[0];

    return typeof latestTimestamp === "number"
      ? new Date(latestTimestamp)
      : null;
  }, [selectedExamData]);
  const selectedExamHasActiveSystem = useMemo(
    () =>
      selectedExamData?.students.some(
        (student) =>
          student.status === "in-progress" || student.status === "processing",
      ) ?? false,
    [selectedExamData],
  );
  const examMetaById = useMemo<Record<string, ExamProgressExamMeta>>(() => {
    const result: Record<string, ExamProgressExamMeta> = {};

    for (const exam of progressExams) {
      const examAttempts = payload?.attempts.filter((attempt) => attempt.testId === exam.id) ?? [];
      const latestActivityMs = examAttempts
        .map((attempt) => {
          const recentEventMs = (attempt.monitoring?.recentEvents ?? [])
            .map((event) => new Date(event.occurredAt).getTime())
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => right - left)[0];

          const submittedMs = attempt.submittedAt
            ? new Date(attempt.submittedAt).getTime()
            : undefined;
          const startedMs = new Date(attempt.startedAt).getTime();

          return recentEventMs ?? submittedMs ?? startedMs;
        })
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => right - left)[0];

      const pendingReviewCount = examAttempts.filter(
        (attempt) => attempt.status === "submitted" || attempt.status === "processing",
      ).length;
      const approvedCount = examAttempts.filter(
        (attempt) => attempt.status === "approved",
      ).length;

      result[exam.id] = {
        reviewState:
          pendingReviewCount > 0 ? "pending" : approvedCount > 0 ? "approved" : null,
        updatedAgo:
          typeof latestActivityMs === "number" && Number.isFinite(latestActivityMs)
            ? formatTimeAgo(new Date(latestActivityMs))
            : null,
      };
    }

    return result;
  }, [payload, progressExams]);

  useEffect(() => {
    if (selectedExamId && !progressExams.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(null);
    }
  }, [progressExams, selectedExamId]);

  if (selectedExam && selectedExamData?.exam) {
    return (
      <TestShell
        breadcrumbItems={breadcrumbItems}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDashboard({ force: true })}
            className="h-10 rounded-[14px] px-4 text-[15px] font-semibold"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Шинэчлэх
          </Button>
        }
        compactSidebar
        contentClassName="pb-8"
        isTeacherRefreshing={isRefreshing}
        meta={
          <>
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  selectedExamHasActiveSystem ? "bg-[#17a34a]" : "bg-slate-400"
                }`}
              />
              {selectedExamHasActiveSystem ? "Систем идэвхтэй" : "Систем идэвхгүй"}
            </span>
            <span>|</span>
            <span>
              {selectedExamLastUpdated
                ? `${formatTimeAgo(selectedExamLastUpdated)} шинэчлэгдсэн`
                : "Шинэчлэлтийн мэдээлэл алга"}
            </span>
          </>
        }
        onTeacherRefresh={() => null}
        sidebarCollapsible
        teacherVariant="none"
        title={selectedExam.title}
      >
        <ExamProgressMonitoring
          exam={selectedExamData.exam}
          events={selectedExamData.events}
          lastUpdated={selectedExamLastUpdated}
          onBack={() => setSelectedExamId(null)}
          reviewAttempts={selectedExamData.attempts}
          students={selectedExamData.students}
        />
      </TestShell>
    );
  }

  return (
    <TestShell
      breadcrumbItems={breadcrumbItems}
      title="Шалгалтын явц"
      isTeacherRefreshing={isRefreshing}
      onTeacherRefresh={() => void loadDashboard({ force: true })}
      sidebarCollapsible
      teacherVariant="live"
    >
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading && !payload ? (
        <div className="flex min-h-[60vh] items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-6 text-sm text-slate-500">
          Шалгалтын явц ачаалж байна...
        </div>
      ) : (
        <ExamProgressOverview
          examMetaById={examMetaById}
          exams={progressExams}
          onSelectExam={(exam) => setSelectedExamId(exam.id)}
        />
      )}
    </TestShell>
  );
}

function getExamProgressCacheKey(selectedExamId: string | null) {
  return `${EXAM_PROGRESS_CACHE_PREFIX}:${selectedExamId ?? "overview"}`;
}

function getExamProgressCacheTtlMs(
  selectedExamId: string | null,
  payload: DashboardApiPayload,
) {
  if (selectedExamId) {
    const detail = buildExamDashboardData(payload, selectedExamId);
    const hasActiveStudents =
      detail.students.some(
        (student) =>
          student.status === "in-progress" || student.status === "processing",
      ) || Boolean(detail.exam && detail.exam.liveStudentCount > 0);

    return hasActiveStudents ? ACTIVE_CACHE_TTL_MS : INACTIVE_CACHE_TTL_MS;
  }

  const hasActiveExams = buildExamList(payload).some(
    (exam) => exam.liveStudentCount > 0,
  );

  return hasActiveExams ? ACTIVE_CACHE_TTL_MS : INACTIVE_CACHE_TTL_MS;
}

function readExamProgressCache(
  selectedExamId: string | null,
  { allowExpired = false }: { allowExpired?: boolean } = {},
): DashboardApiPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      getExamProgressCacheKey(selectedExamId),
    );
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as ExamProgressCacheEntry;
    if (!parsed?.payload || typeof parsed.expiresAt !== "number") {
      window.sessionStorage.removeItem(getExamProgressCacheKey(selectedExamId));
      return null;
    }

    if (!allowExpired && parsed.expiresAt <= Date.now()) {
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(getExamProgressCacheKey(selectedExamId));
    return null;
  }
}

function writeExamProgressCache(
  selectedExamId: string | null,
  payload: DashboardApiPayload,
) {
  if (typeof window === "undefined") {
    return;
  }

  const ttlMs = getExamProgressCacheTtlMs(selectedExamId, payload);

  try {
    window.sessionStorage.setItem(
      getExamProgressCacheKey(selectedExamId),
      JSON.stringify({
        expiresAt: Date.now() + ttlMs,
        payload,
      } satisfies ExamProgressCacheEntry),
    );
  } catch {
    // Ignore cache write failures.
  }
}

function formatTimeAgo(date: Date): string {
  const diffSecs = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );

  if (diffSecs < 60) {
    return `${diffSecs || 1} сек өмнө`;
  }

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `${diffMins} мин өмнө`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} цаг өмнө`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} өдрийн өмнө`;
}
