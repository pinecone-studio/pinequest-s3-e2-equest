import type { NextRequest } from "next/server";

import { requestAblyToken } from "@/lib/ably";

export async function GET(request: NextRequest) {
  const result = await requestAblyToken(request);

  if ("error" in result) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result.tokenRequest), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

