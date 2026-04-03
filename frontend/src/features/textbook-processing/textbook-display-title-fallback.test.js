import { describe, expect, test } from "bun:test";
import { applyTextbookDisplayTitleFallbacks } from "./textbook-display-title-fallback.ts";

describe("applyTextbookDisplayTitleFallbacks", () => {
  test("uses curated 9th grade math chapter and section titles even when parsed labels look real", () => {
    const result = applyTextbookDisplayTitleFallbacks(
      [
        {
          childCount: 1,
          children: [
            {
              childCount: 0,
              children: [],
              createdAt: "",
              depth: 1,
              endPage: 3,
              id: "section-1",
              materialId: "material-1",
              metadata: null,
              nodeType: "section",
              normalizedTitle: "section-1",
              orderIndex: 2,
              pageNumbers: [1, 2, 3],
              parentId: "chapter-1",
              startPage: 1,
              title: "1.1 Тооны модул",
              updatedAt: "",
            },
          ],
          createdAt: "",
          depth: 0,
          endPage: 10,
          id: "chapter-1",
          materialId: "material-1",
          metadata: null,
          nodeType: "chapter",
          normalizedTitle: "chapter-1",
          orderIndex: 1,
          pageNumbers: [1, 2, 3],
          parentId: null,
          startPage: 1,
          title: "БҮЛЭГ I. Тэгшитгэл, тэнцэтгэл биш",
          updatedAt: "",
        },
      ],
      {
        bookTitle: "Математик-9",
        grade: 9,
        subject: "math",
      },
    );

    expect(result[0]?.title).toBe("БҮЛЭГ I. Тоон илэрхийлэл ба квадрат язгуур");
    expect(result[0]?.children[0]?.title).toBe("1.1 Рационал тоон илэрхийлэл");
  });

  test("replaces placeholder chapter and section titles with realistic display labels", () => {
    const result = applyTextbookDisplayTitleFallbacks(
      [
        {
          childCount: 1,
          children: [
            {
              childCount: 1,
              children: [
                {
                  childCount: 0,
                  children: [],
                  createdAt: "",
                  depth: 2,
                  endPage: 3,
                  id: "subchapter-1",
                  materialId: "material-1",
                  metadata: null,
                  nodeType: "subchapter",
                  normalizedTitle: "subchapter-1",
                  orderIndex: 3,
                  pageNumbers: [3],
                  parentId: "section-1",
                  startPage: 3,
                  title: "Дэд сэдэв 3",
                  updatedAt: "",
                },
              ],
              createdAt: "",
              depth: 1,
              endPage: 3,
              id: "section-1",
              materialId: "material-1",
              metadata: null,
              nodeType: "section",
              normalizedTitle: "section-1",
              orderIndex: 2,
              pageNumbers: [1, 2, 3],
              parentId: "chapter-1",
              startPage: 1,
              title: "Сэдэв 1",
              updatedAt: "",
            },
          ],
          createdAt: "",
          depth: 0,
          endPage: 10,
          id: "chapter-1",
          materialId: "material-1",
          metadata: null,
          nodeType: "chapter",
          normalizedTitle: "chapter-1",
          orderIndex: 1,
          pageNumbers: [1, 2, 3],
          parentId: null,
          startPage: 1,
          title: "Математик-10 БҮЛЭГ 1",
          updatedAt: "",
        },
      ],
      {
        bookTitle: "Математик-10",
        grade: 10,
        subject: "math",
      },
    );

    expect(result[0]?.title).toBe("БҮЛЭГ I. Тэгшитгэл, тэнцэтгэл биш");
    expect(result[0]?.children[0]?.title).toBe("1.1 Үндсэн ойлголт");
    expect(result[0]?.children[0]?.children[0]?.title).toBe("1.1.1 Тайлбар");
  });

  test("keeps real-looking parsed titles unchanged", () => {
    const result = applyTextbookDisplayTitleFallbacks(
      [
        {
          childCount: 0,
          children: [],
          createdAt: "",
          depth: 0,
          endPage: 10,
          id: "chapter-1",
          materialId: "material-1",
          metadata: null,
          nodeType: "chapter",
          normalizedTitle: "chapter-1",
          orderIndex: 1,
          pageNumbers: [1, 2, 3],
          parentId: null,
          startPage: 1,
          title: "БҮЛЭГ I. Тэгшитгэл, тэнцэтгэл биш",
          updatedAt: "",
        },
      ],
      {
        bookTitle: "Математик-10",
        grade: 10,
        subject: "math",
      },
    );

    expect(result[0]?.title).toBe("БҮЛЭГ I. Тэгшитгэл, тэнцэтгэл биш");
  });
});
