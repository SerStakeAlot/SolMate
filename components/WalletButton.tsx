'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';

const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export const WalletButton: React.FC = () => {
  const { connected, publicKey } = useWallet();

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-solana-purple to-solana-green rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
      <WalletMultiButtonDynamic className="relative !bg-black !text-white !font-semibold !rounded-xl !px-5 !py-2.5 !transition-all !border !border-white/10 hover:!border-transparent" />
    </div>
  );
};
