"use client";

import { Suspense } from "react";
import { AiSchedulerHubClient } from "@/app/ai-scheduler/_components/AiSchedulerHubClient";
import { AiSchedulerTeacherPicker } from "@/app/ai-scheduler/_components/AiSchedulerTeacherPicker";
import { TestShell } from "../_components/test-shell";

function HubFallback() {
  return (
    <div className="min-h-screen bg-[#F1F4FA]" aria-busy="true" aria-label="Ачааллаж байна" />
  );
}

export default function TestAiSchedulerPage() {
  return (
    <TestShell
      key="test-ai-scheduler-shell"
      title="Шалгалтын хуваарь"
      breadcrumb={
        <div className="flex items-center">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
            Шалгалтын хуваарь
          </h1>
        </div>
      }
      // description="Test орчин дотор AI scheduler hub (teacher/student/school/generate)."
      contentClassName="p-0"
      compactSidebar
      sidebarCollapsible
      teacherVariant="none"
      headerRightSlot={<AiSchedulerTeacherPicker />}
    >
      <Suspense fallback={<HubFallback />}>
        <AiSchedulerHubClient hideSchedulerHeaders />
      </Suspense>
    </TestShell>
  );
}
