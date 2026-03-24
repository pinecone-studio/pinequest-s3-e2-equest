import React from "react";

const page = () => {
	return (
		<div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
			<div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
				<p className="text-sm uppercase tracking-[0.3em] text-sky-300">Create Exam Service</p>
				<h1 className="mt-3 text-4xl font-semibold tracking-tight">Backend service is running</h1>
				<p className="mt-4 text-sm leading-6 text-slate-300">
					This service now exposes <code>/api/health</code> as a shared contract example for other
					microservices such as <code>take-exam-service</code>.
				</p>
			</div>
		</div>
	);
};

export default page;
