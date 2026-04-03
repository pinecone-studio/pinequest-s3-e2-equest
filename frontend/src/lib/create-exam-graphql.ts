const DEFAULT_CREATE_EXAM_GRAPHQL_URL =
	"https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

function pickFirstConfiguredValue(
	...values: Array<string | null | undefined>
): string {
	for (const value of values) {
		const normalized = value?.trim();
		if (normalized) {
			return normalized;
		}
	}

	return "";
}

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
	return pickFirstConfiguredValue(
		process.env.NEXT_PUBLIC_TEXTBOOK_R2_BUCKET,
		process.env.NEXT_PUBLIC_TEXTBOOK_R2_BUCKET_NAME,
		process.env.NEXT_PUBLIC_TEXTBOOK_BUCKET_NAME,
		process.env.NEXT_PUBLIC_BOOK_R2_BUCKET_NAME,
		process.env.NEXT_PUBLIC_BOOK_BUCKET_NAME,
		process.env.NEXT_PUBLIC_R2_BUCKET_NAME,
		process.env.NEXT_PUBLIC_R2_BUCKET,
		process.env.NEXT_PUBLIC_BUCKET_NAME,
	);
}

export function getConfiguredTextbookR2PresignUrl(): string {
	return pickFirstConfiguredValue(
		process.env.NEXT_PUBLIC_TEXTBOOK_R2_PRESIGN_URL,
		process.env.NEXT_PUBLIC_TEXTBOOK_PRESIGN_URL,
		process.env.NEXT_PUBLIC_TEXTBOOK_UPLOAD_PRESIGN_URL,
		process.env.NEXT_PUBLIC_TEXTBOOK_UPLOAD_URL,
		process.env.NEXT_PUBLIC_R2_PRESIGN_URL,
		process.env.NEXT_PUBLIC_R2_UPLOAD_URL,
		process.env.NEXT_PUBLIC_PRESIGN_URL,
	);
}

export function getConfiguredTextbookR2UploadCandidates(): string[] {
	const configuredUrl = getConfiguredTextbookR2PresignUrl().replace(/\/$/, "");
	if (!configuredUrl) {
		return [];
	}

	const candidates: string[] = [];
	const seen = new Set<string>();
	const push = (value: string) => {
		const normalized = value.trim().replace(/\/$/, "");
		if (!normalized || seen.has(normalized)) {
			return;
		}
		seen.add(normalized);
		candidates.push(normalized);
	};

	if (/\/api\/proctoring-screenshots\/upload$/i.test(configuredUrl)) {
		push(configuredUrl);
	}

	if (/\/api\/proctoring-screenshots\/presign$/i.test(configuredUrl)) {
		push(configuredUrl.replace(/\/api\/proctoring-screenshots\/presign$/i, "/api/proctoring-screenshots/upload"));
	}

	if (/\/api\/r2\/presign$/i.test(configuredUrl)) {
		push(configuredUrl.replace(/\/api\/r2\/presign$/i, "/api/proctoring-screenshots/upload"));
		push(configuredUrl.replace(/\/api\/r2\/presign$/i, "/api/r2"));
	}

	if (/\/api\/r2$/i.test(configuredUrl)) {
		push(configuredUrl);
	}

	return candidates;
}

export function getConfiguredTextbookR2PublicUrl(): string {
	return pickFirstConfiguredValue(
		process.env.NEXT_PUBLIC_TEXTBOOK_R2_PUBLIC_URL,
		process.env.NEXT_PUBLIC_TEXTBOOK_PUBLIC_URL,
		process.env.NEXT_PUBLIC_BOOK_R2_PUBLIC_URL,
		process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
		process.env.NEXT_PUBLIC_PUBLIC_R2_URL,
	).replace(/\/$/, "");
}
