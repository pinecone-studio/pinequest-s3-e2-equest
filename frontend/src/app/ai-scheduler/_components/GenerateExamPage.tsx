"use client";

import * as React from "react";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { XIcon } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  GenerateExamQuestionsDocument,
  SaveExamDocument,
} from "@/gql/create-exam-documents";
import {
  ExamStatus,
  ExamType,
  type ExamGenerationInput,
  type ExamGenerationResult,
  type GeneratedQuestion,
  type SaveExamInput,
  type SaveExamPayload,
} from "@/gql/graphql";
import { confirmDeleteAction } from "@/lib/confirm-destructive-action";

const GRADE_CLASSES = Array.from({ length: 4 }, (_, i) => i + 9).flatMap((g) =>
  (["a", "b", "c", "d"] as const).map((s) => `${g}${s}`),
);

/** `value` — сонгогчийн түлхүүр; `label` — харуулах ба GraphQL `subject` (AI-д очих текст) */
const SUBJECTS: { value: string; label: string }[] = [
  { value: "math", label: "Математик" },
  { value: "mongolian", label: "Монгол хэл" },
  { value: "english", label: "Англи хэл" },
  { value: "physics", label: "Физик" },
  { value: "chemistry", label: "Хими" },
  { value: "biology", label: "Биологи" },
  { value: "history", label: "Түүх" },
  { value: "social", label: "Нийгэм" },
];

const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  // 9-р анги (ерөнхий) математикийн жишиг сэдвүүд
  math: [
    "Квадрат тэгшитгэл",
    "Пифагорын теорем",
    "Тоон илэрхийлэл ба хувиргалт (үйлдлийн дараалал, задлах, хялбарчлах)",
    "Рационал тоо (бүхэл/бутархай) дээрх үйлдлүүд",
    "Иррационал тоо, квадрат язгуур (язгуурын чанар)",
    "Зэрэг ба түүний чанар (сөрөг/бутархай зэрэг)",
    "Олон гишүүнтийг үржүүлэгч болгон задлах (ерөнхий үржүүлэгч, бүлэглэх)",
    "Шугаман тэгшитгэл ба тэнцэтгэл биш",
    "Квадрат тэгшитгэл (D, Виетийн теорем)",
    "Хоёр хувьсагчтай шугаман систем (орлуулах/нэмэх арга)",
    "Функц ба график (y=kx+b), параллель/перпендикуляр шулуун",
    "Квадрат функц (y=ax^2+bx+c), оройн цэг, тэгш хэм",
    "Гурвалжны төсөө (T1, T2, T3), төсөөгийн коэффициент",
    "Пифагорын теорем, тэгш өнцөгт гурвалжин",
    "Тойрог ба өнцөг (төв/багтсан өнцөг)",
    "Магадлал ба статистик (дундаж, медиан, моод, далайц)",
  ],
};

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: ExamType.Periodic_1, label: "Явцын шалгалт 1" },
  { value: ExamType.Periodic_2, label: "Явцын шалгалт 2" },
  { value: ExamType.Midterm, label: "Дундын шалгалт" },
  { value: ExamType.Finalterm, label: "Жилийн эцсийн шалгалт" },
  { value: ExamType.Practice, label: "Давтлага шалгалт" },
];

