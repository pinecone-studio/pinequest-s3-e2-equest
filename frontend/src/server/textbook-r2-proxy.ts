import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getConfiguredTextbookR2BucketName,
  getConfiguredTextbookR2PresignUrl,
  getCreateExamServiceBaseUrl,
} from "@/lib/create-exam-graphql";

const PASSTHROUGH_RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
] as const;

type RouteEnv = {
  NEXT_PUBLIC_BOOK_BUCKET_NAME?: string;
  NEXT_PUBLIC_BOOK_R2_BUCKET_NAME?: string;
  NEXT_PUBLIC_BUCKET_NAME?: string;
  NEXT_PUBLIC_R2_BUCKET?: string;
  NEXT_PUBLIC_R2_BUCKET_NAME?: string;
  NEXT_PUBLIC_R2_PRESIGN_URL?: string;
  NEXT_PUBLIC_TEXTBOOK_BUCKET_NAME?: string;
  NEXT_PUBLIC_TEXTBOOK_PRESIGN_URL?: string;
  NEXT_PUBLIC_TEXTBOOK_R2_BUCKET?: string;
  NEXT_PUBLIC_TEXTBOOK_R2_BUCKET_NAME?: string;
  NEXT_PUBLIC_TEXTBOOK_R2_PRESIGN_URL?: string;
  NEXT_PUBLIC_TEXTBOOK_UPLOAD_PRESIGN_URL?: string;
  NEXT_PUBLIC_TEXTBOOK_UPLOAD_URL?: string;
  NEXT_PUBLIC_PRESIGN_URL?: string;
  NEXT_PUBLIC_R2_UPLOAD_URL?: string;
};

function getRouteEnv() {
  try {
    return ((getCloudflareContext() as unknown as { env: RouteEnv }).env ?? {}) as RouteEnv;
  } catch {
    return {} as RouteEnv;
  }
}

function pickFirstConfiguredValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function getExternalTextbookPresignUrl() {
  const env = getRouteEnv();

  return pickFirstConfiguredValue(
    getConfiguredTextbookR2PresignUrl(),
    env.NEXT_PUBLIC_TEXTBOOK_R2_PRESIGN_URL,
    env.NEXT_PUBLIC_TEXTBOOK_PRESIGN_URL,
    env.NEXT_PUBLIC_TEXTBOOK_UPLOAD_PRESIGN_URL,
    env.NEXT_PUBLIC_TEXTBOOK_UPLOAD_URL,
    env.NEXT_PUBLIC_R2_PRESIGN_URL,
    env.NEXT_PUBLIC_R2_UPLOAD_URL,
    env.NEXT_PUBLIC_PRESIGN_URL,
  );
}

function getConfiguredTextbookBucketNameForServer() {
  const env = getRouteEnv();

  return pickFirstConfiguredValue(
    getConfiguredTextbookR2BucketName(),
    env.NEXT_PUBLIC_TEXTBOOK_R2_BUCKET,
    env.NEXT_PUBLIC_TEXTBOOK_R2_BUCKET_NAME,
    env.NEXT_PUBLIC_TEXTBOOK_BUCKET_NAME,
    env.NEXT_PUBLIC_BOOK_R2_BUCKET_NAME,
    env.NEXT_PUBLIC_BOOK_BUCKET_NAME,
    env.NEXT_PUBLIC_R2_BUCKET_NAME,
    env.NEXT_PUBLIC_R2_BUCKET,
    env.NEXT_PUBLIC_BUCKET_NAME,
  );
}

