import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getDb } from "../db";

export interface GraphQLContext {
	env: {
		DB?: D1Database;
		/** AI scheduler — GraphQL mutation-аас мессеж илгээнэ */
		SCHEDULER_QUEUE?: Queue;
		/** AI exam variants — GraphQL mutation-аас мессеж илгээнэ */
		EXAM_VARIANT_QUEUE?: Queue;
		/** Workers AI — бусад туршилтууд (одоогоор `analyzeQuestion` нь Gemini). */
		AI?: Ai;
		/** Google AI Studio / Gemini API — илүүдэл нэр (secret). `GEMINI_API_KEY`-тэй адил ашиглагдана. */
		GOOGLE_AI_API_KEY?: string;
		/** Google Gemini API — `generateExamQuestions` болон `analyzeQuestion`. */
		GEMINI_API_KEY?: string;
		/** Gemini model — `generateExamQuestions` (`lib/ai.ts`). */
		GEMINI_MODEL?: string;
		/** Зөвхөн `analyzeQuestion` — хоосон бол `GEMINI_MODEL` ашиглагдана. */
		GEMINI_ANALYZE_MODEL?: string;
		/** `1` / `true` — `generateExamQuestions` AI-аас өмнө input-ийг консолд бичнэ */
		LOG_GRAPHQL_GENERATION?: string;
	};
	db: DrizzleD1Database<typeof schema> | null;
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
	const { env } = await getCloudflareContext();
	const e = env as CloudflareEnv & {
		DB?: D1Database;
		SCHEDULER_QUEUE?: Queue;
		EXAM_VARIANT_QUEUE?: Queue;
		AI?: Ai;
		GOOGLE_AI_API_KEY?: string;
		GEMINI_API_KEY?: string;
		GEMINI_MODEL?: string;
		GEMINI_ANALYZE_MODEL?: string;
		LOG_GRAPHQL_GENERATION?: string;
	};
	return {
		env: {
			DB: e.DB,
			SCHEDULER_QUEUE: e.SCHEDULER_QUEUE,
			EXAM_VARIANT_QUEUE: e.EXAM_VARIANT_QUEUE,
			AI: e.AI,
			GOOGLE_AI_API_KEY:
				e.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_AI_API_KEY,
			GEMINI_API_KEY: e.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY,
			GEMINI_MODEL: e.GEMINI_MODEL ?? process.env.GEMINI_MODEL,
			GEMINI_ANALYZE_MODEL:
				e.GEMINI_ANALYZE_MODEL ?? process.env.GEMINI_ANALYZE_MODEL,
			LOG_GRAPHQL_GENERATION:
				e.LOG_GRAPHQL_GENERATION ?? process.env.LOG_GRAPHQL_GENERATION,
		},
		db: e.DB ? getDb(e.DB) : null,
	};
}
