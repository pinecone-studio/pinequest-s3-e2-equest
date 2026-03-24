import { getBackendHealth } from "@/lib/backend";

export default async function Home() {
	const backend = await getBackendHealth();

	return (
		<div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
			<main className="mx-auto flex max-w-3xl flex-col gap-8">
				<div className="space-y-3">
					<p className="text-sm uppercase tracking-[0.3em] text-sky-300">Take Exam Service</p>
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Backend holbolt shalgah sambar</h1>
					<p className="max-w-2xl text-base text-slate-300 sm:text-lg">
						Microservice bur tusdaa schema-tai baij bolno. Harin hoorondoo yarih API contract neg, togtmol,
						todorhoi baih yostoi.
					</p>
				</div>

				<section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-sky-950/30">
					<div className="flex flex-col gap-3">
						<p className="text-sm text-slate-400">Configured backend URL</p>
						<p className="font-mono text-sm text-slate-100">{backend.baseUrl ?? "BACKEND_BASE_URL not set"}</p>
					</div>

					<div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 p-5">
						{backend.ok ? (
							<div className="space-y-3">
								<p className="text-sm font-medium text-emerald-300">Holbolt amjilttai</p>
								<p className="text-sm text-slate-300">
									{backend.data.service} service {backend.data.status} tuluvtei baina.
								</p>
								<ul className="space-y-2 text-sm text-slate-300">
									<li>Health endpoint: {backend.data.api.healthPath}</li>
									<li>Create exam endpoint: {backend.data.api.createExamPath}</li>
									<li>Checked at: {backend.data.timestamp}</li>
								</ul>
							</div>
						) : (
							<div className="space-y-3">
								<p className="text-sm font-medium text-rose-300">Holbolt aldaatai</p>
								<p className="text-sm text-slate-300">{backend.reason}</p>
								<p className="text-sm text-slate-400">
									<code>take-exam-service/.env.local</code> file dotor{" "}
									<code>BACKEND_BASE_URL=http://localhost:3001</code> gej taviad backend service-ee
									asaana uu.
								</p>
							</div>
						)}
					</div>
				</section>

				<section className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-3xl border border-white/10 bg-white/5 p-5">
						<h2 className="text-lg font-semibold">Yug negtgeh heregtei ve?</h2>
						<p className="mt-2 text-sm leading-6 text-slate-300">
							DB schema-g bish, request/response contract-g negtge. Jishee ni exam object, question list,
							submission payload helber ni neg baival bolno.
						</p>
					</div>
					<div className="rounded-3xl border border-white/10 bg-white/5 p-5">
						<h2 className="text-lg font-semibold">Yamar baidlaar holboh ve?</h2>
						<p className="mt-2 text-sm leading-6 text-slate-300">
							Local deer URL-aar, deploy hiisnii daraa service binding esvel internal API gateway-aar
							holboj bolno. Gol ni endpoint, auth, payload 3 ni tod baih heregtei.
						</p>
					</div>
				</section>
			</main>
		</div>
	);
}
