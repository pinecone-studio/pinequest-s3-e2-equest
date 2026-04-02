"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GetTeachersListDocument } from "@/gql/create-exam-documents";
import type { Teacher } from "@/gql/graphql";
import { cn } from "@/lib/utils";

const TEACHER_SELECTION_STORAGE_KEY = "ai-scheduler-teacher:selectedTeacherId";

function teacherDisplayName(t: Teacher): string {
  const short = t.shortName?.trim();
  if (short) return short;
  return `${t.lastName ?? ""} ${t.firstName ?? ""}`.trim() || t.id;
}

function teacherRoleNote(t: Teacher): string {
  const dept = t.department?.trim();
  const lvl = t.teachingLevel?.trim();
  if (dept && lvl) return `${dept} · ${lvl}`;
  return dept || lvl || "";
}

export function AiSchedulerTeacherPicker({
  className,
  align = "end",
  grades,
}: {
  className?: string;
  align?: "start" | "center" | "end";
  grades?: number[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TEACHER_SELECTION_STORAGE_KEY) ?? "";
  });

  const { data, loading } = useQuery(GetTeachersListDocument, {
    variables: { grades: grades?.length ? grades : null },
  });

  const teacherOptions = useMemo(
    () =>
      (data as { getTeachersList?: Teacher[] } | undefined)?.getTeachersList ??
      [],
    [data],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedTeacherId) {
      window.localStorage.setItem(
        TEACHER_SELECTION_STORAGE_KEY,
        selectedTeacherId,
      );
    }
  }, [selectedTeacherId]);

  useEffect(() => {
    if (loading) return;
    if (!teacherOptions.length) return;
    if (
      selectedTeacherId &&
      teacherOptions.some((t) => t.id === selectedTeacherId)
    ) {
      return;
    }
    setSelectedTeacherId(teacherOptions[0]!.id);
  }, [loading, selectedTeacherId, teacherOptions]);

  const selectedTeacher =
    teacherOptions.find((t) => t.id === selectedTeacherId) ?? teacherOptions[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-10 max-w-[min(100%,16rem)] shrink-0 gap-1.5 rounded-[14px] border-slate-200 bg-white px-4 text-[15px] font-semibold shadow-none hover:bg-slate-50",
            className,
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="truncate">
            {selectedTeacher
              ? teacherDisplayName(selectedTeacher)
              : "Багш сонгох"}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-[min(100vw-2rem,20rem)] border-slate-200 p-2 font-sans shadow-lg"
      >
        <p className="mb-2 px-2 text-[10px] leading-snug text-slate-500">
          {loading
            ? "Ачааллаж байна…"
            : teacherOptions.length
              ? `Нийт ${teacherOptions.length} багш`
              : "Багш олдсонгүй."}
        </p>
        <ul className="max-h-[min(60vh,16rem)] space-y-0.5 overflow-y-auto">
          {teacherOptions.map((t) => {
            const on = t.id === selectedTeacherId;
            const note = teacherRoleNote(t);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeacherId(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    on
                      ? "bg-sky-50 text-sky-950"
                      : "text-slate-800 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      on
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-300",
                    )}
                    aria-hidden
                  >
                    {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {teacherDisplayName(t)}
                    </span>
                    {note ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                        {note}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
