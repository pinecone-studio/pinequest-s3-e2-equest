import { describe, expect, it } from "bun:test";
import { generateTextbookTest } from "./textbook-material-data.ts";

describe("generateTextbookTest", () => {
  it("tops up with mock questions when the requested count is larger than available unique problems", () => {
    const pageContent = "Дасгал\nA) x + 1 = 2";
    const section = {
      chapterTitle: "1-р бүлэг",
      endPage: 1,
      id: "section-1",
      pageCount: 1,
      pageNumbers: [1],
      pages: [
        {
          content: pageContent,
          examples: [],
          formulas: [],
          pageNumber: 1,
          paragraphs: [],
        },
      ],
      startPage: 1,
      subsections: [],
      title: "Тэгшитгэл",
    };
    const book = {
      chapters: [
        {
          id: "chapter-1",
          sections: [section],
          title: "Алгебр",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      fileName: "mock.pdf",
      id: "book-1",
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: pageContent,
        },
      ],
      sections: [section],
      title: "Mock textbook",
    };

    const result = generateTextbookTest(book, ["section-1"], {
      openQuestionCount: 0,
      questionCount: 5,
      totalScore: 5,
    });

    expect(result.questionCountGenerated).toBe(5);
    expect(result.questions).toHaveLength(5);
    expect(
      result.questions.some(
        (question) =>
          question.question.includes("Дараах") &&
          Array.isArray(question.choices) &&
          question.choices.length === 4,
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("mock асуултаар нөхлөө")),
    ).toBe(true);
  });

  it("prefers harder mock top-up for 10th grade requests", () => {
    const pageContent = "Дасгал\nA) x + 1 = 2";
    const section = {
      chapterTitle: "1-р бүлэг",
      endPage: 1,
      id: "section-1",
      pageCount: 1,
      pageNumbers: [1],
      pages: [
        {
          content: pageContent,
          examples: [],
          formulas: [],
          pageNumber: 1,
          paragraphs: [],
        },
      ],
      startPage: 1,
      subsections: [],
      title: "Тэгшитгэл",
    };
    const book = {
      chapters: [
        {
          id: "chapter-1",
          sections: [section],
          title: "Алгебр",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      fileName: "mock.pdf",
      id: "book-1",
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: pageContent,
        },
      ],
      sections: [section],
      title: "Mock textbook",
    };

    const result = generateTextbookTest(book, ["section-1"], {
      fallbackDifficulty: "hard",
      grade: 10,
      openQuestionCount: 0,
      questionCount: 5,
      totalScore: 5,
    });

    expect(result.questionCountGenerated).toBe(5);
    expect(
      result.questions.some((question) =>
        /(2\^\(x - 1\) = 16|√\(x \+ 9\) = 6|log₂32 \+ 3|log₃81 - 2|sin 30° \+ cos 60° \+ tan 45°)/.test(
          question.bookProblem,
        ),
      ),
    ).toBe(true);
  });

  it("uses 9th grade specific mcq fallback logic for harder requests", () => {
    const pageContent = "Дасгал\nA) x + 1 = 2";
    const section = {
      chapterTitle: "1-р бүлэг",
      endPage: 1,
      id: "section-1",
      pageCount: 1,
      pageNumbers: [1],
      pages: [
        {
          content: pageContent,
          examples: [],
          formulas: [],
          pageNumber: 1,
          paragraphs: [],
        },
      ],
      startPage: 1,
      subsections: [],
      title: "Тэгшитгэл",
    };
    const book = {
      chapters: [
        {
          id: "chapter-1",
          sections: [section],
          title: "Алгебр",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      fileName: "mock.pdf",
      id: "book-1",
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: pageContent,
        },
      ],
      sections: [section],
      title: "Mock textbook",
    };

    const result = generateTextbookTest(book, ["section-1"], {
      fallbackDifficulty: "hard",
      grade: 9,
      openQuestionCount: 0,
      questionCount: 5,
      totalScore: 5,
    });

    expect(result.questionCountGenerated).toBe(5);
    expect(
      result.questions.some((question) =>
        /(x² - 5x \+ 6 = 0 тэгшитгэлийн язгууруудын нийлбэр|√\(x \+ 4\) = 3|\|2x - 7\| = 5 тэгшитгэлийн их шийд|y = x² - 4x \+ 1 функцийн оройн x координат|Тэгш өнцөгт гурвалжны катетууд 6 ба 8 бол гипотенуз)/.test(
          question.bookProblem,
        ),
      ),
    ).toBe(true);
  });

  it("builds harder 9th grade written tasks with mock fallback when the source problems are too easy", () => {
    const pageContent = "Дасгал\nA) x + 1 = 2";
    const section = {
      chapterTitle: "1-р бүлэг",
      endPage: 1,
      id: "section-1",
      pageCount: 1,
      pageNumbers: [1],
      pages: [
        {
          content: pageContent,
          examples: [],
          formulas: [],
          pageNumber: 1,
          paragraphs: [],
        },
      ],
      startPage: 1,
      subsections: [],
      title: "Тэгшитгэл",
    };
    const book = {
      chapters: [
        {
          id: "chapter-1",
          sections: [section],
          title: "Алгебр",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      fileName: "mock.pdf",
      id: "book-1",
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: pageContent,
        },
      ],
      sections: [section],
      title: "Mock textbook",
    };

    const result = generateTextbookTest(book, ["section-1"], {
      fallbackDifficulty: "hard",
      grade: 9,
      openQuestionCount: 2,
      questionCount: 0,
      totalScore: 10,
    });

    expect(result.openQuestionCountGenerated).toBe(2);
    expect(result.openQuestions.every((task) => task.answer.trim().length > 0)).toBe(
      true,
    );
    expect(
      result.openQuestions.some((task) =>
        /(2x² - 7x \+ 3 = 0|√\(x \+ 7\) = x - 1|x\/\(x - 2\) \+ 2\/\(x \+ 2\) = 3|\|2x - 5\| = x \+ 1)/.test(
          task.prompt,
        ),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("mock бодлогоор нөхлөө")),
    ).toBe(true);
  });
});
