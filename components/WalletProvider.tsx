'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SolanaMobileWalletAdapter } from '@solana-mobile/wallet-adapter-mobile';

// We no longer use the library's modal - using custom modal in WalletButton.tsx

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // Use a reliable RPC endpoint for mainnet
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    
    // Use Helius for reliable mainnet RPC
    // This avoids stale validator cache issues with public endpoints
    return 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';
  }, []);

  const wallets = useMemo(
    () => [
      // Mobile Wallet Adapter for Solana Mobile (Seeker, Saga) - MUST be first
      new SolanaMobileWalletAdapter({
        appIdentity: {
          name: 'SolMate',
          uri: 'https://playsolmate.fun',
          icon: 'https://playsolmate.fun/images/chess-hero.png',
        },
        cluster: 'mainnet-beta',
        addressSelector: {
          // Allow all authorized accounts
          select: async (addresses) => addresses[0],
        },
        authorizationResultCache: {
          // Simple in-memory cache - return undefined instead of null
          get: async () => undefined,
          set: async () => {},
          clear: async () => {},
        },
        onWalletNotFound: async () => {
          // Let the error bubble up so we can handle it in the UI
          throw new Error('No compatible Solana wallet found');
        },
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
