import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const webEnvPath = path.join(repoRoot, "apps", "web", ".env.production");
const workerWranglerPath = path.join(repoRoot, "apps", "worker", "wrangler.toml");
const executorWranglerPath = path.join(repoRoot, "apps", "executor", "wrangler.toml");
const zeroAddress = "0x0000000000000000000000000000000000000000";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function isUnset(value) {
  return !value || value.trim() === "" || value.trim().toLowerCase() === zeroAddress.toLowerCase();
}

function isLoopbackUrl(value) {
  if (isUnset(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost" ||
      url.hostname === "0.0.0.0" ||
      url.hostname === "::1" ||
      url.hostname.startsWith("127.")
    );
  } catch {
    return false;
  }
}

function printStatus(label, ok, detail) {
  const marker = ok ? "OK" : "BLOCKED";
  console.log(`[${marker}] ${label}${detail ? ` - ${detail}` : ""}`);
}

const env = parseEnv(envPath);
const webEnv = fs.existsSync(webEnvPath) ? parseEnv(webEnvPath) : {};
const workerWrangler = fs.existsSync(workerWranglerPath) ? fs.readFileSync(workerWranglerPath, "utf8") : "";
const executorWrangler = fs.existsSync(executorWranglerPath) ? fs.readFileSync(executorWranglerPath, "utf8") : "";
let hasBlockers = false;
const envProfile = (env.NEURALRATE_ENV_PROFILE || "").trim().toLowerCase();
const executorBaseUrl = env.EXECUTOR_BASE_URL || "";
const executorDataApiBaseUrl = env.NEURALRATE_DATA_API_BASE_URL || "";
const executorBaseUrlOk =
  isUnset(executorBaseUrl) ||
  !(envProfile === "production" && isLoopbackUrl(executorBaseUrl));
const executorBaseUrlDetail =
  isUnset(executorBaseUrl)
    ? "not set (recommended for production with service binding)"
    : envProfile === "production" && isLoopbackUrl(executorBaseUrl)
      ? `${executorBaseUrl} (invalid for production; keep it empty or use only a non-loopback migration fallback)`
      : executorBaseUrl;
const executorDataApiBaseUrlOk =
  !isUnset(executorDataApiBaseUrl) &&
  !(envProfile === "production" && isLoopbackUrl(executorDataApiBaseUrl));
const executorDataApiBaseUrlDetail =
  isUnset(executorDataApiBaseUrl)
    ? "missing"
    : envProfile === "production" && isLoopbackUrl(executorDataApiBaseUrl)
      ? `${executorDataApiBaseUrl} (invalid for production; must be the public worker /api origin)`
      : executorDataApiBaseUrl;

