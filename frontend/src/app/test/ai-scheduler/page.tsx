"use client";

import { AiSchedulerHubClient } from "@/app/ai-scheduler/_components/AiSchedulerHubClient";
import { AiSchedulerTeacherPicker } from "@/app/ai-scheduler/_components/AiSchedulerTeacherPicker";
import { TestShell } from "../_components/test-shell";

export default function TestAiSchedulerPage() {
  return (
    <TestShell
      key="test-ai-scheduler-shell"
      title="Шалгалт товлох"
      // description="Test орчин дотор AI scheduler hub (teacher/student/school/generate)."
      contentClassName="p-0"
      compactSidebar
      sidebarCollapsible
      teacherVariant="none"
      headerRightSlot={<AiSchedulerTeacherPicker />}
    >
      <AiSchedulerHubClient hideSchedulerHeaders />
    </TestShell>
  );
}
