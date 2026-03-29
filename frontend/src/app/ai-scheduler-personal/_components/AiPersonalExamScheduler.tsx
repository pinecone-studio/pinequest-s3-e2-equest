"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
	addDays,
	format,
	isSameDay,
	parseISO,
	startOfDay,
	startOfWeek,
} from "date-fns";
import { mn } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ApproveAiExamScheduleDocument,
	GetAiExamScheduleDocument,
	RequestAiExamScheduleDocument,
} from "@/gql/create-exam-documents";
import type {
	ExamSchedule,
	ExamScheduleVariant,
	RequestExamSchedulePayload,
} from "@/gql/graphql";
import { cn } from "@/lib/utils";
import {
	ArrowRight,
	ChevronRight,
	Loader2,
	Menu,
	PanelRight,
	Play,
	Square,
	Circle,
	Triangle,
} from "lucide-react";

const DEFAULT_TEST_ID = "a1000000-0000-4000-8000-000000000001";
const DEFAULT_CLASS_ID = "10A";

const panelDark = "rounded-2xl border border-zinc-800/90 bg-zinc-900/70";
const textDim = "text-zinc-500";
const textBody = "text-zinc-400";

type RequestAiExamScheduleData = {
	requestAiExamSchedule: RequestExamSchedulePayload;
};

type RequestAiExamScheduleVars = {
	testId: string;
	classId: string;
	preferredDate: string;
};

type GetAiExamScheduleData = {
	getAiExamSchedule?: ExamSchedule | null;
};

type GetAiExamScheduleVars = {
	examId: string;
};

type ApproveAiExamScheduleData = {
	approveAiExamSchedule: ExamSchedule;
};

type ApproveAiExamScheduleVars = {
	examId: string;
	variantId: string;
};

function formatVariantWhen(iso: string) {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return format(d, "yyyy-MM-dd HH:mm", { locale: mn });
	} catch {
		return iso;
	}
}

function parseStart(iso: string | null | undefined) {
	if (!iso) return null;
	try {
		const d = parseISO(iso);
		return Number.isNaN(d.getTime()) ? null : d;
	} catch {
		return null;
	}
}

/** Reclaim-тай адил олон давхарга: хольж биш давхарлан харуулна. */
type CalendarLayerId = "primary" | "exam" | "school";

const CALENDAR_LAYERS: {
	id: CalendarLayerId;
	label: string;
	role: string;
	swatch: string;
}[] = [
	{
		id: "primary",
		label: "Үндсэн хуваарь",
		role: "Хязгаарлалт",
		swatch: "bg-emerald-500",
	},
	{
		id: "exam",
		label: "Шалгалтын хуанли",
		role: "AI үр дүн",
		swatch: "bg-blue-500",
	},
	{
		id: "school",
		label: "Сургуулийн эвент",
		role: "Цаг хаагч",
		swatch: "bg-rose-500",
	},
];

function ReclaimDarkBackdrop() {
	return (
		<div className="pointer-events-none fixed inset-0 -z-10 bg-[#0f0f10]" aria-hidden>
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-20%,rgba(59,130,246,0.08),transparent_55%)]" />
		</div>
	);
}

