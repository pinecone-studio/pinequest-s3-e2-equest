import type { NextRequest } from "next/server";

import { requestAblyToken } from "@/lib/ably";

function corsOrigins(): string[] {
  const base = ["http://localhost:3000", "http://127.0.0.1:3000"];
  const extra =
    process.env.GRAPHQL_CORS_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  return [...base, ...extra];
}

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (corsOrigins().includes(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".tsetsegulziiocherdene.workers.dev")
    );
  } catch {
    return false;
  }
}

function withCors(request: NextRequest, response: Response) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.append("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

export async function GET(request: NextRequest) {
  const result = await requestAblyToken(request);

  if ("error" in result) {
    return withCors(
      request,
      new Response(JSON.stringify({ error: result.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
      }),
    );
  }

  return withCors(
    request,
    new Response(JSON.stringify(result.tokenRequest), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 204 });
  }
  return withCors(request, new Response(null, { status: 204 }));
}

