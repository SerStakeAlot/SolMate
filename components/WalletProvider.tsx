'use client';

import React, { FC, ReactNode, useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { Adapter } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Detect Android mobile
function isAndroidMobile() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof document !== 'undefined' &&
    /android/i.test(navigator.userAgent)
  );
}

// Register MWA only on client side
let mwaRegistered = false;

function registerMwaOnce() {
  if (typeof window === 'undefined' || mwaRegistered) return;
  
  // Dynamic import to avoid SSR issues
  import('@solana-mobile/wallet-standard-mobile').then(({ 
    registerMwa, 
    createDefaultAuthorizationCache, 
    createDefaultChainSelector,
    createDefaultWalletNotFoundHandler 
  }) => {
    try {
      registerMwa({
        appIdentity: {
          uri: window.location.origin,
          name: 'SolMate',
          icon: '/images/solmate-logo.png',
        },
        authorizationCache: createDefaultAuthorizationCache(),
        chains: ['solana:mainnet'],
        chainSelector: createDefaultChainSelector(),
        remoteHostAuthority: 'reflector.solanamobile.com',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      });
      mwaRegistered = true;
      console.log('[MWA] Registered successfully');
    } catch (e) {
      console.error('[MWA] Registration error:', e);
    }
  }).catch(e => {
    console.error('[MWA] Import error:', e);
  });
}

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    // Register MWA when component mounts on client
    if (isAndroidMobile()) {
      registerMwaOnce();
    }
  }, []);

  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    return 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';
  }, []);

  // Per official example: DON'T include MWA adapter here
  // registerMwa() adds it automatically via wallet-standard
  const wallets = useMemo(
    (): Adapter[] => {
      if (!isClient) return [];
      return [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];
    },
    [isClient]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={isAndroidMobile()}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
