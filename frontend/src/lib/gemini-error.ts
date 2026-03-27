type GeminiErrorResponseOptions = {
  fallbackMessage: string;
  providerMessage?: string;
  status: number;
};

function parseRetryAfterSeconds(message?: string) {
  const match = message?.match(/retry in\s+([\d.]+)s/i);

  if (!match) {
    return null;
  }

  const seconds = Number(match[1]);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.max(1, Math.ceil(seconds));
}

function isGeminiQuotaError(message: string | undefined, status: number) {
  if (status === 429) {
    return true;
  }

  if (!message) {
    return false;
  }

  return /(quota exceeded|rate[- ]limit|resource exhausted|too many requests)/i.test(
    message,
  );
}

export function buildGeminiErrorResponse({
  fallbackMessage,
  providerMessage,
  status,
}: GeminiErrorResponseOptions) {
  const retryAfterSeconds = parseRetryAfterSeconds(providerMessage);

  if (isGeminiQuotaError(providerMessage, status)) {
    const error = retryAfterSeconds
      ? `Gemini API-ийн хүсэлтийн лимит түр дүүрсэн байна. ${retryAfterSeconds} секундын дараа дахин оролдоно уу.`
      : "Gemini API-ийн хүсэлтийн лимит түр дүүрсэн байна. Түр хүлээгээд дахин оролдоно уу.";

    return Response.json(
      {
        error,
        retryAfterSeconds,
      },
      {
        headers: retryAfterSeconds
          ? {
              "Retry-After": String(retryAfterSeconds),
            }
          : undefined,
        status: 429,
      },
    );
  }

  return Response.json(
    {
      error: providerMessage ?? fallbackMessage,
      retryAfterSeconds,
    },
    { status },
  );
}
