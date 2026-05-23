import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, PRIVY_ENABLED } from '../config';

const mantleSepoliaChain = {
  id: 5003,
  name: 'Mantle Sepolia',
  network: 'mantle-sepolia',
  nativeCurrency: {
    name: 'Mantle',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantlescan',
      url: 'https://sepolia.mantlescan.xyz',
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
