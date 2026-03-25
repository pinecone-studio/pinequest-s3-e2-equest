import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";

const yoga = createYoga({
    schema,
    graphqlEndpoint: "/api/graphql",
    fetchAPI: { Response },
    maskedErrors: false, // Show real errors for debugging
});

// Explicitly wrap the handlers to avoid Type mismatches with Next.js
export async function GET(request: Request) {
    return yoga.handleRequest(request, {});
}

export async function POST(request: Request) {
    return yoga.handleRequest(request, {});
}