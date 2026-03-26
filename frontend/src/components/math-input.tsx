"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Eraser,
  Redo2,
  Type,
  Undo2,
} from "lucide-react"

import { cn } from "@/lib/utils"

const JQUERY_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"
const MATHQUILL_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.css"
const MATHQUILL_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.js"
const KATEX_CSS =
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"
const KATEX_JS =
  "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"

type ActiveTab = "basic" | "function" | "trig" | "calculus"

type MathFieldInstance = {
  focus: () => void
  keystroke: (keys: string) => void
  latex: {
    (): string
    (next: string): void
  }
  write: (latex: string) => void
}

type MathQuillInterface = {
  MathField: (
    element: HTMLElement,
    config?: {
      handlers?: {
        edit?: () => void
      }
      leftRightIntoCmdGoes?: "up" | "down"
      spaceBehavesLikeTab?: boolean
    }
  ) => MathFieldInstance
}

declare global {
  interface Window {
    MathQuill?: {
      getInterface: (version: number) => MathQuillInterface
    }
    katex?: {
      renderToString: (
        latex: string,
        options?: {
          displayMode?: boolean
          throwOnError?: boolean
        }
      ) => string
    }
    jQuery?: unknown
    $?: unknown
  }
}

type KeyAction = {
  hint?: string
  key: string
  label: string
  latex?: string
  moveLeftAfterWrite?: number
  span?: string
}

type TabConfig = {
  accent: string
  cols: string
  label: string
  keys: KeyAction[]
}

type MathInputProps = {
  className?: string
  defaultValue?: string
  mode?: "full" | "palette"
  onChange?: (latex: string) => void
  onClear?: () => void
  onInsertLatex?: (latex: string, moveLeftAfterWrite?: number) => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onValueChange?: (latex: string) => void
  placeholder?: string
  value?: string
}

const TAB_ORDER: ActiveTab[] = ["basic", "function", "trig", "calculus"]

