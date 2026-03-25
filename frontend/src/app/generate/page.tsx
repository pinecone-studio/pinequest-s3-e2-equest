"use client";

import * as React from "react";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
	GenerateExamQuestionsDocument,
	SaveExamDocument,
} from "@/gql/create-exam-documents";
import {
	ExamStatus,
	ExamType,
	QuestionFormat,
	type ExamGenerationInput,
	type ExamGenerationResult,
	type GeneratedQuestion,
	type SaveExamInput,
	type SaveExamPayload,
} from "@/gql/graphql";

const GRADE_CLASSES = Array.from({ length: 4 }, (_, i) => i + 9).flatMap((g) =>
	(["a", "b", "c", "d"] as const).map((s) => `${g}${s}`),
);

/** `value` — сонгогчийн түлхүүр; `label` — харуулах ба GraphQL `subject` (AI-д очих текст) */
const SUBJECTS: { value: string; label: string }[] = [
	{ value: "math", label: "Математик" },
	{ value: "mongolian", label: "Монгол хэл" },
	{ value: "english", label: "Англи хэл" },
	{ value: "physics", label: "Физик" },
	{ value: "chemistry", label: "Хими" },
	{ value: "biology", label: "Биологи" },
	{ value: "history", label: "Түүх" },
	{ value: "social", label: "Нийгэм" },
];

const EXAM_TYPES: { value: ExamType; label: string }[] = [
	{ value: ExamType.Periodic_1, label: "Явцын шалгалт 1" },
	{ value: ExamType.Periodic_2, label: "Явцын шалгалт 2" },
	{ value: ExamType.Midterm, label: "Дундын шалгалт" },
	{ value: ExamType.FinalTerm, label: "Жилийн эцсийн шалгалт" },
];

const FORMAT_SELECT_OPTIONS: { id: QuestionFormat; label: string }[] = [
	{ id: QuestionFormat.SingleChoice, label: "Нэг зөв хувилбартай" },
	{ id: QuestionFormat.MultipleChoice, label: "Олон зөв хувилбартай" },
	{ id: QuestionFormat.Matching, label: "Холбох" },
	{ id: QuestionFormat.FillIn, label: "Нөхөж оруулах" },
	{ id: QuestionFormat.Written, label: "Бичиж хариулах" },
];

/**
 * `partition`: [p1, p2] нь 0–100 дээрх хуваалт — хялбар p1%, дунд (p2−p1)%, хэцүү (100−p2)%.
 */
function countsFromPartition(
	total: number,
	partition: readonly [number, number],
): { easy: number; medium: number; hard: number } {
	const [p1, p2] = partition;
	const easyPct = p1;
	const mediumPct = Math.max(0, p2 - p1);
	const hardPct = Math.max(0, 100 - p2);
	const t = Math.max(0, Math.floor(Number(total)) || 0);
	if (t < 1) {
		return { easy: 0, medium: 0, hard: 0 };
	}
	const easy = Math.round((t * easyPct) / 100);
	const medium = Math.round((t * mediumPct) / 100);
	const hard = t - easy - medium;
	return { easy, medium, hard };
}

