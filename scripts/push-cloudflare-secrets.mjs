import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");

const secretProfiles = {
  worker: {
    label: "worker",
    workerDir: path.join(repoRoot, "apps", "worker"),
    bindings: [
      { target: "FRED_API_KEY", sources: ["FRED_API_KEY"] },
      { target: "NANSEN_API_KEY", sources: ["NANSEN_API_KEY"] },
      { target: "NEURALRATE_INTERNAL_API_TOKEN", sources: ["NEURALRATE_INTERNAL_API_TOKEN", "INTERNAL_API_TOKEN"] },
    ],
  },
  executor: {
    label: "executor",
    workerDir: path.join(repoRoot, "apps", "executor"),
    bindings: [
      { target: "NEURALRATE_INTERNAL_API_TOKEN", sources: ["NEURALRATE_INTERNAL_API_TOKEN", "INTERNAL_API_TOKEN"] },
      { target: "PIMLICO_API_KEY", sources: ["PIMLICO_API_KEY"] },
      { target: "TURNKEY_API_PRIVATE_KEY", sources: ["TURNKEY_API_PRIVATE_KEY"] },
      { target: "TURNKEY_API_PUBLIC_KEY", sources: ["TURNKEY_API_PUBLIC_KEY"] },
      { target: "TURNKEY_ORGANIZATION_ID", sources: ["TURNKEY_ORGANIZATION_ID"] },
      { target: "NEURALRATE_MANAGED_SIGNER_TOKEN", sources: ["NEURALRATE_MANAGED_SIGNER_TOKEN"] },
    ],
  },
};

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

const profileName = (process.env.CLOUDFLARE_SECRET_PROFILE || "worker").trim().toLowerCase();
const profile = secretProfiles[profileName];

if (!profile) {
  throw new Error(
    `Unknown CLOUDFLARE_SECRET_PROFILE=${profileName}. Expected one of: ${Object.keys(secretProfiles).join(", ")}.`
  );
}

if (!fs.existsSync(envPath)) {
  throw new Error(`Missing ${envPath}.`);
}

const envValues = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const bindingsByTarget = new Map(profile.bindings.map((binding) => [binding.target, binding]));
const requestedKeys = (
  process.env.CLOUDFLARE_SECRET_KEYS ||
  profile.bindings.map((binding) => binding.target).join(",")
)
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
    console.warn(`[cloudflare-secrets:${profile.label}] skipping ${key} because it is empty or missing.`);
    continue;
  }
  payload[binding.target] = value;
}

const secretKeys = Object.keys(payload);

if (secretKeys.length === 0) {
  throw new Error(
    `No Cloudflare ${profile.label} secrets were resolved. Fill them in .env or pass CLOUDFLARE_SECRET_KEYS with valid values.`
  );
}

console.log(
  `[cloudflare-secrets:${profile.label}] publishing ${secretKeys.length} secret(s): ${secretKeys.join(", ")}`
);

const childEnv = { ...process.env };
delete childEnv.CLOUDFLARE_API_TOKEN;
delete childEnv.CLOUDFLARE_ACCOUNT_ID;

try {
  for (const [key, value] of Object.entries(payload)) {
    console.log(`[cloudflare-secrets:${profile.label}] updating ${key}`);
    const output = execFileSync("npx", ["wrangler", "secret", "put", key], {
      cwd: profile.workerDir,
      stdio: "pipe",
      env: childEnv,
      encoding: "utf8",
      input: `${value}\n`,
    });
    if (output) {
      process.stdout.write(output);
    }
  }
} catch (error) {
  const stdout = typeof error?.stdout === "string" ? error.stdout : "";
  const stderr = typeof error?.stderr === "string" ? error.stderr : "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const combined = `${stdout}\n${stderr}`;
  const authError =
    combined.includes("Authentication error") ||
    combined.includes("Invalid access token") ||
    combined.includes("[code: 10000]") ||
    combined.includes("[code: 9109]");

  if (authError) {
    throw new Error(
      [
        "Cloudflare Wrangler auth failed.",
        "This repo publishes secrets only through your local `wrangler login` session.",
        "Run `npx wrangler login` first, then retry the secrets sync command.",
      ].join(" ")
    );
  }

  throw error;
}
