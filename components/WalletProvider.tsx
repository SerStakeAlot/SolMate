'use client';

import React, { FC, ReactNode, useMemo, useEffect, useState } from 'react';
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

// Component to register MWA with wallet-standard before wallet-adapter loads
const MWARegistration: FC<{ children: ReactNode }> = ({ children }) => {
  const [isRegistered, setIsRegistered] = useState(false);
  
  useEffect(() => {
    // Register MWA on the client side only, and only on Android
    if (typeof window === 'undefined') {
      setIsRegistered(true);
      return;
    }
    
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) {
      setIsRegistered(true);
      return;
    }
    
    // Import and register MWA with wallet-standard
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
            // Icon must be an absolute URL
            icon: 'https://playsolmate.fun/images/solmate-logo.png',
          },
          authorizationCache: createDefaultAuthorizationCache(),
          // Use chain identifier format
          chains: ['solana:mainnet'] as any,
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        });
        console.log('[MWA] Registered with wallet-standard');
      } catch (err: any) {
        console.log('[MWA] Registration skipped:', err.message);
      }
      setIsRegistered(true);
    }).catch((err) => {
      console.log('[MWA] Module load failed:', err.message);
      setIsRegistered(true);
    });
  }, []);
  
  // Don't render children until MWA is registered (on Android)
  // This ensures wallet-standard sees MWA before wallet-adapter initializes
  if (!isRegistered) {
    return null;
  }
  
  return <>{children}</>;
};

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
          uri: 'https://playsolmate.fun',
          icon: 'https://playsolmate.fun/images/solmate-logo.png',
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: 'mainnet-beta',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <MWARegistration>
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect={false}>
          {children}
        </SolanaWalletProvider>
      </ConnectionProvider>
    </MWARegistration>
  );
};
