import { useCallback, useMemo, useState } from 'react';
import { useExportWallet, usePrivy, useSetWalletRecovery, useWallets } from '@privy-io/react-auth';
import type { EIP1193Provider } from 'viem';

const MANTLE_SEPOLIA_CHAIN_ID = 5003;

const parsePrivyChainId = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (value.startsWith('eip155:')) {
    const numeric = Number.parseInt(value.split(':')[1] || '', 10);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (value.startsWith('0x')) {
    const numeric = Number.parseInt(value, 16);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const isEmbeddedWallet = (walletClientType?: string, connectorType?: string) =>
  connectorType === 'embedded' || walletClientType === 'privy' || walletClientType === 'privy-v2';

export type PrivyWalletState = {
  address: string | null;
  externalWalletAddress: string | null;
  embeddedWalletAddress: string | null;
  embeddedWalletRecoveryMethod: string | null;
  providerUserId: string | null;
  authStrategy: string;
  walletProvider: 'privy';
  chainId: number | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToMantle: () => Promise<void>;
  getEthereumProvider: () => Promise<EIP1193Provider>;
  signMessage: (message: string) => Promise<string>;
  canExportEmbeddedWallet: boolean;
  exportEmbeddedWallet: () => Promise<void>;
  setEmbeddedWalletRecovery: () => Promise<void>;
  shortAddress: string;
};

export function usePrivyWallet(): PrivyWalletState {
  const { ready, authenticated, user, connectOrCreateWallet, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { exportWallet } = useExportWallet();
  const { setWalletRecovery } = useSetWalletRecovery();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { primaryWallet, externalWallet, embeddedWallet, chainId } = useMemo(() => {
    const embedded = wallets.find((wallet) =>
      isEmbeddedWallet(wallet.walletClientType, wallet.connectorType)
    ) ?? null;
    const external = wallets.find((wallet) =>
      !isEmbeddedWallet(wallet.walletClientType, wallet.connectorType)
    ) ?? null;
    const primary = embedded ?? external ?? wallets[0] ?? null;

    return {
      primaryWallet: primary,
      externalWallet: external,
      embeddedWallet: embedded,
      chainId: parsePrivyChainId(primary?.chainId),
    };
  }, [wallets]);

  const address = primaryWallet?.address?.toLowerCase() ?? null;
  const embeddedWalletAddress = embeddedWallet?.address?.toLowerCase() ?? null;
  const embeddedWalletRecoveryMethod =
    (embeddedWallet as (typeof embeddedWallet & { recoveryMethod?: string }) | null)?.recoveryMethod ?? null;
  const externalWalletAddress = externalWallet?.address?.toLowerCase() ?? null;
  const isConnected = Boolean(address) && authenticated;
  const isCorrectChain = chainId === MANTLE_SEPOLIA_CHAIN_ID;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const authStrategy = embeddedWalletAddress ? 'privy-passkey-embedded' : 'privy-external-wallet';
  const canExportEmbeddedWallet = Boolean(embeddedWalletAddress);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      connectOrCreateWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open Privy onboarding.';
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectOrCreateWallet]);

  const disconnect = useCallback(() => {
    void logout();
  }, [logout]);

  const switchToMantle = useCallback(async () => {
    if (!primaryWallet) {
      throw new Error('Connect a Privy wallet before switching networks.');
    }

    setError(null);

    try {
      await primaryWallet.switchChain(MANTLE_SEPOLIA_CHAIN_ID);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch to Mantle Sepolia.';
      setError(message);
      throw err;
    }
  }, [primaryWallet]);

  const getEthereumProvider = useCallback(async () => {
    if (!primaryWallet) {
      throw new Error('Connect a Privy wallet before requesting a provider.');
    }

    return (await primaryWallet.getEthereumProvider()) as EIP1193Provider;
  }, [primaryWallet]);

  const signMessage = useCallback(async (message: string) => {
    if (!primaryWallet) {
      throw new Error('Connect a Privy wallet before signing.');
    }

    return primaryWallet.sign(message);
  }, [primaryWallet]);

  const exportEmbeddedWallet = useCallback(async () => {
    if (!embeddedWalletAddress) {
      throw new Error('No Privy embedded wallet is available for export.');
    }

    setError(null);

    try {
      await exportWallet({ address: embeddedWalletAddress });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open embedded wallet export.';
      setError(message);
      throw err;
    }
  }, [embeddedWalletAddress, exportWallet]);

  const configureEmbeddedWalletRecovery = useCallback(async () => {
    if (!embeddedWalletAddress) {
      throw new Error('No Privy embedded wallet is available for recovery setup.');
    }

    setError(null);

    try {
      await setWalletRecovery();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open embedded wallet recovery.';
      setError(message);
      throw err;
    }
  }, [embeddedWalletAddress, setWalletRecovery]);

  return {
    address,
    externalWalletAddress,
    embeddedWalletAddress,
    embeddedWalletRecoveryMethod,
    providerUserId: user?.id ?? null,
    authStrategy,
    walletProvider: 'privy',
    chainId,
    isConnected,
    isCorrectChain,
    isConnecting: isConnecting || !ready || !walletsReady,
    error,
    connect,
    disconnect,
    switchToMantle,
    getEthereumProvider,
    signMessage,
    canExportEmbeddedWallet,
    exportEmbeddedWallet,
    setEmbeddedWalletRecovery: configureEmbeddedWalletRecovery,
    shortAddress,
  };
}
