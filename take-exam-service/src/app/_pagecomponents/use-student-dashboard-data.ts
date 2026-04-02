"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadDashboardPayload,
  loadStudentsData,
} from "./student-page-api";
import {
  formatDate,
  matchesStudentClassGroup,
  testKey,
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

  const hasPendingApprovalAttempts = useMemo(
    () =>
      studentAttempts.some(
        (attempt) =>
          attempt.status === "submitted" || attempt.status === "processing",
      ),
    [studentAttempts],
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

    const dedupedTests = Array.from(
      tests
        .reduce((map, test) => {
          const key = testKey(test);
          const existing = map.get(key);

          if (
            !existing ||
            new Date(test.updatedAt) > new Date(existing.updatedAt)
          ) {
            map.set(key, test);
          }

          return map;
        }, new Map<string, TeacherTestSummary>())
        .values(),
    );
    const matchingTests = dedupedTests.filter((test) =>
      matchesStudentClassGroup(
        selectedStudent.className,
        test.criteria.className,
        test.criteria.gradeLevel,
      ),
    );
    const candidateTests = matchingTests.length > 0 ? matchingTests : dedupedTests;

    const resumableTest = candidateTests.find((test) =>
      inProgressByTestId.has(test.id),
    );
    if (resumableTest) {
      return [resumableTest];
    }

    const nextAvailableTest = candidateTests.find(
      (test) => !completedByTestId.has(test.id),
    );
    if (nextAvailableTest) {
      return [nextAvailableTest];
    }

    return candidateTests.slice(0, 1);
  }, [completedByTestId, inProgressByTestId, selectedStudent, tests]);

  const activeTestsCount = filteredTests.filter(
    (test) => !completedByTestId.has(test.id),
  ).length;

  const completionRate = approvedAttempts.length
    ? Math.round(
        (approvedAttempts.length /
          Math.max(
            1,
            studentAttempts.filter(
              (attempt) =>
                attempt.status === "approved" || attempt.status === "submitted",
            ).length,
          )) *
          100,
      )
    : 0;

  const averageScore = approvedAttempts.length
    ? Math.round(
        approvedAttempts.reduce(
          (sum, attempt) => sum + (attempt.percentage ?? 0),
          0,
        ) / approvedAttempts.length,
      )
    : 0;

  const passedAttemptsCount = useMemo(
    () =>
      approvedAttempts.filter((attempt) => (attempt.percentage ?? 0) >= 60)
        .length,
    [approvedAttempts],
  );

  const passRate = completedAttempts.length
    ? Math.round((passedAttemptsCount / completedAttempts.length) * 100)
    : 0;

  const testsById = useMemo(
    () => new Map(tests.map((test) => [test.id, test])),
    [tests],
  );

  const resultRows = useMemo(
    (): ResultRow[] =>
      completedAttempts.map((attempt) => {
        const mappedTest = testsById.get(attempt.testId);
        const scoreText =
          attempt.score != null && attempt.maxScore != null
            ? `${attempt.score}/${attempt.maxScore}`
            : attempt.percentage != null
              ? `${attempt.percentage}%`
              : "-";

        return {
          attemptId: attempt.attemptId,
          examName: attempt.title,
          subject: mappedTest?.criteria.subject ?? "Ерөнхий",
          className: selectedStudent?.className ?? "-",
          isApproved: attempt.status === "approved",
          teacher: "С.Жаргалмаа",
          startedAt: formatDate(attempt.startedAt),
          finishedAt: formatDate(attempt.submittedAt ?? attempt.startedAt),
          scoreText,
        };
      }),
    [completedAttempts, selectedStudent, testsById],
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
  };
}
