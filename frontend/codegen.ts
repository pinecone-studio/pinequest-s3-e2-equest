import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Backend-ийн `schema.graphql`-аас client төрөл + gql document-ууд үүсгэнэ.
 * Ажиллуулах: `bun run codegen` (frontend хавтаснаас).
 */
const config: CodegenConfig = {
	overwrite: true,
	ignoreNoDocuments: true,
	hooks: {
		afterAllFileWrite: ["node scripts/fix-typed-document-imports.cjs"],
	},
	generates: {
		"src/gql/": {
			schema: "../create-exam-service/src/graphql/schema.graphql",
			documents: ["src/gql/create-exam-documents.ts"],
			preset: "client",
			presetConfig: {
				gqlTagName: "gql",
			},
		},
		"src/take-exam-gql/operations.ts": {
			schema: "../take-exam-service/src/lib/graphql/schema.graphql",
			documents: ["src/take-exam-gql/**/*.graphql"],
			plugins: ["typescript", "typescript-operations", "typed-document-node"],
		},
	},
};

export default config;
