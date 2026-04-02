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

export function parseClassName(className: string): {
  grade: string | null;
  group: string | null;
} {
  const trimmed = className.trim();
  const match = trimmed.match(/^(\d{1,2})\s*(.+)?$/);
  if (!match) {
    return { grade: null, group: null };
  }

  const grade = match[1] ?? null;
  const group = (match[2] ?? "").trim() || null;

  return { grade, group };
}

export function formatGroupLabel(group: string): string {
  const normalized = group.trim().toUpperCase();
  const mapped = LATIN_TO_MONGOLIAN_MAP[normalized] ?? normalized;
  return mapped;
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
