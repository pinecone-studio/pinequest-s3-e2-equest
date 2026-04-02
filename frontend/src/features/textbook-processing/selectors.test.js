import { describe, expect, test } from "bun:test";
import { getInitialExpandedChapterIds } from "./selectors.ts";

describe("getInitialExpandedChapterIds", () => {
  test("returns no expanded chapters by default", () => {
    const result = getInitialExpandedChapterIds({
      chunks: [],
      material: {
        bucketName: "bucket",
        chapterCount: 2,
        contentType: "application/pdf",
        createdAt: "",
        errorMessage: null,
        fileName: "math-10.pdf",
        grade: 10,
        id: "material-1",
        lastProcessedAt: null,
        ocrNeededPageCount: 0,
        pageCount: 10,
        progressCurrent: 0,
        progressTotal: 0,
        r2Key: "math-10.pdf",
        readyAt: null,
        sectionCount: 2,
        size: 100,
        stage: "ready",
        status: "ready",
        statusMessage: null,
        subchapterCount: 0,
        subject: "math",
        title: "Математик-10",
        unsupportedReason: null,
        updatedAt: "",
        warnings: [],
      },
      pages: [],
      sections: [
        {
          childCount: 1,
          createdAt: "",
          depth: 0,
          endPage: 5,
          id: "chapter-1",
          materialId: "material-1",
          metadata: null,
          nodeType: "chapter",
          normalizedTitle: "chapter-1",
          orderIndex: 1,
          pageNumbers: [1, 2, 3, 4, 5],
          parentId: null,
          startPage: 1,
          title: "БҮЛЭГ I",
          updatedAt: "",
        },
        {
          childCount: 1,
          createdAt: "",
          depth: 0,
          endPage: 10,
          id: "chapter-2",
          materialId: "material-1",
          metadata: null,
          nodeType: "chapter",
          normalizedTitle: "chapter-2",
          orderIndex: 2,
          pageNumbers: [6, 7, 8, 9, 10],
          parentId: null,
          startPage: 6,
          title: "БҮЛЭГ II",
          updatedAt: "",
        },
      ],
    });

    expect(result).toEqual([]);
  });
});
