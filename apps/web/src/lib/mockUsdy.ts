import { encodeFunctionData, parseUnits, type EIP1193Provider } from "viem";
import { MOCK_USDY_TOKEN_ADDRESS } from "../config";

const mockUsdyMintAbi = [{
  type: "function",
  name: "mint",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [],
}] as const;

const normalizeAmount = (value: string) => {
  const trimmed = value.trim();
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Enter a positive Mock USDY amount.");
  }
  return trimmed;
};

export async function mintMockUsdyToVault(args: {
  provider: EIP1193Provider;
  from: string;
  vaultAddress: string;
  amountToken: string;
}) {
  if (!MOCK_USDY_TOKEN_ADDRESS) {
    throw new Error("Mock USDY token address is not configured.");
  }

  const amount = normalizeAmount(args.amountToken);
  const data = encodeFunctionData({
    abi: mockUsdyMintAbi,
    functionName: "mint",
    args: [args.vaultAddress as `0x${string}`, parseUnits(amount, 18)],
  });

  const txHash = await args.provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: args.from,
      to: MOCK_USDY_TOKEN_ADDRESS,
      value: "0x0",
      data,
    }],
  });

  return {
    txHash: String(txHash),
    tokenAddress: MOCK_USDY_TOKEN_ADDRESS,
    amountToken: amount,
  };
}
