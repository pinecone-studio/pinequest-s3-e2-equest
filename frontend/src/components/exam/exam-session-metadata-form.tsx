"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  EXAM_TYPE_LABELS,
  GRADE_OPTIONS,
  SUBJECT_OPTIONS,
  TOPICS_BY_SUBJECT,
  clearExamSessionSnapshot,
  createDefaultExamSessionMetadata,
  groupOptionsForGrade,
  type ExamSessionMetadata,
  type ExamSessionSubject,
} from "@/lib/exam-session-metadata";

function formatExamDateMn(isoDate: string): string | null {
  if (!isoDate.trim()) return null;
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("mn-MN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(d);
  } catch {
    return d.toLocaleDateString("mn-MN");
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pickOne<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)] as T;
}

function sampleTopics(items: string[], minCount: number, maxCount: number): string[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.min(pool.length, randInt(minCount, maxCount));
  return pool.slice(0, Math.max(1, count));
}

type ExamSessionMetadataFormProps = {
  metadata: ExamSessionMetadata;
  onMetadataChange: (next: ExamSessionMetadata) => void;
  examTitle: string;
  onExamTitleChange: (title: string) => void;
};

export function ExamSessionMetadataForm({
  metadata,
  onMetadataChange,
  examTitle,
  onExamTitleChange,
}: ExamSessionMetadataFormProps) {
  const [topicDraft, setTopicDraft] = React.useState("");
  const [saveHint, setSaveHint] = React.useState<string | null>(null);

  const topicSuggestions = metadata.subject
    ? TOPICS_BY_SUBJECT[metadata.subject] ?? []
    : [];
  const groupOptions = React.useMemo(
    () => (metadata.grade ? groupOptionsForGrade(metadata.grade) : []),
    [metadata.grade],
  );

  const examDateMnLabel = formatExamDateMn(metadata.examDate);

  const patch = React.useCallback(
    (partial: Partial<ExamSessionMetadata>) => {
      onMetadataChange({ ...metadata, ...partial });
    },
    [metadata, onMetadataChange],
  );

  const addTopic = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (!metadata.topics.includes(v)) {
      patch({ topics: [...metadata.topics, v] });
    }
    setTopicDraft("");
  };

  const removeTopic = (v: string) => {
    patch({ topics: metadata.topics.filter((x) => x !== v) });
  };

  const onGradeChange = (gradeStr: string) => {
    const grade = Number(gradeStr);
    if (!Number.isFinite(grade)) return;
    const groups = groupOptionsForGrade(grade);
    const nextGroup = groups.includes(metadata.groupClass)
      ? metadata.groupClass
      : groups[0];
    patch({ grade, groupClass: nextGroup });
  };

  const onSubjectChange = (subject: ExamSessionSubject) => {
    const nextSuggestions = TOPICS_BY_SUBJECT[subject] ?? [];
    const nextTopics = metadata.topics.filter((t) =>
      nextSuggestions.includes(t),
    );
    patch({ subject, topics: nextTopics });
  };

  const handleReset = () => {
    onMetadataChange(createDefaultExamSessionMetadata());
    onExamTitleChange("");
    setTopicDraft("");
    clearExamSessionSnapshot();
    setSaveHint("Цэвэрлэгдлээ.");
    window.setTimeout(() => setSaveHint(null), 2500);
  };

  const handleFillDemo = () => {
    const grade = pickOne([...GRADE_OPTIONS]);
    const groupClass = pickOne(groupOptionsForGrade(grade));
    const examType = pickOne(EXAM_TYPE_LABELS).value;
    const subject = pickOne(SUBJECT_OPTIONS).value;
    const subjectTopics = TOPICS_BY_SUBJECT[subject] ?? [];
    const topics = sampleTopics(subjectTopics, 2, 4);

    const now = new Date();
    const baseDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + randInt(0, 14),
    );
    const examDate = `${baseDate.getFullYear()}-${pad2(baseDate.getMonth() + 1)}-${pad2(baseDate.getDate())}`;

    // Эхлэх цаг 08:00-17:30 хооронд; үргэлжлэх хугацаа <= 45 минут (10-ын алхамтай)
    const durationMinutes = pickOne([20, 30, 40]);
    const startHour = randInt(8, 17);
    const startMinute = pickOne([0, 10, 15, 20, 30, 40, 45, 50]);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = Math.min(startTotal + durationMinutes, 23 * 60 + 59);
    const startTime = `${pad2(Math.floor(startTotal / 60))}:${pad2(startTotal % 60)}`;
    const endTime = `${pad2(Math.floor(endTotal / 60))}:${pad2(endTotal % 60)}`;

    const examTypeLabel = EXAM_TYPE_LABELS.find((x) => x.value === examType)?.label ?? "";
    const subjectLabel = SUBJECT_OPTIONS.find((x) => x.value === subject)?.label ?? "";
    onExamTitleChange(`${groupClass} ${subjectLabel} ${examTypeLabel}`);
    onMetadataChange({
      ...metadata,
      grade,
      groupClass,
      examType,
      subject,
      topics,
      examDate,
      startTime,
      endTime,
      durationMinutes,
      mixQuestions: Math.random() < 0.5,
      withVariants: Math.random() < 0.5,
      variantCount: 1,
      description: "Тайлбар бичих оруулна уу",
    });
    setSaveHint("Demo мэдээлэл орууллаа.");
    window.setTimeout(() => setSaveHint(null), 2500);
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <h2 className="text-base font-semibold text-foreground">
          Ерөнхий мэдээлэл оруулах
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleFillDemo}>
            Demo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            Цэвэрлэх
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="meta-grade">Анги</Label>
          <Select
            value={metadata.grade ? String(metadata.grade) : undefined}
            onValueChange={onGradeChange}
          >
            <SelectTrigger id="meta-grade" className="w-full">
              <SelectValue placeholder="Анги" />
            </SelectTrigger>
            <SelectContent>
              {GRADE_OPTIONS.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g}-р анги
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta-group">Бүлэг</Label>
          <Select
            value={metadata.groupClass || undefined}
            onValueChange={(v) => patch({ groupClass: v })}
          >
            <SelectTrigger id="meta-group" className="w-full">
              <SelectValue placeholder="Бүлэг" />
            </SelectTrigger>
            <SelectContent>
              {groupOptions.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta-type">Төрөл</Label>
          <Select
            value={metadata.examType ?? undefined}
            onValueChange={(v) =>
              patch({ examType: v as ExamSessionMetadata["examType"] })
            }
          >
            <SelectTrigger id="meta-type" className="w-full">
              <SelectValue placeholder="Төрөл" />
            </SelectTrigger>
            <SelectContent>
              {EXAM_TYPE_LABELS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta-subject">Хичээл</Label>
          <Select
            value={metadata.subject ?? undefined}
            onValueChange={(v) => onSubjectChange(v as ExamSessionSubject)}
          >
            <SelectTrigger id="meta-subject" className="w-full">
              <SelectValue placeholder="Хичээл" />
            </SelectTrigger>
            <SelectContent>
              {SUBJECT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label>Хичээлийн сэдэв</Label>
        <Combobox
          value={topicDraft}
          onValueChange={(v) => {
            const next = v ?? "";
            setTopicDraft(next);
            if (next && topicSuggestions.includes(next)) {
              addTopic(next);
            }
          }}
        >
          <ComboboxInput
            placeholder="Сэдвээ сонгож оруулна уу…"
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
              <ComboboxEmpty />
              {topicSuggestions.map((t) => (
                <ComboboxItem
                  key={`suggest-${t}`}
                  value={t}
                  onMouseDown={(e) => {
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

        {metadata.topics.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {metadata.topics.map((t, idx) => (
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

      <div className="mt-4 space-y-2">
        <Label htmlFor="meta-exam-name">Шалгалтын нэр</Label>
        <Input
          id="meta-exam-name"
          value={examTitle}
          onChange={(e) => onExamTitleChange(e.target.value)}
          placeholder="Жишээ: 9А ангийн явцын шалгалт"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="meta-date">Огноо</Label>
          <Input
            id="meta-date"
            type="date"
            lang="mn"
            value={metadata.examDate}
            onChange={(e) => patch({ examDate: e.target.value })}
          />
          {examDateMnLabel ? (
            <p className="text-xs text-muted-foreground">{examDateMnLabel}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="meta-start">Эхлэх цаг</Label>
          <Input
            id="meta-start"
            type="time"
            value={metadata.startTime}
            onChange={(e) => patch({ startTime: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meta-end">Дуусах цаг</Label>
          <Input
            id="meta-end"
            type="time"
            value={metadata.endTime}
            onChange={(e) => patch({ endTime: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meta-duration">Үргэлжлэх хугацаа (мин)</Label>
          <Input
            id="meta-duration"
            type="number"
            min={1}
            max={600}
            value={metadata.durationMinutes ?? ""}
            onChange={(e) => {
              if (e.target.value === "") {
                patch({ durationMinutes: null });
                return;
              }
              const n = Number(e.target.value);
              patch({
                durationMinutes: Number.isFinite(n)
                  ? Math.max(1, Math.min(600, Math.floor(n)))
                  : metadata.durationMinutes,
              });
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Checkbox
              id="meta-mix"
              checked={metadata.mixQuestions}
              onCheckedChange={(c) => patch({ mixQuestions: c === true })}
            />
            <Label htmlFor="meta-mix" className="cursor-pointer font-normal">
              Даалгаврыг холих
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="meta-variants"
              checked={metadata.withVariants}
              onCheckedChange={(c) => patch({ withVariants: c === true })}
            />
            <Label htmlFor="meta-variants" className="cursor-pointer font-normal">
              Хувилбартай
            </Label>
          </div>
        </div>
        <div className="w-full space-y-2 sm:w-56 sm:shrink-0">
          <Label htmlFor="meta-variant-count">Хувилбарын тоо</Label>
          <Input
            id="meta-variant-count"
            type="number"
            min={1}
            max={26}
            disabled={!metadata.withVariants}
            value={metadata.variantCount ?? ""}
            onChange={(e) => {
              if (e.target.value === "") {
                patch({ variantCount: null });
                return;
              }
              const n = Number(e.target.value);
              patch({
                variantCount: Number.isFinite(n)
                  ? Math.max(1, Math.min(26, Math.floor(n)))
                  : metadata.variantCount,
              });
            }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="meta-desc">Тайлбар</Label>
        <Textarea
          id="meta-desc"
          value={metadata.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Нэмэлт тэмдэглэл…"
          rows={3}
        />
      </div>

      {saveHint ? (
        <div className="mt-4">
          <span className="text-sm text-muted-foreground">{saveHint}</span>
        </div>
      ) : null}
    </div>
  );
}