/** `<input type="date">` формат (YYYY-MM-DD), хэрэглэгчийн орон нутгийн өнөөдөр. */
function getTodayDateInputValue(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** Урд талын илүү 0-үүдийг хасна; хоосон бол хоосон үлдэнэ. */
function sanitizeUnsignedIntInput(raw: string): string {
	if (raw === "") {
		return "";
	}
	const digits = raw.replace(/\D/g, "");
	if (digits === "") {
		return "";
	}
	const trimmed = digits.replace(/^0+/, "");
	return trimmed === "" ? "0" : trimmed;
}

function parseUIntFromInput(raw: string): number {
	if (raw === "") {
		return 0;
	}
	const n = parseInt(raw, 10);
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function GenerateExamPage() {
	const [gradeClass, setGradeClass] = React.useState(GRADE_CLASSES[0] ?? "9a");
	const [subjectValue, setSubjectValue] = React.useState(
		SUBJECTS[0]?.value ?? "math",
	);
	const subjectLabel =
		SUBJECTS.find((s) => s.value === subjectValue)?.label ?? subjectValue;
	const [examType, setExamType] = React.useState<ExamType>(ExamType.Periodic_1);
	const [topicScope, setTopicScope] = React.useState("");
	const [examDate, setExamDate] = React.useState(getTodayDateInputValue);
	const [examTime, setExamTime] = React.useState("09:00");
	const [durationInput, setDurationInput] = React.useState("45");
	const [totalInput, setTotalInput] = React.useState("10");
	const durationMinutes = parseUIntFromInput(durationInput);
	const totalCount = parseUIntFromInput(totalInput);
	/** Хоёр гулгуур: [эхний зааг, хоёр дахь зааг] → хялбар/дунд/хэцүү хувь */
	const [partition, setPartition] = React.useState<[number, number]>([40, 80]);
	const [easy, setEasy] = React.useState(4);
	const [medium, setMedium] = React.useState(4);
	const [hard, setHard] = React.useState(2);
	const [showPoints, setShowPoints] = React.useState(false);
	const [easyPts, setEasyPts] = React.useState<number | "">(1);
	const [mediumPts, setMediumPts] = React.useState<number | "">(2);
	const [hardPts, setHardPts] = React.useState<number | "">(3);
	const [formatEasy, setFormatEasy] = React.useState<QuestionFormat>(
		QuestionFormat.SingleChoice,
	);
	const [formatMedium, setFormatMedium] = React.useState<QuestionFormat>(
		QuestionFormat.SingleChoice,
	);
	const [formatHard, setFormatHard] = React.useState<QuestionFormat>(
		QuestionFormat.SingleChoice,
	);

	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [questions, setQuestions] = React.useState<GeneratedQuestion[] | null>(
		null,
	);
	/** Хадгалахад ашиглана — сүүлийн амжилттай generate-ийн оролт */
	const [lastGenerationInput, setLastGenerationInput] =
		React.useState<ExamGenerationInput | null>(null);
	const [savedExamId, setSavedExamId] = React.useState<string | null>(null);
	const [saving, setSaving] = React.useState(false);
	const [saveError, setSaveError] = React.useState<string | null>(null);

	const [generateMutation] = useMutation(GenerateExamQuestionsDocument);
	const [saveMutation] = useMutation(SaveExamDocument);
	const generateInFlightRef = React.useRef(false);
	const saveInFlightRef = React.useRef(false);

	const easyPct = partition[0];
	const mediumPct = Math.max(0, partition[1] - partition[0]);
	const hardPct = Math.max(0, 100 - partition[1]);

	const totalPointsSum = React.useMemo(() => {
		if (!showPoints) {
			return null;
		}
		const ep = easyPts === "" ? 0 : Number(easyPts);
		const mp = mediumPts === "" ? 0 : Number(mediumPts);
		const hp = hardPts === "" ? 0 : Number(hardPts);
		if (![ep, mp, hp].every((n) => Number.isFinite(n))) {
			return null;
		}
		return easy * ep + medium * mp + hard * hp;
	}, [showPoints, easy, medium, hard, easyPts, mediumPts, hardPts]);

	React.useEffect(() => {
		const { easy: e, medium: m, hard: h } = countsFromPartition(
			totalCount,
			partition,
		);
		setEasy(e);
		setMedium(m);
		setHard(h);
	}, [totalCount, partition]);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (generateInFlightRef.current) {
			return;
		}
		setError(null);
		if (easy + medium + hard !== totalCount) {
			setError(
				`Хялбар + дунд + хэцүү (${easy + medium + hard}) нийт асуултын тоо (${totalCount})-тай тэнцүү байх ёстой.`,
			);
			return;
		}
		const input: ExamGenerationInput = {
			gradeClass,
			subject: subjectLabel,
			examType,
			topicScope: topicScope.trim(),
			examDate,
			examTime,
			durationMinutes,
			totalQuestionCount: totalCount,
			difficultyDistribution: { easy, medium, hard },
			difficultyFormats: {
				easy: formatEasy,
				medium: formatMedium,
				hard: formatHard,
			},
			difficultyPoints: showPoints
				? {
						easyPoints:
							easyPts === "" ? null : Number(easyPts),
						mediumPoints:
							mediumPts === "" ? null : Number(mediumPts),
						hardPoints:
							hardPts === "" ? null : Number(hardPts),
					}
				: null,
		};
		if (!input.topicScope) {
			setError("Хамрах сэдвийг оруулна уу.");
			return;
		}
		if (!input.examDate) {
			setError("Шалгалтын огноо сонгоно уу.");
			return;
		}
		if (input.totalQuestionCount < 1) {
			setError("Нийт дор хаяж 1 асуулт оруулна уу.");
			return;
		}
		if (input.durationMinutes < 1) {
			setError("Хугацаа дор хаяж 1 минут оруулна уу.");
			return;
		}

		generateInFlightRef.current = true;
		setLoading(true);
		try {
			const { data } = await generateMutation({
				variables: { input },
			});
			const q = (
				data as { generateExamQuestions?: ExamGenerationResult } | undefined
			)?.generateExamQuestions?.questions;
			if (!q?.length) {
				throw new Error("Хариу хоосон байна");
			}
			setQuestions(q);
			setLastGenerationInput(input);
			setSavedExamId(null);
			setSaveError(null);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Алдаа гарлаа";
			setError(message);
		} finally {
			generateInFlightRef.current = false;
			setLoading(false);
		}
	};

	const onSaveDraft = async () => {
		if (saveInFlightRef.current) {
			return;
		}
		setSaveError(null);
		if (!lastGenerationInput || !questions?.length) {
			setSaveError("Эхлээд асуулт үүсгэнэ үү.");
			return;
		}
		saveInFlightRef.current = true;
		setSaving(true);
		try {
			const input: SaveExamInput = {
				status: ExamStatus.Draft,
				generation: lastGenerationInput,
				questions: questions.map((q) => ({
					id: q.id,
					text: q.text,
					format: q.format,
					difficulty: q.difficulty,
					options: q.options ?? undefined,
					correctAnswer: q.correctAnswer ?? undefined,
					explanation: q.explanation ?? undefined,
				})),
			};
			if (savedExamId) {
				input.examId = savedExamId;
			}
			const { data } = await saveMutation({ variables: { input } });
			const examId = (data as { saveExam?: SaveExamPayload } | undefined)
				?.saveExam?.examId;
			if (!examId) {
				throw new Error("Хадгалах хариу хоосон байна");
			}
			setSavedExamId(examId);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа");
		} finally {
			saveInFlightRef.current = false;
			setSaving(false);
		}
	};

	return (
		<div className="mx-auto max-w-2xl space-y-8 p-6 font-sans">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">
					Шалгалт үүсгэх (AI)
				</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Шалгалтын тохиргоо</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="space-y-6" onSubmit={onSubmit}>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>Анги</Label>
								<Select value={gradeClass} onValueChange={setGradeClass}>
									<SelectTrigger>
										<SelectValue placeholder="Анги" />
									</SelectTrigger>
									<SelectContent>
										{GRADE_CLASSES.map((c) => (
											<SelectItem key={c} value={c}>
												{c.toUpperCase()}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Хичээл</Label>
								<Select value={subjectValue} onValueChange={setSubjectValue}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{SUBJECTS.map((s) => (
											<SelectItem key={s.value} value={s.value}>
												{s.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-2">
							<Label>Шалгалтын төрөл</Label>
							<Select
								value={examType}
								onValueChange={(v) => setExamType(v as ExamType)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EXAM_TYPES.map((t) => (
										<SelectItem key={t.value} value={t.value}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="topic">Хамрах сэдэв</Label>
							<Textarea
								id="topic"
								value={topicScope}
								onChange={(e) => setTopicScope(e.target.value)}
								placeholder="Жишээ: Тэгш өнцөгт гурвалжин, Пифагорын теорем..."
								rows={3}
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="date">Огноо</Label>
								<Input
									id="date"
									type="date"
									value={examDate}
									onChange={(e) => setExamDate(e.target.value)}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="time">Цаг</Label>
								<Input
									id="time"
									type="time"
									value={examTime}
									onChange={(e) => setExamTime(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="dur">Хугацаа (мин)</Label>
								<Input
									id="dur"
									type="text"
									inputMode="numeric"
									autoComplete="off"
									pattern="[0-9]*"
									value={durationInput}
									onChange={(e) =>
										setDurationInput(sanitizeUnsignedIntInput(e.target.value))
									}
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="total">Нийт асуултын тоо</Label>
								<Input
									id="total"
									type="text"
									inputMode="numeric"
									autoComplete="off"
									pattern="[0-9]*"
									value={totalInput}
									onChange={(e) =>
										setTotalInput(sanitizeUnsignedIntInput(e.target.value))
									}
								/>
							</div>
						</div>

						<div className="space-y-4">
							<div>
								<Label>Хүндлэл — хувь</Label>
								<p className="mt-1 text-xs text-muted-foreground">
									Гулгуурыг чирж хялбар / дунд / хэцүү-ийн хувийг тохируулна. Нийт
									асуултын тоо өөрчлөгдөхөд доорх тоо энэ хувиар автоматаар шинэчлэгдэнэ.
								</p>
								<div className="mt-4 px-1">
									<Slider
										value={[partition[0], partition[1]]}
										min={0}
										max={100}
										step={1}
										minStepsBetweenThumbs={0}
										onValueChange={(v) => {
											if (v.length !== 2) return;
											const a = Math.min(v[0]!, v[1]!);
											const b = Math.max(v[0]!, v[1]!);
											setPartition([a, b]);
										}}
										aria-label="Хялбар, дунд, хэцүү хувийн хуваалт"
									/>
								</div>
								<div className="mt-2 flex justify-between text-xs text-muted-foreground">
									<span>0%</span>
									<span>100%</span>
								</div>
							</div>
							<div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
								<div>
									<span className="mb-1 block text-xs font-medium text-muted-foreground">
										Хялбар
									</span>
									<p className="text-lg font-semibold tabular-nums">{easy}</p>
									<p className="text-xs text-muted-foreground">
										{easyPct}% орчим
									</p>
								</div>
								<div>
									<span className="mb-1 block text-xs font-medium text-muted-foreground">
										Дунд
									</span>
									<p className="text-lg font-semibold tabular-nums">{medium}</p>
									<p className="text-xs text-muted-foreground">
										{mediumPct}% орчим
									</p>
								</div>
								<div>
									<span className="mb-1 block text-xs font-medium text-muted-foreground">
										Хэцүү
									</span>
									<p className="text-lg font-semibold tabular-nums">{hard}</p>
									<p className="text-xs text-muted-foreground">
										{hardPct}% орчим
									</p>
								</div>
							</div>
						</div>

						<div className="space-y-4">
							<div>
								<Label className="text-base">
									Хүндлэл тус бүрт асуултын хэлбэр
								</Label>
								<p className="mt-1 text-xs text-muted-foreground">
									Тухайн түвшний бүх асуулт сонгосон хэлбэрээр үүснэ.
								</p>
							</div>
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="space-y-2">
									<Label className="text-xs text-muted-foreground">
										Хялбар ({easy} асуулт)
									</Label>
									<Select
										value={formatEasy}
										onValueChange={(v) =>
											setFormatEasy(v as QuestionFormat)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FORMAT_SELECT_OPTIONS.map((f) => (
												<SelectItem key={f.id} value={f.id}>
													{f.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label className="text-xs text-muted-foreground">
										Дунд ({medium} асуулт)
									</Label>
									<Select
										value={formatMedium}
										onValueChange={(v) =>
											setFormatMedium(v as QuestionFormat)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FORMAT_SELECT_OPTIONS.map((f) => (
												<SelectItem key={f.id} value={f.id}>
													{f.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label className="text-xs text-muted-foreground">
										Хэцүү ({hard} асуулт)
									</Label>
									<Select
										value={formatHard}
										onValueChange={(v) =>
											setFormatHard(v as QuestionFormat)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FORMAT_SELECT_OPTIONS.map((f) => (
												<SelectItem key={f.id} value={f.id}>
													{f.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Checkbox
								id="pts"
								checked={showPoints}
								onCheckedChange={(c) => setShowPoints(c === true)}
							/>
							<Label htmlFor="pts" className="cursor-pointer font-normal">
								Хүндлэл бүрт оноо оруулах (сонголттой)
							</Label>
						</div>
						{showPoints ? (
							<div className="grid grid-cols-3 gap-3 rounded-md border p-3">
								<div className="space-y-1">
									<Label className="text-xs">Хялбар оноо</Label>
									<Input
										type="number"
										step="0.5"
										min={0}
										value={easyPts}
										onChange={(e) =>
											setEasyPts(
												e.target.value === ""
													? ""
													: Number(e.target.value),
											)
										}
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Дунд оноо</Label>
									<Input
										type="number"
										step="0.5"
										min={0}
										value={mediumPts}
										onChange={(e) =>
											setMediumPts(
												e.target.value === ""
													? ""
													: Number(e.target.value),
											)
										}
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Хэцүү оноо</Label>
									<Input
										type="number"
										step="0.5"
										min={0}
										value={hardPts}
										onChange={(e) =>
											setHardPts(
												e.target.value === ""
													? ""
													: Number(e.target.value),
											)
										}
									/>
								</div>
								<div className="col-span-3 mt-1 flex items-center justify-between border-t pt-3 text-sm">
									<span className="font-medium text-foreground">Нийт оноо</span>
									<span className="tabular-nums text-base font-semibold">
										{totalPointsSum === null ? "—" : totalPointsSum}
									</span>
								</div>
							</div>
						) : null}

						{error ? (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						) : null}

						<Button type="submit" disabled={loading} className="w-full sm:w-auto">
							{loading ? "Үүсгэж байна…" : "Шалгалтын асуулт үүсгэх"}
						</Button>
					</form>
				</CardContent>
			</Card>

			{questions && questions.length > 0 ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Үүссэн асуултууд ({questions.length})
						</CardTitle>
						{savedExamId ? (
							<p className="text-xs text-muted-foreground">
								Хадгалагдсан ID:{" "}
								<code className="rounded bg-muted px-1 py-0.5 text-[11px]">
									{savedExamId}
								</code>
							</p>
						) : null}
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<Button
								type="button"
								variant="secondary"
								disabled={saving}
								onClick={onSaveDraft}
							>
								{saving
									? "Хадгалж байна…"
									: savedExamId
										? "DRAFT шинэчлэх"
										: "DRAFT хадгалах"}
							</Button>
							{saveError ? (
								<p className="text-sm text-destructive" role="alert">
									{saveError}
								</p>
							) : null}
						</div>
						{questions.map((q, i) => (
							<div
								key={q.id}
								className="border-b border-border pb-4 last:border-0 last:pb-0"
							>
								<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
									<span className="font-medium text-foreground">
										{i + 1}.
									</span>
									<span>{q.difficulty}</span>
									<span>·</span>
									<span>{q.format}</span>
								</div>
								<p className="mt-2 text-sm leading-relaxed">{q.text}</p>
								{q.options && q.options.length > 0 ? (
									<ul className="mt-2 list-inside list-disc text-sm">
										{q.options.map((o) => (
											<li key={o}>{o}</li>
										))}
									</ul>
								) : null}
								{q.correctAnswer ? (
									<p className="mt-2 text-sm">
										<span className="text-muted-foreground">Зөв: </span>
										{q.correctAnswer}
									</p>
								) : null}
								{q.explanation ? (
									<p className="mt-1 text-xs text-muted-foreground">
										{q.explanation}
									</p>
								) : null}
							</div>
						))}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
