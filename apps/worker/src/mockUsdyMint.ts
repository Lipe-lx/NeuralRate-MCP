import { encodeFunctionData, isAddress, parseUnits, type Address } from "viem";
import type { ScopedAutomationAccess } from "./automationControl";

type MockUsdYEnv = {
  NEURALRATE_USDY_TOKEN_ADDRESS?: string;
  NEURALRATE_CHAIN_ID?: string;
};

type PrepareMockUsdYMintArgs = {
  amountToken?: number | string | null;
  recipientAddress?: string | null;
};

const mockUsdYMintAbi = [{
  type: "function",
  name: "mint",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ] as const,
  outputs: [] as const,
}] as const;

const normalizeAmount = (value: number | string | null | undefined) => {
  const normalized = value == null ? "100" : String(value).trim();
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("amountToken must be a positive Mock USDY amount.");
  }
  return normalized;
};

export const prepareMockUsdYMintTransaction = (
  env: MockUsdYEnv,
  access: ScopedAutomationAccess,
  args: PrepareMockUsdYMintArgs,
) => {
  const tokenAddress = env.NEURALRATE_USDY_TOKEN_ADDRESS?.trim();
  if (!tokenAddress || !isAddress(tokenAddress)) {
    throw new Error("NEURALRATE_USDY_TOKEN_ADDRESS is not configured for Mock USDY mint preparation.");
  }

  const recipientAddress = args.recipientAddress?.trim() || access.vaultAddress;
  if (!isAddress(recipientAddress)) {
    throw new Error("recipientAddress must be a valid EVM address.");
  }

  const amountToken = normalizeAmount(args.amountToken);
  const amountRaw = parseUnits(amountToken, 18);
  const data = encodeFunctionData({
    abi: mockUsdYMintAbi,
    functionName: "mint",
    args: [recipientAddress as Address, amountRaw],
  });

  return {
    success: true,
    mockOnly: true,
    chainId: Number.parseInt(env.NEURALRATE_CHAIN_ID || "5003", 10),
    token: {
      symbol: "USDY",
      name: "Mock USDY",
      address: tokenAddress,
      decimals: 18,
      deploymentPurpose: "testnet-demo-mock",
    },
    amountToken,
    amountRaw: amountRaw.toString(),
    recipientAddress,
    transactionRequest: {
      from: access.ownerEoa,
      to: tokenAddress,
      value: "0x0",
      data,
    },
    disclosure:
      "This prepares a permissionless Mock USDY mint for Mantle Sepolia demos. It is not canonical Ondo USDY.",
    nextSteps: [
      "Ask the wallet owner to sign and submit transactionRequest.",
      "Refresh get_vault_balances after the mint is mined.",
      "Use open_position with protocolHint mock-usdy-sepolia for the demo allocation path.",
    ],
  };
};
