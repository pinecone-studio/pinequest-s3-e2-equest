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
import { cn } from "@/lib/utils";

type TextLikeElement = HTMLInputElement | HTMLTextAreaElement;

function wrapMathSegmentRaw(raw: string, nextLatex: string) {
  const trimmed = raw.trim();

  if (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) {
    return `\\[${nextLatex}\\]`;
  }

  if (trimmed.startsWith("\\(") && trimmed.endsWith("\\)")) {
    return `\\(${nextLatex}\\)`;
  }

  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return `$$${nextLatex}$$`;
  }

  if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
    return `$${nextLatex}$`;
  }

  return nextLatex;
}

type MathAssistFieldProps = {
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
  const selectionRef = useRef({
    end: value.length,
    start: value.length,
  });
  const mathSegments = useMemo(
    () =>
      getMathPreviewSegments(value, {
        displayMode: previewDisplayMode,
        forceMath: previewForceMath,
      }),
    [previewDisplayMode, previewForceMath, value],
  );
  const textSegments = useMemo(
    () =>
      getTextPreviewSegments(value, {
        displayMode: previewDisplayMode,
        forceMath: previewForceMath,
      }),
    [previewDisplayMode, previewForceMath, value],
  );
  const usesRenderedMathEditor =
    previewForceMath || mathSegments.length > 0;

  useEffect(() => {
    if (activeMathIndex === null) {
      return;
    }

    const nextActiveSegment = mathSegments[activeMathIndex];

    if (!nextActiveSegment && !(previewForceMath && activeMathIndex === 0)) {
      setActiveMathIndex(null);
      setActiveMathLatex("");
      return;
    }

    setActiveMathLatex(nextActiveSegment?.content ?? value);
  }, [activeMathIndex, mathSegments, previewForceMath, value]);

  useEffect(() => {
    if (activeTextIndex === null) {
      return;
    }

    const nextActiveSegment = textSegments[activeTextIndex];

    if (!nextActiveSegment) {
      setActiveTextIndex(null);
      setActiveTextValue("");
      return;
    }

    setActiveTextValue(nextActiveSegment.content);
  }, [activeTextIndex, textSegments]);

  function syncSelection() {
    const element = inputRef.current;

    if (!element) {
      return;
    }

    selectionRef.current = {
      start: element.selectionStart ?? value.length,
      end: element.selectionEnd ?? value.length,
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
      return nextLatex;
    }

    for (const mathSegment of currentMathSegments) {
      const matchedIndex = currentValue.indexOf(mathSegment.raw, searchFrom);

      if (matchedIndex === -1) {
        return currentValue;
      }

      if (mathSegment.mathIndex === mathIndex) {
        const replacement = wrapMathSegmentRaw(mathSegment.raw, nextLatex);

        return `${currentValue.slice(0, matchedIndex)}${replacement}${currentValue.slice(matchedIndex + mathSegment.raw.length)}`;
      }

      searchFrom = matchedIndex + mathSegment.raw.length;
    }

    return currentValue;
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
    onChange(replaceMathSegmentValue(value, activeMathIndex, nextLatex));
  }

  function handleActiveTextChange(nextText: string) {
    if (activeTextIndex === null) {
      return;
    }

    setActiveTextValue(nextText);
    onChange(replaceTextSegmentValue(value, activeTextIndex, nextText));
  }

  function activateMathSegment(segment: MathPreviewMathSegment) {
    setActiveTextIndex(null);
    setActiveTextValue("");
    setActiveMathIndex(segment.mathIndex);
    setActiveMathLatex(segment.content);

    requestAnimationFrame(() => {
      inlineMathEditorRef.current?.focus();
    });
  }

  function activateTextSegment(segment: MathPreviewTextSegment) {
    setActiveMathIndex(null);
    setActiveMathLatex("");
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
    setActiveMathLatex(value);

    requestAnimationFrame(() => {
      inlineMathEditorRef.current?.focus();
    });
  }

  function insertIntoField(nextChunk: string, moveLeftAfterWrite = 0) {
    if (activeTextIndex !== null) {
      inlineTextEditorRef.current?.insertText(nextChunk);
      return;
    }

    if (usesRenderedMathEditor && activeMathIndex === null) {
      beginRenderedFieldEditing();

      requestAnimationFrame(() => {
        inlineMathEditorRef.current?.insertLatex(nextChunk, moveLeftAfterWrite);
      });
      return;
    }

    if (activeMathIndex !== null) {
      inlineMathEditorRef.current?.insertLatex(nextChunk, moveLeftAfterWrite);
      return;
    }

    const { start, end } = selectionRef.current;
    const nextValue = `${value.slice(0, start)}${nextChunk}${value.slice(end)}`;
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

      const currentPosition = element.selectionStart ?? value.length;
      const nextPosition =
        direction === "left"
          ? Math.max(0, currentPosition - 1)
          : Math.min(value.length, currentPosition + 1);

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

    if (activeMathIndex !== null) {
      inlineMathEditorRef.current?.clear();
      return;
    }

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
    if (usesRenderedMathEditor) {
      beginRenderedFieldEditing();
      return;
    }

    setActiveMathIndex(null);
    setActiveTextIndex(null);
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
    ),
    id,
    onClick: syncSelection,
    onKeyUp: syncSelection,
    onSelect: syncSelection,
    placeholder,
    value,
  };
  const shouldShowRenderedPreview =
    usesRenderedMathEditor ||
    (!isEditing && !isKeyboardOpen && activeMathIndex === null && Boolean(value.trim()));
  const shouldShowLivePreview =
    !usesRenderedMathEditor &&
    (isEditing || isKeyboardOpen || activeMathIndex !== null || activeTextIndex !== null) &&
    Boolean(value.trim()) &&
    (previewForceMath || containsMathPreviewSyntax(value));
  const topFieldClassName = cn(
    multiline
      ? "flex min-h-16 w-full"
      : "flex min-h-8 w-full items-center",
    usesRenderedMathEditor
      ? "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 pr-12"
      : multiline
        ? "rounded-lg border border-input bg-transparent px-2.5 py-2 pr-12 text-left text-base transition-colors outline-none hover:border-ring md:text-sm dark:bg-input/30"
        : "rounded-lg border border-input bg-transparent px-2.5 py-1 pr-12 text-left text-base transition-colors outline-none hover:border-ring md:text-sm dark:bg-input/30",
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
            {usesRenderedMathEditor &&
            activeMathIndex === 0 &&
            mathSegments.length === 0 ? (
              <InlineMathEditor
                ref={inlineMathEditorRef}
                value={activeMathLatex}
                onChange={handleActiveMathChange}
                autoFocus
                variant="embedded"
              />
            ) : value.trim() ? (
              <MathPreviewText
                content={value}
                displayMode={previewDisplayMode}
                forceMath={previewForceMath}
                className="w-full text-foreground"
                activeMathIndex={usesRenderedMathEditor ? activeMathIndex : null}
                activeTextIndex={usesRenderedMathEditor ? activeTextIndex : null}
                onMathSegmentClick={activateMathSegment}
                onTextSegmentClick={activateTextSegment}
                renderActiveMathSegment={() => (
                  <InlineMathEditor
                    ref={inlineMathEditorRef}
                    value={activeMathLatex}
                    onChange={handleActiveMathChange}
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
                  />
                )}
              />
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
        ) : (
          <>
            {multiline ? (
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
                  setActiveMathIndex(null);
                  setActiveTextIndex(null);
                  onChange(event.target.value);
                }}
                onFocus={() => {
                  setActiveMathIndex(null);
                  setActiveTextIndex(null);
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
                  setActiveMathIndex(null);
                  setActiveTextIndex(null);
                  onChange(event.target.value);
                }}
                onFocus={() => {
                  setActiveMathIndex(null);
                  setActiveTextIndex(null);
                  setIsEditing(true);
                }}
              />
            )}
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1"
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
                beginRenderedFieldEditing();
                return;
              }

              inputRef.current?.focus();
              syncSelection();
            });
          }}
        >
          <Keyboard />
        </Button>
        {secondaryAction ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "absolute right-1 top-8",
              secondaryAction.active && "bg-muted",
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

      {shouldShowLivePreview ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <MathPreviewText
            content={value}
            displayMode={previewDisplayMode}
            forceMath={previewForceMath}
            className="w-full text-foreground"
            activeMathIndex={activeMathIndex}
            onMathSegmentClick={activateMathSegment}
            renderActiveMathSegment={() => (
              <InlineMathEditor
                ref={inlineMathEditorRef}
                value={activeMathLatex}
                onChange={handleActiveMathChange}
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
            onMoveLeft={() => moveCursor("left")}
            onMoveRight={() => moveCursor("right")}
            onClear={clearField}
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
