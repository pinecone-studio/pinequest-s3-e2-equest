import { QuestionFormat } from "../graphql/generated/resolvers-types";

function cleanGeneratedText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestionText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanChoiceText(value: unknown) {
  return cleanGeneratedText(value)
    .replace(/^[A-EА-Е]\s*[\.\):]\s*/u, "")
    .replace(/^(?:сонголт|хариулт)\s*\d*\s*[:.-]\s*/iu, "")
    .replace(/^зөв хариулт\s*[:.-]\s*/iu, "")
    .replace(/^тайлбар\s*[:.-]\s*/iu, "");
}

export function normalizeGeneratedQuestionAnswer(parsed: Record<string, unknown>) {
  const format = String(parsed.format ?? "").toUpperCase().replace(/-/g, "_");
  const questionText = cleanQuestionText(parsed.questionText);
  const explanation = cleanQuestionText(parsed.explanation);
  const correctAnswer = cleanChoiceText(parsed.correctAnswer);
  const rawOptions = Array.isArray(parsed.options) ? parsed.options : [];

  if (format === QuestionFormat.Written) {
    return {
      questionText,
      explanation,
      correctAnswer,
      options: [] as string[],
    };
  }

  const dedupedOptions: string[] = [];
  const seen = new Set<string>();

  for (const option of rawOptions) {
    const cleaned = cleanChoiceText(option);
    const key = cleaned.toLocaleLowerCase();

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedOptions.push(cleaned);
  }

  if (correctAnswer) {
    const correctKey = correctAnswer.toLocaleLowerCase();
    if (!seen.has(correctKey)) {
      dedupedOptions.unshift(correctAnswer);
      seen.add(correctKey);
    }
  }

  while (dedupedOptions.length < 4) {
    dedupedOptions.push(`${String.fromCharCode(1040 + dedupedOptions.length)} хувилбар`);
  }

  return {
    questionText,
    explanation,
    correctAnswer,
    options: dedupedOptions.slice(0, 4),
  };
}
