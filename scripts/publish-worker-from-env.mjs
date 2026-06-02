import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const workerDir = path.join(repoRoot, "apps", "worker");

const parseEnvFile = (source) => {
  const values = new Map();

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

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

const childEnv = { ...process.env };
if (fs.existsSync(envPath)) {
  const envValues = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of envValues) {
    if (key === "CLOUDFLARE_API_TOKEN" || key === "CLOUDFLARE_ACCOUNT_ID" || key === "CLOUDFLARE_USE_LOCAL_AUTH") {
      continue;
    }
    if (typeof childEnv[key] === "undefined") {
      childEnv[key] = value;
    }
  }
}
delete childEnv.CLOUDFLARE_API_TOKEN;
delete childEnv.CLOUDFLARE_ACCOUNT_ID;

const run = (command, args, cwd = repoRoot) => {
  console.log(`[worker-publish] ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: childEnv,
  });
};

run("node", ["scripts/sync-deployments-to-env.mjs"]);
run("node", ["scripts/sync-runtime-envs.mjs"]);
run("node", ["scripts/push-cloudflare-secrets.mjs"]);
run("npx", ["wrangler", "deploy", ...process.argv.slice(2)], workerDir);
