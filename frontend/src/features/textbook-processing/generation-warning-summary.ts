function normalizeSpace(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const value = normalizeSpace(item);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }

  return out;
}

export function summarizeGenerationWarnings(warnings: string[]) {
  const items = unique(warnings);
  if (items.length <= 2) {
    return items;
  }

  let hasAiUnavailable = false;
  let hasSourceQualityIssue = false;
  let hasFallbackFill = false;
  let partialSummary = "";
  const extras: string[] = [];

  for (const item of items) {
    const normalized = item.toLowerCase();

    if (
      normalized.includes("ollama ашиглаж чадсангүй") ||
      normalized.includes("gemini ашиглаж чадсангүй") ||
      normalized.includes("ai provider олдсонгүй") ||
      normalized.includes("ai route ажиллахгүй")
    ) {
      hasAiUnavailable = true;
      continue;
    }

    if (
      normalized.includes("pdf текстийн чанараас") ||
      normalized.includes("чанартай source problem") ||
      normalized.includes("чанартай эх хязгаартай") ||
      normalized.includes("ойлгомжтой асуулт гаргах хангалттай source")
    ) {
      hasSourceQualityIssue = true;
      continue;
    }

    if (
      normalized.includes("local fallback-аар нөх") ||
      normalized.includes("mock fallback-аар нөх") ||
      normalized.includes("хоосон зай нөхөх асуулт нэм") ||
      normalized.includes("fallback тестийг ашиглалаа")
    ) {
      hasFallbackFill = true;
      continue;
    }

    const partialMatch = item.match(/Хүссэн\s+(\d+)\s+асуултаас\s+(\d+)-/u);
    if (partialMatch) {
      partialSummary = `Хүссэн ${partialMatch[1]}-аас ${partialMatch[2]} асуултыг л найдвартай бэлдэж чадлаа.`;
      continue;
    }

    extras.push(item);
  }

  const summary: string[] = [];

  if (hasAiUnavailable) {
    summary.push("AI холбогдоогүй тул local fallback ашиглалаа.");
  }

  if (hasSourceQualityIssue) {
    summary.push("PDF текст бүрэн цэвэр биш тул тодорхой бус мөрүүдийг алгаслаа.");
  }

  if (hasFallbackFill) {
    summary.push("Дутуу асуултыг fallback-аар нөхлөө.");
  } else if (partialSummary) {
    summary.push(partialSummary);
  }

  for (const extra of extras) {
    if (summary.length >= 3) {
      break;
    }
    summary.push(extra);
  }

  return summary.length > 0 ? summary : items.slice(0, 3);
}
