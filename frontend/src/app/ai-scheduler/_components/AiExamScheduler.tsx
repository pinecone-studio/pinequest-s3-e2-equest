"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { format, startOfDay } from "date-fns";
import { mn } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RequestExamScheduleDocument } from "@/gql/create-exam-documents";
import type { RequestExamSchedulePayload } from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
	ArrowRight,
	Bot,
	CalendarDays,
	CheckCircle2,
	Clock,
	Layers,
	Loader2,
	Sparkles,
	Zap,
} from "lucide-react";

const quickPrompts = [
	"10А · Математик · 90 мин",
	"11Б · Физик · сул өдөр",
	"12А · Монгол хэл · өглөөний цаг",
];

const upcomingMock = [
	{ title: "Математик · 10А", time: "10:00", room: "302", tone: "confirmed" },
	{ title: "Физик · 11Б", time: "14:00", room: "105", tone: "pending" },
];

/** Seed `ai_exam_templates` / `scheduler_digital_twin_seed`-тай тааруулсан анхны утгууд */
const DEFAULT_TEST_ID = "a1000000-0000-4000-8000-000000000001";
const DEFAULT_CLASS_ID = "10A";

type RequestExamScheduleData = {
	requestExamSchedule: RequestExamSchedulePayload;
};

type RequestExamScheduleVars = {
	testId: string;
	classId: string;
	preferredDate: string;
};

/** Цайвар + шилэн bento — AI продуктуудын одоогийн хэв маяг */
const bentoSurface =
	"rounded-3xl border border-white/80 bg-white/65 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_20px_50px_-20px_rgba(15,23,42,0.14)] ring-0 backdrop-blur-2xl";

function AmbientBackdrop() {
	return (
		<div
			className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
			aria-hidden
		>
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(139,92,246,0.14),transparent_55%)]" />
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(34,211,238,0.10),transparent_50%)]" />
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(232,121,249,0.08),transparent_45%)]" />
			<div
				className="absolute inset-0 opacity-[0.5]"
				style={{
					backgroundImage: `linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)`,
					backgroundSize: "56px 56px",
				}}
			/>
		</div>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	hint,
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	hint: string;
}) {
	return (
		<div
			className={cn(
				bentoSurface,
				"group relative overflow-hidden p-5 transition-all duration-300",
				"hover:-translate-y-0.5 hover:border-violet-200/90 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_28px_56px_-16px_rgba(109,40,217,0.18)]",
			)}
		>
			<div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-violet-400/25 to-cyan-400/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-70" />
			<div className="relative flex items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
						{label}
					</p>
					<p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-[1.75rem]">
						{value}
					</p>
					<p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
				</div>
				<div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 ring-1 ring-violet-200/50 text-violet-600">
					<Icon className="size-5" strokeWidth={1.5} />
				</div>
			</div>
		</div>
	);
}

