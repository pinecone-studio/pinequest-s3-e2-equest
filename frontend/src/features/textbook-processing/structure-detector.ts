import { MIN_PAGE_TEXT_CHAR_COUNT } from "./constants";
import {
  cleanAnalysisPageText,
  cleanHeading,
  directPageNumbersFromMetadata,
  extractHeadingNumber,
  slugifyText,
} from "./normalizer";
import type {
  TextbookProcessingPage,
  TextbookProcessingSection,
} from "./types";

type MutableNode = {
  id: string;
  parentId: string | null;
  nodeType: "chapter" | "section" | "subchapter";
  title: string;
  normalizedTitle: string;
  orderIndex: number;
  depth: number;
  startPage: number | null;
  endPage: number | null;
  childCount: number;
  pageNumbers: number[];
  directPageNumbers: number[];
  metadata: Record<string, unknown> | null;
};

function sortedUniquePageNumbers(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isFinite(value) && value >= 1),
    ),
  ).sort((left, right) => left - right);
}

function detectChapterTitle(text: string) {
  const matched = String(text || "").match(
    /((?:[IVX]{1,4}\s+)?Б[ҮУ]?ЛЭГ[\s.\-–—]*[IVX0-9A-ZА-ЯЁ]{0,8}(?:[\s,.:;\-–—]+[^\n]{0,80})?)/iu,
  );

  return matched ? cleanHeading(matched[1]) : "";
}

function detectSectionTitles(text: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const sectionRe =
    /(\d+\.\d+)(?!\.\d)\s*[\])\.:\-–—]?\s*([\s\S]{2,120}?)(?=(?:\d+\.\d+\.\d+\s)|(?:\d+\.\d+(?!\.\d)\s)|(?:Exercise|Example|Problem|Дасгал|Даалгавар|Бодлого)\b|$)/g;
  let match = sectionRe.exec(String(text || ""));

  while (match && out.length < 8) {
    const tail = cleanHeading(
      String(match[2] || "")
        .replace(
          /\s+(?:Exercise|Example|Problem|Дасгал|Даалгавар|Бодлого)\b[\s\S]*$/iu,
          "",
        )
        .replace(/\s+\d+\)\s*[\s\S]*$/u, ""),
    );
    const full = cleanHeading(`${match[1].trim()} ${tail}`);
    if (full && !seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
    match = sectionRe.exec(String(text || ""));
  }

  return out;
}

function detectSubsectionTitles(text: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const subsectionRe =
    /(\d+\.\d+\.\d+)\s*[\])\.:\-–—]?\s*([\s\S]{2,120}?)(?=(?:\d+\.\d+\.\d+\s)|(?:\d+\.\d+(?!\.\d)\s)|(?:Exercise|Example|Problem|Дасгал|Даалгавар|Бодлого)\b|$)/g;
  let match = subsectionRe.exec(String(text || ""));

  while (match && out.length < 12) {
    const tail = cleanHeading(
      String(match[2] || "")
        .replace(
          /\s+(?:Exercise|Example|Problem|Дасгал|Даалгавар|Бодлого)\b[\s\S]*$/iu,
          "",
        )
        .replace(/\s+\d+\)\s*[\s\S]*$/u, ""),
    );
    const full = cleanHeading(`${match[1].trim()} ${tail}`);
    if (full && !seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
    match = subsectionRe.exec(String(text || ""));
  }

  return out;
}

function isLikelyTableOfContents(text: string) {
  const source = String(text || "");
  const hasContentsMarker = /(ГАРЧИГ|TABLE OF CONTENTS|CONTENTS)/iu.test(source);
  const sectionCount = (source.match(/\d+\.\d+/g) || []).length;
  const chapterCount = (source.match(/Б[ҮУ]?ЛЭГ/giu) || []).length;
  const dotCount = (source.match(/[.]{3,}/g) || []).length;
  const pageCount = (source.match(/(?:^|\s)\d{1,3}(?=\s|$)/g) || []).length;

  return (
    (hasContentsMarker && (sectionCount >= 2 || dotCount >= 2 || pageCount >= 6)) ||
    (sectionCount >= 5 && dotCount >= 3) ||
    (chapterCount >= 2 && sectionCount >= 3 && pageCount >= 4)
  );
}

function buildDefaultTitle(fileName: string) {
  return String(fileName || "")
    .replace(/\.pdf$/i, "")
    .trim() || "Сурах бичиг";
}

function createNodeId(
  parentId: string | null,
  nodeType: "chapter" | "section" | "subchapter",
  title: string,
) {
  const scoped = [parentId || "root", nodeType, slugifyText(title)].join(":");
  return scoped;
}

function findNodeByHeadingPrefix(
  nodes: MutableNode[],
  nodeType: "section" | "subchapter",
  parentId: string | null,
  title: string,
) {
  const headingNumber = extractHeadingNumber(title);
  if (!headingNumber) {
    return null;
  }

  return (
    nodes.find(
      (node) =>
        node.nodeType === nodeType &&
        node.parentId === parentId &&
        extractHeadingNumber(node.title) === headingNumber,
    ) || null
  );
}

