"use client";

import { Keyboard } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import InlineMathEditor, {
  type InlineMathEditorHandle,
} from "@/components/inline-math-editor";
import InlineTextEditor, {
  type InlineTextEditorHandle,
} from "@/components/inline-text-editor";
import MathInput from "@/components/math-input";
import MathPreviewText, {
  containsMathPreviewSyntax,
  getMathPreviewSegments,
  getTextPreviewSegments,
  type MathPreviewMathSegment,
  type MathPreviewTextSegment,
} from "@/components/math-preview-text";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { normalizeStructuredContent } from "@/lib/normalize-structured-content";
import { cn } from "@/lib/utils";

type TextLikeElement = HTMLInputElement | HTMLTextAreaElement;

function wrapMathSegmentRaw(raw: string, nextLatex: string) {
  const trimmed = raw.trim();
  const safeLatex = nextLatex || " ";

  if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) {
    return `\\[${safeLatex}\\]`;
  }

  if (trimmed.startsWith("\\(") && trimmed.endsWith("\\)")) {
    return `\\(${safeLatex}\\)`;
  }

  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return `$$${safeLatex}$$`;
  }

  if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
    return `$${safeLatex}$`;
  }

  return `$${safeLatex}$`;
}

type MathAssistFieldProps = {
  className?: string;
  contentClassName?: string;
  id?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  previewDisplayMode?: boolean;
  previewForceMath?: boolean;
  secondaryAction?: {
    active?: boolean;
    icon: ReactNode;
    onClick: () => void;
  };
  value: string;
};

