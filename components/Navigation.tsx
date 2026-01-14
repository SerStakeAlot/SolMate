'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from './WalletButton';

export function Navigation() {
  const pathname = usePathname();
  const { connected } = useWallet();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-solana-purple/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <Image 
                src="/images/solmate-logo.png" 
                alt="SolMate" 
                width={40} 
                height={40}
                className="h-10 w-10 object-contain relative z-10"
              />
            </div>
            <span className="text-lg font-bold tracking-tight text-gradient">SolMate</span>
          </Link>
          
          <div className="flex items-center gap-3">
            {connected && (
              <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-white/5">
                <Link
                  href="/play"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    pathname === '/play'
                      ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white shadow-glow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Play
                </Link>
                <Link
                  href="/lobby"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    pathname === '/lobby'
                      ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white shadow-glow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Lobby
                </Link>
              </div>
            )}
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
