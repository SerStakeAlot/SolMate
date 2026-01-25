'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from './WalletButton';
import { BookOpen } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();
  const { connected } = useWallet();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-solana-purple/30 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <Image 
                src="/images/solmate-logo.png" 
                alt="SolMate" 
                width={40} 
                height={40}
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain relative z-10"
              />
            </div>
            <span className="hidden xs:inline font-display text-lg font-bold tracking-tight text-gradient">SolMate</span>
          </Link>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* X (Twitter) button */}
            <a
              href="https://x.com/SolMateChess"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center justify-center p-2.5 rounded-lg text-white hover:text-white transition-all relative z-10 min-w-[40px] min-h-[40px]"
              aria-label="Follow on X (Twitter)"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            
            {/* Mobile Learn link - more visible */}
            <Link
              href="/learn"
              className={`sm:hidden flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                pathname === '/learn'
                  ? 'btn-glow text-white'
                  : 'btn-secondary text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Learn
            </Link>
            
            {/* Desktop nav links */}
            <div className="hidden sm:flex items-center gap-1.5 p-1.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              {connected && (
                <>
                  <Link
                    href="/play"
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      pathname === '/play'
                        ? 'btn-glow text-white'
                        : 'text-neutral-400 hover:text-white btn-ghost'
                    }`}
                  >
                    Play
                  </Link>
                  <Link
                    href="/lobby"
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      pathname === '/lobby'
                        ? 'btn-glow text-white'
                        : 'text-neutral-400 hover:text-white btn-ghost'
                    }`}
                  >
                    Lobby
                  </Link>
                </>
              )}
              <Link
                href="/learn"
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  pathname === '/learn'
                    ? 'btn-glow text-white'
                    : 'text-neutral-400 hover:text-white btn-ghost'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Learn
              </Link>
            </div>
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
