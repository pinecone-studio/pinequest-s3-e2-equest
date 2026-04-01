import {
  BookOpen,
  Database,
  FileUp,
  FileText,
  Files,
  Keyboard,
  Table2,
} from "lucide-react";

export const sourceOptions = [
  {
    id: "question-bank",
    icon: Keyboard,
    label: "Гараар",
  },
  {
    id: "textbook",
    icon: BookOpen,
    label: "Ном",
  },
  {
    id: "import",
    icon: FileUp,
    label: "Файл",
  },
  {
    id: "shared-library",
    icon: Database,
    label: "Нэгдсэн сангаас ашиглах",
  },
] as const;

export type MaterialSourceId = (typeof sourceOptions)[number]["id"];

export const fieldClassName =
  "!h-[40px] w-full rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
export const fieldWrapperClassName = "flex min-w-0 flex-col gap-2";
export const optionFieldClassName =
  "!h-[40px] w-full rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
export const textareaClassName =
  "min-h-[102px] resize-none rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 py-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
export const explanationClassName =
  "min-h-[154px] resize-none rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 py-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";

export const answerOptions = [
  { id: "answer-1", value: "3" },
  { id: "answer-2", value: "4" },
  { id: "answer-3", value: "5" },
  { id: "answer-4", value: "6" },
] as const;

export const importOptions = [
  { id: "word", icon: FileText, label: "Word" },
  { id: "pdf", icon: Files, label: "PDF" },
  { id: "excel", icon: Table2, label: "Excel" },
] as const;

export const textbookSections = [
  {
    id: "chapter-1",
    title: "БҮЛЭГ I. Тэгшитгэл, тэнцэтгэл биш",
    lessons: [
      { id: "1.1", label: "1.1 Тооны модул", active: true },
      { id: "1.2", label: "1.2 Модул агуулсан тэгшитгэл", active: true },
      { id: "1.3", label: "1.3 Модул агуулсан тэнцэтгэл биш" },
    ],
  },
  {
    id: "chapter-2",
    title: "БҮЛЭГ II. Тэгшитгэл, тэнцэтгэл биш",
    lessons: [
      { id: "2.1", label: "2.1 Нэг ба олон гишүүнт" },
      { id: "2.2", label: "2.2 Олон гишүүнтийн хуваах үйлдэл" },
      { id: "2.3", label: "2.3 Безугийн теорем" },
      {
        id: "2.4",
        label:
          "2.4 Рационал илэрхийллийг олон гишүүнт болон алгебрын хэлбэр бутархай нийлбэр болгон задлах",
      },
    ],
  },
  { id: "chapter-3", title: "БҮЛЭГ III. Функц ба график" },
  { id: "chapter-4", title: "БҮЛЭГ IV. Функцийн уламжлал" },
  { id: "chapter-5", title: "БҮЛЭГ V. Интеграл" },
  { id: "chapter-6", title: "БҮЛЭГ VI. Магадлал ба статистик" },
  { id: "chapter-7", title: "БҮЛЭГ VII. Комплекс тоо" },
] as const;

export const textbookTypeStats = [
  { label: "Нэг сонголттой", value: 3 },
  { label: "Олон сонголттой", value: 0 },
  { label: "Дараалал", value: 0 },
] as const;

export const textbookDifficultyStats = [
  { label: "Энгийн", value: 2 },
  { label: "Дунд", value: 2 },
  { label: "Хүнд", value: 1 },
] as const;

