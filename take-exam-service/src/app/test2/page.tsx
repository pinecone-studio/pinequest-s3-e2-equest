"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
	AlertTriangle,
	CheckCircle2,
	Clock3,
	Copy,
	EyeOff,
	FileWarning,
	Flag,
	Lock,
	ShieldAlert,
	ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type MockOption = {
	id: string;
	text: string;
};

type MockQuestion = {
	id: string;
	options: MockOption[];
	prompt: string;
};

type MockExam = {
	description: string;
	id: string;
	questions: MockQuestion[];
	title: string;
};

type SuspiciousSeverity = "warning" | "danger";

type SuspiciousEvent = {
	code: string;
	detail: string;
	elapsedSeconds: number;
	id: string;
	occurredAtLabel: string;
	severity: SuspiciousSeverity;
	title: string;
};

type PersistedSuspiciousExamSession = {
	answers: Record<string, string>;
	currentQuestionIndex: number;
	finalElapsedSeconds: number | null;
	selectedExamId: string | null;
	startedAt: number | null;
	status: "idle" | "active" | "finished";
	suspiciousEvents: SuspiciousEvent[];
	version: 1;
};

const SUSPICIOUS_EXAM_STORAGE_KEY = "suspicious-exam-page-session";

const MOCK_EXAMS: MockExam[] = [
	{
		id: "case-review",
		title: "Кейс уншлагын сорил",
		description: "Богино кейс уншиж ойлголтоо шалгах 3 асуулт.",
		questions: [
			{
				id: "q1",
				prompt: "Кейсийн гол асуудал аль нь байсан бэ?",
				options: [
					{ id: "a", text: "Нөөцийн хуваарилалт" },
					{ id: "b", text: "Логоны өнгө" },
					{ id: "c", text: "Оффисын байршил" },
				],
			},
			{
				id: "q2",
				prompt: "Багийн санал болгосон шийдлийн давуу тал юу вэ?",
				options: [
					{ id: "a", text: "Илүү их эрсдэл" },
					{ id: "b", text: "Хэрэгжүүлэхэд ойлгомжтой" },
					{ id: "c", text: "Зөвхөн өндөр өртөг" },
				],
			},
			{
				id: "q3",
				prompt: "Дараагийн зөв алхам аль нь вэ?",
				options: [
					{ id: "a", text: "Туршилт эхлүүлэх" },
					{ id: "b", text: "Бүх ажлыг зогсоох" },
					{ id: "c", text: "Тайланг устгах" },
				],
			},
		],
	},
	{
		id: "science-lite",
		title: "ШУ-ны богино шалгалт",
		description: "Суурь ойлголт шалгах хурдан 3 асуулт.",
		questions: [
			{
				id: "q1",
				prompt: "Ургамалд фотосинтез явагдахад юу чухал вэ?",
				options: [
					{ id: "a", text: "Гэрэл" },
					{ id: "b", text: "Тос" },
					{ id: "c", text: "Тоос" },
				],
			},
			{
				id: "q2",
				prompt: "Ус 0°C-д ихэвчлэн ямар төлөвт оршдог вэ?",
				options: [
					{ id: "a", text: "Хий" },
					{ id: "b", text: "Шингэн ба хатуугийн зааг" },
					{ id: "c", text: "Плазм" },
				],
			},
			{
				id: "q3",
				prompt: "Дэлхий нарыг нэг бүтэн тойроход хэдий хугацаа шаарддаг вэ?",
				options: [
					{ id: "a", text: "1 өдөр" },
					{ id: "b", text: "1 сар" },
					{ id: "c", text: "1 жил" },
				],
			},
		],
	},
];

function formatDuration(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60)
		.toString()
		.padStart(2, "0");
	const seconds = (totalSeconds % 60).toString().padStart(2, "0");
	return `${minutes}:${seconds}`;
}

function formatClockTime(date: Date) {
	return new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(date);
}

async function enterFullscreen() {
	if (typeof document === "undefined") {
		return false;
	}

	try {
		if (!document.fullscreenElement) {
			await document.documentElement.requestFullscreen();
		}
		return true;
	} catch {
		return false;
	}
}

