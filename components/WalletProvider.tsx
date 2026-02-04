'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Register MWA directly, bypassing the library's WebView detection which blocks Seeker
// The official registerMwa() checks isWebView() and skips registration - we don't want that
if (typeof window !== 'undefined') {
  const isAndroid = /android/i.test(navigator.userAgent);
  
  if (isAndroid && window.isSecureContext) {
    // Dynamically import and directly register the wallet, bypassing WebView check
    Promise.all([
      import('@solana-mobile/wallet-standard-mobile'),
      import('@wallet-standard/wallet')
    ]).then(([mwaModule, walletStandardModule]) => {
      const { 
        LocalSolanaMobileWalletAdapterWallet,
        createDefaultAuthorizationCache,
        createDefaultChainSelector,
        createDefaultWalletNotFoundHandler 
      } = mwaModule;
      const { registerWallet } = walletStandardModule;
      
      try {
        // Directly create and register the wallet - this bypasses the isWebView check
        const wallet = new LocalSolanaMobileWalletAdapterWallet({
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
        
        registerWallet(wallet);
        console.log('[MWA] ✅ Directly registered LocalSolanaMobileWalletAdapterWallet');
      } catch (err: any) {
        console.error('[MWA] ❌ Direct registration failed:', err);
      }
    }).catch((err) => {
      console.error('[MWA] ❌ Module load failed:', err);
    });
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