function ensureNode(
  nodes: MutableNode[],
  options: {
    nodeType: "chapter" | "section" | "subchapter";
    parentId: string | null;
    title: string;
    depth: number;
  },
) {
  const title = cleanHeading(options.title) || "Нэргүй хэсэг";
  const existing =
    (options.nodeType === "section" || options.nodeType === "subchapter"
      ? findNodeByHeadingPrefix(
          nodes,
          options.nodeType,
          options.parentId,
          title,
        )
      : null) ||
    nodes.find(
      (node) =>
        node.parentId === options.parentId &&
        node.nodeType === options.nodeType &&
        node.normalizedTitle === slugifyText(title),
    );

  if (existing) {
    return existing;
  }

  const node: MutableNode = {
    id: createNodeId(options.parentId, options.nodeType, title),
    parentId: options.parentId,
    nodeType: options.nodeType,
    title,
    normalizedTitle: slugifyText(title),
    orderIndex: nodes.length,
    depth: options.depth,
    startPage: null,
    endPage: null,
    childCount: 0,
    pageNumbers: [],
    directPageNumbers: [],
    metadata: {
      directPageNumbers: [],
    },
  };
  nodes.push(node);
  return node;
}

function assignPage(node: MutableNode, pageNumber: number) {
  if (!node.directPageNumbers.includes(pageNumber)) {
    node.directPageNumbers.push(pageNumber);
  }
}

function updateNodeBounds(node: MutableNode) {
  const pageNumbers = sortedUniquePageNumbers(node.pageNumbers);
  node.pageNumbers = pageNumbers;
  node.startPage = pageNumbers[0] ?? null;
  node.endPage = pageNumbers[pageNumbers.length - 1] ?? null;
  node.metadata = {
    ...(node.metadata || {}),
    directPageNumbers: sortedUniquePageNumbers(node.directPageNumbers),
  };
}

export function detectTextbookStructure(
  pages: TextbookProcessingPage[],
  options: {
    fileName: string;
  },
): {
  title: string;
  sections: TextbookProcessingSection[];
} {
  const nodes: MutableNode[] = [];
  let currentChapter: MutableNode | null = null;
  let currentSection: MutableNode | null = null;
  let currentSubchapter: MutableNode | null = null;

  const title = buildDefaultTitle(options.fileName);

  for (const page of pages) {
    if (page.charCount < MIN_PAGE_TEXT_CHAR_COUNT) {
      continue;
    }

    const text = cleanAnalysisPageText(page.normalizedText || page.rawText);
    if (!text || isLikelyTableOfContents(text)) {
      continue;
    }

    const chapterTitle = detectChapterTitle(text);
    const sectionTitle = detectSectionTitles(text)[0] || "";
    const subsectionTitle = detectSubsectionTitles(text)[0] || "";

    if (chapterTitle) {
      currentChapter = ensureNode(nodes, {
        nodeType: "chapter",
        parentId: null,
        title: chapterTitle,
        depth: 0,
      });
      currentSection = null;
      currentSubchapter = null;
    }

    if (!currentChapter) {
      currentChapter = ensureNode(nodes, {
        nodeType: "chapter",
        parentId: null,
        title: `${title} БҮЛЭГ 1`,
        depth: 0,
      });
    }

    if (sectionTitle) {
      currentSection = ensureNode(nodes, {
        nodeType: "section",
        parentId: currentChapter.id,
        title: sectionTitle,
        depth: 1,
      });
      currentSubchapter = null;
    }

    if (!currentSection) {
      currentSection = ensureNode(nodes, {
        nodeType: "section",
        parentId: currentChapter.id,
        title: `Сэдэв ${page.pageNumber}`,
        depth: 1,
      });
    }

    if (subsectionTitle) {
      currentSubchapter = ensureNode(nodes, {
        nodeType: "subchapter",
        parentId: currentSection.id,
        title: subsectionTitle,
        depth: 2,
      });
    }

    const target = currentSubchapter || currentSection || currentChapter;
    assignPage(target, page.pageNumber);
  }

  const nonChapterNodes = nodes.filter((node) => node.nodeType !== "chapter");
  if (!nonChapterNodes.length) {
    const fallbackChapter = ensureNode(nodes, {
      nodeType: "chapter",
      parentId: null,
      title: `${title} БҮЛЭГ 1`,
      depth: 0,
    });
    const fallbackSection = ensureNode(nodes, {
      nodeType: "section",
      parentId: fallbackChapter.id,
      title: "Нийт агуулга",
      depth: 1,
    });
    for (const page of pages) {
      if (page.charCount >= MIN_PAGE_TEXT_CHAR_COUNT) {
        assignPage(fallbackSection, page.pageNumber);
      }
    }
  }

  const childrenByParent = new Map<string | null, MutableNode[]>();
  for (const node of nodes) {
    const list = childrenByParent.get(node.parentId) || [];
    list.push(node);
    childrenByParent.set(node.parentId, list);
  }

  const computePageNumbers = (node: MutableNode): number[] => {
    const childPageNumbers = (childrenByParent.get(node.id) || []).flatMap((child) =>
      computePageNumbers(child),
    );
    node.pageNumbers = sortedUniquePageNumbers([
      ...node.directPageNumbers,
      ...childPageNumbers,
    ]);
    node.childCount = (childrenByParent.get(node.id) || []).length;
    updateNodeBounds(node);
    return node.pageNumbers;
  };

  for (const root of childrenByParent.get(null) || []) {
    computePageNumbers(root);
  }

  const sections: TextbookProcessingSection[] = nodes
    .map((node) => ({
      id: node.id,
      parentId: node.parentId,
      nodeType: node.nodeType,
      title: node.title,
      normalizedTitle: node.normalizedTitle,
      orderIndex: node.orderIndex,
      depth: node.depth,
      startPage: node.startPage,
      endPage: node.endPage,
      childCount: node.childCount,
      pageNumbers: node.pageNumbers,
      metadata: {
        ...(node.metadata || {}),
        directPageNumbers: directPageNumbersFromMetadata(node.metadata),
      },
    }))
    .sort((left, right) => left.orderIndex - right.orderIndex);

  return {
    title,
    sections,
  };
}
