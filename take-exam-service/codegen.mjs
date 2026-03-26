/** @type {import("@graphql-codegen/cli").CodegenConfig} */
const config = {
	overwrite: true,
	schema: "src/lib/graphql/schema.graphql",
	documents: ["src/gql/documents/**/*.graphql"],
	generates: {
		"src/gql/generated.ts": {
			plugins: ["typescript", "typescript-operations", "typed-document-node"],
			config: {
				useTypeImports: true,
			},
		},
	},
};

export default config;
