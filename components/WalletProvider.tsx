'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { 
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

// We no longer use the library's modal - using custom modal in WalletButton.tsx

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Use a reliable RPC endpoint for mainnet
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    return 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';
  }, []);

  const wallets = useMemo(
    () => [
      // Mobile Wallet Adapter for Seeker/Seed Vault
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'SolMate',
          uri: typeof window !== 'undefined' ? window.location.origin : 'https://playsolmate.fun',
          icon: 'https://playsolmate.fun/images/chess-hero.png',
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: 'mainnet-beta', // Use chain parameter (MWA 2.0)
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
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
