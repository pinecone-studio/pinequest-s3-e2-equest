"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
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
	Bot,
	CalendarDays,
	Layers,
	Loader2,
	Sparkles,
} from "lucide-react";

/** Seed `ai_exam_templates` / `scheduler_digital_twin_seed`-тай тааруулсан анхны утгууд */
const DEFAULT_TEST_ID = "a1000000-0000-4000-8000-000000000001";
const DEFAULT_CLASS_ID = "10A";

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

/** Цайвар + шилэн bento — AI продуктуудын одоогийн хэв маяг */
const bentoSurface =
	"rounded-3xl border border-white/80 bg-white/65 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_20px_50px_-20px_rgba(15,23,42,0.14)] ring-0 backdrop-blur-2xl";

function HeroStatusLine({
	pollExamId,
}: {
	pollExamId: string | null;
}) {
	if (pollExamId) {
		return (
			<p className="text-right text-xs font-medium text-violet-700">
				<span className="inline-flex items-center gap-2">
					<Loader2 className="size-3.5 animate-spin shrink-0" />
					Төлөвийг серверээс шалгаж байна…
				</span>
			</p>
		);
	}
	return (
		<p className="max-w-xs text-right text-xs leading-relaxed text-zinc-500">
			Хүсэлт илгээсний дараа үр дүн зүүн талын «Дарааллын төлөв» хэсэгт
			харагдана.
		</p>
	);
}

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

