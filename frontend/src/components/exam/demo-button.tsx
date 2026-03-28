"use client";

import { Button } from "@/components/ui/button";

import type { ExamQuestion, GeneratorSettings } from "@/lib/math-exam-model";
import type { Dispatch, SetStateAction } from "react";
import { generateDemoExam } from "@/lib/demo-math-templates";

type DemoButtonProps = {
  onDemo: () => void;
  className?: string;
  disabled?: boolean;
};

export function DemoButton({ onDemo, ...props }: DemoButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={onDemo} {...props}>
      Демо
    </Button>
  );
}

type RunMathExamDemoArgs = {
  setGeneratorError: Dispatch<SetStateAction<string>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setSavedExamId: Dispatch<SetStateAction<string | null>>;
  setIsGeneratorOpen: Dispatch<SetStateAction<boolean>>;
  setSourceFiles: Dispatch<SetStateAction<File[]>>;
  setGeneratorSettings: Dispatch<SetStateAction<GeneratorSettings>>;
  setQuestions: Dispatch<SetStateAction<ExamQuestion[]>>;
  resetSectionState: () => void;
};

export function runMathExamDemo({
  setGeneratorError,
  setSaveError,
  setSavedExamId,
  setIsGeneratorOpen,
  setSourceFiles,
  setGeneratorSettings,
  setQuestions,
  resetSectionState,
}: RunMathExamDemoArgs) {
  setGeneratorError("");
  setSaveError(null);
  setSavedExamId(null);
  setIsGeneratorOpen(false);
  setSourceFiles([]);

  const demo = generateDemoExam();

  setGeneratorSettings((current) => ({
    ...current,
    ...demo.settings,
  }));
  setQuestions(demo.questions as ExamQuestion[]);

  resetSectionState();
}
