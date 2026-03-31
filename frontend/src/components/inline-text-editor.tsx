"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { sanitizeRichTextHtml } from "@/lib/sanitize-rich-text";
import { cn } from "@/lib/utils";

export type InlineTextEditorHandle = {
  clear: () => void;
  focus: () => void;
  insertText: (text: string) => void;
  moveLeft: () => void;
  moveRight: () => void;
  toggleBold: () => void;
  toggleBulletList: () => void;
  toggleItalic: () => void;
  toggleOrderedList: () => void;
};

type InlineTextEditorProps = {
  autoFocus?: boolean;
  className?: string;
  onChange: (value: string) => void;
  richText?: boolean;
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

function getSelectionRangeWithin(element: HTMLElement) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!element.contains(range.commonAncestorContainer)) {
    return null;
  }

  return range.cloneRange();
}

function restoreSelectionRange(element: HTMLElement, range: Range | null) {
  if (!range) {
    return false;
  }

  const selection = window.getSelection();

  if (!selection) {
    return false;
  }

  try {
    const nextRange = range.cloneRange();

    if (
      !element.contains(nextRange.startContainer) ||
      !element.contains(nextRange.endContainer)
    ) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(nextRange);
    return true;
  } catch {
    return false;
  }
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

function syncRichTextChange(
  element: HTMLElement | null,
  onChange: (value: string) => void,
) {
  if (!element) {
    return;
  }

  onChange(sanitizeRichTextHtml(element.innerHTML));
}

const InlineTextEditor = forwardRef<
  InlineTextEditorHandle,
  InlineTextEditorProps
>(function InlineTextEditor(
  { autoFocus = false, className, onChange, richText = false, value },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const previousAutoFocusRef = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);

  function rememberSelection() {
    const element = editorRef.current;

    if (!element) {
      return;
    }

    savedSelectionRef.current = getSelectionRangeWithin(element);
  }

  function focusEditor() {
    const element = editorRef.current;

    if (!element) {
      return;
    }

    element.focus();

    if (restoreSelectionRange(element, savedSelectionRef.current)) {
      return;
    }

    placeCaretAtEnd(element);
  }

  useEffect(() => {
    const element = editorRef.current;

    if (!element) {
      return;
    }

    if (richText) {
      const nextHtml = sanitizeRichTextHtml(value);
      const isFocused = document.activeElement === element;

      if (!isFocused && element.innerHTML !== nextHtml) {
        element.innerHTML = nextHtml;
        savedSelectionRef.current = null;
      }
    } else if (element.textContent !== value) {
      element.textContent = value;
    }

    if (autoFocus && !previousAutoFocusRef.current) {
      focusEditor();
    }

    previousAutoFocusRef.current = autoFocus;
  }, [autoFocus, richText, value]);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        const element = editorRef.current;

        if (!element) {
          onChange("");
          return;
        }

        if (richText) {
          element.innerHTML = "";
          savedSelectionRef.current = null;
          onChange("");
        } else {
          element.textContent = "";
          onChange("");
        }
        focusEditor();
      },
      focus() {
        focusEditor();
      },
      insertText(text: string) {
        const element = editorRef.current;

        if (!element) {
          onChange(`${value}${text}`);
          return;
        }

        focusEditor();
        if (richText && typeof document.execCommand === "function") {
          document.execCommand("insertText", false, text);
          rememberSelection();
          syncRichTextChange(element, onChange);
        } else {
          insertTextAtSelection(element, text);
          rememberSelection();
          onChange(element.textContent ?? "");
        }
      },
      moveLeft() {
        const selection = window.getSelection();

        focusEditor();
        selection?.modify?.("move", "backward", "character");
        rememberSelection();
      },
      moveRight() {
        const selection = window.getSelection();

        focusEditor();
        selection?.modify?.("move", "forward", "character");
        rememberSelection();
      },
      toggleBold() {
        if (!richText || typeof document.execCommand !== "function") {
          return;
        }

        focusEditor();
        document.execCommand("bold");
        rememberSelection();
        syncRichTextChange(editorRef.current, onChange);
      },
      toggleBulletList() {
        if (!richText || typeof document.execCommand !== "function") {
          return;
        }

        focusEditor();
        document.execCommand("insertUnorderedList");
        rememberSelection();
        syncRichTextChange(editorRef.current, onChange);
      },
      toggleItalic() {
        if (!richText || typeof document.execCommand !== "function") {
          return;
        }

        focusEditor();
        document.execCommand("italic");
        rememberSelection();
        syncRichTextChange(editorRef.current, onChange);
      },
      toggleOrderedList() {
        if (!richText || typeof document.execCommand !== "function") {
          return;
        }

        focusEditor();
        document.execCommand("insertOrderedList");
        rememberSelection();
        syncRichTextChange(editorRef.current, onChange);
      },
    }),
    [onChange, richText, value],
  );

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        richText
          ? "block min-h-[4rem] w-full whitespace-pre-wrap break-words bg-transparent text-foreground outline-none"
          : "inline-block min-w-[3rem] whitespace-pre-wrap break-words bg-transparent text-foreground outline-none",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        rememberSelection();

        if (!richText) {
          return;
        }

        const nextHtml = sanitizeRichTextHtml(event.currentTarget.innerHTML);

        if (event.currentTarget.innerHTML !== nextHtml) {
          event.currentTarget.innerHTML = nextHtml;
          savedSelectionRef.current = null;
        }

        if (nextHtml !== value) {
          onChange(nextHtml);
        }
      }}
      onInput={(event) => {
        if (richText) {
          rememberSelection();
          syncRichTextChange(event.currentTarget, onChange);
          return;
        }

        rememberSelection();
        onChange(event.currentTarget.textContent ?? "");
      }}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
    />
  );
});

InlineTextEditor.displayName = "InlineTextEditor";

export default InlineTextEditor;