export function AiExamScheduler() {
	const [date, setDate] = useState<Date | undefined>(new Date());
	const [testId, setTestId] = useState(DEFAULT_TEST_ID);
	const [classId, setClassId] = useState(DEFAULT_CLASS_ID);
	const [lastQueuedExamId, setLastQueuedExamId] = useState<string | null>(
		null,
	);
	/** null биш үед 2.5с тутамд getAiExamSchedule poll хийнэ */
	const [pollExamId, setPollExamId] = useState<string | null>(null);
	const [liveSchedule, setLiveSchedule] = useState<ExamSchedule | null>(null);
	const terminalToastKeyRef = useRef<string>("");

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
	>(
		GetAiExamScheduleDocument,
		{
			variables: { examId: pollExamId ?? "" },
			skip: !pollExamId,
			pollInterval: pollExamId ? 2500 : 0,
			fetchPolicy: "network-only",
			notifyOnNetworkStatusChange: true,
		},
	);

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
			if (terminalToastKeyRef.current === key) return;
			terminalToastKeyRef.current = key;
			toast.message("AI хувилбарууд бэлэн", {
				description: "Доорх картуудаас нэгийг сонгож «Баталах» дарна уу.",
			});
			return;
		}
		if (st !== "confirmed" && st !== "failed") return;
		const key = `${row.id}:${st}`;
		if (terminalToastKeyRef.current === key) return;
		terminalToastKeyRef.current = key;
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
				terminalToastKeyRef.current = `${next.id}:confirmed`;
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
				terminalToastKeyRef.current = "";
				if (payload.examId) {
					setLiveSchedule(null);
					setLastQueuedExamId(payload.examId);
					setPollExamId(payload.examId);
				}
				toast.success(payload.message, {
					description: payload.examId
						? `examId: ${payload.examId} — төлөвийг доор шинэчилнэ (polling).`
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
									Доорх талбаруудаар{" "}
									<code className="rounded bg-zinc-100 px-1 font-mono text-[13px]">
										requestAiExamSchedule
									</code>{" "}
									илгээнэ — consumer AI хувилбарууд гаргасны дараа эндхээс{" "}
									<code className="rounded bg-zinc-100 px-1 font-mono text-[13px]">
										getAiExamSchedule
									</code>
									-аар төлөв харагдана.
								</p>
							</div>
							<div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
								<HeroStatusLine pollExamId={pollExamId} />
							</div>
						</div>
					</div>
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
								Зөвхөн{" "}
								<strong className="font-medium text-zinc-700">testId</strong>,{" "}
								<strong className="font-medium text-zinc-700">classId</strong>,{" "}
								<strong className="font-medium text-zinc-700">
									хүссэн өдөр
								</strong>{" "}
								сервер руу явна. Үр дүн доорх ногоон/шар/нууран хайрцагт
								гарна.
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
							{liveSchedule &&
							liveSchedule.id === lastQueuedExamId ? (
								<div
									className={cn(
										"rounded-2xl border p-4 text-sm",
										liveSchedule.status === "pending" &&
											"border-amber-200 bg-amber-50/80 text-amber-950",
										liveSchedule.status === "suggested" &&
											"border-violet-200 bg-violet-50/80 text-violet-950",
										liveSchedule.status === "confirmed" &&
											"border-emerald-200 bg-emerald-50/80 text-emerald-950",
										liveSchedule.status === "failed" &&
											"border-red-200 bg-red-50/80 text-red-950",
										!["pending", "suggested", "confirmed", "failed"].includes(
											liveSchedule.status,
										) && "border-zinc-200 bg-zinc-50/80",
									)}
								>
									<div className="mb-2 flex items-center justify-between gap-2">
										<span className="font-semibold">Дарааллын төлөв</span>
										<Badge
											variant="outline"
											className="font-mono text-[10px] uppercase"
										>
											{pollExamId ? "polling…" : liveSchedule.status}
										</Badge>
									</div>
									<ul className="space-y-1.5 text-xs text-zinc-700">
										<li>
											<span className="text-zinc-500">
												{liveSchedule.status === "pending"
													? "Хүссэн өдөр (суури): "
													: "Эхлэх: "}
											</span>
											<span className="font-mono">
												{liveSchedule.startTime}
											</span>
										</li>
										{liveSchedule.endTime ? (
											<li>
												<span className="text-zinc-500">Дуусах: </span>
												<span className="font-mono">
													{liveSchedule.endTime}
												</span>
											</li>
										) : null}
										{liveSchedule.roomId ? (
											<li>
												<span className="text-zinc-500">Танхим: </span>
												<span className="font-mono">
													{liveSchedule.roomId}
												</span>
											</li>
										) : null}
										{liveSchedule.aiReasoning ? (
											<li className="border-t border-black/5 pt-2 text-[13px] leading-snug">
												{liveSchedule.aiReasoning}
											</li>
										) : null}
									</ul>
									{liveSchedule.status === "suggested" &&
									liveSchedule.aiVariants?.length ? (
										<div className="mt-4 space-y-3 border-t border-violet-200/60 pt-4">
											<p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">
												Санал болгож буй хувилбарууд
											</p>
											<div className="grid gap-3 sm:grid-cols-1">
												{liveSchedule.aiVariants.map((v) => (
													<div
														key={v.id}
														className="flex flex-col gap-2 rounded-xl border border-violet-200/80 bg-white/70 p-3 shadow-sm"
													>
														<div className="flex flex-wrap items-start justify-between gap-2">
															<p className="text-sm font-semibold text-zinc-900">
																{v.label}
															</p>
															<Button
																type="button"
																size="sm"
																disabled={approveLoading}
																onClick={() =>
																	void handleApproveVariant(v)
																}
																className="shrink-0 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
															>
																{approveLoading ? (
																	<Loader2 className="size-4 animate-spin" />
																) : (
																	"Энийг батлах"
																)}
															</Button>
														</div>
														<p className="font-mono text-[11px] text-zinc-600">
															{formatVariantWhen(v.startTime)} · {v.roomId}
														</p>
														{v.reason ? (
															<p className="text-xs leading-snug text-zinc-600">
																{v.reason}
															</p>
														) : null}
													</div>
												))}
											</div>
										</div>
									) : null}
								</div>
							) : null}
							<p className="text-center text-[11px] leading-relaxed text-zinc-500">
								Дараалалд орсны дараа AI 2–3 хувилбар санал болгоно (
								<code className="rounded bg-zinc-100 px-1">suggested</code>
								). Та нэгийг сонгож батлах хүртэл{" "}
								<code className="rounded bg-zinc-100 px-1">confirmed</code>{" "}
								болохгүй. Хүлээгдэж буй үед 2.5 сек тутамд төлөв шалгана.
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
										Энэ өдөр нь хүсэлтийн{" "}
										<code className="rounded bg-zinc-100 px-1 font-mono text-[13px]">
											preferredDate
										</code>{" "}
										болно:{" "}
										<span className="font-mono font-medium text-zinc-800">
											{date
												? format(date, "yyyy-MM-dd", { locale: mn })
												: "—"}
										</span>
									</CardDescription>
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
								<p className="text-center text-xs leading-relaxed text-zinc-500">
									Бусад шалгалтын жагсаалт одоогоор энд харагдахгүй — зөвхөн
									дээрх товчоор илгээсэн хүсэлтийн төлөв зүүн талд гарна.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
