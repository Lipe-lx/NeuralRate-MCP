import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const now = new Date();
const stamp = now.toISOString().slice(0, 10);
const outDir = path.join(repoRoot, "docs", "release-audits");
const outPath = path.join(outDir, `release-audit-${stamp}.md`);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const benchmark = readJson(path.join(repoRoot, "deployments", "mantle-sepolia.json"));
const policyRegistry = readJson(path.join(repoRoot, "deployments", "mantle-sepolia-policy-registry.json"));
const executionGuard = readJson(path.join(repoRoot, "deployments", "mantle-sepolia-execution-guard.json"));

const content = `# Release Audit ${stamp}

Generated at: ${now.toISOString()}

## Contract Snapshot

- Benchmark registry: \`${benchmark.address}\`
- Policy registry: \`${policyRegistry.address}\`
- Execution guard: \`${executionGuard.address}\`

## Required Manual Checks

1. Run \`npm run preflight:public\`
2. Run \`npm run test:all\`
3. Confirm \`/verify\` deployment bundle is updated
4. Confirm \`/api/health\` reports required capabilities
5. Confirm signed read auth on sensitive endpoints

## Notes

- This artifact is generated automatically and should be kept with release PR context.
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, content);
console.log(`Generated ${outPath}`);
