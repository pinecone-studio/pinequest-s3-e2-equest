import type { NextRequest } from "next/server";
import { createYoga } from "graphql-yoga";
import { createGraphQLContext, type GraphQLContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

/** Локал + `GRAPHQL_CORS_ORIGINS` (таслалаар тусгаарлагдсан) — frontend deploy-ийн бүрэн origin */
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

	// Cloudflare Workers deploy-уудын хувьд (frontend/backend тусдаа subdomain) нийтлэг suffix-ээр allow хийх.
	// Хэрэв илүү хатуу болгох бол `GRAPHQL_CORS_ORIGINS`-оо production дээр яг frontend origin-оор тохируул.
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

const yoga = createYoga<GraphQLContext>({
	schema,
	graphqlEndpoint: "/api/graphql",
	// CORS-г доор wrapper дээр найдвартайгаар удирдана.
	cors: false,
	context: createGraphQLContext,
});

/** Next.js 16 `RouteHandlerConfig` нь `YogaServerInstance`-ийг шууд хүлээн авахгүй — Request → Response wrapper */
function graphqlRoute(request: NextRequest) {
	if (request.method === "OPTIONS") {
		const origin = request.headers.get("origin");
		if (!isAllowedOrigin(origin)) {
			return new Response(null, { status: 204 });
		}
		return withCors(request, new Response(null, { status: 204 }));
	}

	const result = yoga(request);
	return result instanceof Promise
		? result.then((res: Response) => withCors(request, res))
		: withCors(request, result);
}

export const GET = graphqlRoute;
export const POST = graphqlRoute;
export const OPTIONS = graphqlRoute;
