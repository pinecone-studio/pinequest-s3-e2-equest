export type AiRefinedSourcePayload = {
  problems?: Array<{
    prompt?: string;
    sourceExcerpt?: string;
    sourcePages?: number[];
  }>;
  warnings?: string[];
};

type BuildSourceRefinementPromptInput = {
  desiredCount: number;
  selectedSectionTitles: string[];
  sourceProblems: Array<{
    sourcePages: number[];
    text: string;
  }>;
  visiblePages: Array<{
    content: string;
    pageNumber: number;
  }>;
};

function normalizeSpace(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeSpace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildSourceRefinementPrompt({
  desiredCount,
  selectedSectionTitles,
  sourceProblems,
  visiblePages,
}: BuildSourceRefinementPromptInput) {
  const sectionLines = selectedSectionTitles
    .map((title) => `- ${normalizeSpace(title)}`)
    .join("\n");
  const problemLines = sourceProblems
    .slice(0, 32)
    .map(
      (item, index) =>
        `${index + 1}. pages ${item.sourcePages.join(", ") || "unknown"} | ${truncateText(item.text, 220)}`,
    )
    .join("\n");
  const pageLines = visiblePages
    .slice(0, 10)
    .map(
      (item) =>
        `[Page ${item.pageNumber}] ${truncateText(item.content, 500)}`,
    )
    .join("\n\n");

  return `
Чи сурах бичгийн хэсгээс зөвхөн ойлгомжтой, шийдэж болох бодлогын өгүүлбэрүүдийг цэвэрлэж ялгадаг туслах.
Зөвхөн JSON object буцаа. Markdown, code fence, тайлбар бүү нэм.

Сонгосон сэдвүүд:
${sectionLines || "- Сонгосон сэдэв байхгүй"}

Зорилго:
- Хамгийн ихдээ ${Math.max(1, desiredCount)} ширхэг цэвэр, сурагчид ойлгомжтой бодлогын өгүүлбэр ялгаж ав.
- Figure, chart, caption, дадлага ажил, нэрлэ, тодорхойл, дүрс дугаарласан тайлбар, incomplete sentence-үүдийг хас.
- Raw OCR болон эвдэрхий spacing-ийг зас.
- "x2+1x-2=0 x hed ve" маягийн мөр байвал "x^2 + x - 2 = 0 тэгшитгэлийг бод. x-ийн утгыг ол." гэж ойлгомжтой болгож зас.
- Зөвхөн бие даан ойлгогдож, бодож болох бодлогуудыг үлдээ.
- Чанар муу байвал цөөн буцаа. Ойлгомжгүй зүйлийг хүчээр бүү оруул.

Буцаах JSON бүтэц:
{
  "problems": [
    {
      "prompt": "string",
      "sourceExcerpt": "string",
      "sourcePages": [12]
    }
  ],
  "warnings": ["string"]
}

Source problem-ууд:
${problemLines || "Байхгүй"}

Хуудасны эх:
${pageLines || "Байхгүй"}
`.trim();
}
