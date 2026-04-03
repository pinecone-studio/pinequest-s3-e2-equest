import { loadPdfJs } from "@/lib/pdfjs";

export type TextbookDifficulty = "easy" | "medium" | "hard";

export type ParsedTextbookPage = {
  pageNumber: number;
  text: string;
};

export type ParsedTextbookSectionPage = {
  content: string;
  examples: string[];
  formulas: string[];
  pageNumber: number;
  paragraphs: string[];
};

export type ParsedTextbookSection = {
  chapterTitle: string;
  endPage: number | null;
  id: string;
  pageCount: number;
  pageNumbers: number[];
  pages: ParsedTextbookSectionPage[];
  startPage: number | null;
  subsections: string[];
  title: string;
};

export type ParsedTextbookChapter = {
  id: string;
  sections: ParsedTextbookSection[];
  title: string;
};

export type ParsedTextbook = {
  chapters: ParsedTextbookChapter[];
  createdAt: string;
  fileName: string;
  id: string;
  pageCount: number;
  pages: ParsedTextbookPage[];
  sections: ParsedTextbookSection[];
  title: string;
};

export type GeneratedTextbookQuestion = {
  bookProblem: string;
  choices: string[];
  correctAnswer: string;
  difficulty: TextbookDifficulty;
  explanation: string;
  id: string;
  kind: "mcq";
  points: number;
  question: string;
  sourcePages: number[];
};

export type GeneratedTextbookOpenTask = {
  answer: string;
  difficulty: TextbookDifficulty;
  id: string;
  kind: "written";
  points: number;
  prompt: string;
  score: number;
  sourceExcerpt: string;
  sourcePages: number[];
};

export type GeneratedTextbookTest = {
  difficultyCountsApplied: {
    easy: number;
    hard: number;
    medium: number;
  };
  exerciseProblemCount: number;
  openQuestionCountGenerated: number;
  openQuestions: GeneratedTextbookOpenTask[];
  questionCountGenerated: number;
  questions: GeneratedTextbookQuestion[];
  sourcePages: number[];
  totalScore: number;
  warnings: string[];
};

type PdfTextItem = {
  hasEOL?: boolean;
  str?: string;
  transform?: number[];
};

type RawTextbookSection = {
  id: string;
  pages: ParsedTextbookSectionPage[];
  subsections: string[];
  title: string;
};

type RawTextbookChapter = {
  sections: RawTextbookSection[];
  title: string;
};

type ExerciseProblem = {
  pageNumber: number;
  text: string;
};

export type TextbookSourceProblem = ExerciseProblem;

export type TextbookGenerationSource = {
  selectedExerciseProblems: TextbookSourceProblem[];
  visiblePages: Array<{
    content: string;
    pageNumber: number;
  }>;
};

type DifficultyCountInput = {
  easy?: number;
  hard?: number;
  medium?: number;
};

type GenerateTextbookTestOptions = {
  difficultyCounts?: DifficultyCountInput;
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
  openQuestionCount?: number;
  questionCount?: number;
  totalScore?: number;
};

const SOLVE_QUESTION_TEXT = "Энэ бодлогыг бодоод зөв хариуг сонго.";
type MockTextbookQuestionTemplate = {
  answer: string;
  explanation: string;
  problem: string;
  wrongChoices: string[];
};

type MockTextbookOpenTaskTemplate = {
  answer: string;
  difficulty: TextbookDifficulty;
  prompt: string;
  sourceExcerpt: string;
};

const DEFAULT_MOCK_TEXTBOOK_QUESTION_TEMPLATES: MockTextbookQuestionTemplate[] = [
  {
    answer: "4",
    explanation: "2x + 3 = 11 тул 2x = 8, тэгэхээр x = 4.",
    problem: "2x + 3 = 11",
    wrongChoices: ["3", "5", "6"],
  },
  {
    answer: "7",
    explanation: "3x - 5 = 16 тул 3x = 21, тэгэхээр x = 7.",
    problem: "3x - 5 = 16",
    wrongChoices: ["5", "6", "8"],
  },
  {
    answer: "12",
    explanation: "x/2 + 4 = 10 тул x/2 = 6, тэгэхээр x = 12.",
    problem: "x/2 + 4 = 10",
    wrongChoices: ["8", "10", "14"],
  },
  {
    answer: "12",
    explanation: "√49 = 7, тэгээд 7 + 5 = 12.",
    problem: "√49 + 5",
    wrongChoices: ["10", "11", "14"],
  },
  {
    answer: "5",
    explanation: "5(x - 1) = 20 тул x - 1 = 4, тэгэхээр x = 5.",
    problem: "5(x - 1) = 20",
    wrongChoices: ["4", "6", "8"],
  },
] as const;
const GRADE_9_MOCK_TEXTBOOK_QUESTION_TEMPLATES: MockTextbookQuestionTemplate[] = [
  {
    answer: "5",
    explanation: "Квадрат тэгшитгэлийн язгууруудын нийлбэр нь -b/a = 5.",
    problem: "x² - 5x + 6 = 0 тэгшитгэлийн язгууруудын нийлбэр",
    wrongChoices: ["2", "3", "6"],
  },
  {
    answer: "5",
    explanation: "√(x + 4) = 3 тул x + 4 = 9. Иймээс x = 5.",
    problem: "√(x + 4) = 3",
    wrongChoices: ["3", "4", "9"],
  },
  {
    answer: "6",
    explanation: "|2x - 7| = 5 тул 2x - 7 = 5 эсвэл 2x - 7 = -5. Шийдүүд 6 ба 1, их шийд нь 6.",
    problem: "|2x - 7| = 5 тэгшитгэлийн их шийд",
    wrongChoices: ["1", "5", "7"],
  },
  {
    answer: "2",
    explanation: "y = x² - 4x + 1 функцийн оройн x координат -b/(2a) = 4/2 = 2.",
    problem: "y = x² - 4x + 1 функцийн оройн x координат",
    wrongChoices: ["1", "3", "4"],
  },
  {
    answer: "10",
    explanation: "Пифагорын теоремоор c = √(6² + 8²) = √100 = 10.",
    problem: "Тэгш өнцөгт гурвалжны катетууд 6 ба 8 бол гипотенуз",
    wrongChoices: ["12", "14", "48"],
  },
  {
    answer: "3/5",
    explanation: "Яг нэг улаан, нэг хөх авах аргын тоо 3·2 = 6, нийт аргын тоо C(5,2) = 10 тул магадлал 6/10 = 3/5.",
    problem: "Уутанд 3 улаан, 2 хөх бөмбөг байхад 2-г сонгоход яг нэг нь улаан байх магадлал",
    wrongChoices: ["2/5", "1/2", "4/5"],
  },
] as const;
const SENIOR_MOCK_TEXTBOOK_QUESTION_TEMPLATES: MockTextbookQuestionTemplate[] = [
  {
    answer: "5",
    explanation: "2^(x - 1) = 16 = 2^4 тул x - 1 = 4, тэгэхээр x = 5.",
    problem: "2^(x - 1) = 16",
    wrongChoices: ["3", "4", "6"],
  },
  {
    answer: "27",
    explanation: "√(x + 9) = 6 тул x + 9 = 36, тэгэхээр x = 27.",
    problem: "√(x + 9) = 6",
    wrongChoices: ["18", "21", "36"],
  },
  {
    answer: "2",
    explanation: "log₃81 = 4 учраас 4 - 2 = 2.",
    problem: "log₃81 - 2",
    wrongChoices: ["1", "3", "4"],
  },
  {
    answer: "8",
    explanation: "log₂32 = 5 тул 5 + 3 = 8.",
    problem: "log₂32 + 3",
    wrongChoices: ["5", "6", "7"],
  },
  {
    answer: "2",
    explanation: "sin 30° = 1/2, cos 60° = 1/2, tan 45° = 1 тул нийлбэр нь 2.",
    problem: "sin 30° + cos 60° + tan 45°",
    wrongChoices: ["1", "3", "4"],
  },
] as const;
const GRADE_9_MOCK_OPEN_TASK_TEMPLATES: MockTextbookOpenTaskTemplate[] = [
  {
    answer:
      "D = (-7)^2 - 4·2·3 = 49 - 24 = 25.\nТэгвэл x = (7 ± 5) / 4.\nИймээс x₁ = 3, x₂ = 1/2.",
    difficulty: "hard",
    prompt:
      "2x² - 7x + 3 = 0 тэгшитгэлийг дискриминантын аргаар бодож, шийдүүдийг шалга.",
    sourceExcerpt: "9-р анги · квадрат тэгшитгэл",
  },
  {
    answer:
      "Домайн: x - 1 ≥ 0 тул x ≥ 1.\nКвадратлавал x + 7 = (x - 1)² = x² - 2x + 1.\nИймээс x² - 3x - 6 = 0.\nТэгшитгэлийн шийд: x = (3 ± √33) / 2.\nx ≥ 1 нөхцөлийг хангах шийд нь x = (3 + √33) / 2.",
    difficulty: "hard",
    prompt:
      "√(x + 7) = x - 1 тэгшитгэлийг бод. Домайны нөхцөлийг заавал ашиглаж тайлбарла.",
    sourceExcerpt: "9-р анги · язгууртай тэгшитгэл",
  },
  {
    answer:
      "Хуваарийн муж: x ≠ 2, x ≠ -2.\nТэгшитгэлийг нийт илэрхийллээр үржүүлбэл x(x + 2) + 2(x - 2) = 3(x² - 4).\nЭндээс x² + 4x - 4 = 3x² - 12.\nИймээс 2x² - 4x - 8 = 0, өөрөөр x² - 2x - 4 = 0.\nТэгвэл x = 1 ± √5. Аль аль нь ±2 биш тул хоёр шийд хүчинтэй.",
    difficulty: "hard",
    prompt:
      "x/(x - 2) + 2/(x + 2) = 3 тэгшитгэлийг бод. Хуваарийн мужийг эхлээд тогтоогоод дараа нь шийд.",
    sourceExcerpt: "9-р анги · рационал тэгшитгэл",
  },
  {
    answer:
      "y = x² - 4x + 3 = (x - 2)² - 1.\nИймээс оройн цэг нь (2, -1).\nТэнхлэг нь x = 2.\nТэгшитгэлийн язгуур: x² - 4x + 3 = 0 → (x - 1)(x - 3) = 0.\nТиймээс Ox тэнхлэгийг (1, 0), (3, 0) цэгүүдэд огтолно.",
    difficulty: "hard",
    prompt:
      "y = x² - 4x + 3 функцийн оройн цэг, тэгш хэмийн тэнхлэг, Ox тэнхлэгтэй огтлолцох цэгүүдийг ол.",
    sourceExcerpt: "9-р анги · квадрат функц",
  },
  {
    answer:
      "Гурвалжин 6² + 8² = 36 + 64 = 100 = 10² тул Пифагорын урвуу теоремоор тэгш өнцөгт.\nТалбай S = 1/2 · 6 · 8 = 24.\nГипотенуз дээр буусан өндрийн урт h = 2S / 10 = 48 / 10 = 4.8.",
    difficulty: "hard",
    prompt:
      "Талууд нь 6 см, 8 см, 10 см урттай гурвалжин тэгш өнцөгт болохыг батлаад, гипотенуз дээр буусан өндрийн уртыг ол.",
    sourceExcerpt: "9-р анги · Пифагорын теорем",
  },
  {
    answer:
      "Уутанд нийт 5 бөмбөг байна.\nЯг нэг улаан, нэг хөх авах аргын тоо: C(3,1)·C(2,1) = 3·2 = 6.\nЯмар ч 2 бөмбөг сонгох нийт арга: C(5,2) = 10.\nТэгэхээр магадлал 6/10 = 3/5.",
    difficulty: "medium",
    prompt:
      "Уутанд 3 улаан, 2 хөх бөмбөг байв. Буцаалтгүйгээр 2 бөмбөг сонгоход яг нэг нь улаан байх магадлалыг ол.",
    sourceExcerpt: "9-р анги · магадлал",
  },
  {
    answer:
      "Дундаж: (6 + 7 + 7 + 8 + 10 + 12) / 6 = 50 / 6 = 25/3 ≈ 8.33.\nМедиан: эрэмбэлбэл 6, 7, 7, 8, 10, 12 тул медиан = (7 + 8)/2 = 7.5.\nМоод: 7.\nДалайц: 12 - 6 = 6.",
    difficulty: "medium",
    prompt:
      "6, 7, 7, 8, 10, 12 өгөгдлийн дундаж, медиан, моод, далайцыг олж тайлбарла.",
    sourceExcerpt: "9-р анги · статистик",
  },
  {
    answer:
      "1-р тохиолдол: 2x - 5 ≥ 0, өөрөөр x ≥ 2.5.\nТэгвэл 2x - 5 = x + 1, эндээс x = 6.\n2-р тохиолдол: 2x - 5 < 0, өөрөөр x < 2.5.\nТэгвэл -(2x - 5) = x + 1 → -2x + 5 = x + 1.\nИймээс 3x = 4, x = 4/3.\nХоёр шийд хоёулаа нөхцөлөө хангана.",
    difficulty: "hard",
    prompt:
      "|2x - 5| = x + 1 тэгшитгэлийг модультай тэгшитгэлийн хоёр тохиолдлоор бод.",
    sourceExcerpt: "9-р анги · модультай тэгшитгэл",
  },
] as const;
const SUPERSCRIPT_DIGIT_MAP: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
};

