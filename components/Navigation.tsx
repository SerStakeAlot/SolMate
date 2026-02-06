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
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(7,7,14,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 40px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* Left: Logo + SOLMATE text */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Image
            src="/images/solmate-logo.png"
            alt="SolMate"
            width={36}
            height={36}
            style={{ objectFit: 'contain' }}
          />
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, #00ffa3, #9945ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SOLMATE
          </span>
        </Link>

        {/* Right: Nav links + Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Mobile-only compact nav */}
          <Link
            href="/arena"
            className="sm:hidden"
            style={{
              color: pathname === '/arena' ? '#e8e8f0' : '#6b6b80',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 12px',
              borderRadius: 10,
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            Arena
          </Link>
          <Link
            href="/learn"
            className="sm:hidden"
            style={{
              color: pathname === '/learn' ? '#e8e8f0' : '#6b6b80',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 12px',
              borderRadius: 10,
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            Learn
          </Link>

          {/* Desktop nav links */}
          <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 4 }}>
            <Link
              href="/arena"
              className="nav-link-new"
              style={{
                color: pathname === '/arena' ? '#e8e8f0' : undefined,
                background: pathname === '/arena' ? 'rgba(255,255,255,0.04)' : undefined,
              }}
            >
              Arena
            </Link>
            <Link
              href="/learn"
              className="nav-link-new"
              style={{
                color: pathname === '/learn' ? '#e8e8f0' : undefined,
                background: pathname === '/learn' ? 'rgba(255,255,255,0.04)' : undefined,
              }}
            >
              Learn
            </Link>
            <Link
              href="/stats"
              className="nav-link-new"
              style={{
                color: pathname === '/stats' ? '#e8e8f0' : undefined,
                background: pathname === '/stats' ? 'rgba(255,255,255,0.04)' : undefined,
              }}
            >
              Leaderboard
            </Link>
          </div>

          {/* Wallet button wrapper with custom styling */}
          <div style={{ marginLeft: 12 }}>
            <WalletButton />
          </div>
        </div>
      </div>

      <style>{`
        .nav-link-new {
          color: #6b6b80;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          transition: all 0.2s;
        }
        .nav-link-new:hover {
          color: #e8e8f0;
          background: rgba(255,255,255,0.04);
        }
      `}</style>
    </nav>
  );
}
