"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CalendarClock, CalendarDays, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiTeacherPersonalScheduler } from "@/app/ai-scheduler-teacher/_components/AiTeacherPersonalScheduler";
import { SchoolEventScheduler } from "@/app/ai-scheduler-school-event/_components/SchoolEventScheduler";

export function AiSchedulerHubClient() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const view = searchParams.get("view") === "school" ? "school" : "personal";

	const setView = useCallback(
		(next: "personal" | "school") => {
			const url =
				next === "school" ? "/ai-scheduler?view=school" : "/ai-scheduler";
			router.replace(url, { scroll: false });
		},
		[router],
	);

	const navBtn =
		"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors";
	const navInactive =
		"text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
	const navActive = "bg-blue-50 text-blue-900 ring-1 ring-blue-200/80";

	return (
		<div className="flex min-h-screen bg-[#f4f5f7]">
			<aside
				className="flex w-[min(100%,240px)] shrink-0 flex-col border-r border-zinc-200/90 bg-white shadow-sm shadow-zinc-200/30"
				aria-label="Хуваарь сонгох"
			>
				<div className="border-b border-zinc-100 px-4 py-3">
					<p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
						AI хуваарь
					</p>
					<p className="truncate text-sm font-semibold text-zinc-900">
						Харагдац
					</p>
				</div>
				<nav className="flex flex-col gap-1 p-3">
					<button
						type="button"
						onClick={() => setView("school")}
						className={cn(
							navBtn,
							view === "school" ? navActive : navInactive,
						)}
						aria-current={view === "school" ? "page" : undefined}
					>
						<CalendarDays className="size-5 shrink-0 text-blue-600" strokeWidth={1.75} />
						<span className="min-w-0">Сургуулийн хуанли</span>
					</button>
					<button
						type="button"
						onClick={() => setView("personal")}
						className={cn(
							navBtn,
							view === "personal" ? navActive : navInactive,
						)}
						aria-current={view === "personal" ? "page" : undefined}
					>
						<CalendarClock className="size-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
						<span className="min-w-0">Багшийн хувийн хуваарь</span>
					</button>
					<Link
						href="/ai-exam"
						className={cn(
							navBtn,
							"text-zinc-600 no-underline hover:bg-zinc-100 hover:text-zinc-900",
						)}
					>
						<FileQuestion className="size-5 shrink-0 text-amber-600" strokeWidth={1.75} />
						<span className="min-w-0">Шалгалт үүсгэх</span>
					</Link>
				</nav>
			</aside>
			<div className="min-h-screen min-w-0 flex-1">
				{view === "school" ? (
					<SchoolEventScheduler shellMode />
				) : (
					<AiTeacherPersonalScheduler shellMode />
				)}
			</div>
		</div>
	);
}
