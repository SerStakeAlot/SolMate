'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { 
  SolanaMobileWalletAdapter, 
  createDefaultAddressSelector, 
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler 
} from '@solana-mobile/wallet-adapter-mobile';

// We no longer use the library's modal - using custom modal in WalletButton.tsx

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // Use a reliable RPC endpoint for mainnet
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    
    // Use Helius for reliable mainnet RPC
    // This avoids stale validator cache issues with public endpoints
    return 'https://mainnet.helius-rpc.com/?api-key=7ca044d7-5942-4ace-a0d1-e874a6515ba8';
  }, []);

  // Check if we're on Android mobile
  const isAndroidMobile = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  const wallets = useMemo(
    () => {
      const walletList = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];
      
      // Only add Mobile Wallet Adapter on Android
      // This adapter handles the mobile wallet protocol for Seeker/Saga
      if (typeof window !== 'undefined' && /android/i.test(navigator.userAgent)) {
        walletList.unshift(
          new SolanaMobileWalletAdapter({
            appIdentity: {
              name: 'SolMate',
              uri: 'https://playsolmate.fun',
              icon: 'https://playsolmate.fun/images/logo.png',
            },
            authorizationResultCache: createDefaultAuthorizationResultCache(),
            chain: 'mainnet-beta',
            addressSelector: createDefaultAddressSelector(),
            onWalletNotFound: createDefaultWalletNotFoundHandler(),
          })
        );
      }
      
      return walletList;
    },
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
