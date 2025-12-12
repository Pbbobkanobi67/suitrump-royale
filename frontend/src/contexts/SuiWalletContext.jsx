import React, { createContext, useContext } from 'react';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create network config for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
  devnet: { url: getFullnodeUrl('devnet') },
});

// Create query client for React Query
const queryClient = new QueryClient();

// Context for additional wallet state
const SuiWalletContext = createContext(null);

/**
 * Sui Wallet Provider - Wraps the app with Sui wallet connectivity
 */
export function SuiWalletProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export function useSuiWalletContext() {
  const context = useContext(SuiWalletContext);
  return context;
}

export default SuiWalletProvider;
