import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const publishScript = fs.readFileSync(
  path.join(repoRoot, "scripts", "publish-worker-from-env.mjs"),
  "utf8"
);

test("worker publish applies remote D1 migrations before deploying", () => {
  const migrationCommand = 'run("npx", ["wrangler", "d1", "migrations", "apply", "DECISIONS_DB", "--remote"], workerDir);';
  const deployCommand = 'run("npx", ["wrangler", "deploy", ...process.argv.slice(2)], workerDir);';
  const migrationIndex = publishScript.indexOf(migrationCommand);
  const deployIndex = publishScript.indexOf(deployCommand);

  assert.notEqual(migrationIndex, -1, "expected the worker publish script to apply D1 migrations");
  assert.notEqual(deployIndex, -1, "expected the worker publish script to deploy the worker");
  assert.ok(migrationIndex < deployIndex, "D1 migrations must complete before the worker deploy starts");
});
