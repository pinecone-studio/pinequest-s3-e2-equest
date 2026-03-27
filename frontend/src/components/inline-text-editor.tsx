"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { cn } from "@/lib/utils";

export type InlineTextEditorHandle = {
  clear: () => void;
  focus: () => void;
  insertText: (text: string) => void;
  moveLeft: () => void;
  moveRight: () => void;
};

type InlineTextEditorProps = {
  autoFocus?: boolean;
  className?: string;
  onChange: (value: string) => void;
  value: string;
};

function placeCaretAtEnd(element: HTMLElement) {
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTextAtSelection(element: HTMLElement, text: string) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    element.focus();
    placeCaretAtEnd(element);
    return insertTextAtSelection(element, text);
  }

  const range = selection.getRangeAt(0);

  if (!element.contains(range.commonAncestorContainer)) {
    element.focus();
    placeCaretAtEnd(element);
    return insertTextAtSelection(element, text);
  }

  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

const InlineTextEditor = forwardRef<
  InlineTextEditorHandle,
  InlineTextEditorProps
>(function InlineTextEditor(
  { autoFocus = false, className, onChange, value },
  ref,
) {
  const editorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const element = editorRef.current;

    if (!element) {
      return;
    }

    if (element.textContent !== value) {
      element.textContent = value;
    }

    if (autoFocus) {
      element.focus();
      placeCaretAtEnd(element);
    }
  }, [autoFocus, value]);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        const element = editorRef.current;

        if (!element) {
          onChange("");
          return;
        }

        element.textContent = "";
        onChange("");
        element.focus();
      },
      focus() {
        const element = editorRef.current;

        if (!element) {
          return;
        }

        element.focus();
        placeCaretAtEnd(element);
      },
      insertText(text: string) {
        const element = editorRef.current;

        if (!element) {
          onChange(`${value}${text}`);
          return;
        }

        element.focus();
        insertTextAtSelection(element, text);
        onChange(element.textContent ?? "");
      },
      moveLeft() {
        const selection = window.getSelection();

        editorRef.current?.focus();
        selection?.modify?.("move", "backward", "character");
      },
      moveRight() {
        const selection = window.getSelection();

        editorRef.current?.focus();
        selection?.modify?.("move", "forward", "character");
      },
    }),
    [onChange, value],
  );

  return (
    <span
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        "inline-block min-w-[3rem] whitespace-pre-wrap break-words bg-transparent text-foreground outline-none",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onInput={(event) => {
        onChange(event.currentTarget.textContent ?? "");
      }}
    />
  );
});

InlineTextEditor.displayName = "InlineTextEditor";

export default InlineTextEditor;
