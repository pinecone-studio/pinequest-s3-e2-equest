import type { Metadata } from "next";
import { SchoolEventScheduler } from "./_components/SchoolEventScheduler";

export const metadata: Metadata = {
	title: "Сургуулийн хуваарь ба үйл явдал",
	description:
		"Багшдын товлосон шалгалт болон сургуулийн том арга хэмжээг нэг хуанлиар харах.",
};

export default function AiSchedulerSchoolEventPage() {
	return <SchoolEventScheduler />;
}
