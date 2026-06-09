import { createPublicClient, http, isAddress, getContract } from "viem";
import { defineChain } from "viem";
import dotenv from "dotenv";

dotenv.config();

const env = {
  MANTLE_SEPOLIA_RPC_URL: process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
  NEURALRATE_CHAIN_ID: "5003",
  NEURALRATE_POLICY_REGISTRY_CONTRACT: process.env.NEURALRATE_POLICY_REGISTRY_CONTRACT,
  NEURALRATE_EXECUTION_GUARD_CONTRACT: process.env.NEURALRATE_EXECUTION_GUARD_CONTRACT,
  NEURALRATE_SAFE_7579_ADAPTER_ADDRESS: process.env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS,
  NEURALRATE_VAULT_MODULE_ADDRESS: process.env.NEURALRATE_VAULT_MODULE_ADDRESS,
  NEURALRATE_DELEGATE_VALIDATOR_ADDRESS: process.env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS,
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS: process.env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS,
};

const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";

console.log("Using environment variables:");
console.log(JSON.stringify(env, null, 2));

const publicClient = createPublicClient({
  chain: defineChain({
    id: 5003,
    name: "Mantle Sepolia",
    nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
    rpcUrls: { default: { http: [env.MANTLE_SEPOLIA_RPC_URL] } },
  }),
  transport: http(env.MANTLE_SEPOLIA_RPC_URL),
});

const policyRegistryAbi = [
  {
    type: "function",
    name: "getActivePolicy",
    stateMutability: "view",
    inputs: [{ name: "vaultAddress", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "policyId", type: "bytes32" },
        { name: "ownerEoa", type: "address" },
        { name: "vaultAddress", type: "address" },
        { name: "delegate", type: "address" },
        { name: "maxPerUse", type: "uint256" },
        { name: "maxDaily", type: "uint256" },
        { name: "maxTotal", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validUntil", type: "uint256" },
        { name: "maxSlippageBps", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "active", type: "bool" },
        { name: "requireSnapshot", type: "bool" },
        { name: "hasTargetAllowlist", type: "bool" },
        { name: "hasSelectorAllowlist", type: "bool" },
        { name: "policyVersion", type: "string" },
      ],
    }],
  },
];

const safeModuleStatusAbi = [
  {
    type: "function",
    name: "isModuleEnabled",
    stateMutability: "view",
    inputs: [{ name: "module", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
];

const delegateValidatorAbi = [
  {
    type: "function",
    name: "getDelegate",
    stateMutability: "view",
    inputs: [{ name: "smartAccount", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
];

const executionGuardAbi = [
  {
    type: "function",
    name: "trustedModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "trustedSafeModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
];

const SAFE_FALLBACK_HANDLER_STORAGE_SLOT =
  "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5";
const SAFE_MODULE_GUARD_STORAGE_SLOT =
  "0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const normalizeStorageAddress = (value) => {
  if (!value || value === "0x") return ZERO_ADDRESS;
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (hex.length < 40) return ZERO_ADDRESS;
  const addressHex = `0x${hex.slice(-40)}`;
  return addressHex.toLowerCase();
};

async function run() {
  const vaultCode = await publicClient.getCode({ address: vaultAddress }).catch(() => undefined);
  console.log("Vault deployed:", Boolean(vaultCode && vaultCode !== "0x"));

  const vaultModuleEnabled = await publicClient.readContract({
    address: vaultAddress,
    abi: safeModuleStatusAbi,
    functionName: "isModuleEnabled",
    args: [env.NEURALRATE_VAULT_MODULE_ADDRESS],
  }).catch((e) => `Error: ${e.message}`);
  console.log("Vault Module Enabled:", vaultModuleEnabled);

  const safe7579Enabled = await publicClient.readContract({
    address: vaultAddress,
    abi: safeModuleStatusAbi,
    functionName: "isModuleEnabled",
    args: [env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS],
  }).catch((e) => `Error: ${e.message}`);
  console.log("Safe 7579 Enabled:", safe7579Enabled);

  const fallbackHandlerRaw = await publicClient.getStorageAt({
    address: vaultAddress,
    slot: SAFE_FALLBACK_HANDLER_STORAGE_SLOT,
  }).catch(() => null);
  const fallbackHandler = normalizeStorageAddress(fallbackHandlerRaw);
  console.log("Fallback Handler Raw:", fallbackHandlerRaw);
  console.log("Fallback Handler Normalized:", fallbackHandler);
  console.log("Fallback Handler Ready:", fallbackHandler === env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS.toLowerCase());

  const moduleGuardRaw = await publicClient.getStorageAt({
    address: vaultAddress,
    slot: SAFE_MODULE_GUARD_STORAGE_SLOT,
  }).catch(() => null);
  const moduleGuard = normalizeStorageAddress(moduleGuardRaw);
  console.log("Module Guard Raw:", moduleGuardRaw);
  console.log("Module Guard Normalized:", moduleGuard);
  console.log("Module Guard Ready:", moduleGuard === env.NEURALRATE_EXECUTION_GUARD_CONTRACT.toLowerCase());

  const installedDelegate = await publicClient.readContract({
    address: env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS,
    abi: delegateValidatorAbi,
    functionName: "getDelegate",
    args: [vaultAddress],
  }).catch((e) => `Error: ${e.message}`);
  console.log("Installed Delegate:", installedDelegate);
  console.log("Delegate Ready:", String(installedDelegate).toLowerCase() === env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS.toLowerCase());

  const trustedModule = await publicClient.readContract({
    address: env.NEURALRATE_EXECUTION_GUARD_CONTRACT,
    abi: executionGuardAbi,
    functionName: "trustedModule",
  }).catch((e) => `Error: ${e.message}`);
  console.log("Execution Guard trustedModule:", trustedModule);
  console.log("trustedModule Ready:", String(trustedModule).toLowerCase() === env.NEURALRATE_VAULT_MODULE_ADDRESS.toLowerCase());

  const trustedSafeModule = await publicClient.readContract({
    address: env.NEURALRATE_EXECUTION_GUARD_CONTRACT,
    abi: executionGuardAbi,
    functionName: "trustedSafeModule",
  }).catch((e) => `Error: ${e.message}`);
  console.log("Execution Guard trustedSafeModule:", trustedSafeModule);
  console.log("trustedSafeModule Ready:", String(trustedSafeModule).toLowerCase() === env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS.toLowerCase());

  // Policy registry
  if (env.NEURALRATE_POLICY_REGISTRY_CONTRACT) {
    const policy = await publicClient.readContract({
      address: env.NEURALRATE_POLICY_REGISTRY_CONTRACT,
      abi: policyRegistryAbi,
      functionName: "getActivePolicy",
      args: [vaultAddress],
    }).catch((e) => `Error: ${e.message}`);
    console.log("On-chain Active Policy:", policy);
  }
}

run();
