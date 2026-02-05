'use client';

import React, { FC, ReactNode, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { Adapter, WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { 
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

// Detect Android mobile
function isAndroidMobile() {
  if (typeof window === 'undefined') return false;
  return (
    window.isSecureContext &&
    typeof document !== 'undefined' &&
    /android/i.test(navigator.userAgent)
  );
}

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    return 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';
  }, []);

  const wallets = useMemo((): Adapter[] => {
    if (typeof window === 'undefined') return [];
    
    const adapters: Adapter[] = [];
    
    // On Android, add MWA adapter FIRST so it's the default
    if (isAndroidMobile()) {
      adapters.push(
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: 'SolMate',
            uri: window.location.origin,
            icon: '/images/solmate-logo.png',
          },
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          chain: 'solana:mainnet',
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        })
      );
    }
    
    // Add other wallets
    adapters.push(new PhantomWalletAdapter());
    adapters.push(new SolflareWalletAdapter());
    
    return adapters;
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
