"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const JQUERY_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js";
const MATHQUILL_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.css";
const MATHQUILL_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.js";
const KATEX_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
const KATEX_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";

type MathFieldInstance = {
  focus: () => void;
  keystroke: (keys: string) => void;
  latex: {
    (): string;
    (next: string): void;
  };
  write: (latex: string) => void;
};

type MathQuillInterface = {
  MathField: (
    element: HTMLElement,
    config?: {
      handlers?: {
        edit?: () => void;
      };
      leftRightIntoCmdGoes?: "up" | "down";
      spaceBehavesLikeTab?: boolean;
    },
  ) => MathFieldInstance;
};

declare global {
  interface Window {
    MathQuill?: {
      getInterface: (version: number) => MathQuillInterface;
    };
    katex?: {
      renderToString: (
        latex: string,
        options?: {
          displayMode?: boolean;
          throwOnError?: boolean;
        },
      ) => string;
    };
    jQuery?: unknown;
    $?: unknown;
  }
}

export type InlineMathEditorHandle = {
  clear: () => void;
  focus: () => void;
  insertLatex: (latex: string, moveLeftAfterWrite?: number) => void;
  moveLeft: () => void;
  moveRight: () => void;
};

type InlineMathEditorProps = {
  autoFocus?: boolean;
  className?: string;
  onChange: (latex: string) => void;
  onEnterKey?: () => void;
  value: string;
  variant?: "boxed" | "embedded";
};

function ensureStyle(id: string, href: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLLinkElement | null;

    if (existing) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () =>
      reject(new Error(`Failed to load stylesheet: ${href}`));

    document.head.appendChild(link);
  });
}

function ensureScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      const onLoad = () => {
        existing.dataset.loaded = "true";
        resolve();
      };
      const onError = () => reject(new Error(`Failed to load script: ${src}`));

      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.body.appendChild(script);
  });
}

const InlineMathEditor = forwardRef<
  InlineMathEditorHandle,
  InlineMathEditorProps
