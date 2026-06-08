import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mnemonicToAccount } from "viem/accounts";

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

const SEED_PHRASE = env.SEED_FRASE || env.SEED_PHRASE;
const OWNER_ADDRESS = "0x54FCb49Cd7281140e17721f65f00e49a809400Bc";

async function main() {
  if (!SEED_PHRASE) {
    throw new Error("SEED_FRASE is missing from .env file.");
  }

  console.log(`Connecting to worker at: ${WORKER_URL}`);
  
  // 1. Derive viem account from mnemonic
  const account = mnemonicToAccount(SEED_PHRASE);
  console.log(`Derived signer address: ${account.address} (Expected: ${OWNER_ADDRESS})`);

  // 2. Request nonce challenge
  console.log("Requesting mutation nonce challenge...");
  const nonceRes = await fetch(`${WORKER_URL}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerEoa: OWNER_ADDRESS })
  });

  if (!nonceRes.ok) {
    throw new Error(`Failed to request nonce: ${await nonceRes.text()}`);
  }

  const nonceData = await nonceRes.json();
  const challenge = nonceData.challenge;
  console.log(`Received nonce challenge: ${challenge.nonce}`);

  // 3. Sign the challenge message
  console.log("Signing challenge message...");
  const signature = await account.signMessage({ message: challenge.message });
  console.log(`Generated signature: ${signature}`);

  // 4. Exchange signed envelope for a scoped session token
  console.log("Exchanging signed envelope for scoped MCP session access...");
  const accessRes = await fetch(`${WORKER_URL}/api/automation/mcp/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerEoa: OWNER_ADDRESS,
      auth: {
        ownerEoa: OWNER_ADDRESS,
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
        signature: signature
      }
    })
  });

  if (!accessRes.ok) {
    throw new Error(`Failed to get MCP access: ${await accessRes.text()}`);
  }

  const accessData = await accessRes.json();
  const sessionToken = accessData.sessionToken;
  console.log(`Acquired fresh session token: ${sessionToken}`);

  // 5. Trigger strategy execution
  const deadline = new Date(Date.now() + 3600 * 1000).toISOString();
  console.log(`Triggering strategy execution with deadline: ${deadline}`);

  const executionPayload = {
    ownerEoa: OWNER_ADDRESS.toLowerCase(),
    strategyKey: "mnt-native-transfer",
    intent: {
      targetAsset: "MNT",
      amountUsd: 1,
      amountToken: 0.001,
      recipientAddress: OWNER_ADDRESS.toLowerCase(),
      slippageBps: 0,
      notes: "NeuralRate hackathon on-chain proof: minimal paymaster-sponsored execution demo.",
      snapshotHash: "0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a",
      snapshotCid: "inline:194f5450d527aa77",
      deadline: deadline
    }
  };

  const jobRes = await fetch(`${WORKER_URL}/api/automation/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-neuralrate-session-token": sessionToken
    },
    body: JSON.stringify(executionPayload)
  });

  const jobStatus = jobRes.status;
  const jobText = await jobRes.text();
  console.log(`Job dispatch status: ${jobStatus}`);
  console.log("Job dispatch response:");
  try {
    const jobJson = JSON.parse(jobText);
    console.log(JSON.stringify(jobJson, null, 2));
    
    if (jobJson.success && jobJson.job) {
      console.log(`\nCreated job: ${jobJson.job.job_id || jobJson.job.jobId}`);
      console.log(`Status: ${jobJson.job.status}`);
      if (jobJson.job.tx_hash) {
        console.log(`Tx Hash: ${jobJson.job.tx_hash}`);
      }
    }
  } catch {
    console.log(jobText);
  }
}

main().catch(console.error);