function slugify(value: string) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return ascii || `textbook-${Date.now()}`;
}

function normalizeDisplayText(value: string) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeHumanText(value: string) {
  return normalizeDisplayText(value)
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]{}\-+*/=<>%'"`~@#$^&_\\|°√π∞≤≥≈×÷±∫∑∏]/gu, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanAnalysisPageText(value: string) {
  return sanitizeHumanText(value)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMathExpression(value: string) {
  return String(value || "")
    .replace(/×/g, "\\times ")
    .replace(/[·∙•]/g, "\\cdot ")
    .replace(/÷/g, "\\div ")
    .replace(/:/g, "\\colon ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/π/g, "\\pi ")
    .replace(/∞/g, "\\infty ")
    .trim();
}

function normalizeFractions(value: string) {
  return String(value || "").replace(
    /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g,
    (_match, left: string, right: string) =>
      `\\frac{${left.replace(",", ".")}}{${right.replace(",", ".")}}`,
  );
}

function normalizeSqrt(value: string) {
  return String(value || "")
    .replace(/sqrt\s*\(\s*([^)]+?)\s*\)/gi, "\\sqrt{$1}")
    .replace(/√\s*\(\s*([^)]+?)\s*\)/g, "\\sqrt{$1}")
    .replace(/√\s*([A-Za-z0-9]+(?:[.,]\d+)?)/g, "\\sqrt{$1}");
}

function normalizeFormula(value: string) {
  return normalizeSqrt(normalizeFractions(normalizeMathExpression(value)))
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyMathChunk(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/[\\{}^_]/.test(raw)) return true;
  return /\d/.test(raw) && /[=+\-*/<>|≤≥≠≈×÷]/.test(raw);
}

function extractFormulas(text: string) {
  const source = String(text || "");
  const formulas: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string) => {
    const normalized = normalizeFormula(candidate);
    if (!normalized || normalized.length < 3 || normalized.length > 180) {
      return;
    }
    if (!isLikelyMathChunk(normalized) || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    formulas.push(normalized);
  };

  const taggedRe =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+)\$|\\\(([\s\S]+?)\\\)/g;
  let taggedMatch = taggedRe.exec(source);
  while (taggedMatch && formulas.length < 12) {
    add(taggedMatch[1] || taggedMatch[2] || taggedMatch[3] || taggedMatch[4] || "");
    taggedMatch = taggedRe.exec(source);
  }

  const inlineRe =
    /(\|\s*\d+(?:[.,]\d+)?\s*\||\b(?:sin|cos|tan|log|ln)\s*\([^)]*\)|\d+(?:[.,]\d+)?\s*[+\-*/=]\s*\d+(?:[.,]\d+)?|[A-Za-z]+\^\d+|√\s*\([^)]+\)|√\s*[A-Za-z0-9]+)/gi;
  let inlineMatch = inlineRe.exec(source);
  while (inlineMatch && formulas.length < 12) {
    add(inlineMatch[0]);
    inlineMatch = inlineRe.exec(source);
  }

  return formulas;
}

function extractExamples(text: string) {
  const chunks = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);

  const examples: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const line = String(chunk || "").trim();
    if (!line) {
      continue;
    }
    if (!/(Жишээ|Бодлого|Дасгал|Example|Exercise|Problem)/iu.test(line)) {
      continue;
    }
    if (line.length < 8 || line.length > 260 || seen.has(line)) {
      continue;
    }
    seen.add(line);
    examples.push(line);
    if (examples.length >= 10) {
      break;
    }
  }

  return examples;
}

function splitParagraphs(text: string) {
  return String(text || "")
    .trim()
    .split(/(?<=[.!?])\s{2,}|\n{2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 30);
}

function cleanHeading(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[.·•]+$/g, "")
    .replace(/\s+\d{1,3}$/g, "")
    .trim();
}

function detectChapterTitle(text: string) {
  const matched = String(text || "").match(
    /((?:[IVX]{1,4}\s+)?Б[ҮУ]?ЛЭГ[\s.\-–—]*[IVX0-9A-ZА-ЯЁ]{0,8}(?:[\s,.:;\-–—]+[^\n]{0,80})?)/iu,
  );

  return matched ? cleanHeading(matched[1]) : "";
}

function detectSectionTitles(text: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const sectionRe = /(\d+\.\d+(?:\.\d+)?)\s*[\])\.:\-–—]?\s*([^\n]{2,120})/g;
  let match = sectionRe.exec(String(text || ""));

  while (match && out.length < 8) {
    const full = cleanHeading(`${match[1].trim()} ${cleanHeading(match[2])}`);
    if (full && !seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
    match = sectionRe.exec(String(text || ""));
  }

  return out;
}

function detectSubsectionTitles(text: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const subsectionRe = /(\d+\.\d+\.\d+(?:\.\d+)?)\s*[\])\.:\-–—]?\s*([^\n]{2,120})/g;
  let match = subsectionRe.exec(String(text || ""));

  while (match && out.length < 12) {
    const full = cleanHeading(`${match[1].trim()} ${cleanHeading(match[2])}`);
    if (full && !seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
    match = subsectionRe.exec(String(text || ""));
  }

  return out;
}

function isLikelyTableOfContents(text: string) {
  const source = String(text || "");
  const hasContentsMarker = /(ГАРЧИГ|TABLE OF CONTENTS|CONTENTS)/iu.test(source);
  const sectionCount = (source.match(/\d+\.\d+/g) || []).length;
  const chapterCount = (source.match(/Б[ҮУ]?ЛЭГ/giu) || []).length;
  const dotCount = (source.match(/[.]{3,}/g) || []).length;
  const pageCount = (source.match(/(?:^|\s)\d{1,3}(?=\s|$)/g) || []).length;

  return (
    (hasContentsMarker && (sectionCount >= 2 || dotCount >= 2 || pageCount >= 6)) ||
    (sectionCount >= 5 && dotCount >= 3) ||
    (chapterCount >= 2 && sectionCount >= 3 && pageCount >= 4)
  );
}

function ensureChapter(chapters: RawTextbookChapter[], chapterTitle: string) {
  const title = cleanHeading(chapterTitle) || `БҮЛЭГ ${chapters.length + 1}`;
  const existing = chapters.find((chapter) => chapter.title === title);
  if (existing) {
    return existing;
  }
  const chapter: RawTextbookChapter = {
    title,
    sections: [],
  };
  chapters.push(chapter);
  return chapter;
}

function ensureSection(chapter: RawTextbookChapter, sectionTitle: string) {
  const title = cleanHeading(sectionTitle) || `Section ${chapter.sections.length + 1}`;
  const existing = chapter.sections.find((section) => section.title === title);
  if (existing) {
    return existing;
  }
  const section: RawTextbookSection = {
    id: "",
    title,
    subsections: [],
    pages: [],
  };
  chapter.sections.push(section);
  return section;
}

function addUniqueString(values: string[], nextValue: string) {
  const cleaned = cleanHeading(nextValue);
  if (cleaned && !values.includes(cleaned)) {
    values.push(cleaned);
  }
}

function buildBookStructure(pages: ParsedTextbookPage[]) {
  const chapters: RawTextbookChapter[] = [];
  let currentChapter: RawTextbookChapter | null = null;
  let currentSection: RawTextbookSection | null = null;

  for (const page of pages) {
    const text = cleanAnalysisPageText(page.text);
    if (!text || isLikelyTableOfContents(text)) {
      continue;
    }

    const chapterTitle = detectChapterTitle(text);
    const sectionTitles = detectSectionTitles(text);
    const subsectionTitles = detectSubsectionTitles(text);

    if (chapterTitle) {
      currentChapter = ensureChapter(chapters, chapterTitle);
      currentSection = null;
    }

    if (!currentChapter) {
      currentChapter = ensureChapter(chapters, "БҮЛЭГ I");
    }

    if (sectionTitles.length > 0) {
      currentSection = ensureSection(currentChapter, sectionTitles[0]);
      for (const subsectionTitle of subsectionTitles) {
        addUniqueString(currentSection.subsections, subsectionTitle);
      }
    }

    if (!currentSection) {
      currentSection = ensureSection(currentChapter, sectionTitles[0] || `Section ${page.pageNumber}`);
    }

    const paragraphs = splitParagraphs(text);
    currentSection.pages.push({
      pageNumber: page.pageNumber,
      content: paragraphs.length ? paragraphs.join("\n\n") : text,
      paragraphs,
      formulas: extractFormulas(text),
      examples: extractExamples(text),
    });
  }

  let sectionCounter = 1;
  return chapters.map((chapter, chapterIndex) => ({
    id: `chapter-${chapterIndex + 1}`,
    title: chapter.title,
    sections: chapter.sections.map((section) => ({
      ...section,
      id: `sec-${sectionCounter++}`,
    })),
  }));
}

function flattenSections(chapters: RawTextbookChapter[]) {
  const out: ParsedTextbookSection[] = [];

  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      const pageNumbers = Array.from(
        new Set(
          section.pages
            .map((page) => Math.trunc(Number(page.pageNumber)))
            .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber >= 1),
        ),
      ).sort((left, right) => left - right);

      out.push({
        ...section,
        chapterTitle: chapter.title,
        pageNumbers,
        startPage: pageNumbers[0] ?? null,
        endPage: pageNumbers[pageNumbers.length - 1] ?? null,
        pageCount: pageNumbers.length,
      });
    }
  }

  return out;
}

export function findSectionById(
  chapters: ParsedTextbookChapter[],
  sectionId: string,
) {
  const wanted = String(sectionId || "").trim();
  if (!wanted) {
    return null;
  }

  for (const chapter of chapters) {
    for (const section of chapter.sections) {
      if (section.id === wanted) {
        return {
          chapterTitle: chapter.title,
          section,
        };
      }
    }
  }

  return null;
}

function toSuperscriptDigit(char: string) {
  return SUPERSCRIPT_DIGIT_MAP[char] || "";
}

function normalizeDifficulty(value: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "easy" || raw === "medium" || raw === "hard") {
    return raw;
  }
  return "medium";
}

function parseNonNegativeInt(rawValue: unknown, fallback = 0, max = 200) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.max(0, Math.min(max, Math.trunc(numericValue)));
}

