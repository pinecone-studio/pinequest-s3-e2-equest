import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";

type RouteEnv = {
  DB?: D1Database;
};

export function getTextbookMaterialEnv() {
  return (getCloudflareContext() as unknown as { env: RouteEnv }).env;
}

export function getTextbookMaterialDb() {
  const env = getTextbookMaterialEnv();
  if (!env.DB) {
    throw new Error("D1 DB binding олдсонгүй.");
  }
  return getDb(env.DB);
}

export function textbookCorsHeaders(methods = "GET, POST, PATCH, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export function textbookOptions(methods?: string) {
  return new Response(null, {
    status: 204,
    headers: textbookCorsHeaders(methods),
  });
}

export async function readTextbookJsonBody<T>(request: Request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (!contentType.includes("application/json")) {
    if (contentType.includes("multipart/form-data")) {
      throw new Error(
        "Энэ хүсэлт JSON body хүлээж байна. multipart/form-data endpoint руу биш илгээгдсэн байна.",
      );
    }

    throw new Error(
      "Энэ хүсэлт application/json body хүлээж байна.",
    );
  }

  try {
    return (await request.json()) as T;
  } catch {
    throw new Error(
      "JSON body-г уншиж чадсангүй. Илгээсэн өгөгдлийн бүтэц буруу байна.",
    );
  }
}

export function textbookJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: textbookCorsHeaders(),
  });
}

export function textbookError(error: unknown, status = 400) {
  return textbookJson(
    {
      error:
        error instanceof Error
          ? error.message
          : "Textbook material боловсруулах үед алдаа гарлаа.",
    },
    status,
  );
}
