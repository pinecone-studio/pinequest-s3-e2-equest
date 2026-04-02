"use client";

import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fieldClassName,
  fieldWrapperClassName,
} from "./material-builder-config";

export type MaterialBuilderSubject = "" | "math" | "physics" | "chemistry";
export type MaterialBuilderExamType =
  | ""
  | "progress"
  | "quarter"
  | "state"
  | "benchmark"
  | "unit";

export type GeneralInfoValues = {
  durationMinutes: string;
  examName: string;
  examType: MaterialBuilderExamType;
  grade: string;
  subject: MaterialBuilderSubject;
};

type Props = {
  onApplyDemo: () => void;
  values: GeneralInfoValues;
  onChange: (next: GeneralInfoValues) => void;
  onReset: () => void;
  showUtilityActions?: boolean;
};

export function GeneralInfoSection({
  onApplyDemo,
  onChange,
  onReset,
  showUtilityActions = true,
  values,
}: Props) {
  const patch = (nextPartial: Partial<GeneralInfoValues>) => {
    onChange({ ...values, ...nextPartial });
  };

  return (
    <section className="rounded-[18px] border border-[#e3e9f4] bg-white px-5 py-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
          <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-[#b9d7ff] bg-[#eef6ff] text-[#3b82f6]">
            <Info className="h-3 w-3" />
          </span>
          Ерөнхий мэдээлэл
        </div>
        {showUtilityActions ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onApplyDemo}
              className="h-7 cursor-pointer rounded-[8px] border-slate-100 bg-transparent px-2 text-[11px] font-normal text-slate-400 opacity-55 shadow-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-500 hover:opacity-100"
            >
              Demo
            </button>
            <button
              type="button"
              onClick={onReset}
              className="h-7 cursor-pointer rounded-[8px] border-slate-100 bg-transparent px-2 text-[11px] font-normal text-slate-400 opacity-55 shadow-none hover:border-slate-200 hover:bg-slate-50 hover:text-slate-500 hover:opacity-100"
            >
              Reset
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <div className={fieldWrapperClassName}>
          <Label
            htmlFor="subject"
            className="text-[14px] font-medium text-slate-800"
          >
            Хичээл
          </Label>
          <Select
            value={values.subject}
            onValueChange={(nextValue: MaterialBuilderSubject) =>
              patch({ subject: nextValue })
            }
          >
            <SelectTrigger
              id="subject"
              className={`${fieldClassName} cursor-pointer`}
            >
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
          <Select
            value={values.grade}
            onValueChange={(nextValue) => patch({ grade: nextValue })}
          >
            <SelectTrigger
              id="classroom"
              className={`${fieldClassName} cursor-pointer`}
            >
              <SelectValue placeholder="Анги сонгох" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">9 дүгээр анги</SelectItem>
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
          <Select
            value={values.examType}
            onValueChange={(nextValue: MaterialBuilderExamType) =>
              patch({ examType: nextValue })
            }
          >
            <SelectTrigger
              id="exam-type"
              className={`${fieldClassName} cursor-pointer`}
            >
              <SelectValue placeholder="Төрөл сонгох" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="progress">Явцын</SelectItem>
              <SelectItem value="quarter">Улирлын</SelectItem>
              <SelectItem value="state">Улсын</SelectItem>
              <SelectItem value="benchmark">Жишиг</SelectItem>
              <SelectItem value="unit">Бүлэг сэдэв</SelectItem>
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
            value={values.examName}
            onChange={(event) => patch({ examName: event.target.value })}
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
          <Select
            value={values.durationMinutes}
            onValueChange={(nextValue) =>
              patch({ durationMinutes: nextValue })
            }
          >
            <SelectTrigger
              id="duration-left"
              className={`${fieldClassName} cursor-pointer`}
            >
              <SelectValue placeholder="Хугацаа сонгох" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 мин</SelectItem>
              <SelectItem value="30">30 мин</SelectItem>
              <SelectItem value="40">40 мин</SelectItem>
              <SelectItem value="60">60 мин</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
