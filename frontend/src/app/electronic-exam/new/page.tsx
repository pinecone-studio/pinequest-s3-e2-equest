"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

type Tab = "general" | "questions";

function cx(...classes: Array<string | false | null | undefined>) {
	return classes.filter((value): value is string => Boolean(value)).join(" ");
}

export default function NewElectronicExamPage() {
	const [tab, setTab] = useState<Tab>("general");
	const [shuffle, setShuffle] = useState(false);
	const [hasVersions, setHasVersions] = useState(true);

	return (
		<DashboardShell>
			<div className="mx-auto w-full max-w-[980px] rounded-[1.5rem] border border-slate-200 bg-[#f8f8f9] p-4 shadow-[0_20px_56px_-40px_rgba(15,23,42,0.35)] md:p-6">
				<div className="mb-5 border-b border-slate-300/80 px-1">
					<div className="flex gap-6 text-base font-medium">
						<button
							type="button"
							onClick={() => setTab("general")}
							className={cx(
								"border-b-2 pb-3 transition",
								tab === "general"
									? "border-slate-900 text-slate-900"
									: "border-transparent text-slate-500 hover:text-slate-700",
							)}
						>
							Ерөнхий мэдээлэл
						</button>
						<button
							type="button"
							onClick={() => setTab("questions")}
							className={cx(
								"border-b-2 pb-3 transition",
								tab === "questions"
									? "border-slate-900 text-slate-900"
									: "border-transparent text-slate-500 hover:text-slate-700",
							)}
						>
							Асуулт нэмэх
						</button>
					</div>
				</div>

				{tab === "general" ? (
					<form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
						<div className="grid gap-4 md:grid-cols-2">
							<Field label="Анги">
								<SelectLike>10 дугаар анги</SelectLike>
							</Field>
							<Field label="Бүлэг">
								<div className="relative flex h-12 items-center rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-700">
									<span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1">
										10A <span className="text-slate-500">×</span>
									</span>
									<ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
								</div>
							</Field>
						</div>

						<Field label="Хичээл">
							<SelectLike placeholder="Сонгох..." />
						</Field>

						<div className="grid gap-4 md:grid-cols-2">
							<Field label="Нэгж хичээл">
								<SelectLike placeholder="Сонгох..." />
							</Field>
							<Field label="Ээлжит хичээл">
								<SelectLike placeholder="Сонгох..." />
							</Field>
						</div>

						<Field label="Шалгалтын нэр">
							<input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-400" />
						</Field>

						<div className="grid gap-4 md:grid-cols-2">
							<Field label="Шалгалт эхлэх хугацаа">
								<DateInput value="2026/03/24" />
							</Field>
							<Field label="Шалгалт дуусах хугацаа">
								<DateInput placeholder="Он/сар/өдөр" />
							</Field>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<Field label="Үргэлжлэх минут">
								<input
									type="number"
									defaultValue={40}
									className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-400"
								/>
							</Field>
							<Field label="Төрөл">
								<SelectLike>Явцын</SelectLike>
							</Field>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-3 pt-1">
								<CheckboxRow checked={shuffle} label="Даалгаврыг холих эсэх" onChange={() => setShuffle((v) => !v)} />
								<CheckboxRow checked={hasVersions} label="Хувилбартай эсэх" onChange={() => setHasVersions((v) => !v)} />
							</div>
							<Field label="Хувилбарын тоо">
								<input
									type="number"
									defaultValue={2}
									disabled={!hasVersions}
									className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
								/>
							</Field>
						</div>

						<Field label="Тайлбар">
							<textarea
								placeholder="Тайлбар бичиж оруулна уу"
								className="min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
							/>
						</Field>

						<div className="flex items-center justify-between pt-2">
							<button
								type="button"
								className="inline-flex h-11 min-w-24 items-center justify-center rounded-xl bg-slate-300 px-4 text-sm font-medium text-white"
							>
								Цуцлах
							</button>
							<button
								type="submit"
								className="inline-flex h-11 min-w-36 items-center justify-center rounded-xl bg-[#2f89e6] px-6 text-sm font-medium text-white hover:bg-[#2678cd]"
							>
								Үргэлжлүүлэх
							</button>
						</div>
					</form>
				) : (
					<div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">
						Асуулт нэмэх хэсэг.
					</div>
				)}
			</div>
		</DashboardShell>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className="block space-y-2">
			<span className="text-sm font-medium text-slate-800">{label}</span>
			{children}
		</label>
	);
}

function SelectLike({ children, placeholder = "Сонгох..." }: { children?: ReactNode; placeholder?: string }) {
	return (
		<div className="relative">
			<select
				defaultValue="default"
				className="h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-700 outline-none focus:border-slate-400"
			>
				<option value="default">{children ?? placeholder}</option>
			</select>
			<ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
		</div>
	);
}

function DateInput({ value, placeholder = "" }: { value?: string; placeholder?: string }) {
	return (
		<div className="relative">
			<input
				defaultValue={value}
				placeholder={placeholder}
				className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
			/>
			<CalendarDays className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
		</div>
	);
}

function CheckboxRow({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: () => void;
}) {
	return (
		<label className="flex items-center gap-3 text-sm text-slate-800">
			<input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 accent-slate-800" />
			{label}
		</label>
	);
}