function getConfiguredTextbookUploadCandidatesForServer() {
  const configuredUrl = getExternalTextbookPresignUrl().replace(/\/$/, "");
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
    push(
      configuredUrl.replace(
        /\/api\/proctoring-screenshots\/presign$/i,
        "/api/proctoring-screenshots/upload",
      ),
    );
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

function getBucketNameFromUploadUrl(uploadUrl: string) {
  try {
    return new URL(uploadUrl).hostname.split(".")[0] || "exam";
  } catch {
    return "exam";
  }
}

async function readJsonSafely<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function getTrimmedFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function uploadTextbookDirectly(
  formData: FormData,
  uploadFile: File,
) {
  const upstream = await fetch(new URL("/api/r2", getCreateExamServiceBaseUrl()), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const payload =
    await readJsonSafely<
      | {
          bucketName: string;
          contentType?: string;
          fileName?: string;
          key: string;
          size?: number;
          uploadedAt?: string;
        }
      | { error?: string; message?: string }
    >(upstream);

  if (!upstream.ok || !payload || !("bucketName" in payload) || !payload.bucketName || !payload.key) {
    const errorPayload = payload && !("bucketName" in payload) ? payload : null;
    throw new Error(
      errorPayload?.message ||
        errorPayload?.error ||
        `R2 direct upload амжилтгүй боллоо. HTTP ${upstream.status}`,
    );
  }

  return new Response(
    JSON.stringify({
      bucketName: payload.bucketName,
      contentType: payload.contentType || uploadFile.type || "application/pdf",
      fileName: payload.fileName || uploadFile.name,
      key: payload.key,
      size: typeof payload.size === "number" ? payload.size : uploadFile.size,
      uploadedAt: payload.uploadedAt || new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    },
  );
}

async function uploadTextbookViaConfiguredRoutes(
  formData: FormData,
  uploadFile: File,
) {
  for (const uploadUrl of getConfiguredTextbookUploadCandidatesForServer()) {
    try {
      const upstream = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const payload =
        await readJsonSafely<
          | {
              bucketName?: string;
              contentType?: string;
              fileName?: string;
              key: string;
              size?: number;
              uploadedAt?: string;
            }
          | { error?: string; message?: string }
        >(upstream);

      if (!upstream.ok || !payload || !("key" in payload) || !payload.key) {
        continue;
      }

      return new Response(
        JSON.stringify({
          bucketName:
            ("bucketName" in payload && payload.bucketName) ||
            getTrimmedFormValue(formData, "bucketName") ||
            getConfiguredTextbookBucketNameForServer() ||
            "exam",
          contentType: payload.contentType || uploadFile.type || "application/pdf",
          fileName: payload.fileName || uploadFile.name,
          key: payload.key,
          size: typeof payload.size === "number" ? payload.size : uploadFile.size,
          uploadedAt: payload.uploadedAt || new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        },
      );
    } catch {
      // Try the next configured route candidate.
    }
  }

  return null;
}

export async function handleTextbookUploadProxyRequest(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof (file as File).arrayBuffer !== "function") {
    throw new Error("Upload хийх PDF файл олдсонгүй.");
  }

  const uploadFile = file as File;
  const configuredUploadResponse = await uploadTextbookViaConfiguredRoutes(
    formData,
    uploadFile,
  );

  if (configuredUploadResponse) {
    return configuredUploadResponse;
  }

  const presignUrl = getExternalTextbookPresignUrl();

  if (presignUrl) {
    try {
      const presignResponse = await fetch(presignUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attemptId: "textbook-import",
          bucketName: getTrimmedFormValue(formData, "bucketName") || undefined,
          capturedAt: new Date().toISOString(),
          contentType: uploadFile.type || "application/pdf",
          eventCode: "textbook-upload",
          fileName: uploadFile.name,
          key: getTrimmedFormValue(formData, "key") || undefined,
          userId: "material-builder",
        }),
        cache: "no-store",
      });

      const presignPayload =
        await readJsonSafely<
          | {
              bucketName?: string;
              key: string;
              publicUrl?: string;
              uploadUrl?: string;
              url?: string;
            }
          | { error?: string; message?: string }
        >(presignResponse);

      const uploadUrl =
        presignPayload &&
        "key" in presignPayload &&
        typeof presignPayload.key === "string"
          ? (presignPayload.uploadUrl || presignPayload.url || "")
          : "";

      if (
        presignResponse.ok &&
        presignPayload &&
        "key" in presignPayload &&
        uploadUrl
      ) {
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": uploadFile.type || "application/pdf",
          },
          body: new Uint8Array(await uploadFile.arrayBuffer()),
          cache: "no-store",
        });

        if (!uploadResponse.ok) {
          throw new Error(`R2 presigned upload амжилтгүй боллоо. HTTP ${uploadResponse.status}`);
        }

        return new Response(
          JSON.stringify({
            bucketName:
              ("bucketName" in presignPayload && presignPayload.bucketName) ||
              getBucketNameFromUploadUrl(uploadUrl),
            contentType: uploadFile.type || "application/pdf",
            fileName: uploadFile.name,
            key: presignPayload.key,
            size: uploadFile.size,
            uploadedAt: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "application/json",
            },
          },
        );
      }
    } catch {
      // Fall back to direct multipart upload via create-exam-service.
    }
  }

  return uploadTextbookDirectly(formData, uploadFile);
}

function buildUpstreamUrl(request: Request) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL("/api/r2", getCreateExamServiceBaseUrl());

  incomingUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  return upstreamUrl;
}

function buildProxyHeaders(upstream: Response) {
  const headers = new Headers();

  for (const headerName of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  headers.set("Cache-Control", "no-store");
  return headers;
}

async function readUpstreamError(upstream: Response) {
  const contentType = upstream.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await upstream.json()) as {
        error?: string;
        message?: string;
      };
      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error;
      }
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      return `R2 upstream error (${upstream.status})`;
    }
  }

  try {
    const text = (await upstream.text()).trim();
    return text || `R2 upstream error (${upstream.status})`;
  } catch {
    return `R2 upstream error (${upstream.status})`;
  }
}

async function getForwardBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return {
      body: undefined,
      headers: new Headers(),
    };
  }

  const contentType = request.headers.get("content-type") || "";
  const headers = new Headers();

  if (contentType.includes("multipart/form-data")) {
    return {
      body: await request.formData(),
      headers,
    };
  }

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return {
    body: await request.text(),
    headers,
  };
}

export async function forwardTextbookR2Request(request: Request) {
  const upstreamUrl = buildUpstreamUrl(request);

  try {
    const contentType = request.headers.get("content-type") || "";
    if (
      request.method === "POST" &&
      contentType.includes("multipart/form-data") &&
      getExternalTextbookPresignUrl()
    ) {
      return await handleTextbookUploadProxyRequest(request);
    }

    const forwarded = await getForwardBody(request);
    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: forwarded.headers,
      body: forwarded.body,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const error = await readUpstreamError(upstream);
      return new Response(
        JSON.stringify({
          error,
          upstreamStatus: upstream.status,
        }),
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: buildProxyHeaders(upstream),
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? `R2 proxy request failed: ${error.message}`
            : "R2 proxy request failed.",
      }),
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    );
  }
}
