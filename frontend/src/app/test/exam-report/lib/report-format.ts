const MONGOLIAN_ALPHA_ORDER = [
  "А",
  "Б",
  "В",
  "Г",
  "Д",
  "Е",
  "Ё",
  "Ж",
  "З",
  "И",
  "Й",
  "К",
  "Л",
  "М",
  "Н",
  "О",
  "Ө",
  "П",
  "Р",
  "С",
  "Т",
  "У",
  "Ү",
  "Ф",
  "Х",
  "Ц",
  "Ч",
  "Ш",
  "Щ",
  "Ъ",
  "Ы",
  "Ь",
  "Э",
  "Ю",
  "Я",
];

const MONGOLIAN_ALPHA_ORDER_MAP = new Map(
  MONGOLIAN_ALPHA_ORDER.map((letter, index) => [letter, index] as const),
);

const LATIN_TO_MONGOLIAN_MAP: Record<string, string> = {
  A: "А",
  B: "Б",
  C: "В",
  D: "Г",
  E: "Д",
};

function cleanGroupText(value: string): string {
  return value
    .toUpperCase()
    .replace(/\b(?:АНГИ|БҮЛЭГ|CLASS|GRADE|SECTION)\b/gu, " ")
    .replace(/[-–—./,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGroupValue(group?: string | null): string {
  const cleaned = cleanGroupText(group ?? "");
  const match = cleaned.match(/[A-ZА-ЯӨҮЁ]/u);
  if (!match?.[0]) {
    return cleaned;
  }

  return LATIN_TO_MONGOLIAN_MAP[match[0]] ?? match[0];
}

export function parseClassName(className: string): {
  grade: string | null;
  group: string | null;
} {
  const trimmed = className.trim();
  const gradeMatch = trimmed.match(/\d{1,2}/);
  if (!gradeMatch || gradeMatch.index === undefined) {
    return { grade: null, group: null };
  }

  const grade = gradeMatch[0] ?? null;
  const trailingText = trimmed
    .slice(gradeMatch.index + grade.length)
    .replace(/^\s*[-–—.,/)]*\s*/u, "")
    .trim();
  const group = normalizeGroupValue(trailingText) || null;

  return { grade, group };
}

export function formatGroupLabel(group: string): string {
  return normalizeGroupValue(group);
}

export function formatClassLabel(className: string): string {
  const { grade, group } = parseClassName(className);
  if (!grade) {
    return className;
  }
  if (!group) {
    return grade;
  }
  return `${grade}${formatGroupLabel(group)}`;
}

export function getMongolianLetterOrder(group: string): number {
  const label = formatGroupLabel(group);
  return MONGOLIAN_ALPHA_ORDER_MAP.get(label) ?? Number.MAX_SAFE_INTEGER;
}
