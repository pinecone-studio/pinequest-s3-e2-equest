import { createYoga } from "graphql-yoga";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { schema } from "@/lib/graphql/schema";
import { validateSebRequest } from "@/lib/seb/verify";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response, Request },
  graphiql: false,
  maskedErrors: false,
});

async function handleYogaRequest(request: Request) {
  const sebValidation = validateSebRequest(request);
  if (!sebValidation.ok) {
    return new Response(
      JSON.stringify({
        errors: [{ message: sebValidation.message }],
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    const response = await yoga.handleRequest(request, {});

    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const body = JSON.stringify({
      errors: [
        {
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      ],
    });

    return new Response(body, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  const hasQuery =
    request.nextUrl.searchParams.has("query") ||
    request.nextUrl.searchParams.has("operationName") ||
    request.nextUrl.searchParams.has("variables") ||
    request.nextUrl.searchParams.has("extensions");

  if (hasQuery) {
    return handleYogaRequest(request);
  }

  const explorer = new URL("https://studio.apollographql.com/sandbox/explorer");
  explorer.searchParams.set(
    "endpoint",
    `${request.nextUrl.origin}/api/graphql`,
  );
  return NextResponse.redirect(explorer, 302);
}

export async function POST(request: Request) {
  return handleYogaRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