export const sharedLibraryMaterials = [
  {
    id: "algebra-progress-1",
    title: "Алгебр · Явц-1",
    subject: "Математик",
    grade: "10-р анги",
    examType: "Явцын шалгалт",
    questionCount: 8,
    totalScore: 20,
    updatedAt: "2026.03.28",
    summary:
      "Шугаман тэгшитгэл, рационал илэрхийлэл, задлах арга сэдвийг хамарсан бэлэн материал.",
    contents: [
      {
        id: "algebra-progress-1-core",
        title: "Үндсэн тест",
        type: "Нэг сонголттой",
        difficulty: "Энгийн",
        questionCount: 5,
        score: 10,
        description:
          "Шугаман тэгшитгэл ба илэрхийлэл хялбаршуулах 5 богино тест асуулт.",
        previewFocus: "Сэргээн санах",
        previewPrompt: "2x + 5 = 13 тэгшитгэлийн шийдийг олно уу.",
        previewAnswers: ["x = 3", "x = 4", "x = 5", "x = 6"],
        previewExplanation: `Бодолт:
1. 5-ыг нөгөө тал руу шилжүүлнэ: 2x = 8
2. Хоёр талын 2-т хуваана: x = 4
3. Иймээс зөв хариулт нь x = 4 байна.`,
      },
      {
        id: "algebra-progress-1-practice",
        title: "Бодлогын хэсэг",
        type: "Задгай",
        difficulty: "Дунд",
        questionCount: 2,
        score: 6,
        description:
          "Алхамтай бодолт шаардах 2 задгай даалгавар, тайлбарын rubric-тай.",
        previewFocus: "Дасгалын",
        previewPrompt:
          "x² - 5x + 6 = 0 тэгшитгэлийг задлан бодоод шийдүүдийг нь сонгоно уу.",
        previewAnswers: ["x = 1, 6", "x = 2, 3", "x = -2, -3", "x = 0, 6"],
        previewExplanation: `x² - 5x + 6 = (x - 2)(x - 3) гэж задлагдана.
Үүнээс x = 2 болон x = 3 гэсэн хоёр шийд гарна.
Задгай бодлогын хувьд сурагч задлалт болон шалгалтын алхмаа бүрэн харуулах ёстой.`,
      },
      {
        id: "algebra-progress-1-review",
        title: "Давтлагын блок",
        type: "Сэргээн санах",
        difficulty: "Энгийн",
        questionCount: 1,
        score: 4,
        description:
          "Гол томьёо, дүрэм сэргээх 1 багц асуулт, хурдан шалгалтад тохиромжтой.",
        previewFocus: "Ойлголтын",
        previewPrompt:
          "a² - b² илэрхийллийг зөв задласан хувилбарыг сонгоно уу.",
        previewAnswers: [
          "(a - b)²",
          "(a + b)²",
          "(a - b)(a + b)",
          "2ab",
        ],
        previewExplanation: `Квадратуудын ялгаврын томьёо нь a² - b² = (a - b)(a + b).
Энэ төрлийн асуулт нь дүрэм, томьёог сэргээн санах чадварыг шалгана.`,
      },
    ],
  },
  {
    id: "geometry-midterm",
    title: "Геометр · Дунд шалгалт",
    subject: "Математик",
    grade: "11-р анги",
    examType: "Дунд шалгалт",
    questionCount: 12,
    totalScore: 30,
    updatedAt: "2026.03.25",
    summary:
      "Гурвалжин, тойрог, талбай, харьцааны сэдвүүдийг хамарсан дунд шатны шалгалтын материал.",
    contents: [
      {
        id: "geometry-midterm-theory",
        title: "Онолын асуултууд",
        type: "Олон сонголттой",
        difficulty: "Дунд",
        questionCount: 6,
        score: 12,
        description:
          "Тодорхойлолт, шинж чанар, дүрмийн ойлголтыг шалгах тестүүд.",
        previewFocus: "Ойлголтын",
        previewPrompt:
          "Адил хажуут гурвалжны суурийн өнцгүүдийн талаар зөв өгүүлбэрийг сонгоно уу.",
        previewAnswers: [
          "Суурийн өнцгүүд тэнцүү байна",
          "Зөвхөн нэг өнцөг нь 90° байна",
          "Бүх тал нь тэнцүү байна",
          "Оргилын өнцөг заавал хурц байна",
        ],
        previewExplanation: `Адил хажуут гурвалжинд тэнцүү хоёр талын эсрэг орших суурийн өнцгүүд тэнцүү байдаг.
Энэ нь геометрийн үндсэн шинж чанарын нэг юм.`,
      },
      {
        id: "geometry-midterm-proof",
        title: "Баталгаа ба тайлбар",
        type: "Задгай",
        difficulty: "Хүнд",
        questionCount: 3,
        score: 9,
        description:
          "Баталгаа бичүүлэх болон шийдлийн логик тайлбар шаардсан асуултууд.",
        previewFocus: "Баталгаа",
        previewPrompt:
          "Параллель хоёр шулууг сүлбэсэн шулуу үүсгэх ижил өнцгүүд тэнцүү болохыг тайлбарласан зөв дүгнэлтийг сонгоно уу.",
        previewAnswers: [
          "Тэдгээр нь харгалзах өнцгүүд тул тэнцүү",
          "Нийлбэр нь 90° тул тэнцүү",
          "Зөвхөн зураг дээр адил харагдаж байна",
          "Шулууны уртаас хамаарч өөрчлөгдөнө",
        ],
        previewExplanation: `Параллель шулуунуудыг сүлбэсэн үед харгалзах өнцгүүд тэнцүү байдаг.
Задгай хэсэгт сурагч зөв теорем нэрлээд, дүрслэлтэй холбож тайлбарлах шаардлагатай.`,
      },
      {
        id: "geometry-midterm-application",
        title: "Хэрэглээний бодлого",
        type: "Холимог",
        difficulty: "Дунд",
        questionCount: 3,
        score: 9,
        description:
          "Зураглал, бодит нөхцөлтэй холбосон хэрэглээний 3 бодлого.",
        previewFocus: "Хэрэглээний",
        previewPrompt:
          "Тэгш өнцөгт гурвалжны катетууд 6 см, 8 см бол гипотенузын уртыг олно уу.",
        previewAnswers: ["10 см", "12 см", "14 см", "48 см"],
        previewExplanation: `Пифагорын теоремоор c² = 6² + 8² = 36 + 64 = 100.
Тиймээс c = 10 см байна.`,
      },
    ],
  },
  {
    id: "calculus-final-prep",
    title: "Уламжлал · Эцсийн бэлтгэл",
    subject: "Математик",
    grade: "12-р анги",
    examType: "Эцсийн шалгалт",
    questionCount: 10,
    totalScore: 25,
    updatedAt: "2026.03.18",
    summary:
      "Функцийн уламжлал, хэрэглээ, график шинжилгээг хамарсан эцсийн шалгалтын бэлтгэлийн сан.",
    contents: [
      {
        id: "calculus-final-prep-rules",
        title: "Дүрэм ба томьёо",
        type: "Нэг сонголттой",
        difficulty: "Энгийн",
        questionCount: 4,
        score: 8,
        description:
          "Уламжлалын үндсэн дүрэм, томьёоны хэрэглээг шалгах багц.",
        previewFocus: "Сэргээн санах",
        previewPrompt: "f(x) = x³ функцийн уламжлалыг сонгоно уу.",
        previewAnswers: ["x²", "3x²", "3x", "x³"],
        previewExplanation: `Хүчний дүрмээр d/dx(xⁿ) = nxⁿ⁻¹.
Иймээс d/dx(x³) = 3x² байна.`,
      },
      {
        id: "calculus-final-prep-graph",
        title: "График шинжилгээ",
        type: "Холимог",
        difficulty: "Дунд",
        questionCount: 3,
        score: 9,
        description:
          "Өсөх буурах, экстремум, муруйн шинжилгээтэй асуултууд.",
        previewFocus: "Ойлголтын",
        previewPrompt:
          "f'(x) > 0 бүх x дээр биелж байвал функцийн талаар аль нь зөв бэ?",
        previewAnswers: [
          "Бүхэлдээ өсөх функц байна",
          "Бүхэлдээ буурах функц байна",
          "Тогтмол функц байна",
          "Экстремум бүртээ тэг болно",
        ],
        previewExplanation: `Уламжлал эерэг байвал функц тухайн муж дээр өснө.
Ийм төрлийн асуулт нь графикийн шинжилгээний үндсэн ойлголтыг шалгана.`,
      },
      {
        id: "calculus-final-prep-open",
        title: "Өргөтгөсөн задгай",
        type: "Задгай",
        difficulty: "Хүнд",
        questionCount: 3,
        score: 8,
        description:
          "Нийлмэл функц ба хэрэглээний бодлогуудтай задгай асуултууд.",
        previewFocus: "Дасгалын",
        previewPrompt:
          "f(x) = (2x + 1)⁴ функцийн уламжлалыг гинжин дүрмээр бодоход зөв хариу аль нь вэ?",
        previewAnswers: [
          "4(2x + 1)³",
          "8(2x + 1)³",
          "8(2x + 1)⁴",
          "(2x + 1)³",
        ],
        previewExplanation: `Гинжин дүрмээр d/dx[(2x + 1)⁴] = 4(2x + 1)³ · 2.
Иймээс зөв хариу нь 8(2x + 1)³ байна.
Задгай хэсэгт дотор функцийн уламжлалыг тусад нь заавал үзүүлэх шаардлагатай.`,
      },
    ],
  },
] as const;

export type SharedLibraryMaterial = (typeof sharedLibraryMaterials)[number];
export type SharedLibraryContent = SharedLibraryMaterial["contents"][number];
