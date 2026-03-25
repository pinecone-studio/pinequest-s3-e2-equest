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

const yoga = createYoga<GraphQLContext>({
	schema,
	graphqlEndpoint: "/api/graphql",
	cors: {
		origin: corsOrigins(),
		credentials: true,
	},
	context: createGraphQLContext,
});

export const GET = yoga;
export const POST = yoga;
export const OPTIONS = yoga;
