"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  CalendarClock,
  CalendarDays,
  FileQuestion,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiTeacherPersonalScheduler } from "@/app/ai-scheduler/_components/AiTeacherPersonalScheduler";
import { AiStudentPersonalScheduler } from "@/app/ai-scheduler/_components/AiStudentPersonalScheduler";
import GenerateExamPage from "@/app/ai-scheduler/_components/GenerateExamPage";
import { SchoolEventScheduler } from "@/app/ai-scheduler/_components/SchoolEventScheduler";

export function AiSchedulerHubClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const view =
    rawView === "school" || rawView === "student" || rawView === "generate"
      ? rawView
      : "teacher";

  const setView = useCallback(
    (next: "teacher" | "student" | "school" | "generate") => {
      const url =
        next === "teacher" ? "/ai-scheduler" : `/ai-scheduler?view=${next}`;
      router.replace(url, { scroll: false });
    },
    [router],
  );

  const navBtn =
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors";
  const navInactive = "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
  const navActive = "bg-blue-50 text-blue-900 ring-1 ring-blue-200/80";

  return (
    <div className="min-h-screen bg-[#F1F4FA] px-4">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col">
        <div className="min-h-0 min-w-0 flex-1">
          {view === "school" ? (
            <SchoolEventScheduler shellMode />
          ) : view === "generate" ? (
            <GenerateExamPage />
          ) : view === "student" ? (
            <AiStudentPersonalScheduler shellMode />
          ) : (
            <AiTeacherPersonalScheduler shellMode />
          )}
        </div>
      </div>
    </div>
  );
}
