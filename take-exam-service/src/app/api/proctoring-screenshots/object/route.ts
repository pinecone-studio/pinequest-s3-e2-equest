import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  corsHeaders,
  createStorageUnavailableResponse,
  getRequiredEnv,
  getMissingStorageEnvKeys,
  getProctoringStorageClient,
} from "../shared";

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

    const missingEnvKeys = getMissingStorageEnvKeys();
    if (missingEnvKeys.length > 0) {
      return createStorageUnavailableResponse(missingEnvKeys);
    }

    const client = getProctoringStorageClient();
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
