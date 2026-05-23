import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, ".env");
const deploymentPath = path.join(repoRoot, "deployments", "mantle-sepolia.json");
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
const deployment = fs.existsSync(deploymentPath)
  ? JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
  : null;

let hasBlockers = false;

const checks = [
  {
    label: "Agent smart wallet address",
    ok: !isUnset(env.NEURALRATE_AGENT_SMART_WALLET),
    detail: env.NEURALRATE_AGENT_SMART_WALLET || "missing",
  },
  {
    label: "Agent session signer address",
    ok: !isUnset(env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS),
    detail: env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS || "missing",
  },
  {
    label: "Turnkey Organization ID",
    ok: !!env.TURNKEY_ORGANIZATION_ID,
    detail: env.TURNKEY_ORGANIZATION_ID ? "present" : "missing",
  },
  {
    label: "Turnkey API Public Key",
    ok: !!env.TURNKEY_API_PUBLIC_KEY,
    detail: env.TURNKEY_API_PUBLIC_KEY ? "present" : "missing",
  },
  {
    label: "Turnkey API Private Key",
    ok: !!env.TURNKEY_API_PRIVATE_KEY,
    detail: env.TURNKEY_API_PRIVATE_KEY ? "present" : "missing",
  },
  {
    label: "Turnkey Wallet Address",
    ok: !!env.TURNKEY_WALLET_ACCOUNT_ADDRESS,
    detail: env.TURNKEY_WALLET_ACCOUNT_ADDRESS || "missing",
  },
  {
    label: "Benchmark contract target",
    ok: !isUnset(env.NEURALRATE_BENCHMARK_CONTRACT),
    detail: env.NEURALRATE_BENCHMARK_CONTRACT || "missing",
  },
  {
    label: "Public app agent smart wallet",
    ok: !isUnset(env.VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET),
    detail: env.VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET || "missing",
  },
];

for (const check of checks) {
  printStatus(check.label, check.ok, check.detail);
  if (!check.ok) hasBlockers = true;
}

if (deployment) {
  const deploymentMode = deployment.deploymentMode || "legacy-or-unspecified";
  const benchmarkWriter = deployment.benchmarkWriter || "not recorded";
  const likelyLegacy = !deployment.deploymentMode || !deployment.benchmarkWriter;
  printStatus(
    "Deployment manifest mode",
    !likelyLegacy,
    `${deploymentMode} / benchmarkWriter=${benchmarkWriter}`
  );
  if (likelyLegacy) hasBlockers = true;
}

console.log("");
if (hasBlockers) {
  console.log("Autonomy preflight found blockers.");
  console.log("Next actions:");
  console.log("1. Set real NEURALRATE_AGENT_SMART_WALLET and TURNKEY values.");
  console.log("2. Configure TURNKEY_ORGANIZATION_ID and keys.");
  console.log("3. Redeploy NeuralRateDecisionBenchmark with the smart wallet as benchmarkWriter.");
  console.log("4. Update deployments/mantle-sepolia.json and public env vars to the new addresses.");
  process.exitCode = 1;
} else {
  console.log("Autonomy preflight passed. The repo is configured for smart-wallet deployment via Turnkey.");
}

