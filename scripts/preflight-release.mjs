import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
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

function printStatus(label, ok, detail) {
  const marker = ok ? "OK" : "BLOCKED";
  console.log(`[${marker}] ${label}${detail ? ` - ${detail}` : ""}`);
}

const env = parseEnv(envPath);
let hasBlockers = false;

const checks = [
  ["Worker internal token", !isUnset(env.NEURALRATE_INTERNAL_API_TOKEN), env.NEURALRATE_INTERNAL_API_TOKEN ? "present" : "missing"],
  ["Executor base URL", !isUnset(env.EXECUTOR_BASE_URL), env.EXECUTOR_BASE_URL || "missing"],
  ["Pimlico or explicit bundler URL", Boolean((env.PIMLICO_API_KEY || "").trim() || (env.NEURALRATE_4337_BUNDLER_URL || "").trim()), (env.PIMLICO_API_KEY || env.NEURALRATE_4337_BUNDLER_URL) ? "present" : "missing"],
  ["Turnkey Organization ID", !isUnset(env.TURNKEY_ORGANIZATION_ID), env.TURNKEY_ORGANIZATION_ID ? "present" : "missing"],
  ["Turnkey API Public Key", !isUnset(env.TURNKEY_API_PUBLIC_KEY), env.TURNKEY_API_PUBLIC_KEY ? "present" : "missing"],
  ["Turnkey API Private Key", !isUnset(env.TURNKEY_API_PRIVATE_KEY), env.TURNKEY_API_PRIVATE_KEY ? "present" : "missing"],
  ["Turnkey Wallet Address", !isUnset(env.TURNKEY_WALLET_ACCOUNT_ADDRESS), env.TURNKEY_WALLET_ACCOUNT_ADDRESS || "missing"],
  ["Agent smart wallet", !isUnset(env.NEURALRATE_AGENT_SMART_WALLET), env.NEURALRATE_AGENT_SMART_WALLET || "missing"],
  ["Agent session signer", !isUnset(env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS), env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS || "missing"],
  ["Receipt registry", !isUnset(env.NEURALRATE_BENCHMARK_CONTRACT), env.NEURALRATE_BENCHMARK_CONTRACT || "missing"],
  ["Policy registry", !isUnset(env.NEURALRATE_POLICY_REGISTRY_CONTRACT), env.NEURALRATE_POLICY_REGISTRY_CONTRACT || "missing"],
  ["Execution guard", !isUnset(env.NEURALRATE_EXECUTION_GUARD_CONTRACT), env.NEURALRATE_EXECUTION_GUARD_CONTRACT || "missing"],
  ["Safe4337 module", !isUnset(env.NEURALRATE_SAFE_4337_MODULE_ADDRESS), env.NEURALRATE_SAFE_4337_MODULE_ADDRESS || "missing"],
  ["Safe7579 adapter", !isUnset(env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS), env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS || "missing"],
  ["Safe7579 launchpad", !isUnset(env.NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS), env.NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS || "missing"],
  ["Delegate validator", !isUnset(env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS), env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS || "missing"],
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
  console.log("3. Run npm run cf:secrets:sync to publish worker secrets to Cloudflare.");
  console.log("4. Ensure your executor host loads apps/executor/.env.local or the equivalent secret set.");
  process.exitCode = 1;
} else {
  console.log("Release preflight passed. The repo has the minimum local configuration required for Worker + executor + AA bundler runtime.");
}