export function AiPersonalExamScheduler() {
	const [date, setDate] = useState<Date | undefined>(new Date());
	const [testId, setTestId] = useState(DEFAULT_TEST_ID);
	const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
	const [lastQueuedExamId, setLastQueuedExamId] = useState<string | null>(
		null,
	);
	const [pollExamId, setPollExamId] = useState<string | null>(null);
	const [liveSchedule, setLiveSchedule] = useState<ExamSchedule | null>(null);
	const [rightTab, setRightTab] = useState<"ai" | "form">("ai");
	const [layerOn, setLayerOn] = useState<Record<CalendarLayerId, boolean>>({
		primary: true,
		exam: true,
		school: true,
	});
	const toastKeyRef = useRef<string>("");

	function toggleLayer(id: CalendarLayerId) {
		setLayerOn((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	const [requestSchedule, { loading: queueLoading }] = useMutation<
		RequestAiExamScheduleData,
		RequestAiExamScheduleVars
	>(RequestAiExamScheduleDocument);

	const [approveSchedule, { loading: approveLoading }] = useMutation<
		ApproveAiExamScheduleData,
		ApproveAiExamScheduleVars
	>(ApproveAiExamScheduleDocument);

	const { data: pollData } = useQuery<
		GetAiExamScheduleData,
		GetAiExamScheduleVars
	>(GetAiExamScheduleDocument, {
		variables: { examId: pollExamId ?? "" },
		skip: !pollExamId,
		pollInterval: pollExamId ? 2500 : 0,
		fetchPolicy: "network-only",
		notifyOnNetworkStatusChange: true,
	});

	useEffect(() => {
		const row = pollData?.getAiExamSchedule;
		if (row) {
			setLiveSchedule(row);
		}
	}, [pollData]);

	useEffect(() => {
		const row = pollData?.getAiExamSchedule;
		if (!row || !pollExamId) return;
		const st = row.status;
		if (st === "suggested") {
			setPollExamId(null);
			const key = `${row.id}:suggested`;
			if (toastKeyRef.current === key) return;
			toastKeyRef.current = key;
			toast.message("Саналууд бэлэн", {
				description: "Баруун панелаас хувилбар сонгоно уу.",
			});
			return;
		}
		if (st !== "confirmed" && st !== "failed") return;
		const key = `${row.id}:${st}`;
		if (toastKeyRef.current === key) return;
		toastKeyRef.current = key;
		if (st === "confirmed") {
			toast.success("Хуваарь баталгаажлаа.");
		} else {
			toast.error(row.aiReasoning ?? "AI scheduler алдаатай дууслаа.");
		}
		setPollExamId(null);
	}, [pollData?.getAiExamSchedule, pollExamId]);

	async function handleApproveVariant(v: ExamScheduleVariant) {
		const examId = liveSchedule?.id ?? lastQueuedExamId;
		if (!examId) {
			toast.error("examId олдсонгүй.");
			return;
		}
		try {
			const { data } = await approveSchedule({
				variables: { examId, variantId: v.id },
			});
			const next = data?.approveAiExamSchedule;
			if (next) {
				setLiveSchedule(next);
				toastKeyRef.current = `${next.id}:confirmed`;
				toast.success("Сонгосон хувилбар баталгаажлаа.");
			}
		} catch (e: unknown) {
			const msg =
				e && typeof e === "object" && "message" in e
					? String((e as { message: string }).message)
					: "Батлахад алдаа гарлаа.";
			toast.error(msg);
		}
	}

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
			const payload = data?.requestAiExamSchedule;
			if (payload?.success) {
				toastKeyRef.current = "";
				if (payload.examId) {
					setLiveSchedule(null);
					setLastQueuedExamId(payload.examId);
					setPollExamId(payload.examId);
				}
				toast.success(payload.message, {
					description: payload.examId ? `examId: ${payload.examId}` : undefined,
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

	const anchor = date ?? new Date();
	const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

	const scheduleStart = liveSchedule
		? parseStart(liveSchedule.startTime)
		: null;
	const suggested = liveSchedule?.status === "suggested";
	const showJob =
		liveSchedule && liveSchedule.id === lastQueuedExamId ? liveSchedule : null;

	/** 08:00–20:00 хүрээнд блокын байрлал (%) */
	function blockTopPercent(d: Date) {
		const h = d.getHours() + d.getMinutes() / 60;
		const t = Math.min(Math.max((h - 8) / 12, 0), 1);
		return t * 100;
	}

	return (
		<div
			className={cn(
				"relative min-h-screen overflow-x-hidden bg-[#0f0f10] font-sans text-zinc-100 antialiased",
				"selection:bg-blue-500/30 selection:text-white",
			)}
		>
			<ReclaimDarkBackdrop />

			<div className="relative z-10 flex min-h-screen flex-col">
				{/* Дээд мөр */}
				<header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 sm:px-5">
					<div className="flex min-w-0 items-center gap-3">
						<div
							className="flex size-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300"
							aria-hidden
						>
							<Menu className="size-5" strokeWidth={1.5} />
						</div>
						<div className="min-w-0">
							<h1 className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
								Багшийн хуваарь
							</h1>
							<p className={cn("truncate text-xs", textDim)}>
								Олон давхаргат хуанли ·{" "}
								{format(anchor, "yyyy MMMM", { locale: mn })}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{pollExamId ? (
							<span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
								<Loader2 className="size-3.5 animate-spin text-blue-400" />
								Синк…
							</span>
						) : null}
						<Link
							href="/ai-scheduler-school-event"
							className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
						>
							Сургуулийн хуанли
						</Link>
					</div>
				</header>

				<div className="flex min-h-0 flex-1 flex-col xl:flex-row">
					{/* Зүүн: жижиг хуанли + өнгөт жагсаалт */}
					<aside
						className={cn(
							"flex w-full shrink-0 flex-col gap-4 border-zinc-800 p-4 xl:w-[272px] xl:border-r",
						)}
					>
						<div className={cn(panelDark, "p-3")}>
							<div className="mb-2 flex items-center justify-between px-1">
								<span className="text-xs font-medium text-zinc-400">
									Сонгох өдөр
								</span>
							</div>
							<div
								className={cn(
									"flex justify-center rounded-xl bg-zinc-950/60 p-1",
									"[&_button[data-selected-single=true]]:rounded-full! [&_button[data-selected-single=true]]:bg-blue-600! [&_button[data-selected-single=true]]:text-white!",
									"[&_button[data-selected-single=true]]:shadow-lg [&_button[data-selected-single=true]]:shadow-blue-500/20",
								)}
							>
								<Calendar
									mode="single"
									selected={date}
									onSelect={setDate}
									locale={mn}
									buttonVariant="ghost"
									className="text-zinc-200 [--cell-size:2rem] scale-[0.92] origin-top"
									classNames={{
										caption_label:
											"text-[13px] font-semibold text-zinc-100",
										button_previous:
											"rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-300 size-8 hover:bg-zinc-800",
										button_next:
											"rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-300 size-8 hover:bg-zinc-800",
										weekday:
											"text-[10px] font-medium uppercase text-zinc-600",
										day: "text-zinc-400",
										today:
											"text-blue-300 [&:not([data-selected])_button]:ring-1 [&:not([data-selected])_button]:ring-blue-500/40 [&:not([data-selected])_button]:rounded-full",
										outside: "text-zinc-700 opacity-50",
										disabled: "opacity-30",
									}}
								/>
							</div>
						</div>

						<div className={cn(panelDark, "divide-y divide-zinc-800/80")}>
							<p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
								Давхарга
							</p>
							{CALENDAR_LAYERS.map((layer) => {
								const on = layerOn[layer.id];
								return (
									<button
										key={layer.id}
										type="button"
										aria-pressed={on}
										onClick={() => toggleLayer(layer.id)}
										className={cn(
											"flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
											on
												? "bg-zinc-800/40 text-zinc-200"
												: "text-zinc-500 hover:bg-zinc-800/30",
										)}
									>
										<span
											className={cn(
												"size-2.5 shrink-0 rounded-sm",
												layer.swatch,
												!on && "opacity-35",
											)}
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium">
												{layer.label}
											</span>
											<span className="block truncate text-[10px] text-zinc-500">
												{layer.role}
											</span>
										</span>
										<span
											className={cn(
												"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
												on
													? "bg-zinc-700 text-zinc-200"
													: "bg-zinc-800/80 text-zinc-600",
											)}
										>
											{on ? "Идэвхтэй" : "Нуугдсан"}
										</span>
									</button>
								);
							})}
						</div>
					</aside>

					{/* Төв: 7 хоногийн тор */}
					<main className="min-h-[480px] min-w-0 flex-1 overflow-auto border-zinc-800 p-3 sm:p-4 xl:border-r">
						<div className={cn(panelDark, "flex h-full min-h-[440px] flex-col p-3")}>
							<div className="mb-3 grid grid-cols-7 gap-1.5 border-b border-zinc-800/90 pb-3">
								{weekDays.map((d, i) => {
									const isSel = isSameDay(d, anchor);
									return (
										<div key={d.toISOString()} className="text-center">
											<div
												className={cn(
													"mx-auto flex size-9 items-center justify-center rounded-full text-xs font-medium",
													isSel
														? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
														: "bg-zinc-800 text-zinc-500",
												)}
											>
												{format(d, "EEEEE", { locale: mn })}
											</div>
											<p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
												{format(d, "EEE", { locale: mn })}
											</p>
											<p className="text-sm font-semibold text-zinc-200">
												{format(d, "d")}
											</p>
										</div>
									);
								})}
							</div>

							<div className="relative grid min-h-[380px] flex-1 grid-cols-7 gap-1.5">
								{weekDays.map((d, colIdx) => {
									const sameDay =
										scheduleStart && isSameDay(scheduleStart, d);
									const top = scheduleStart
										? blockTopPercent(scheduleStart)
										: 28;

									return (
										<div
											key={`col-${colIdx}`}
											className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/40"
										>
											{layerOn.school && colIdx === 4 ? (
												<div
													className="absolute left-0.5 right-0.5 top-[8%] z-1 rounded-xl border-2 border-dashed border-rose-400/55 bg-rose-950/50 px-2 py-2 text-[10px] font-semibold leading-tight text-rose-100 shadow-inner"
													style={{ height: "42%" }}
												>
													Сургуулийн арга хэмжээ
													<span className="mt-1 block font-normal text-rose-200/85">
														Бүх анги · цаг хаагч
													</span>
												</div>
											) : null}

											{layerOn.primary && colIdx === 0 ? (
												<div
													className="absolute left-1 right-1 top-[8%] rounded-xl border border-emerald-500/35 bg-emerald-600/20 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-50 shadow-sm"
													style={{ height: "52px" }}
												>
													Математик · 10А
													<span className="mt-0.5 block font-normal text-emerald-200/80">
														Үндсэн хуваарь
													</span>
												</div>
											) : null}
											{layerOn.primary && colIdx === 1 ? (
												<div
													className="absolute left-1 right-1 top-[22%] rounded-xl border border-emerald-500/35 bg-emerald-600/20 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-50 shadow-sm"
													style={{ height: "48px" }}
												>
													Физик · 10А
												</div>
											) : null}
											{layerOn.primary && colIdx === 5 ? (
												<div
													className="absolute left-1 right-1 top-[18%] rounded-xl border border-emerald-500/35 bg-emerald-600/20 px-2 py-1.5 text-[10px] font-medium leading-tight text-emerald-50 shadow-sm"
													style={{ height: "48px" }}
												>
													Түүх · 10А
												</div>
											) : null}
											{layerOn.primary && colIdx === 3 ? (
												<div
													className="absolute left-1 right-1 top-[38%] rounded-xl border border-amber-300/30 bg-amber-400/25 px-2 py-1.5 text-[10px] font-medium text-amber-950 shadow-sm"
													style={{ height: "40px" }}
												>
													Завсарлага
												</div>
											) : null}
											{layerOn.primary && colIdx === 6 ? (
												<div
													className="absolute left-1 right-1 top-[48%] rounded-xl border border-zinc-600/40 bg-zinc-800/50 px-2 py-1.5 text-[10px] text-zinc-400"
													style={{ height: "36px" }}
												>
													Бэлтгэл цаг
												</div>
											) : null}

											{layerOn.exam && suggested && colIdx === 2 ? (
												<>
													<div
														className="absolute left-0.5 right-0.5 z-10 w-[calc(100%-4px)] -rotate-2 rounded-xl border-2 border-blue-400/60 bg-blue-600 px-2 py-2 text-[10px] font-semibold leading-tight text-white shadow-xl shadow-blue-600/40"
														style={{ top: "18%", minHeight: "56px" }}
													>
														AI санал
														<span className="mt-0.5 block font-normal opacity-90">
															Шалгалт
														</span>
													</div>
													<svg
														className="pointer-events-none absolute left-[40%] top-[32%] z-5 h-16 w-24 text-amber-400/90"
														viewBox="0 0 96 64"
														fill="none"
														aria-hidden
													>
														<path
															d="M8 8 Q 48 40 88 52"
															stroke="currentColor"
															strokeWidth="2"
															strokeLinecap="round"
														/>
														<path
															d="M82 46 L88 52 L80 54"
															stroke="currentColor"
															strokeWidth="2"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</svg>
													<div
														className="absolute left-1 right-1 top-[58%] rounded-xl border-2 border-dashed border-amber-400/50 bg-amber-400/10 px-2 py-1.5 text-center text-[9px] font-medium text-amber-200/90"
														style={{ height: "44px" }}
													>
														Сул цонх
													</div>
												</>
											) : null}

											{layerOn.exam &&
											showJob &&
											sameDay &&
											!suggested &&
											showJob.status !== "pending" ? (
												<div
													className={cn(
														"absolute left-1 right-1 rounded-xl border px-2 py-1.5 text-[10px] font-medium leading-tight shadow-md",
														showJob.status === "confirmed" &&
															"border-emerald-500/40 bg-emerald-600/30 text-emerald-50",
														showJob.status === "failed" &&
															"border-red-500/40 bg-red-600/25 text-red-100",
													)}
													style={{
														top: `${Math.min(top, 78)}%`,
														minHeight: "48px",
													}}
												>
													{showJob.status === "confirmed"
														? "Баталсан шалгалт"
														: "Алдаа"}
												</div>
											) : null}

											{layerOn.exam &&
											showJob &&
											sameDay &&
											showJob.status === "pending" ? (
												<div
													className="absolute left-1 right-1 rounded-xl border border-amber-500/35 bg-amber-500/20 px-2 py-1.5 text-[10px] font-medium text-amber-100"
													style={{ top: `${Math.min(top, 72)}%`, minHeight: "44px" }}
												>
													Хүлээгдэж буй…
												</div>
											) : null}
										</div>
									);
								})}
							</div>

							<p className={cn("mt-2 text-center text-[10px] leading-relaxed", textDim)}>
								Гурван давхарга: ногоон — үндсэн хичээл (хязгаарлалт), улаан — сургуулийн
								эвент (хаагч), цэнхэр — AI шалгалтын санал. Тор нь жишээ + таны
								job-ийн төлөв; бүрэн sync биш.
							</p>
						</div>
					</main>

					{/* Баруун: Reclaim-т төстэй хар панел */}
					<aside className="flex w-full shrink-0 flex-col border-zinc-800 bg-zinc-950 xl:w-[320px] xl:border-l">
						<div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
							<div className="flex items-center gap-1 text-blue-400">
								<Square className="size-2.5 fill-current" />
								<Circle className="size-2 fill-current" />
								<Triangle className="size-2.5 fill-current" />
							</div>
							<span className="text-sm font-semibold tracking-tight text-white">
								PineQuest AI
							</span>
						</div>

						<div className="flex gap-1 border-b border-zinc-800 px-3 py-2">
							<button
								type="button"
								onClick={() => setRightTab("ai")}
								className={cn(
									"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
									rightTab === "ai"
										? "bg-blue-600 text-white"
										: "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200",
								)}
							>
								AI хуваарь
							</button>
							<button
								type="button"
								onClick={() => setRightTab("form")}
								className={cn(
									"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
									rightTab === "form"
										? "bg-blue-600 text-white"
										: "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200",
								)}
							>
								Тохиргоо
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-4">
							{rightTab === "form" ? (
								<div className="space-y-4">
									<div className="space-y-2">
										<Label
											htmlFor="scheduler-test-id"
											className="text-xs text-zinc-500"
										>
											testId
										</Label>
										<Input
											id="scheduler-test-id"
											value={testId}
											onChange={(e) => setTestId(e.target.value)}
											className="rounded-xl border-zinc-700 bg-zinc-900 font-mono text-xs text-zinc-200"
											autoComplete="off"
										/>
									</div>
									<div className="space-y-2">
										<Label
											htmlFor="scheduler-class-id"
											className="text-xs text-zinc-500"
										>
											classId
										</Label>
										<Input
											id="scheduler-class-id"
											value={classId}
											onChange={(e) => setClassId(e.target.value)}
											placeholder="10A"
											className="rounded-xl border-zinc-700 bg-zinc-900 font-mono text-sm text-zinc-200"
											autoComplete="off"
										/>
									</div>
									<Button
										type="button"
										disabled={queueLoading}
										onClick={() => void handleQueueSchedule()}
										className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
									>
										{queueLoading ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<span className="flex items-center justify-center gap-2">
												Тооцоолох
												<ArrowRight className="size-4" />
											</span>
										)}
									</Button>
									{lastQueuedExamId ? (
										<p className="break-all font-mono text-[10px] text-zinc-500">
											{lastQueuedExamId}
										</p>
									) : null}
								</div>
							) : (
								<div className="space-y-3">
									{pollExamId ? (
										<div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-400">
											<Loader2 className="size-3.5 animate-spin text-blue-400" />
											getAiExamSchedule…
										</div>
									) : null}

									{showJob ? (
										<div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
											<div className="mb-2 flex items-center justify-between">
												<span className="text-xs text-zinc-500">Төлөв</span>
												<Badge
													variant="outline"
													className="border-zinc-600 font-mono text-[10px] text-zinc-300"
												>
													{showJob.status}
												</Badge>
											</div>
											<p className="font-mono text-[11px] text-zinc-400">
												{showJob.startTime}
											</p>
											{showJob.aiReasoning ? (
												<p className="mt-2 text-xs leading-relaxed text-zinc-500">
													{showJob.aiReasoning}
												</p>
											) : null}
										</div>
									) : (
										<div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-3 py-8 text-center text-xs text-zinc-500">
											<PanelRight className="mx-auto mb-2 size-8 opacity-40" />
											Эхлээд «Тохиргоо»-оос тооцоолох товч дарна уу.
										</div>
									)}

									{showJob?.status === "suggested" &&
									showJob.aiVariants?.length ? (
										<div className="space-y-2">
											<p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
												Сонгох
											</p>
											{showJob.aiVariants.map((v) => (
												<div
													key={v.id}
													className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 py-2 pl-3 pr-2"
												>
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm font-medium text-zinc-200">
															{v.label}
														</p>
														<p className="font-mono text-[10px] text-zinc-500">
															{formatVariantWhen(v.startTime)}
														</p>
													</div>
													<button
														type="button"
														disabled={approveLoading}
														onClick={() => void handleApproveVariant(v)}
														className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50"
														aria-label="Батлах"
													>
														{approveLoading ? (
															<Loader2 className="size-4 animate-spin" />
														) : (
															<Play className="size-4 translate-x-0.5 fill-current" />
														)}
													</button>
												</div>
											))}
										</div>
									) : null}
								</div>
							)}
						</div>

						<div className="border-t border-zinc-800 p-3">
							<button
								type="button"
								onClick={() =>
									setRightTab((t) => (t === "form" ? "ai" : "form"))
								}
								className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 text-xs font-medium text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
							>
								<ChevronRight
									className={cn(
										"size-4 transition-transform",
										rightTab === "form" && "-rotate-90",
									)}
								/>
								{rightTab === "form" ? "Төлөв рүү" : "Тохиргоо нээх"}
							</button>
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}
