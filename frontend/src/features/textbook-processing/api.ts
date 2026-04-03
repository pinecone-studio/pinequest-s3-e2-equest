import {
  getConfiguredTextbookR2BucketName,
  getConfiguredTextbookR2PresignUrl,
  getConfiguredTextbookR2PublicUrl,
  getCreateExamServiceBaseUrl,
} from "@/lib/create-exam-graphql";
import {
  MAX_TEXTBOOK_FILE_SIZE_BYTES,
} from "./constants";
import type {
  TextbookMaterial,
  TextbookMaterialDetail,
  TextbookProcessingPage,
  TextbookStructurePayload,
  TextbookUploadedAsset,
} from "./types";

export type MaterialBuilderSubject = "math" | "physics" | "chemistry";

type R2PresignResponse = {
  bucketName: string;
  contentType?: string;
  fileName?: string;
  key: string;
  size?: number;
  uploadedAt?: string;
};

export type R2TextbookCandidate = {
  bucketName: string;
  fileName: string;
  key: string;
  lastModified: string | null;
  matchScore: number;
  size: number;
};

type TextbookServerParseResponse = {
  error?: string;
  pages: TextbookProcessingPage[];
  payload: TextbookStructurePayload;
};

type R2TextbookListResponse = {
  bucketName: string;
  expectedFileName: string;
  items: R2TextbookCandidate[];
};

type TextbookMaterialLibraryResponse = {
  items: TextbookMaterial[];
};

type UploadProgressSnapshot = {
  loaded: number;
  percent: number;
  total: number;
};

const TEXTBOOK_R2_UPLOAD_PROXY_PATH = "/api/textbook-r2-upload";
const TEXTBOOK_PARSE_PROXY_PATH = "/api/textbook-parse";

function buildCreateExamApiUrl(path: string) {
  return new URL(path, getCreateExamServiceBaseUrl()).toString();
}

function buildTextbookRuntimeApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_TEXTBOOK_RUNTIME_API_BASE_URL
      ?.trim()
      .replace(/\/$/, "") || "";

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildPublicTextbookObjectUrl(key: string) {
  const baseUrl = getConfiguredTextbookR2PublicUrl();
  if (!baseUrl) {
    return "";
  }

  return `${baseUrl}/${encodeObjectKey(key)}`;
}

function shouldFallbackToPublicR2(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("r2 credentials") ||
    normalized.includes("r2 bucket") ||
    normalized.includes("upstreamstatus") ||
    normalized.includes("http 500")
  );
}

function getSubjectAliases(subject: MaterialBuilderSubject) {
  switch (subject) {
    case "math":
      return ["matematic", "matematik", "mathematics", "math"];
    case "physics":
      return ["physics", "physic", "fizik"];
    case "chemistry":
      return ["chemistry", "chemic", "himi"];
    default:
      return [subject];
  }
}

function buildExpectedPublicTextbookKeys(
  grade: number,
  subject: MaterialBuilderSubject,
) {
  const normalizedGrade = normalizeBookFileName(String(grade));
  const keys: Array<{ fileName: string; key: string; matchScore: number }> = [];
  const seen = new Set<string>();

  for (const alias of getSubjectAliases(subject)) {
    const candidates = [
      { fileName: `${normalizedGrade}_${alias}.pdf`, matchScore: 100 },
      { fileName: `${normalizedGrade}-${alias}.pdf`, matchScore: 96 },
    ];

    for (const candidate of candidates) {
      if (seen.has(candidate.fileName)) {
        continue;
      }
      seen.add(candidate.fileName);
      keys.push({
        fileName: candidate.fileName,
        key: candidate.fileName,
        matchScore: candidate.matchScore,
      });
    }
  }

  return keys;
}

function parseHeaderNumber(value: string | null) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchPublicR2TextbookCandidates(
  grade: number,
  subject: MaterialBuilderSubject,
): Promise<R2TextbookListResponse | null> {
  const publicUrl = getConfiguredTextbookR2PublicUrl();
  if (!publicUrl) {
    return null;
  }

  const items = (
    await Promise.all(
      buildExpectedPublicTextbookKeys(grade, subject).map(async (candidate) => {
        const response = await fetch(buildPublicTextbookObjectUrl(candidate.key), {
          method: "HEAD",
        });

        if (!response.ok) {
          return null;
        }

        return {
          bucketName: getConfiguredTextbookR2BucketName() || "public",
          fileName: candidate.fileName,
          key: candidate.key,
          lastModified: response.headers.get("last-modified"),
          matchScore: candidate.matchScore,
          size: parseHeaderNumber(response.headers.get("content-length")),
        } satisfies R2TextbookCandidate;
      }),
    )
  ).filter((item): item is R2TextbookCandidate => Boolean(item));

  return {
    bucketName: getConfiguredTextbookR2BucketName() || "public",
    expectedFileName: getExpectedR2FileName(grade, subject),
    items,
  };
}

