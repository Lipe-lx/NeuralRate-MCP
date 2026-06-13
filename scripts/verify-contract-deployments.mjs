import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  Contract,
  JsonRpcProvider,
  getAddress,
  isAddress,
  keccak256,
} from "ethers";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env") });

const CHAIN_ID = 5003;
const EMPTY_CODE_HASH = keccak256("0x");
const deploymentDir = path.join(rootDir, "deployments");
const manifestFiles = [
  "mantle-sepolia.json",
  "mantle-sepolia-policy-registry.json",
  "mantle-sepolia-execution-guard.json",
  "mantle-sepolia-vault-module.json",
  "mantle-sepolia-usdy-adapter.json",
  "mantle-sepolia-mock-usdy.json",
  "mantle-sepolia-delegate-validator.json",
  "mantle-sepolia-safe4337-module.json",
  "mantle-sepolia-safe7579-adapter.json",
  "mantle-sepolia-safe7579-launchpad.json",
  "mantle-sepolia-safe-module-setup.json",
];

const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => {
  failures.push(message);
  console.error(`FAIL ${message}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRpcRetry = async (action, attempts = 5) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const message = [
        error?.message,
        error?.shortMessage,
        error?.info?.error?.message,
      ].filter(Boolean).join(" ");
      const retryable =
        message.toLowerCase().includes("rate limit") ||
        message.includes("-32016") ||
        message.includes("429");
      if (!retryable || attempt === attempts) {
        throw error;
      }
      await sleep(attempt * 1_000);
    }
  }
  throw new Error("RPC retry loop exhausted.");
};

const sameAddress = (actual, expected) => {
  if (!isAddress(actual) || !isAddress(expected)) {
    return false;
  }
  return getAddress(actual) === getAddress(expected);
};

const assertAddress = (label, actual, expected) => {
  if (sameAddress(actual, expected)) {
    pass(`${label}: ${getAddress(actual)}`);
  } else {
    fail(`${label}: expected ${expected}, observed ${actual}`);
  }
};

const loadManifest = async (file) => {
  const contents = await fs.readFile(path.join(deploymentDir, file), "utf8");
  return { file, ...JSON.parse(contents) };
};

const manifests = await Promise.all(manifestFiles.map(loadManifest));
const byContract = new Map(manifests.map((manifest) => [manifest.contractName, manifest]));
const rpcUrl = process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz";
const provider = new JsonRpcProvider(rpcUrl, CHAIN_ID, { staticNetwork: true });
const network = await provider.getNetwork();

if (Number(network.chainId) !== CHAIN_ID) {
  throw new Error(`Expected Mantle Sepolia chain ${CHAIN_ID}, connected to ${network.chainId}.`);
}

pass(`connected to Mantle Sepolia (${CHAIN_ID}) at block ${await withRpcRetry(() => provider.getBlockNumber())}`);

for (const manifest of manifests) {
  const label = `${manifest.contractName} (${manifest.file})`;
  if (manifest.chainId !== CHAIN_ID) {
    fail(`${label} has chainId ${manifest.chainId}, expected ${CHAIN_ID}`);
    continue;
  }
  if (!isAddress(manifest.address)) {
    fail(`${label} has invalid address ${manifest.address}`);
    continue;
  }
  if (!manifest.expectedBytecodeHash) {
    fail(`${label} is missing expectedBytecodeHash`);
    continue;
  }

  const code = await withRpcRetry(() => provider.getCode(manifest.address));
  const receipt = await withRpcRetry(() => provider.getTransactionReceipt(manifest.txHash));
  const observedHash = keccak256(code);

  if (observedHash === EMPTY_CODE_HASH) {
    fail(`${label} has no runtime bytecode at ${manifest.address}`);
  } else if (observedHash.toLowerCase() !== manifest.expectedBytecodeHash.toLowerCase()) {
    fail(`${label} bytecode hash expected ${manifest.expectedBytecodeHash}, observed ${observedHash}`);
  } else {
    pass(`${label} bytecode ${observedHash}`);
  }

  if (!receipt) {
    fail(`${label} deployment transaction ${manifest.txHash} was not found`);
  } else if (receipt.status !== 1) {
    fail(`${label} deployment transaction ${manifest.txHash} did not succeed`);
  } else if (!sameAddress(receipt.contractAddress, manifest.address)) {
    fail(`${label} deployment transaction created ${receipt.contractAddress}, manifest has ${manifest.address}`);
  } else {
    pass(`${label} deployment transaction succeeded`);
  }
}

const receiptManifest = byContract.get("NeuralRateDecisionReceiptRegistry");
const guardManifest = byContract.get("NeuralRateExecutionGuard");
const vaultManifest = byContract.get("NeuralRateVaultModule");
const adapterManifest = byContract.get("NeuralRateUsdYStrategyAdapter");
const mockManifest = byContract.get("MockERC20");

if (!receiptManifest || !guardManifest || !vaultManifest || !adapterManifest || !mockManifest) {
  throw new Error("Required NeuralRate deployment manifests are missing.");
}

const receiptRegistry = new Contract(
  receiptManifest.address,
  [
    "function owner() view returns (address)",
    "function receiptWriter() view returns (address)",
  ],
  provider,
);
const executionGuard = new Contract(
  guardManifest.address,
  [
    "function owner() view returns (address)",
    "function policyRegistry() view returns (address)",
    "function trustedModule() view returns (address)",
    "function trustedSafeModule() view returns (address)",
  ],
  provider,
);
const vaultModule = new Contract(
  vaultManifest.address,
  [
    "function owner() view returns (address)",
    "function authorizedExecutor() view returns (address)",
    "function executionGuard() view returns (address)",
  ],
  provider,
);
const usdyAdapter = new Contract(
  adapterManifest.address,
  [
    "function owner() view returns (address)",
    "function authorizedExecutor() view returns (address)",
  ],
  provider,
);
const mockUsdy = new Contract(
  mockManifest.address,
  [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ],
  provider,
);

const [
  receiptOwner,
  receiptWriter,
  guardOwner,
  policyRegistry,
  trustedModule,
  trustedSafeModule,
  vaultOwner,
  vaultExecutor,
  configuredGuard,
  adapterOwner,
  adapterExecutor,
  mockName,
  mockSymbol,
  mockDecimals,
] = [
  await withRpcRetry(() => receiptRegistry.owner()),
  await withRpcRetry(() => receiptRegistry.receiptWriter()),
  await withRpcRetry(() => executionGuard.owner()),
  await withRpcRetry(() => executionGuard.policyRegistry()),
  await withRpcRetry(() => executionGuard.trustedModule()),
  await withRpcRetry(() => executionGuard.trustedSafeModule()),
  await withRpcRetry(() => vaultModule.owner()),
  await withRpcRetry(() => vaultModule.authorizedExecutor()),
  await withRpcRetry(() => vaultModule.executionGuard()),
  await withRpcRetry(() => usdyAdapter.owner()),
  await withRpcRetry(() => usdyAdapter.authorizedExecutor()),
  await withRpcRetry(() => mockUsdy.name()),
  await withRpcRetry(() => mockUsdy.symbol()),
  await withRpcRetry(() => mockUsdy.decimals()),
];

assertAddress("receipt registry owner", receiptOwner, receiptManifest.owner);
assertAddress("receipt writer", receiptWriter, receiptManifest.receiptWriter);
assertAddress("execution guard owner", guardOwner, guardManifest.owner);
assertAddress("execution guard policy registry", policyRegistry, guardManifest.policyRegistry);
assertAddress("execution guard trusted module", trustedModule, guardManifest.trustedModule);
assertAddress("execution guard trusted Safe module", trustedSafeModule, guardManifest.trustedSafeModule);
assertAddress("vault module owner", vaultOwner, vaultManifest.owner);
assertAddress("vault module executor", vaultExecutor, vaultManifest.authorizedExecutor);
assertAddress("vault module execution guard", configuredGuard, vaultManifest.executionGuard);
assertAddress("USDY adapter owner", adapterOwner, adapterManifest.owner);
assertAddress("USDY adapter executor", adapterExecutor, adapterManifest.authorizedExecutor);

if (mockName === mockManifest.tokenName) {
  pass(`Mock USDY name: ${mockName}`);
} else {
  fail(`Mock USDY name expected ${mockManifest.tokenName}, observed ${mockName}`);
}
if (mockSymbol === mockManifest.symbol) {
  pass(`Mock USDY symbol: ${mockSymbol}`);
} else {
  fail(`Mock USDY symbol expected ${mockManifest.symbol}, observed ${mockSymbol}`);
}
if (Number(mockDecimals) === mockManifest.decimals) {
  pass(`Mock USDY decimals: ${mockDecimals}`);
} else {
  fail(`Mock USDY decimals expected ${mockManifest.decimals}, observed ${mockDecimals}`);
}

if (failures.length > 0) {
  console.error(`\nContract verification failed with ${failures.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(`\nVerified ${manifests.length} contract deployments and all NeuralRate wiring.`);
}
