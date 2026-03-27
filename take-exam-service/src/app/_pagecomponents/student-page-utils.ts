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

export const estimateDurationMinutes = (test: TeacherTestSummary) => {
  const subject = test.criteria.subject.toLowerCase();
  if (subject.includes("физик")) return 90;
  if (subject.includes("англи")) return 30;
  return Math.max(30, Math.min(120, test.criteria.questionCount * 5));
};
