const fs = require("fs");
const path = require("path");

const operationsPath = path.join(
  __dirname,
  "..",
  "src",
  "take-exam-gql",
  "operations.ts",
);

if (!fs.existsSync(operationsPath)) {
  process.exit(0);
}

const source = fs.readFileSync(operationsPath, "utf8");
const next = source.replace(
  "import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';",
  "import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';",
);

if (next !== source) {
  fs.writeFileSync(operationsPath, next, "utf8");
}
