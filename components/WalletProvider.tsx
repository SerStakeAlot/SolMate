'use client';

import React, { FC, ReactNode, useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Register MWA at module level (before React renders) - this is how the official example does it
// The library will check if we're on Android + not in WebView before actually registering
if (typeof window !== 'undefined') {
  const isAndroid = /android/i.test(navigator.userAgent);
  
  // Debug logging
  console.log('[MWA Init] UserAgent:', navigator.userAgent);
  console.log('[MWA Init] isAndroid:', isAndroid);
  console.log('[MWA Init] isSecureContext:', window.isSecureContext);
  
  // Check if the library would consider this a WebView (we want to know for debugging)
  const isWebViewPattern = /(WebView|Version\/.+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+)|; wv\).+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+))/i;
  const wouldBeWebView = isWebViewPattern.test(navigator.userAgent);
  console.log('[MWA Init] Library would detect WebView:', wouldBeWebView);
  
  if (isAndroid && window.isSecureContext) {
    import('@solana-mobile/wallet-standard-mobile').then((module) => {
      const { 
        registerMwa, 
        createDefaultAuthorizationCache,
        createDefaultChainSelector,
        createDefaultWalletNotFoundHandler 
      } = module;
      
      try {
        registerMwa({
          appIdentity: {
            name: 'SolMate',
            uri: 'https://playsolmate.fun',
            icon: 'https://playsolmate.fun/images/solmate-logo.png',
          },
          authorizationCache: createDefaultAuthorizationCache(),
          chains: ['solana:mainnet'] as any,
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        });
        console.log('[MWA] ✅ Registered with wallet-standard');
      } catch (err: any) {
        console.error('[MWA] ❌ Registration failed:', err);
      }
    }).catch((err) => {
      console.error('[MWA] ❌ Module load failed:', err);
    });
  } else {
    console.log('[MWA] Skipped: isAndroid=' + isAndroid + ', isSecureContext=' + window.isSecureContext);
  }
}

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Use a reliable RPC endpoint for mainnet
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    return 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';
  }, []);

  // Only include non-MWA wallets here
  // MWA is registered via registerMwa() at module level above
  // and will automatically appear via wallet-standard
  const wallets = useMemo(
    () => [
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
