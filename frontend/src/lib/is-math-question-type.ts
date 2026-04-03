export function isMathQuestionType(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase();

  return (
    normalized === "math" ||
    normalized === "written" ||
    normalized === "open-ended" ||
    normalized === "open_ended" ||
    normalized === "equation"
  );
}
