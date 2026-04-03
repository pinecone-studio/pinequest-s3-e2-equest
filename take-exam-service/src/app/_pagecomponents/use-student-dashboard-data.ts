"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadDashboardPayload,
  loadStudentsData,
} from "./student-page-api";
import {
  formatDate,
  matchesStudentClassGroup,
} from "./student-page-utils";
import type {
  AttemptSummary,
  StudentInfo,
  TeacherTestSummary,
} from "@/lib/exam-service/types";
import type { ResultRow } from "./student-page-shell";
import { USE_MOCK_DATA } from "@/lib/mock/student-portal-client";

type UseStudentDashboardDataArgs = {
  enabled?: boolean;
  setError: (value: string | null) => void;
};

export function useStudentDashboardData({
  enabled = true,
  setError,
}: UseStudentDashboardDataArgs) {
  const [availableStudents, setAvailableStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [tests, setTests] = useState<TeacherTestSummary[]>([]);
  const [allAttempts, setAllAttempts] = useState<AttemptSummary[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(
    enabled && !USE_MOCK_DATA,
  );
  const [isStudentsLoading, setIsStudentsLoading] = useState(true);

  const selectedStudent = useMemo(
    () =>
      availableStudents.find((student) => student.id === selectedStudentId) ??
      null,
    [availableStudents, selectedStudentId],
  );

  const studentAttempts = useMemo(() => {
    if (!selectedStudent) return [];
    return allAttempts.filter(
      (attempt) => attempt.studentId === selectedStudent.id,
    );
  }, [allAttempts, selectedStudent]);

  const approvedAttempts = useMemo(
    () => studentAttempts.filter((attempt) => attempt.status === "approved"),
    [studentAttempts],
  );

  const completedAttempts = useMemo(
    () =>
      studentAttempts.filter(
        (attempt) =>
          attempt.status === "approved" || attempt.status === "submitted",
      ),
    [studentAttempts],
  );

  const testsById = useMemo(
    () => new Map(tests.map((test) => [test.id, test])),
    [tests],
  );

  const visibleApprovedAttempts = useMemo(
    () => approvedAttempts.filter((attempt) => testsById.has(attempt.testId)),
    [approvedAttempts, testsById],
  );

  const visibleCompletedAttempts = useMemo(
    () => completedAttempts.filter((attempt) => testsById.has(attempt.testId)),
    [completedAttempts, testsById],
  );

  const hasPendingApprovalAttempts = useMemo(
    () =>
      studentAttempts.some(
        (attempt) =>
          testsById.has(attempt.testId) &&
          (attempt.status === "submitted" || attempt.status === "processing"),
      ),
    [studentAttempts, testsById],
  );

  const inProgressByTestId = useMemo(() => {
    const map = new Map<string, AttemptSummary>();

    studentAttempts
      .filter((attempt) => attempt.status === "in_progress")
      .forEach((attempt) => {
        const existing = map.get(attempt.testId);
        if (
          !existing ||
          new Date(existing.startedAt) < new Date(attempt.startedAt)
        ) {
          map.set(attempt.testId, attempt);
        }
      });

    return map;
  }, [studentAttempts]);

  const completedByTestId = useMemo(() => {
    const map = new Map<string, AttemptSummary>();

    studentAttempts
      .filter(
        (attempt) =>
          attempt.status === "approved" || attempt.status === "submitted",
      )
      .forEach((attempt) => {
        const existing = map.get(attempt.testId);
        if (
          !existing ||
          new Date(existing.startedAt) < new Date(attempt.startedAt)
        ) {
          map.set(attempt.testId, attempt);
        }
      });

    return map;
  }, [studentAttempts]);

  const filteredTests = useMemo(() => {
    if (!selectedStudent) return [];

    const matchingTests = tests.filter((test) =>
      matchesStudentClassGroup(
        selectedStudent.className,
        test.criteria.className,
        test.criteria.gradeLevel,
      ),
    );
    const candidateTests = matchingTests.length > 0 ? matchingTests : tests;

    return [...candidateTests].sort((left, right) => {
      const leftInProgress = inProgressByTestId.has(left.id);
      const rightInProgress = inProgressByTestId.has(right.id);

      if (leftInProgress !== rightInProgress) {
        return leftInProgress ? -1 : 1;
      }

      const leftCompleted = completedByTestId.has(left.id);
      const rightCompleted = completedByTestId.has(right.id);

      if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [completedByTestId, inProgressByTestId, selectedStudent, tests]);

  const activeTestsCount = filteredTests.filter(
    (test) => !completedByTestId.has(test.id),
  ).length;

  const completionRate = visibleApprovedAttempts.length
    ? Math.round(
        (visibleApprovedAttempts.length /
          Math.max(1, visibleCompletedAttempts.length)) *
          100,
      )
    : 0;

  const averageScore = visibleApprovedAttempts.length
    ? Math.round(
        visibleApprovedAttempts.reduce(
          (sum, attempt) => sum + (attempt.percentage ?? 0),
          0,
        ) / visibleApprovedAttempts.length,
      )
    : 0;

  const passedAttemptsCount = useMemo(
    () =>
      visibleApprovedAttempts.filter(
        (attempt) => (attempt.percentage ?? 0) >= 60,
      ).length,
    [visibleApprovedAttempts],
  );

  const passRate = visibleCompletedAttempts.length
    ? Math.round((passedAttemptsCount / visibleCompletedAttempts.length) * 100)
    : 0;

  const resultRows = useMemo(
    (): ResultRow[] =>
      visibleCompletedAttempts.flatMap((attempt) => {
        const mappedTest = testsById.get(attempt.testId);
        if (!mappedTest) {
          return [];
        }

        const scoreText =
          attempt.score != null && attempt.maxScore != null
            ? `${attempt.score}/${attempt.maxScore}`
            : attempt.percentage != null
              ? `${attempt.percentage}%`
              : "-";

        return [{
          attemptId: attempt.attemptId,
          examName: attempt.title,
          subject: mappedTest.criteria.subject,
          className: selectedStudent?.className ?? "-",
          isApproved: attempt.status === "approved",
          teacher: "С.Жаргалмаа",
          startedAt: formatDate(attempt.startedAt),
          finishedAt: formatDate(attempt.submittedAt ?? attempt.startedAt),
          scoreText,
        }];
      }),
    [selectedStudent, testsById, visibleCompletedAttempts],
  );

  const applyDashboardPayload = useCallback((payload: {
    availableTests: TeacherTestSummary[];
    attempts: AttemptSummary[];
  }) => {
    setTests(payload.availableTests ?? []);
    setAllAttempts(payload.attempts ?? []);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCancelled = false;

    const initializeDashboard = async () => {
      setError(null);
      setIsDashboardLoading(true);

      try {
        const payload = await loadDashboardPayload();

        if (isCancelled) {
          return;
        }

        applyDashboardPayload(payload);
      } catch (err) {
        if (isCancelled) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Өгөгдөл ачаалж чадсангүй.",
        );
      } finally {
        if (!isCancelled) {
          setIsDashboardLoading(false);
        }
      }
    };

    void initializeDashboard();

    return () => {
      isCancelled = true;
    };
  }, [applyDashboardPayload, enabled, setError]);

  const loadDashboardData = useCallback(
    async (options?: { force?: boolean }) => {
      if (!enabled) {
        return undefined;
      }

      try {
        const payload = await loadDashboardPayload(options);
        applyDashboardPayload(payload);
        return payload;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Өгөгдөл ачаалж чадсангүй.",
        );
        return undefined;
      }
    },
    [applyDashboardPayload, enabled, setError],
  );

  useEffect(() => {
    if (!enabled) {
      setIsStudentsLoading(false);
      return;
    }

    const initialize = async () => {
      setError(null);
      setIsStudentsLoading(true);

      try {
        const nextStudents = await loadStudentsData();

        setAvailableStudents(nextStudents);
        setSelectedStudentId((prev) => {
          if (prev && nextStudents.some((student) => student.id === prev)) {
            return prev;
          }

          return nextStudents[0]?.id ?? "";
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Өгөгдөл ачаалж чадсангүй.",
        );
      } finally {
        setIsStudentsLoading(false);
      }
    };

    void initialize();
  }, [enabled, setError]);

  const isInitialLoading = isStudentsLoading || isDashboardLoading;

  return {
    activeTestsCount,
    allAttempts,
    approvedAttempts,
    availableStudents,
    averageScore,
    completedAttempts,
    completedByTestId,
    completionRate,
    filteredTests,
    hasPendingApprovalAttempts,
    inProgressByTestId,
    isInitialLoading,
    loadDashboardData,
    passRate,
    passedAttemptsCount,
    resultRows,
    selectedStudent,
    selectedStudentId,
    setSelectedStudentId,
    tests,
    visibleApprovedAttempts,
    visibleCompletedAttempts,
  };
}
