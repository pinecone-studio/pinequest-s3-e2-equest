export type OllamaChatMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

type OllamaRequestOptions = {
  apiKey?: string;
  baseUrl?: string;
  body?: unknown;
  context: string;
  method?: "GET" | "POST";
  path: string;
  retries?: number;
  timeoutMs?: number;
};

type OllamaChatOptions = {
  apiKey?: string;
  baseUrl?: string;
  context: string;
  format?: "json";
  messages: OllamaChatMessage[];
  model?: string;
  retries?: number;
  timeoutMs?: number;
};

type OllamaChatPayload = {
  error?: string;
  message?: { content?: string };
  response?: string;
};

export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.1:latest";
const DEFAULT_OLLAMA_RETRIES = 1;
const DEFAULT_OLLAMA_TIMEOUT_MS = 15000;
const shouldUseLocalOllamaFallback = () => process.env.NODE_ENV === "development";

class OllamaRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "OllamaRequestError";
    this.retryable = retryable;
  }
}

export const normalizeOllamaBaseUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed.replace(/\/+$/, "");
  }

  if (shouldUseLocalOllamaFallback()) {
    return DEFAULT_OLLAMA_BASE_URL;
  }

  return "";
};

export const isRemoteOllamaBaseUrl = (baseUrl: string) =>
  Boolean(baseUrl) &&
  !baseUrl.includes("127.0.0.1") &&
  !baseUrl.includes("localhost");

const buildOllamaHeaders = (apiKey?: string) => ({
  "Content-Type": "application/json",
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isAbortLikeError = (error: unknown) =>
  error instanceof Error &&
  (error.name === "AbortError" || error.name === "TimeoutError");

const buildModelCandidates = (value?: string) => {
  const model = value?.trim() || DEFAULT_OLLAMA_MODEL;
  if (!model) {
    return [DEFAULT_OLLAMA_MODEL];
  }

  if (model.endsWith(":latest")) {
    return [model, model.slice(0, -":latest".length)].filter(Boolean);
  }

  if (model.includes(":")) {
    return [model];
  }

  return [model, `${model}:latest`];
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new OllamaRequestError(
        `Ollama request timed out after ${timeoutMs}ms.`,
        true,
      );
    }

    throw new OllamaRequestError(
      error instanceof Error ? error.message : "Ollama request failed.",
      true,
    );
  } finally {
    clearTimeout(timer);
  }
};

const shouldRetryStatus = (status: number) =>
  status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;

const parseJsonResponse = async <T>(
  response: Response,
  context: string,
): Promise<T> => {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  let payload: Record<string, unknown> = {};
  if (trimmed) {
    try {
      payload = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new OllamaRequestError(
        `${context}: Ollama JSON биш хариу буцаалаа (${response.status}).`,
        response.ok || shouldRetryStatus(response.status),
      );
    }
  }

  const payloadError =
    typeof payload.error === "string" && payload.error.trim().length > 0
      ? payload.error.trim()
      : null;

  if (!response.ok || payloadError) {
    throw new OllamaRequestError(
      payloadError ?? `${context}: Ollama failed with status ${response.status}.`,
      shouldRetryStatus(response.status),
    );
  }

  return payload as T;
};

export const fetchOllamaJson = async <T>({
  apiKey,
  baseUrl,
  body,
  context,
  method = body === undefined ? "GET" : "POST",
  path,
  retries = DEFAULT_OLLAMA_RETRIES,
  timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
}: OllamaRequestOptions): Promise<T> => {
  const resolvedBaseUrl = normalizeOllamaBaseUrl(baseUrl);
  if (!resolvedBaseUrl) {
    throw new OllamaRequestError(
      `${context}: OLLAMA_BASE_URL тохируулаагүй байна.`,
      false,
    );
  }

  const url = `${resolvedBaseUrl}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method,
          headers: buildOllamaHeaders(apiKey),
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        timeoutMs,
      );

      return await parseJsonResponse<T>(response, context);
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`${context}: Ollama request failed.`);

      const retryable =
        error instanceof OllamaRequestError ? error.retryable : false;
      if (!retryable || attempt >= retries) {
        break;
      }

      await delay(250 * (attempt + 1));
    }
  }

  throw lastError ?? new Error(`${context}: Ollama request failed.`);
};

export const chatWithOllama = async ({
  apiKey,
  baseUrl,
  context,
  format = "json",
  messages,
  model,
  retries = DEFAULT_OLLAMA_RETRIES,
  timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
}: OllamaChatOptions) => {
  const modelCandidates = buildModelCandidates(model);
  let lastError: Error | null = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const candidate = modelCandidates[index];

    try {
      const payload = await fetchOllamaJson<OllamaChatPayload>({
        apiKey,
        baseUrl,
        body: {
          format,
          messages,
          model: candidate,
          stream: false,
        },
        context,
        path: "/api/chat",
        retries,
        timeoutMs,
      });
      const content = payload.message?.content ?? payload.response;
      if (!content?.trim()) {
        throw new OllamaRequestError(
          `${context}: Ollama хоосон хариу өглөө.`,
          true,
        );
      }

      return {
        content: content.trim(),
        model: candidate,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`${context}: Ollama chat failed.`);

      const message = lastError.message.toLowerCase();
      const isModelIssue =
        message.includes("model") &&
        (message.includes("not found") ||
          message.includes("manifest") ||
          message.includes("pull") ||
          message.includes("unknown"));

      if (!isModelIssue || index >= modelCandidates.length - 1) {
        break;
      }
    }
  }

  throw lastError ?? new Error(`${context}: Ollama chat failed.`);
};
