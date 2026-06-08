import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");

const parseEnv = (filePath) => {
  const content = readFileSync(filePath, "utf8");
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
};

const env = parseEnv(envPath);

const WORKER_URL = env.VITE_PUBLIC_API_BASE_URL 
  ? env.VITE_PUBLIC_API_BASE_URL.replace(/\/api$/, "") 
  : "https://neuralrate-worker.neuralrate.workers.dev";

const INTERNAL_TOKEN = env.NEURALRATE_INTERNAL_API_TOKEN || "neuralrate-local-internal-2026";

async function main() {
  console.log(`Connecting to worker at: ${WORKER_URL}`);
  console.log(`Using internal token: ${INTERNAL_TOKEN.slice(0, 8)}...`);

  const deadline = new Date(Date.now() + 3600 * 1000).toISOString();
  console.log(`Setting dynamic deadline: ${deadline}`);

  const payload = {
    ownerEoa: "0x54fcb49cd7281140e17721f65f00e49a809400bc",
    strategyKey: "mnt-native-transfer",
    intent: {
      targetAsset: "MNT",
      amountUsd: 1,
      amountToken: 0.001,
      recipientAddress: "0x54fcb49cd7281140e17721f65f00e49a809400bc",
      slippageBps: 0,
      notes: "NeuralRate hackathon on-chain proof: minimal paymaster-sponsored execution demo.",
      snapshotHash: "0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a",
      snapshotCid: "inline:194f5450d527aa77",
      deadline: deadline
    }
  };

  const response = await fetch(`${WORKER_URL}/api/automation/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-neuralrate-internal-token": INTERNAL_TOKEN
    },
    body: JSON.stringify(payload)
  });

  const status = response.status;
  const text = await response.text();
  console.log(`Response Status: ${status}`);
  console.log("Response Body:");
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

main().catch(console.error);
