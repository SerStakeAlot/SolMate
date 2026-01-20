'use client';

import dynamic from 'next/dynamic';
import React, { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export const WalletButton: React.FC = () => {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClick = useCallback(() => {
    if (connected) {
      // If connected, let the default button handle disconnect dropdown
      return;
    }
    // On mobile, manually trigger the modal
    setVisible(true);
  }, [connected, setVisible]);

  // For connected state, use the default button for dropdown functionality
  if (connected) {
    return (
      <div className="relative group" style={{ zIndex: 100, position: 'relative' }}>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-solana-purple to-solana-green rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
        <WalletMultiButtonDynamic 
          style={{ 
            position: 'relative', 
            zIndex: 101,
            pointerEvents: 'auto',
            touchAction: 'manipulation'
          }}
          className="relative !bg-black !text-white !font-semibold !rounded-xl !px-5 !py-2.5 !transition-all !border !border-white/10 hover:!border-transparent" 
        />
      </div>
    );
  }

  // For disconnected state, use a custom button that works better on mobile
  return (
    <div className="relative group" style={{ zIndex: 100, position: 'relative' }}>
      <div className="absolute -inset-0.5 bg-gradient-to-r from-solana-purple to-solana-green rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
      <button
        onClick={handleClick}
        style={{ 
          position: 'relative', 
          zIndex: 101,
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent'
        }}
        className="relative bg-black text-white font-semibold rounded-xl px-5 py-2.5 transition-all border border-white/10 hover:border-transparent text-sm"
      >
        Select Wallet
      </button>
    </div>
  );
};
