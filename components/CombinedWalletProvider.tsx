'use client';

import React, { FC, ReactNode } from 'react';
import { WalletProvider as SolanaWalletProvider } from '@/components/WalletProvider';
import { PrivyWalletProvider } from '@/components/PrivyWalletProvider';

// Check if Privy is configured
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export const CombinedWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // If Privy is configured, use Privy (better for mobile/Seeker)
  // Otherwise fall back to standard wallet adapter
  if (PRIVY_APP_ID) {
    return (
      <PrivyWalletProvider>
        {/* Also wrap with standard wallet provider for compatibility */}
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
      </PrivyWalletProvider>
    );
  }
  
  // Default to standard wallet adapter
  return (
    <SolanaWalletProvider>
      {children}
    </SolanaWalletProvider>
  );
};