>(function InlineMathEditor(
  {
    autoFocus = false,
    className,
    onChange,
    onEnterKey,
    value,
    variant = "boxed",
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathFieldInstance | null>(null);
  const latexRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onEnterKeyRef = useRef(onEnterKey);
  const suppressEditRef = useRef(false);
  const previousAutoFocusRef = useRef(false);
  const [librariesReady, setLibrariesReady] = useState(false);
  const [libraryError, setLibraryError] = useState(false);

  function focusEditor() {
    fieldRef.current?.focus();
  }

  function isEditorFocused() {
    const element = editorRef.current;

    if (!element) {
      return false;
    }

    const activeElement = document.activeElement;

    if (!activeElement) {
      return false;
    }

    return element === activeElement || element.contains(activeElement);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onEnterKeyRef.current = onEnterKey;
  }, [onEnterKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadLibraries() {
      try {
        await Promise.all([
          ensureStyle("math-input-mathquill-css", MATHQUILL_CSS),
          ensureStyle("math-input-katex-css", KATEX_CSS),
        ]);

        await Promise.all([
          ensureScript("math-input-jquery-js", JQUERY_JS),
          ensureScript("math-input-katex-js", KATEX_JS),
        ]);

        await ensureScript("math-input-mathquill-js", MATHQUILL_JS);

        if (!cancelled && window.MathQuill) {
          setLibrariesReady(true);
          setLibraryError(false);
        }
      } catch {
        if (!cancelled) {
          setLibraryError(true);
        }
      }
    }

    void loadLibraries();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!librariesReady || !editorRef.current || fieldRef.current) {
      return;
    }

    const editorElement = editorRef.current;
    const mathQuill = window.MathQuill?.getInterface(2);

    if (!mathQuill) {
      setLibraryError(true);
      return;
    }

    const field = mathQuill.MathField(editorElement, {
      leftRightIntoCmdGoes: "up",
      spaceBehavesLikeTab: true,
      handlers: {
        edit: () => {
          if (suppressEditRef.current) {
            return;
          }

          const nextLatex = field.latex();

          if (nextLatex === latexRef.current) {
            return;
          }

          latexRef.current = nextLatex;
          onChangeRef.current(nextLatex);
        },
      },
    });

    fieldRef.current = field;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !onEnterKeyRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onEnterKeyRef.current();
    };

    editorElement.addEventListener("keydown", handleKeyDown, true);
    suppressEditRef.current = true;
    field.latex(latexRef.current);

    queueMicrotask(() => {
      suppressEditRef.current = false;
    });

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown, true);

      if (fieldRef.current === field) {
        fieldRef.current = null;
      }

      editorElement.innerHTML = "";
    };
  }, [librariesReady]);

  useEffect(() => {
    if (!librariesReady) {
      return;
    }

    if (autoFocus && !previousAutoFocusRef.current) {
      queueMicrotask(() => {
        focusEditor();
      });
    }

    previousAutoFocusRef.current = autoFocus;
  }, [autoFocus, librariesReady]);

  useEffect(() => {
    latexRef.current = value;

    if (isEditorFocused()) {
      return;
    }

    if (!fieldRef.current || fieldRef.current.latex() === value) {
      return;
    }

    suppressEditRef.current = true;
    fieldRef.current.latex(value);
    queueMicrotask(() => {
      suppressEditRef.current = false;
    });
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        if (fieldRef.current) {
          suppressEditRef.current = true;
          fieldRef.current.latex("");
          latexRef.current = "";
          onChange("");
          queueMicrotask(() => {
            suppressEditRef.current = false;
            fieldRef.current?.focus();
          });
          return;
        }

        onChange("");
      },
      focus() {
        fieldRef.current?.focus();
      },
      insertLatex(nextLatex: string, moveLeftAfterWrite = 0) {
        if (!fieldRef.current) {
          onChange(`${latexRef.current}${nextLatex}`);
          return;
        }

        suppressEditRef.current = true;
        fieldRef.current.write(nextLatex);

        for (let index = 0; index < moveLeftAfterWrite; index += 1) {
          fieldRef.current.keystroke("Left");
        }

        const nextValue = fieldRef.current.latex();
        latexRef.current = nextValue;
        onChange(nextValue);
        queueMicrotask(() => {
          suppressEditRef.current = false;
          fieldRef.current?.focus();
        });
      },
      moveLeft() {
        fieldRef.current?.keystroke("Left");
        fieldRef.current?.focus();
      },
      moveRight() {
        fieldRef.current?.keystroke("Right");
        fieldRef.current?.focus();
      },
    }),
    [onChange],
  );

  if (libraryError) {
    return (
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !onEnterKey) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          onEnterKey();
        }}
        className={cn(
          variant === "embedded"
            ? "h-8 min-w-[6rem] cursor-text bg-transparent px-0 text-sm text-foreground outline-none"
            : "h-8 min-w-[8rem] cursor-text rounded-md border border-emerald-500/30 bg-background/90 px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      />
    );
  }

  return (
    <>
      <div
        className={cn(
          variant === "embedded"
            ? "inline-flex min-h-8 min-w-[6rem] cursor-text items-center bg-transparent px-0 py-0 align-middle"
            : "inline-flex min-h-8 min-w-[8rem] cursor-text items-center rounded-md border border-emerald-500/30 bg-background/90 px-2 py-1 align-middle shadow-sm",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={editorRef}
          className={cn(
            "inline-math-editor text-[1.05rem] text-foreground",
            variant === "embedded" ? "min-w-[4rem]" : "min-w-[6rem]",
          )}
        />
        {!librariesReady ? (
          <span className="text-sm text-muted-foreground">{value || " "}</span>
        ) : null}
      </div>

      <style jsx global>{`
        .inline-math-editor {
          line-height: 1.5;
        }

        .inline-math-editor .mq-editable-field {
          width: 100%;
        }

        .inline-math-editor .mq-editable-field,
        .inline-math-editor .mq-math-mode {
          border: 0;
          box-shadow: none;
          font-family: var(--font-sans);
          background: transparent;
        }

        .inline-math-editor .mq-root-block,
        .inline-math-editor .mq-editable-field .mq-root-block {
          min-height: 1.5rem;
          padding: 0;
          color: inherit;
        }

        .inline-math-editor .mq-cursor {
          border-color: currentColor;
        }
      `}</style>
    </>
  );
});

InlineMathEditor.displayName = "InlineMathEditor";

export default InlineMathEditor;
