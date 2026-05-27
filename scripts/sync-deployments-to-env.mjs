import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const deploymentDir = path.join(repoRoot, "deployments");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const rootEnvPath = path.join(repoRoot, ".env");
const rootEnvSource = existsSync(rootEnvPath) ? readFileSync(rootEnvPath, "utf8") : "";
const rootEnvMap = new Map(
  rootEnvSource
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((match) => {
      const [, key, rawValue] = match;
      return [key, rawValue.replace(/^"(.*)"$/, "$1")];
    })
);

const readJson = (relativePath) => {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
};

const readOptionalEnv = (name) => {
  const prefixed = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefixed));
  if (arg) {
    return arg.slice(prefixed.length).trim();
  }
  return process.env[name]?.trim() || rootEnvMap.get(name)?.trim() || "";
};

const renderValue = (value, style) => {
  if (style === "tomlQuoted") {
    return ` = "${value}"`;
  }
  if (style === "quoted") {
    return `="${value}"`;
  }
  return `=${value}`;
};

const updateEnvFile = (relativePath, orderedEntries) => {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return;
  }

  const source = readFileSync(filePath, "utf8");
  let lines = source.split(/\r?\n/);
  const indexByKey = new Map();

  lines.forEach((line, index) => {
    const match = line.match(/^([A-Z0-9_]+)\s*=/);
    if (match) {
      if (!indexByKey.has(match[1])) {
        indexByKey.set(match[1], index);
      }
    }
  });

  for (const entry of orderedEntries) {
    if (entry.value == null || entry.value === "") {
      continue;
    }

    const existingIndex = indexByKey.get(entry.key);
    const style = entry.style ??
      (existingIndex != null && /^([A-Z0-9_]+)\s*=\s*"/.test(lines[existingIndex]) ? "quoted" : "plain");
    const renderedLine = `${entry.key}${renderValue(entry.value, style)}`;

    if (existingIndex != null) {
      lines[existingIndex] = renderedLine;
      continue;
    }

    const insertAfterIndex = entry.after ? indexByKey.get(entry.after) : undefined;
    if (insertAfterIndex != null) {
      lines.splice(insertAfterIndex + 1, 0, renderedLine);
      indexByKey.clear();
      lines.forEach((line, index) => {
        const match = line.match(/^([A-Z0-9_]+)\s*=/);
        if (match) {
          indexByKey.set(match[1], index);
        }
      });
    } else {
      lines.push(renderedLine);
      indexByKey.set(entry.key, lines.length - 1);
    }
  }

  const seenKeys = new Set();
  lines = lines.filter((line) => {
    const match = line.match(/^([A-Z0-9_]+)\s*=/);
    if (!match) {
      return true;
    }
    const key = match[1];
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  writeFileSync(filePath, `${lines.join("\n").replace(/\n+$/, "\n")}`);
  console.log(`Updated ${relativePath}`);
};

const policyRegistryManifest = readJson("deployments/mantle-sepolia-policy-registry.json");
const executionGuardManifest = readJson("deployments/mantle-sepolia-execution-guard.json");
const vaultModuleManifest = readJson("deployments/mantle-sepolia-vault-module.json");
const receiptRegistryManifest = readJson("deployments/mantle-sepolia.json");

const policyRegistryAddress = policyRegistryManifest?.address || "";
const executionGuardAddress = executionGuardManifest?.address || "";
const vaultModuleAddress = vaultModuleManifest?.address || "";
const benchmarkAddress = receiptRegistryManifest?.address || "";
const safe4337ModuleAddress = readOptionalEnv("NEURALRATE_SAFE_4337_MODULE_ADDRESS");
const safe7579AdapterAddress = readOptionalEnv("NEURALRATE_SAFE_7579_ADAPTER_ADDRESS");

const sharedRuntimeEntries = [
  { key: "NEURALRATE_BENCHMARK_CONTRACT", value: benchmarkAddress, after: "AGENT_CARD_URI" },
  { key: "NEURALRATE_POLICY_REGISTRY_CONTRACT", value: policyRegistryAddress, after: "NEURALRATE_BENCHMARK_CONTRACT" },
  { key: "NEURALRATE_EXECUTION_GUARD_CONTRACT", value: executionGuardAddress, after: "NEURALRATE_POLICY_REGISTRY_CONTRACT" },
  { key: "NEURALRATE_VAULT_MODULE_ADDRESS", value: vaultModuleAddress, after: "NEURALRATE_EXECUTION_GUARD_CONTRACT" },
  { key: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", value: safe4337ModuleAddress, after: "NEURALRATE_VAULT_MODULE_ADDRESS" },
  { key: "NEURALRATE_SAFE_7579_ADAPTER_ADDRESS", value: safe7579AdapterAddress, after: "NEURALRATE_SAFE_4337_MODULE_ADDRESS" },
];

const sharedPublicEntries = [
  { key: "VITE_PUBLIC_NEURALRATE_BENCHMARK_CONTRACT", value: benchmarkAddress, after: "VITE_PUBLIC_MANTLE_EXPLORER_BASE_URL" },
  { key: "VITE_PUBLIC_NEURALRATE_POLICY_REGISTRY_CONTRACT", value: policyRegistryAddress, after: "VITE_PUBLIC_NEURALRATE_BENCHMARK_CONTRACT" },
  { key: "VITE_PUBLIC_NEURALRATE_EXECUTION_GUARD_CONTRACT", value: executionGuardAddress, after: "VITE_PUBLIC_NEURALRATE_POLICY_REGISTRY_CONTRACT" },
  { key: "VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET", value: readOptionalEnv("NEURALRATE_AGENT_SMART_WALLET"), after: "VITE_PUBLIC_BICONOMY_MEE_URL" },
  { key: "VITE_PUBLIC_NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS", value: readOptionalEnv("NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS"), after: "VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET" },
  { key: "VITE_PUBLIC_NEURALRATE_SAFE_4337_MODULE_ADDRESS", value: safe4337ModuleAddress, after: "VITE_PUBLIC_NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS" },
  { key: "VITE_PUBLIC_NEURALRATE_SAFE_7579_ADAPTER_ADDRESS", value: safe7579AdapterAddress, after: "VITE_PUBLIC_NEURALRATE_SAFE_4337_MODULE_ADDRESS" },
  { key: "VITE_PUBLIC_NEURALRATE_VAULT_MODULE_ADDRESS", value: vaultModuleAddress, after: "VITE_PUBLIC_NEURALRATE_SAFE_7579_ADAPTER_ADDRESS" },
];

updateEnvFile(".env", [
  ...sharedRuntimeEntries,
  ...sharedPublicEntries,
]);

updateEnvFile(".env.example", [
  ...sharedRuntimeEntries.map((entry) => ({
    ...entry,
    value: entry.value || ZERO_ADDRESS,
    style: "quoted",
  })),
  ...sharedPublicEntries.map((entry) => ({
    ...entry,
    value: entry.value || ZERO_ADDRESS,
    style: "quoted",
  })),
]);

updateEnvFile("apps/executor/.env.example", [
  ...sharedRuntimeEntries.map((entry) => ({
    ...entry,
    value: entry.value || ZERO_ADDRESS,
    style: "quoted",
    after: entry.after === "AGENT_CARD_URI" ? "MANTLE_SEPOLIA_RPC_URL" : entry.after,
  })),
]);

updateEnvFile(
  "apps/web/.env.example",
  sharedPublicEntries.map((entry) => ({
    ...entry,
    value: entry.value || ZERO_ADDRESS,
    style: "quoted",
  }))
);

updateEnvFile("apps/worker/.dev.vars", [
  { key: "NEURALRATE_BENCHMARK_CONTRACT", value: benchmarkAddress, after: "NANSEN_API_KEY", style: "quoted" },
  { key: "NEURALRATE_POLICY_REGISTRY_CONTRACT", value: policyRegistryAddress, after: "NEURALRATE_BENCHMARK_CONTRACT", style: "quoted" },
  { key: "NEURALRATE_EXECUTION_GUARD_CONTRACT", value: executionGuardAddress, after: "NEURALRATE_POLICY_REGISTRY_CONTRACT", style: "quoted" },
  { key: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", value: safe4337ModuleAddress, after: "NEURALRATE_EXECUTION_GUARD_CONTRACT", style: "quoted" },
  { key: "NEURALRATE_SAFE_7579_ADAPTER_ADDRESS", value: safe7579AdapterAddress, after: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", style: "quoted" },
  { key: "EXECUTOR_BASE_URL", value: readOptionalEnv("EXECUTOR_BASE_URL") || "http://127.0.0.1:8788", after: "INTERNAL_API_TOKEN", style: "quoted" },
]);

updateEnvFile("apps/worker/.dev.vars.example", [
  { key: "NEURALRATE_BENCHMARK_CONTRACT", value: benchmarkAddress, after: "NANSEN_API_KEY", style: "quoted" },
  { key: "NEURALRATE_POLICY_REGISTRY_CONTRACT", value: policyRegistryAddress || ZERO_ADDRESS, after: "NEURALRATE_BENCHMARK_CONTRACT", style: "quoted" },
  { key: "NEURALRATE_EXECUTION_GUARD_CONTRACT", value: executionGuardAddress || ZERO_ADDRESS, after: "NEURALRATE_POLICY_REGISTRY_CONTRACT", style: "quoted" },
  { key: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", value: safe4337ModuleAddress || ZERO_ADDRESS, after: "NEURALRATE_EXECUTION_GUARD_CONTRACT", style: "quoted" },
  { key: "NEURALRATE_SAFE_7579_ADAPTER_ADDRESS", value: safe7579AdapterAddress || ZERO_ADDRESS, after: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", style: "quoted" },
  { key: "EXECUTOR_BASE_URL", value: readOptionalEnv("EXECUTOR_BASE_URL") || "http://127.0.0.1:8788", after: "INTERNAL_API_TOKEN", style: "quoted" },
]);

updateEnvFile("apps/worker/wrangler.toml", [
  { key: "NEURALRATE_BENCHMARK_CONTRACT", value: benchmarkAddress, style: "tomlQuoted" },
  { key: "NEURALRATE_POLICY_REGISTRY_CONTRACT", value: policyRegistryAddress || "", after: "NEURALRATE_BENCHMARK_CONTRACT", style: "tomlQuoted" },
  { key: "NEURALRATE_EXECUTION_GUARD_CONTRACT", value: executionGuardAddress || "", after: "NEURALRATE_POLICY_REGISTRY_CONTRACT", style: "tomlQuoted" },
  { key: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", value: safe4337ModuleAddress || "", after: "NEURALRATE_EXECUTION_GUARD_CONTRACT", style: "tomlQuoted" },
  { key: "NEURALRATE_SAFE_7579_ADAPTER_ADDRESS", value: safe7579AdapterAddress || "", after: "NEURALRATE_SAFE_4337_MODULE_ADDRESS", style: "tomlQuoted" },
]);
