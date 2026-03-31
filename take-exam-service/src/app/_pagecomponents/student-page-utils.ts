import type { TeacherTestSummary } from "@/lib/exam-service/types";

export const getSebFriendlyWarning = (message?: string) => {
  if (message?.includes("илрээгүй")) {
    return {
      title: "😅 SEB маань харагдсангүй",
      description:
        "🛡️ Шалгалт эхлэхийн өмнө Safe Exam Browser-ээр нээгээд ахиад нэг дарчихъя. Одоогоор энгийн browser-оос орж ирсэн юм шиг байна.",
    };
  }

  if (message?.includes("session")) {
    return {
      title: "🤹 SEB session жаахан зөрөөд байна",
      description:
        "🔐 Зөв SEB session-ээр дахин нээгээд орж ирвэл шалгалт шууд үргэлжилнэ. Жаахан эрхлээд буруу хаалга тогшчихсон бололтой.",
    };
  }

  if (message?.includes("version")) {
    return {
      title: "🫣 SEB version жаахан хоцорчээ",
      description:
        "⬆️ Safe Exam Browser-ээ шинэчлээд дахин орж ирээрэй. Тэгвэл шалгалт чинь төвөггүй нээгдэнэ.",
    };
  }

  return {
    title: "🙂 Жижигхэн анхааруулга",
    description:
      message ||
      "🛡️ Safe Exam Browser шалгалт түр амжилтгүй боллоо. Дахиад нэг оролдоод үзье.",
  };
};

export const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const formatTimeLeft = (ms: number) => {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const testKey = (test: TeacherTestSummary) =>
  `${test.criteria.subject}-${test.criteria.topic}-${test.title}`.toLowerCase();

const normalizeClassSegment = (value: string) =>
  value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/АНГИ|БҮЛЭГ|CLASS/gi, "")
    .trim();

const extractGrade = (value: string) => value.match(/\d+/)?.[0] ?? "";

const parseClassTargets = (value?: string | null) => {
  const normalized = normalizeClassSegment(value ?? "");
  if (!normalized) {
    return [];
  }

  const directParts = normalized
    .split(/[\/,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const expanded = new Set<string>();

  for (const part of directParts) {
    const partGrade = extractGrade(part);
    const partLetters = [...part.replace(/\d+/g, "").matchAll(/[A-ZА-ЯӨҮЁ]/g)].map(
      (match) => match[0],
    );

    if (partGrade && partLetters.length > 1) {
      for (const letter of partLetters) {
        expanded.add(`${partGrade}${letter}`);
      }
      continue;
    }

    if (partGrade && partLetters.length === 1) {
      expanded.add(`${partGrade}${partLetters[0]}`);
      continue;
    }

    if (partGrade) {
      expanded.add(partGrade);
      continue;
    }

    if (partLetters.length > 0) {
      for (const letter of partLetters) {
        expanded.add(letter);
      }
    }
  }

  if (expanded.size > 0) {
    return [...expanded];
  }

  return [normalized];
};

export const matchesStudentClassGroup = (
  studentClassName?: string | null,
  testClassName?: string | null,
  testGradeLevel?: number | null,
) => {
  const studentNormalized = normalizeClassSegment(studentClassName ?? "");
  if (!studentNormalized) {
    return true;
  }

  const studentGrade = extractGrade(studentNormalized);
  const studentLetters = [...studentNormalized.replace(/\d+/g, "").matchAll(/[A-ZА-ЯӨҮЁ]/g)].map(
    (match) => match[0],
  );

  const testTargets = parseClassTargets(testClassName);
  if (testTargets.length > 0) {
    if (testTargets.includes(studentNormalized)) {
      return true;
    }

    if (
      studentGrade &&
      studentLetters.length > 0 &&
      testTargets.includes(`${studentGrade}${studentLetters[0]}`)
    ) {
      return true;
    }

    if (studentGrade && testTargets.includes(studentGrade)) {
      return true;
    }
  }

  if (typeof testGradeLevel === "number" && studentGrade) {
    return Number(studentGrade) === testGradeLevel;
  }

  return false;
};

export const estimateDurationMinutes = (test: TeacherTestSummary) => {
  const subject = test.criteria.subject.toLowerCase();
  if (subject.includes("физик")) return 90;
  if (subject.includes("англи")) return 30;
  return Math.max(30, Math.min(120, test.criteria.questionCount * 5));
};

export const formatQuestionPrompt = (value?: string | null) =>
  (value ?? "")
    .replace(/^\s*(?:Q(?:uestion)?\s*)?\d+\s*[\).:-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
