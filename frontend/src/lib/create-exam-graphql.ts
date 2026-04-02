/** Apollo `HttpLink` + `.env` — бүх GraphQL дуудлага Apollo-оор (mutation/query) */
export function getCreateExamGraphqlUrl(): string {
	return (
		process.env.NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL ??
		"https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql"
	);
}
