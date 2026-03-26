"use client";

import { Keyboard } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import MathInput from "@/components/math-input";
import MathPreviewText from "@/components/math-preview-text";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type TextLikeElement = HTMLInputElement | HTMLTextAreaElement;

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
  const inputRef = useRef<TextLikeElement | null>(null);
  const selectionRef = useRef({
    end: value.length,
    start: value.length,
  });

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

  function insertIntoField(nextChunk: string, moveLeftAfterWrite = 0) {
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
    !isEditing && !isKeyboardOpen && Boolean(value.trim());
  const shouldShowLivePreview =
    (isEditing || isKeyboardOpen) &&
    Boolean(value.trim()) &&
    (previewForceMath || /[$\\^_{}]/.test(value));

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {shouldShowRenderedPreview ? (
          <button
            type="button"
            className={cn(
              multiline
                ? "flex min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 pr-12 text-left text-base transition-colors outline-none hover:border-ring md:text-sm dark:bg-input/30"
                : "flex min-h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 pr-12 text-left text-base transition-colors outline-none hover:border-ring md:text-sm dark:bg-input/30",
            )}
            onClick={startEditing}
          >
            <MathPreviewText
              content={value}
              displayMode={previewDisplayMode}
              forceMath={previewForceMath}
              className="w-full text-foreground"
            />
          </button>
        ) : (
          <>
            {multiline ? (
              <textarea
                ref={(node) => {
                  inputRef.current = node;
                }}
                {...sharedProps}
                onBlur={() => {
                  if (!isKeyboardOpen) {
                    setIsEditing(false);
                  }
                }}
                onChange={(event) => onChange(event.target.value)}
                onFocus={() => setIsEditing(true)}
              />
            ) : (
              <input
                ref={(node) => {
                  inputRef.current = node;
                }}
                {...sharedProps}
                onBlur={() => {
                  if (!isKeyboardOpen) {
                    setIsEditing(false);
                  }
                }}
                onChange={(event) => onChange(event.target.value)}
                onFocus={() => setIsEditing(true)}
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
