import type { Metadata } from "next";
import { SchoolEventScheduler } from "./_components/SchoolEventScheduler";

export const metadata: Metadata = {
	title: "Сургуулийн хуваарь ба үйл явдал",
	description:
		"Сургуулийн эвент болон багшаас оруулсан шалгалтын хуваарийг даваа–нямын тороор харах.",
};

export default function AiSchedulerSchoolEventPage() {
	return <SchoolEventScheduler />;
}
