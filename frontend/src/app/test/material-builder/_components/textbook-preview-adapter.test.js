import { describe, expect, test } from "bun:test";
import { mapGeneratedTextbookTestToPreviewQuestions } from "./textbook-preview-adapter.ts";

describe("mapGeneratedTextbookTestToPreviewQuestions", () => {
  test("maps textbook MCQ and written tasks into preview questions", () => {
    const questions = mapGeneratedTextbookTestToPreviewQuestions({
      bookTitle: "Алгебр 9",
      generatedTest: {
        difficultyCountsApplied: {
          easy: 1,
          hard: 0,
          medium: 1,
        },
        exerciseProblemCount: 1,
        openQuestionCountGenerated: 1,
        openQuestions: [
          {
            answer: "x = 4",
            difficulty: "medium",
            id: "written-1",
            kind: "written",
            points: 0,
            prompt: "Тэгшитгэлийг бодоод тайлбарла.",
            score: 3,
            sourceExcerpt: "Холбогдох тайлбар хэсэг",
            sourcePages: [12],
          },
        ],
        questionCountGenerated: 1,
        questions: [
          {
            bookProblem: "2x + 5 = 13",
            choices: ["A. x = 3", "B. x = 4", "C. x = 5", "D. x = 6"],
            correctAnswer: "B",
            difficulty: "easy",
            explanation: "",
            id: "mcq-1",
            kind: "mcq",
            points: 2,
            question: "Зөв хариултыг сонгоно уу.",
            sourcePages: [10],
          },
        ],
        sourcePages: [10, 12],
        totalScore: 5,
        warnings: [],
      },
    });

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      answers: ["x = 3", "x = 4", "x = 5", "x = 6"],
      correct: 1,
      points: 2,
      question: "Дараах тэгшитгэлийн шийдийг ол.\n2x + 5 = 13",
      questionType: "single-choice",
      source: "Алгебр 9",
      sourceType: "textbook",
    });
    expect(questions[1]).toMatchObject({
      answers: ["x = 4"],
      correct: 0,
      explanation: "Холбогдох тайлбар хэсэг",
      points: 3,
      questionType: "written",
      source: "Алгебр 9",
      sourceType: "textbook",
    });
  });
});
