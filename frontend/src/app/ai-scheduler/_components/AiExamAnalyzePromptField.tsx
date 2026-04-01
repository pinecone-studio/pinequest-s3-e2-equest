"use client";

import * as React from "react";

import MathPreviewText from "@/components/math-preview-text";
import { Textarea } from "@/components/ui/textarea";
import { normalizeAiExamPromptPaste } from "@/lib/ai-exam-normalize-prompt-paste";
import { cn } from "@/lib/utils";

export type AiExamAnalyzePromptFieldProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  rows?: number;
  className?: string;
  /** Бичсэн/буулгасан бүх текстийг доор KaTeX-ээр урьдчилан харуулна ($ байх албагүй). */
  showMathPreview?: boolean;
};

/**
 * AI шинжлүүлэх оролтын талбар — `components/exam` дээрх MathAssistField-аас тусдаа,
 * зөвхөн ai-exam урсгалд зориулсан (paste normalize + monospace + сонголттой LaTeX preview).
 */
export function AiExamAnalyzePromptField({
  value,
  onChange,
  disabled,
  rows = 6,
  className,
  showMathPreview = true,
}: AiExamAnalyzePromptFieldProps) {
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const showLivePreview = showMathPreview && value.trim().length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      <Textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const plain = e.clipboardData.getData("text/plain");
          if (plain === "") return;
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          const chunk = normalizeAiExamPromptPaste(plain);
          const prev = valueRef.current;
          onChange(prev.slice(0, start) + chunk + prev.slice(end));
          const caret = start + chunk.length;
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = caret;
          });
        }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        rows={rows}
        placeholder={`Жишээ: $x^2-5x+6=0$ тэгшитгэлийн угийг ол. LaTeX-ийг $...$ эсвэл $$...$$-аар бичнэ.`}
        className="resize-y font-mono text-sm leading-relaxed"
      />
      {showLivePreview ? (
        <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-3">
          <p className="text-muted-foreground text-xs font-medium">
            Урьдчилан харах — буулгах бүрт шууд шинэчлэгдэнэ ($, \\frac, x^2 гэх мэт
            автоматаар томьёо болно)
          </p>
          <MathPreviewText
            content={value}
            contentSource="preview"
            className="text-sm leading-relaxed text-foreground"
          />
        </div>
      ) : null}
    </div>
  );
}
