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

export function GeneralInfoSection() {
  return (
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
          <Select defaultValue="10">
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
          <Select defaultValue="progress">
            <SelectTrigger
              id="exam-type"
              className={`${fieldClassName} cursor-pointer`}
            >
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
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
