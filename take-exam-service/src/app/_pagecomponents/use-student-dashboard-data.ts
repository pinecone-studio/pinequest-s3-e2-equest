"use client";

import { useEffect, useMemo, useState } from "react";
import { loadDashboardPayload, loadStudentsData } from "./student-page-api";
import { formatDate, testKey } from "./student-page-utils";
import type {
  AttemptSummary,
  StudentInfo,
  TeacherTestSummary,
} from "@/lib/exam-service/types";
import type { ResultRow } from "./student-page-shell";

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);

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

  const filteredTests = useMemo(() => {
    if (!selectedStudent) return [];

    return Array.from(
      tests
        .filter((test) => {
          const studentClass = selectedStudent.className.trim().toUpperCase();
          const testClass = test.criteria.className.trim().toUpperCase();
          const classMatched = testClass === "" || testClass === studentClass;
          if (!classMatched) return false;

          const alreadyFinished = studentAttempts.some(
            (attempt) =>
              attempt.testId === test.id &&
              (attempt.status === "submitted" || attempt.status === "approved"),
          );

          return !alreadyFinished;
        })
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
  }, [selectedStudent, studentAttempts, tests]);

  const activeTestsCount = filteredTests.length;

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
          teacher: "С.Жаргалмаа",
          startedAt: formatDate(attempt.startedAt),
          finishedAt: formatDate(attempt.submittedAt ?? attempt.startedAt),
          scoreText,
        };
      }),
    [completedAttempts, selectedStudent, testsById],
  );

  const loadDashboardData = async () => {
    if (!enabled) return;

    const data = await loadDashboardPayload();

    setTests(data.availableTests ?? []);
    setAllAttempts(data.attempts ?? []);
  };

  useEffect(() => {
    if (!enabled) {
      setIsInitialLoading(false);
      return;
    }

    const initialize = async () => {
      setError(null);
      setIsInitialLoading(true);

      try {
        const [nextStudents, dashboardData] = await Promise.all([
          loadStudentsData(),
          loadDashboardPayload(),
        ]);

        setAvailableStudents(nextStudents);
        setSelectedStudentId((prev) => {
          if (prev && nextStudents.some((student) => student.id === prev)) {
            return prev;
          }

          return nextStudents[0]?.id ?? "";
        });
        setTests(dashboardData.availableTests ?? []);
        setAllAttempts(dashboardData.attempts ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Өгөгдөл ачаалж чадсангүй.",
        );
      } finally {
        setIsInitialLoading(false);
      }
    };

    void initialize();
  }, [enabled, setError]);

  return {
    activeTestsCount,
    allAttempts,
    approvedAttempts,
    availableStudents,
    averageScore,
    completedAttempts,
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