async function exitFullscreen() {
	if (typeof document === "undefined") {
		return;
	}

	try {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
		}
	} catch {
		// Ignore fullscreen exit failures.
	}
}

export default function SuspiciousActivityExamPage() {
	const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [status, setStatus] = useState<"idle" | "active" | "finished">("idle");
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [startedAt, setStartedAt] = useState<number | null>(null);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [finalElapsedSeconds, setFinalElapsedSeconds] = useState<number | null>(null);
	const [suspiciousEvents, setSuspiciousEvents] = useState<SuspiciousEvent[]>([]);
	const startedAtRef = useRef<number | null>(null);
	const lastLoggedAtRef = useRef<Record<string, number>>({});
	const hasRestoredSessionRef = useRef(false);

	const selectedExam = useMemo(
		() => MOCK_EXAMS.find((exam) => exam.id === selectedExamId) ?? null,
		[selectedExamId],
	);
	const currentQuestion = selectedExam?.questions[currentQuestionIndex] ?? null;
	const answeredCount = selectedExam
		? selectedExam.questions.filter((question) => answers[question.id]).length
		: 0;
	const warningCount = suspiciousEvents.filter((event) => event.severity === "warning").length;
	const dangerCount = suspiciousEvents.filter((event) => event.severity === "danger").length;
	const displayedElapsedSeconds =
		status === "finished" ? finalElapsedSeconds ?? elapsedSeconds : elapsedSeconds;

	const recordSuspiciousAction = useEffectEvent(
		({
			code,
			detail,
			severity = "warning",
			title,
			cooldownMs = 1_200,
		}: {
			code: string;
			cooldownMs?: number;
			detail: string;
			severity?: SuspiciousSeverity;
			title: string;
		}) => {
			const now = Date.now();
			const previousLoggedAt = lastLoggedAtRef.current[code] ?? 0;

			if (now - previousLoggedAt < cooldownMs) {
				return;
			}

			lastLoggedAtRef.current[code] = now;
			const baseline = startedAtRef.current ?? now;
			const elapsed = Math.max(0, Math.floor((now - baseline) / 1000));

			setSuspiciousEvents((current) => [
				...current,
				{
					code,
					detail,
					elapsedSeconds: elapsed,
					id: `${code}-${now}-${current.length}`,
					occurredAtLabel: formatClockTime(new Date(now)),
					severity,
					title,
				},
			]);
		},
	);

	useEffect(() => {
		if (hasRestoredSessionRef.current || typeof window === "undefined") {
			return;
		}

		hasRestoredSessionRef.current = true;
		const rawSession = window.localStorage.getItem(SUSPICIOUS_EXAM_STORAGE_KEY);
		if (!rawSession) {
			return;
		}

		try {
			const session = JSON.parse(rawSession) as PersistedSuspiciousExamSession;
			if (session.version !== 1) {
				window.localStorage.removeItem(SUSPICIOUS_EXAM_STORAGE_KEY);
				return;
			}

			const examExists =
				session.selectedExamId === null ||
				MOCK_EXAMS.some((exam) => exam.id === session.selectedExamId);

			if (!examExists) {
				window.localStorage.removeItem(SUSPICIOUS_EXAM_STORAGE_KEY);
				return;
			}

			setSelectedExamId(session.selectedExamId);
			setAnswers(session.answers ?? {});
			setStatus(session.status ?? "idle");
			setCurrentQuestionIndex(session.currentQuestionIndex ?? 0);
			setStartedAt(session.startedAt);
			setFinalElapsedSeconds(session.finalElapsedSeconds ?? null);
			setSuspiciousEvents(session.suspiciousEvents ?? []);
			startedAtRef.current = session.startedAt;

			if (session.suspiciousEvents?.length) {
				lastLoggedAtRef.current = Object.fromEntries(
					session.suspiciousEvents.map((event) => [event.code, Date.now()]),
				);
			}

			if (session.selectedExamId && session.status !== "idle") {
				toast.info("Өмнөх test2 session сэргээгдлээ.");
			}

			if (session.selectedExamId && session.status === "active") {
				void enterFullscreen();
			}
		} catch {
			window.localStorage.removeItem(SUSPICIOUS_EXAM_STORAGE_KEY);
		}
	}, []);

	useEffect(() => {
		if (!hasRestoredSessionRef.current || typeof window === "undefined") {
			return;
		}

		const hasActiveState =
			status !== "idle" ||
			selectedExamId !== null ||
			suspiciousEvents.length > 0 ||
			startedAt !== null;

		if (!hasActiveState) {
			window.localStorage.removeItem(SUSPICIOUS_EXAM_STORAGE_KEY);
			return;
		}

		const session: PersistedSuspiciousExamSession = {
			answers,
			currentQuestionIndex,
			finalElapsedSeconds,
			selectedExamId,
			startedAt,
			status,
			suspiciousEvents,
			version: 1,
		};

		window.localStorage.setItem(
			SUSPICIOUS_EXAM_STORAGE_KEY,
			JSON.stringify(session),
		);
	}, [
		answers,
		currentQuestionIndex,
		finalElapsedSeconds,
		selectedExamId,
		startedAt,
		status,
		suspiciousEvents,
	]);

	useEffect(() => {
		if (status !== "active" || !startedAt) {
			if (status !== "finished") {
				setElapsedSeconds(0);
			}
			return;
		}

		setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
		const intervalId = window.setInterval(() => {
			setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
		}, 1000);

		return () => window.clearInterval(intervalId);
	}, [startedAt, status]);

	useEffect(() => {
		if (!selectedExam) {
			setCurrentQuestionIndex(0);
			return;
		}

		if (currentQuestionIndex >= selectedExam.questions.length) {
			setCurrentQuestionIndex(selectedExam.questions.length - 1);
		}
	}, [currentQuestionIndex, selectedExam]);

	useEffect(() => {
		if (status !== "active") {
			return;
		}

		function preventClipboard(event: ClipboardEvent) {
			event.preventDefault();
			recordSuspiciousAction({
				code: `clipboard-${event.type}`,
				detail: `${event.type.toUpperCase()} оролдлого илэрлээ.`,
				severity: "warning",
				title: "Clipboard оролдлого",
			});
			toast.warning(`${event.type.toUpperCase()} үйлдлийг тэмдэглэлээ.`);
		}

		function preventContextMenu(event: MouseEvent) {
			event.preventDefault();
			recordSuspiciousAction({
				code: "context-menu",
				detail: "Right click эсвэл context menu нээх оролдлого гарлаа.",
				severity: "warning",
				title: "Context menu",
			});
		}

		function preventDrag(event: Event) {
			event.preventDefault();
			recordSuspiciousAction({
				code: "drag-start",
				detail: "Контентыг drag хийх оролдлого илэрлээ.",
				severity: "warning",
				title: "Drag оролдлого",
				cooldownMs: 2_000,
			});
		}

		function handleVisibilityChange() {
			if (document.hidden) {
				recordSuspiciousAction({
					code: "visibility-hidden",
					detail: "Tab эсвэл window солигдсон байж болзошгүй.",
					severity: "danger",
					title: "Visibility өөрчлөгдсөн",
					cooldownMs: 2_000,
				});
			}
		}

		function handleWindowBlur() {
			recordSuspiciousAction({
				code: "window-blur",
				detail: "Window focus алдагдлаа.",
				severity: "danger",
				title: "Focus алдагдсан",
				cooldownMs: 2_000,
			});
		}

		function handleFullscreenChange() {
			if (!document.fullscreenElement) {
				recordSuspiciousAction({
					code: "fullscreen-exit",
					detail: "Fullscreen горимоос гарсан байна.",
					severity: "danger",
					title: "Fullscreen-ээс гарсан",
					cooldownMs: 2_000,
				});
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			const key = event.key.toLowerCase();
			const metaOrCtrl = event.metaKey || event.ctrlKey;
			const isBlockedShortcut =
				event.key === "F12" ||
				(metaOrCtrl && ["a", "c", "i", "j", "p", "s", "u", "v", "x"].includes(key)) ||
				(metaOrCtrl && event.shiftKey && ["c", "i", "j"].includes(key));
			const isPossibleScreenshotAttempt =
				event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key);

			if (isBlockedShortcut) {
				event.preventDefault();
				event.stopPropagation();
				recordSuspiciousAction({
					code: `shortcut-${key}`,
					detail: `Blocked shortcut ашиглах оролдлого: ${event.key}`,
					severity: "warning",
					title: "Shortcut оролдлого",
				});
				toast.warning("Blocked shortcut-ийг тэмдэглэлээ.");
			}

			if (isPossibleScreenshotAttempt) {
				recordSuspiciousAction({
					code: `screenshot-shortcut-${key}`,
					detail:
						"Screenshot shortcut дарагдсан байж болзошгүй. Browser бүх тохиолдолд үүнийг барихгүй.",
					severity: "danger",
					title: "Screenshot shortcut сэжиг",
					cooldownMs: 2_000,
				});
			}
		}

		function detectDevtools() {
			const widthGap = window.outerWidth - window.innerWidth;
			const heightGap = window.outerHeight - window.innerHeight;

			if (widthGap > 160 || heightGap > 160) {
				recordSuspiciousAction({
					code: "devtools-suspected",
					detail: "Window хэмжээнээс DevTools нээгдсэн байж болзошгүй шинж илэрлээ.",
					severity: "danger",
					title: "DevTools сэжиг",
					cooldownMs: 6_000,
				});
			}
		}

		const devtoolsInterval = window.setInterval(detectDevtools, 1_200);

		document.addEventListener("copy", preventClipboard);
		document.addEventListener("cut", preventClipboard);
		document.addEventListener("paste", preventClipboard);
		document.addEventListener("contextmenu", preventContextMenu);
		document.addEventListener("dragstart", preventDrag);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		window.addEventListener("blur", handleWindowBlur);
		window.addEventListener("keydown", handleKeyDown, true);

		return () => {
			window.clearInterval(devtoolsInterval);
			document.removeEventListener("copy", preventClipboard);
			document.removeEventListener("cut", preventClipboard);
			document.removeEventListener("paste", preventClipboard);
			document.removeEventListener("contextmenu", preventContextMenu);
			document.removeEventListener("dragstart", preventDrag);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
			window.removeEventListener("blur", handleWindowBlur);
			window.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [recordSuspiciousAction, status]);

	async function handleStartExam(examId: string) {
		const now = Date.now();
		setSelectedExamId(examId);
		setAnswers({});
		setCurrentQuestionIndex(0);
		setSuspiciousEvents([]);
		setElapsedSeconds(0);
		setFinalElapsedSeconds(null);
		setStartedAt(now);
		startedAtRef.current = now;
		lastLoggedAtRef.current = {};
		setStatus("active");
		const fullscreenGranted = await enterFullscreen();

		if (!fullscreenGranted) {
			recordSuspiciousAction({
				code: "fullscreen-denied",
				detail: "Fullscreen хүсэлт амжилтгүй боллоо эсвэл browser зөвшөөрсөнгүй.",
				severity: "warning",
				title: "Fullscreen идэвхжсэнгүй",
				cooldownMs: 0,
			});
		}

		toast.success("Шалгалт эхэллээ. Suspicious activity log идэвхжлээ.");
	}

	async function handleFinishExam() {
		if (!selectedExam) {
			return;
		}

		if (answeredCount < selectedExam.questions.length) {
			toast.error("Бүх асуултад хариулсны дараа шалгалтыг дуусгана уу.");
			return;
		}

		setFinalElapsedSeconds(elapsedSeconds);
		setStatus("finished");
		await exitFullscreen();
		toast.success("Шалгалт дууслаа. Тайлан бэлэн боллоо.");
	}

	async function handleReset() {
		setSelectedExamId(null);
		setAnswers({});
		setStatus("idle");
		setCurrentQuestionIndex(0);
		setElapsedSeconds(0);
		setFinalElapsedSeconds(null);
		setStartedAt(null);
		startedAtRef.current = null;
		lastLoggedAtRef.current = {};
		setSuspiciousEvents([]);
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(SUSPICIOUS_EXAM_STORAGE_KEY);
		}
		await exitFullscreen();
	}

	return (
		<main className="min-h-screen bg-[#071114] text-slate-100">
			<div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(239,68,68,0.14),_transparent_28%),linear-gradient(180deg,_#071114,_#0b161c_55%,_#04080b)]" />
			<Toaster richColors position="top-center" />

			<div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
				{status === "idle" ? (
					<div className="flex flex-1 items-center justify-center py-10">
						<div className="w-full max-w-6xl space-y-8">
							<header className="rounded-[34px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
								<p className="text-[11px] uppercase tracking-[0.34em] text-emerald-300">
									Suspicious Activity Report Demo
								</p>
								<h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
									Сэжигтэй үйлдэл бүрийг тэмдэглээд, шалгалтын төгсгөлд тайлангаар харуулна
								</h1>
								<p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
									Энэ хувилбар нь exam-г шууд block хийхгүй. Харин focus алдах,
									copy/paste, context menu, shortcut, fullscreen-ээс гарах,
									DevTools сэжиг зэрэг үйлдлийг log хийгээд төгсгөлд жагсааж
									харуулна.
								</p>
							</header>

							<section className="grid gap-4 lg:grid-cols-3">
								{MOCK_EXAMS.map((exam) => (
									<article
										key={exam.id}
										className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
													Mock Exam
												</p>
												<h2 className="mt-3 text-2xl font-semibold text-white">
													{exam.title}
												</h2>
											</div>
											<ShieldCheck className="mt-1 size-5 text-emerald-300" />
										</div>
										<p className="mt-4 text-sm leading-7 text-slate-300">
											{exam.description}
										</p>
										<p className="mt-6 text-xs uppercase tracking-[0.22em] text-slate-500">
											{exam.questions.length} асуулт
										</p>
										<button
											type="button"
											onClick={() => void handleStartExam(exam.id)}
											className="mt-8 w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
										>
											Log-той session эхлүүлэх
										</button>
									</article>
								))}
							</section>
						</div>
					</div>
				) : null}

				{status === "active" && selectedExam && currentQuestion ? (
					<div className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
						<aside className="rounded-[30px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
							<div className="flex h-full flex-col gap-4">
								<section className="rounded-[24px] border border-emerald-300/20 bg-emerald-300/8 p-4">
									<div className="flex items-center gap-2 text-emerald-200">
										<Lock className="size-4" />
										<p className="text-[11px] uppercase tracking-[0.28em]">
											Live Monitoring
										</p>
									</div>
									<h2 className="mt-4 text-xl font-semibold text-white">
										{selectedExam.title}
									</h2>
									<p className="mt-3 text-sm leading-6 text-slate-300">
										Log ажиллаж байна. Event бүр төгсгөлд report дээр гарна.
									</p>
								</section>

								<section className="grid grid-cols-2 gap-3">
									<div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
										<p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
											Elapsed
										</p>
										<p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
											<Clock3 className="size-4 text-emerald-300" />
											{formatDuration(displayedElapsedSeconds)}
										</p>
									</div>
									<div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
										<p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
											Logged
										</p>
										<p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
											<FileWarning className="size-4 text-amber-300" />
											{suspiciousEvents.length}
										</p>
									</div>
								</section>

								<section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
									<div className="flex items-center justify-between">
										<p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
											Questions
										</p>
										<p className="text-xs text-slate-500">
											{currentQuestionIndex + 1}/{selectedExam.questions.length}
										</p>
									</div>
									<div className="mt-4 grid grid-cols-3 gap-2">
										{selectedExam.questions.map((question, index) => {
											const isActive = index === currentQuestionIndex;
											const isAnswered = Boolean(answers[question.id]);

											return (
												<button
													key={question.id}
													type="button"
													onClick={() => setCurrentQuestionIndex(index)}
													className={cn(
														"rounded-2xl border px-0 py-3 text-sm font-semibold transition",
														isActive
															? "border-emerald-300 bg-emerald-300/18 text-white"
															: isAnswered
																? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
																: "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
													)}
												>
													{index + 1}
												</button>
											);
										})}
									</div>
								</section>

								<section className="rounded-[24px] border border-white/10 bg-black/20 p-4">
									<div className="flex items-center gap-2 text-slate-200">
										<Flag className="size-4 text-rose-300" />
										<p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
											Latest Activity
										</p>
									</div>
									{Array.from(suspiciousEvents).slice(-4).reverse().length > 0 ? (
										<div className="mt-4 space-y-3">
											{Array.from(suspiciousEvents)
												.slice(-4)
												.reverse()
												.map((event) => (
													<div
														key={event.id}
														className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
													>
														<p className="text-sm font-medium text-white">{event.title}</p>
														<p className="mt-1 text-xs text-slate-400">
															{formatDuration(event.elapsedSeconds)} · {event.occurredAtLabel}
														</p>
													</div>
												))}
										</div>
									) : (
										<p className="mt-4 text-sm leading-6 text-slate-400">
											Одоогоор suspicious event бүртгэгдээгүй байна.
										</p>
									)}
								</section>

								<button
									type="button"
									onClick={() => void handleFinishExam()}
									className="mt-auto w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
								>
									Шалгалт дуусгаад тайлан харах
								</button>
							</div>
						</aside>

						<section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-7">
							<header className="rounded-[26px] border border-white/10 bg-black/20 p-5 sm:p-6">
								<p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">
									Question {currentQuestionIndex + 1}
								</p>
								<h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
									{currentQuestion.prompt}
								</h2>
								<p className="mt-3 text-sm text-slate-400">
									Хариулсан: {answeredCount}/{selectedExam.questions.length}
								</p>
							</header>

							<div className="mt-5 grid gap-3">
								{currentQuestion.options.map((option, optionIndex) => {
									const checked = answers[currentQuestion.id] === option.id;

									return (
										<label
											key={option.id}
											className={cn(
												"group flex cursor-pointer items-start gap-4 rounded-[24px] border px-5 py-5 transition",
												checked
													? "border-emerald-300 bg-emerald-300/14 text-white"
													: "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8",
											)}
										>
											<div
												className={cn(
													"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition",
													checked
														? "border-emerald-100 bg-emerald-100 text-slate-950"
														: "border-white/15 bg-black/20 text-slate-300 group-hover:border-white/30",
												)}
											>
												{String.fromCharCode(65 + optionIndex)}
											</div>
											<div className="flex-1">
												<input
													type="radio"
													name={currentQuestion.id}
													value={option.id}
													checked={checked}
													onChange={() =>
														setAnswers((current) => ({
															...current,
															[currentQuestion.id]: option.id,
														}))
													}
													className="sr-only"
												/>
												<p className="text-base leading-7 text-inherit">{option.text}</p>
											</div>
											{checked ? (
												<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-100" />
											) : null}
										</label>
									);
								})}
							</div>

							<div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
								<button
									type="button"
									onClick={() =>
										setCurrentQuestionIndex((current) => Math.max(current - 1, 0))
									}
									disabled={currentQuestionIndex === 0}
									className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-40"
								>
									Өмнөх
								</button>
								<button
									type="button"
									onClick={() =>
										setCurrentQuestionIndex((current) =>
											selectedExam
												? Math.min(current + 1, selectedExam.questions.length - 1)
												: current,
										)
									}
									disabled={!selectedExam || currentQuestionIndex >= selectedExam.questions.length - 1}
									className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-40"
								>
									Дараах
								</button>
							</div>
						</section>
					</div>
				) : null}

				{status === "finished" && selectedExam ? (
					<div className="flex flex-1 items-center justify-center py-8">
						<div className="w-full max-w-6xl space-y-6">
							<header className="rounded-[34px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
								<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
									<div>
										<p className="text-[11px] uppercase tracking-[0.34em] text-emerald-300">
											Exam Report
										</p>
										<h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
											{selectedExam.title} тайлан
										</h1>
										<p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
											Шалгалтын үеэр бүртгэгдсэн suspicious activity-уудыг доор
											жагсаалаа. Энэ нь бодит screenshot event биш, browser-аас
											баригдсан сэжигтэй дохио болон оролдлогуудын тайлан юм.
										</p>
									</div>
									<div className="flex flex-wrap gap-3">
										<button
											type="button"
											onClick={() => void handleStartExam(selectedExam.id)}
											className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
										>
											Дахин эхлүүлэх
										</button>
										<button
											type="button"
											onClick={() => void handleReset()}
											className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
										>
											Жагсаалт руу буцах
										</button>
									</div>
								</div>
							</header>

							<section className="grid gap-4 md:grid-cols-4">
								<div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
									<p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
										Duration
									</p>
									<p className="mt-2 text-2xl font-semibold text-white">
										{formatDuration(displayedElapsedSeconds)}
									</p>
								</div>
								<div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
									<p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
										Answered
									</p>
									<p className="mt-2 text-2xl font-semibold text-white">
										{answeredCount}/{selectedExam.questions.length}
									</p>
								</div>
								<div className="rounded-[28px] border border-amber-300/20 bg-amber-300/8 p-5">
									<p className="text-[11px] uppercase tracking-[0.26em] text-amber-200">
										Warnings
									</p>
									<p className="mt-2 text-2xl font-semibold text-white">{warningCount}</p>
								</div>
								<div className="rounded-[28px] border border-rose-300/20 bg-rose-300/8 p-5">
									<p className="text-[11px] uppercase tracking-[0.26em] text-rose-200">
										Dangers
									</p>
									<p className="mt-2 text-2xl font-semibold text-white">{dangerCount}</p>
								</div>
							</section>

							<section className="rounded-[32px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
								<div className="flex items-center gap-3">
									<ShieldAlert className="size-5 text-rose-300" />
									<h2 className="text-2xl font-semibold text-white">
										Suspicious Activity Timeline
									</h2>
								</div>

								{suspiciousEvents.length > 0 ? (
									<div className="mt-5 space-y-3">
										{suspiciousEvents.map((event) => (
											<div
												key={event.id}
												className="rounded-[24px] border border-white/10 bg-black/20 p-4"
											>
												<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
													<div className="flex items-start gap-3">
														<div
															className={cn(
																"mt-0.5 rounded-full border p-2",
																event.severity === "danger"
																	? "border-rose-300/30 bg-rose-300/10 text-rose-200"
																	: "border-amber-300/30 bg-amber-300/10 text-amber-200",
															)}
														>
															{event.code.includes("clipboard") ? (
																<Copy className="size-4" />
															) : event.code.includes("visibility") ||
															  event.code.includes("blur") ? (
																<EyeOff className="size-4" />
															) : (
																<AlertTriangle className="size-4" />
															)}
														</div>
														<div>
															<div className="flex flex-wrap items-center gap-2">
																<p className="font-medium text-white">{event.title}</p>
																<span
																	className={cn(
																		"rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
																		event.severity === "danger"
																			? "border-rose-300/30 bg-rose-300/10 text-rose-100"
																			: "border-amber-300/30 bg-amber-300/10 text-amber-100",
																	)}
																>
																	{event.severity}
																</span>
															</div>
															<p className="mt-2 text-sm leading-6 text-slate-300">
																{event.detail}
															</p>
														</div>
													</div>
													<div className="shrink-0 text-sm text-slate-400">
														<p>{event.occurredAtLabel}</p>
														<p className="mt-1 text-right">
															+{formatDuration(event.elapsedSeconds)}
														</p>
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="mt-5 rounded-[24px] border border-emerald-300/20 bg-emerald-300/8 px-5 py-5 text-sm leading-7 text-emerald-50">
										Шалгалтын явцад suspicious activity бүртгэгдсэнгүй.
									</div>
								)}
							</section>
						</div>
					</div>
				) : null}
			</div>
		</main>
	);
}
