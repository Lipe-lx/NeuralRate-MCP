import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

type DeploymentManifest = {
  network: string;
  chainId: number;
  contractName: string;
  address: string;
  txHash: string;
  expectedBytecodeHash: string;
  tokenName: string;
  symbol: string;
  decimals: number;
  deploymentPurpose: "testnet-demo-mock";
  initialMintRecipient: string | null;
  initialMintAmount: string | null;
  initialMintTxHash: string | null;
  updatedAt: string;
};

const EMPTY_CODE_HASH = ethers.keccak256("0x");
const TOKEN_NAME = "Mock USDY";
const TOKEN_SYMBOL = "USDY";
const TOKEN_DECIMALS = 18;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForRuntimeCode = async (address: string, attempts = 12, delayMs = 2000) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const runtimeCode = await ethers.provider.getCode(address);
    if (runtimeCode && runtimeCode !== "0x") {
      return runtimeCode;
    }
    if (attempt < attempts) {
      console.log(`Runtime bytecode not available yet at ${address}. Retrying (${attempt}/${attempts})...`);
      await sleep(delayMs);
    }
  }
  throw new Error(`No runtime bytecode found at ${address} after ${attempts} attempts.`);
};

const normalizeOptionalAddress = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === ethers.ZeroAddress) {
    return null;
  }
  if (!ethers.isAddress(trimmed)) {
    throw new Error(`Invalid mint recipient address: ${trimmed}`);
  }
  return trimmed;
};

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const mintRecipient = normalizeOptionalAddress(
    process.env.NEURALRATE_MOCK_USDY_MINT_TO_ADDRESS ||
      process.env.NEURALRATE_DEMO_VAULT_ADDRESS ||
      process.env.NEURALRATE_AGENT_SMART_WALLET,
  );
  const mintAmount = process.env.NEURALRATE_MOCK_USDY_INITIAL_MINT_AMOUNT?.trim() || "";

  console.log("Deploying Mock USDY for Mantle Sepolia demo harness...");
  console.log("Using deployer address:", signer.address);
  console.log("Initial mint recipient:", mintRecipient ?? "none");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS);

  await token.waitForDeployment();
  const address = await token.getAddress();
  const txHash = token.deploymentTransaction()?.hash ?? "";
  const runtimeCode = await waitForRuntimeCode(address);
  const expectedBytecodeHash = ethers.keccak256(runtimeCode);
  if (expectedBytecodeHash === EMPTY_CODE_HASH) {
    throw new Error(`Resolved runtime bytecode hash is empty for ${address}. Refusing to pin an invalid manifest.`);
  }

  let initialMintTxHash: string | null = null;
  let normalizedMintAmount: string | null = null;
  if (mintRecipient && mintAmount) {
    const parsedMintAmount = ethers.parseUnits(mintAmount, TOKEN_DECIMALS);
    const mintTx = await token.mint(mintRecipient, parsedMintAmount);
    await mintTx.wait();
    initialMintTxHash = mintTx.hash;
    normalizedMintAmount = mintAmount;
    console.log(`Minted ${mintAmount} ${TOKEN_SYMBOL} to ${mintRecipient}: ${mintTx.hash}`);
  }

  const manifest: DeploymentManifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "MockERC20",
    address,
    txHash,
    expectedBytecodeHash,
    tokenName: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    decimals: TOKEN_DECIMALS,
    deploymentPurpose: "testnet-demo-mock",
    initialMintRecipient: mintRecipient,
    initialMintAmount: normalizedMintAmount,
    initialMintTxHash,
    updatedAt: new Date().toISOString(),
  };

  const jsonManifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia-mock-usdy.json");
  mkdirSync(path.dirname(jsonManifestPath), { recursive: true });
  writeFileSync(jsonManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Mock USDY deployed to: ${address}`);
  console.log(`Deployment tx hash: ${txHash}`);
  console.log(`Runtime bytecode hash: ${expectedBytecodeHash}`);
  console.log(`JSON manifest updated: ${jsonManifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