function normalizeDifficultyCounts(rawValue: DifficultyCountInput | undefined) {
  const source = rawValue ?? {};
  const easy = parseNonNegativeInt(source.easy, 0, 80);
  const medium = parseNonNegativeInt(source.medium, 0, 80);
  const hard = parseNonNegativeInt(source.hard, 0, 80);
  return {
    easy,
    medium,
    hard,
    total: easy + medium + hard,
  };
}

function fitDifficultyCountsToTotal(
  rawCounts: DifficultyCountInput | undefined,
  total: number,
  fallbackDifficulty: TextbookDifficulty,
) {
  const target = parseNonNegativeInt(total, 0, 80);
  if (target <= 0) {
    return { easy: 0, medium: 0, hard: 0, total: 0 };
  }

  const base = normalizeDifficultyCounts(rawCounts);
  if (base.total <= 0) {
    return {
      easy: fallbackDifficulty === "easy" ? target : 0,
      medium: fallbackDifficulty === "medium" ? target : 0,
      hard: fallbackDifficulty === "hard" ? target : 0,
      total: target,
    };
  }

  const levels: TextbookDifficulty[] = ["easy", "medium", "hard"];
  const scaled = { easy: 0, medium: 0, hard: 0 };
  const fractions = { easy: 0, medium: 0, hard: 0 };
  let used = 0;

  for (const level of levels) {
    const exact = (base[level] / base.total) * target;
    const floored = Math.floor(exact);
    scaled[level] = floored;
    fractions[level] = exact - floored;
    used += floored;
  }

  let remainder = Math.max(0, target - used);
  while (remainder > 0) {
    let pick: TextbookDifficulty = "medium";
    let bestFraction = -1;
    let bestWeight = -1;

    for (const level of levels) {
      const fraction = fractions[level];
      const weight = base[level];
      const beatsCurrent =
        fraction > bestFraction ||
        (fraction === bestFraction && weight > bestWeight) ||
        (fraction === bestFraction &&
          weight === bestWeight &&
          level === fallbackDifficulty);
      if (beatsCurrent) {
        pick = level;
        bestFraction = fraction;
        bestWeight = weight;
      }
    }

    scaled[pick] += 1;
    fractions[pick] = 0;
    remainder -= 1;
  }

  return {
    ...scaled,
    total: target,
  };
}

function buildDifficultyPlan(
  counts: { easy: number; hard: number; medium: number },
  fallbackDifficulty: TextbookDifficulty,
  needed: number,
) {
  const target = Math.max(0, Math.trunc(Number(needed) || 0));
  const items: TextbookDifficulty[] = [];

  const pushMany = (level: TextbookDifficulty, amount: number) => {
    for (let index = 0; index < amount && items.length < target; index += 1) {
      items.push(level);
    }
  };

  pushMany("easy", counts.easy);
  pushMany("medium", counts.medium);
  pushMany("hard", counts.hard);

  while (items.length < target) {
    items.push(fallbackDifficulty);
  }

  return items.slice(0, target);
}

function assignDifficultyToQuestions(
  questions: GeneratedTextbookQuestion[],
  counts: { easy: number; hard: number; medium: number },
  fallbackDifficulty: TextbookDifficulty,
) {
  const plan = buildDifficultyPlan(counts, fallbackDifficulty, questions.length);

  return questions.map((question, index) => ({
    ...question,
    difficulty: plan[index] || fallbackDifficulty,
  }));
}

function normalizeExerciseLine(value: string) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExerciseProblemText(value: string) {
  const text = normalizeExerciseLine(value)
    .replace(/\beos\b/giu, "cos")
    .replace(/\bv(?=\d)/giu, "√");
  if (!text) {
    return "";
  }

  const cutMarkers = [
    /\bЖишээ\b/iu,
    /\bБодолт\b/iu,
    /\bДүгнэлт\b/iu,
    /\bТодорхойлолт\b/iu,
    /\bЗураг\b/iu,
    /\bИймд\b/iu,
  ];

  let cutAt = text.length;
  for (const marker of cutMarkers) {
    const matched = marker.exec(text);
    if (matched && Number.isFinite(matched.index)) {
      cutAt = Math.min(cutAt, matched.index);
    }
  }

  return normalizeExerciseLine(text.slice(0, cutAt))
    .replace(/[;,:\-–—]+$/g, "")
    .trim();
}

function splitCompoundExerciseLine(value: string) {
  const text = normalizeExerciseLine(value);
  if (!text) {
    return [];
  }

  const markerMatches = Array.from(
    text.matchAll(/(?:^|\s)(?:\d{1,3}[).]|[\p{L}]\))/gu),
  );
  if (markerMatches.length <= 1) {
    return [text];
  }

  const chunks: string[] = [];
  for (let index = 0; index < markerMatches.length; index += 1) {
    const current = markerMatches[index];
    const next = markerMatches[index + 1];
    const startsWithSpace = /^\s/.test(current[0] || "");
    const start = (current.index || 0) + (startsWithSpace ? 1 : 0);
    const end = next ? (next.index || text.length) : text.length;
    if (end <= start) {
      continue;
    }
    const chunk = normalizeExerciseLine(text.slice(start, end));
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks.length ? chunks : [text];
}

function hasEquationLikePattern(value: string) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  return (
    /\|[^|]{1,40}\|/.test(text) ||
    (/[=+\-*/<>≤≥≈×÷]/.test(text) && /\d/.test(text)) ||
    /\b(?:sin|cos|tan|log|ln)\b/i.test(text)
  );
}

function looksMathLikeText(value: string) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  return (
    (/\d/.test(text) && /[=+\-*/<>≤≥≈×÷]/.test(text)) ||
    /\b(sin|cos|tan|log|ln|sqrt)\b/i.test(text) ||
    /(модул|тэгшитгэл|тэнцэтгэл|функц|интеграл|уламжлал|логарифм)/iu.test(text)
  );
}

function hasTaskMarker(value: string) {
  return /(дасгал|жишээ|бодлого|тэгшитгэл\s*бод|тэнцэтгэл\s*биш\s*бод|шийдийг\s*ол|утгыг\s*ол|тэгшитгэл\s*шийд)/iu.test(
    String(value || ""),
  );
}

function looksExerciseProblemCandidate(
  line: string,
  options: { inExerciseBlock?: boolean } = {},
) {
  const text = cleanExerciseProblemText(line);
  if (!text || text.length < 4 || text.length > 260) {
    return false;
  }
  if (/^([IVX]+|[A-ZА-Я])\s*БҮЛЭГ/iu.test(text)) {
    return false;
  }
  if (/\.{4,}/.test(text) || /([а-яөүa-z])\1{6,}/iu.test(text)) {
    return false;
  }
  if (/^\d+\.\d+(?:\.\d+)?\s*[А-Яа-яЁёӨөҮүҢңӘә]/u.test(text)) {
    return false;
  }
  if (
    /(жишээ|бодолт|дүгнэлт|тодорхойлолт|зураг|бүлгийн\s+нэмэлт)/iu.test(text) &&
    !/^[\p{L}]\)/u.test(text)
  ) {
    return false;
  }

  const hasLabel = /^[\p{L}]\)\s*/u.test(text) || /^\d{1,3}[).]\s*/u.test(text);
  const hasMath = hasEquationLikePattern(text) || looksMathLikeText(text);
  const hasTaskWord = hasTaskMarker(text) || /(бод|утгыг\s*ол|шийд)/iu.test(text);
  const hasStrongMathSignal =
    hasEquationLikePattern(text) || /[|√=+\-*/<>≤≥≈×÷]/.test(text);
  const hasManyWords = (text.match(/[\p{L}]{2,}/gu) || []).length >= 8;
  const hasNarrativeSignal =
    /(хэрэв|иймд|эндээс|нөхцөл|шийд\s+болно|тэнцүү\s+чанартай|болох\s+ба)/iu.test(text);

  if (hasNarrativeSignal && text.length > 42) {
    return false;
  }
  if (/^\d{1,3}[).]\s*/u.test(text) && hasManyWords && !/^[\p{L}]\)\s*/u.test(text)) {
    return false;
  }

  if (!hasMath) {
    return false;
  }
  if (hasLabel && hasStrongMathSignal) {
    return true;
  }
  if (options.inExerciseBlock && hasStrongMathSignal) {
    return true;
  }
  return hasTaskWord && hasStrongMathSignal;
}

function stripExerciseLabel(text: string) {
  return String(text || "")
    .replace(/^\s*(?:\d{1,3}|[A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\s*[\).:\-–]\s*/u, "")
    .trim();
}

function normalizeProblemKey(value: string) {
  return stripExerciseLabel(normalizeExerciseLine(value))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildReadableChoiceQuestionPrompt(problemText: string) {
  const problem = stripExerciseLabel(normalizeExerciseLine(problemText))
    .replace(/\s*\[mock-\d+\]\s*$/i, "")
    .trim();

  if (!problem) {
    return "Зөв хариултыг сонгоно уу.";
  }

  if (/[xXхХ]/.test(problem) && problem.includes("=")) {
    return `Дараах тэгшитгэлийн шийдийг ол.\n${problem}`;
  }

  if (/[0-9]/.test(problem) && /[+\-*/√|]/.test(problem)) {
    return `Дараах илэрхийллийг бодоод зөв хариуг сонго.\n${problem}`;
  }

  return `Дараах бодлогын зөв хариуг сонго.\n${problem}`;
}

function isSeniorGrade(grade?: number) {
  return Number.isFinite(Number(grade)) && Number(grade) >= 10;
}

function shouldUseSeniorMocks(options: {
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
}) {
  if (isSeniorGrade(options.grade)) {
    return true;
  }

  return !Number.isFinite(Number(options.grade)) && options.fallbackDifficulty === "hard";
}

function shouldUseGradeNineMcqMocks(options: {
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
}) {
  return Number(options.grade) === 9;
}

function shouldUseGradeNineOpenTaskMocks(options: {
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
}) {
  if (Number(options.grade) === 9) {
    return true;
  }

  return !Number.isFinite(Number(options.grade)) && options.fallbackDifficulty === "hard";
}

function hasAdvancedMockSignal(problemText: string) {
  const body = stripExerciseLabel(problemText);
  return (
    /\b(sin|cos|tan|log|ln)\b/i.test(body) ||
    /[²³⁴⁵⁶⁷⁸⁹]/.test(body) ||
    /\^/.test(body) ||
    /√/.test(body) ||
    /[<>≤≥]/.test(body) ||
    /\/.*/.test(body) ||
    /[xXхХ].*[xXхХ]/.test(body)
  );
}

function selectMockTemplatePool(options: {
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
}) {
  if (shouldUseGradeNineMcqMocks(options)) {
    return GRADE_9_MOCK_TEXTBOOK_QUESTION_TEMPLATES;
  }

  if (shouldUseSeniorMocks(options)) {
    return SENIOR_MOCK_TEXTBOOK_QUESTION_TEMPLATES;
  }

  return DEFAULT_MOCK_TEXTBOOK_QUESTION_TEMPLATES;
}

function shouldPreferAdvancedMockTopUp(options: {
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
}) {
  return shouldUseGradeNineMcqMocks(options) || shouldUseSeniorMocks(options);
}

function selectMockOpenTaskTemplatePool(options: {
  fallbackDifficulty?: TextbookDifficulty;
  grade?: number;
}) {
  if (shouldUseGradeNineOpenTaskMocks(options)) {
    return GRADE_9_MOCK_OPEN_TASK_TEMPLATES;
  }

  return [];
}

function isLetterLabeledExerciseProblem(value: string) {
  return /^[\p{L}]\)\s*/u.test(normalizeExerciseLine(value));
}

function isStrictExerciseProblem(value: string) {
  const text = normalizeExerciseLine(value);
  if (!isLetterLabeledExerciseProblem(text) || text.length < 4 || text.length > 95) {
    return false;
  }
  if (
    /(хэрэв|иймд|эндээс|нөхцөл|болно|бодолт|жишээ|дүгнэлт|зураг|тодорхойлолт|хэлбэрийн|тэгшитгэлийн|олонлог)/iu.test(
      text,
    )
  ) {
    return false;
  }

  const tokenCount = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  return (
    (/[|=<>≤≥√+\-*/^]/.test(text) ||
      /\b(sin|cos|tan|log|ln)\b/i.test(text) ||
      /\d/.test(text)) &&
    tokenCount <= 16
  );
}

function isCleanExerciseProblem(value: string) {
  const text = normalizeExerciseLine(value);
  const body = stripExerciseLabel(text);
  if (!body || body.length < 2 || body.length > 72) {
    return false;
  }
  if (/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\1{4,}/u.test(body) || /^[<>≤≥]/.test(body)) {
    return false;
  }
  if (/[\p{L}]\)\s*/u.test(body)) {
    return false;
  }

  const symbolCount = (body.match(/[|=<>≤≥√+\-*/^()°]/g) || []).length;
  const digitCount = (body.match(/\d/g) || []).length;
  const cyrCount = (body.match(/[А-Яа-яЁёӨөҮүҢңӘә]/gu) || []).length;
  const latinWords = body.match(/[A-Za-z]+/g) || [];
  const allowedLatin = new Set([
    "x",
    "y",
    "z",
    "sin",
    "cos",
    "tan",
    "log",
    "ln",
    "sqrt",
    "pi",
    "e",
  ]);

  if (symbolCount === 0) {
    return false;
  }
  if (cyrCount >= 6 && symbolCount < 2 && digitCount < 2) {
    return false;
  }
  if (/[А-Яа-яЁёӨөҮүҢңӘә]{2,}/u.test(body)) {
    return false;
  }
  return !latinWords.some((word) => !allowedLatin.has(word.toLowerCase()));
}

