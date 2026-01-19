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
            <a
              href="https://x.com/SolMateChess"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Follow us on X"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
