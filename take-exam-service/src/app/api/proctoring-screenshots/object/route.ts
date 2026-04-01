import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key")?.trim();

    if (!key) {
      return Response.json(
        { message: "key query parameter is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    const client = getS3Client();
    const result = await client.send(
      new GetObjectCommand({
        Bucket: getRequiredEnv("R2_PROCTORING_BUCKET_NAME"),
        Key: key,
      }),
    );

    const bytes = result.Body
      ? await result.Body.transformToByteArray()
      : new Uint8Array();
    const bodyBytes = new Uint8Array(bytes.byteLength);
    bodyBytes.set(bytes);
    const body = new Blob([bodyBytes], {
      type: result.ContentType || "application/octet-stream",
    });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": result.ContentType || "application/octet-stream",
      },
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Screenshot file авч чадсангүй.",
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
