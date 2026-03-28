export type ExamSessionSubject = "math" | "physics" | "mongolian";

export type ExamSessionExamType =
  | "progress"
  | "term"
  | "year_final"
  | "practice";

export type ExamSessionMetadata = {
  grade: number | null;
  groupClass: string;
  examType: ExamSessionExamType | null;
  subject: ExamSessionSubject | null;
  /** Сонгосон сэдвүүд (харуулах текст) */
  topics: string[];
  /** Багшийн ID (сонголттой; AI scheduler) */
  teacherId: string;
  /** Өрөөний ID (сонголттой; AI scheduler) */
  roomId: string;
  /** Шалгалтын эхлэх огноо YYYY-MM-DD (сонголттой; AI scheduler дараа бөглөгдөнө) */
  examDate: string;
  /** HH:mm (сонголттой) */
  startTime: string;
  /** HH:mm */
  endTime: string;
  /** Минут */
  durationMinutes: number | null;
  /** Даалгаврыг холих */
  mixQuestions: boolean;
  /** Хувилбартай */
  withVariants: boolean;
  /** Хувилбарын тоо (withVariants үед) */
  variantCount: number | null;
  /** Нэмэлт тайлбар */
  description: string;
};

export const EXAM_TYPE_LABELS: { value: ExamSessionExamType; label: string }[] =
  [
    { value: "progress", label: "Явцын" },
    { value: "term", label: "Улирлын" },
    { value: "year_final", label: "Жилийн эцсийн" },
    { value: "practice", label: "Давтлага шалгалт" },
  ];

export const SUBJECT_OPTIONS: { value: ExamSessionSubject; label: string }[] = [
  { value: "math", label: "Математик" },
];

export const TOPICS_BY_SUBJECT: Record<ExamSessionSubject, string[]> = {
  math: [
    "Квадрат тэгшитгэл",
    "Пифагорын теорем",
    "Квадрат язгуур",
    "Зэрэг ба түүний чанар",
    "Шугаман тэгшитгэл",
    "Функц ба график",
    "Гурвалжны төсөө",
    "Тойрог ба өнцөг",
  ],
  physics: [
    "Хөдөлгөөн",
    "Хүч, Ньютоны хууль",
    "Энерги, ажил",
    "Даралт",
    "Цахилгаан",
    "Гэрэл",
  ],
  mongolian: [
    "Зохиол зүй",
    "Хэл зүй",
    "Үг зүй",
    "Өгүүлбэр зүй",
    "Уран зохиол",
    "Яруу найраг",
    "Өгүүлэл, эссэ",
    "Гоцлол үг",
    "Үгийн гарал",
  ],
};

export const GRADE_OPTIONS = [7, 8, 9, 10, 11] as const;

export function groupOptionsForGrade(grade: number): string[] {
  const letters = ["A", "B", "C", "D"] as const;
  return letters.map((l) => `${grade}${l}`);
}

export function createDefaultExamSessionMetadata(): ExamSessionMetadata {
  return {
    grade: null,
    groupClass: "",
    examType: null,
    subject: null,
    topics: [],
    teacherId: "",
    roomId: "",
    examDate: "",
    startTime: "",
    endTime: "",
    durationMinutes: null,
    mixQuestions: false,
    withVariants: false,
    variantCount: null,
    description: "",
  };
}

const STORAGE_KEY = "pinequest-exam-session-metadata";

/** v2: { v:2, examTitle, metadata } — v1: зөвхөн ExamSessionMetadata JSON */
type StoredV2 = {
  v: 2;
  examTitle: string;
  metadata: ExamSessionMetadata;
};

function mergeStoredMetadata(
  partial: Partial<ExamSessionMetadata>,
): ExamSessionMetadata {
  const d = createDefaultExamSessionMetadata();
  return {
    ...d,
    ...partial,
    topics: Array.isArray(partial.topics) ? partial.topics : d.topics,
  };
}

function isExamSessionMetadataShape(x: unknown): x is Partial<ExamSessionMetadata> {
  return typeof x === "object" && x !== null;
}

export function loadExamSessionSnapshot(): {
  metadata: ExamSessionMetadata;
  examTitle: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "v" in parsed) {
      const v2 = parsed as Partial<StoredV2>;
      if (v2.v === 2 && v2.metadata && typeof v2.examTitle === "string") {
        return {
          metadata: mergeStoredMetadata(
            v2.metadata as Partial<ExamSessionMetadata>,
          ),
          examTitle: v2.examTitle,
        };
      }
    }
    if (isExamSessionMetadataShape(parsed)) {
      return { metadata: mergeStoredMetadata(parsed), examTitle: "" };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveExamSessionSnapshot(
  metadata: ExamSessionMetadata,
  examTitle: string,
) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredV2 = { v: 2, examTitle, metadata };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearExamSessionSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
