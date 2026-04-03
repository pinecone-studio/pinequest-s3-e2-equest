import type { MaterialBuilderSubject } from "./api";
import type { TextbookSectionTreeNode } from "./types";

const ROMAN_NUMERALS = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
] as const;

type CuratedChapterTitleMock = {
  chapterTitle: string;
  sectionTitles: string[];
};

const CURATED_TITLE_MOCKS: Partial<
  Record<MaterialBuilderSubject, Partial<Record<number, CuratedChapterTitleMock[]>>>
> = {
  math: {
    9: [
      {
        chapterTitle: "Тоон илэрхийлэл ба квадрат язгуур",
        sectionTitles: [
          "Рационал тоон илэрхийлэл",
          "Квадрат язгуурын тодорхойлолт",
          "Язгуур агуулсан илэрхийлэл хувиргах",
          "Ойролцоо утга ба стандарт хэлбэр",
        ],
      },
      {
        chapterTitle: "Олон гишүүнт ба алгебрын задлал",
        sectionTitles: [
          "Нэг гишүүнт ба олон гишүүнт",
          "Товчилсон үржвэрийн томьёо",
          "Ерөнхий үржүүлэгчээр задлах",
          "Бүлэглэх аргаар задлах",
        ],
      },
      {
        chapterTitle: "Шугаман тэгшитгэл ба тэнцэтгэл биш",
        sectionTitles: [
          "Нэг хувьсагчтай шугаман тэгшитгэл",
          "Шугаман тэнцэтгэл биш",
          "Хоёр хувьсагчтай шугаман систем",
          "Үгэн бодлогын математик загвар",
        ],
      },
      {
        chapterTitle: "Квадрат тэгшитгэл",
        sectionTitles: [
          "Квадрат тэгшитгэлийн үндсэн хэлбэр",
          "Дискриминант",
          "Виетийн теорем",
          "Квадрат тэгшитгэлийн хэрэглээ",
        ],
      },
      {
        chapterTitle: "Функц ба график",
        sectionTitles: [
          "Функцийн ойлголт",
          "Шугаман функцийн график",
          "Квадрат функцийн график",
          "График ашиглан бодлого бодох",
        ],
      },
      {
        chapterTitle: "Геометр ба төсөө",
        sectionTitles: [
          "Гурвалжны төсөө",
          "Төсөөний коэффициент",
          "Пифагорын теорем",
          "Геометрийн хэрэглээт бодлого",
        ],
      },
      {
        chapterTitle: "Тойрог, статистик ба магадлал",
        sectionTitles: [
          "Тойргийн төв ба багтсан өнцөг",
          "Өгөгдөл боловсруулах",
          "Дундаж, медиан, моод",
          "Энгийн магадлал",
        ],
      },
    ],
  },
};

const CHAPTER_TOPIC_MOCKS: Record<MaterialBuilderSubject, Record<number, string[]>> = {
  chemistry: {
    10: [
      "Атомын бүтэц",
      "Химийн холбоо",
      "Химийн урвал",
      "Уусмал",
      "Исэлдэн ангижрах урвал",
      "Органик химийн үндэс",
    ],
    11: [
      "Органик химийн үндэс",
      "Нүүрсустөрөгч",
      "Хүчилтөрөгч агуулсан нэгдэл",
      "Азот агуулсан нэгдэл",
      "Полимер нэгдэл",
      "Биохими",
    ],
    12: [
      "Термодинамик",
      "Химийн кинетик",
      "Химийн тэнцвэр",
      "Электрохими",
      "Материал судлал",
      "Хэрэглээний хими",
    ],
  },
  math: {
    10: [
      "Тэгшитгэл, тэнцэтгэл биш",
      "Олон гишүүнт ба алгебрын илэрхийлэл",
      "Функц ба график",
      "Тригонометр",
      "Комбинаторик ба магадлал",
      "Статистик",
    ],
    11: [
      "Функц, тэгшитгэл",
      "Тригонометр функц",
      "Вектор ба координат",
      "Огторгуйн геометр",
      "Дараалал ба прогресс",
      "Магадлал ба статистик",
    ],
    12: [
      "Уламжлал",
      "Уламжлалын хэрэглээ",
      "Интеграл",
      "Интегралын хэрэглээ",
      "Комплекс тоо",
      "Магадлал ба статистик",
    ],
  },
  physics: {
    10: [
      "Механик хөдөлгөөн",
      "Хүч ба Ньютоны хуулиуд",
      "Ажил, энерги, чадал",
      "Молекул физик",
      "Дулааны үзэгдэл",
      "Цахилгаан",
    ],
    11: [
      "Цахилгаан орон",
      "Гүйдэл ба хэлхээ",
      "Соронзон орон",
      "Цахилгаан соронзон индукц",
      "Хэлбэлзэл",
      "Долгион",
    ],
    12: [
      "Гэрэл ба оптик",
      "Квант физик",
      "Атомын бүтэц",
      "Цөмийн физик",
      "Харьцангуйн үндэс",
      "Орчин үеийн физик",
    ],
  },
};