const TAB_CONFIG: Record<ActiveTab, TabConfig> = {
  basic: {
    accent: "from-sky-500/15 via-white to-cyan-500/10",
    cols: "grid-cols-5",
    label: "BASIC",
    keys: [
      { key: "basic-open-paren", label: "(", latex: "(" },
      { key: "basic-close-paren", label: ")", latex: ")" },
      { key: "basic-greater-than", label: ">", latex: ">" },
      { key: "basic-fraction", label: "a/b", latex: "\\frac{}{}", hint: "fraction" },
      { key: "basic-sqrt", label: "√", latex: "\\sqrt{}", hint: "sqrt" },
      { key: "basic-7", label: "7", latex: "7" },
      { key: "basic-8", label: "8", latex: "8" },
      { key: "basic-9", label: "9", latex: "9" },
      { key: "basic-divide", label: "÷", latex: "\\div" },
      { key: "basic-percent", label: "%", latex: "\\%" },
      { key: "basic-4", label: "4", latex: "4" },
      { key: "basic-5", label: "5", latex: "5" },
      { key: "basic-6", label: "6", latex: "6" },
      { key: "basic-multiply", label: "×", latex: "\\times" },
      { key: "basic-pi", label: "π", latex: "\\pi" },
      { key: "basic-1", label: "1", latex: "1" },
      { key: "basic-2", label: "2", latex: "2" },
      { key: "basic-3", label: "3", latex: "3" },
      { key: "basic-minus", label: "−", latex: "-" },
      { key: "basic-square", label: "x²", latex: "^{2}" },
      { key: "basic-0", label: "0", latex: "0", span: "col-span-2" },
      { key: "basic-decimal", label: ".", latex: "." },
      { key: "basic-plus", label: "+", latex: "+" },
    ],
  },
  function: {
    accent: "from-amber-500/15 via-white to-orange-500/10",
    cols: "grid-cols-3",
    label: "FUNCTION",
    keys: [
      {
        key: "function-fx",
        label: "f(x)",
        latex: "f\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "function-log10",
        label: "log10",
        latex: "\\log_{10}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "function-log2",
        label: "log2",
        latex: "\\log_{2}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "function-log-base",
        label: "logₐ",
        latex: "\\log_{}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "function-ln",
        label: "ln",
        latex: "\\ln\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "function-exp",
        label: "exp",
        latex: "\\exp\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      { key: "function-e", label: "e", latex: "e" },
      {
        key: "function-parens",
        label: "( )",
        latex: "\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "function-absolute",
        label: "|x|",
        latex: "\\left|\\right|",
        moveLeftAfterWrite: 1,
      },
    ],
  },
  trig: {
    accent: "from-emerald-500/15 via-white to-teal-500/10",
    cols: "grid-cols-4",
    label: "TRIG",
    keys: [
      { key: "trig-sin", label: "sin", latex: "\\sin\\left(\\right)", moveLeftAfterWrite: 1 },
      { key: "trig-cos", label: "cos", latex: "\\cos\\left(\\right)", moveLeftAfterWrite: 1 },
      { key: "trig-tan", label: "tan", latex: "\\tan\\left(\\right)", moveLeftAfterWrite: 1 },
      { key: "trig-cot", label: "cot", latex: "\\cot\\left(\\right)", moveLeftAfterWrite: 1 },
      {
        key: "trig-arcsin",
        label: "arcsin",
        latex: "\\arcsin\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "trig-arccos",
        label: "arccos",
        latex: "\\arccos\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "trig-arctan",
        label: "arctan",
        latex: "\\arctan\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "trig-arccot",
        label: "arccot",
        latex: "\\arccot\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      { key: "trig-sinh", label: "sinh", latex: "\\sinh\\left(\\right)", moveLeftAfterWrite: 1 },
      { key: "trig-cosh", label: "cosh", latex: "\\cosh\\left(\\right)", moveLeftAfterWrite: 1 },
      { key: "trig-tanh", label: "tanh", latex: "\\tanh\\left(\\right)", moveLeftAfterWrite: 1 },
      { key: "trig-coth", label: "coth", latex: "\\coth\\left(\\right)", moveLeftAfterWrite: 1 },
      {
        key: "trig-arsinh",
        label: "arsinh",
        latex: "\\operatorname{arsinh}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "trig-arcosh",
        label: "arcosh",
        latex: "\\operatorname{arcosh}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "trig-artanh",
        label: "artanh",
        latex: "\\operatorname{artanh}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      {
        key: "trig-arcoth",
        label: "arcoth",
        latex: "\\operatorname{arcoth}\\left(\\right)",
        moveLeftAfterWrite: 1,
      },
      { key: "trig-rad", label: "rad", latex: "\\operatorname{rad}" },
      { key: "trig-degree", label: "°", latex: "^{\\circ}" },
    ],
  },
  calculus: {
    accent: "from-violet-500/15 via-white to-fuchsia-500/10",
    cols: "grid-cols-3",
    label: "CALCULUS",
    keys: [
      { key: "calc-limit", label: "lim", latex: "\\lim_{x\\to}" },
      { key: "calc-limit-plus", label: "lim+", latex: "\\lim_{x\\to{}^{+}}" },
      { key: "calc-limit-minus", label: "lim−", latex: "\\lim_{x\\to{}^{-}}" },
      { key: "calc-derivative", label: "d/dx", latex: "\\frac{d}{dx}" },
      { key: "calc-integral", label: "∫", latex: "\\int" },
      { key: "calc-integral-dx", label: "∫ dx", latex: "\\int{}\\,dx" },
      { key: "calc-summation", label: "Σ", latex: "\\sum" },
      { key: "calc-infinity", label: "∞", latex: "\\infty" },
      { key: "calc-sequence", label: "aₙ", latex: "a_n" },
      { key: "calc-y-prime", label: "y'", latex: "y'" },
    ],
  },
}

function ensureStyle(id: string, href: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLLinkElement | null

    if (existing) {
      resolve()
      return
    }

    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`))

    document.head.appendChild(link)
  })
}

function ensureScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve()
        return
      }

      const onLoad = () => {
        existing.dataset.loaded = "true"
        resolve()
      }
      const onError = () => reject(new Error(`Failed to load script: ${src}`))

      existing.addEventListener("load", onLoad, { once: true })
      existing.addEventListener("error", onError, { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = true

    script.onload = () => {
      script.dataset.loaded = "true"
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))

    document.body.appendChild(script)
  })
}

function emitChanges(
  latex: string,
  handlers: {
    onChange?: (latex: string) => void
    onValueChange?: (latex: string) => void
  }
) {
  handlers.onChange?.(latex)
  handlers.onValueChange?.(latex)
}

export function MathInput({
  className,
  defaultValue = "",
  mode = "full",
  onChange,
  onClear,
  onInsertLatex,
  onMoveLeft,
  onMoveRight,
  onValueChange,
  placeholder = "Type math here",
  value,
}: MathInputProps) {
  const isPaletteMode = mode === "palette"
  const initialLatex = value ?? defaultValue
  const isControlled = value !== undefined
  const editorRef = useRef<HTMLDivElement | null>(null)
  const fieldRef = useRef<MathFieldInstance | null>(null)
  const changeHandlersRef = useRef({ onChange, onValueChange })
  const latexRef = useRef(initialLatex)
  const suppressEditRef = useRef(false)
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])

  const [activeTab, setActiveTab] = useState<ActiveTab>("basic")
  const [latex, setLatex] = useState(initialLatex)
  const [previewHtml, setPreviewHtml] = useState("")
  const [librariesReady, setLibrariesReady] = useState({
    katex: false,
    mathquill: false,
  })
  const [libraryError, setLibraryError] = useState<string | null>(null)

  changeHandlersRef.current = { onChange, onValueChange }

  useEffect(() => {
    if (isPaletteMode) {
      return
    }

    let cancelled = false

    async function loadLibraries() {
      try {
        await Promise.all([
          ensureStyle("math-input-mathquill-css", MATHQUILL_CSS),
          ensureStyle("math-input-katex-css", KATEX_CSS),
        ])

        await Promise.all([
          ensureScript("math-input-jquery-js", JQUERY_JS),
          ensureScript("math-input-katex-js", KATEX_JS),
        ])

        await ensureScript("math-input-mathquill-js", MATHQUILL_JS)

        if (cancelled) {
          return
        }

        setLibrariesReady({
          katex: Boolean(window.katex),
          mathquill: Boolean(window.MathQuill),
        })
      } catch (error) {
        if (!cancelled) {
          setLibraryError(
            error instanceof Error
              ? error.message
              : "Unable to load MathQuill and KaTeX."
          )
        }
      }
    }

    void loadLibraries()

    return () => {
      cancelled = true
    }
  }, [isPaletteMode])

  useEffect(() => {
    if (!librariesReady.mathquill || !editorRef.current || fieldRef.current) {
      return
    }

    const mathQuill = window.MathQuill?.getInterface(2)

    if (!mathQuill) {
      setLibraryError("MathQuill did not initialize correctly.")
      return
    }

    const field = mathQuill.MathField(editorRef.current, {
      leftRightIntoCmdGoes: "up",
      spaceBehavesLikeTab: true,
      handlers: {
        edit: () => {
          if (suppressEditRef.current) {
            return
          }

          const nextLatex = field.latex()

          if (nextLatex === latexRef.current) {
            return
          }

          undoStackRef.current.push(latexRef.current)
          redoStackRef.current = []
          latexRef.current = nextLatex
          setLatex(nextLatex)
          emitChanges(nextLatex, changeHandlersRef.current)
        },
      },
    })

    fieldRef.current = field

    if (latexRef.current) {
      suppressEditRef.current = true
      field.latex(latexRef.current)
      queueMicrotask(() => {
        suppressEditRef.current = false
      })
    }

    return () => {
      if (fieldRef.current === field) {
        fieldRef.current = null
      }

      if (editorRef.current) {
        editorRef.current.innerHTML = ""
      }
    }
  }, [librariesReady.mathquill])

  useEffect(() => {
    if (!isControlled) {
      return
    }

    const nextValue = value ?? ""

    if (nextValue === latexRef.current) {
      return
    }

    latexRef.current = nextValue
    setLatex(nextValue)

    if (fieldRef.current) {
      suppressEditRef.current = true
      fieldRef.current.latex(nextValue)
      queueMicrotask(() => {
        suppressEditRef.current = false
      })
    }
  }, [isControlled, value])

  useEffect(() => {
    if (!librariesReady.katex || !window.katex) {
      return
    }

    if (!latex.trim()) {
      setPreviewHtml("")
      return
    }

    try {
      setPreviewHtml(
        window.katex.renderToString(latex, {
          displayMode: true,
          throwOnError: false,
        })
      )
    } catch {
      setPreviewHtml(
        window.katex.renderToString("\\text{Preview unavailable}", {
          displayMode: true,
          throwOnError: false,
        })
      )
    }
  }, [latex, librariesReady.katex])

  function syncLatex(nextLatex: string, options?: { notify?: boolean; pushHistory?: boolean }) {
    const currentLatex = latexRef.current

    if (nextLatex === currentLatex) {
      return
    }

    if (options?.pushHistory) {
      undoStackRef.current.push(currentLatex)
      redoStackRef.current = []
    }

    latexRef.current = nextLatex
    setLatex(nextLatex)

    if (options?.notify ?? true) {
      emitChanges(nextLatex, changeHandlersRef.current)
    }
  }

  function applyProgrammaticChange(
    updater: (field: MathFieldInstance) => void,
    options?: { pushHistory?: boolean }
  ) {
    const field = fieldRef.current

    if (!field) {
      return
    }

    suppressEditRef.current = true
    updater(field)

    const nextLatex = field.latex()

    syncLatex(nextLatex, {
      notify: true,
      pushHistory: options?.pushHistory ?? true,
    })

    field.focus()

    queueMicrotask(() => {
      suppressEditRef.current = false
    })
  }

  function insertLatex(nextLatex: string, moveLeftAfterWrite = 0) {
    writeLatex(nextLatex, moveLeftAfterWrite)
  }

  function writeLatex(nextLatex: string, moveLeftAfterWrite = 0) {
    applyProgrammaticChange((field) => {
      field.write(nextLatex)

      for (let index = 0; index < moveLeftAfterWrite; index += 1) {
        field.keystroke("Left")
      }
    })
  }

  function moveLeft() {
    const field = fieldRef.current

    if (!field) {
      return
    }

    field.keystroke("Left")
    field.focus()
  }

  function moveRight() {
    const field = fieldRef.current

    if (!field) {
      return
    }

    field.keystroke("Right")
    field.focus()
  }

  function clear() {
    applyProgrammaticChange((field) => {
      field.latex("")
    })
  }

  function undo() {
    const previous = undoStackRef.current.pop()

    if (previous === undefined || !fieldRef.current) {
      return
    }

    redoStackRef.current.push(latexRef.current)
    suppressEditRef.current = true
    fieldRef.current.latex(previous)
    fieldRef.current.focus()
    syncLatex(previous, { notify: true, pushHistory: false })

    queueMicrotask(() => {
      suppressEditRef.current = false
    })
  }

  function redo() {
    const next = redoStackRef.current.pop()

    if (next === undefined || !fieldRef.current) {
      return
    }

    undoStackRef.current.push(latexRef.current)
    suppressEditRef.current = true
    fieldRef.current.latex(next)
    fieldRef.current.focus()
    syncLatex(next, { notify: true, pushHistory: false })

    queueMicrotask(() => {
      suppressEditRef.current = false
    })
  }

  const activeConfig = TAB_CONFIG[activeTab]
  const keyboardDisabled = isPaletteMode
    ? false
    : !librariesReady.mathquill || Boolean(libraryError)

  function handleInsertAction(nextLatex: string, moveLeftAfterWrite = 0) {
    if (isPaletteMode) {
      onInsertLatex?.(nextLatex, moveLeftAfterWrite)
      return
    }

    insertLatex(nextLatex, moveLeftAfterWrite)
  }

  function handleMoveLeft() {
    if (isPaletteMode) {
      onMoveLeft?.()
      return
    }

    moveLeft()
  }

  function handleMoveRight() {
    if (isPaletteMode) {
      onMoveRight?.()
      return
    }

    moveRight()
  }

  function handleClear() {
    if (isPaletteMode) {
      onClear?.()
      return
    }

    clear()
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]",
        className
      )}
    >
      <div
        className={cn(
          "border-b border-border/70 bg-gradient-to-br px-4 pb-4 pt-4 sm:px-5",
          activeConfig.accent
        )}
      >
        {isPaletteMode ? (
          <div className="flex items-center justify-between gap-3 rounded-[24px] border border-border/70 bg-background/85 px-4 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground">
              CURRENT INPUT KEYBOARD
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Move cursor left"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground transition hover:bg-background"
                onClick={handleMoveLeft}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Move cursor right"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground transition hover:bg-background"
                onClick={handleMoveRight}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Clear input"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/8 text-destructive transition hover:bg-destructive/12"
                onClick={handleClear}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Eraser className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-2">
              <button
                type="button"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/80 text-sm font-semibold text-foreground transition hover:bg-background"
                onMouseDown={(event) => event.preventDefault()}
              >
                <Type className="size-4" />
                abc
              </button>
              <button
                type="button"
                aria-label="Undo"
                className="flex h-11 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground transition hover:bg-background disabled:opacity-50"
                disabled={undoStackRef.current.length === 0 || keyboardDisabled}
                onClick={undo}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Undo2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Redo"
                className="flex h-11 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground transition hover:bg-background disabled:opacity-50"
                disabled={redoStackRef.current.length === 0 || keyboardDisabled}
                onClick={redo}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Redo2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Move cursor left"
                className="flex h-11 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground transition hover:bg-background disabled:opacity-50"
                disabled={keyboardDisabled}
                onClick={handleMoveLeft}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Move cursor right"
                className="flex h-11 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-foreground transition hover:bg-background disabled:opacity-50"
                disabled={keyboardDisabled}
                onClick={handleMoveRight}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Clear input"
                className="flex h-11 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/8 text-destructive transition hover:bg-destructive/12 disabled:opacity-50"
                disabled={!latex || keyboardDisabled}
                onClick={handleClear}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Eraser className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-[24px] border border-border/70 bg-background/85 p-4 backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground">
                <span>MathQuill Input</span>
                <span className="uppercase">{activeConfig.label}</span>
              </div>

              <div className="rounded-[20px] border border-border/60 bg-white/90 px-4 py-3 shadow-sm">
                <div
                  ref={editorRef}
                  aria-label="Math input"
                  className="math-input-editor min-h-12 w-full text-[1.45rem] text-foreground"
                />
                {!latex && (
                  <p className="pointer-events-none mt-1 text-sm text-muted-foreground">
                    {placeholder}
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-[20px] border border-dashed border-border/80 bg-muted/30 px-4 py-3">
                <div className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground">
                  KaTeX Preview
                </div>

                {previewHtml ? (
                  <div
                    className="math-preview min-h-16 overflow-x-auto text-foreground"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <div className="flex min-h-16 items-center text-sm text-muted-foreground">
                    {librariesReady.katex
                      ? "Rendered preview will appear here."
                      : "Loading KaTeX preview..."}
                  </div>
                )}
              </div>

              {libraryError && (
                <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  {libraryError}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="border-b border-border/70 bg-muted/30 px-3 py-3 sm:px-4">
        <div className="grid grid-cols-4 gap-2">
          {TAB_ORDER.map((tab) => {
            const isActive = tab === activeTab

            return (
              <button
                key={tab}
                type="button"
                className={cn(
                  "rounded-2xl px-3 py-3 text-xs font-semibold tracking-[0.16em] transition",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground"
                )}
                onClick={() => setActiveTab(tab)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {TAB_CONFIG[tab].label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-gradient-to-b from-background to-muted/20 p-3 sm:p-4">
        <div className={cn("grid gap-2 sm:gap-3", activeConfig.cols)}>
          {activeConfig.keys.map((action) => (
            <button
              key={action.key}
              type="button"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-[22px] border border-border/70 bg-background px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50",
                action.span
              )}
              disabled={keyboardDisabled}
              onClick={() => {
                if (!action.latex) {
                  return
                }

                handleInsertAction(action.latex, action.moveLeftAfterWrite ?? 0)
              }}
              onMouseDown={(event) => event.preventDefault()}
            >
              <span className="text-base font-semibold text-foreground">
                {action.label}
              </span>
              {action.hint && (
                <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {action.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .math-input-editor {
          line-height: 1.6;
        }

        .math-input-editor .mq-editable-field {
          width: 100%;
        }

        .math-input-editor .mq-editable-field,
        .math-input-editor .mq-math-mode {
          border: 0;
          box-shadow: none;
          font-family: var(--font-sans);
          background: transparent;
        }

        .math-input-editor .mq-root-block,
        .math-input-editor .mq-editable-field .mq-root-block {
          min-height: 2.75rem;
          padding: 0;
          color: inherit;
        }

        .math-input-editor .mq-cursor {
          border-color: currentColor;
        }

        .math-preview .katex-display {
          margin: 0;
        }
      `}</style>
    </div>
  )
}

export default MathInput
