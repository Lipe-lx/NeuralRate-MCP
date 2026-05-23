import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, ".env");
const agentCardPath = path.join(repoRoot, "agent-card.json");

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

const env = parseEnv(envPath);
const pinataJwt = env.PINATA_JWT;

if (!pinataJwt) {
  throw new Error("Missing PINATA_JWT in .env");
}

if (!fs.existsSync(agentCardPath)) {
  throw new Error("agent-card.json not found");
}

const agentCardContents = fs.readFileSync(agentCardPath);
const formData = new FormData();
const file = new File([agentCardContents], "agent-card.json", { type: "application/json" });
formData.set("file", file);
formData.set(
  "pinataMetadata",
  JSON.stringify({
    name: "agent-card.json",
    keyvalues: {
      app: "neuralrate-mcp",
      type: "agent-card",
    },
  })
);

const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${pinataJwt}`,
  },
  body: formData,
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Pinata upload failed: ${response.status} ${response.statusText} ${text}`);
}

const json = await response.json();
const cid = json.IpfsHash;
console.log(`Uploaded agent-card.json to Pinata.`);
console.log(`CID: ${cid}`);
console.log(`URI: ipfs://${cid}`);
