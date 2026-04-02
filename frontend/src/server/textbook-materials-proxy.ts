import { getCreateExamServiceBaseUrl } from "@/lib/create-exam-graphql";

function buildUpstreamUrl(request: Request, pathSuffix = "") {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `/api/textbook-materials${pathSuffix}`,
    getCreateExamServiceBaseUrl(),
  );

  incomingUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  return upstreamUrl;
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
      return `Textbook materials upstream error (${upstream.status})`;
    }
  }

  try {
    const text = (await upstream.text()).trim();
    return text || `Textbook materials upstream error (${upstream.status})`;
  } catch {
    return `Textbook materials upstream error (${upstream.status})`;
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

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return {
    body: await request.text(),
    headers,
  };
}

function buildProxyHeaders(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  headers.set("Cache-Control", "no-store");
  return headers;
}

export function textbookMaterialsProxyOptions(methods = "GET, POST, PATCH, OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function forwardTextbookMaterialsRequest(
  request: Request,
  pathSuffix = "",
) {
  const upstreamUrl = buildUpstreamUrl(request, pathSuffix);

  try {
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
            ? `Textbook materials proxy request failed: ${error.message}`
            : "Textbook materials proxy request failed.",
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
