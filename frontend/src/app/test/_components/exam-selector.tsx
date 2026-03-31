"use client";

import { Input } from "@/components/ui/input";
import { Search, GraduationCap } from "lucide-react";

import { useState } from "react";
import { Exam } from "../lib/types";
import { ExamCard } from "./exam-card";

interface ExamSelectorProps {
  exams: Exam[];
  onSelectExam: (exam: Exam) => void;
}

export function ExamSelector({ exams, onSelectExam }: ExamSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredExams = exams.filter(
    (exam) =>
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      exam.subject.toLowerCase().includes(search.toLowerCase()) ||
      exam.class.toLowerCase().includes(search.toLowerCase()),
  );

  const liveExams = filteredExams.filter(
    (e) => e.liveStudentCount > 0 && !e.endTime,
  );
  const completedExams = filteredExams.filter(
    (e) => e.liveStudentCount === 0 || e.endTime,
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <GraduationCap className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                ШалгалтХамгаалагч
              </h1>
              <p className="text-xs text-muted-foreground">Шууд хяналт</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h2 className="mb-2 text-2xl font-semibold text-foreground">
            Таны шалгалтууд
          </h2>
          <p className="text-muted-foreground">
            Оюутнуудын үйл ажиллагааг шууд хянахын тулд шалгалтыг сонгоно уу
          </p>
        </div>

        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Шалгалт хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {liveExams.length > 0 && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Одоо явагдаж байна ({liveExams.length})
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onClick={() => onSelectExam(exam)}
                />
              ))}
            </div>
          </div>
        )}

        {completedExams.length > 0 && (
          <div>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Дууссан ({completedExams.length})
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onClick={() => onSelectExam(exam)}
                />
              ))}
            </div>
          </div>
        )}

        {filteredExams.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              Таны хайлттай тохирох шалгалт олдсонгүй.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
