'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { 
  registerMwa,
  createDefaultAuthorizationCache, 
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-standard-mobile';

// Get the app URI for identity verification
function getUriForAppIdentity() {
  if (typeof window === 'undefined') return 'https://playsolmate.fun';
  return `${window.location.protocol}//${window.location.host}`;
}

// Register MWA at module level - CRITICAL: must be outside any component
// This is exactly how the official Solana Mobile example does it
registerMwa({
  appIdentity: {
    uri: getUriForAppIdentity(),
    name: 'SolMate',
    icon: '/images/solmate-logo.png',
  },
  authorizationCache: createDefaultAuthorizationCache(),
  chains: ['solana:mainnet'],
  chainSelector: createDefaultChainSelector(),
  // Remote MWA fallback - uses reflector server when local WebSocket fails
  remoteHostAuthority: 'reflector.solanamobile.com',
  onWalletNotFound: createDefaultWalletNotFoundHandler(),
});

// Detect Android mobile for auto-connect
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

  // Don't include SolanaMobileWalletAdapter here - it's registered via registerMwa()
  // and will automatically appear via wallet-standard detection
  const wallets = useMemo(
    () => typeof window === 'undefined' 
      ? [] 
      : [
          new PhantomWalletAdapter(),
          new SolflareWalletAdapter(),
        ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={isAndroidMobile()}>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
