import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";

export default function Home() {
	return (
		<DashboardShell>
			<div className="space-y-6">
				<section className="rounded-[1.5rem] bg-white p-8 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.4)] ring-1 ring-slate-200">
					<p className="text-sm text-slate-500">Home / Дашбоард</p>
					<h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Сургуулийн удирдлагын самбар</h1>
					<p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
						`Цахим шалгалт` хэсэг рүү ороод `Шинэ сорил үүсгэх` дархад зурагтай төстэй шинэ сорилын page нээгдэнэ.
					</p>
					<Link
						href="/electronic-exam"
						className="mt-6 inline-flex h-11 items-center rounded-full bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600"
					>
						Цахим шалгалт руу орох
					</Link>
				</section>
			</div>
		</DashboardShell>
	);
}