async function downloadPublicR2Textbook(candidate: R2TextbookCandidate) {
  const publicObjectUrl = buildPublicTextbookObjectUrl(candidate.key);
  if (!publicObjectUrl) {
    throw new Error("Public R2 URL тохируулаагүй байна.");
  }

  const response = await fetch(publicObjectUrl, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return new File([blob], candidate.fileName, {
    type: blob.type || "application/pdf",
  });
}

function slugifyUploadName(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function normalizeBookFileName(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getPrimarySubjectAlias(subject: MaterialBuilderSubject) {
  switch (subject) {
    case "math":
      return "matematic";
    case "physics":
      return "physics";
    case "chemistry":
      return "chemistry";
    default:
      return subject;
  }
}

export function getExpectedR2FileName(
  grade: number,
  subject: MaterialBuilderSubject,
) {
  return normalizeBookFileName(`${grade}_${getPrimarySubjectAlias(subject)}.pdf`);
}

async function parseJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function parseProxyJson<T extends { error?: string }>(response: Response) {
  const payload = (await response.json()) as T;
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    throw new Error(payload.error);
  }
  return payload;
}

function getTextbookPresignUrl() {
  return getConfiguredTextbookR2PresignUrl();
}

export function hasConfiguredTextbookPresignUpload() {
  return Boolean(getTextbookPresignUrl());
}

export async function parseTextbookPdfByServer(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(buildTextbookRuntimeApiUrl(TEXTBOOK_PARSE_PROXY_PATH), {
    method: "POST",
    body: formData,
  });

  const payload =
    (await response.json().catch(() => null)) as TextbookServerParseResponse | null;

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error || "Сервер талын PDF parser ажиллуулж чадсангүй.",
    );
  }

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
}

export function validateTextbookPdfFile(file: File) {
  const lowerName = file.name.toLowerCase();
  if (
    file.type !== "application/pdf" &&
    !lowerName.endsWith(".pdf")
  ) {
    return "Зөвхөн PDF файл оруулна уу.";
  }

  if (file.size > MAX_TEXTBOOK_FILE_SIZE_BYTES) {
    return `PDF файл хэт том байна. Дээд хэмжээ ${Math.round(MAX_TEXTBOOK_FILE_SIZE_BYTES / (1024 * 1024))} MB.`;
  }

  return "";
}

export async function fetchR2TextbookCandidates(
  grade: number,
  subject: MaterialBuilderSubject,
): Promise<R2TextbookListResponse> {
  try {
    const url = new URL(buildCreateExamApiUrl("/api/r2"));
    const configuredBucketName = getConfiguredTextbookR2BucketName();
    url.searchParams.set("mode", "list");
    url.searchParams.set("grade", String(grade));
    url.searchParams.set("subject", subject);
    if (configuredBucketName) {
      url.searchParams.set("bucketName", configuredBucketName);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(await parseJsonError(response));
    }

    return await parseProxyJson<R2TextbookListResponse & { error?: string }>(response);
  } catch (error) {
    if (!shouldFallbackToPublicR2(error)) {
      throw error;
    }

    const publicFallback = await fetchPublicR2TextbookCandidates(grade, subject);
    if (publicFallback) {
      return publicFallback;
    }

    throw error;
  }
}

