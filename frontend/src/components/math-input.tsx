"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  CornerDownLeft,
  Eraser,
  Italic,
  List,
  ListOrdered,
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
  onInsertSystemLine?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onToggleBold?: () => void
  onToggleBulletList?: () => void
  onToggleItalic?: () => void
  onToggleOrderedList?: () => void
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

const TAB_PILL_LABELS: Record<ActiveTab, { primary: string; secondary: string }> = {
  basic: {
    primary: "+ −",
    secondary: "× ÷",
  },
  function: {
    primary: "f(x) e",
    secondary: "log ln",
  },
  trig: {
    primary: "sin cos",
    secondary: "tan cot",
  },
  calculus: {
    primary: "lim dx",
    secondary: "∫ Σ ∞",
  },
}

function isNumericKey(action: KeyAction) {
  return /^[0-9.]$/.test(action.label)
}

function isPrimaryOperatorKey(action: KeyAction) {
  return ["+", "−", "×", "÷", ">", "%"].includes(action.label)
}

function isStructureKey(action: KeyAction) {
  return (
    action.hint === "fraction" ||
    action.hint === "sqrt" ||
    ["(", ")", "a/b", "√", "x²"].includes(action.label)
  )
}

function getPaletteActionClassName(action: KeyAction) {
  if (isNumericKey(action)) {
    return "bg-[#f3f3f5] text-slate-900 hover:bg-[#ececef]"
  }

  if (isPrimaryOperatorKey(action)) {
    return "bg-white text-slate-900 hover:bg-[#f8f8fa]"
  }

  if (isStructureKey(action)) {
    return "bg-white text-slate-900 hover:bg-[#f8f8fa]"
  }

  return "bg-white text-slate-800 hover:bg-[#f8f8fa]"
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
  onInsertSystemLine,
  onMoveLeft,
  onMoveRight,
  onToggleBold,
  onToggleBulletList,
  onToggleItalic,
  onToggleOrderedList,
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

    const editorElement = editorRef.current
    const mathQuill = window.MathQuill?.getInterface(2)

    if (!mathQuill) {
      setLibraryError("MathQuill did not initialize correctly.")
      return
    }

    const field = mathQuill.MathField(editorElement, {
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

      editorElement.innerHTML = ""
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
  const textFormattingActions = [
    {
      icon: Bold,
      key: "bold",
      label: "Bold",
      onClick: onToggleBold,
    },
    {
      icon: Italic,
      key: "italic",
      label: "Italic",
      onClick: onToggleItalic,
    },
    {
      icon: List,
      key: "bullet-list",
      label: "Bullet list",
      onClick: onToggleBulletList,
    },
    {
      icon: ListOrdered,
      key: "ordered-list",
      label: "Numbered list",
      onClick: onToggleOrderedList,
    },
  ].filter((action) => typeof action.onClick === "function")

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
        isPaletteMode
          ? "w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_40px_-34px_rgba(15,23,42,0.22)]"
          : "w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_34px_90px_-42px_rgba(15,23,42,0.28)]",
        className
      )}
    >
      <div
        className={cn(
          isPaletteMode
            ? "border-b border-slate-200 bg-white px-3 pb-2 pt-3 sm:px-3"
            : "border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_26%),radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,247,255,0.92))] px-4 pb-4 pt-4 sm:px-5",
          !isPaletteMode && activeConfig.accent
        )}
      >
        {isPaletteMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-6 items-center gap-1 border-b border-slate-200 pb-2 text-slate-900">
              <button
                type="button"
                className="flex h-10 items-center justify-center rounded-xl text-[1.15rem] font-medium transition hover:bg-slate-100"
                onMouseDown={(event) => event.preventDefault()}
              >
                abc
              </button>
              <button
                type="button"
                aria-label="Undo"
                className="flex h-10 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100"
                onClick={undoStackRef.current.length === 0 ? undefined : undo}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Undo2 className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Move cursor left"
                className="flex h-10 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100"
                onClick={handleMoveLeft}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Move cursor right"
                className="flex h-10 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100"
                onClick={handleMoveRight}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowRight className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Insert system line"
                className="flex h-10 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
                disabled={!onInsertSystemLine}
                onClick={onInsertSystemLine}
                onMouseDown={(event) => event.preventDefault()}
              >
                <CornerDownLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Clear input"
                className="flex h-10 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100"
                onClick={handleClear}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Eraser className="size-5" />
              </button>
            </div>

            {textFormattingActions.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {textFormattingActions.map((action) => {
                  const Icon = action.icon

                  return (
                    <button
                      key={action.key}
                      type="button"
                      aria-label={action.label}
                      className="flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                      onClick={action.onClick}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <Icon className="size-4" />
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              <button
                type="button"
                className="flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white text-sm font-semibold text-slate-700 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                onMouseDown={(event) => event.preventDefault()}
              >
                <Type className="size-4" />
                abc
              </button>
              <button
                type="button"
                aria-label="Undo"
                className="flex h-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                disabled={undoStackRef.current.length === 0 || keyboardDisabled}
                onClick={undo}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Undo2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Redo"
                className="flex h-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                disabled={redoStackRef.current.length === 0 || keyboardDisabled}
                onClick={redo}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Redo2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Move cursor left"
                className="flex h-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                disabled={keyboardDisabled}
                onClick={handleMoveLeft}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Move cursor right"
                className="flex h-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                disabled={keyboardDisabled}
                onClick={handleMoveRight}
                onMouseDown={(event) => event.preventDefault()}
              >
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Insert system line"
                className="flex h-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-[0_14px_24px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                disabled={!onInsertSystemLine || keyboardDisabled}
                onClick={onInsertSystemLine}
                onMouseDown={(event) => event.preventDefault()}
              >
                <CornerDownLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Clear input"
                className="flex h-11 items-center justify-center rounded-full border border-rose-200/90 bg-rose-50 text-rose-600 shadow-[0_14px_24px_-18px_rgba(244,63,94,0.32)] transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                disabled={!latex || keyboardDisabled}
                onClick={handleClear}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Eraser className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,255,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_22px_48px_-34px_rgba(15,23,42,0.32)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-semibold tracking-[0.22em] text-slate-500">
                <span>LIVE EXPRESSION</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 uppercase">{activeConfig.label}</span>
              </div>

              <div className="rounded-[30px] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-4 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.35)]">
                <div
                  ref={editorRef}
                  aria-label="Math input"
                  className="math-input-editor min-h-14 w-full text-[1.55rem] text-slate-900"
                />
                {!latex && (
                  <p className="pointer-events-none mt-2 text-sm text-slate-400">
                    {placeholder}
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(241,247,255,0.9),rgba(236,244,252,0.95))] px-4 py-3">
                <div className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-slate-500">
                  CAMERA-READY PREVIEW
                </div>

                {previewHtml ? (
                  <div
                    className="math-preview min-h-16 overflow-x-auto text-slate-900"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <div className="flex min-h-16 items-center text-sm text-slate-500">
                    {librariesReady.katex
                      ? "Rendered preview will appear here."
                      : "Loading KaTeX preview..."}
                  </div>
                )}
              </div>

              {libraryError && (
                <p className="mt-3 rounded-2xl border border-rose-200/90 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {libraryError}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          isPaletteMode
            ? "border-b border-slate-200 bg-white px-3 py-3 sm:px-3"
            : "border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(244,248,255,0.92),rgba(238,244,251,0.96))] px-3 py-3 sm:px-4"
        )}
      >
        <div
          className={cn(
            "grid grid-cols-4 gap-2",
            isPaletteMode
              ? ""
              : "rounded-[24px] bg-white/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
          )}
        >
          {TAB_ORDER.map((tab) => {
            const isActive = tab === activeTab
            const pillLabel = TAB_PILL_LABELS[tab]

            return (
              <button
                key={tab}
                type="button"
                className={cn(
                  isPaletteMode
                    ? "rounded-full border px-2 py-2 text-center transition"
                    : "rounded-[18px] px-3 py-3 text-xs font-semibold tracking-[0.16em] transition",
                  isActive
                    ? isPaletteMode
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "bg-slate-900 text-white shadow-[0_16px_24px_-18px_rgba(15,23,42,0.55)]"
                    : isPaletteMode
                      ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      : "bg-transparent text-slate-500 hover:bg-slate-100/90 hover:text-slate-900"
                )}
                onClick={() => setActiveTab(tab)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {isPaletteMode ? (
                  <span className="flex flex-col leading-tight">
                    <span className="text-[0.72rem] font-semibold">{pillLabel.primary}</span>
                    <span className="text-[0.72rem] font-medium opacity-80">{pillLabel.secondary}</span>
                  </span>
                ) : (
                  TAB_CONFIG[tab].label
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          isPaletteMode
            ? "bg-white px-0 pb-0 pt-0"
            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(241,245,249,0.9))] p-3 sm:p-4"
        )}
      >
        <div
          className={cn(
            "grid",
            activeConfig.cols,
            isPaletteMode ? "gap-px bg-slate-200" : "gap-2 sm:gap-3"
          )}
        >
          {activeConfig.keys.map((action) => (
            <button
              key={action.key}
              type="button"
              className={cn(
                isPaletteMode
                  ? "flex min-h-[4.15rem] cursor-pointer flex-col items-center justify-center px-2 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-50"
                  : "flex min-h-[3.85rem] cursor-pointer flex-col items-center justify-center rounded-[24px] border px-2 py-3 text-center transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
                getPaletteActionClassName(action),
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
              <span className="text-base font-semibold">
                {action.label}
              </span>
              {action.hint && (
                <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-current/60">
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
          min-height: 3rem;
          padding: 0;
          color: inherit;
        }

        .math-input-editor .mq-cursor {
          border-color: #0f172a;
          border-width: 2px;
        }

        .math-preview .katex-display {
          margin: 0;
        }
      `}</style>
    </div>
  )
}

export default MathInput
