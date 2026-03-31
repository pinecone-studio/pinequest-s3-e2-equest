"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApolloClient, useQuery } from "@apollo/client/react";
import {
  GetStudentDashboardDocument,
  SyncExternalNewMathExamsDocument,
} from "@/gql/generated";
import {
  loadDashboardPayload,
  loadStudentsData,
  mapDashboardPayload,
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
  const apolloClient = useApolloClient();
  const [availableStudents, setAvailableStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [tests, setTests] = useState<TeacherTestSummary[]>([]);
  const [allAttempts, setAllAttempts] = useState<AttemptSummary[]>([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState(true);
  const [hasTriggeredExternalSync, setHasTriggeredExternalSync] =
    useState(false);
  const {
    data: dashboardData,
    error: dashboardError,
    loading: isDashboardLoading,
    refetch: refetchDashboard,
  } = useQuery(GetStudentDashboardDocument, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    skip: !enabled || USE_MOCK_DATA,
  });

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

  const loadDashboardData = useCallback(async (options?: { force?: boolean }) => {
    if (!enabled) return;

    if (USE_MOCK_DATA) {
      const data = await loadDashboardPayload(options);
      setTests(data.availableTests ?? []);
      setAllAttempts(data.attempts ?? []);
      return;
    }

    const result = await refetchDashboard();
    if (!result.data) {
      return;
    }

    const mappedPayload = mapDashboardPayload(result.data);
    setTests(mappedPayload.availableTests);
    setAllAttempts(mappedPayload.attempts);
  }, [enabled, refetchDashboard]);

  useEffect(() => {
    if (USE_MOCK_DATA || !enabled || !dashboardData) {
      return;
    }

    const mappedPayload = mapDashboardPayload(dashboardData);
    setTests(mappedPayload.availableTests);
    setAllAttempts(mappedPayload.attempts);
  }, [dashboardData, enabled]);

  useEffect(() => {
    if (!dashboardError) {
      return;
    }

    setError(dashboardError.message || "Өгөгдөл ачаалж чадсангүй.");
  }, [dashboardError, setError]);

  useEffect(() => {
    if (
      USE_MOCK_DATA ||
      !enabled ||
      !dashboardData ||
      hasTriggeredExternalSync ||
      dashboardData.availableTests.length > 0
    ) {
      return;
    }

    setHasTriggeredExternalSync(true);

    void apolloClient
      .mutate({
        mutation: SyncExternalNewMathExamsDocument,
        variables: { limit: 1 },
      })
      .then(async () => {
        const result = await refetchDashboard();
        if (!result.data) {
          return;
        }

        const mappedPayload = mapDashboardPayload(result.data);
        setTests(mappedPayload.availableTests);
        setAllAttempts(mappedPayload.attempts);
      })
      .catch((error) => {
        console.error(
          "Failed to sync external exams before loading dashboard:",
          error,
        );
      });
  }, [
    apolloClient,
    dashboardData,
    enabled,
    hasTriggeredExternalSync,
    refetchDashboard,
  ]);

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

  const isInitialLoading =
    isStudentsLoading || (enabled && !USE_MOCK_DATA && isDashboardLoading && !dashboardData);

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
