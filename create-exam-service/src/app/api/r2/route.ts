// src/app/api/r2/presign/route.ts
import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type PresignRequestBody = {
  bucketName?: string;
  contentType?: string;
  key?: string;
};

type RouteEnv = {
  AWS_ACCESS_KEY_ID?: string;
  AWS_ENDPOINT_URL_S3?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  BOOK_R2_BUCKET_NAME?: string;
  BUCKET_NAME?: string;
  CF_ACCOUNT_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_BUCKET_NAME?: string;
  CLOUDFLARE_R2_ENDPOINT?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_BUCKET_NAME?: string;
  R2_ENDPOINT?: string;
  R2_S3_API?: string;
  R2_SECRET_ACCESS_KEY?: string;
  S3_ENDPOINT?: string;
  TEXTBOOK_BUCKET_NAME?: string;
  TEXTBOOK_R2_BUCKET?: string;
};

type R2Connection = {
  accessKeyId: string;
  bucketName: string;
  endpoint: string;
  secretAccessKey: string;
};

type R2TextbookObject = {
  bucketName: string;
  fileName: string;
  key: string;
  lastModified: string | null;
  matchScore: number;
  size: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const getRouteEnv = () => {
  try {
    return ((getCloudflareContext() as unknown as { env: RouteEnv }).env ?? {}) as RouteEnv;
  } catch {
    return {} as RouteEnv;
  }
};

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFileContents(contents: string) {
  const parsed: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = stripWrappingQuotes(line.slice(equalsIndex + 1).trim());
    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

async function readLocalEnvFiles() {
  if (
    typeof process === "undefined" ||
    !process.cwd ||
    process.release?.name !== "node"
  ) {
    return {} as Record<string, string>;
  }

  try {
    const [{ readFile }, pathModule] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const cwd = process.cwd();
    const candidates = [
      pathModule.join(cwd, ".dev.vars"),
      pathModule.join(cwd, ".env.local"),
      pathModule.join(cwd, ".env"),
    ];
    const merged: Record<string, string> = {};

    for (const filePath of candidates) {
      try {
        const contents = await readFile(filePath, "utf8");
        Object.assign(merged, parseEnvFileContents(contents));
      } catch {
        // Local env file is optional; ignore missing/unreadable files.
      }
    }

    return merged;
  } catch {
    return {} as Record<string, string>;
  }
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function normalizeSearchText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getSubjectAliases(subject: string) {
  const normalized = normalizeSearchText(subject);

  switch (normalized) {
    case "math":
    case "mathematics":
    case "matematic":
    case "matematik":
      return ["matematic", "matematik", "mathematics", "math"];
    case "physics":
    case "physic":
    case "fizik":
      return ["physics", "physic", "fizik"];
    case "chemistry":
    case "chemic":
    case "himi":
      return ["chemistry", "chemic", "himi"];
    default:
      return normalized ? [normalized] : [];
  }
}

function getPrimarySubjectAlias(subject: string) {
  return getSubjectAliases(subject)[0] || normalizeSearchText(subject) || "textbook";
}

function buildExpectedTextbookKeys(grade: string, subject: string) {
  const normalizedGrade = normalizeSearchText(grade);
  const aliases = getSubjectAliases(subject);

  if (!normalizedGrade || aliases.length === 0) {
    return [];
  }

  const keys = new Set<string>();
  for (const alias of aliases) {
    keys.add(`${normalizedGrade}_${alias}.pdf`);
    keys.add(`${normalizedGrade}-${alias}.pdf`);
  }

  return Array.from(keys);
}

function scoreTextbookCandidate(
  fileName: string,
  grade: string,
  subject: string,
) {
  const normalizedFileName = normalizeSearchText(fileName);
  const normalizedGrade = normalizeSearchText(grade);
  const aliases = getSubjectAliases(subject);

  if (!normalizedFileName.endsWith(".pdf")) {
    return 0;
  }

  if (!normalizedGrade || !aliases.length) {
    return 1;
  }

  let score = 0;
  for (const alias of aliases) {
    const exactName = `${normalizedGrade}_${alias}.pdf`;
    const hyphenName = `${normalizedGrade}-${alias}.pdf`;

    if (normalizedFileName === exactName) {
      score = Math.max(score, 100);
    } else if (normalizedFileName === hyphenName) {
      score = Math.max(score, 96);
    } else if (
      normalizedFileName.startsWith(`${normalizedGrade}_`) &&
      normalizedFileName.includes(alias)
    ) {
      score = Math.max(score, 88);
    } else if (
      normalizedFileName.startsWith(`${normalizedGrade}-`) &&
      normalizedFileName.includes(alias)
    ) {
      score = Math.max(score, 84);
    } else if (
      normalizedFileName.includes(normalizedGrade) &&
      normalizedFileName.includes(alias)
    ) {
      score = Math.max(score, 72);
    }
  }

  return score;
}

function createR2Client(connection: R2Connection) {
  return new S3Client({
    region: "us-east-1",
    endpoint: connection.endpoint,
    credentials: {
      accessKeyId: connection.accessKeyId,
      secretAccessKey: connection.secretAccessKey,
    },
  });
}

function buildDerivedR2Endpoint(accountId: string) {
  const normalized = pickFirstNonEmpty(accountId);
  return normalized ? `https://${normalized}.r2.cloudflarestorage.com` : "";
}

async function resolveR2Connection(
  env: RouteEnv,
  bucketNameOverride?: string | null,
): Promise<R2Connection> {
  const localEnv = await readLocalEnvFiles();
  const bucketName = pickFirstNonEmpty(
    bucketNameOverride,
    env.R2_BUCKET_NAME,
    env.TEXTBOOK_R2_BUCKET,
    env.BOOK_R2_BUCKET_NAME,
    env.TEXTBOOK_BUCKET_NAME,
    env.CLOUDFLARE_R2_BUCKET_NAME,
    env.BUCKET_NAME,
    process.env.R2_BUCKET_NAME,
    process.env.TEXTBOOK_R2_BUCKET,
    process.env.BOOK_R2_BUCKET_NAME,
    process.env.TEXTBOOK_BUCKET_NAME,
    process.env.CLOUDFLARE_R2_BUCKET_NAME,
    process.env.BUCKET_NAME,
    localEnv.R2_BUCKET_NAME,
    localEnv.TEXTBOOK_R2_BUCKET,
    localEnv.BOOK_R2_BUCKET_NAME,
    localEnv.TEXTBOOK_BUCKET_NAME,
    localEnv.CLOUDFLARE_R2_BUCKET_NAME,
    localEnv.BUCKET_NAME,
  );
  const derivedEndpoint = buildDerivedR2Endpoint(
    pickFirstNonEmpty(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CF_ACCOUNT_ID,
      process.env.CLOUDFLARE_ACCOUNT_ID,
      process.env.CF_ACCOUNT_ID,
      localEnv.CLOUDFLARE_ACCOUNT_ID,
      localEnv.CF_ACCOUNT_ID,
    ),
  );
  const endpoint = pickFirstNonEmpty(
    env.R2_S3_API,
    env.R2_ENDPOINT,
    env.S3_ENDPOINT,
    env.AWS_ENDPOINT_URL_S3,
    env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_S3_API,
    process.env.R2_ENDPOINT,
    process.env.S3_ENDPOINT,
    process.env.AWS_ENDPOINT_URL_S3,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    localEnv.R2_S3_API,
    localEnv.R2_ENDPOINT,
    localEnv.S3_ENDPOINT,
    localEnv.AWS_ENDPOINT_URL_S3,
    localEnv.CLOUDFLARE_R2_ENDPOINT,
    derivedEndpoint,
  );
  const accessKeyId = pickFirstNonEmpty(
    env.R2_ACCESS_KEY_ID,
    env.AWS_ACCESS_KEY_ID,
    env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
    process.env.AWS_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    localEnv.R2_ACCESS_KEY_ID,
    localEnv.AWS_ACCESS_KEY_ID,
    localEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = pickFirstNonEmpty(
    env.R2_SECRET_ACCESS_KEY,
    env.AWS_SECRET_ACCESS_KEY,
    env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.AWS_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    localEnv.R2_SECRET_ACCESS_KEY,
    localEnv.AWS_SECRET_ACCESS_KEY,
    localEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  );

  if (!bucketName) {
    throw new Error(
      "R2 bucket нэр тохируулаагүй байна. `R2_BUCKET_NAME`, `TEXTBOOK_R2_BUCKET`, эсвэл `BOOK_R2_BUCKET_NAME` тохируулна уу.",
    );
  }

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials дутуу байна. `R2_S3_API`/`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`/`AWS_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`/`AWS_SECRET_ACCESS_KEY`-аа шалгана уу.",
    );
  }

  return {
    accessKeyId,
    bucketName,
    endpoint,
    secretAccessKey,
  };
}

async function bodyToUint8Array(body: unknown) {
  if (!body) {
    return new Uint8Array();
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  const streamBody = body as {
    arrayBuffer?: () => Promise<ArrayBuffer>;
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof streamBody.transformToByteArray === "function") {
    return await streamBody.transformToByteArray();
  }

  if (typeof streamBody.arrayBuffer === "function") {
    return new Uint8Array(await streamBody.arrayBuffer());
  }

  return new Uint8Array(await new Response(body as BodyInit).arrayBuffer());
}

function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    $metadata?: { httpStatusCode?: number };
    Code?: string;
    code?: string;
    name?: string;
  };

  return (
    maybeError.$metadata?.httpStatusCode === 404 ||
    maybeError.Code === "NotFound" ||
    maybeError.code === "NotFound" ||
    maybeError.name === "NotFound" ||
    maybeError.name === "NoSuchKey"
  );
}

async function findDirectTextbookMatches(
  client: S3Client,
  bucketName: string,
  grade: string,
  subject: string,
) {
  const keys = buildExpectedTextbookKeys(grade, subject);
  const matches: R2TextbookObject[] = [];

  for (const key of keys) {
    try {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );

      matches.push({
        bucketName,
        fileName: key.split("/").pop() || key,
        key,
        lastModified: response.LastModified?.toISOString() || null,
        matchScore: scoreTextbookCandidate(key, grade, subject),
        size: response.ContentLength ?? 0,
      });
    } catch (error) {
      if (!isMissingObjectError(error)) {
        throw error;
      }
    }
  }

  return matches;
}