export function AiExamScheduler() {
	const [date, setDate] = useState<Date | undefined>(new Date());
	const [prompt, setPrompt] = useState("");
	const [testId, setTestId] = useState(DEFAULT_TEST_ID);
	const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
	const [lastQueuedExamId, setLastQueuedExamId] = useState<string | null>(
		null,
	);

	const [requestSchedule, { loading: queueLoading }] = useMutation<
		RequestExamScheduleData,
		RequestExamScheduleVars
	>(RequestExamScheduleDocument);

	async function handleQueueSchedule() {
		const tid = testId.trim();
		const cid = classId.trim();
		if (!tid || !cid) {
			toast.error("Шалгалтын загварын ID болон ангийн ID заавал бөглөнө.");
			return;
		}
		const day = date ?? new Date();
		const preferredDate = startOfDay(day).toISOString();

		try {
			const { data } = await requestSchedule({
				variables: {
					testId: tid,
					classId: cid,
					preferredDate,
				},
			});
			const payload = data?.requestExamSchedule;
			if (payload?.success) {
				if (payload.examId) setLastQueuedExamId(payload.examId);
				toast.success(payload.message, {
					description: payload.examId
						? `examId: ${payload.examId} — consumer дараа нь D1-д батална.`
						: undefined,
				});
			} else {
				toast.error(payload?.message ?? "Дараалалд оруулахад алдаа гарлаа.");
			}
		} catch (e: unknown) {
			const msg =
				e && typeof e === "object" && "message" in e
					? String((e as { message: string }).message)
					: "Сүлжээ эсвэл серверийн алдаа.";
			toast.error(msg);
		}
	}

	return (
		<div className="relative min-h-screen overflow-x-hidden bg-zinc-50/90 text-foreground">
			<AmbientBackdrop />

			<div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
				{/* Hero — градиент хүрээ + шилэн */}
				<div className="mb-10 sm:mb-12">
					<div className="rounded-[1.75rem] bg-gradient-to-br from-violet-400/35 via-white/50 to-cyan-400/30 p-px shadow-lg shadow-violet-500/10">
						<div className="flex flex-col gap-8 rounded-[1.7rem] border border-white/60 bg-white/75 px-6 py-8 backdrop-blur-2xl sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-10">
							<div className="max-w-2xl space-y-4">
								<div className="flex flex-wrap items-center gap-2">
									<Badge
										variant="outline"
										className="rounded-full border-zinc-200/80 bg-white/80 font-medium text-zinc-600 shadow-sm"
									>
										<Layers className="mr-1.5 size-3 opacity-70" />
										1-р сургууль · Scheduler
									</Badge>
									<Badge className="rounded-full border-0 bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-600 px-3 py-0.5 text-white shadow-md shadow-violet-500/25">
										<Sparkles className="mr-1.5 size-3" />
										AI-assisted
									</Badge>
								</div>
								<h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl">
									Exam Scheduler
									<span className="block mt-1 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-2xl font-medium text-transparent sm:text-3xl">
										интеллекттэй хуваарь
									</span>
								</h1>
								<p className="max-w-xl text-pretty text-[15px] leading-relaxed text-zinc-600">
									Хүсэлтээ бичээд дараалалд оруулна — AI танхим, цаг, давхцлыг
									тооцоолж, хуанли дээр баталгаажсан цэгүүдээр харуулна.
								</p>
							</div>
							<div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
								<div className="flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-4 py-2 text-xs font-semibold text-emerald-900 shadow-sm backdrop-blur-sm">
									<span className="relative flex h-2 w-2">
										<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
										<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
									</span>
									Queue идэвхтэй
								</div>
								<p className="text-right text-[11px] font-medium uppercase tracking-wider text-zinc-400">
									Сүүлийн синк · одоо
								</p>
							</div>
						</div>
					</div>
				</div>

				<div className="mb-8 grid gap-4 sm:grid-cols-3">
					<StatCard
						icon={Zap}
						label="Дараалалд"
						value="3"
						hint="энэ 7 хоногт"
					/>
					<StatCard
						icon={CheckCircle2}
						label="Батлагдсан"
						value="12"
						hint="AI + дүрмийн шалгалт"
					/>
					<StatCard
						icon={Clock}
						label="Дундаж хариу"
						value="~2.4с"
						hint="үлээлт + тооцоолол"
					/>
				</div>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
					<Card
						className={cn(
							bentoSurface,
							"border-violet-100/80 lg:col-span-5",
							"relative overflow-hidden before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-400/50 before:to-transparent",
						)}
					>
						<CardHeader className="space-y-1.5 pb-3">
							<CardTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight">
								<div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-600 p-px shadow-lg shadow-violet-500/20">
									<div className="flex size-full items-center justify-center rounded-2xl bg-white">
										<Bot className="size-5 text-violet-600" />
									</div>
								</div>
								Багшийн туслах
							</CardTitle>
							<CardDescription className="text-sm text-zinc-500">
								Товч эсвэл дэлгэрэнгүй — хоёуланд нь ойлгоно. Одоогоор
								илгээлтэд доорх ID + хуанлид сонгосон өдөр ашиглагдана.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2 sm:col-span-2">
									<Label
										htmlFor="scheduler-test-id"
										className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
									>
										Шалгалтын загвар (testId → ai_exam_templates.id)
									</Label>
									<Input
										id="scheduler-test-id"
										value={testId}
										onChange={(e) => setTestId(e.target.value)}
										className="rounded-xl border-zinc-200/80 bg-white/80 font-mono text-xs"
										autoComplete="off"
									/>
								</div>
								<div className="space-y-2">
									<Label
										htmlFor="scheduler-class-id"
										className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
									>
										Анги (classId)
									</Label>
									<Input
										id="scheduler-class-id"
										value={classId}
										onChange={(e) => setClassId(e.target.value)}
										placeholder="10A"
										className="rounded-xl border-zinc-200/80 bg-white/80 font-mono text-sm"
										autoComplete="off"
									/>
								</div>
								<div className="space-y-2">
									<Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
										Хүссэн өдөр
									</Label>
									<p className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 font-mono text-sm text-zinc-700">
										{date
											? startOfDay(date).toISOString().slice(0, 10)
											: "—"}
									</p>
									<p className="text-[11px] text-zinc-500">
										Хуанлиас өдөр сонгоно
									</p>
								</div>
							</div>
							<div className="space-y-2">
								<Label
									htmlFor="scheduler-prompt"
									className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
								>
									Тэмдэглэл (дараа нь AI-д ашиглана)
								</Label>
								<Textarea
									id="scheduler-prompt"
									placeholder="Жишээ: 12А ангийн Математикийн шалгалтыг ирэх долоо хоногийн сул цагт, 90 минутаар тавьж өгнө үү…"
									value={prompt}
									onChange={(e) => setPrompt(e.target.value)}
									className="min-h-[128px] resize-none rounded-2xl border-zinc-200/80 bg-white/80 text-[15px] shadow-inner shadow-zinc-900/5 transition-shadow focus-visible:ring-violet-500/30"
								/>
							</div>
							<div className="space-y-2">
								<p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
									Түргэн сонголт
								</p>
								<div className="flex flex-wrap gap-2">
									{quickPrompts.map((q) => (
										<button
											key={q}
											type="button"
											onClick={() => {
												setPrompt(q);
												if (q.startsWith("10А")) setClassId("10A");
												if (q.startsWith("11Б")) setClassId("11B");
												if (q.startsWith("12А")) setClassId("12A");
											}}
											className={cn(
												"rounded-full border border-zinc-200/90 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur-sm",
												"transition-all duration-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 hover:shadow-md",
											)}
										>
											{q}
										</button>
									))}
								</div>
							</div>
							<Button
								type="button"
								disabled={queueLoading}
								onClick={() => void handleQueueSchedule()}
								className="group relative h-12 w-full overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-600 text-[15px] font-semibold text-white shadow-lg shadow-violet-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/35 disabled:opacity-60"
							>
								<span
									className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
									aria-hidden
								/>
								<span className="relative flex items-center justify-center gap-2">
									{queueLoading ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Sparkles className="size-4" />
									)}
									{queueLoading ? "Илгээж байна…" : "Хуваарь дараалалд оруулах"}
									{!queueLoading && (
										<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
									)}
								</span>
							</Button>
							{lastQueuedExamId ? (
								<p className="text-center font-mono text-[11px] text-violet-700">
									Сүүлийн дараалал: {lastQueuedExamId}
								</p>
							) : null}
							<p className="text-center text-[11px] leading-relaxed text-zinc-500">
								Илгээсний дараа шууд батлахгүй — мессеж дараалалд орж, AI
								тооцоолол дуусмагц D1 дээр баталгаажина (consumer deploy + queue
								шаардлагатай).
							</p>
						</CardContent>
					</Card>

					<div className="flex flex-col gap-6 lg:col-span-7">
						<Card className={cn(bentoSurface, "flex-1")}>
							<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-3">
								<div>
									<CardTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
										<span className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-200/60">
											<CalendarDays className="size-[18px]" />
										</span>
										Хуанли
									</CardTitle>
									<CardDescription className="mt-1.5 text-sm">
										Сонгосон өдөр:{" "}
										<span className="font-mono font-medium text-zinc-800">
											{date
												? format(date, "yyyy-MM-dd", { locale: mn })
												: "—"}
										</span>
									</CardDescription>
								</div>
								<div className="flex flex-wrap gap-3 text-xs font-medium text-zinc-500">
									<span className="flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 ring-1 ring-amber-200/60">
										<span className="size-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
										Хүлээгдэж буй
									</span>
									<span className="flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-200/60">
										<span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
										Баталгаажсан
									</span>
								</div>
							</CardHeader>
							<CardContent className="flex flex-col gap-6 p-4 pt-0 sm:p-6">
								<div className="flex justify-center rounded-[1.35rem] border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/80 p-5 shadow-inner shadow-zinc-900/5 sm:p-7">
									<Calendar
										mode="single"
										selected={date}
										onSelect={setDate}
										locale={mn}
										className="rounded-xl [--cell-size:2.4rem]"
										classNames={{
											caption_label:
												"text-sm font-semibold text-zinc-900",
											weekday:
												"text-[0.65rem] font-bold uppercase tracking-[0.12em] text-zinc-400",
										}}
									/>
								</div>
								<div>
									<p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
										Удахгүй болох шалгалт
									</p>
									<div className="grid gap-3 sm:grid-cols-2">
										{upcomingMock.map((u) => (
											<div
												key={u.title + u.time}
												className={cn(
													"group flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-sm",
													"transition-all duration-200 hover:border-violet-200 hover:bg-white hover:shadow-md",
												)}
											>
												<div className="min-w-0 border-l-2 border-l-violet-400 pl-3">
													<p className="truncate text-sm font-semibold text-zinc-900">
														{u.title}
													</p>
													<p className="text-xs text-zinc-500">
														Өрөө {u.room}
													</p>
												</div>
												<div className="flex shrink-0 flex-col items-end gap-1">
													<span className="font-mono text-xs font-medium text-zinc-600">
														{u.time}
													</span>
													<Badge
														variant="outline"
														className={cn(
															"rounded-md border-0 px-2 py-0 text-[10px] font-semibold",
															u.tone === "confirmed"
																? "bg-emerald-100 text-emerald-800"
																: "bg-amber-100 text-amber-900",
														)}
													>
														{u.tone === "confirmed"
															? "Баталсан"
															: "Дараалалд"}
													</Badge>
												</div>
											</div>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				<Card
					className={cn(
						bentoSurface,
						"mt-8 border-violet-200/60 bg-gradient-to-br from-violet-50/95 via-white/80 to-cyan-50/90",
					)}
				>
					<CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-10 sm:p-8">
						<div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-start">
							<div className="relative flex size-16 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-600 p-px shadow-xl shadow-violet-500/25">
								<div className="flex size-full items-center justify-center rounded-[1.1rem] bg-white">
									<Sparkles className="size-7 text-violet-600" />
								</div>
							</div>
							<div className="sm:hidden">
								<p className="text-sm font-semibold text-zinc-900">
									AI шийдвэр гаргалт
								</p>
								<p className="text-xs text-zinc-500">Сүүлийн санал</p>
							</div>
						</div>
						<div className="min-w-0 flex-1 space-y-4">
							<div className="hidden sm:block">
								<p className="text-sm font-semibold text-zinc-900">
									AI шийдвэр гаргалт
								</p>
								<p className="text-xs text-zinc-500">
									Сүүлийн санал · жишээ өгөгдөл
								</p>
							</div>
							<ul className="space-y-3 text-sm leading-relaxed text-zinc-600">
								<li className="flex gap-3">
									<span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-500 ring-4 ring-violet-500/15" />
									<span>
										<strong className="font-semibold text-zinc-900">
											12А
										</strong>{" "}
										ангийн хуваарьт Даваа 1–2 цаг давхцахгүй цонх сонгосон.
									</span>
								</li>
								<li className="flex gap-3">
									<span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-500 ring-4 ring-cyan-500/15" />
									<span>
										<strong className="font-semibold text-zinc-900">
											302 тоот
										</strong>{" "}
										танхим багтаамж, сургалтын өрөөтэй нийцсэн.
									</span>
								</li>
								<li className="flex gap-3">
									<span className="mt-2 size-1.5 shrink-0 rounded-full bg-fuchsia-500 ring-4 ring-fuchsia-500/15" />
									<span>
										90 минутын үргэлжлэлтэй, өмнөх шалгалтаас 30+ минутын
										зайг хадгалсан.
									</span>
								</li>
							</ul>
							<div className="flex flex-wrap items-center gap-2 border-t border-zinc-200/80 pt-5">
								<Badge
									variant="outline"
									className="rounded-lg border-zinc-200 bg-white/80 font-mono text-[10px] font-medium text-zinc-600"
								>
									confidence ~94%
								</Badge>
								<Badge
									variant="outline"
									className="rounded-lg border-zinc-200 bg-white/80 font-mono text-[10px] font-medium text-zinc-600"
								>
									gemini-flash
								</Badge>
								<span className="text-xs text-zinc-500">
									Баталгаажуулах товч (дараагийн алхам)
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
