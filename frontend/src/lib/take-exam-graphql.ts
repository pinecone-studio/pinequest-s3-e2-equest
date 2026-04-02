export function getTakeExamGraphqlUrl(): string {
  return (
    process.env.TAKE_EXAM_GRAPHQL_URL ??
    process.env.NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL ??
    "https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql"
  );
}

export function getTakeExamScreenshotObjectUrl(
  screenshotStorageKey?: string | null,
): string | undefined {
  const key = screenshotStorageKey?.trim();
  if (!key) {
    return undefined;
  }

  try {
    const graphqlUrl = new URL(getTakeExamGraphqlUrl());
    return `${graphqlUrl.origin}/api/proctoring-screenshots/object?key=${encodeURIComponent(
      key,
    )}`;
  } catch {
    return undefined;
  }
}

export function resolveTakeExamScreenshotUrl(
  screenshotUrl?: string | null,
  screenshotStorageKey?: string | null,
): string | undefined {
  const directUrl = screenshotUrl?.trim();
  if (directUrl) {
    return directUrl;
  }

  return getTakeExamScreenshotObjectUrl(screenshotStorageKey);
}
