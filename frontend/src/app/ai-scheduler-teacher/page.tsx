import type { Metadata } from "next";
import { AiTeacherPersonalScheduler } from "./_components/AiTeacherPersonalScheduler";

export const metadata: Metadata = {
  title: "Багшийн AI хуваарь",
  description:
    "Хичээл, нийтийн эвент, Busy болон AI-ийн шалгалтын санал — actionable insights, мэдээллийн далай биш.",
};

export default function AiSchedulerTeacherPage() {
  return <AiTeacherPersonalScheduler />;
}