function scoreExerciseProblemQuality(value: string) {
  const text = normalizeExerciseLine(value);
  if (!text) {
    return -999;
  }
  const body = stripExerciseLabel(text);
  let score = 0;
  if (isCleanExerciseProblem(text)) score += 10;
  if (isStrictExerciseProblem(text)) score += 12;
  if (isLetterLabeledExerciseProblem(text)) score += 8;
  if (/[|√=+\-*/<>≤≥≈×÷]/.test(text)) score += 6;
  if (/\b(sin|cos|tan|log|ln)\b/i.test(text)) score += 4;
  if (/[xXхХ]/.test(body)) score += 8;
  if ((body.match(/=/g) || []).length === 1) score += 4;
  if ((body.match(/[+\-*/]/g) || []).length >= 3) score += 4;
  if (/\|/.test(body)) score += 4;
  if (/√/.test(body)) score += 4;
  if (/[xXхХ]\s*(?:\^|\*\*)\s*[2-9]/.test(body) || /[²³⁴⁵⁶⁷⁸⁹]/.test(body)) {
    score += 6;
  }
  if (/\/.*/.test(body)) score += 2;
  if (/[<>≤≥]/.test(body)) score += 2;
  if (body.length >= 18) score += 2;
  if (/(жишээ|бодолт|дүгнэлт|тодорхойлолт|зураг)/iu.test(text)) score -= 8;
  if (/(хэрэв|иймд|эндээс|шийд\s+болно|нөхцөл)/iu.test(text)) score -= 6;
  if (text.length > 120) score -= 5;
  if (text.length > 70 && text.length <= 120) score -= 1;
  return score;
}

function extractExerciseProblemsFromPages(
  pages: Array<{ content?: string; pageNumber: number; text?: string }>,
  limit = 200,
) {
  const out: ExerciseProblem[] = [];
  const seen = new Set<string>();
  let inExerciseBlock = false;

  for (const page of pages) {
    const prepared = String(page.content || page.text || "")
      .replace(/\r/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\)/gu, "\n$1)")
      .replace(/(^|[\s,;:])(\d{1,3}[).])/gu, "$1\n$2")
      .replace(/\n{2,}/g, "\n");

    const lines = prepared
      .split(/\n+/g)
      .map((line) => normalizeExerciseLine(line))
      .filter(Boolean);

    for (const line of lines) {
      if (/(дасгал|даалгавар|бүлгийн\s+нэмэлт\s+даалгавар|exercise)/iu.test(line)) {
        inExerciseBlock = true;
        continue;
      }

      for (const chunk of splitCompoundExerciseLine(line)) {
        const cleanedChunk = cleanExerciseProblemText(chunk);
        if (!looksExerciseProblemCandidate(cleanedChunk, { inExerciseBlock })) {
          continue;
        }

        const key = cleanedChunk.toLowerCase().replace(/\s+/g, " ").trim();
        if (!key || seen.has(key)) {
          continue;
        }

        seen.add(key);
        out.push({
          pageNumber: page.pageNumber,
          text: cleanedChunk,
        });

        if (out.length >= limit) {
          return out;
        }
      }
    }
  }

  return out;
}

function collectLooseMathProblemsFromPages(
  pages: Array<{ content?: string; pageNumber: number; text?: string }>,
  limit = 80,
) {
  const out: ExerciseProblem[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const prepared = String(page.content || page.text || "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/([A-Za-zА-Яа-яЁёӨөҮүҢңӘә])\)/gu, "\n$1)")
      .replace(/(^|[\s,;:])(\d{1,3}[).])/gu, "$1\n$2")
      .replace(/\n{2,}/g, "\n");

    const lines = prepared
      .split(/\n+/g)
      .map((line) => cleanExerciseProblemText(line))
      .filter(Boolean);

    for (const line of lines) {
      if (line.length < 3 || line.length > 100) {
        continue;
      }
      if (!/[0-9|=<>≤≥√+\-*/^]/.test(line)) {
        continue;
      }
      if (/(жишээ|бодолт|дүгнэлт|тодорхойлолт|зураг)/iu.test(line)) {
        continue;
      }

      const key = line.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      out.push({
        pageNumber: page.pageNumber,
        text: line,
      });

      if (out.length >= limit) {
        return out;
      }
    }
  }

  return out;
}

function formatNumberForChoice(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }
  const fixed = Number(value.toFixed(6));
  if (!Number.isFinite(fixed)) {
    return "";
  }
  return Number.isInteger(fixed) ? String(fixed) : String(fixed);
}

function parseNumericChoiceValue(value: string) {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!/^[+\-]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function mathValuesEqual(left: number, right: number, tolerance = 1e-6) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function buildWrongNumericChoices(correctValue: number) {
  if (!Number.isFinite(correctValue)) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set([formatNumberForChoice(correctValue)]);
  const baseStep = Number.isInteger(correctValue) ? 1 : 0.5;
  const candidates = [
    correctValue + baseStep,
    correctValue - baseStep,
    correctValue + 2 * baseStep,
    correctValue - 2 * baseStep,
    -correctValue,
    correctValue + 5 * baseStep,
    correctValue - 5 * baseStep,
  ];

  for (const candidate of candidates) {
    const text = formatNumberForChoice(candidate);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    out.push(text);
    if (out.length >= 3) {
      break;
    }
  }

  while (out.length < 3) {
    const fallback = formatNumberForChoice(correctValue + (Math.random() * 8 - 4));
    if (!fallback || seen.has(fallback)) {
      continue;
    }
    seen.add(fallback);
    out.push(fallback);
  }

  return out.slice(0, 3);
}

function buildWrongNumericChoicesWithSalt(correctValue: number, salt = 0) {
  const base = buildWrongNumericChoices(correctValue);
  if (base.length >= 3) {
    return base.slice(0, 3);
  }

  const out = [...base];
  const seen = new Set(out.map((item) => String(item)));
  seen.add(formatNumberForChoice(correctValue));

  let tries = 0;
  while (out.length < 3 && tries < 20) {
    tries += 1;
    const delta = ((salt + tries) % 7) + 1;
    const candidate = formatNumberForChoice(correctValue + delta);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    out.push(candidate);
  }

  return out.slice(0, 3);
}

function evaluateSimpleExercise(problemText: string) {
  let expression = stripExerciseLabel(problemText);
  if (!expression) {
    return null;
  }

  expression = expression
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/:/g, "/")
    .replace(/\s+/g, "")
    .replace(
      /([²³⁴⁵⁶⁷⁸⁹])√([+\-]?\d+(?:\.\d+)?)/g,
      (match, degree: string, radicand: string) => {
        const normalizedDegree = toSuperscriptDigit(degree);
        return normalizedDegree
          ? `Math.pow(${radicand},1/${normalizedDegree})`
          : match;
      },
    )
    .replace(
      /(\d)√([+\-]?\d+(?:\.\d+)?)/g,
      (_match, degree: string, radicand: string) =>
        `Math.pow(${radicand},1/${degree})`,
    )
    .replace(/√([+\-]?\d+(?:\.\d+)?)/g, (_match, radicand: string) => `Math.sqrt(${radicand})`)
    .replace(
      /\b(sin|cos|tan)\(?([+\-]?\d+(?:\.\d+)?)°\)?/gi,
      (_match, fnName: string, degree: string) =>
        `Math.${fnName.toLowerCase()}((${degree})*Math.PI/180)`,
    )
    .replace(/\beos\b/gi, "cos")
    .replace(/\bv(?=\d)/gi, "√");

  for (const [symbol, digit] of Object.entries(SUPERSCRIPT_DIGIT_MAP)) {
    if (symbol === "⁻") {
      continue;
    }
    expression = expression.replace(new RegExp(`(\\d)${symbol}`, "g"), `$1^${digit}`);
  }
  expression = expression.replace(/⁻/g, "-");

  let safeExpression = expression;
  const barCount = (safeExpression.match(/\|/g) || []).length;
  if (barCount % 2 === 1) {
    if (safeExpression.trim().endsWith("|")) {
      safeExpression = `|${safeExpression}`;
    } else if (safeExpression.trim().startsWith("|")) {
      safeExpression = `${safeExpression}|`;
    } else {
      safeExpression = safeExpression.replace(/\|/g, "");
    }
  }

  while (/\|[^|]+\|/.test(safeExpression)) {
    safeExpression = safeExpression.replace(/\|([^|]+)\|/g, "Math.abs($1)");
  }

  safeExpression = safeExpression.replace(/\^/g, "**");
  const alphaCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "");
  if (/[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]/u.test(alphaCheck)) {
    return null;
  }

  const syntaxCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "1");
  if (!/^[0-9+\-*/().\s*]+$/.test(syntaxCheck)) {
    return null;
  }

  try {
    const value = Function(`"use strict"; return (${safeExpression});`)() as number;
    return Number.isFinite(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function toSafeMathExpression(
  rawExpression: string,
  options: { allowVariable?: boolean } = {},
) {
  let expression = stripExerciseLabel(rawExpression);
  if (!expression) {
    return null;
  }

  expression = expression
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/:/g, "/")
    .replace(/\s+/g, "")
    .replace(/\beos\b/gi, "cos")
    .replace(/\bv(?=\d)/gi, "√")
    .replace(
      /([²³⁴⁵⁶⁷⁸⁹])√([+\-]?\d+(?:\.\d+)?)/g,
      (match, degree: string, radicand: string) => {
        const normalizedDegree = toSuperscriptDigit(degree);
        return normalizedDegree
          ? `Math.pow(${radicand},1/${normalizedDegree})`
          : match;
      },
    )
    .replace(
      /(\d)√([+\-]?\d+(?:\.\d+)?)/g,
      (_match, degree: string, radicand: string) =>
        `Math.pow(${radicand},1/${degree})`,
    )
    .replace(/√([+\-]?\d+(?:\.\d+)?)/g, (_match, radicand: string) => `Math.sqrt(${radicand})`)
    .replace(
      /\b(sin|cos|tan)\(?([+\-]?\d+(?:\.\d+)?)°\)?/gi,
      (_match, fnName: string, degree: string) =>
        `Math.${fnName.toLowerCase()}((${degree})*Math.PI/180)`,
    );

  for (const [symbol, digit] of Object.entries(SUPERSCRIPT_DIGIT_MAP)) {
    if (symbol === "⁻") {
      continue;
    }
    expression = expression.replace(new RegExp(`(\\d)${symbol}`, "g"), `$1^${digit}`);
  }
  expression = expression.replace(/⁻/g, "-");

  let safeExpression = expression;
  const barCount = (safeExpression.match(/\|/g) || []).length;
  if (barCount % 2 === 1) {
    if (safeExpression.trim().endsWith("|")) {
      safeExpression = `|${safeExpression}`;
    } else if (safeExpression.trim().startsWith("|")) {
      safeExpression = `${safeExpression}|`;
    } else {
      safeExpression = safeExpression.replace(/\|/g, "");
    }
  }

  while (/\|[^|]+\|/.test(safeExpression)) {
    safeExpression = safeExpression.replace(/\|([^|]+)\|/g, "Math.abs($1)");
  }

  safeExpression = safeExpression.replace(/\^/g, "**");
  if (options.allowVariable) {
    safeExpression = safeExpression.replace(/[xXхХ]/g, "x");
  }

  let alphaCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "");
  if (options.allowVariable) {
    alphaCheck = alphaCheck.replace(/x/g, "");
  }
  if (/[A-Za-zА-Яа-яЁёӨөҮүҢңӘә]/u.test(alphaCheck)) {
    return null;
  }

  let syntaxCheck = safeExpression.replace(/Math\.(abs|sin|cos|tan|sqrt|pow|PI|E)/g, "1");
  if (options.allowVariable) {
    syntaxCheck = syntaxCheck.replace(/x/g, "1");
  }
  if (!/^[0-9+\-*/().\s*]+$/.test(syntaxCheck)) {
    return null;
  }

  return safeExpression;
}