const GENERIC_CHAPTER_TOPICS = [
  "Үндсэн ойлголт",
  "Томьёо ба дүрэм",
  "Жишээ бодлого",
  "Дасгал ба хэрэглээ",
  "Бататгал",
  "Нэмэлт сэдэв",
] as const;

const GENERIC_SECTION_TOPICS = [
  "Үндсэн ойлголт",
  "Тодорхойлолт ба шинж чанар",
  "Томьёо ба хэрэглээ",
  "Жишээ бодлого",
  "Дасгал ба бататгал",
  "Нэмэлт дасгал",
] as const;

const GENERIC_SUBSECTION_TOPICS = [
  "Тайлбар",
  "Жишээ",
  "Бодолт",
  "Дасгал",
  "Бататгал",
] as const;

function normalizeText(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function toRoman(value: number) {
  return ROMAN_NUMERALS[value] || String(value);
}

function getCuratedChapterMock(
  subject: MaterialBuilderSubject,
  grade: number,
  chapterIndex: number,
) {
  const chapters = CURATED_TITLE_MOCKS[subject]?.[grade];
  if (!chapters || chapters.length === 0) {
    return null;
  }

  return chapters[(chapterIndex - 1) % chapters.length] || null;
}

function getSubjectGradeChapterTopics(subject: MaterialBuilderSubject, grade: number) {
  const subjectTopics = CHAPTER_TOPIC_MOCKS[subject];
  return (
    subjectTopics[grade] ||
    subjectTopics[12] ||
    subjectTopics[11] ||
    subjectTopics[10] ||
    [...GENERIC_CHAPTER_TOPICS]
  );
}

function shouldForceCuratedTitles(subject: MaterialBuilderSubject, grade: number) {
  return Boolean(CURATED_TITLE_MOCKS[subject]?.[grade]?.length);
}

function isPlaceholderChapterTitle(title: string, bookTitle: string) {
  const normalized = normalizeText(title);
  if (!normalized) {
    return true;
  }

  const normalizedBookTitle = normalizeText(bookTitle);
  if (normalizedBookTitle && normalized.startsWith(normalizedBookTitle)) {
    return true;
  }

  return (
    /^бүлэг\s*[ivx0-9]+$/i.test(title.trim()) ||
    /^chapter\s*\d+$/i.test(title.trim()) ||
    /бүлэг\s*\d+$/i.test(normalized) ||
    normalized.includes("нийт агуулга")
  );
}

function isPlaceholderSectionTitle(title: string) {
  const normalized = normalizeText(title);
  if (!normalized) {
    return true;
  }

  return (
    /^сэдэв\s*\d+$/i.test(title.trim()) ||
    /^дэд\s*сэдэв\s*\d+$/i.test(title.trim()) ||
    /^section\s*\d+$/i.test(title.trim()) ||
    /^subchapter\s*\d+$/i.test(title.trim()) ||
    normalized === "нийт агуулга"
  );
}

function getMockChapterTitle(subject: MaterialBuilderSubject, grade: number, chapterIndex: number) {
  const curated = getCuratedChapterMock(subject, grade, chapterIndex);
  if (curated?.chapterTitle) {
    return `БҮЛЭГ ${toRoman(chapterIndex)}. ${curated.chapterTitle}`;
  }

  const topics = getSubjectGradeChapterTopics(subject, grade);
  const topic = topics[(chapterIndex - 1) % topics.length] || GENERIC_CHAPTER_TOPICS[0];
  return `БҮЛЭГ ${toRoman(chapterIndex)}. ${topic}`;
}

function getMockSectionTitle(
  subject: MaterialBuilderSubject,
  grade: number,
  chapterIndex: number,
  sectionIndex: number,
) {
  const curated = getCuratedChapterMock(subject, grade, chapterIndex);
  const curatedTitle =
    curated?.sectionTitles[(sectionIndex - 1) % (curated?.sectionTitles.length || 1)];
  if (curatedTitle) {
    return `${chapterIndex}.${sectionIndex} ${curatedTitle}`;
  }

  const topic =
    GENERIC_SECTION_TOPICS[(sectionIndex - 1) % GENERIC_SECTION_TOPICS.length] ||
    GENERIC_SECTION_TOPICS[0];
  return `${chapterIndex}.${sectionIndex} ${topic}`;
}

function getMockSubchapterTitle(
  chapterIndex: number,
  sectionIndex: number,
  subchapterIndex: number,
) {
  const topic =
    GENERIC_SUBSECTION_TOPICS[(subchapterIndex - 1) % GENERIC_SUBSECTION_TOPICS.length] ||
    GENERIC_SUBSECTION_TOPICS[0];
  return `${chapterIndex}.${sectionIndex}.${subchapterIndex} ${topic}`;
}

function mapNodeDisplayTitle(
  node: TextbookSectionTreeNode,
  options: {
    bookTitle: string;
    chapterIndex: number;
    grade: number;
    sectionIndex: number;
    subject: MaterialBuilderSubject;
    subchapterIndex: number;
  },
): string {
  if (node.nodeType === "chapter") {
    return shouldForceCuratedTitles(options.subject, options.grade) ||
      isPlaceholderChapterTitle(node.title, options.bookTitle)
      ? getMockChapterTitle(options.subject, options.grade, options.chapterIndex)
      : node.title;
  }

  if (node.nodeType === "section") {
    return shouldForceCuratedTitles(options.subject, options.grade) ||
      isPlaceholderSectionTitle(node.title)
      ? getMockSectionTitle(
          options.subject,
          options.grade,
          options.chapterIndex,
          options.sectionIndex,
        )
      : node.title;
  }

  return isPlaceholderSectionTitle(node.title)
    ? getMockSubchapterTitle(
        options.chapterIndex,
        options.sectionIndex,
        options.subchapterIndex,
      )
    : node.title;
}

function mapDisplayTree(
  nodes: TextbookSectionTreeNode[],
  options: {
    bookTitle: string;
    grade: number;
    subject: MaterialBuilderSubject;
  },
  parentContext?: {
    chapterIndex: number;
    sectionIndex: number;
  },
): TextbookSectionTreeNode[] {
  return nodes.map((node, index) => {
    const chapterIndex =
      node.nodeType === "chapter"
        ? index + 1
        : parentContext?.chapterIndex || 1;
    const sectionIndex =
      node.nodeType === "section"
        ? index + 1
        : parentContext?.sectionIndex || 1;
    const subchapterIndex = node.nodeType === "subchapter" ? index + 1 : 1;

    return {
      ...node,
      children: mapDisplayTree(
        node.children,
        options,
        {
          chapterIndex,
          sectionIndex,
        },
      ),
      title: mapNodeDisplayTitle(node, {
        bookTitle: options.bookTitle,
        chapterIndex,
        grade: options.grade,
        sectionIndex,
        subject: options.subject,
        subchapterIndex,
      }),
    };
  });
}

export function applyTextbookDisplayTitleFallbacks(
  nodes: TextbookSectionTreeNode[],
  options: {
    bookTitle?: string | null;
    grade: number;
    subject: MaterialBuilderSubject;
  },
) {
  return mapDisplayTree(nodes, {
    bookTitle: String(options.bookTitle || ""),
    grade: options.grade,
    subject: options.subject,
  });
}