export async function downloadR2Textbook(candidate: R2TextbookCandidate) {
  try {
    const url = new URL(buildCreateExamApiUrl("/api/r2"));
    const configuredBucketName = getConfiguredTextbookR2BucketName();
    url.searchParams.set("mode", "file");
    url.searchParams.set("key", candidate.key);
    url.searchParams.set("bucketName", configuredBucketName || candidate.bucketName);

    const response = await fetch(url.toString(), {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(await parseJsonError(response));
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      await parseProxyJson<{ error?: string }>(response);
      throw new Error("R2-оос PDF файл татах хариу буруу ирлээ.");
    }

    const blob = await response.blob();
    return new File([blob], candidate.fileName, {
      type: blob.type || "application/pdf",
    });
  } catch (error) {
    if (!shouldFallbackToPublicR2(error)) {
      throw error;
    }

    return downloadPublicR2Textbook(candidate);
  }
}

export async function uploadTextbookPdfToR2(
  file: File,
  options: {
    onProgress?: (snapshot: UploadProgressSnapshot) => void;
  } = {},
): Promise<TextbookUploadedAsset> {
  const validationError = validateTextbookPdfFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = file.type || "application/pdf";
  const onProgress = options.onProgress;

  const configuredBucketName = getConfiguredTextbookR2BucketName();
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeFileName = slugifyUploadName(file.name) || "textbook.pdf";
  const uploadId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const objectKey = [
    "textbook-imports",
    timestamp,
    `${uploadId}-${safeFileName}`,
  ].join("/");

  const formData = new FormData();
  if (configuredBucketName) {
    formData.append("bucketName", configuredBucketName);
  }
  formData.append("file", file);
  formData.append("key", objectKey);

  const uploadUrl = hasConfiguredTextbookPresignUpload()
    ? buildTextbookRuntimeApiUrl(TEXTBOOK_R2_UPLOAD_PROXY_PATH)
    : buildCreateExamApiUrl("/api/r2");
  const uploadPayload =
    typeof XMLHttpRequest !== "undefined"
      ? await new Promise<R2PresignResponse>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", uploadUrl, true);

          request.upload.onprogress = (event) => {
            if (!event.lengthComputable) {
              return;
            }

            onProgress?.({
              loaded: event.loaded,
              percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
              total: event.total,
            });
          };

          request.onerror = () => {
            reject(new Error("PDF upload хийх үед сүлжээний алдаа гарлаа."));
          };

          request.onload = () => {
            let payload: R2PresignResponse | { error?: string } | null = null;

            try {
              payload = request.responseText
                ? (JSON.parse(request.responseText) as R2PresignResponse | { error?: string })
                : null;
            } catch {
              reject(new Error(`HTTP ${request.status}`));
              return;
            }

            if (request.status >= 200 && request.status < 300) {
              if (
                payload &&
                typeof payload === "object" &&
                "error" in payload &&
                typeof payload.error === "string" &&
                payload.error.trim()
              ) {
                reject(new Error(payload.error));
                return;
              }
              resolve((payload || {}) as R2PresignResponse);
              return;
            }

            reject(
              new Error(
                payload &&
                typeof payload === "object" &&
                "error" in payload &&
                typeof payload.error === "string"
                  ? payload.error
                  : `HTTP ${request.status}`,
              ),
            );
          };

          request.send(formData);
        })
      : await (async () => {
          const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(await parseJsonError(uploadResponse));
          }

          return parseProxyJson<R2PresignResponse & { error?: string }>(uploadResponse);
        })();

  onProgress?.({
    loaded: file.size,
    percent: 100,
    total: file.size,
  });

  const { bucketName, key, fileName, size, uploadedAt, contentType: storedType } =
    uploadPayload;

  if (!bucketName || !key) {
    throw new Error("R2 upload хариу дутуу ирлээ.");
  }

  return {
    bucketName,
    contentType: storedType || contentType,
    fileName: fileName || file.name,
    key,
    size: typeof size === "number" ? size : file.size,
    uploadedAt: uploadedAt || new Date().toISOString(),
  };
}

export async function createTextbookMaterialRecord(input: {
  asset: TextbookUploadedAsset;
  grade: number;
  subject: MaterialBuilderSubject;
}) {
  const response = await fetch(buildCreateExamApiUrl("/api/textbook-materials"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketName: input.asset.bucketName,
      key: input.asset.key,
      fileName: input.asset.fileName,
      contentType: input.asset.contentType,
      size: input.asset.size,
      grade: input.grade,
      subject: input.subject,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}

export async function getTextbookMaterialById(
  materialId: string,
  options: {
    includeContent?: boolean;
  } = {},
) {
  const url = new URL(
    buildCreateExamApiUrl(
      `/api/textbook-materials/${encodeURIComponent(materialId)}`,
    ),
  );
  if (options.includeContent) {
    url.searchParams.set("includeContent", "1");
  }

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}

export async function listTextbookMaterialLibrary(options: {
  grade?: number | null;
  limit?: number;
  statuses?: string[];
  subject?: MaterialBuilderSubject | string | null;
} = {}) {
  const url = new URL(buildCreateExamApiUrl("/api/textbook-materials/library"));

  if (options.grade != null && Number.isFinite(Number(options.grade))) {
    url.searchParams.set("grade", String(options.grade));
  }

  if (options.limit != null && Number.isFinite(Number(options.limit))) {
    url.searchParams.set("limit", String(options.limit));
  }

  const subject = String(options.subject || "").trim();
  if (subject) {
    url.searchParams.set("subject", subject);
  }

  for (const status of options.statuses || []) {
    const normalized = String(status || "").trim();
    if (!normalized) {
      continue;
    }
    url.searchParams.append("status", normalized);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialLibraryResponse & { error?: string }>(response);
}

export async function getTextbookMaterialByR2(
  bucketName: string,
  key: string,
  options: {
    includeContent?: boolean;
  } = {},
) {
  const url = new URL(buildCreateExamApiUrl("/api/textbook-materials"));
  url.searchParams.set("bucketName", bucketName);
  url.searchParams.set("key", key);
  if (options.includeContent) {
    url.searchParams.set("includeContent", "1");
  }

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}

export async function updateTextbookMaterialStatus(
  materialId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(
    buildCreateExamApiUrl(
      `/api/textbook-materials/${encodeURIComponent(materialId)}`,
    ),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}

export async function upsertTextbookMaterialPages(
  materialId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(
    buildCreateExamApiUrl(
      `/api/textbook-materials/${encodeURIComponent(materialId)}/pages`,
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}

export async function replaceTextbookMaterialStructure(
  materialId: string,
  payload: TextbookStructurePayload,
) {
  const response = await fetch(
    buildCreateExamApiUrl(
      `/api/textbook-materials/${encodeURIComponent(materialId)}/structure`,
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  return parseProxyJson<TextbookMaterialDetail & { error?: string }>(response);
}
