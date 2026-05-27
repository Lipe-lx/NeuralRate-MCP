import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const workerDir = path.join(repoRoot, "apps", "worker");

const defaultSecretBindings = [
  { target: "FRED_API_KEY", sources: ["FRED_API_KEY"] },
  { target: "NANSEN_API_KEY", sources: ["NANSEN_API_KEY"] },
  { target: "INTERNAL_API_TOKEN", sources: ["INTERNAL_API_TOKEN", "NEURALRATE_INTERNAL_API_TOKEN"] },
];

const parseEnvFile = (source) => {
  const values = new Map();

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
};

if (!fs.existsSync(envPath)) {
  throw new Error(`Missing ${envPath}.`);
}

const envValues = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const bindingsByTarget = new Map(defaultSecretBindings.map((binding) => [binding.target, binding]));
const requestedKeys = (process.env.CLOUDFLARE_SECRET_KEYS || defaultSecretBindings.map((binding) => binding.target).join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const payload = {};

for (const key of requestedKeys) {
  const binding = bindingsByTarget.get(key) || { target: key, sources: [key] };
  const value = binding.sources
    .map((sourceKey) => process.env[sourceKey]?.trim() || envValues.get(sourceKey)?.trim() || "")
    .find(Boolean);
  if (!value) {
    console.warn(`[cloudflare-secrets] skipping ${key} because it is empty or missing.`);
    continue;
  }
  payload[binding.target] = value;
}

const secretKeys = Object.keys(payload);

if (secretKeys.length === 0) {
  throw new Error(
    "No Cloudflare Worker secrets were resolved. Fill them in .env or pass CLOUDFLARE_SECRET_KEYS with valid values."
  );
}

const tempFile = path.join(os.tmpdir(), `neuralrate-worker-secrets-${Date.now()}.json`);
fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));

try {
  console.log(`[cloudflare-secrets] publishing ${secretKeys.length} secret(s): ${secretKeys.join(", ")}`);
  const childEnv = { ...process.env };
  const useLocalAuth = (process.env.CLOUDFLARE_USE_LOCAL_AUTH || envValues.get("CLOUDFLARE_USE_LOCAL_AUTH") || "")
    .trim()
    .toLowerCase() === "true";
  if (!useLocalAuth) {
    for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
      if (!childEnv[key] && envValues.get(key)?.trim()) {
        childEnv[key] = envValues.get(key).trim();
      }
    }
  }
  execFileSync("npx", ["wrangler", "secret", "bulk", tempFile], {
    cwd: workerDir,
    stdio: "inherit",
    env: childEnv,
  });
} finally {
  fs.rmSync(tempFile, { force: true });
}