function evaluateMathExpression(
  rawExpression: string,
  variables: { x?: number | null } = {},
) {
  const allowVariable = Number.isFinite(Number(variables.x));
  const safeExpression = toSafeMathExpression(rawExpression, { allowVariable });
  if (!safeExpression) {
    return null;
  }

  try {
    if (allowVariable) {
      const value = Function("x", `"use strict"; return (${safeExpression});`)(
        Number(variables.x),
      ) as number;
      return Number.isFinite(value) ? Number(value) : null;
    }

    const value = Function(`"use strict"; return (${safeExpression});`)() as number;
    return Number.isFinite(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function solveEquationIntegerRoots(
  problemText: string,
  options: { maxX?: number; minX?: number } = {},
) {
  const source = normalizeExerciseLine(problemText);
  const body = stripExerciseLabel(source);
  if (!body || !/[xXхХ]/.test(body) || (body.match(/=/g) || []).length !== 1) {
    return [];
  }
  if (/[<>≤≥]/.test(body)) {
    return [];
  }

  const [left, right] = body.split("=");
  const roots: number[] = [];
  const minX = Number.isFinite(options.minX) ? Number(options.minX) : -30;
  const maxX = Number.isFinite(options.maxX) ? Number(options.maxX) : 30;

  for (let x = minX; x <= maxX; x += 1) {
    const leftValue = evaluateMathExpression(left, { x });
    const rightValue = evaluateMathExpression(right, { x });
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      continue;
    }
    if (mathValuesEqual(Number(leftValue), Number(rightValue), 1e-6)) {
      roots.push(x);
    }
  }

  return Array.from(new Set(roots));
}

function solveSimpleLinearEquation(problemText: string) {
  const source = normalizeExerciseLine(problemText);
  const body = stripExerciseLabel(source);
  if (!body || !/[xXхХ]/.test(body) || (body.match(/=/g) || []).length !== 1) {
    return null;
  }
  if (
    /[<>≤≥]/.test(body) ||
    /\|[^|]+\|/.test(body) ||
    /√/.test(body) ||
    /\b(sin|cos|tan|log|ln)\b/i.test(body) ||
    /[xXхХ]\s*(?:\^|\*\*)\s*[2-9]/.test(body) ||
    /[²³⁴⁵⁶⁷⁸⁹]/.test(body)
  ) {
    return null;
  }

  const [left, right] = body.split("=");
  const evalResidual = (x: number) => {
    const leftValue = evaluateMathExpression(left, { x });
    const rightValue = evaluateMathExpression(right, { x });
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      return null;
    }
    return Number(leftValue) - Number(rightValue);
  };

  const f0 = evalResidual(0);
  const f1 = evalResidual(1);
  if (!Number.isFinite(f0) || !Number.isFinite(f1)) {
    return null;
  }

  const a = Number(f1) - Number(f0);
  const b = Number(f0);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-9) {
    return null;
  }

  const root = -b / a;
  const verify = evalResidual(root);
  if (!Number.isFinite(root) || !Number.isFinite(verify) || Math.abs(Number(verify)) > 1e-5) {
    return null;
  }

  return root;
}

function normalizeChoiceBody(choice: string) {
  return String(choice || "")
    .replace(/^(?:[A-D]|[АБВГ]|[1-4])(?:\s*[\).:\-–]|\s+)\s*/iu, "")
    .trim();
}

function normalizeQuestionProblemKey(
  question: Partial<GeneratedTextbookQuestion> & { source_excerpt?: string },
) {
  const source = String(question.source_excerpt || question.bookProblem || question.question || "").trim();
  return normalizeProblemKey(source);
}