export function MathAssistField({
  className,
  contentClassName,
  id,
  multiline = false,
  onChange,
  placeholder,
  previewDisplayMode = false,
  previewForceMath = false,
  secondaryAction,
  value,
}: MathAssistFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [activeMathIndex, setActiveMathIndex] = useState<number | null>(null);
  const [activeMathLatex, setActiveMathLatex] = useState("");
  const [activeTextIndex, setActiveTextIndex] = useState<number | null>(null);
  const [activeTextValue, setActiveTextValue] = useState("");
  const inputRef = useRef<TextLikeElement | null>(null);
  const inlineMathEditorRef = useRef<InlineMathEditorHandle | null>(null);
  const inlineTextEditorRef = useRef<InlineTextEditorHandle | null>(null);
  const activeMathRawRef = useRef<string | null>(null);
  const lastMathIndexRef = useRef<number | null>(null);
  const pendingMathActivationRef = useRef<{
    latex: string;
    mathIndex: number;
    raw: string;
  } | null>(null);
  const normalizedValue = useMemo(
    () => normalizeStructuredContent(value),
    [value],
  );
  const selectionRef = useRef({
    end: normalizedValue.length,
    start: normalizedValue.length,
  });
  const mathSegments = useMemo(
    () =>
      getMathPreviewSegments(normalizedValue, {
        displayMode: previewDisplayMode,
        forceMath: previewForceMath,
      }),
    [normalizedValue, previewDisplayMode, previewForceMath],
  );
  const textSegments = useMemo(
    () =>
      getTextPreviewSegments(normalizedValue, {
        displayMode: previewDisplayMode,
        forceMath: previewForceMath,
      }),
    [normalizedValue, previewDisplayMode, previewForceMath],
  );
  const usesRenderedMathEditor = previewForceMath || mathSegments.length > 0;
  const supportsWholeRichTextEditor = multiline && !usesRenderedMathEditor;
  const supportsActiveTextFormatting =
    supportsWholeRichTextEditor || activeTextIndex !== null;
  const editableValue = supportsWholeRichTextEditor ? value : normalizedValue;

  function clearPendingMathActivation() {
    pendingMathActivationRef.current = null;
  }

  function resetActiveMathState(options?: { clearLastIndex?: boolean }) {
    setActiveMathIndex(null);
    setActiveMathLatex("");
    activeMathRawRef.current = null;
    clearPendingMathActivation();

    if (options?.clearLastIndex) {
      lastMathIndexRef.current = null;
    }
  }

  function resetActiveTextState() {
    setActiveTextIndex(null);
    setActiveTextValue("");
  }

  function resetInlineEditorState(options?: { clearLastMathIndex?: boolean }) {
    resetActiveTextState();
    resetActiveMathState({ clearLastIndex: options?.clearLastMathIndex });
  }

  useEffect(() => {
    if (activeMathIndex === null) {
      return;
    }

    const nextActiveSegment = mathSegments[activeMathIndex];

    if (!nextActiveSegment && !(previewForceMath && activeMathIndex === 0)) {
      return;
    }

    activeMathRawRef.current =
      nextActiveSegment?.raw ?? activeMathRawRef.current;
    setActiveMathLatex(nextActiveSegment?.content ?? editableValue);
  }, [activeMathIndex, editableValue, mathSegments, previewForceMath]);

  useEffect(() => {
    const pendingActivation = pendingMathActivationRef.current;

    if (!pendingActivation) {
      return;
    }

    const nextActiveSegment = mathSegments.find(
      (segment) => segment.mathIndex === pendingActivation.mathIndex,
    );

    if (!nextActiveSegment) {
      return;
    }

    pendingMathActivationRef.current = null;
    setActiveMathIndex(pendingActivation.mathIndex);
    setActiveMathLatex(pendingActivation.latex);
    activeMathRawRef.current = pendingActivation.raw;
    lastMathIndexRef.current = pendingActivation.mathIndex;

    requestAnimationFrame(() => {
      inlineMathEditorRef.current?.focus();
    });
  }, [mathSegments]);

  useEffect(() => {
    if (activeTextIndex === null) {
      return;
    }

    const nextActiveSegment = textSegments[activeTextIndex];

    if (!nextActiveSegment) {
      return;
    }

    setActiveTextValue(nextActiveSegment.content);
  }, [activeTextIndex, textSegments]);

  useEffect(() => {
    if (editableValue.length > 0) {
      return;
    }

    setActiveTextIndex(null);
    setActiveTextValue("");
    setActiveMathIndex(null);
    setActiveMathLatex("");
    activeMathRawRef.current = null;
    pendingMathActivationRef.current = null;
    lastMathIndexRef.current = null;
  }, [editableValue]);

  function syncSelection() {
    const element = inputRef.current;

    if (!element) {
      return;
    }

    selectionRef.current = {
      start: element.selectionStart ?? editableValue.length,
      end: element.selectionEnd ?? editableValue.length,
    };
  }

  function replaceMathSegmentValue(
    currentValue: string,
    mathIndex: number,
    nextLatex: string,
  ) {
    const currentMathSegments = getMathPreviewSegments(currentValue, {
      displayMode: previewDisplayMode,
      forceMath: previewForceMath,
    });
    let searchFrom = 0;

    if (currentMathSegments.length === 0 && previewForceMath) {
      activeMathRawRef.current = nextLatex;
      return nextLatex;
    }

    for (const mathSegment of currentMathSegments) {
      const matchedIndex = currentValue.indexOf(mathSegment.raw, searchFrom);

      if (matchedIndex === -1) {
        return currentValue;
      }

      if (mathSegment.mathIndex === mathIndex) {
        const replacement = wrapMathSegmentRaw(mathSegment.raw, nextLatex);
        activeMathRawRef.current = replacement;

        return `${currentValue.slice(0, matchedIndex)}${replacement}${currentValue.slice(matchedIndex + mathSegment.raw.length)}`;
      }

      searchFrom = matchedIndex + mathSegment.raw.length;
    }

    const fallbackRaw = activeMathRawRef.current;

    if (fallbackRaw) {
      const fallbackIndex = currentValue.indexOf(fallbackRaw);

      if (fallbackIndex !== -1) {
        const replacement = wrapMathSegmentRaw(fallbackRaw, nextLatex);
        activeMathRawRef.current = replacement;

        return `${currentValue.slice(0, fallbackIndex)}${replacement}${currentValue.slice(fallbackIndex + fallbackRaw.length)}`;
      }
    }

    return currentValue;
  }

  function insertMathSegmentAfter(
    currentValue: string,
    mathIndex: number,
    insertedRaw: string,
  ) {
    const currentMathSegments = getMathPreviewSegments(currentValue, {
      displayMode: previewDisplayMode,
      forceMath: previewForceMath,
    });
    let searchFrom = 0;

    if (currentMathSegments.length === 0 && previewForceMath) {
      return `${currentValue}\n${insertedRaw}`;
    }

    for (const mathSegment of currentMathSegments) {
      const matchedIndex = currentValue.indexOf(mathSegment.raw, searchFrom);

      if (matchedIndex === -1) {
        return currentValue;
      }

      if (mathSegment.mathIndex === mathIndex) {
        const insertionIndex = matchedIndex + mathSegment.raw.length;

        return `${currentValue.slice(0, insertionIndex)}\n${insertedRaw}${currentValue.slice(insertionIndex)}`;
      }

      searchFrom = matchedIndex + mathSegment.raw.length;
    }

    const fallbackRaw = activeMathRawRef.current;

    if (!fallbackRaw) {
      return currentValue;
    }

    const fallbackIndex = currentValue.indexOf(fallbackRaw);

    if (fallbackIndex === -1) {
      return currentValue;
    }

    const insertionIndex = fallbackIndex + fallbackRaw.length;

    return `${currentValue.slice(0, insertionIndex)}\n${insertedRaw}${currentValue.slice(insertionIndex)}`;
  }

  function replaceTextSegmentValue(
    currentValue: string,
    textIndex: number,
    nextText: string,
  ) {
    const currentTextSegments = getTextPreviewSegments(currentValue, {
      displayMode: previewDisplayMode,
      forceMath: previewForceMath,
    });
    let searchFrom = 0;

    for (const textSegment of currentTextSegments) {
      const matchedIndex = currentValue.indexOf(textSegment.raw, searchFrom);

      if (matchedIndex === -1) {
        return currentValue;
      }

      if (textSegment.textIndex === textIndex) {
        return `${currentValue.slice(0, matchedIndex)}${nextText}${currentValue.slice(matchedIndex + textSegment.raw.length)}`;
      }

      searchFrom = matchedIndex + textSegment.raw.length;
    }

    return currentValue;
  }

  function handleActiveMathChange(nextLatex: string) {
    if (activeMathIndex === null) {
      return;
    }

    setActiveMathLatex(nextLatex);
    onChange(
      replaceMathSegmentValue(editableValue, activeMathIndex, nextLatex),
    );
  }

  function handleActiveMathEnter() {
    const targetMathIndex =
      activeMathIndex ??
      lastMathIndexRef.current ??
      mathSegments[mathSegments.length - 1]?.mathIndex ??
      (previewForceMath ? 0 : null);

    if (targetMathIndex === null) {
      return;
    }

    const targetSegment =
      mathSegments.find((segment) => segment.mathIndex === targetMathIndex) ??
      null;
    const insertedRaw = wrapMathSegmentRaw(
      targetSegment?.raw ?? activeMathRawRef.current ?? "$ $",
      "",
    );
    const nextMathIndex = targetMathIndex + 1;
    const nextValue = insertMathSegmentAfter(
      editableValue,
      targetMathIndex,
      insertedRaw,
    );

    setIsEditing(true);
    setIsKeyboardOpen(true);
    setActiveTextIndex(null);
    setActiveTextValue("");
    pendingMathActivationRef.current = {
      latex: "",
      mathIndex: nextMathIndex,
      raw: insertedRaw,
    };
    onChange(nextValue);
  }

  function handleActiveTextChange(nextText: string) {
    if (activeTextIndex === null) {
      return;
    }

    setActiveTextValue(nextText);
    onChange(replaceTextSegmentValue(editableValue, activeTextIndex, nextText));
  }

  function activateMathSegment(segment: MathPreviewMathSegment) {
    resetActiveTextState();
    clearPendingMathActivation();
    setActiveMathIndex(segment.mathIndex);
    setActiveMathLatex(segment.content);
    activeMathRawRef.current = segment.raw;
    lastMathIndexRef.current = segment.mathIndex;

    requestAnimationFrame(() => {
      inlineMathEditorRef.current?.focus();
    });
  }

  function activateTextSegment(segment: MathPreviewTextSegment) {
    resetActiveMathState();
    setActiveTextIndex(segment.textIndex);
    setActiveTextValue(segment.content);

    requestAnimationFrame(() => {
      inlineTextEditorRef.current?.focus();
    });
  }

  function beginRenderedFieldEditing() {
    const firstTextSegment = textSegments[0];

    if (firstTextSegment) {
      activateTextSegment(firstTextSegment);
      return;
    }

    const firstSegment = mathSegments[0];

    if (firstSegment) {
      activateMathSegment(firstSegment);
      return;
    }

    if (!previewForceMath) {
      return;
    }

    setActiveMathIndex(0);
    setActiveMathLatex(editableValue);

    requestAnimationFrame(() => {
      inlineMathEditorRef.current?.focus();
    });
  }

  function beginMathEditing(preferredMathIndex = lastMathIndexRef.current) {
    const preferredSegment =
      preferredMathIndex === null
        ? null
        : (mathSegments.find(
            (segment) => segment.mathIndex === preferredMathIndex,
          ) ?? null);
    const firstSegment = preferredSegment ?? mathSegments[0];

    if (firstSegment) {
      activateMathSegment(firstSegment);
      return true;
    }

    if (!previewForceMath) {
      return false;
    }

    resetActiveTextState();
    clearPendingMathActivation();
    setActiveMathIndex(0);
    setActiveMathLatex(editableValue);
    activeMathRawRef.current = editableValue;
    lastMathIndexRef.current = 0;

    requestAnimationFrame(() => {
      inlineMathEditorRef.current?.focus();
    });

    return true;
  }

  function insertIntoField(nextChunk: string, moveLeftAfterWrite = 0) {
    if (supportsWholeRichTextEditor) {
      inlineTextEditorRef.current?.insertText(nextChunk);
      return;
    }

    if (usesRenderedMathEditor) {
      if (activeMathIndex !== null) {
        inlineMathEditorRef.current?.insertLatex(nextChunk, moveLeftAfterWrite);
        return;
      }

      if (beginMathEditing()) {
        requestAnimationFrame(() => {
          inlineMathEditorRef.current?.insertLatex(
            nextChunk,
            moveLeftAfterWrite,
          );
        });
        return;
      }
    }

    if (activeTextIndex !== null) {
      inlineTextEditorRef.current?.insertText(nextChunk);
      return;
    }

    if (activeMathIndex !== null) {
      inlineMathEditorRef.current?.insertLatex(nextChunk, moveLeftAfterWrite);
      return;
    }

    const { start, end } = selectionRef.current;
    const nextValue = `${editableValue.slice(0, start)}${nextChunk}${editableValue.slice(end)}`;
    const nextCaretPosition = Math.max(
      start,
      start + nextChunk.length - moveLeftAfterWrite,
    );

    onChange(nextValue);
    setIsEditing(true);

    requestAnimationFrame(() => {
      const element = inputRef.current;

      if (!element) {
        return;
      }

      element.focus();
      element.setSelectionRange(nextCaretPosition, nextCaretPosition);
      selectionRef.current = {
        start: nextCaretPosition,
        end: nextCaretPosition,
      };
    });
  }

  function moveCursor(direction: "left" | "right") {
    if (activeTextIndex !== null) {
      if (direction === "left") {
        inlineTextEditorRef.current?.moveLeft();
        return;
      }

      inlineTextEditorRef.current?.moveRight();
      return;
    }

    if (supportsWholeRichTextEditor) {
      if (direction === "left") {
        inlineTextEditorRef.current?.moveLeft();
        return;
      }

      inlineTextEditorRef.current?.moveRight();
      return;
    }

    if (activeMathIndex !== null) {
      if (direction === "left") {
        inlineMathEditorRef.current?.moveLeft();
        return;
      }

      inlineMathEditorRef.current?.moveRight();
      return;
    }

    requestAnimationFrame(() => {
      const element = inputRef.current;

      if (!element) {
        return;
      }

      const currentPosition = element.selectionStart ?? editableValue.length;
      const nextPosition =
        direction === "left"
          ? Math.max(0, currentPosition - 1)
          : Math.min(editableValue.length, currentPosition + 1);

      element.focus();
      element.setSelectionRange(nextPosition, nextPosition);
      selectionRef.current = {
        start: nextPosition,
        end: nextPosition,
      };
    });
  }

  function clearField() {
    if (activeTextIndex !== null) {
      inlineTextEditorRef.current?.clear();
      return;
    }

    if (supportsWholeRichTextEditor) {
      inlineTextEditorRef.current?.clear();
      return;
    }

    if (activeMathIndex !== null) {
      inlineMathEditorRef.current?.clear();
      return;
    }

    resetInlineEditorState({ clearLastMathIndex: true });
    onChange("");
    setIsEditing(true);

    requestAnimationFrame(() => {
      const element = inputRef.current;

      if (!element) {
        return;
      }

      element.focus();
      element.setSelectionRange(0, 0);
      selectionRef.current = {
        start: 0,
        end: 0,
      };
    });
  }

  function startEditing() {
    if (supportsWholeRichTextEditor) {
      clearPendingMathActivation();
      setIsEditing(true);

      requestAnimationFrame(() => {
        inlineTextEditorRef.current?.focus();
      });
      return;
    }

    if (usesRenderedMathEditor) {
      clearPendingMathActivation();
      beginRenderedFieldEditing();
      return;
    }

    resetInlineEditorState();
    setIsEditing(true);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      syncSelection();
    });
  }

  const sharedProps = {
    className: cn(
      multiline
        ? "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 pr-12 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        : "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-12 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
      className,
    ),
    id,
    onClick: syncSelection,
    onKeyUp: syncSelection,
    onSelect: syncSelection,
    placeholder,
    value: editableValue,
  };
  const hasActiveMathMatch =
    activeMathIndex !== null &&
    mathSegments.some((segment) => segment.mathIndex === activeMathIndex);
  const hasActiveTextMatch =
    activeTextIndex !== null &&
    textSegments.some((segment) => segment.textIndex === activeTextIndex);
  const hasActiveRenderedEditor =
    usesRenderedMathEditor ||
    activeMathIndex !== null ||
    activeTextIndex !== null;
  const shouldShowRenderedPreview =
    hasActiveRenderedEditor ||
    (!isEditing &&
      !isKeyboardOpen &&
      activeMathIndex === null &&
      Boolean(editableValue.trim()));
  const shouldShowLivePreview =
    !usesRenderedMathEditor &&
    (isEditing ||
      isKeyboardOpen ||
      activeMathIndex !== null ||
      activeTextIndex !== null) &&
    Boolean(editableValue.trim()) &&
    (previewForceMath || containsMathPreviewSyntax(editableValue));
  const topFieldClassName = cn(
    multiline ? "flex min-h-16 w-full" : "flex min-h-8 w-full items-center",
    hasActiveRenderedEditor
      ? "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 pr-12"
      : multiline
        ? "rounded-lg border border-input bg-transparent px-2.5 py-2 pr-12 text-left text-base transition-colors outline-none hover:border-ring md:text-sm dark:bg-input/30"
        : "rounded-lg border border-input bg-transparent px-2.5 py-1 pr-12 text-left text-base transition-colors outline-none hover:border-ring md:text-sm dark:bg-input/30",
    className,
  );

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {shouldShowRenderedPreview ? (
          <div
            role="button"
            tabIndex={0}
            className={topFieldClassName}
            onClick={startEditing}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              startEditing();
            }}
          >
            {activeMathIndex !== null && !hasActiveMathMatch ? (
              <InlineMathEditor
                ref={inlineMathEditorRef}
                value={activeMathLatex}
                onChange={handleActiveMathChange}
                onEnterKey={handleActiveMathEnter}
                autoFocus
                variant="embedded"
              />
            ) : activeTextIndex !== null && !hasActiveTextMatch ? (
              <InlineTextEditor
                ref={inlineTextEditorRef}
                value={activeTextValue}
                onChange={handleActiveTextChange}
                autoFocus
                richText
              />
            ) : editableValue.trim() ? (
              <MathPreviewText
                content={editableValue}
                contentSource="preview"
                displayMode={previewDisplayMode}
                forceMath={previewForceMath}
                className={cn("w-full text-foreground", contentClassName)}
                activeMathIndex={activeMathIndex}
                activeTextIndex={activeTextIndex}
                onMathSegmentClick={activateMathSegment}
                onTextSegmentClick={activateTextSegment}
                renderActiveMathSegment={() => (
                  <InlineMathEditor
                    ref={inlineMathEditorRef}
                    value={activeMathLatex}
                    onChange={handleActiveMathChange}
                    onEnterKey={handleActiveMathEnter}
                    autoFocus
                    variant="embedded"
                  />
                )}
                renderActiveTextSegment={() => (
                  <InlineTextEditor
                    ref={inlineTextEditorRef}
                    value={activeTextValue}
                    onChange={handleActiveTextChange}
                    autoFocus
                    richText
                  />
                )}
              />
            ) : (
              <span
                className={cn("pl-1.5 text-muted-foreground", contentClassName)}
              >
                {placeholder}
              </span>
            )}
          </div>
        ) : (
          <>
            {multiline && supportsWholeRichTextEditor ? (
              <div className={cn(sharedProps.className, "relative")}>
                {editableValue ? null : (
                  <span className="pointer-events-none absolute left-6 top-3 text-muted-foreground">
                    {placeholder}
                  </span>
                )}
                <InlineTextEditor
                  ref={inlineTextEditorRef}
                  value={editableValue}
                  onChange={onChange}
                  autoFocus={isEditing}
                  richText
                  className={cn("relative z-10 min-h-[3rem]", contentClassName)}
                />
              </div>
            ) : multiline ? (
              <textarea
                ref={(node) => {
                  inputRef.current = node;
                }}
                {...sharedProps}
                onBlur={() => {
                  if (
                    !isKeyboardOpen &&
                    activeMathIndex === null &&
                    activeTextIndex === null
                  ) {
                    setIsEditing(false);
                  }
                }}
                onChange={(event) => {
                  resetInlineEditorState();
                  onChange(event.target.value);
                }}
                onFocus={() => {
                  resetInlineEditorState();
                  setIsEditing(true);
                }}
              />
            ) : (
              <input
                ref={(node) => {
                  inputRef.current = node;
                }}
                {...sharedProps}
                onBlur={() => {
                  if (
                    !isKeyboardOpen &&
                    activeMathIndex === null &&
                    activeTextIndex === null
                  ) {
                    setIsEditing(false);
                  }
                }}
                onChange={(event) => {
                  resetInlineEditorState();
                  onChange(event.target.value);
                }}
                onFocus={() => {
                  resetInlineEditorState();
                  setIsEditing(true);
                }}
              />
            )}
          </>
        )}
        <div className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "h-9 w-9 cursor-pointer rounded-md bg-transparent p-0 text-slate-500 hover:bg-[#eff5ff] hover:text-[#0b5cab]",
              isKeyboardOpen && "bg-[#eff5ff] text-[#0b5cab]",
            )}
            onClick={() => {
              setIsEditing(true);
              setIsKeyboardOpen((current) => !current);

              requestAnimationFrame(() => {
                if (activeTextIndex !== null) {
                  inlineTextEditorRef.current?.focus();
                  return;
                }

                if (activeMathIndex !== null) {
                  inlineMathEditorRef.current?.focus();
                  return;
                }

                if (usesRenderedMathEditor) {
                  beginMathEditing();
                  return;
                }

                inputRef.current?.focus();
                syncSelection();
              });
            }}
          >
            <Keyboard className="h-[18px] w-[18px]" />
          </Button>
          {secondaryAction ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "h-9 w-9 cursor-pointer rounded-md bg-transparent p-0 text-slate-500 hover:bg-[#eff5ff] hover:text-[#0b5cab]",
                secondaryAction.active && "bg-[#eff5ff] text-[#0b5cab]",
              )}
              onClick={() => {
                setIsEditing(true);
                secondaryAction.onClick();
              }}
            >
              {secondaryAction.icon}
            </Button>
          ) : null}
        </div>
      </div>

      {shouldShowLivePreview ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <MathPreviewText
            content={editableValue}
            contentSource="preview"
            displayMode={previewDisplayMode}
            forceMath={previewForceMath}
            className={cn("w-full text-foreground", contentClassName)}
            activeMathIndex={activeMathIndex}
            onMathSegmentClick={activateMathSegment}
            renderActiveMathSegment={() => (
              <InlineMathEditor
                ref={inlineMathEditorRef}
                value={activeMathLatex}
                onChange={handleActiveMathChange}
                onEnterKey={handleActiveMathEnter}
                autoFocus
                variant="embedded"
              />
            )}
          />
        </div>
      ) : null}

      <Collapsible open={isKeyboardOpen} onOpenChange={setIsKeyboardOpen}>
        <CollapsibleContent className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
          <MathInput
            mode="palette"
            onInsertLatex={insertIntoField}
            onInsertSystemLine={
              activeMathIndex !== null || usesRenderedMathEditor
                ? handleActiveMathEnter
                : undefined
            }
            onMoveLeft={() => moveCursor("left")}
            onMoveRight={() => moveCursor("right")}
            onClear={clearField}
            onToggleBold={
              supportsActiveTextFormatting
                ? () => inlineTextEditorRef.current?.toggleBold()
                : undefined
            }
            onToggleItalic={
              supportsActiveTextFormatting
                ? () => inlineTextEditorRef.current?.toggleItalic()
                : undefined
            }
            onToggleBulletList={
              supportsActiveTextFormatting
                ? () => inlineTextEditorRef.current?.toggleBulletList()
                : undefined
            }
            onToggleOrderedList={
              supportsActiveTextFormatting
                ? () => inlineTextEditorRef.current?.toggleOrderedList()
                : undefined
            }
            className="shadow-none"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsKeyboardOpen(false);

                if (activeTextIndex !== null) {
                  inlineTextEditorRef.current?.focus();
                  return;
                }

                if (supportsWholeRichTextEditor) {
                  inlineTextEditorRef.current?.focus();
                  return;
                }

                if (activeMathIndex !== null) {
                  inlineMathEditorRef.current?.focus();
                  return;
                }

                if (usesRenderedMathEditor) {
                  beginRenderedFieldEditing();
                  return;
                }

                inputRef.current?.focus();
              }}
            >
              Хаах
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
