import { createAccount } from "@turnkey/viem";
import { createWalletClient, http, type Address, type Hex, defineChain } from "viem";
import { Turnkey } from "@turnkey/sdk-server";

export type ManagedSignerCapabilities = {
  canExecute: boolean;
  canSignUserOperations: boolean;
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
  signHash?(hash: Hex): Promise<Hex>;
}

export class AddressOnlyManagedSigner implements ManagedSigner {
  constructor(private address: string) {}

  async getPublicAddress() {
    return this.address.toLowerCase();
  }

  getCapabilities(): ManagedSignerCapabilities {
    return {
      canExecute: false,
      canSignUserOperations: false,
      mode: "address-only",
    };
  }

  async signAndSendTransaction(tx: any): Promise<string> {
    throw new Error("AddressOnlyManagedSigner cannot execute transactions");
  }

  async signHash(hash: Hex): Promise<Hex> {
    throw new Error("AddressOnlyManagedSigner cannot sign user operations");
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
      canSignUserOperations: false,
      mode: "remote",
    };
  }

  async signAndSendTransaction(tx: any): Promise<string> {
    // Note: Remote signer execution logic goes here if needed. 
    // Currently throwing since Turnkey is the main path.
    throw new Error("RemoteManagedSigner execution not implemented");
  }

  async signHash(hash: Hex): Promise<Hex> {
    throw new Error("RemoteManagedSigner user operation signing not implemented");
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
      canSignUserOperations: true,
      mode: "turnkey",
    };
  }

  private async getAccount() {
    return createAccount({
      client: this.turnkeyClient.apiClient(),
      organizationId: this.args.organizationId,
      signWith: this.args.walletAccountAddress,
    });
  }

  async signAndSendTransaction(tx: {
    to: string;
    data: string;
    value?: bigint;
    chainId: number;
  }): Promise<string> {
    const account = await this.getAccount();
    const runtimeChain = defineChain({
      id: tx.chainId,
      name: `NeuralRate Chain ${tx.chainId}`,
      nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
      rpcUrls: {
        default: { http: [this.args.rpcUrl || "https://rpc.sepolia.mantle.xyz"] },
      },
    });

    const walletClient = createWalletClient({
      account,
      chain: runtimeChain,
      transport: http(this.args.rpcUrl || "https://rpc.sepolia.mantle.xyz"),
    });

    const txHash = await walletClient.sendTransaction({
      chain: runtimeChain,
      to: tx.to as Address,
      data: tx.data as Hex,
      value: tx.value,
      account
    });

    return txHash;
  }

  async signHash(hash: Hex): Promise<Hex> {
    const account = await this.getAccount();
    if (!account.sign) {
      throw new Error("Turnkey account cannot sign user operation hashes");
    }
    return account.sign({ hash });
  }
}
