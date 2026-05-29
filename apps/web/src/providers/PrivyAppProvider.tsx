import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import {
  MANTLE_CHAIN_ID,
  MANTLE_CHAIN_NAME,
  MANTLE_EXPLORER_BASE_URL,
  MANTLE_NETWORK_KEY,
  MANTLE_RPC_URL,
  PRIVY_APP_ID,
  PRIVY_CLIENT_ID,
  PRIVY_ENABLED,
} from '../config';

const mantleSepoliaChain = {
  id: MANTLE_CHAIN_ID,
  name: MANTLE_CHAIN_NAME,
  network: MANTLE_NETWORK_KEY,
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MANTLE_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantlescan',
      url: MANTLE_EXPLORER_BASE_URL,
    },
  },
  testnet: true,
} as const;

export const PrivyAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!PRIVY_ENABLED) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        loginMethods: ['passkey', 'wallet'],
        supportedChains: [mantleSepoliaChain as never],
        defaultChain: mantleSepoliaChain as never,
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          showWalletUIs: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
};