function dedupeQuestionsByProblem(questions: GeneratedTextbookQuestion[], limit = 30) {
  const out: GeneratedTextbookQuestion[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    const key = normalizeQuestionProblemKey(question);
    const fallbackKey = String(question.question || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const mergedKey = key || fallbackKey;
    if (!mergedKey || seen.has(mergedKey)) {
      continue;
    }
    seen.add(mergedKey);
    out.push(question);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

function verifyQuestionAnswerAccuracy(question: GeneratedTextbookQuestion) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  if (choices.length !== 4) {
    return null;
  }

  const sourceProblem = String(question.bookProblem || "").trim();
  if (!sourceProblem) {
    return question;
  }

  const choiceBodies = choices.map((choice) => normalizeChoiceBody(choice));
  const body = stripExerciseLabel(sourceProblem);

  if (/[xXхХ]/.test(body) && (body.match(/=/g) || []).length === 1 && !/[<>≤≥]/.test(body)) {
    const [left, right] = body.split("=");
    const validIndexes: number[] = [];

    for (let index = 0; index < choiceBodies.length; index += 1) {
      const xValue = parseNumericChoiceValue(choiceBodies[index]);
      if (!Number.isFinite(xValue)) {
        continue;
      }
      const leftValue = evaluateMathExpression(left, { x: Number(xValue) });
      const rightValue = evaluateMathExpression(right, { x: Number(xValue) });
      if (
        Number.isFinite(leftValue) &&
        Number.isFinite(rightValue) &&
        mathValuesEqual(Number(leftValue), Number(rightValue), 1e-6)
      ) {
        validIndexes.push(index);
      }
    }

    if (validIndexes.length === 1) {
      return {
        ...question,
        correctAnswer: ["A", "B", "C", "D"][validIndexes[0]] || "A",
      };
    }

    if (validIndexes.length > 1) {
      return null;
    }
  }

  const solved = evaluateSimpleExercise(sourceProblem);
  if (Number.isFinite(solved)) {
    const correctValue = Number(solved);
    let matchingIndex = -1;

    for (let index = 0; index < choiceBodies.length; index += 1) {
      const choiceValue = parseNumericChoiceValue(choiceBodies[index]);
      if (!Number.isFinite(choiceValue)) {
        continue;
      }
      if (mathValuesEqual(Number(choiceValue), correctValue, 1e-5)) {
        if (matchingIndex >= 0) {
          return null;
        }
        matchingIndex = index;
      }
    }

    if (matchingIndex >= 0) {
      return {
        ...question,
        correctAnswer: ["A", "B", "C", "D"][matchingIndex] || "A",
      };
    }
  }

  const numericChoiceCount = choiceBodies.filter((choice) =>
    Number.isFinite(parseNumericChoiceValue(choice)),
  ).length;

  if (
    looksMathLikeText(sourceProblem) &&
    (numericChoiceCount >= 2 || /[xXхХ=|√+\-*/]/.test(body))
  ) {
    return null;
  }

  return question;
}

function buildEquationChoiceQuestionsFromExercises(
  exerciseProblems: ExerciseProblem[],
  needed: number,
) {
  const out: GeneratedTextbookQuestion[] = [];
  const seen = new Set<string>();
  const labels = ["A", "B", "C", "D"];

  for (const rawItem of exerciseProblems) {
    if (out.length >= needed) {
      break;
    }

    const sourceProblem = normalizeExerciseLine(rawItem.text);
    const dedupeKey = normalizeProblemKey(sourceProblem);
    const body = stripExerciseLabel(sourceProblem);
    if (!sourceProblem || !dedupeKey || seen.has(dedupeKey)) {
      continue;
    }
    if (!/[xXхХ]/.test(body) || (body.match(/=/g) || []).length !== 1 || /[<>≤≥]/.test(body)) {
      continue;
    }

    const [left, right] = body.split("=");
    const satisfies: number[] = [];
    for (let x = -30; x <= 30; x += 1) {
      const leftValue = evaluateMathExpression(left, { x });
      const rightValue = evaluateMathExpression(right, { x });
      if (
        Number.isFinite(leftValue) &&
        Number.isFinite(rightValue) &&
        mathValuesEqual(Number(leftValue), Number(rightValue), 1e-6)
      ) {
        satisfies.push(x);
      }
    }

    if (!satisfies.length) {
      continue;
    }

    const correct = satisfies[Math.floor(satisfies.length / 2)];
    const wrong: number[] = [];
    for (const candidate of [
      correct - 1,
      correct + 1,
      correct - 2,
      correct + 2,
      -correct,
      0,
      1,
      -1,
    ]) {
      if (wrong.length >= 3) {
        break;
      }
      if (candidate === correct || satisfies.includes(candidate) || wrong.includes(candidate)) {
        continue;
      }
      wrong.push(candidate);
    }

    while (wrong.length < 3) {
      const candidate = correct + Math.floor(Math.random() * 14) - 7;
      if (candidate === correct || satisfies.includes(candidate) || wrong.includes(candidate)) {
        continue;
      }
      wrong.push(candidate);
    }

    const values = [correct, ...wrong.slice(0, 3)];
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }

    const correctIndex = values.indexOf(correct);
    out.push({
      id: `mcq-eq-${out.length + 1}`,
      kind: "mcq",
      question: SOLVE_QUESTION_TEXT,
      choices: values.map((value, index) => `${labels[index]}. ${value}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
      difficulty: "medium",
      explanation: `x = ${correct} үед тэгшитгэл биелнэ.`,
      points: 1,
      sourcePages: Number.isFinite(rawItem.pageNumber) ? [rawItem.pageNumber] : [],
      bookProblem: sourceProblem,
    });
    seen.add(dedupeKey);
  }

  return out.slice(0, needed);
}

function buildSolvedQuestionsFromExerciseProblems(
  exerciseProblems: ExerciseProblem[],
  needed: number,
) {
  const equationQuestions = buildEquationChoiceQuestionsFromExercises(exerciseProblems, needed);
  const remainingNeeded = Math.max(0, needed - equationQuestions.length);
  if (remainingNeeded === 0) {
    return equationQuestions.slice(0, needed);
  }

  const labels = ["A", "B", "C", "D"];
  const solvedPool: Array<{
    complexity: number;
    correctValue: string;
    pageNumber: number;
    problemRoot: string;
    solved: number;
    sourceProblem: string;
  }> = [];

  const extractCandidateExpressions = (rawProblem: string) => {
    const body = stripExerciseLabel(rawProblem);
    const out: string[] = [];
    const seen = new Set<string>();

    const pushCandidate = (candidate: string) => {
      const value = normalizeExerciseLine(candidate);
      const key = value.toLowerCase();
      if (value && !seen.has(key)) {
        seen.add(key);
        out.push(value);
      }
    };

    for (const abs of body.match(/\|[^|]{1,48}\|/g) || []) {
      pushCandidate(abs);
    }
    for (const oddAbs of body.match(/[^\s|]{0,12}\|[^|]{1,40}\||\|[^|]{1,40}[^\s|]{0,12}/g) || []) {
      pushCandidate(oddAbs);
    }
    for (const part of body.split(/[;,]/g)) {
      const normalized = normalizeExerciseLine(part);
      if (normalized.length >= 3 && normalized.length <= 56) {
        pushCandidate(normalized);
      }
    }
    pushCandidate(body);

    return out;
  };

  const scoreExpressionComplexity = (value: string) => {
    const text = String(value || "");
    let score = 0;
    score += (text.match(/[+\-*/]/g) || []).length;
    if (/\|/.test(text)) score += 2;
    if (/√/.test(text)) score += 2;
    if (/\b(sin|cos|tan|log|ln)\b/i.test(text)) score += 3;
    if (/[xXхХ]/.test(text)) score += 3;
    if (/=/.test(text)) score += 2;
    return score;
  };

  for (const item of exerciseProblems) {
    const sourceProblem = normalizeExerciseLine(item.text);
    if (!sourceProblem) {
      continue;
    }

    let bestSolved: {
      complexity: number;
      correctValue: string;
      pageNumber: number;
      problemRoot: string;
      solved: number;
      sourceProblem: string;
    } | null = null;

    for (const candidate of extractCandidateExpressions(sourceProblem)) {
      const solved = evaluateSimpleExercise(candidate);
      const correctValue = Number.isFinite(solved) ? formatNumberForChoice(Number(solved)) : "";
      if (!correctValue) {
        continue;
      }
      const complexity = scoreExpressionComplexity(candidate);
      if (!bestSolved || complexity > bestSolved.complexity) {
        bestSolved = {
          complexity,
          correctValue,
          pageNumber: Math.trunc(Number(item.pageNumber)),
          problemRoot: sourceProblem,
          solved: Number(solved),
          sourceProblem: candidate,
        };
      }
    }

    if (bestSolved) {
      solvedPool.push(bestSolved);
    }
  }

  solvedPool.sort((left, right) => right.complexity - left.complexity);
  const out: GeneratedTextbookQuestion[] = [];
  const seen = new Set<string>();

  for (let index = 0; out.length < remainingNeeded && index < solvedPool.length; index += 1) {
    const item = solvedPool[index];
    const dedupeKey = normalizeProblemKey(item.problemRoot || item.sourceProblem);
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    const rawChoices = [
      item.correctValue,
      ...buildWrongNumericChoicesWithSalt(item.solved, index).slice(0, 3),
    ];
    for (let swapIndex = rawChoices.length - 1; swapIndex > 0; swapIndex -= 1) {
      const randomIndex = Math.floor(Math.random() * (swapIndex + 1));
      [rawChoices[swapIndex], rawChoices[randomIndex]] = [
        rawChoices[randomIndex],
        rawChoices[swapIndex],
      ];
    }

    const correctIndex = rawChoices.indexOf(item.correctValue);
    out.push({
      id: `mcq-solved-${equationQuestions.length + out.length + 1}`,
      kind: "mcq",
      question: SOLVE_QUESTION_TEXT,
      choices: rawChoices.map((choice, choiceIndex) => `${labels[choiceIndex]}. ${choice}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
      difficulty: "medium",
      explanation: `${stripExerciseLabel(item.sourceProblem)} = ${item.correctValue}`,
      points: 1,
      sourcePages: Number.isFinite(item.pageNumber) ? [item.pageNumber] : [],
      bookProblem: item.problemRoot || item.sourceProblem,
    });
  }

  return [...equationQuestions, ...out].slice(0, needed);
}

function buildLocalQuestionsFromExerciseProblems(
  exerciseProblems: ExerciseProblem[],
  needed: number,
) {
  const labels = ["A", "B", "C", "D"];
  const out: GeneratedTextbookQuestion[] = [];
  const seenQuestions = new Set<string>();

  for (const candidate of exerciseProblems) {
    if (out.length >= needed) {
      break;
    }

    const sourceProblem = normalizeExerciseLine(candidate.text);
    const solved = evaluateSimpleExercise(sourceProblem);
    const correctValue = Number.isFinite(solved) ? formatNumberForChoice(Number(solved)) : "";
    if (!sourceProblem || !correctValue) {
      continue;
    }

    const wrongValues = buildWrongNumericChoices(Number(solved));
    if (wrongValues.length < 3) {
      continue;
    }

    const rawChoices = [correctValue, ...wrongValues.slice(0, 3)];
    for (let index = rawChoices.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [rawChoices[index], rawChoices[swapIndex]] = [rawChoices[swapIndex], rawChoices[index]];
    }

    const dedupeKey = `numeric::${sourceProblem.toLowerCase()}`;
    if (seenQuestions.has(dedupeKey)) {
      continue;
    }
    seenQuestions.add(dedupeKey);

    const correctIndex = rawChoices.indexOf(correctValue);
    out.push({
      id: `mcq-local-${out.length + 1}`,
      kind: "mcq",
      question: SOLVE_QUESTION_TEXT,
      choices: rawChoices.map((choice, index) => `${labels[index]}. ${choice}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
      difficulty: "medium",
      explanation: `${stripExerciseLabel(sourceProblem)} = ${correctValue}`,
      points: 1,
      sourcePages: [candidate.pageNumber],
      bookProblem: sourceProblem,
    });
  }

  return out;
}

function buildRepeatedSolvedQuestions(
  exerciseProblems: ExerciseProblem[],
  needed: number,
  saltStart = 0,
  excludedProblemKeys: string[] = [],
  allowRepeat = false,
) {
  const count = Math.max(0, Math.trunc(Number(needed) || 0));
  if (count <= 0) {
    return [];
  }

  const excluded = new Set(
    excludedProblemKeys.map((value) => String(value || "").trim()).filter(Boolean),
  );
  const solvedPool: Array<{
    correctValue: string;
    key: string;
    pageNumber: number;
    solved: number;
    sourceProblem: string;
  }> = [];

  for (const item of exerciseProblems) {
    const sourceProblem = normalizeExerciseLine(item.text);
    const key = normalizeProblemKey(sourceProblem);
    if (!sourceProblem || !key || excluded.has(key)) {
      continue;
    }

    const linearRoot = solveSimpleLinearEquation(sourceProblem);
    const roots = solveEquationIntegerRoots(sourceProblem, { minX: -40, maxX: 40 });
    const solved =
      Number.isFinite(linearRoot) ? Number(linearRoot) : roots.length === 1 ? roots[0] : evaluateSimpleExercise(sourceProblem);
    const correctValue = Number.isFinite(solved) ? formatNumberForChoice(Number(solved)) : "";
    if (!correctValue) {
      continue;
    }

    solvedPool.push({
      correctValue,
      key,
      pageNumber: Math.trunc(Number(item.pageNumber)),
      solved: Number(solved),
      sourceProblem,
    });
  }

  if (!solvedPool.length) {
    return [];
  }

  const labels = ["A", "B", "C", "D"];
  const maxCount = allowRepeat ? count : Math.min(count, solvedPool.length);
  const out: GeneratedTextbookQuestion[] = [];

  for (let index = 0; index < maxCount; index += 1) {
    const salt = saltStart + index;
    const item = solvedPool[((salt % solvedPool.length) + solvedPool.length) % solvedPool.length];

    const wrongValues = [
      ...buildWrongNumericChoicesWithSalt(item.solved, salt),
      ...buildWrongNumericChoices(item.solved),
    ]
      .map((candidate) => formatNumberForChoice(Number(candidate)))
      .filter((candidate) => candidate && candidate !== item.correctValue)
      .filter((candidate, candidateIndex, items) => items.indexOf(candidate) === candidateIndex)
      .slice(0, 3);

    let bump = 1;
    while (wrongValues.length < 3) {
      const candidate = formatNumberForChoice(item.solved + bump);
      bump += 1;
      if (!candidate || candidate === item.correctValue || wrongValues.includes(candidate)) {
        continue;
      }
      wrongValues.push(candidate);
    }

    const rawChoices = [item.correctValue, ...wrongValues];
    const shift = Math.abs(salt) % rawChoices.length;
    const shiftedChoices = rawChoices.slice(shift).concat(rawChoices.slice(0, shift));
    const correctIndex = shiftedChoices.indexOf(item.correctValue);

    out.push({
      id: `mcq-repeat-${index + 1}`,
      kind: "mcq",
      question: SOLVE_QUESTION_TEXT,
      choices: shiftedChoices.map((choice, choiceIndex) => `${labels[choiceIndex]}. ${choice}`),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
      difficulty: "medium",
      explanation: `${stripExerciseLabel(item.sourceProblem)} = ${item.correctValue}`,
      points: 1,
      sourcePages: Number.isFinite(item.pageNumber) ? [item.pageNumber] : [],
      bookProblem: item.sourceProblem,
    });
  }

  return out;
}

function buildMockSolvedQuestions(
  exerciseProblems: ExerciseProblem[],
  needed: number,
  saltStart = 0,
  options: {
    fallbackDifficulty?: TextbookDifficulty;
    grade?: number;
  } = {},
) {
  const count = Math.max(0, Math.trunc(Number(needed) || 0));
  if (count <= 0) {
    return [];
  }

  const normalizedProblems = Array.from(
    new Map(
      exerciseProblems
        .map((item) => ({
          complexity: scoreExerciseProblemQuality(item.text),
          pageNumber: Math.trunc(Number(item.pageNumber)),
          text: normalizeExerciseLine(item.text),
        }))
        .filter((item) => item.text)
        .map((item) => [
          `${normalizeProblemKey(item.text)}|${item.pageNumber}`,
          item,
        ]),
    ).values(),
  ).sort((left, right) => right.complexity - left.complexity);

  if (!normalizedProblems.length) {
    return [];
  }

  const preferAdvancedMocks = shouldPreferAdvancedMockTopUp(options);
  const advancedProblems = normalizedProblems.filter(
    (item) => hasAdvancedMockSignal(item.text),
  );
  const preferredProblems =
    preferAdvancedMocks && advancedProblems.length > 0
      ? advancedProblems
      : normalizedProblems;
  const templatePool = selectMockTemplatePool(options);
  const labels = ["A", "B", "C", "D"];
  const out: GeneratedTextbookQuestion[] = [];

  for (let index = 0; index < count; index += 1) {
    const salt = saltStart + index;
    const source =
      preferredProblems[
        ((salt % preferredProblems.length) + preferredProblems.length) %
          preferredProblems.length
      ];
    const template =
      templatePool[
        ((salt % templatePool.length) + templatePool.length) %
          templatePool.length
      ];
    const sourceProblem = String(source?.text || "").trim();
    const strippedProblem = stripExerciseLabel(sourceProblem);
    const linearRoot = solveSimpleLinearEquation(sourceProblem);
    const roots = solveEquationIntegerRoots(sourceProblem, { minX: -40, maxX: 40 });
    const solved =
      Number.isFinite(linearRoot)
        ? Number(linearRoot)
        : roots.length === 1
          ? roots[0]
          : evaluateSimpleExercise(sourceProblem);
    const useSourceProblem =
      Number.isFinite(solved) &&
      Boolean(strippedProblem) &&
      (!preferAdvancedMocks || hasAdvancedMockSignal(strippedProblem));
    const displayProblem = useSourceProblem ? strippedProblem : template.problem;
    const correctValue = useSourceProblem
      ? formatNumberForChoice(Number(solved))
      : template.answer;

    const wrongValues = useSourceProblem
      ? [
          ...buildWrongNumericChoicesWithSalt(Number(solved), salt),
          ...buildWrongNumericChoices(Number(solved)),
        ]
          .map((candidate) => formatNumberForChoice(Number(candidate)))
          .filter((candidate) => candidate && candidate !== correctValue)
          .filter(
            (candidate, candidateIndex, items) =>
              items.indexOf(candidate) === candidateIndex,
          )
          .slice(0, 3)
      : [...template.wrongChoices];

    while (wrongValues.length < 3) {
      const candidate = formatNumberForChoice(
        Number(correctValue) + index + wrongValues.length + 1,
      );
      if (candidate === correctValue || wrongValues.includes(candidate)) {
        continue;
      }
      wrongValues.push(candidate);
    }

    const rawChoices = [correctValue, ...wrongValues];
    const shift = Math.abs(salt) % rawChoices.length;
    const shiftedChoices = rawChoices
      .slice(shift)
      .concat(rawChoices.slice(0, shift));
    const correctIndex = shiftedChoices.indexOf(correctValue);
    const mockOrdinal = salt + 1;

    out.push({
      id: `mcq-mock-${mockOrdinal}`,
      kind: "mcq",
      question: buildReadableChoiceQuestionPrompt(displayProblem),
      choices: shiftedChoices.map(
        (choice, choiceIndex) => `${labels[choiceIndex]}. ${choice}`,
      ),
      correctAnswer: labels[correctIndex >= 0 ? correctIndex : 0] || "A",
      difficulty: "medium",
      explanation: useSourceProblem
        ? `Зөв хариу: ${correctValue}. ${displayProblem}-ийг бодоход ${correctValue}.`
        : template.explanation,
      points: 1,
      sourcePages: Number.isFinite(source?.pageNumber)
        ? [Number(source?.pageNumber)]
        : [],
      bookProblem: displayProblem,
    });
  }

  return out;
}

function buildOpenTaskAnswer(problemText: string) {
  const source = normalizeExerciseLine(problemText);
  if (!source) {
    return "";
  }

  const roots = solveEquationIntegerRoots(source, { minX: -40, maxX: 40 });
  if (roots.length === 1) {
    return `x = ${roots[0]}`;
  }
  if (roots.length > 1) {
    return `x ∈ {${roots.join(", ")}}`;
  }

  const linearRoot = solveSimpleLinearEquation(source);
  if (Number.isFinite(linearRoot)) {
    return `x = ${formatNumberForChoice(Number(linearRoot))}`;
  }

  const solved = evaluateSimpleExercise(source);
  return Number.isFinite(solved) ? formatNumberForChoice(Number(solved)) : "";
}

function scoreOpenTaskComplexity(problemText: string) {
  const body = stripExerciseLabel(problemText);
  let score = (body.match(/[+\-*/]/g) || []).length;
  if (/\|/.test(body)) score += 2;
  if (/√/.test(body)) score += 2;
  if (/\b(sin|cos|tan|log|ln)\b/i.test(body)) score += 3;
  if (/[xXхХ]/.test(body)) score += 5;
  if (/=/.test(body)) score += 2;
  return score;
}

function buildOpenEndedTasks(
  exerciseProblems: ExerciseProblem[],
  openQuestionCount: number,
  difficultyCounts: { easy: number; hard: number; medium: number },
  fallbackDifficulty: TextbookDifficulty,
  totalScore: number,
  options: {
    grade?: number;
  } = {},
) {
  const needed = parseNonNegativeInt(openQuestionCount, 0, 80);
  if (needed <= 0) {
    return {
      mockCount: 0,
      tasks: [],
    };
  }

  const unique = Array.from(
    new Map(
      exerciseProblems
        .map((item) => ({
          pageNumber: Math.trunc(Number(item.pageNumber)),
          text: normalizeExerciseLine(item.text),
        }))
        .filter((item) => item.text)
        .map((item) => [
          normalizeProblemKey(item.text),
          {
            ...item,
            answer: buildOpenTaskAnswer(item.text),
            complexity: scoreOpenTaskComplexity(item.text),
          },
        ]),
    ).values(),
  ).sort((left, right) => right.complexity - left.complexity);

  const plan = buildDifficultyPlan(difficultyCounts, fallbackDifficulty, needed);
  const effectiveTotalScore = parseNonNegativeInt(totalScore, 0, 500);
  const baseScore = needed > 0 ? Math.trunc(effectiveTotalScore / needed) : 0;
  const remainder = needed > 0 ? effectiveTotalScore % needed : 0;
  const usedKeys = new Set<string>();
  const mockPool = selectMockOpenTaskTemplatePool({
    fallbackDifficulty,
    grade: options.grade,
  });
  const shouldPreferMockDifficultyFit = mockPool.length > 0;
  const usedMockPrompts = new Set<string>();

  const pickCandidateByDifficulty = (difficulty: TextbookDifficulty) => {
    const inBand = (complexity: number) => {
      if (difficulty === "easy") return complexity <= 4;
      if (difficulty === "hard") return complexity >= 8;
      return complexity >= 5;
    };

    const candidates = unique.filter(
      (item) => !usedKeys.has(normalizeProblemKey(item.text)),
    );
    const exactWithAnswer = candidates.find(
      (item) => inBand(item.complexity) && item.answer,
    );
    const exactAny = candidates.find((item) => inBand(item.complexity));
    const match = shouldPreferMockDifficultyFit
      ? exactWithAnswer || null
      : exactWithAnswer ||
        exactAny ||
        candidates.find((item) => item.answer) ||
        candidates[0];

    if (match) {
      usedKeys.add(normalizeProblemKey(match.text));
    }
    return match;
  };

  const pickMockByDifficulty = (
    difficulty: TextbookDifficulty,
    index: number,
  ) => {
    if (!mockPool.length) {
      return null;
    }

    const availableTemplates = mockPool.filter(
      (item) =>
        item.difficulty === difficulty &&
        !usedMockPrompts.has(item.prompt.trim().toLowerCase()),
    );
    const matchingPool = availableTemplates.length > 0
      ? availableTemplates
      : mockPool.filter(
          (item) => !usedMockPrompts.has(item.prompt.trim().toLowerCase()),
        );
    const fallbackPool = matchingPool.length > 0 ? matchingPool : mockPool;
    const template = fallbackPool[index % fallbackPool.length] || null;
    if (!template) {
      return null;
    }

    usedMockPrompts.add(template.prompt.trim().toLowerCase());
    return template;
  };

  const tasks: GeneratedTextbookOpenTask[] = [];
  let mockCount = 0;
  for (let index = 0; index < needed; index += 1) {
    const desiredDifficulty = plan[index] || fallbackDifficulty;
    const source = pickCandidateByDifficulty(desiredDifficulty);
    const mockTask = !source ? pickMockByDifficulty(desiredDifficulty, index) : null;
    const sourceText = String(source?.text || "").trim();
    const scoreValue =
      effectiveTotalScore > 0 ? baseScore + (index < remainder ? 1 : 0) : 0;

    if (mockTask) {
      mockCount += 1;
      tasks.push({
        id: `written-${index + 1}`,
        kind: "written",
        prompt: mockTask.prompt,
        difficulty: mockTask.difficulty,
        score: scoreValue,
        points: scoreValue,
        answer: mockTask.answer,
        sourcePages: [],
        sourceExcerpt: mockTask.sourceExcerpt,
      });
      continue;
    }

    tasks.push({
      id: `written-${index + 1}`,
      kind: "written",
      prompt: sourceText
        ? `Дараах бодлогыг дэлгэрэнгүй бодоод, аргачлалаа тайлбарлан бич.\n${sourceText}`
        : "Сонгосон сэдвийн хүрээнд ижил төрлийн бодлого зохиож, бодолтын алхмуудаа тайлбарла.",
      difficulty: desiredDifficulty,
      score: scoreValue,
      points: scoreValue,
      answer: String(source?.answer || "").trim(),
      sourcePages: Number.isFinite(source?.pageNumber) ? [Number(source?.pageNumber)] : [],
      sourceExcerpt: sourceText,
    });
  }

  return {
    mockCount,
    tasks,
  };
}

function pickVisiblePages(
  book: ParsedTextbook,
  sectionIds: string[],
) {
  const pageMap = new Map<number, ParsedTextbookSectionPage>();
  const selectedIds = new Set(sectionIds.map((value) => String(value || "").trim()).filter(Boolean));

  for (const chapter of book.chapters) {
    for (const section of chapter.sections) {
      if (!selectedIds.has(section.id)) {
        continue;
      }
      for (const page of section.pages) {
        if (!pageMap.has(page.pageNumber)) {
          pageMap.set(page.pageNumber, page);
        }
      }
    }
  }

  return Array.from(pageMap.values()).sort((left, right) => left.pageNumber - right.pageNumber);
}

function joinLineTokens(tokens: Array<{ text: string; x: number }>) {
  let currentLine = "";

  for (const token of tokens) {
    const text = token.text.trim();
    if (!text) {
      continue;
    }

    const needsTightJoin = /^[,.;:!?)}\]]/.test(text) || /[(\[{]$/.test(currentLine);
    currentLine += currentLine && !needsTightJoin ? ` ${text}` : text;
  }

  return currentLine.trim();
}

function extractPageTextFromItems(items: PdfTextItem[]) {
  const positionedItems = items
    .map((item) => ({
      text: String(item.str || "").replace(/\s+/g, " ").trim(),
      x: Array.isArray(item.transform) ? Number(item.transform[4] || 0) : 0,
      y: Array.isArray(item.transform) ? Number(item.transform[5] || 0) : 0,
    }))
    .filter((item) => item.text);

  positionedItems.sort((left, right) => {
    const yGap = Math.abs(right.y - left.y);
    if (yGap > 2) {
      return right.y - left.y;
    }
    return left.x - right.x;
  });

  const lines: Array<Array<{ text: string; x: number; y: number }>> = [];
  for (const item of positionedItems) {
    const existingLine = lines.find(
      (line) => line.length > 0 && Math.abs(line[0].y - item.y) <= 3,
    );
    if (existingLine) {
      existingLine.push(item);
      continue;
    }
    lines.push([item]);
  }

  return lines
    .sort((left, right) => right[0].y - left[0].y)
    .map((line) => line.sort((left, right) => left.x - right.x))
    .map((line) => joinLineTokens(line))
    .filter(Boolean)
    .join("\n");
}

export async function parseTextbookPdf(file: File): Promise<ParsedTextbook> {
  if (typeof window === "undefined") {
    throw new Error("PDF уншилт зөвхөн browser дээр ажиллана.");
  }

  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const documentInit = {
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0];
  const loadingTask = pdfjs.getDocument(documentInit);
  const pdfDocument = await loadingTask.promise;
  try {
    const pages: ParsedTextbookPage[] = [];

    for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
      const page = await pdfDocument.getPage(pageIndex + 1);
      const textContent = await page.getTextContent();
      const pageText = extractPageTextFromItems(textContent.items as PdfTextItem[]);
      pages.push({
        pageNumber: pageIndex + 1,
        text: normalizeDisplayText(pageText),
      });
      page.cleanup();
    }

    const title = file.name.replace(/\.pdf$/i, "") || "Сурах бичиг";
    const rawChapters = buildBookStructure(pages);
    const sections = flattenSections(rawChapters);
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const chapters: ParsedTextbookChapter[] = rawChapters.map((chapter, index) => ({
      id: `chapter-${index + 1}`,
      title: chapter.title,
      sections: chapter.sections
        .map((section) => sectionById.get(section.id))
        .filter((section): section is ParsedTextbookSection => Boolean(section)),
    }));

    if (!pages.length || !sections.length) {
      throw new Error(
        "PDF-ээс сэдэв бүтэц уншиж чадсангүй. Илүү цэвэр тексттэй PDF сонгоно уу.",
      );
    }

    return {
      id: slugify(`${title}-${Date.now()}`),
      title,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      pageCount: pages.length,
      pages,
      chapters,
      sections,
    };
  } finally {
    pdfDocument.cleanup();
    void pdfDocument.destroy();
  }
}

export function buildTextbookStats(test: GeneratedTextbookTest | null) {
  if (!test) {
    return {
      difficulty: { easy: 0, medium: 0, hard: 0 },
      singleChoiceCount: 0,
      totalScore: 0,
      writtenCount: 0,
    };
  }

  return {
    difficulty: test.difficultyCountsApplied,
    singleChoiceCount: test.questionCountGenerated,
    totalScore: test.totalScore,
    writtenCount: test.openQuestionCountGenerated,
  };
}

export function countSelectedPages(book: ParsedTextbook | null, sectionIds: string[]) {
  if (!book) {
    return 0;
  }
  return pickVisiblePages(book, sectionIds).length;
}

export function buildTextbookGenerationSource(
  book: ParsedTextbook,
  sectionIds: string[],
  options: {
    questionCount?: number;
  } = {},
): TextbookGenerationSource {
  const questionCount = parseNonNegativeInt(options.questionCount, 5, 40);
  const visiblePages = pickVisiblePages(book, sectionIds).map((page) => ({
    pageNumber: page.pageNumber,
    content: page.content,
  }));

  const extractedExerciseProblems = extractExerciseProblemsFromPages(
    visiblePages,
    Math.max(600, questionCount * 30),
  );
  const letterLabeledProblems = extractedExerciseProblems.filter((item) =>
    isLetterLabeledExerciseProblem(item?.text),
  );
  const strictExerciseProblems = letterLabeledProblems.filter((item) =>
    isStrictExerciseProblem(item?.text),
  );
  const preferredExerciseProblems =
    strictExerciseProblems.length > 0
      ? strictExerciseProblems
      : letterLabeledProblems.length >= Math.max(5, Math.ceil(questionCount / 2))
        ? letterLabeledProblems
        : extractedExerciseProblems;
  const exerciseOnlyProblems = preferredExerciseProblems.filter((item) =>
    isStrictExerciseProblem(item?.text) || isLetterLabeledExerciseProblem(item?.text),
  );
  const candidateExerciseProblems = exerciseOnlyProblems.length
    ? exerciseOnlyProblems
    : preferredExerciseProblems;
  const rankedExerciseProblems = [...candidateExerciseProblems]
    .sort(
      (left, right) =>
        scoreExerciseProblemQuality(right?.text) -
        scoreExerciseProblemQuality(left?.text),
    )
    .slice(0, Math.max(180, questionCount * 20));
  const topStrictRanked = rankedExerciseProblems.filter((item) =>
    isStrictExerciseProblem(item?.text),
  );
  const topCleanStrict = topStrictRanked.filter((item) =>
    isCleanExerciseProblem(item?.text),
  );
  const topCleanRanked = rankedExerciseProblems.filter((item) =>
    isCleanExerciseProblem(item?.text),
  );
  const sourceExerciseProblems =
    topCleanStrict.length > 0
      ? topCleanStrict
      : topCleanRanked.length > 0
        ? topCleanRanked
        : topStrictRanked.length > 0
          ? topStrictRanked
          : rankedExerciseProblems;
  let selectedExerciseProblems = sourceExerciseProblems.slice(
    0,
    Math.max(questionCount * 10, 80),
  );

  if (!selectedExerciseProblems.length) {
    selectedExerciseProblems = collectLooseMathProblemsFromPages(
      visiblePages,
      Math.max(questionCount * 10, 80),
    );
  } else if (selectedExerciseProblems.length < questionCount) {
    const looseCandidates = collectLooseMathProblemsFromPages(
      visiblePages,
      Math.max(questionCount * 14, 120),
    );
    const merged = [...selectedExerciseProblems];
    const seen = new Set(
      selectedExerciseProblems
        .map((item) => normalizeProblemKey(item?.text || ""))
        .filter(Boolean),
    );
    for (const item of looseCandidates) {
      const key = normalizeProblemKey(item?.text || "");
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
      if (merged.length >= Math.max(questionCount * 10, 80)) {
        break;
      }
    }
    selectedExerciseProblems = merged;
  }

  return {
    visiblePages,
    selectedExerciseProblems,
  };
}

export function generateTextbookTest(
  book: ParsedTextbook,
  sectionIds: string[],
  options: GenerateTextbookTestOptions = {},
): GeneratedTextbookTest {
  const fallbackDifficulty = normalizeDifficulty(options.fallbackDifficulty || "hard") as TextbookDifficulty;
  const grade = Number.parseInt(String(options.grade || ""), 10);
  const questionCount = parseNonNegativeInt(options.questionCount, 5, 40);
  const openQuestionCount = parseNonNegativeInt(options.openQuestionCount, 0, 20);
  const totalScore = parseNonNegativeInt(options.totalScore, Math.max(questionCount * 2, 10), 500);
  const visiblePages = pickVisiblePages(book, sectionIds);

  if (!visiblePages.length) {
    throw new Error("Эхлээд дор хаяж нэг сэдэв сонгоно уу.");
  }

  let extractedExerciseProblems = extractExerciseProblemsFromPages(
    visiblePages,
    Math.max(80, questionCount * 10),
  );

  if (!extractedExerciseProblems.length) {
    extractedExerciseProblems = collectLooseMathProblemsFromPages(
      visiblePages,
      Math.max(80, questionCount * 10),
    );
  }

  if (!extractedExerciseProblems.length) {
    throw new Error(
      "Сонгосон хэсгүүдээс бодлогын мөрүүд олдсонгүй. Өөр сэдэв эсвэл илүү цэвэр PDF сонгоно уу.",
    );
  }

  const strictExerciseProblems = extractedExerciseProblems.filter((item) =>
    isStrictExerciseProblem(item.text),
  );
  const cleanExerciseProblems = extractedExerciseProblems.filter((item) =>
    isCleanExerciseProblem(item.text),
  );
  const preferredExerciseProblems =
    cleanExerciseProblems.length > 0
      ? cleanExerciseProblems
      : strictExerciseProblems.length > 0
        ? strictExerciseProblems
        : extractedExerciseProblems;

  const selectedExerciseProblems = [...preferredExerciseProblems]
    .sort((left, right) => scoreExerciseProblemQuality(right.text) - scoreExerciseProblemQuality(left.text))
    .slice(0, Math.max(questionCount * 10, 80));

  const warnings: string[] = [];
  if (cleanExerciseProblems.length < Math.min(questionCount, 6)) {
    warnings.push(
      "PDF текстийн чанараас шалтгаалаад зарим бодлогын мөрүүд бүрэн цэвэр биш байж болно.",
    );
  }

  let questions = buildSolvedQuestionsFromExerciseProblems(selectedExerciseProblems, questionCount);
  const initialQuestionCount = questions.length;
  questions = dedupeQuestionsByProblem(questions, questionCount);
  const droppedByDuplicate = Math.max(0, initialQuestionCount - questions.length);

  const verifiedQuestions = questions
    .map((question) => verifyQuestionAnswerAccuracy(question))
    .filter((question): question is GeneratedTextbookQuestion => Boolean(question));
  questions = dedupeQuestionsByProblem(verifiedQuestions, questionCount);

  if (questions.length < questionCount) {
    const localTopUp = buildLocalQuestionsFromExerciseProblems(
      selectedExerciseProblems,
      questionCount - questions.length,
    );
    questions = dedupeQuestionsByProblem([...questions, ...localTopUp], questionCount);
    if (localTopUp.length > 0) {
      warnings.push(
        `Local fallback ашиглаад ${localTopUp.length} асуултыг бодлогоос автоматаар нөхлөө.`,
      );
    }
  }

  const preferAdvancedMockTopUp = shouldPreferAdvancedMockTopUp({
    fallbackDifficulty,
    grade,
  });

  if (questions.length < questionCount && preferAdvancedMockTopUp) {
    const mockTopUp = buildMockSolvedQuestions(
      selectedExerciseProblems,
      questionCount - questions.length,
      questions.length + 2000,
      {
        fallbackDifficulty,
        grade,
      },
    );
    questions = [...questions, ...mockTopUp].slice(0, questionCount);
    if (mockTopUp.length > 0) {
      warnings.push(
        `Тестийн тоог гүйцээхийн тулд ${mockTopUp.length} mock асуултаар нөхлөө.`,
      );
    }
  }

  if (questions.length < questionCount) {
    const usedProblemKeys = questions
      .map((question) => normalizeQuestionProblemKey(question))
      .filter(Boolean);
    const repeatedTopUp = buildRepeatedSolvedQuestions(
      selectedExerciseProblems,
      questionCount - questions.length,
      questions.length + 1000,
      usedProblemKeys,
      true,
    );
    questions = dedupeQuestionsByProblem([...questions, ...repeatedTopUp], questionCount).slice(
      0,
      questionCount,
    );
    if (repeatedTopUp.length > 0) {
      warnings.push(
        `Тестийн тоог гүйцээхийн тулд ${repeatedTopUp.length} асуултыг давтан fallback-р нөхлөө.`,
      );
    }
  }

  if (questions.length < questionCount && !preferAdvancedMockTopUp) {
    const mockTopUp = buildMockSolvedQuestions(
      selectedExerciseProblems,
      questionCount - questions.length,
      questions.length + 2000,
      {
        fallbackDifficulty,
        grade,
      },
    );
    questions = [...questions, ...mockTopUp].slice(0, questionCount);
    if (mockTopUp.length > 0) {
      warnings.push(
        `Тестийн тоог гүйцээхийн тулд ${mockTopUp.length} mock асуултаар нөхлөө.`,
      );
    }
  }

  const fittedDifficultyCounts = fitDifficultyCountsToTotal(
    options.difficultyCounts,
    questionCount,
    fallbackDifficulty,
  );
  questions = assignDifficultyToQuestions(
    questions.slice(0, questionCount),
    fittedDifficultyCounts,
    fallbackDifficulty,
  );

  const {
    mockCount: mockOpenQuestionCount,
    tasks: openQuestions,
  } = buildOpenEndedTasks(
    selectedExerciseProblems,
    openQuestionCount,
    fitDifficultyCountsToTotal(options.difficultyCounts, openQuestionCount, fallbackDifficulty),
    fallbackDifficulty,
    totalScore,
    {
      grade,
    },
  );

  if (droppedByDuplicate > 0) {
    warnings.push(`Давхардсан ${droppedByDuplicate} асуултыг автоматаар хаслаа.`);
  }
  if (questionCount > questions.length) {
    warnings.push(
      `Хүссэн ${questionCount} асуултаас ${questions.length}-ийг л бүрдүүлж чадлаа.`,
    );
  }
  if (openQuestionCount > openQuestions.length) {
    warnings.push(
      `Хүссэн ${openQuestionCount} задгай даалгавраас ${openQuestions.length}-ийг л бүрдүүлж чадлаа.`,
    );
  }
  if (mockOpenQuestionCount > 0) {
    warnings.push(
      `Задгай даалгаврын ${mockOpenQuestionCount}-ийг 9-р ангийн түвшинд тааруулсан mock бодлогоор нөхлөө.`,
    );
  }
  if (!questions.length && !openQuestions.length) {
    throw new Error("Сонгосон тохиргоогоор тестийн асуултуудыг бүрдүүлж чадсангүй.");
  }

  return {
    questions,
    openQuestions,
    warnings,
    sourcePages: visiblePages.map((page) => page.pageNumber),
    questionCountGenerated: questions.length,
    openQuestionCountGenerated: openQuestions.length,
    exerciseProblemCount: selectedExerciseProblems.length,
    totalScore,
    difficultyCountsApplied: fittedDifficultyCounts,
  };
}
