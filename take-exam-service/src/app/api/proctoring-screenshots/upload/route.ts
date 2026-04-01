import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const getRequiredEnv = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} environment variable is required.`);
  }

  return value;
};

const getS3Client = () =>
  new S3Client({
    region: "auto",
    endpoint: getRequiredEnv("R2_S3_API"),
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const formData = await request.formData();
    const key = formData.get("key");
    const file = formData.get("file");

    if (typeof key !== "string" || !key.trim()) {
      return Response.json(
        { message: "key is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!(file instanceof File)) {
      return Response.json(
        { message: "file is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    const client = getS3Client();
    const body = new Uint8Array(await file.arrayBuffer());

    await client.send(
      new PutObjectCommand({
        Bucket: getRequiredEnv("R2_PROCTORING_BUCKET_NAME"),
        CacheControl: "private, max-age=31536000, immutable",
        ContentType: file.type || "image/jpeg",
        Key: key.trim(),
        Body: body,
      }),
    );

    return Response.json(
      {
        key: key.trim(),
        publicUrl: `${requestUrl.origin}/api/proctoring-screenshots/object?key=${encodeURIComponent(
          key.trim(),
        )}`,
      },
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Screenshot upload fallback амжилтгүй боллоо.",
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
