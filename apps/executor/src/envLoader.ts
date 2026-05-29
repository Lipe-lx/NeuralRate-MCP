import fs from "node:fs";
import path from "node:path";

const resolveEnvFiles = () => {
  const cwd = process.cwd();
  const candidateRoots = [
    cwd,
    path.resolve(cwd, ".."),
    path.resolve(cwd, "../.."),
  ];

  const repoRoot =
    candidateRoots.find((root) => fs.existsSync(path.join(root, "apps", "executor"))) ?? cwd;

  return [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, "apps", "executor", ".env.local"),
  ];
};

const parseEnvFile = (source: string) => {
  const parsed = new Map<string, string>();

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

    parsed.set(key, value);
  }

  return parsed;
};

let loaded = false;

export const loadExecutorEnv = () => {
  if (loaded) return;
  loaded = true;

  const envFiles = resolveEnvFiles();
  if (envFiles.length === 0) {
    return;
  }

  for (const envPath of envFiles) {
    if (!fs.existsSync(envPath)) continue;

    const values = parseEnvFile(fs.readFileSync(envPath, "utf8"));
    for (const [key, value] of values) {
      if (typeof process.env[key] === "undefined") {
        process.env[key] = value;
      }
    }
  }
};