/** `<input type="date">` формат (YYYY-MM-DD), хэрэглэгчийн орон нутгийн өнөөдөр. */
function getTodayDateInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `<input type="time">` формат (HH:mm), хэрэглэгчийн орон нутгийн яг одоо. */
function getNowTimeInputValue(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Урд талын илүү 0-үүдийг хасна; хоосон бол хоосон үлдэнэ. */
function sanitizeUnsignedIntInput(raw: string): string {
  if (raw === "") {
    return "";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits === "") {
    return "";
  }
  const trimmed = digits.replace(/^0+/, "");
  return trimmed === "" ? "0" : trimmed;
}

function parseUIntFromInput(raw: string): number {
  if (raw === "") {
    return 0;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function allocateByWeights(
  total: number,
  weights: [number, number, number],
): [number, number, number] {
  if (!Number.isFinite(total) || total <= 0) return [0, 0, 0];
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0)) as [
    number,
    number,
    number,
  ];
  const sumW = w[0] + w[1] + w[2];
  if (sumW <= 0) {
    // default split: 40/40/20
    return allocateByWeights(total, [40, 40, 20]);
  }
  const raw = w.map((x) => (total * x) / sumW);
  const floored = raw.map((x) => Math.floor(x));
  let remaining = total - (floored[0]! + floored[1]! + floored[2]!);
  const order = [0, 1, 2].sort(
    (a, b) => raw[b]! - floored[b]! - (raw[a]! - floored[a]!),
  );
  const out = [...floored] as [number, number, number];
  for (let i = 0; i < order.length && remaining > 0; i++) {
    out[order[i]!] += 1;
    remaining -= 1;
  }
  return out;
}

function allocateByWeightsN(total: number, weights: number[]): number[] {
  if (!Number.isFinite(total) || total <= 0) return weights.map(() => 0);
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const sumW = w.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    // default: all into first bucket
    return w.map((_, i) => (i === 0 ? total : 0));
  }
  const raw = w.map((x) => (total * x) / sumW);
  const floored = raw.map((x) => Math.floor(x));
  let remaining = total - floored.reduce((a, b) => a + b, 0);
  const order = w
    .map((_, i) => i)
    .sort((a, b) => raw[b]! - floored[b]! - (raw[a]! - floored[a]!));
  const out = [...floored];
  for (let i = 0; i < order.length && remaining > 0; i++) {
    out[order[i]!] = (out[order[i]!] ?? 0) + 1;
    remaining -= 1;
  }
  return out;
}

function allocateTwo(total: number, w1: number, w2: number): [number, number] {
  if (!Number.isFinite(total) || total <= 0) return [0, 0];
  const a = Number.isFinite(w1) && w1 > 0 ? w1 : 0;
  const b = Number.isFinite(w2) && w2 > 0 ? w2 : 0;
  const sum = a + b;
  if (sum <= 0) {
    const first = Math.ceil(total / 2);
    return [first, total - first];
  }
  const rawFirst = (total * a) / sum;
  const first = Math.floor(rawFirst);
  return [first, total - first];
}

