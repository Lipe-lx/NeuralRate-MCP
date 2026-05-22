import { useState, useCallback, useEffect } from 'react';

// Mantle Sepolia network config
const MANTLE_SEPOLIA = {
  chainId: '0x138B', // 5003
  chainName: 'Mantle Sepolia Testnet',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
  blockExplorerUrls: ['https://sepolia.mantlescan.xyz']
};

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToMantle: () => Promise<void>;
  shortAddress: string;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!address;
  const isCorrectChain = chainId === 5003;
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
      if (currentChainId !== 5003) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MANTLE_SEPOLIA.chainId }]
          });
          setChainId(5003);
        } catch (switchErr: any) {
          // Chain not added yet — add it
          if (switchErr.code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [MANTLE_SEPOLIA]
            });
            setChainId(5003);
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

  return {
    address,
    chainId,
    isConnected,
    isCorrectChain,
    isConnecting,
    error,
    connect,
    disconnect,
    switchToMantle,
    shortAddress
  };
}
