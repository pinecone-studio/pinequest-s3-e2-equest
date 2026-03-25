export default function HomePage() {
	return (
		<main className="mx-auto max-w-lg p-8 font-sans text-sm">
			<h1 className="text-lg font-semibold">create-exam-service</h1>
			<p className="mt-2 text-neutral-600">
				GraphQL endpoint:{" "}
				<code className="rounded bg-neutral-200 px-1.5 py-0.5">/api/graphql</code>
			</p>
		</main>
	);
}
