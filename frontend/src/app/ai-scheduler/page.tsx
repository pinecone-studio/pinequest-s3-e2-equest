import type { Metadata } from "next";
import { Suspense } from "react";
import { AiSchedulerHubClient } from "./_components/AiSchedulerHubClient";

export const metadata: Metadata = {
	title: "AI хуваарь",
	description:
		"Багшийн хувийн хуваарь болон сургуулийн нийтлэг хуанли — нэг цэгээс.",
};

function HubFallback() {
	return (
		<div className="min-h-screen bg-[#F1F4FA]" aria-busy="true" aria-label="Ачааллаж байна" />
	);
}

export default function AiSchedulerHubPage() {
	return (
		<Suspense fallback={<HubFallback />}>
			<AiSchedulerHubClient />
		</Suspense>
	);
}
