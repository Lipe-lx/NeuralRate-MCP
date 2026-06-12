import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourceDocsDir = path.join(repoRoot, "docs");
const targetDocsDir = path.join(repoRoot, "apps", "web", "public", "docs");
const sourceDeploymentsDir = path.join(repoRoot, "deployments");
const targetVerifyDir = path.join(repoRoot, "apps", "web", "public", "verify");
const sourceAgentCardPath = path.join(repoRoot, "agent-card.json");

if (!existsSync(sourceDocsDir)) {
  throw new Error(`Source docs directory not found: ${sourceDocsDir}`);
}

mkdirSync(targetDocsDir, { recursive: true });

const allowedFileNames = readdirSync(sourceDocsDir)
  .filter((name) => name.toLowerCase().endsWith(".md"))
  .filter((name) => statSync(path.join(sourceDocsDir, name)).isFile());

for (const fileName of allowedFileNames) {
  const sourcePath = path.join(sourceDocsDir, fileName);
  const targetPath = path.join(targetDocsDir, fileName);
  const content = readFileSync(sourcePath, "utf8");
  writeFileSync(targetPath, content);
}

mkdirSync(targetVerifyDir, { recursive: true });

const deploymentFiles = readdirSync(sourceDeploymentsDir)
  .filter((name) => name.toLowerCase().endsWith(".json"))
  .filter((name) => statSync(path.join(sourceDeploymentsDir, name)).isFile());

const deploymentMap = Object.fromEntries(
  deploymentFiles.map((fileName) => {
    const sourcePath = path.join(sourceDeploymentsDir, fileName);
    return [fileName, JSON.parse(readFileSync(sourcePath, "utf8"))];
  })
);

const verificationBundle = {
  generatedAt: new Date().toISOString(),
  deployments: deploymentMap,
  summary: {
    benchmark: deploymentMap["mantle-sepolia.json"] ?? null,
    policyRegistry: deploymentMap["mantle-sepolia-policy-registry.json"] ?? null,
    executionGuard: deploymentMap["mantle-sepolia-execution-guard.json"] ?? null,
    vaultModule: deploymentMap["mantle-sepolia-vault-module.json"] ?? null,
    mockUsdY: deploymentMap["mantle-sepolia-mock-usdy.json"] ?? null,
  },
};

writeFileSync(
  path.join(targetVerifyDir, "deployments.json"),
  JSON.stringify(verificationBundle, null, 2),
);

if (existsSync(sourceAgentCardPath)) {
  writeFileSync(
    path.join(targetVerifyDir, "agent-card.json"),
    readFileSync(sourceAgentCardPath, "utf8"),
  );
}

console.log(
  `Synced ${allowedFileNames.length} docs and ${deploymentFiles.length} deployment manifests into web public assets`
);
