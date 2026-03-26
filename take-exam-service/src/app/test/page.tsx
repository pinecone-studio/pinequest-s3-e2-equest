"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Lock,
	ShieldCheck,
	Unlock,
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

const MOCK_EXAMS: MockExam[] = [
	{
		id: "math-logic",
		title: "Математикийн богино сорил",
		description: "Тэгшитгэл, функц, логик дараалал дээр суурилсан 3 асуулт.",
		questions: [
			{
				id: "q1",
				prompt: "2x + 6 = 18 бол x хэд вэ?",
				options: [
					{ id: "a", text: "4" },
					{ id: "b", text: "6" },
					{ id: "c", text: "8" },
				],
			},
			{
				id: "q2",
				prompt: "f(x)=x² бол f(5) хэд вэ?",
				options: [
					{ id: "a", text: "10" },
					{ id: "b", text: "20" },
					{ id: "c", text: "25" },
				],
			},
			{
				id: "q3",
				prompt: "2, 4, 8, 16 дарааллын дараагийн гишүүн?",
				options: [
					{ id: "a", text: "24" },
					{ id: "b", text: "32" },
					{ id: "c", text: "64" },
				],
			},
		],
	},
	{
		id: "reading-check",
		title: "Унших чадварын сорил",
		description: "Ойлгож унших, үндсэн санаа ялгах жижиг mock тест.",
		questions: [
			{
				id: "q1",
				prompt: "Эсээний гол санааг хамгийн сайн илэрхийлэх сонголтыг сонгоно уу.",
				options: [
					{ id: "a", text: "Тодорхойлолт" },
					{ id: "b", text: "Гол санаа" },
					{ id: "c", text: "Жишээ" },
				],
			},
			{
				id: "q2",
				prompt: "Дэд гарчиг ихэвчлэн юуг заадаг вэ?",
				options: [
					{ id: "a", text: "Хэсгийн сэдэв" },
					{ id: "b", text: "Номын үнэ" },
					{ id: "c", text: "Зохиогчийн гарын үсэг" },
				],
			},
			{
				id: "q3",
				prompt: "Эх сурвалжийг зөв ишлэх нь юунд хэрэгтэй вэ?",
				options: [
					{ id: "a", text: "Хуулбарлахад" },
					{ id: "b", text: "Найдвартай байдалд" },
					{ id: "c", text: "Зөвхөн урт бичвэрт" },
				],
			},
		],
	},
	{
		id: "science-quick",
		title: "Шинжлэх ухааны хурдан шалгалт",
		description: "Бодит туршилтын өмнөх хамгаалалтын урсгал шалгах mock тест.",
		questions: [
			{
				id: "q1",
				prompt: "Ус 100°C-д ямар төлөвт шилжих вэ?",
				options: [
					{ id: "a", text: "Хатуу" },
					{ id: "b", text: "Шингэн" },
					{ id: "c", text: "Хий" },
				],
			},
			{
				id: "q2",
				prompt: "Ургамал фотосинтез хийхэд голчлон юуг ашигладаг вэ?",
				options: [
					{ id: "a", text: "Гэрэл" },
					{ id: "b", text: "Дуу" },
					{ id: "c", text: "Соронз" },
				],
			},
			{
				id: "q3",
				prompt: "Дэлхий нарыг хэдий хугацаанд нэг бүтэн тойрдог вэ?",
				options: [
					{ id: "a", text: "24 цаг" },
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

async function enterFullscreen() {
	if (typeof document === "undefined") {
		return;
	}

	try {
		if (!document.fullscreenElement) {
			await document.documentElement.requestFullscreen();
		}
	} catch {
		// Ignore browsers that disallow fullscreen without additional permissions.
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

export default function MockTestPage() {
	const router = useRouter();
	const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [isLocked, setIsLocked] = useState(false);
	const [completedExamIds, setCompletedExamIds] = useState<string[]>([]);
	const [sebCheckMessage, setSebCheckMessage] = useState<string | null>(null);
	const [isSebCheckRunning, setIsSebCheckRunning] = useState(false);
	const [hasSecurityViolation, setHasSecurityViolation] = useState(false);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [examStartedAt, setExamStartedAt] = useState<number | null>(null);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const violationHandledRef = useRef(false);

	const selectedExam = useMemo(
		() => MOCK_EXAMS.find((exam) => exam.id === selectedExamId) ?? null,
		[selectedExamId],
	);

	const answeredCount = selectedExam
		? selectedExam.questions.filter((question) => answers[question.id]).length
		: 0;
	const progressPercent = selectedExam
		? Math.round((answeredCount / selectedExam.questions.length) * 100)
		: 0;
	const currentQuestion = selectedExam?.questions[currentQuestionIndex] ?? null;
	const hasPreviousQuestion = currentQuestionIndex > 0;
	const hasNextQuestion = selectedExam
		? currentQuestionIndex < selectedExam.questions.length - 1
		: false;

	useEffect(() => {
		if (!isLocked || !examStartedAt) {
			setElapsedSeconds(0);
			return;
		}

		setElapsedSeconds(Math.floor((Date.now() - examStartedAt) / 1000));
		const intervalId = window.setInterval(() => {
			setElapsedSeconds(Math.floor((Date.now() - examStartedAt) / 1000));
		}, 1000);

		return () => window.clearInterval(intervalId);
	}, [examStartedAt, isLocked]);

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
		if (!isLocked) {
			violationHandledRef.current = false;
			return;
		}

		function markViolation(reason: string) {
			if (violationHandledRef.current) {
				return;
			}

			violationHandledRef.current = true;
			setHasSecurityViolation(true);
			setIsLocked(false);
			void exitFullscreen();
			toast.error(reason);
		}

		function preventClipboard(event: ClipboardEvent) {
			event.preventDefault();
			toast.error("Copy / paste хийхийг хориглосон.");
		}

		function preventContextMenu(event: MouseEvent) {
			event.preventDefault();
			toast.error("Right click ашиглахыг хориглосон.");
		}

		function preventSelection(event: Event) {
			event.preventDefault();
		}

		function handleVisibilityChange() {
			if (document.hidden) {
				markViolation("Tab эсвэл цонх сольсон тул шалгалтыг блоклолоо.");
			}
		}

		function handleWindowBlur() {
			markViolation("Цонхны focus алдагдсан тул шалгалтыг блоклолоо.");
		}

		function handleKeyDown(event: KeyboardEvent) {
			const key = event.key.toLowerCase();
			const metaOrCtrl = event.metaKey || event.ctrlKey;
			const blockedMetaKeys = ["a", "c", "i", "j", "p", "s", "u", "v", "x"];
			const blockedShiftInspect =
				metaOrCtrl && event.shiftKey && ["c", "i", "j"].includes(key);
			const blockedFunctionKey = event.key === "F12";

			if (
				blockedFunctionKey ||
				blockedShiftInspect ||
				(metaOrCtrl && blockedMetaKeys.includes(key))
			) {
				event.preventDefault();
				event.stopPropagation();
				toast.error("Энэ shortcut-ийг ашиглахыг хориглосон.");
			}
		}

		function detectDevtools() {
			const widthGap = window.outerWidth - window.innerWidth;
			const heightGap = window.outerHeight - window.innerHeight;

			if (widthGap > 160 || heightGap > 160) {
				markViolation("Inspect / DevTools нээсэн байж болзошгүй тул шалгалтыг блоклолоо.");
			}
		}

		const devtoolsInterval = window.setInterval(detectDevtools, 1000);

		document.addEventListener("copy", preventClipboard);
		document.addEventListener("cut", preventClipboard);
		document.addEventListener("paste", preventClipboard);
		document.addEventListener("contextmenu", preventContextMenu);
		document.addEventListener("selectstart", preventSelection);
		document.addEventListener("dragstart", preventSelection);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("blur", handleWindowBlur);
		window.addEventListener("keydown", handleKeyDown, true);

		return () => {
			window.clearInterval(devtoolsInterval);
			document.removeEventListener("copy", preventClipboard);
			document.removeEventListener("cut", preventClipboard);
			document.removeEventListener("paste", preventClipboard);
			document.removeEventListener("contextmenu", preventContextMenu);
			document.removeEventListener("selectstart", preventSelection);
			document.removeEventListener("dragstart", preventSelection);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("blur", handleWindowBlur);
			window.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [isLocked]);

	async function handleStartExam(examId: string) {
		setSelectedExamId(examId);
		setAnswers({});
		setHasSecurityViolation(false);
		setCurrentQuestionIndex(0);
		setElapsedSeconds(0);
		setExamStartedAt(Date.now());
		setIsLocked(true);
		toast.info("Mock шалгалт эхэллээ. Secure workspace идэвхжлээ.");
		await enterFullscreen();
	}

	async function handleFinishExam() {
		if (!selectedExam) {
			return;
		}

		if (answeredCount < selectedExam.questions.length) {
			toast.error("Бүх асуултад хариулсны дараа шалгалтыг дуусгана уу.");
			return;
		}

		setCompletedExamIds((current) =>
			current.includes(selectedExam.id)
				? current
				: [...current, selectedExam.id],
		);
		setIsLocked(false);
		await exitFullscreen();
		toast.success("Шалгалт амжилттай дууслаа.");
		window.setTimeout(() => {
			router.push("/");
		}, 1200);
	}

	async function handleReset() {
		setSelectedExamId(null);
		setAnswers({});
		setIsLocked(false);
		setHasSecurityViolation(false);
		setCurrentQuestionIndex(0);
		setElapsedSeconds(0);
		setExamStartedAt(null);
		await exitFullscreen();
	}

	async function handleSebCheck() {
		setSebCheckMessage(null);
		setIsSebCheckRunning(true);

		try {
			const response = await fetch("/api/seb/check");
			const payload = (await response.json()) as {
				message?: string;
				ok?: boolean;
			};

			if (!response.ok) {
				throw new Error(payload.message || "SEB шалгалт амжилтгүй боллоо.");
			}

			const message =
				payload.message || "Safe Exam Browser verification амжилттай боллоо.";
			setSebCheckMessage(message);
			toast.success(message);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "SEB verification шалгалт амжилтгүй боллоо.";
			setSebCheckMessage(message);
			toast.error(message);
		} finally {
			setIsSebCheckRunning(false);
		}
	}

	return (
		<main className="min-h-screen overflow-hidden bg-[#06131a] text-slate-100">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.14),_transparent_32%),linear-gradient(180deg,_#06131a,_#0b1620_58%,_#05090d)]" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
			<Toaster
				richColors
				position="top-center"
				style={{
					top: "9%",
					left: "50%",
					right: "auto",
					bottom: "auto",
					transform: "translateX(-50%)",
				}}
			/>

			<div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
				{selectedExam ? (
					<div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4">
						<header className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
							<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
								<div className="space-y-2">
									<p className="text-[11px] uppercase tracking-[0.34em] text-emerald-300/80">
										Secure Exam Workspace
									</p>
									<div className="flex flex-wrap items-center gap-3">
										<h1 className="text-2xl font-semibold tracking-tight text-white">
											{selectedExam.title}
										</h1>
										<div
											className={cn(
												"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.22em]",
												isLocked
													? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
													: "border-amber-300/35 bg-amber-300/10 text-amber-100",
											)}
										>
											{isLocked ? (
												<Lock className="size-3.5" />
											) : (
												<Unlock className="size-3.5" />
											)}
											{isLocked ? "Locked Session" : "Review Mode"}
										</div>
										{hasSecurityViolation ? (
											<div className="inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-rose-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-rose-100">
												<AlertTriangle className="size-3.5" />
												Violation Detected
											</div>
										) : null}
									</div>
								</div>

								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
										<p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
											Elapsed
										</p>
										<p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
											<Clock3 className="size-4 text-emerald-300" />
											{formatDuration(elapsedSeconds)}
										</p>
									</div>
									<div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
										<p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
											Answered
										</p>
										<p className="mt-2 text-lg font-semibold text-white">
											{answeredCount}/{selectedExam.questions.length}
										</p>
									</div>
									<div className="col-span-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:col-span-1">
										<p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
											Progress
										</p>
										<p className="mt-2 text-lg font-semibold text-white">
											{progressPercent}%
										</p>
									</div>
								</div>
							</div>
						</header>

						<div className="grid flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
							<aside className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
								<div className="flex h-full flex-col gap-4">
									<section className="rounded-[24px] border border-emerald-300/20 bg-emerald-300/8 p-4">
										<p className="text-[11px] uppercase tracking-[0.28em] text-emerald-300">
											Session
										</p>
										<p className="mt-3 text-sm leading-6 text-slate-200">
											Fullscreen эхлүүлэхийг оролдож, focus алдагдвал
											шалгалтыг блоклох төлөвтэй.
										</p>
										<div className="mt-4 h-2 rounded-full bg-white/10">
											<div
												className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300"
												style={{ width: `${progressPercent}%` }}
											/>
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
												const answered = Boolean(answers[question.id]);
												const isActive = index === currentQuestionIndex;

												return (
													<button
														key={question.id}
														type="button"
														onClick={() => setCurrentQuestionIndex(index)}
														className={cn(
															"rounded-2xl border px-0 py-3 text-sm font-semibold transition",
															isActive
																? "border-emerald-300 bg-emerald-300/18 text-white"
																: answered
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
										<p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
											SEB Verification
										</p>
										<button
											type="button"
											onClick={() => void handleSebCheck()}
											disabled={isSebCheckRunning}
											className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-50"
										>
											{isSebCheckRunning ? "Шалгаж байна..." : "SEB төлөв шалгах"}
										</button>
										{sebCheckMessage ? (
											<p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-slate-300">
												{sebCheckMessage}
											</p>
										) : (
											<p className="mt-3 text-sm leading-6 text-slate-400">
												`/api/seb/check` ашиглан config key hash-ийг шалгана.
											</p>
										)}
									</section>

									<div className="mt-auto space-y-3">
										<button
											type="button"
											onClick={() => void handleFinishExam()}
											className="w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
										>
											Шалгалт дуусгах
										</button>
										<button
											type="button"
											onClick={() => void handleReset()}
											disabled={isLocked}
											className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
										>
											Гарах
										</button>
									</div>
								</div>
							</aside>

							<section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-7">
								{hasSecurityViolation ? (
									<div className="mb-5 rounded-[28px] border border-rose-300/30 bg-rose-300/10 px-5 py-4 text-sm leading-7 text-rose-50">
										Tab солих, focus алдах эсвэл inspect shortcut ашиглах
										оролцоо илэрсэн тул session review mode руу орлоо. Дахин
										эхлүүлэх бол гараад шинээр орно уу.
									</div>
								) : null}

								{currentQuestion ? (
									<div className="flex h-full flex-col">
										<div className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div>
													<p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">
														Question {currentQuestionIndex + 1}
													</p>
													<h2 className="mt-3 max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
														{currentQuestion.prompt}
													</h2>
												</div>
												<div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
													{answers[currentQuestion.id]
														? "Хариулт сонгосон"
														: "Хариулт сонгоогүй"}
												</div>
											</div>
										</div>

										<div className="mt-5 grid gap-3">
											{currentQuestion.options.map((option, optionIndex) => {
												const checked = answers[currentQuestion.id] === option.id;

												return (
													<label
														key={option.id}
														className={cn(
															"group flex cursor-pointer items-start gap-4 rounded-[26px] border px-5 py-5 transition",
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
															<p className="text-base leading-7 text-inherit">
																{option.text}
															</p>
														</div>
														{checked ? (
															<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-100" />
														) : null}
													</label>
												);
											})}
										</div>

										<div className="mt-auto pt-6">
											<div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
												<p className="text-sm leading-6 text-slate-400">
													Question navigation ашиглан аль ч асуулт руу буцаж
													орж болно.
												</p>
												<div className="flex flex-wrap gap-3">
													<button
														type="button"
														onClick={() =>
															setCurrentQuestionIndex((current) =>
																Math.max(current - 1, 0),
															)
														}
														disabled={!hasPreviousQuestion}
														className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
													>
														<ChevronLeft className="size-4" />
														Өмнөх
													</button>
													<button
														type="button"
														onClick={() =>
															setCurrentQuestionIndex((current) =>
																selectedExam
																	? Math.min(
																			current + 1,
																			selectedExam.questions.length - 1,
																		)
																	: current,
															)
														}
														disabled={!hasNextQuestion}
														className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
													>
														Дараах
														<ChevronRight className="size-4" />
													</button>
												</div>
											</div>
										</div>
									</div>
								) : null}
							</section>
						</div>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center py-8">
						<div className="w-full max-w-6xl space-y-8">
							<header className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
								<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
									<div className="max-w-3xl space-y-4">
										<p className="text-[11px] uppercase tracking-[0.36em] text-emerald-300">
											Safe Exam Preview
										</p>
										<h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
											SEB kiosk орчин шиг минимал mock exam shell
										</h1>
										<p className="text-sm leading-7 text-slate-300 sm:text-base">
											Энэ page нь launch screen-ээс шалгалтын secure workspace
											руу орж, exam эхэлсний дараа dashboard маягийн UI-г
											нуун зөвхөн шалгалтын орчинг харуулна.
										</p>
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<div className="rounded-[28px] border border-white/10 bg-black/20 px-5 py-4">
											<p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
												Security
											</p>
											<p className="mt-2 flex items-center gap-2 text-sm text-white">
												<ShieldCheck className="size-4 text-emerald-300" />
												Lock, fullscreen, focus guard
											</p>
										</div>
										<div className="rounded-[28px] border border-white/10 bg-black/20 px-5 py-4">
											<p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
												Session
											</p>
											<p className="mt-2 flex items-center gap-2 text-sm text-white">
												<Unlock className="size-4 text-amber-300" />
												Exam эхлэх хүртэл standby
											</p>
										</div>
									</div>
								</div>
							</header>

							<section className="grid gap-4 lg:grid-cols-3">
								{MOCK_EXAMS.map((exam) => {
									const isCompleted = completedExamIds.includes(exam.id);

									return (
										<article
											key={exam.id}
											className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
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
												{isCompleted ? (
													<CheckCircle2 className="size-5 text-emerald-300" />
												) : (
													<ShieldCheck className="size-5 text-cyan-300" />
												)}
											</div>

											<p className="mt-4 text-sm leading-7 text-slate-300">
												{exam.description}
											</p>

											<div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
												<span>{exam.questions.length} асуулт</span>
												<span>{isCompleted ? "Дууссан" : "Ready"}</span>
											</div>

											<button
												type="button"
												onClick={() => void handleStartExam(exam.id)}
												className="mt-8 w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
											>
												Secure session эхлүүлэх
											</button>
										</article>
									);
								})}
							</section>

							<section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
								<div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
									<p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">
										How It Feels
									</p>
									<div className="mt-4 grid gap-3 text-sm leading-7 text-slate-300">
										<p>Exam эхэлмэгц зөвхөн шалгалтын shell үлдэнэ.</p>
										<p>Question rail, progress, elapsed time нь зүүн талд тогтмол харагдана.</p>
										<p>Focus алдах эсвэл inspect оролдлого илэрвэл session review mode руу орно.</p>
									</div>
								</div>

								<div className="rounded-[32px] border border-white/10 bg-black/20 p-6">
									<p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
										SEB Check
									</p>
									<button
										type="button"
										onClick={() => void handleSebCheck()}
										disabled={isSebCheckRunning}
										className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-50"
									>
										{isSebCheckRunning ? "Шалгаж байна..." : "SEB ажиллаж байна уу?"}
									</button>
									<p className="mt-3 text-sm leading-6 text-slate-400">
										Шаардлагатай үед config key hash-ийг энэ launch screen дээрээс ч
										шалгаж болно.
									</p>
									{sebCheckMessage ? (
										<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
											{sebCheckMessage}
										</div>
									) : null}
								</div>
							</section>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
