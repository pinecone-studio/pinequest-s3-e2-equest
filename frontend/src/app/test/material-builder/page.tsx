"use client";

import {
  BookOpen,
  CircleDot,
  ChevronDown,
  Database,
  Download,
  FileText,
  Files,
  Info,
  RefreshCcw,
  Repeat2,
  Search,
  Sparkles,
  Table2,
  WandSparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TestShell } from "../_components/test-shell";

const sourceOptions = [
  {
    id: "question-bank",
    icon: Sparkles,
    label: "Асуулт үүсгэх",
  },
  {
    id: "textbook",
    icon: BookOpen,
    label: "Сурах бичиг",
  },
  {
    id: "import",
    icon: Download,
    label: "Импорт",
  },
  {
    id: "shared-library",
    icon: Database,
    label: "Нэгдсэн сангаас ашиглах",
  },
] as const;

const fieldClassName =
  "!h-[40px] w-full rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
const fieldWrapperClassName = "flex min-w-0 flex-col gap-2";
const optionFieldClassName =
  "!h-[40px] w-full rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
const textareaClassName =
  "min-h-[102px] resize-none rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 py-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
const explanationClassName =
  "min-h-[154px] resize-none rounded-[10px] border-[#e2e8f0] !bg-[#eef3ff] px-3 py-3 text-[14px] text-slate-800 shadow-none hover:!bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-sky-100";
const answerOptions = [
  { id: "answer-1", value: "3" },
  { id: "answer-2", value: "4" },
  { id: "answer-3", value: "5" },
  { id: "answer-4", value: "6" },
] as const;
const importOptions = [
  { id: "word", icon: FileText, label: "Word" },
  { id: "pdf", icon: Files, label: "PDF" },
  { id: "excel", icon: Table2, label: "Excel" },
] as const;
const textbookSections = [
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
const textbookTypeStats = [
  { label: "Нэг сонголттой", value: 3 },
  { label: "Олон сонголттой", value: 0 },
  { label: "Дараалал", value: 0 },
] as const;
const textbookDifficultyStats = [
  { label: "Энгийн", value: 2 },
  { label: "Дунд", value: 2 },
  { label: "Хүнд", value: 1 },
] as const;
const sharedLibraryMaterials = [
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
      },
    ],
  },
] as const;

function TextbookStatField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[15px] font-medium text-slate-900">{label}</p>
      <div className="flex min-h-[44px] items-center justify-between rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
        <span>{value}</span>
      </div>
    </div>
  );
}

function TextbookBadgeField({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-between rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 text-[15px] text-slate-800">
      <span>{label}</span>
      <span className="inline-flex min-w-8 items-center justify-center rounded-[10px] border border-[#c7d3e7] bg-white px-2 py-1 text-[14px]">
        {value}
      </span>
    </div>
  );
}

