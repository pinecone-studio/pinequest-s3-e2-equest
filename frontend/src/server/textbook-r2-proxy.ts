import { getCreateExamServiceBaseUrl } from "@/lib/create-exam-graphql";

const PASSTHROUGH_RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
] as const;

function getExternalTextbookPresignUrl() {
  return (
    process.env.NEXT_PUBLIC_TEXTBOOK_R2_PRESIGN_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PRESIGN_URL?.trim() ||
    ""
  );
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

export async function handleTextbookUploadProxyRequest(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof (file as File).arrayBuffer !== "function") {
    throw new Error("Upload хийх PDF файл олдсонгүй.");
  }

  const uploadFile = file as File;
  const presignResponse = await fetch(getExternalTextbookPresignUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attemptId: "textbook-import",
      capturedAt: new Date().toISOString(),
      contentType: uploadFile.type || "application/pdf",
      eventCode: "textbook-upload",
      fileName: uploadFile.name,
      userId: "material-builder",
    }),
    cache: "no-store",
  });

  const presignPayload =
    await readJsonSafely<
      | { key: string; publicUrl?: string; uploadUrl: string }
      | { error?: string; message?: string }
    >(presignResponse);

  if (
    !presignResponse.ok ||
    !presignPayload ||
    !("uploadUrl" in presignPayload) ||
    !presignPayload.uploadUrl ||
    !presignPayload.key
  ) {
    const errorPayload =
      presignPayload && !("uploadUrl" in presignPayload) ? presignPayload : null;
    throw new Error(
      errorPayload?.message ||
        errorPayload?.error ||
        "Textbook upload presign үүсгэж чадсангүй.",
    );
  }

  const uploadResponse = await fetch(presignPayload.uploadUrl, {
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
      bucketName: getBucketNameFromUploadUrl(presignPayload.uploadUrl),
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
