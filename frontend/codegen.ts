import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Backend-ийн `schema.graphql`-аас client төрөл + gql document-ууд үүсгэнэ.
 * Ажиллуулах: `bun run codegen` (frontend хавтаснаас).
 */
const config: CodegenConfig = {
	overwrite: true,
	schema: "../create-exam-service/src/graphql/schema.graphql",
	documents: ["src/gql/create-exam-documents.ts"],
	ignoreNoDocuments: true,
	generates: {
		"src/gql/": {
			preset: "client",
			presetConfig: {
				gqlTagName: "gql",
			},
		},
	},
};

export default config;
