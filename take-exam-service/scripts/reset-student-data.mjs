#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  process.stdout.write(`Usage: node scripts/reset-student-data.mjs [options]

Options:
  --local              Clear local Wrangler D1/KV state instead of remote
  --remote             Clear remote Wrangler D1/KV state (default)
  --include-students   Also delete rows from the students table
  --keep-kv            Skip deleting attempt:* keys from EXAM_CACHE
  --help               Show this message

Examples:
  npm run reset:student-data
  npm run reset:student-data:all
  npm run reset:student-data:local
  npm run reset:student-data -- --local --include-students
`);
  process.exit(0);
}

const isLocal = args.has("--local");
const targetFlag = isLocal ? "--local" : "--remote";
const includeStudents = args.has("--include-students");
const keepKv = args.has("--keep-kv");

const wrangler = (commandArgs, options = {}) => {
  return execFileSync(
    "npx",
    ["wrangler", ...commandArgs],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    },
  );
};

const runSql = (sql) => {
  process.stdout.write(`\n[D1] ${sql}\n`);
  const output = wrangler([
    "d1",
    "execute",
    "DB",
    targetFlag,
    "--command",
    sql,
    "--json",
  ]);

  if (output.trim()) {
    process.stdout.write(`${output.trim()}\n`);
  }
};

const listAttemptCacheKeys = () => {
  try {
    const output = wrangler([
      "kv",
      "key",
      "list",
      "--binding",
      "EXAM_CACHE",
      targetFlag,
      "--prefix",
      "attempt:",
    ]);

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") && line.includes('"name"'))
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          return typeof parsed.name === "string" ? parsed.name : null;
        } catch {
          return null;
        }
      })
      .filter((value) => Boolean(value));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown KV list error";
    process.stderr.write(`[KV] attempt cache list failed: ${message}\n`);
    return [];
  }
};

const deleteAttemptCacheKeys = (keys) => {
  if (keys.length === 0) {
    process.stdout.write("[KV] No attempt cache keys found.\n");
    return;
  }

  process.stdout.write(`[KV] Deleting ${keys.length} attempt cache keys...\n`);

  for (const key of keys) {
    wrangler([
      "kv",
      "key",
      "delete",
      key,
      "--binding",
      "EXAM_CACHE",
      targetFlag,
    ]);
    process.stdout.write(`  deleted ${key}\n`);
  }
};

const browserSnippet = `sessionStorage.removeItem("active_exam_attempt");
sessionStorage.removeItem("exam_monitoring:session_id");
for (const key of Object.keys(localStorage)) {
  if (
    key.startsWith("answers_") ||
    key.startsWith("exam_monitoring:fingerprint:") ||
    key.startsWith("exam_monitoring:attempt_session:")
  ) {
    localStorage.removeItem(key);
  }
}`;

process.stdout.write(
  `Resetting student-side data in ${isLocal ? "LOCAL" : "REMOTE"} storage...\n`,
);

runSql("DELETE FROM attempts;");

if (includeStudents) {
  runSql("DELETE FROM students;");
}

if (!keepKv) {
  deleteAttemptCacheKeys(listAttemptCacheKeys());
}

process.stdout.write("\nDone.\n");
process.stdout.write(
  "\nBrowser local/session storage is not reachable from this script.\n",
);
process.stdout.write(
  "Run this in the student page browser console if you also want to clear browser-side state:\n\n",
);
process.stdout.write(`${browserSnippet}\n`);
