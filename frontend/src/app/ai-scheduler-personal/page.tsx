import type { Metadata } from "next";
import { AiPersonalExamScheduler } from "./_components/AiPersonalExamScheduler";

export const metadata: Metadata = {
	title: "Багшийн AI хуваарь",
	description:
		"Хичээл, нийтийн эвент, Busy болон AI-ийн шалгалтын санал — actionable insights, мэдээллийн далай биш.",
};

export default function AiSchedulerPersonalPage() {
	return <AiPersonalExamScheduler />;
}
