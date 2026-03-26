export default function SebSuccessPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
			<div className="max-w-xl rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-10 text-center">
				<p className="text-xs uppercase tracking-[0.35em] text-emerald-400">
					Submission Complete
				</p>
				<h1 className="mt-4 text-3xl font-bold text-white">
					Шалгалтыг амжилттай илгээлээ
				</h1>
				<p className="mt-4 text-sm leading-7 text-slate-300">
					Safe Exam Browser энэ URL-ийг quit URL гэж танивал автоматаар
					хаагдана. Энгийн browser-оор нээсэн үед энэ баталгаажуулах хуудас
					харагдана.
				</p>
			</div>
		</main>
	);
}
