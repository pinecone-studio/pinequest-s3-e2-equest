"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { mn } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Building2, CalendarDays, GraduationCap, PartyPopper } from "lucide-react";

const cardSurface =
	"rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_24px_-4px_rgba(59,130,246,0.08)]";

const textBody = "text-slate-600";
const textMuted = "text-slate-500";

function SchoolBackdrop() {
	return (
		<div
			className="pointer-events-none fixed inset-0 -z-10 bg-slate-50"
			aria-hidden
		>
			<div className="absolute inset-0 bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_50%,#f1f5f9_100%)]" />
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_-10%,rgba(59,130,246,0.12),transparent_50%)]" />
		</div>
	);
}

export function SchoolEventScheduler() {
	const [date, setDate] = useState<Date | undefined>(new Date());

	const selectedLabel = date
		? format(date, "EEEE, MMMM d", { locale: mn })
		: "—";

	return (
		<div
			className={cn(
				"relative min-h-screen overflow-x-hidden font-sans text-slate-900 antialiased",
				"selection:bg-sky-200/90 selection:text-sky-950",
			)}
		>
			<SchoolBackdrop />

			<div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
				<header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Badge className="rounded-md border-0 bg-sky-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm shadow-sky-500/25">
								<Building2 className="mr-1 size-3" />
								Сургууль
							</Badge>
							<Badge
								variant="outline"
								className="rounded-md border-sky-200 bg-sky-50/90 text-[11px] font-medium text-sky-900"
							>
								Нийтлэг хуанли
							</Badge>
						</div>
						<p className="text-sm font-medium text-slate-500">{selectedLabel}</p>
						<h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem] sm:leading-tight">
							Сургуулийн хуваарь ба үйл явдал
						</h1>
						<p className={cn("max-w-xl text-pretty text-[15px] leading-relaxed", textBody)}>
							Энд багш нарын{" "}
							<strong className="font-semibold text-slate-800">
								товлосон шалгалтууд
							</strong>{" "}
							болон сургуулийн{" "}
							<strong className="font-semibold text-slate-800">
								том арга хэмжээ, албан ёсны өдөрлөг
							</strong>{" "}
							нийлж харагдана. Өөрийнхөө шалгалтыг AI-аар цаг оноохыг{" "}
							<Link
								href="/ai-scheduler-personal"
								className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
							>
								Багшийн хувийн хуваарь
							</Link>
							-аас хийнэ үү.
						</p>
					</div>
				</header>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
					<div className="lg:col-span-5">
						<div className={cn(cardSurface, "overflow-hidden")}>
							<div className="border-b border-slate-100 bg-gradient-to-r from-sky-50/90 to-white px-5 py-4 sm:px-6">
								<div className="flex items-center gap-2">
									<div className="flex size-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-md shadow-sky-500/20">
										<CalendarDays className="size-[18px]" strokeWidth={2} />
									</div>
									<div>
										<p className="text-sm font-semibold text-slate-900">
											Хуанли
										</p>
										<p className={cn("text-xs", textMuted)}>
											Өдөр сонгоход доорх жагсаалт шүүгдэнэ (дараагийн алхам)
										</p>
									</div>
								</div>
							</div>
							<div className="p-4 sm:p-6">
								<div
									className={cn(
										"flex justify-center rounded-xl border border-slate-100 bg-slate-50/80 p-4",
										"[&_button[data-selected-single=true]]:!rounded-lg [&_button[data-selected-single=true]]:!bg-sky-600 [&_button[data-selected-single=true]]:!text-white",
										"[&_button[data-selected-single=true]]:shadow-md [&_button[data-selected-single=true]]:shadow-sky-500/20",
										"[&_button[data-selected-single=true]]:hover:!bg-sky-700",
									)}
								>
									<Calendar
										mode="single"
										selected={date}
										onSelect={setDate}
										locale={mn}
										buttonVariant="ghost"
										className="text-slate-800 [--cell-size:2.55rem]"
										classNames={{
											caption_label:
												"text-base font-semibold tracking-tight text-slate-900",
											button_previous:
												"rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 size-9",
											button_next:
												"rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 size-9",
											weekday:
												"text-[11px] font-semibold uppercase tracking-wider text-slate-400",
											day: "text-slate-700",
											today:
												"text-sky-700 [&:not([data-selected])_button]:bg-sky-100 [&:not([data-selected])_button]:rounded-lg [&:not([data-selected])_button]:font-semibold",
											outside: "text-slate-300",
											disabled: "text-slate-200",
										}}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-6 lg:col-span-7">
						<Card className={cn(cardSurface, "shadow-md shadow-slate-200/50")}>
							<CardHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-slate-100 pb-4">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
									<GraduationCap className="size-5" strokeWidth={2} />
								</div>
								<div className="min-w-0">
									<CardTitle className="text-lg font-bold text-slate-900">
										Багшдын товлосон шалгалт
									</CardTitle>
									<CardDescription className={cn("text-sm", textBody)}>
										Батлагдсан шалгалтын цаг, анги, танхим нэг дор харагдана.
									</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="pt-6">
								<div
									className={cn(
										"rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center",
									)}
								>
									<p className="text-sm font-medium text-slate-700">
										Одоогоор жагсаалт хоосон
									</p>
									<p className={cn("mx-auto mt-2 max-w-md text-sm", textMuted)}>
										Дараагийн алхамд нийтлэг GraphQL query (жишээ нь
										календарийн өдрөөр шүүсэн exam_schedules) энд холбогдоно.
									</p>
								</div>
							</CardContent>
						</Card>

						<Card className={cn(cardSurface, "shadow-md shadow-slate-200/50")}>
							<CardHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-slate-100 pb-4">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
									<PartyPopper className="size-5" strokeWidth={2} />
								</div>
								<div className="min-w-0">
									<CardTitle className="text-lg font-bold text-slate-900">
										Сургуулийн том үйл явдал
									</CardTitle>
									<CardDescription className={cn("text-sm", textBody)}>
										Спортын наадам, элсэлтийн өдөр, төслийн танилцуулга гэх мэт
										албан ёсны арга хэмжээ.
									</CardDescription>
								</div>
							</CardHeader>
							<CardContent className="pt-6">
								<div
									className={cn(
										"rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center",
									)}
								>
									<p className="text-sm font-medium text-slate-700">
										Одоогоор жагсаалт хоосон
									</p>
									<p className={cn("mx-auto mt-2 max-w-md text-sm", textMuted)}>
										Тусдаа хүснэгт эсвэл endpoint-оор school events оруулж, энэ
										хэсэгт харуулна.
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
