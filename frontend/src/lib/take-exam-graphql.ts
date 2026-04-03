const DEPLOYED_TAKE_EXAM_GRAPHQL_URL =
  "https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql";

const isLoopbackHostname = (hostname?: string | null) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]";

const isLoopbackUrl = (value?: string) => {
  if (!value) {
    return false;
  }

  try {
    return isLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
};

const isBrowserOnLoopback = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return isLoopbackHostname(window.location.hostname);
};

export function getTakeExamGraphqlUrl(): string {
  const configured =
    process.env.TAKE_EXAM_GRAPHQL_URL ??
    process.env.NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL;

  if (configured && (!isLoopbackUrl(configured) || isBrowserOnLoopback())) {
    return configured;
  }

  return DEPLOYED_TAKE_EXAM_GRAPHQL_URL;
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
