'use client';

import React, { FC, ReactNode, useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// We use @solana-mobile/wallet-standard-mobile's registerMwa() instead of 
// SolanaMobileWalletAdapter to properly integrate with Seed Vault via wallet-standard

// Component to register MWA with wallet-standard before wallet-adapter loads
const MWARegistration: FC<{ children: ReactNode }> = ({ children }) => {
  const [isRegistered, setIsRegistered] = useState(false);
  
  useEffect(() => {
    // Register MWA on the client side only
    if (typeof window === 'undefined') {
      setIsRegistered(true);
      return;
    }
    
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (!isAndroid) {
      // Not Android, no MWA needed
      console.log('[MWA] Not Android, skipping registration');
      setIsRegistered(true);
      return;
    }
    
    // Import and register MWA with wallet-standard
    // This makes Seed Vault appear as a standard wallet option
    import('@solana-mobile/wallet-standard-mobile').then((module) => {
      const { 
        registerMwa, 
        createDefaultAuthorizationCache,
        createDefaultChainSelector,
        createDefaultWalletNotFoundHandler 
      } = module;
      
      try {
        const unregister = registerMwa({
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
        console.log('[MWA] Registered with wallet-standard successfully');
        
        // Store unregister function for cleanup if needed
        (window as any).__mwaUnregister = unregister;
      } catch (err: any) {
        console.error('[MWA] Registration failed:', err);
      }
      setIsRegistered(true);
    }).catch((err) => {
      console.error('[MWA] Module load failed:', err);
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

  // Only include non-MWA wallets here
  // MWA is registered via registerMwa() in MWARegistration component
  // and will automatically appear via wallet-standard
  const wallets = useMemo(
    () => [
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
