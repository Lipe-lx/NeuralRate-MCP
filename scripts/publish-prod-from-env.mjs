import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const run = (command, args) => {
  console.log(`[prod-publish] ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
};

run("node", ["scripts/publish-executor-from-env.mjs"]);
run("node", ["scripts/publish-worker-from-env.mjs"]);
