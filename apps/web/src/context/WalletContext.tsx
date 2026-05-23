import React, { createContext, useContext } from 'react';
import { PRIVY_ENABLED } from '../config';
import { usePrivyWallet } from '../hooks/usePrivyWallet';
import { useInjectedWallet } from '../hooks/useWallet';

type WalletContextType = ReturnType<typeof usePrivyWallet> | ReturnType<typeof useInjectedWallet>;

const WalletContext = createContext<WalletContextType | null>(null);

const PrivyWalletContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wallet = usePrivyWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
};

const InjectedWalletContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wallet = useInjectedWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return PRIVY_ENABLED ? (
    <PrivyWalletContextProvider>{children}</PrivyWalletContextProvider>
  ) : (
    <InjectedWalletContextProvider>{children}</InjectedWalletContextProvider>
  );
};

export const useWalletContext = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
};
