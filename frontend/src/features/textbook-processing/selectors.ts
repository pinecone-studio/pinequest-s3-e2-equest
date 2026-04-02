import { directPageNumbersFromMetadata } from "./normalizer";
import type {
  TextbookGenerateSelection,
  TextbookMaterialDetail,
  TextbookSectionRecord,
  TextbookSectionTreeNode,
} from "./types";

export function buildSectionTree(
  sections: TextbookSectionRecord[],
): TextbookSectionTreeNode[] {
  const nodeMap = new Map<string, TextbookSectionTreeNode>();
  for (const section of sections) {
    nodeMap.set(section.id, {
      ...section,
      children: [],
    });
  }

  const roots: TextbookSectionTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes: TextbookSectionTreeNode[]) => {
    nodes.sort((left, right) => left.orderIndex - right.orderIndex);
    for (const node of nodes) {
      sortTree(node.children);
    }
  };

  sortTree(roots);
  return roots;
}

function buildSectionMaps(sections: TextbookSectionRecord[]) {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const childrenByParent = new Map<string | null, TextbookSectionRecord[]>();
  for (const section of sections) {
    const list = childrenByParent.get(section.parentId) || [];
    list.push(section);
    childrenByParent.set(section.parentId, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((left, right) => left.orderIndex - right.orderIndex);
  }
  return { byId, childrenByParent };
}

export function getDescendantNodeIds(
  sections: TextbookSectionRecord[],
  sectionId: string,
) {
  const { childrenByParent } = buildSectionMaps(sections);
  const out: string[] = [];

  const visit = (currentId: string) => {
    out.push(currentId);
    for (const child of childrenByParent.get(currentId) || []) {
      visit(child.id);
    }
  };

  visit(sectionId);
  return out;
}

export function resolveGenerateSelection(
  detail: TextbookMaterialDetail | null,
  selectedNodeIds: string[],
): TextbookGenerateSelection {
  if (!detail) {
    return {
      effectiveNodeIds: [],
      selectedSectionTitles: [],
      selectedPageNumbers: [],
    };
  }

  const { byId, childrenByParent } = buildSectionMaps(detail.sections);
  const effectiveIds: string[] = [];
  const selectedTitles: string[] = [];
  const pageNumbers = new Set<number>();
  const seen = new Set<string>();

  const pushEffective = (section: TextbookSectionRecord) => {
    if (section.nodeType === "chapter") {
      for (const child of childrenByParent.get(section.id) || []) {
        pushEffective(child);
      }
      return;
    }

    const children = childrenByParent.get(section.id) || [];
    const directPages = directPageNumbersFromMetadata(section.metadata);
    const shouldIncludeSelf = directPages.length > 0 || children.length === 0;

    if (shouldIncludeSelf && !seen.has(section.id)) {
      seen.add(section.id);
      effectiveIds.push(section.id);
      selectedTitles.push(section.title);
      for (const pageNumber of section.pageNumbers) {
        pageNumbers.add(pageNumber);
      }
    }

    for (const child of children) {
      pushEffective(child);
    }
  };

  for (const selectedId of selectedNodeIds) {
    const section = byId.get(selectedId);
    if (!section) {
      continue;
    }
    pushEffective(section);
  }

  return {
    effectiveNodeIds: effectiveIds,
    selectedSectionTitles: Array.from(new Set(selectedTitles)),
    selectedPageNumbers: Array.from(pageNumbers).sort((left, right) => left - right),
  };
}

export function countSelectedPagesFromMaterial(
  detail: TextbookMaterialDetail | null,
  selectedNodeIds: string[],
) {
  return resolveGenerateSelection(detail, selectedNodeIds).selectedPageNumbers.length;
}

export function getInitialExpandedChapterIds(detail: TextbookMaterialDetail | null) {
  if (!detail) {
    return [];
  }

  return detail.sections
    .filter((section) => section.nodeType === "chapter")
    .slice(0, 2)
    .map((section) => section.id);
}
