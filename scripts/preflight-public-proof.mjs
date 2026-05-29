import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const fail = (message) => {
  console.error(`PUBLIC PREFLIGHT FAILED: ${message}`);
  process.exit(1);
};

const readText = (relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing file: ${relativePath}`);
  }
  return readFileSync(absolutePath, "utf8");
};

const readJson = (relativePath) => {
  const text = readText(relativePath);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const deployment = readJson("deployments/mantle-sepolia.json");
const benchmarkAddress = String(deployment.address || "").trim();
if (!benchmarkAddress) {
  fail("Missing benchmark address in deployments/mantle-sepolia.json");
}

const legacyBenchmark = "0xc51560a5512d2A5756435d87319aeaE1bA480165";
const mustNotContainLegacy = [
  "README.md",
  "apps/web/public/llms.txt",
  "apps/web/src/config.ts",
];

for (const relativePath of mustNotContainLegacy) {
  const text = readText(relativePath);
  if (text.includes(legacyBenchmark)) {
    fail(`Legacy benchmark address still present in ${relativePath}`);
  }
}

const mustContainBenchmark = [
  "README.md",
  "apps/web/public/llms.txt",
  "apps/web/src/config.ts",
];

for (const relativePath of mustContainBenchmark) {
  const text = readText(relativePath).toLowerCase();
  if (!text.includes(benchmarkAddress.toLowerCase())) {
    fail(`Benchmark address mismatch in ${relativePath} (expected ${benchmarkAddress})`);
  }
}

const requiredPublicDocs = [
  "architecture.md",
  "mcp-server.md",
  "smart-contract.md",
  "database.md",
  "frontend.md",
  "risk-model.md",
  "trust-assumptions.md",
];

for (const fileName of requiredPublicDocs) {
  const relativePath = `apps/web/public/docs/${fileName}`;
  if (!existsSync(path.join(repoRoot, relativePath))) {
    fail(`Missing published doc: ${relativePath}`);
  }
}

if (!existsSync(path.join(repoRoot, "apps/web/public/verify/deployments.json"))) {
  fail("Missing verification bundle: apps/web/public/verify/deployments.json");
}

if (!existsSync(path.join(repoRoot, "apps/web/public/verify/agent-card.json"))) {
  fail("Missing copied agent card: apps/web/public/verify/agent-card.json");
}

console.log("PUBLIC PREFLIGHT OK");
