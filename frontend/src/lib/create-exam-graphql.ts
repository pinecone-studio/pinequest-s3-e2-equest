const DEFAULT_CREATE_EXAM_GRAPHQL_URL =
	"https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

/** Apollo `HttpLink` + `.env` — бүх GraphQL дуудлага Apollo-оор (mutation/query) */
export function getCreateExamGraphqlUrl(): string {
	return (
		process.env.NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL ??
		DEFAULT_CREATE_EXAM_GRAPHQL_URL
	);
}

export function getCreateExamServiceBaseUrl(): string {
	return getCreateExamGraphqlUrl().replace(/\/api\/graphql\/?$/, "");
}

export function getConfiguredTextbookR2BucketName(): string {
	return (
		process.env.NEXT_PUBLIC_TEXTBOOK_R2_BUCKET ??
		process.env.NEXT_PUBLIC_BOOK_R2_BUCKET_NAME ??
		process.env.NEXT_PUBLIC_R2_BUCKET_NAME ??
		""
	);
}
