'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { Adapter } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { 
  RemoteSolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

// Detect Android mobile
function isAndroidMobile() {
  return (
    typeof window !== 'undefined' &&
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

  const wallets = useMemo(
    (): Adapter[] => {
      if (typeof window === 'undefined') return [];
      
      const adapters: Adapter[] = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];
      
      // On Android, add Remote MWA that uses reflector server exclusively
      // This bypasses local WebSocket which fails on Seeker
      if (isAndroidMobile()) {
        adapters.unshift(
          new RemoteSolanaMobileWalletAdapter({
            addressSelector: createDefaultAddressSelector(),
            appIdentity: {
              name: 'SolMate',
              uri: window.location.origin,
              icon: '/images/solmate-logo.png',
            },
            authorizationResultCache: createDefaultAuthorizationResultCache(),
            chain: 'solana:mainnet',
            remoteHostAuthority: 'reflector.solanamobile.com',
            onWalletNotFound: createDefaultWalletNotFoundHandler(),
          })
        );
      }
      
      return adapters;
    },
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
