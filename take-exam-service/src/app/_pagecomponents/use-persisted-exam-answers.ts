"use client";

import { useEffect, useState } from "react";

type PersistedExamAnswers = Record<string, string | null>;

const getStorageKey = (attemptId: string) => `answers_${attemptId}`;

export function usePersistedExamAnswers(attemptId: string | null) {
  const [answers, setAnswers] = useState<PersistedExamAnswers>({});

  useEffect(() => {
    if (!attemptId) {
      setAnswers({});
      return;
    }

    const savedValue = localStorage.getItem(getStorageKey(attemptId));
    if (!savedValue) {
      setAnswers({});
      return;
    }

    try {
      const parsed = JSON.parse(savedValue) as PersistedExamAnswers;
      setAnswers(parsed);
    } catch {
      localStorage.removeItem(getStorageKey(attemptId));
      setAnswers({});
    }
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;

    localStorage.setItem(getStorageKey(attemptId), JSON.stringify(answers));
  }, [answers, attemptId]);

  const clearAnswers = (targetAttemptId = attemptId) => {
    if (targetAttemptId) {
      localStorage.removeItem(getStorageKey(targetAttemptId));
    }

    setAnswers({});
  };

  return {
    answers,
    clearAnswers,
    setAnswers,
  };
}
