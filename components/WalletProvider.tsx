'use client';

import React, { FC, ReactNode, useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter styles FIRST so we can override them
import '@solana/wallet-adapter-react-ui/styles.css';

// Critical mobile wallet modal fix - inject styles at runtime
const walletModalStyles = `
  .wallet-adapter-modal-wrapper {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.95) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 99999 !important;
    padding: 20px !important;
  }
  .wallet-adapter-modal {
    background: #1a1a1a !important;
    border: 2px solid #9945FF !important;
    border-radius: 16px !important;
    padding: 24px !important;
    width: 90% !important;
    max-width: 320px !important;
    position: relative !important;
    top: auto !important;
    left: auto !important;
    transform: none !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  .wallet-adapter-modal-title {
    color: #ffffff !important;
    font-size: 18px !important;
    font-weight: 700 !important;
    margin-bottom: 16px !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  .wallet-adapter-modal-list {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  }
  .wallet-adapter-modal-list li {
    background: #252525 !important;
    border: 1px solid #333 !important;
    border-radius: 12px !important;
    list-style: none !important;
    opacity: 1 !important;
    visibility: visible !important;
  }
  .wallet-adapter-modal-list .wallet-adapter-button {
    width: 100% !important;
    padding: 14px !important;
    background: transparent !important;
    color: #ffffff !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  .wallet-adapter-button-start-icon {
    width: 32px !important;
    height: 32px !important;
  }
  .wallet-adapter-button-start-icon img {
    width: 32px !important;
    height: 32px !important;
  }
  .wallet-adapter-modal-button-close {
    position: absolute !important;
    top: 12px !important;
    right: 12px !important;
    background: #333 !important;
    border: none !important;
    border-radius: 8px !important;
    width: 32px !important;
    height: 32px !important;
    color: #fff !important;
    cursor: pointer !important;
  }
`;

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Inject wallet modal styles on mount
  useEffect(() => {
    const styleId = 'wallet-modal-override-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = walletModalStyles;
      document.head.appendChild(style);
    }
  }, []);

  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // Use a reliable RPC endpoint for mainnet
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    
    // Use Helius free tier for reliable mainnet RPC
    // This avoids stale validator cache issues with public endpoints
    return 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY_2';
  }, []);

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
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
