'use client';

import React, { FC, ReactNode, useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { 
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-standard-mobile';

// We no longer use the library's modal - using custom modal in WalletButton.tsx

// Check if we're in a mobile Android context (for MWA)
function isAndroidMobile() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof document !== 'undefined' &&
    /android/i.test(navigator.userAgent)
  );
}

// Get the app URI dynamically
function getUriForAppIdentity() {
  if (typeof window === 'undefined') return 'https://playsolmate.fun';
  return `${window.location.protocol}//${window.location.host}`;
}

// Track if MWA has been registered (module-level to prevent double registration)
let mwaRegistered = false;

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  // Register MWA on client-side mount (not during SSR)
  useEffect(() => {
    setIsMounted(true);
    
    if (!mwaRegistered && isAndroidMobile()) {
      console.log('[MWA] Registering Mobile Wallet Adapter...');
      try {
        registerMwa({
          appIdentity: {
            uri: getUriForAppIdentity(),
            name: 'SolMate',
            icon: 'https://playsolmate.fun/images/chess-hero.png',
          },
          authorizationCache: createDefaultAuthorizationCache(),
          chains: ['solana:mainnet'], // mainnet chain ID
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        });
        mwaRegistered = true;
        console.log('[MWA] Registration complete');
      } catch (e) {
        console.error('[MWA] Registration failed:', e);
      }
    }
  }, []);

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

  // Standard wallets - MWA is registered via wallet-standard and auto-detected
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={isMounted && isAndroidMobile()}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