const checks = [
  ["Worker internal token", !isUnset(env.NEURALRATE_INTERNAL_API_TOKEN), env.NEURALRATE_INTERNAL_API_TOKEN ? "present" : "missing"],
  [
    "Worker executor service binding",
    /\[\[services\]\][\s\S]*binding\s*=\s*"EXECUTOR"[\s\S]*service\s*=\s*"neuralrate-executor"/m.test(workerWrangler),
    /\[\[services\]\][\s\S]*binding\s*=\s*"EXECUTOR"[\s\S]*service\s*=\s*"neuralrate-executor"/m.test(workerWrangler)
      ? "present"
      : "missing from apps/worker/wrangler.toml",
  ],
  [
    "Executor workers.dev disabled",
    /workers_dev\s*=\s*false/m.test(executorWrangler),
    /workers_dev\s*=\s*false/m.test(executorWrangler) ? "false" : "must be false in apps/executor/wrangler.toml",
  ],
  ["Executor fallback URL", executorBaseUrlOk, executorBaseUrlDetail],
  ["Executor data API base URL", executorDataApiBaseUrlOk, executorDataApiBaseUrlDetail],
  ["Worker RPC URL", !isUnset(env.MANTLE_SEPOLIA_RPC_URL), env.MANTLE_SEPOLIA_RPC_URL || "missing"],
  ["Pimlico or explicit bundler URL", Boolean((env.PIMLICO_API_KEY || "").trim() || (env.NEURALRATE_4337_BUNDLER_URL || "").trim()), (env.PIMLICO_API_KEY || env.NEURALRATE_4337_BUNDLER_URL) ? "present" : "missing"],
  ["Paymaster sponsorship", Boolean((env.PIMLICO_API_KEY || "").trim() || (env.NEURALRATE_PAYMASTER_RPC_URL || "").trim()), (env.PIMLICO_API_KEY || env.NEURALRATE_PAYMASTER_RPC_URL) ? "present" : "missing"],
  ["Turnkey Organization ID", !isUnset(env.TURNKEY_ORGANIZATION_ID), env.TURNKEY_ORGANIZATION_ID ? "present" : "missing"],
  ["Turnkey API Public Key", !isUnset(env.TURNKEY_API_PUBLIC_KEY), env.TURNKEY_API_PUBLIC_KEY ? "present" : "missing"],
  ["Turnkey API Private Key", !isUnset(env.TURNKEY_API_PRIVATE_KEY), env.TURNKEY_API_PRIVATE_KEY ? "present" : "missing"],
  ["Turnkey Wallet Address", !isUnset(env.TURNKEY_WALLET_ACCOUNT_ADDRESS), env.TURNKEY_WALLET_ACCOUNT_ADDRESS || "missing"],
  ["Agent smart wallet", !isUnset(env.NEURALRATE_AGENT_SMART_WALLET), env.NEURALRATE_AGENT_SMART_WALLET || "missing"],
  ["Agent session signer", !isUnset(env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS), env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS || "missing"],
  ["Vault module", !isUnset(env.NEURALRATE_VAULT_MODULE_ADDRESS), env.NEURALRATE_VAULT_MODULE_ADDRESS || "missing"],
  ["Receipt registry", !isUnset(env.NEURALRATE_BENCHMARK_CONTRACT), env.NEURALRATE_BENCHMARK_CONTRACT || "missing"],
  ["Policy registry", !isUnset(env.NEURALRATE_POLICY_REGISTRY_CONTRACT), env.NEURALRATE_POLICY_REGISTRY_CONTRACT || "missing"],
  ["Execution guard", !isUnset(env.NEURALRATE_EXECUTION_GUARD_CONTRACT), env.NEURALRATE_EXECUTION_GUARD_CONTRACT || "missing"],
  ["Safe4337 module", !isUnset(env.NEURALRATE_SAFE_4337_MODULE_ADDRESS), env.NEURALRATE_SAFE_4337_MODULE_ADDRESS || "missing"],
  ["Safe7579 adapter", !isUnset(env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS), env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS || "missing"],
  ["Safe7579 launchpad", !isUnset(env.NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS), env.NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS || "missing"],
  ["Delegate validator", !isUnset(env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS), env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS || "missing"],
  ["Tracked web public env", fs.existsSync(webEnvPath), fs.existsSync(webEnvPath) ? "present" : "missing"],
  [
    "Tracked web API base URL",
    !isUnset(webEnv.VITE_PUBLIC_API_BASE_URL),
    webEnv.VITE_PUBLIC_API_BASE_URL || "missing",
  ],
  [
    "Tracked web scoped MCP URL",
    !isUnset(webEnv.VITE_PUBLIC_MCP_SCOPED_HTTP_URL),
    webEnv.VITE_PUBLIC_MCP_SCOPED_HTTP_URL || "missing",
  ],
  ["Executor wrangler file", fs.existsSync(executorWranglerPath), fs.existsSync(executorWranglerPath) ? "present" : "missing"],
];

for (const [label, ok, detail] of checks) {
  printStatus(label, ok, detail);
  if (!ok) hasBlockers = true;
}

console.log("");
if (hasBlockers) {
  console.log("Release preflight found blockers.");
  console.log("Recommended next steps:");
  console.log("1. Fill the blocked values in the root .env.");
  console.log("2. Run npm run env:sync:runtime to refresh local worker/executor runtime files.");
  console.log("3. Run npm run cf:executor:secrets:sync and npm run cf:worker:secrets:sync to publish secrets to Cloudflare.");
  console.log("4. Run npm run cf:prod:publish to deploy the private executor first and the public worker second.");
  process.exitCode = 1;
} else {
  console.log("Release preflight passed. The repo has the minimum local configuration required for a private executor Worker, internal service binding, and AA runtime.");
}