function TextbookQuestionCard({
  answers,
  content,
  explanation,
}: {
  answers: string[];
  content: ReactNode;
  explanation?: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#e3e9f4] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="grid gap-3 xl:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Select defaultValue="2">
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Тоо" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="single-choice">
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <CircleDot className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Асуултын төрөл" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single-choice">Нэг сонголттой</SelectItem>
            <SelectItem value="multiple-choice">Олон сонголттой</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="easy">
          <SelectTrigger className={optionFieldClassName}>
            <SelectValue placeholder="Түвшин" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Энгийн</SelectItem>
            <SelectItem value="medium">Дунд</SelectItem>
            <SelectItem value="hard">Хүнд</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="shuffle">
          <SelectTrigger className={optionFieldClassName}>
            <span className="flex min-w-0 items-center gap-2">
              <Repeat2 className="h-4 w-4 text-slate-700" />
              <SelectValue placeholder="Сонголт" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shuffle">Сэргээн санах</SelectItem>
            <SelectItem value="concept">Ойлголтын</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">{content}</div>

      <Separator className="my-4 bg-[#e6edf7]" />

      <div>
        <p className="mb-3 text-[14px] font-medium text-slate-800">Хариулт</p>
        <RadioGroup defaultValue={answers[0]} className="gap-3">
          {answers.map((answer, index) => (
            <label
              key={`${answer}-${index}`}
              className="flex min-h-[56px] items-center gap-4 rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 text-[14px] text-slate-800"
            >
              <RadioGroupItem
                value={answer}
                className="border-[#cdd8ea] text-[#0b5cab] data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
              />
              <span>{answer}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {explanation ? (
        <div className="mt-4">
          <p className="mb-3 text-[14px] font-medium text-slate-800">
            Зөв хариултын тайлбар
          </p>
          <Textarea defaultValue={explanation} className={explanationClassName} />
        </div>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-slate-700 transition hover:text-slate-900"
        >
          <RefreshCcw className="h-4 w-4" />
          Дахин үүсгүүлэх
        </button>
      </div>
    </section>
  );
}

function SharedLibraryStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-[#dbe4f3] bg-[#eef3ff] px-4 py-3">
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 text-[16px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function MaterialBuilderPage() {
  const [source, setSource] =
    useState<(typeof sourceOptions)[number]["id"]>("question-bank");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] = useState(
    sharedLibraryMaterials[0]?.id ?? "",
  );
  const selectedSharedMaterial =
    sharedLibraryMaterials.find(
      (material) => material.id === selectedSharedMaterialId,
    ) ?? sharedLibraryMaterials[0];
  const [selectedSharedContentId, setSelectedSharedContentId] = useState(
    sharedLibraryMaterials[0]?.contents[0]?.id ?? "",
  );
  const selectedSharedContent =
    selectedSharedMaterial?.contents.find(
      (content) => content.id === selectedSharedContentId,
    ) ?? selectedSharedMaterial?.contents[0];

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <section className="rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
          <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#b9d7ff] bg-[#eef6ff] text-[#3b82f6]">
              <Info className="h-3 w-3" />
            </span>
            Ерөнхий мэдээлэл
          </div>

          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <div className={fieldWrapperClassName}>
              <Label
                htmlFor="subject"
                className="text-[14px] font-medium text-slate-800"
              >
                Хичээл
              </Label>
              <Select defaultValue="math">
                <SelectTrigger id="subject" className={fieldClassName}>
                  <SelectValue placeholder="Хичээл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="math">Математик</SelectItem>
                  <SelectItem value="physics">Физик</SelectItem>
                  <SelectItem value="chemistry">Хими</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={fieldWrapperClassName}>
              <Label
                htmlFor="classroom"
                className="text-[14px] font-medium text-slate-800"
              >
                Анги
              </Label>
              <Select defaultValue="10">
                <SelectTrigger id="classroom" className={fieldClassName}>
                  <SelectValue placeholder="Анги сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 дугаар анги</SelectItem>
                  <SelectItem value="11">11 дүгээр анги</SelectItem>
                  <SelectItem value="12">12 дугаар анги</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={fieldWrapperClassName}>
              <Label
                htmlFor="exam-type"
                className="text-[14px] font-medium text-slate-800"
              >
                Төрөл
              </Label>
              <Select defaultValue="progress">
                <SelectTrigger id="exam-type" className={fieldClassName}>
                  <SelectValue placeholder="Төрөл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="progress">Явцын</SelectItem>
                  <SelectItem value="midterm">Дунд шалгалт</SelectItem>
                  <SelectItem value="final">Эцсийн шалгалт</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={fieldWrapperClassName}>
              <Label
                htmlFor="exam-name"
                className="text-[14px] font-medium text-slate-800"
              >
                Шалгалтын нэр
              </Label>
              <Input
                id="exam-name"
                defaultValue="Явц-1 Алгебр"
                className={fieldClassName}
              />
            </div>

            <div className={fieldWrapperClassName}>
              <Label
                htmlFor="duration-left"
                className="text-[14px] font-medium text-slate-800"
              >
                Үргэлжлэх минут
              </Label>
              <Select defaultValue="30">
                <SelectTrigger id="duration-left" className={fieldClassName}>
                  <SelectValue placeholder="Хугацаа сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 мин</SelectItem>
                  <SelectItem value="30">30 мин</SelectItem>
                  <SelectItem value="40">40 мин</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={fieldWrapperClassName}>
              <Label
                htmlFor="duration-right"
                className="text-[14px] font-medium text-slate-800"
              >
                Үргэлжлэх минут
              </Label>
              <Select defaultValue="30">
                <SelectTrigger id="duration-right" className={fieldClassName}>
                  <SelectValue placeholder="Хугацаа сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 мин</SelectItem>
                  <SelectItem value="30">30 мин</SelectItem>
                  <SelectItem value="40">40 мин</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-3">
          {sourceOptions.map((option) => {
            const Icon = option.icon;
            const active = source === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSource(option.id)}
                className={`inline-flex h-[42px] items-center gap-2 rounded-[16px] border px-5 text-[14px] font-semibold transition ${
                  active
                    ? "border-[#cfe1ff] bg-white text-[#215da8] shadow-[0_8px_18px_rgba(59,130,246,0.10)]"
                    : "border-[#e3e8f2] bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? "text-[#2563eb]" : "text-[#2563eb]"}`}
                />
                {option.label}
              </button>
            );
          })}
        </div>

        {source === "question-bank" ? (
          <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-6 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
            <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-[#2563eb]" />
              Асуулт үүсгэх
            </div>

            <div className="grid gap-3 xl:grid-cols-[68px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Select defaultValue="2">
                <SelectTrigger className={optionFieldClassName}>
                  <SelectValue placeholder="Тоо" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="single-choice">
                <SelectTrigger className={optionFieldClassName}>
                  <span className="flex min-w-0 items-center gap-2">
                    <CircleDot className="h-4 w-4 text-slate-700" />
                    <SelectValue placeholder="Асуултын төрөл" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-choice">
                    Нэг сонголттой
                  </SelectItem>
                  <SelectItem value="multiple-choice">
                    Олон сонголттой
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="easy">
                <SelectTrigger className={optionFieldClassName}>
                  <SelectValue placeholder="Түвшин" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Энгийн</SelectItem>
                  <SelectItem value="medium">Дунд</SelectItem>
                  <SelectItem value="hard">Хүнд</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="shuffle">
                <SelectTrigger className={optionFieldClassName}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Repeat2 className="h-4 w-4 text-slate-700" />
                    <SelectValue placeholder="Сонголт" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shuffle">Сэргээн санах</SelectItem>
                  <SelectItem value="concept">Ойлголтын</SelectItem>
                  <SelectItem value="practice">Дасгалын</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4">
              <Textarea
                defaultValue="2x+5=13 тэгшитгэлийг бод."
                className={textareaClassName}
              />
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                className="!h-[36px] min-w-[158px] rounded-[10px] border border-[#d6e4fb] bg-[#edf4ff] px-4 text-[#1659a6] hover:bg-[#e5efff]"
              >
                <WandSparkles className="h-4 w-4" />
                Хариулт үүсгэх
              </Button>
            </div>

            <Separator className="my-4 bg-[#e6edf7]" />

            <div>
              <p className="mb-3 text-[14px] font-medium text-slate-800">
                Хариулт
              </p>
              <RadioGroup defaultValue="3" className="gap-3">
                {answerOptions.map((option) => (
                  <label
                    key={option.id}
                    htmlFor={option.id}
                    className="flex min-h-[44px] items-center gap-3 rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-4 text-[14px] text-slate-800"
                  >
                    <RadioGroupItem
                      id={option.id}
                      value={option.value}
                      className="border-[#cdd8ea] text-[#0b5cab] data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                    />
                    <span>{option.value}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="mt-4">
              <Label
                htmlFor="answer-explanation"
                className="mb-3 block text-[14px] font-medium text-slate-800"
              >
                Зөв хариултын тайлбар
              </Label>
              <Textarea
                id="answer-explanation"
                defaultValue={`Бодолт:
1. +5-ыг нөгөө тал руу шилжүүлнэ:
   2x = 13 - 5
2. Хасна:
   2x = 8
3. 2-оор хуваана:
   x = 4`}
                className={explanationClassName}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[14px] font-medium text-slate-700 transition hover:text-slate-900"
              >
                <RefreshCcw className="h-4 w-4" />
                Дахин үүсгүүлэх
              </button>

              <Button
                type="button"
                variant="outline"
                className="!h-[38px] min-w-[140px] rounded-[10px] border-[#0b5cab] bg-white px-5 text-[#0b5cab] hover:bg-[#f4f8ff]"
              >
                Асуулт нэмэх
              </Button>
            </div>
          </section>
        ) : null}

        {source === "import" ? (
          <section className="mt-5 rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-8 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
            <div className="mb-8 flex items-center gap-3 text-[15px] font-semibold text-slate-900">
              <Download className="h-5 w-5 text-[#2563eb]" />
              Импорт
            </div>

            <div>
              <p className="mb-5 text-[18px] font-medium text-slate-900">
                Файл оруулах
              </p>

              <div className="grid gap-4 md:grid-cols-3 md:gap-5">
                {importOptions.map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="flex h-[48px] w-full items-center gap-4 rounded-[12px] border border-[#d9e2f2] bg-[#eef3ff] px-4 text-left text-[16px] font-medium text-slate-800 transition hover:bg-[#e7efff]"
                    >
                      <Icon className="h-5 w-5 text-slate-900" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {source === "textbook" ? (
          <section className="mt-5 space-y-4">
            <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
              <BookOpen className="h-5 w-5 text-[#2563eb]" />
              Сурах бичиг
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[404px_minmax(0,1fr)]">
              <aside className="rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <h3 className="text-[20px] font-semibold text-[#0b5cab]">
                  Математик-12
                </h3>

                <div className="relative mt-4">
                  <Input
                    defaultValue=""
                    placeholder="Хичээлийн сэдвээр хайх"
                    className="!h-[40px] rounded-[12px] border-[#dbe4f3] bg-white pr-10 text-[14px] text-slate-800"
                  />
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="mt-4 space-y-3">
                      {textbookSections.map((section) => (
                        <div key={section.id} className="space-y-3">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={false}
                              className="mt-0.5 h-4 w-4 rounded-[5px] border-[#dbe4f3] bg-white data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                            />
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                              <p className="text-[15px] font-semibold leading-6 text-slate-900">
                                {section.title}
                              </p>
                              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-700" />
                            </div>
                          </div>

                          {section.lessons ? (
                            <div className="space-y-2 pl-7">
                              {section.lessons.map((lesson) => (
                                <label
                                  key={lesson.id}
                                  className="flex items-start gap-3 text-[15px] leading-6 text-slate-900"
                                >
                                  <Checkbox
                                    checked={Boolean(lesson.active)}
                                    className="mt-1 h-4 w-4 rounded-[5px] border-[#dbe4f3] bg-white data-checked:border-[#0b5cab] data-checked:bg-[#0b5cab]"
                                  />
                                  <span>{lesson.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                </div>

                <div className="mt-6 space-y-4">
                  <TextbookStatField label="Тестийн тоо" value="3" />

                  <div className="space-y-2">
                    <p className="text-[15px] font-medium text-slate-900">
                      Тестийн төрлүүд
                    </p>
                    <div className="space-y-3">
                      {textbookTypeStats.map((item) => (
                        <TextbookBadgeField
                          key={item.label}
                          label={item.label}
                          value={item.value}
                        />
                      ))}
                    </div>
                  </div>

                  <TextbookStatField
                    label="Задгай даалгаврын тоо"
                    value="2"
                  />
                  <TextbookStatField label="Нийт оноо" value="10" />

                  <div className="space-y-2">
                    <p className="text-[15px] font-medium text-slate-900">
                      Хүндрэлийн зэрэг
                    </p>
                    <div className="space-y-3">
                      {textbookDifficultyStats.map((item) => (
                        <TextbookBadgeField
                          key={item.label}
                          label={item.label}
                          value={item.value}
                        />
                      ))}
                    </div>
                  </div>

                  <Button className="!h-[44px] w-full rounded-[12px] bg-[#0b5cab] text-[18px] font-semibold hover:bg-[#0a4f96]">
                    <Sparkles className="h-4 w-4" />
                    Шалгалт үүсгэх
                  </Button>
                </div>
              </aside>

              <div className="space-y-5">
                <TextbookQuestionCard
                  answers={["3", "4", "5", "6"]}
                  explanation={`Бодолт:
1. +5-ыг нөгөө тал руу шилжүүлнэ:
   2x = 13 - 5
2. Хасна:
   2x = 8
3. 2-оор хуваана:
   x = 4`}
                  content={
                    <Textarea
                      defaultValue="2x+5=13 тэгшитгэлийг бод."
                      className={textareaClassName}
                    />
                  }
                />

                <TextbookQuestionCard
                  answers={[
                    "1a, 2b, 3c, 4d",
                    "1a, 2b, 3c, 4d",
                    "1a, 2b, 3c, 4d",
                    "1a, 2b, 3c, 4d",
                  ]}
                  content={
                    <div className="rounded-[10px] border border-[#e2e8f0] bg-[#eef3ff] px-5 py-5 text-[15px] text-slate-800">
                      <p className="mb-5 font-medium">
                        Дараах илэрхийлэлүүдийг зөв хариутай нь харгалзуулна уу.
                      </p>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <p className="font-medium">Илэрхийлэл</p>
                          <ol className="space-y-4 pl-5">
                            <li>x²−4</li>
                            <li>√16</li>
                            <li>2³</li>
                            <li>x²+2x+1</li>
                          </ol>
                        </div>
                        <div className="space-y-4">
                          <p className="font-medium">Хариулт</p>
                          <ol className="space-y-4 pl-5">
                            <li>a. (x+1)²</li>
                            <li>b. 4</li>
                            <li>c. 8</li>
                            <li>d. (x−2)(x+2)</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        {source === "shared-library" ? (
          <section className="mt-5 space-y-4">
            <div className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
              <Database className="h-5 w-5 text-[#2563eb]" />
              Нэгдсэн сангаас ашиглах
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[356px_minmax(0,1fr)]">
              <aside className="rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <h3 className="text-[20px] font-semibold text-[#0b5cab]">
                  Өгөгдлийн санд буй материал
                </h3>

                <div className="relative mt-4">
                  <Input
                    defaultValue=""
                    placeholder="Материалын нэрээр хайх"
                    className="!h-[40px] rounded-[12px] border-[#dbe4f3] bg-white pr-10 text-[14px] text-slate-800"
                  />
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="mt-4 space-y-3">
                  {sharedLibraryMaterials.map((material) => {
                    const active = material.id === selectedSharedMaterial?.id;

                    return (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => {
                          setSelectedSharedMaterialId(material.id);
                          setSelectedSharedContentId(
                            material.contents[0]?.id ?? "",
                          );
                        }}
                        className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                          active
                            ? "border-[#cfe1ff] bg-[#f4f8ff] shadow-[0_8px_18px_rgba(59,130,246,0.10)]"
                            : "border-[#e3e9f4] bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[16px] font-semibold text-slate-900">
                              {material.title}
                            </p>
                            <p className="mt-1 text-[13px] text-slate-500">
                              {material.subject} · {material.grade}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[12px] font-medium text-[#215da8]">
                            {material.examType}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-[14px] leading-6 text-slate-600">
                          {material.summary}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {material.questionCount} асуулт
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            {material.totalScore} оноо
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Шинэчлэгдсэн: {material.updatedAt}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {selectedSharedMaterial ? (
                <div className="space-y-5">
                  <section className="rounded-[24px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <p className="text-[14px] font-medium text-[#2563eb]">
                          Сонгосон материал
                        </p>
                        <h3 className="mt-2 text-[24px] font-semibold text-slate-900">
                          {selectedSharedMaterial.title}
                        </h3>
                        <p className="mt-3 text-[15px] leading-7 text-slate-600">
                          {selectedSharedMaterial.summary}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2 text-[13px] text-slate-600">
                          <span className="rounded-full bg-[#eef3ff] px-3 py-1.5">
                            {selectedSharedMaterial.subject}
                          </span>
                          <span className="rounded-full bg-[#eef3ff] px-3 py-1.5">
                            {selectedSharedMaterial.grade}
                          </span>
                          <span className="rounded-full bg-[#eef3ff] px-3 py-1.5">
                            {selectedSharedMaterial.examType}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <SharedLibraryStat
                          label="Нийт асуулт"
                          value={selectedSharedMaterial.questionCount}
                        />
                        <SharedLibraryStat
                          label="Нийт оноо"
                          value={selectedSharedMaterial.totalScore}
                        />
                        <SharedLibraryStat
                          label="Сүүлд шинэчлэгдсэн"
                          value={selectedSharedMaterial.updatedAt}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[18px] font-semibold text-slate-900">
                          Материалын доторх хэсгүүд
                        </h4>
                        <p className="text-[14px] text-slate-500">
                          Зүүн талаас материал сонгоход энд тухайн шалгалтын доторх багцууд гарч ирнэ.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="!h-[38px] rounded-[10px] border-[#0b5cab] bg-white px-4 text-[#0b5cab] hover:bg-[#f4f8ff]"
                      >
                        Сонгосон материалыг ашиглах
                      </Button>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="grid gap-4">
                        {selectedSharedMaterial.contents.map((content, index) => {
                          const active = content.id === selectedSharedContent?.id;

                          return (
                            <button
                              key={content.id}
                              type="button"
                              onClick={() => setSelectedSharedContentId(content.id)}
                              className={`rounded-[18px] border p-4 text-left transition ${
                                active
                                  ? "border-[#cfe1ff] bg-white shadow-[0_8px_18px_rgba(59,130,246,0.10)]"
                                  : "border-[#e3e9f4] bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[15px] font-medium text-[#2563eb]">
                                    Хэсэг {index + 1}
                                  </p>
                                  <h5 className="mt-1 text-[18px] font-semibold text-slate-900">
                                    {content.title}
                                  </h5>
                                </div>
                                <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-[12px] font-medium text-[#215da8]">
                                  {content.type}
                                </span>
                              </div>

                              <p className="mt-3 text-[14px] leading-6 text-slate-600">
                                {content.description}
                              </p>

                              <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-slate-500">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                  Түвшин: {content.difficulty}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                  {content.questionCount} асуулт
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                  {content.score} оноо
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <aside className="rounded-[20px] border border-[#e3e9f4] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <p className="text-[14px] font-medium text-[#2563eb]">
                          Сонгосон дотоод материал
                        </p>
                        <h5 className="mt-2 text-[20px] font-semibold text-slate-900">
                          {selectedSharedContent?.title}
                        </h5>
                        <p className="mt-3 text-[14px] leading-7 text-slate-600">
                          {selectedSharedContent?.description}
                        </p>

                        <div className="mt-5 space-y-3">
                          <TextbookStatField
                            label="Агуулгын төрөл"
                            value={selectedSharedContent?.type ?? "-"}
                          />
                          <TextbookStatField
                            label="Хүндрэлийн түвшин"
                            value={selectedSharedContent?.difficulty ?? "-"}
                          />
                          <TextbookStatField
                            label="Асуултын тоо"
                            value={selectedSharedContent?.questionCount ?? 0}
                          />
                          <TextbookStatField
                            label="Оноо"
                            value={selectedSharedContent?.score ?? 0}
                          />
                        </div>
                      </aside>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="flex items-center justify-end gap-8 pt-10">
          <button
            type="button"
            className="text-[15px] font-medium text-slate-500 transition hover:text-slate-700"
          >
            Цуцлах
          </button>
          <Button className="h-[42px] min-w-[128px] rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96]">
            Хадгалах
          </Button>
        </div>
      </div>
    </TestShell>
  );
}
