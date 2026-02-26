'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from './WalletButton';
import { useState, useEffect, useCallback } from 'react';

export function Navigation() {
  const pathname = usePathname();
  const { connected, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMobileDisconnect = useCallback(() => {
    disconnect();
    setMenuOpen(false);
  }, [disconnect]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu on resize if going above mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) setMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav className="nav-root">
      <div className="nav-inner">
        {/* Left: Logo + SOLMATE text */}
        <Link href="/" className="nav-logo-link">
          <Image
            src="/images/solmate-logo.png"
            alt="SolMate"
            width={36}
            height={36}
            style={{ objectFit: 'contain' }}
            className="nav-logo-img"
          />
          <span className="nav-logo-text">
            SOLMATE
          </span>
        </Link>

        {/* Right side */}
        <div className="nav-right">
          {/* Desktop nav links (hidden on mobile) */}
          <div className="nav-links-desktop">
            <Link
              href="/quests"
              className="nav-link-new"
              style={{
                color: pathname === '/quests' ? '#e8e8f0' : undefined,
                background: pathname === '/quests' ? 'rgba(255,255,255,0.04)' : undefined,
              }}
            >
              Quests
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

            {/* X (Twitter) */}
            <a
              href="https://x.com/SolMateChess"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-x-link"
              aria-label="Follow on X (Twitter)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          {/* Wallet button */}
          <div className="nav-wallet-wrap">
            <WalletButton />
          </div>

          {/* Hamburger button (mobile only) */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger-line ${menuOpen ? 'hamburger-open-1' : ''}`} />
            <span className={`hamburger-line ${menuOpen ? 'hamburger-open-2' : ''}`} />
            <span className={`hamburger-line ${menuOpen ? 'hamburger-open-3' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          <Link
            href="/quests"
            className="nav-mobile-link"
            style={{
              color: pathname === '/quests' ? '#e8e8f0' : undefined,
              background: pathname === '/quests' ? 'rgba(255,255,255,0.04)' : undefined,
            }}
          >
            Quests
          </Link>
          <Link
            href="/learn"
            className="nav-mobile-link"
            style={{
              color: pathname === '/learn' ? '#e8e8f0' : undefined,
              background: pathname === '/learn' ? 'rgba(255,255,255,0.04)' : undefined,
            }}
          >
            Learn
          </Link>
          <Link
            href="/stats"
            className="nav-mobile-link"
            style={{
              color: pathname === '/stats' ? '#e8e8f0' : undefined,
              background: pathname === '/stats' ? 'rgba(255,255,255,0.04)' : undefined,
            }}
          >
            Leaderboard
          </Link>
          <a
            href="https://x.com/SolMateChess"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-mobile-link"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Follow on X
          </a>
          {connected && (
            <button
              onClick={handleMobileDisconnect}
              className="nav-mobile-link"
              style={{
                background: 'rgba(248, 113, 113, 0.08)',
                color: '#f87171',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                font: 'inherit',
                width: '100%',
              }}
            >
              Disconnect Wallet
            </button>
          )}
        </div>
      )}

      <style>{`
        /* ── Nav Root ────────────────────────────── */
        .nav-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: rgba(7,7,14,0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          padding-top: calc(14px + env(safe-area-inset-top, 0px));
          max-width: 1200px;
          margin: 0 auto;
          gap: 8px;
        }

        /* ── Logo ────────────────────────────────── */
        .nav-logo-link {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .nav-logo-img {
          width: 30px;
          height: 30px;
        }

        .nav-logo-text {
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.08em;
          background: linear-gradient(135deg, #00ffa3, #9945ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* ── Right side container ─────────────────── */
        .nav-right {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
        }

        /* ── Desktop links ────────────────────────── */
        .nav-links-desktop {
          display: none;
          align-items: center;
          gap: 4px;
        }

        .nav-link-new {
          color: #6b6b80;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .nav-link-new:hover {
          color: #e8e8f0;
          background: rgba(255,255,255,0.04);
        }

        /* ── X (Twitter) link ──────────────────────── */
        .nav-x-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          color: #6b6b80;
          transition: all 0.2s;
          text-decoration: none;
          flex-shrink: 0;
        }
        .nav-x-link:hover {
          color: #e8e8f0;
          background: rgba(255,255,255,0.04);
        }

        /* ── Wallet button wrapper ────────────────── */
        .nav-wallet-wrap {
          margin-left: 4px;
          flex-shrink: 0;
          max-width: 160px;
        }

        /* ── Hamburger (mobile only) ──────────────── */
        .nav-hamburger {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
          width: 36px;
          height: 36px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          cursor: pointer;
          padding: 6px;
          margin-left: 4px;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .nav-hamburger:hover {
          background: rgba(255,255,255,0.04);
        }

        .hamburger-line {
          display: block;
          width: 18px;
          height: 2px;
          background: #a0a0b8;
          border-radius: 2px;
          transition: all 0.3s ease;
        }
        .hamburger-open-1 {
          transform: translateY(7px) rotate(45deg);
        }
        .hamburger-open-2 {
          opacity: 0;
        }
        .hamburger-open-3 {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* ── Mobile dropdown menu ─────────────────── */
        .nav-mobile-menu {
          display: flex;
          flex-direction: column;
          padding: 8px 16px 16px;
          gap: 2px;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: rgba(7,7,14,0.95);
        }

        .nav-mobile-link {
          color: #6b6b80;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          padding: 12px 16px;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          transition: all 0.2s;
        }
        .nav-mobile-link:hover {
          color: #e8e8f0;
          background: rgba(255,255,255,0.04);
        }

        /* ── Desktop breakpoint (640px+) ──────────── */
        @media (min-width: 640px) {
          .nav-inner {
            padding: 20px 40px;
          }

          .nav-logo-img {
            width: 36px;
            height: 36px;
          }

          .nav-logo-text {
            font-size: 18px;
          }

          .nav-links-desktop {
            display: flex;
          }

          .nav-hamburger {
            display: none;
          }

          .nav-mobile-menu {
            display: none;
          }

          .nav-wallet-wrap {
            margin-left: 12px;
            max-width: none;
          }
        }
      `}</style>
    </nav>
  );
}
