import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	overwrite: true,
	schema: "src/graphql/schema.graphql",
	generates: {
		"src/graphql/generated/resolvers-types.ts": {
			plugins: ["typescript", "typescript-resolvers"],
			config: {
				contextType: "../context#GraphQLContext",
				useIndexSignature: true,
			},
		},
	},
};

export default config;
