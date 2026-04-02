import { describe, expect, test } from "bun:test";
import { mergeTextbookQuestionsIntoPreview } from "./textbook-preview-merge.ts";

describe("mergeTextbookQuestionsIntoPreview", () => {
  test("replaces existing textbook questions and preserves other sources", () => {
    const result = mergeTextbookQuestionsIntoPreview({
      idPrefix: "textbook-test",
      previewQuestions: [
        {
          answers: ["A", "B", "C", "D"],
          correct: 0,
          id: "textbook-old-1",
          index: 1,
          points: 2,
          question: "old textbook 1",
          questionType: "single-choice",
          source: "Алгебр",
          sourceType: "textbook",
        },
        {
          answers: ["A", "B", "C", "D"],
          correct: 1,
          id: "manual-1",
          index: 2,
          points: 2,
          question: "manual question",
          questionType: "single-choice",
          source: "Гараар",
          sourceType: "question-bank",
        },
        {
          answers: ["A", "B", "C", "D"],
          correct: 2,
          id: "textbook-old-2",
          index: 3,
          points: 2,
          question: "old textbook 2",
          questionType: "single-choice",
          source: "Геометр",
          sourceType: "textbook",
        },
      ],
      textbookQuestions: [
        {
          answers: ["A", "B", "C", "D"],
          correct: 3,
          id: "generated-1",
          index: 1,
          points: 2,
          question: "new textbook 1",
          questionType: "single-choice",
          source: "Шинэ ном",
          sourceType: "textbook",
        },
        {
          answers: ["A", "B", "C", "D"],
          correct: 0,
          id: "generated-2",
          index: 2,
          points: 2,
          question: "new textbook 2",
          questionType: "single-choice",
          source: "Шинэ ном",
          sourceType: "textbook",
        },
      ],
    });

    expect(result).toHaveLength(3);
    expect(result.map((question) => question.question)).toEqual([
      "new textbook 1",
      "new textbook 2",
      "manual question",
    ]);
    expect(result.map((question) => question.index)).toEqual([1, 2, 3]);
    expect(result[0]?.id).toBe("textbook-test-1");
    expect(result[1]?.id).toBe("textbook-test-2");
  });
});
