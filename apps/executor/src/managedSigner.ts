import { createAccount } from "@turnkey/viem";
import { createWalletClient, http, type Address, type Hex, defineChain } from "viem";
import { Turnkey } from "@turnkey/sdk-server";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.mantle.xyz"] },
  },
});

export type ManagedSignerCapabilities = {
  canExecute: boolean;
  mode: "turnkey" | "remote" | "address-only";
};

export interface ManagedSigner {
  getPublicAddress(): Promise<string>;
  getCapabilities(): ManagedSignerCapabilities;
  signAndSendTransaction(tx: {
    to: string;
    data: string;
    value?: bigint;
    chainId: number;
  }): Promise<string>;
}

export class AddressOnlyManagedSigner implements ManagedSigner {
  constructor(private address: string) {}

  async getPublicAddress() {
    return this.address.toLowerCase();
  }

  getCapabilities(): ManagedSignerCapabilities {
    return {
      canExecute: false,
      mode: "address-only",
    };
  }

  async signAndSendTransaction(tx: any): Promise<string> {
    throw new Error("AddressOnlyManagedSigner cannot execute transactions");
  }
}

export class RemoteManagedSigner implements ManagedSigner {
  constructor(
    private baseUrl: string,
    private token: string | null,
  ) {}

  async getPublicAddress() {
    const response = await fetch(`${this.baseUrl}/public-address`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Managed signer failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as { address: string };
    return json.address.toLowerCase();
  }

  getCapabilities(): ManagedSignerCapabilities {
    return {
      canExecute: false,
      mode: "remote",
    };
  }

  async signAndSendTransaction(tx: any): Promise<string> {
    // Note: Remote signer execution logic goes here if needed. 
    // Currently throwing since Turnkey is the main path.
    throw new Error("RemoteManagedSigner execution not implemented");
  }
}

type TurnkeyManagedSignerArgs = {
  apiBaseUrl: string;
  organizationId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
  walletAccountAddress: string;
  walletAccountId?: string | null;
  rpcUrl?: string;
};

export class TurnkeyManagedSigner implements ManagedSigner {
  private turnkeyClient: Turnkey;

  constructor(private args: TurnkeyManagedSignerArgs) {
    this.turnkeyClient = new Turnkey({
      apiBaseUrl: args.apiBaseUrl,
      apiPrivateKey: args.apiPrivateKey,
      apiPublicKey: args.apiPublicKey,
      defaultOrganizationId: args.organizationId,
    });
  }

  async getPublicAddress() {
    // The Turnkey SDK uses the client to verify
    await this.turnkeyClient.apiClient().getWhoami({
        organizationId: this.args.organizationId,
    });
    return this.args.walletAccountAddress.toLowerCase();
  }

  getCapabilities(): ManagedSignerCapabilities {
    return {
      canExecute: true,
      mode: "turnkey",
    };
  }

  async signAndSendTransaction(tx: {
    to: string;
    data: string;
    value?: bigint;
    chainId: number;
  }): Promise<string> {
    const account = await createAccount({
      client: this.turnkeyClient.apiClient(),
      organizationId: this.args.organizationId,
      signWith: this.args.walletAccountAddress, 
    });

    const walletClient = createWalletClient({
      account,
      chain: mantleSepolia,
      transport: http(this.args.rpcUrl || "https://rpc.sepolia.mantle.xyz"),
    });

    const txHash = await walletClient.sendTransaction({
      chain: mantleSepolia,
      to: tx.to as Address,
      data: tx.data as Hex,
      value: tx.value,
      account
    });

    return txHash;
  }
}
