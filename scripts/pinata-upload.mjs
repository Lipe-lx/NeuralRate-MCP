import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  if (line.includes("=")) {
    const [k, v] = line.split("=");
    env[k.trim()] = v.trim();
  }
}

const jwt = env.PINATA_JWT;
if (!jwt) throw new Error("Missing PINATA_JWT");

const cardPath = path.join(process.cwd(), "agent-card.json");
const cardContent = fs.readFileSync(cardPath, "utf8");

async function upload() {
  const formData = new FormData();
  formData.append("file", new Blob([cardContent], { type: "application/json" }), "agent-card.json");

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Pinata error: ${JSON.stringify(data)}`);
  
  console.log(`ipfs://${data.IpfsHash}`);
}

upload().catch(console.error);
