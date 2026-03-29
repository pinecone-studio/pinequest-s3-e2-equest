import type { Metadata } from "next";
import { AiPersonalExamScheduler } from "./_components/AiPersonalExamScheduler";

export const metadata: Metadata = {
	title: "Багшийн хувийн AI хуваарь",
	description:
		"Багш өөрийн товлосон шалгалтын цагийг AI-аар санал болгуулж батална.",
};

export default function AiSchedulerPersonalPage() {
	return <AiPersonalExamScheduler />;
}
