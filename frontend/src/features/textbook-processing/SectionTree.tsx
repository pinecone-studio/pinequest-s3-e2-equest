"use client";

import { ChevronDown } from "lucide-react";
import type { TextbookSectionTreeNode } from "./types";

function SelectionCheckbox({
  checked,
  disabled = false,
  indeterminate = false,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(node) => {
        if (node) {
          node.indeterminate = indeterminate;
        }
      }}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded-[5px] border border-[#dbe4f3] accent-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function getSelectableIds(node: TextbookSectionTreeNode): string[] {
  const ownIds = node.nodeType === "chapter" ? [] : [node.id];
  return ownIds.concat(node.children.flatMap(getSelectableIds));
}

function getSelectionState(
  node: TextbookSectionTreeNode,
  selectedIdSet: Set<string>,
) {
  const selectableIds = getSelectableIds(node);
  const selectedCount = selectableIds.filter((id) => selectedIdSet.has(id)).length;

  return {
    selectableIds,
    allSelected: selectableIds.length > 0 && selectedCount === selectableIds.length,
    partiallySelected: selectedCount > 0 && selectedCount < selectableIds.length,
  };
}

function SectionTreeNodeView({
  node,
  expandedIds,
  onSelectionChange,
  onToggleExpanded,
  selectedIdSet,
}: {
  node: TextbookSectionTreeNode;
  expandedIds: Set<string>;
  onSelectionChange: (sectionIds: string[], checked: boolean) => void;
  onToggleExpanded: (sectionId: string) => void;
  selectedIdSet: Set<string>;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const selectionState = getSelectionState(node, selectedIdSet);

  return (
    <div
      className={`rounded-[12px] border border-[#e6edf7] bg-white ${
        node.depth > 0 ? "ml-5" : ""
      }`}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        {selectionState.selectableIds.length > 0 ? (
          <SelectionCheckbox
            checked={selectionState.allSelected}
            indeterminate={selectionState.partiallySelected}
            onChange={(checked) =>
              onSelectionChange(selectionState.selectableIds, checked)
            }
          />
        ) : (
          <div className="mt-1 h-4 w-4 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => hasChildren && onToggleExpanded(node.id)}
            className="flex w-full items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-6 text-slate-900">
                {node.title}
              </p>
              <p className="text-[12px] text-slate-500">
                {node.startPage ?? "-"} - {node.endPage ?? "-"} хуудас
                {hasChildren ? ` · ${node.children.length} дэд хэсэг` : ""}
              </p>
            </div>
            {hasChildren ? (
              <ChevronDown
                className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            ) : null}
          </button>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="space-y-2 border-t border-[#edf2fb] px-3 py-3">
          {node.children.map((child) => (
            <SectionTreeNodeView
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onSelectionChange={onSelectionChange}
              onToggleExpanded={onToggleExpanded}
              selectedIdSet={selectedIdSet}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SectionTree({
  expandedIds,
  nodes,
  onSelectionChange,
  onToggleExpanded,
  selectedIdSet,
}: {
  expandedIds: string[];
  nodes: TextbookSectionTreeNode[];
  onSelectionChange: (sectionIds: string[], checked: boolean) => void;
  onToggleExpanded: (sectionId: string) => void;
  selectedIdSet: Set<string>;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <SectionTreeNodeView
          key={node.id}
          node={node}
          expandedIds={new Set(expandedIds)}
          onSelectionChange={onSelectionChange}
          onToggleExpanded={onToggleExpanded}
          selectedIdSet={selectedIdSet}
        />
      ))}
    </div>
  );
}
