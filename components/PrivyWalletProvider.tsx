'use client';

import React, { FC, ReactNode, useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Privy App ID - Get this from https://dashboard.privy.io
// You need to create a Privy account and app at dashboard.privy.io
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

// Configure Solana wallet connectors for Privy
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

// Component to register MWA on mount
const MWARegistration: FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Register MWA on the client side only
    if (typeof window !== 'undefined') {
      import('@solana-mobile/wallet-standard-mobile').then((module) => {
        const { 
          registerMwa, 
          createDefaultAuthorizationCache,
          createDefaultChainSelector,
          createDefaultWalletNotFoundHandler 
        } = module;
        
        registerMwa({
          appIdentity: {
            name: 'SolMate',
            uri: 'https://playsolmate.fun',
            icon: '/images/chess-hero.png',
          },
          authorizationCache: createDefaultAuthorizationCache(),
          chains: ['solana:mainnet'] as any,
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        });
        console.log('MWA registered for Privy');
      }).catch((err) => {
        console.log('MWA registration skipped:', err.message);
      });
    }
  }, []);
  
  return <>{children}</>;
};

export const PrivyWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // If no Privy App ID is configured, render children without Privy
  if (!PRIVY_APP_ID) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID not set - Privy disabled');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#9945FF',
          logo: 'https://playsolmate.fun/images/chess-hero.png',
          showWalletLoginFirst: true,
        },
        // Login methods - wallet only for now
        loginMethods: ['wallet'],
        // External wallets including Solana Mobile
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      <MWARegistration>
        {children}
      </MWARegistration>
    </PrivyProvider>
  );
};