export default function GenerateExamPage() {
  const [gradeClass, setGradeClass] = React.useState("");
  const [subjectValue, setSubjectValue] = React.useState("");
  const subjectLabel =
    SUBJECTS.find((s) => s.value === subjectValue)?.label ?? subjectValue;
  const [examType, setExamType] = React.useState<ExamType | "">("");
  const [topicDraft, setTopicDraft] = React.useState("");
  const [topics, setTopics] = React.useState<string[]>([]);
  const [examContent, setExamContent] = React.useState("");
  const [examDate, setExamDate] = React.useState(getTodayDateInputValue);
  const [examTime, setExamTime] = React.useState(getNowTimeInputValue);
  const [durationInput, setDurationInput] = React.useState("");
  const [totalInput, setTotalInput] = React.useState("");
  const durationMinutes = parseUIntFromInput(durationInput);
  const totalCount = parseUIntFromInput(totalInput);
  const [easyCountInput, setEasyCountInput] = React.useState("");
  const [mediumCountInput, setMediumCountInput] = React.useState("");
  const [hardCountInput, setHardCountInput] = React.useState("");
  const easyCount = parseUIntFromInput(easyCountInput);
  const mediumCount = parseUIntFromInput(mediumCountInput);
  const hardCount = parseUIntFromInput(hardCountInput);

  const setDifficultyCountsKeepingTotal = React.useCallback(
    (which: "easy" | "medium" | "hard", rawNext: string) => {
      const nextStr = sanitizeUnsignedIntInput(rawNext);
      const nextVal = clampInt(parseUIntFromInput(nextStr), 0, totalCount);
      const remaining = Math.max(0, totalCount - nextVal);

      if (which === "easy") {
        const [nm, nh] = allocateTwo(remaining, mediumCount, hardCount);
        setEasyCountInput(nextStr === "" ? "" : String(nextVal));
        setMediumCountInput(String(nm));
        setHardCountInput(String(nh));
        return;
      }
      if (which === "medium") {
        const [ne, nh] = allocateTwo(remaining, easyCount, hardCount);
        setEasyCountInput(String(ne));
        setMediumCountInput(nextStr === "" ? "" : String(nextVal));
        setHardCountInput(String(nh));
        return;
      }
      const [ne, nm] = allocateTwo(remaining, easyCount, mediumCount);
      setEasyCountInput(String(ne));
      setMediumCountInput(String(nm));
      setHardCountInput(nextStr === "" ? "" : String(nextVal));
    },
    [
      easyCount,
      mediumCount,
      hardCount,
      totalCount,
      setEasyCountInput,
      setMediumCountInput,
      setHardCountInput,
    ],
  );

  // Нийт асуултын тоо өөрчлөгдөхөд хүндрэлийн 3 тоог харьцаагаар нь дагуулж шинэчилнэ.
  React.useEffect(() => {
    if (totalInput === "") return; // хэрэглэгч бичиж байх үед 0 руу үсрэхээс сэргийлнэ
    const currentSum = easyCount + mediumCount + hardCount;
    if (currentSum === totalCount) return;
    const [ne, nm, nh] = allocateByWeights(totalCount, [
      easyCount,
      mediumCount,
      hardCount,
    ]);
    setEasyCountInput(String(ne));
    setMediumCountInput(String(nm));
    setHardCountInput(String(nh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCount]);
  const [showPoints, setShowPoints] = React.useState(false);
  const [easyPts, setEasyPts] = React.useState<number | "">(1);
  const [mediumPts, setMediumPts] = React.useState<number | "">(2);
  const [hardPts, setHardPts] = React.useState<number | "">(3);

  // Асуултын хэлбэр тус бүрийн тоо (нийлбэр нь totalCount байх ёстой)
  const [singleChoiceCountInput, setSingleChoiceCountInput] =
    React.useState("");
  const [multipleChoiceCountInput, setMultipleChoiceCountInput] =
    React.useState("");
  const [matchingCountInput, setMatchingCountInput] = React.useState("");
  const [fillInCountInput, setFillInCountInput] = React.useState("");
  const [writtenCountInput, setWrittenCountInput] = React.useState("");
  const singleChoiceCount = parseUIntFromInput(singleChoiceCountInput);
  const multipleChoiceCount = parseUIntFromInput(multipleChoiceCountInput);
  const matchingCount = parseUIntFromInput(matchingCountInput);
  const fillInCount = parseUIntFromInput(fillInCountInput);
  const writtenCount = parseUIntFromInput(writtenCountInput);
  const formatTotal =
    singleChoiceCount +
    multipleChoiceCount +
    matchingCount +
    fillInCount +
    writtenCount;

  const setFormatCountsKeepingTotal = React.useCallback(
    (
      which:
        | "singleChoice"
        | "multipleChoice"
        | "matching"
        | "fillIn"
        | "written",
      rawNext: string,
    ) => {
      const nextStr = sanitizeUnsignedIntInput(rawNext);
      const nextVal = clampInt(parseUIntFromInput(nextStr), 0, totalCount);
      const remaining = Math.max(0, totalCount - nextVal);

      const all = {
        singleChoice: singleChoiceCount,
        multipleChoice: multipleChoiceCount,
        matching: matchingCount,
        fillIn: fillInCount,
        written: writtenCount,
      } as const;

      const keys: Array<keyof typeof all> = [
        "singleChoice",
        "multipleChoice",
        "matching",
        "fillIn",
        "written",
      ];
      const otherKeys = keys.filter((k) => k !== which);
      const weights = otherKeys.map((k) => all[k]);
      const allocated = allocateByWeightsN(remaining, weights);

      const nextMap = new Map(otherKeys.map((k, i) => [k, allocated[i] ?? 0]));
      const setFor = (k: keyof typeof all, v: number | "") => {
        const s = v === "" ? "" : String(v);
        if (k === "singleChoice") setSingleChoiceCountInput(s);
        if (k === "multipleChoice") setMultipleChoiceCountInput(s);
        if (k === "matching") setMatchingCountInput(s);
        if (k === "fillIn") setFillInCountInput(s);
        if (k === "written") setWrittenCountInput(s);
      };

      for (const k of otherKeys) {
        setFor(k, nextMap.get(k) ?? 0);
      }
      setFor(which, nextStr === "" ? "" : nextVal);
    },
    [
      totalCount,
      singleChoiceCount,
      multipleChoiceCount,
      matchingCount,
      fillInCount,
      writtenCount,
      setSingleChoiceCountInput,
      setMultipleChoiceCountInput,
      setMatchingCountInput,
      setFillInCountInput,
      setWrittenCountInput,
    ],
  );

  // Нийт асуултын тоо өөрчлөгдөхөд формат бүрийн тоог харьцаагаар нь дагуулж шинэчилнэ.
  React.useEffect(() => {
    if (totalInput === "") return;
    if (formatTotal === totalCount) return;
    const [ns, nm, nma, nf, nw] = allocateByWeightsN(totalCount, [
      singleChoiceCount,
      multipleChoiceCount,
      matchingCount,
      fillInCount,
      writtenCount,
    ]);
    setSingleChoiceCountInput(String(ns ?? 0));
    setMultipleChoiceCountInput(String(nm ?? 0));
    setMatchingCountInput(String(nma ?? 0));
    setFillInCountInput(String(nf ?? 0));
    setWrittenCountInput(String(nw ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCount]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<GeneratedQuestion[] | null>(
    null,
  );
  /** Хадгалахад ашиглана — сүүлийн амжилттай generate-ийн оролт */
  const [lastGenerationInput, setLastGenerationInput] =
    React.useState<ExamGenerationInput | null>(null);
  const [savedExamId, setSavedExamId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(
    (opts?: { keepGenerated?: boolean }) => {
      setError(null);
      setSaveError(null);
      setSaving(false);

      setGradeClass("");
      setSubjectValue("");
      setExamType("");

      setTopicDraft("");
      setTopics([]);
      setExamContent("");

      setExamDate(getTodayDateInputValue());
      setExamTime(getNowTimeInputValue());
      setDurationInput("");
      setTotalInput("");

      setEasyCountInput("");
      setMediumCountInput("");
      setHardCountInput("");

      setSingleChoiceCountInput("");
      setMultipleChoiceCountInput("");
      setMatchingCountInput("");
      setFillInCountInput("");
      setWrittenCountInput("");

      setShowPoints(false);
			setEasyPts(1);
			setMediumPts(2);
			setHardPts(3);

      if (!opts?.keepGenerated) {
        setQuestions(null);
        setLastGenerationInput(null);
        setSavedExamId(null);
      }
    },
    [
      setError,
      setSaveError,
      setSaving,
      setGradeClass,
      setSubjectValue,
      setExamType,
      setTopicDraft,
      setTopics,
      setExamContent,
      setExamDate,
      setExamTime,
      setDurationInput,
      setTotalInput,
      setEasyCountInput,
      setMediumCountInput,
      setHardCountInput,
      setSingleChoiceCountInput,
      setMultipleChoiceCountInput,
      setMatchingCountInput,
      setFillInCountInput,
      setWrittenCountInput,
      setShowPoints,
      setEasyPts,
      setMediumPts,
      setHardPts,
      setQuestions,
      setLastGenerationInput,
      setSavedExamId,
    ],
  );

  const applyDemo = React.useCallback(() => {
    setError(null);
    setSaveError(null);
    setQuestions(null);
    setLastGenerationInput(null);
    setSavedExamId(null);

    setGradeClass("9a");
    setSubjectValue("math");
    setExamType(ExamType.Practice);

    setTopics(["Квадрат тэгшитгэл", "Пифагорын теорем"]);
    setTopicDraft("");
    setExamContent(
      "Сэдвийн хүрээнд үндсэн ойлголт, бодлого бодох чадвар шалгана.",
    );

    setExamDate(getTodayDateInputValue());
    setExamTime("09:00");
    setDurationInput("45");
    setTotalInput("10");

    setEasyCountInput("4");
    setMediumCountInput("4");
    setHardCountInput("2");

    setSingleChoiceCountInput("6");
    setMultipleChoiceCountInput("2");
    setMatchingCountInput("1");
    setFillInCountInput("1");
    setWrittenCountInput("0");

    setShowPoints(true);
    setEasyPts(1);
    setMediumPts(2);
    setHardPts(3);
  }, [
    setError,
    setSaveError,
    setQuestions,
    setLastGenerationInput,
    setSavedExamId,
    setGradeClass,
    setSubjectValue,
    setExamType,
    setTopics,
    setTopicDraft,
    setExamContent,
    setExamDate,
    setExamTime,
    setDurationInput,
    setTotalInput,
    setEasyCountInput,
    setMediumCountInput,
    setHardCountInput,
    setSingleChoiceCountInput,
    setMultipleChoiceCountInput,
    setMatchingCountInput,
    setFillInCountInput,
    setWrittenCountInput,
    setShowPoints,
    setEasyPts,
    setMediumPts,
    setHardPts,
  ]);

  const [generateMutation] = useMutation(GenerateExamQuestionsDocument);
  const [saveMutation] = useMutation(SaveExamDocument);
  const generateInFlightRef = React.useRef(false);
  const saveInFlightRef = React.useRef(false);

  const totalPointsSum = React.useMemo(() => {
    if (!showPoints) {
      return null;
    }
    const ep = easyPts === "" ? 0 : Number(easyPts);
    const mp = mediumPts === "" ? 0 : Number(mediumPts);
    const hp = hardPts === "" ? 0 : Number(hardPts);
    if (![ep, mp, hp].every((n) => Number.isFinite(n))) {
      return null;
    }
    return easyCount * ep + mediumCount * mp + hardCount * hp;
  }, [
    showPoints,
    easyCount,
    mediumCount,
    hardCount,
    easyPts,
    mediumPts,
    hardPts,
  ]);

  const addTopic = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setTopics((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setTopicDraft("");
  };

  const removeTopic = async (v: string) => {
    if (
      !(await confirmDeleteAction(
        "Энэ сэдвийг",
        "Сэдвийн жагсаалтаас хасагдана.",
      ))
    ) {
      return;
    }

    setTopics((prev) => prev.filter((x) => x !== v));
  };

  const topicSuggestions = TOPIC_SUGGESTIONS[subjectValue] ?? [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generateInFlightRef.current) {
      return;
    }
    setError(null);
    if (!gradeClass) {
      setError("Анги сонгоно уу.");
      return;
    }
    if (!subjectValue) {
      setError("Хичээл сонгоно уу.");
      return;
    }
    if (!examType) {
      setError("Шалгалтын төрөл сонгоно уу.");
      return;
    }
    if (easyCount + mediumCount + hardCount !== totalCount) {
      setError(
        `Хялбар + дунд + хэцүү (${easyCount + mediumCount + hardCount}) нийт асуултын тоо (${totalCount})-тай тэнцүү байх ёстой.`,
      );
      return;
    }
    if (formatTotal !== totalCount) {
      setError(
        `Нэг зөв + олон зөв + холбох + нөхөх + бичих (${formatTotal}) нийт асуултын тоо (${totalCount})-тай тэнцүү байх ёстой.`,
      );
      return;
    }
    const topicScope = topics.join(", ");

    const input: ExamGenerationInput = {
      gradeClass,
      subject: subjectLabel,
      examType: examType as ExamType,
      topicScope,
      examContent: examContent.trim(),
      examDate,
      examTime,
      durationMinutes,
      totalQuestionCount: totalCount,
      difficultyDistribution: {
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount,
      },
      formatDistribution: {
        singleChoice: singleChoiceCount,
        multipleChoice: multipleChoiceCount,
        matching: matchingCount,
        fillIn: fillInCount,
        written: writtenCount,
      },
      // Checkbox-оос үл хамааран default (1/2/3) оноог явуулна.
      difficultyPoints: showPoints
        ? {
            easyPoints: easyPts === "" ? 1 : Number(easyPts),
            mediumPoints: mediumPts === "" ? 2 : Number(mediumPts),
            hardPoints: hardPts === "" ? 3 : Number(hardPts),
          }
        : {
            easyPoints: 1,
            mediumPoints: 2,
            hardPoints: 3,
          },
    };
    console.info("[generateExamQuestions] input", input);
    if (topics.length < 1) {
      setError("Хамрах сэдвээс дор хаяж 1-ийг нэмнэ үү.");
      return;
    }
    if (!input.examContent) {
      setError("Шалгалтын агуулгаа оруулна уу.");
      return;
    }
    if (!input.examDate) {
      setError("Шалгалтын огноо сонгоно уу.");
      return;
    }
    if (input.totalQuestionCount < 1) {
      setError("Нийт дор хаяж 1 асуулт оруулна уу.");
      return;
    }
    if (input.durationMinutes < 1) {
      setError("Хугацаа дор хаяж 1 минут оруулна уу.");
      return;
    }

    generateInFlightRef.current = true;
    setLoading(true);
    try {
      const { data } = await generateMutation({
        variables: { input },
      });
      const result = (
        data as { generateExamQuestions?: ExamGenerationResult } | undefined
      )?.generateExamQuestions;
      const q = result?.questions;
      if (!q?.length) {
        throw new Error("Хариу хоосон байна");
      }
      setQuestions(q);
      setLastGenerationInput(input);
      setSavedExamId(result?.examId ?? null);
      setSaveError(null);
      // амжилттай үүсгэсний дараа form-ыг цэвэрлэнэ (үүссэн асуултыг үлдээнэ)
      resetForm({ keepGenerated: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Алдаа гарлаа";
      setError(message);
    } finally {
      generateInFlightRef.current = false;
      setLoading(false);
    }
  };

  const onSaveDraft = async () => {
    if (saveInFlightRef.current) {
      return;
    }
    setSaveError(null);
    if (!lastGenerationInput || !questions?.length) {
      setSaveError("Эхлээд асуулт үүсгэнэ үү.");
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const input: SaveExamInput = {
        status: ExamStatus.Draft,
        generation: lastGenerationInput,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          format: q.format,
          difficulty: q.difficulty,
          options: q.options ?? undefined,
          correctAnswer: q.correctAnswer ?? undefined,
          explanation: q.explanation ?? undefined,
        })),
      };
      if (savedExamId) {
        input.examId = savedExamId;
      }
      const { data } = await saveMutation({ variables: { input } });
      const examId = (data as { saveExam?: SaveExamPayload } | undefined)
        ?.saveExam?.examId;
      if (!examId) {
        throw new Error("Хадгалах хариу хоосон байна");
      }
      setSavedExamId(examId);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа",
      );
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 font-sans">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Шалгалт үүсгэх (AI)
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Шалгалтын тохиргоо</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Анги</Label>
                <Select value={gradeClass} onValueChange={setGradeClass}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Анги" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Хичээл</Label>
                <Select value={subjectValue} onValueChange={setSubjectValue}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Хичээл" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Шалгалтын төрөл</Label>
                <Select
                  value={examType}
                  onValueChange={(v) => setExamType(v as ExamType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Шалгалтын төрөл" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Хамрах сэдэв</Label>
              <div className="space-y-2">
                <Combobox
                  value={topicDraft}
                  onValueChange={(v) => {
                    const next = v ?? "";
                    setTopicDraft(next);
                    // Combobox-оос item сонгосон үед (mouse/keyboard) шууд topics-д нэмнэ
                    if (next && topicSuggestions.includes(next)) {
                      addTopic(next);
                    }
                  }}
                >
                  <ComboboxInput
                    placeholder="Сэдвээ сонгож оруулна уу..."
                    showClear
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTopic(topicDraft);
                      }
                    }}
                  />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty></ComboboxEmpty>
                      {topicSuggestions.map((t) => (
                        <ComboboxItem
                          key={`suggest-${t}`}
                          value={t}
                          onMouseDown={(e) => {
                            // Item сонгоход input blur болохоос өмнө нэмэх
                            e.preventDefault();
                            addTopic(t);
                          }}
                        >
                          {t}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                {topics.length ? (
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t, idx) => (
                      <Badge
                        key={`${t}-${idx}`}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        <span className="truncate">{t}</span>
                        <button
                          type="button"
                          className="ml-1 inline-flex size-5 items-center justify-center rounded hover:bg-muted/60"
                          onClick={() => removeTopic(t)}
                          aria-label="Сэдэв устгах"
                          title="Устгах"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Одоогоор сонгосон сэдэв алга.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Шалгалтын агуулга</Label>
              <Textarea
                id="content"
                value={examContent}
                onChange={(e) => setExamContent(e.target.value)}
                placeholder="Шалгалтын хамрах агуулгаа дэлгэрэнгүй бичнэ үү…"
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="date">Огноо</Label>
                <Input
                  id="date"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Цаг</Label>
                <Input
                  id="time"
                  type="time"
                  value={examTime}
                  onChange={(e) => setExamTime(e.target.value)}
                  placeholder="09:00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dur">Хугацаа (мин)</Label>
                <Input
                  id="dur"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  value={durationInput}
                  onChange={(e) =>
                    setDurationInput(sanitizeUnsignedIntInput(e.target.value))
                  }
                  placeholder="45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total">Нийт асуултын тоо</Label>
                <Input
                  id="total"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  value={totalInput}
                  onChange={(e) =>
                    setTotalInput(sanitizeUnsignedIntInput(e.target.value))
                  }
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Асуултын хүндрэлийн түвшин</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Хялбар
                  </span>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={easyCountInput}
                    onChange={(e) =>
                      setDifficultyCountsKeepingTotal("easy", e.target.value)
                    }
                    placeholder="4"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Дунд
                  </span>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={mediumCountInput}
                    onChange={(e) =>
                      setDifficultyCountsKeepingTotal("medium", e.target.value)
                    }
                    placeholder="4"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Хэцүү
                  </span>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={hardCountInput}
                    onChange={(e) =>
                      setDifficultyCountsKeepingTotal("hard", e.target.value)
                    }
                    placeholder="2"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base">Асуултын хэлбэр</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Нэг зөв
                  </Label>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={singleChoiceCountInput}
                    onChange={(e) =>
                      setFormatCountsKeepingTotal(
                        "singleChoice",
                        e.target.value,
                      )
                    }
                    placeholder="6"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Олон зөв
                  </Label>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={multipleChoiceCountInput}
                    onChange={(e) =>
                      setFormatCountsKeepingTotal(
                        "multipleChoice",
                        e.target.value,
                      )
                    }
                    placeholder="2"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Холбох
                  </Label>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={matchingCountInput}
                    onChange={(e) =>
                      setFormatCountsKeepingTotal("matching", e.target.value)
                    }
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Нөхөх</Label>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={fillInCountInput}
                    onChange={(e) =>
                      setFormatCountsKeepingTotal("fillIn", e.target.value)
                    }
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Бичих</Label>
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={writtenCountInput}
                    onChange={(e) =>
                      setFormatCountsKeepingTotal("written", e.target.value)
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="pts"
                checked={showPoints}
                onCheckedChange={(c) => setShowPoints(c === true)}
              />
              <Label htmlFor="pts" className="cursor-pointer font-normal">
                Асуултын хүндрэлийн оноог оруулах (сонголттой)
              </Label>
            </div>
            {showPoints ? (
              <div className="grid grid-cols-3 gap-3 rounded-md border p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Хялбар оноо</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={easyPts}
                    onChange={(e) =>
                      setEasyPts(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Дунд оноо</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={mediumPts}
                    onChange={(e) =>
                      setMediumPts(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="2"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Хэцүү оноо</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={hardPts}
                    onChange={(e) =>
                      setHardPts(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="3"
                  />
                </div>
                <div className="col-span-3 mt-1 flex items-center justify-between border-t pt-3 text-sm">
                  <span className="font-medium text-foreground">Нийт оноо</span>
                  <span className="tabular-nums text-base font-semibold">
                    {totalPointsSum === null ? "—" : totalPointsSum}
                  </span>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={applyDemo}
              >
                Demo
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => resetForm()}
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? "Үүсгэж байна…" : "Шалгалтын асуулт үүсгэх"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {questions && questions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Үүссэн асуултууд ({questions.length})
            </CardTitle>
            {savedExamId ? (
              <p className="text-xs text-muted-foreground">
                Хадгалагдсан ID:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {savedExamId}
                </code>
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={onSaveDraft}
              >
                {saving
                  ? "Хадгалж байна…"
                  : savedExamId
                    ? "DRAFT шинэчлэх"
                    : "DRAFT хадгалах"}
              </Button>
              {saveError ? (
                <p className="text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              ) : null}
            </div>
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{i + 1}.</span>
                  <span>{q.difficulty}</span>
                  <span>·</span>
                  <span>{q.format}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{q.text}</p>
                {q.options && q.options.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {q.options.map((o, idx) => (
                      <li key={`${q.id}-opt-${idx}`}>{o}</li>
                    ))}
                  </ul>
                ) : null}
                {q.correctAnswer ? (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Зөв: </span>
                    {q.correctAnswer}
                  </p>
                ) : null}
                {q.explanation ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.explanation}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
