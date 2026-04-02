"use client";

import MathPreviewText from "@/components/math-preview-text";
import { cn } from "@/lib/utils";
import { normalizeReadableProblemText } from "./readable-problem-patterns";

type TextbookMathTextProps = {
  className?: string;
  content: string;
};

function toInlineLatex(value: string) {
  return String(value || "")
    .trim()
    .replace(/[хХ]/g, "x")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/(\d+(?:[.,]\d+)?)\s*°/g, "$1^\\circ")
    .replace(/°/g, "^\\circ")
    .replace(/√\s*\(\s*([^)]+?)\s*\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9]+(?:[.,]\d+)?)/g, "\\sqrt{$1}")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapTextbookMathSegments(value: string) {
  const normalized = normalizeReadableProblemText(value);
  if (!normalized) {
    return "";
  }

  const patterns = [
    /((?:\d+(?:[.,]\d+)?|[xXyYzZaAbB])(?:\s*[+\-*/=]\s*(?:\d+(?:[.,]\d+)?|[xXyYzZaAbB]|\([^)]+\)))+\s*°?)/g,
    /(\d+(?:[.,]\d+)?\s*[xXyYzZaAbB](?:\s*[+\-*/]\s*\d+(?:[.,]\d+)?)?\s*°?)/g,
    /([xXyYzZaAbB]\s*=\s*[-+]?\d+(?:[.,]\d+)?)/g,
    /(\d+(?:[.,]\d+)?\s*°)/g,
    /(√\s*\(?\s*[A-Za-z0-9]+(?:[.,]\d+)?\s*\)?)/g,
    /(\d+\s*\/\s*\d+)/g,
  ];

  let output = normalized;
  for (const pattern of patterns) {
    output = output.replace(pattern, (full) => {
      const candidate = String(full || "").trim();
      if (!candidate || candidate.includes("$")) {
        return full;
      }
      return `$${toInlineLatex(candidate)}$`;
    });
  }

  return output;
}

export function TextbookMathText({
  className,
  content,
}: TextbookMathTextProps) {
  return (
    <MathPreviewText
      content={wrapTextbookMathSegments(content)}
      contentSource="backend"
      className={cn(
        "whitespace-pre-wrap text-[14px] leading-6 text-slate-800 [&_.katex-display]:overflow-x-auto",
        className,
      )}
    />
  );
}
