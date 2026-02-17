'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePathname, useRouter } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

interface ActiveGameInfo {
  hasActiveGame: boolean;
  roomId?: string;
  matchCode?: string;
  matchPubkey?: string;
  yourColor?: 'w' | 'b';
  stakeTier?: number;
  moves?: number;
}

export function ActiveGameBanner() {
  const { publicKey, connected } = useWallet();
  const pathname = usePathname();
  const router = useRouter();
  const [activeGame, setActiveGame] = useState<ActiveGameInfo | null>(null);

  // Don't show banner on the game page itself
  const isOnGamePage = pathname === '/game';

  useEffect(() => {
    if (!connected || !publicKey || isOnGamePage) {
      setActiveGame(null);
      return;
    }

    const checkActiveGame = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/active-game/${publicKey.toBase58()}`);
        const data = await res.json();
        if (data.hasActiveGame) {
          setActiveGame(data);
        } else {
          setActiveGame(null);
        }
      } catch {
        // Silently fail — don't block the UI
      }
    };

    checkActiveGame();
    // Re-check every 10 seconds in case a game starts while on another page
    const interval = setInterval(checkActiveGame, 10000);
    return () => clearInterval(interval);
  }, [connected, publicKey, isOnGamePage, pathname]);

  if (!activeGame?.hasActiveGame || isOnGamePage) return null;

  const isWager = activeGame.stakeTier !== undefined && activeGame.stakeTier >= 0;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(64px + env(safe-area-inset-top, 0px))',
      left: 0,
      right: 0,
      zIndex: 49,
      background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.08))',
      borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: 500,
      }}>
        You have an active {isWager ? 'wager ' : ''}match in progress!
        {activeGame.moves !== undefined && activeGame.moves >= 4 && (
          <span style={{ color: '#f87171', marginLeft: 4 }}>
            Leaving will count as a loss.
          </span>
        )}
      </span>
      <button
        onClick={() => {
          // Navigate to game page — the socket reconnect will restore the game state
          const params = new URLSearchParams();
          params.set('reconnect', 'true');
          if (isWager) {
            params.set('mode', 'join');
            if (activeGame.matchPubkey) params.set('match', activeGame.matchPubkey);
            if (activeGame.matchCode) params.set('code', activeGame.matchCode);
            if (activeGame.stakeTier !== undefined) params.set('tier', String(activeGame.stakeTier));
          } else {
            params.set('mode', 'computer');
          }
          router.push(`/game?${params.toString()}`);
        }}
        style={{
          background: '#eab308',
          color: '#000',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Return to Game
      </button>
    </div>
  );
}
