import { useState, useCallback, useEffect } from 'react';
import type { EIP1193Provider } from 'viem';
import { MANTLE_CHAIN_ID, MANTLE_CHAIN_NAME, MANTLE_EXPLORER_BASE_URL, MANTLE_RPC_URL } from '../config';

// Mantle Sepolia network config
const MANTLE_SEPOLIA = {
  chainId: `0x${MANTLE_CHAIN_ID.toString(16).toUpperCase()}`,
  chainName: MANTLE_CHAIN_NAME,
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: [MANTLE_RPC_URL],
  blockExplorerUrls: [MANTLE_EXPLORER_BASE_URL]
};

export interface InjectedWalletState {
  address: string | null;
  externalWalletAddress: string | null;
  embeddedWalletAddress: string | null;
  embeddedWalletRecoveryMethod: string | null;
  providerUserId: string | null;
  authStrategy: string;
  walletProvider: 'injected';
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
}

export function useInjectedWallet(): InjectedWalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!address;
  const isCorrectChain = chainId === MANTLE_CHAIN_ID;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  // Listen for account/chain changes
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
      } else {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (chain: string) => {
      setChainId(parseInt(chain, 16));
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError('No wallet detected. Install MetaMask or a compatible wallet.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      setAddress(accounts[0]);

      const chain = await eth.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chain, 16);
      setChainId(currentChainId);

      // Auto-switch to Mantle Sepolia if not on it
      if (currentChainId !== MANTLE_CHAIN_ID) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MANTLE_SEPOLIA.chainId }]
          });
          setChainId(MANTLE_CHAIN_ID);
        } catch (switchErr: any) {
          // Chain not added yet — add it
          if (switchErr.code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [MANTLE_SEPOLIA]
            });
            setChainId(MANTLE_CHAIN_ID);
          }
        }
      }
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Connection rejected by user.');
      } else {
        setError(err.message || 'Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  const switchToMantle = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MANTLE_SEPOLIA.chainId }]
      });
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [MANTLE_SEPOLIA]
        });
      }
    }
  }, []);

  const getEthereumProvider = useCallback(async () => {
    const eth = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if (!eth) {
      throw new Error('No wallet detected. Install MetaMask or a compatible wallet.');
    }
    return eth;
  }, []);

  const signMessage = useCallback(async (message: string) => {
    const eth = await getEthereumProvider();
    if (!address) {
      throw new Error('Connect a wallet before signing.');
    }

    const signature = await eth.request({
      method: 'personal_sign',
      params: [message, address],
    });

    return String(signature);
  }, [address, getEthereumProvider]);

  return {
    address,
    externalWalletAddress: address,
    embeddedWalletAddress: null,
    embeddedWalletRecoveryMethod: null,
    providerUserId: null,
    authStrategy: 'external-wallet',
    walletProvider: 'injected',
    chainId,
    isConnected,
    isCorrectChain,
    isConnecting,
    error,
    connect,
    disconnect,
    switchToMantle,
    getEthereumProvider,
    signMessage,
    canExportEmbeddedWallet: false,
    exportEmbeddedWallet: async () => {
      throw new Error('Embedded wallet export is only available for Privy-managed wallets.');
    },
    setEmbeddedWalletRecovery: async () => {
      throw new Error('Embedded wallet recovery is only available for Privy-managed wallets.');
    },
    shortAddress
  };
}