async function listBucketObjects(
  client: S3Client,
  bucketName: string,
  grade: string,
  subject: string,
) {
  const items: R2TextbookObject[] = [];
  const seenKeys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const item of response.Contents ?? []) {
      const key = pickFirstNonEmpty(item.Key);
      if (!key || seenKeys.has(key)) {
        continue;
      }

      const fileName = key.split("/").pop() || key;
      const matchScore = scoreTextbookCandidate(fileName, grade, subject);

      if ((grade || subject) && matchScore <= 0) {
        continue;
      }

      seenKeys.add(key);
      items.push({
        bucketName,
        fileName,
        key,
        lastModified: item.LastModified?.toISOString() || null,
        matchScore,
        size: item.Size ?? 0,
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return items;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const env = getRouteEnv();
    const url = new URL(req.url);
    const mode = pickFirstNonEmpty(url.searchParams.get("mode"), "list");
    const connection = await resolveR2Connection(
      env,
      url.searchParams.get("bucketName"),
    );
    const client = createR2Client(connection);

    if (mode === "file") {
      const key = pickFirstNonEmpty(url.searchParams.get("key"));

      if (!key) {
        throw new Error("R2 object key шаардлагатай байна.");
      }

      const objectResponse = await client.send(
        new GetObjectCommand({
          Bucket: connection.bucketName,
          Key: key,
        }),
      );

      const body = await bodyToUint8Array(objectResponse.Body);
      const fileName = key.split("/").pop() || "textbook.pdf";

      const responseBody = Uint8Array.from(body).buffer;

      return new Response(responseBody, {
        headers: {
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Content-Type": objectResponse.ContentType || "application/pdf",
          ...corsHeaders,
        },
      });
    }

    const grade = pickFirstNonEmpty(url.searchParams.get("grade"));
    const subject = pickFirstNonEmpty(url.searchParams.get("subject"));
    const expectedFileName =
      grade && subject
        ? `${normalizeSearchText(grade)}_${getPrimarySubjectAlias(subject)}.pdf`
        : "";

    const directMatches =
      grade && subject
        ? await findDirectTextbookMatches(client, connection.bucketName, grade, subject)
        : [];
    const listedItems = await listBucketObjects(
      client,
      connection.bucketName,
      grade,
      subject,
    );
    const itemByKey = new Map(
      [...directMatches, ...listedItems].map((item) => [item.key, item]),
    );
    const items = Array.from(itemByKey.values()).sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      return Date.parse(right.lastModified || "") - Date.parse(left.lastModified || "");
    });

    return new Response(
      JSON.stringify({
        bucketName: connection.bucketName,
        expectedFileName,
        items,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const env = getRouteEnv();
    const contentTypeHeader = req.headers.get("content-type") || "";

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof (file as File).arrayBuffer !== "function") {
        throw new Error("Upload хийх PDF файл олдсонгүй.");
      }

      const uploadFile = file as File;
      const connection = await resolveR2Connection(
        env,
        String(formData.get("bucketName") ?? ""),
      );
      const key = pickFirstNonEmpty(String(formData.get("key") ?? ""));

      if (!key) {
        throw new Error("R2 object key хоосон байна.");
      }

      const client = createR2Client(connection);
      const body = new Uint8Array(await uploadFile.arrayBuffer());
      const contentType = pickFirstNonEmpty(
        uploadFile.type,
        "application/pdf",
      );

      await client.send(
        new PutObjectCommand({
          Bucket: connection.bucketName,
          Key: key,
          ContentType: contentType,
          Body: body,
        }),
      );

      return new Response(
        JSON.stringify({
          bucketName: connection.bucketName,
          contentType,
          fileName: uploadFile.name,
          key,
          size: uploadFile.size,
          uploadedAt: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const body = (await req.json()) as PresignRequestBody;
    const key = pickFirstNonEmpty(body.key);

    if (!key) {
      throw new Error("R2 object key хоосон байна.");
    }

    const connection = await resolveR2Connection(env, body.bucketName);
    const client = createR2Client(connection);
    const command = new PutObjectCommand({
      Bucket: connection.bucketName,
      Key: key,
      ContentType: pickFirstNonEmpty(body.contentType, "application/pdf"),
    });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return new Response(
      JSON.stringify({
        bucketName: connection.bucketName,
        key,
        url: signedUrl,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
