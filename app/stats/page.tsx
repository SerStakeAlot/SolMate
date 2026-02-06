'use client';

import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

// Dynamic import for wallet button to avoid SSR issues
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

interface PlatformStats {
  totalGames: number;
  totalWagerGames: number;
  totalFreeGames: number;
  totalSolWagered: number;
  totalSolPaidOut: number;
  totalFeesCollected: number;
  uniquePlayers: number;
  updatedAt: string;
}

interface PlayerStats {
  walletAddress: string;
  username: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  wagerGamesPlayed: number;
  wagerGamesWon: number;
  freeGamesPlayed: number;
  freeGamesWon: number;
  totalSolWagered: number;
  totalSolWon: number;
  netProfit: number;
  currentStreak: number;
  bestStreak: number;
  winRate: number;
  createdAt: string;
  lastGameAt: string | null;
}

interface PlayerLeaderboardEntry {
  walletAddress: string;
  username: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  wagerGamesPlayed: number;
  wagerGamesWon: number;
  netProfit: number;
  bestStreak: number;
  winRate: number;
}

/* ── Particle Field ───────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = [];
    const colors = [
      'rgba(0,255,163,0.12)',
      'rgba(153,69,255,0.12)',
      'rgba(0,212,255,0.08)',
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 25; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

export default function StatsPage() {
  const { publicKey, connected } = useWallet();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerLeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch player stats when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetch(`${BACKEND_URL}/api/stats/player/${publicKey.toBase58()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setMyStats(data))
        .catch(() => setMyStats(null));
    } else {
      setMyStats(null);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [statsRes, leaderboardRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/stats`),
          fetch(`${BACKEND_URL}/api/stats/leaderboard?minGames=1&limit=20`),
        ]);

        if (!statsRes.ok || !leaderboardRes.ok) {
          throw new Error('Failed to fetch stats');
        }

        const statsData = await statsRes.json();
        const leaderboardData = await leaderboardRes.json();

        setStats(statsData);
        setLeaderboard(leaderboardData.leaderboard || []);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Unable to load statistics');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatWallet = (wallet: string) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

  const connectedWallet = connected && publicKey ? publicKey.toBase58() : null;

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ParticleField />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 32, height: 32, border: '3px solid rgba(153,69,255,0.2)', borderTopColor: '#9945ff',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: '#6b6b80', fontFamily: 'Outfit, sans-serif', fontSize: 14 }}>Loading statistics...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ParticleField />
        <div style={{ color: '#ff5050', position: 'relative', zIndex: 1, fontFamily: 'Outfit, sans-serif' }}>{error}</div>
      </main>
    );
  }

  const leaderboardGridCols = '50px 1fr 80px 80px 80px 80px 90px';

  const rowBg = (index: number) => {
    if (index === 0) return { background: 'linear-gradient(135deg, rgba(234,179,8,0.06), rgba(234,179,8,0.02))', border: '1px solid rgba(234,179,8,0.15)' };
    if (index === 1) return { background: 'linear-gradient(135deg, rgba(192,192,192,0.04), rgba(192,192,192,0.01))', border: '1px solid rgba(192,192,192,0.12)' };
    if (index === 2) return { background: 'linear-gradient(135deg, rgba(205,127,50,0.04), rgba(205,127,50,0.01))', border: '1px solid rgba(205,127,50,0.12)' };
    return { background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' };
  };

  return (
    <main style={{ minHeight: '100vh', background: '#07070e', position: 'relative' }}>
      <ParticleField />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 40px 80px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{
            color: '#e8e8f0', fontSize: 36, fontWeight: 800,
            fontFamily: 'Outfit, sans-serif', margin: '0 0 8px',
          }}>
            Platform Statistics
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <p style={{ fontSize: 15, color: '#6b6b80', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Real-time SolMate activity</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#22c55e' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
                display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              Live
            </span>
            <style>{`@keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 40,
          }}
            className="stats-grid-responsive"
          >
            <style>{`.stats-grid-responsive { } @media (max-width: 640px) { .stats-grid-responsive { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
            <StatCard label="Total Games" value={stats.totalGames.toLocaleString()} icon="🎮" />
            <StatCard label="Unique Players" value={stats.uniquePlayers.toLocaleString()} icon="👥" />
            <StatCard label="SOL Wagered" value={`${stats.totalSolWagered.toFixed(2)} ◎`} icon="💰" highlight />
            <StatCard label="SOL Paid Out" value={`${stats.totalSolPaidOut.toFixed(2)} ◎`} icon="🏆" highlight />
            <StatCard label="Wager Games" value={stats.totalWagerGames.toLocaleString()} icon="⚔️" />
            <StatCard label="Free Games" value={stats.totalFreeGames.toLocaleString()} icon="♟️" />
            <StatCard label="Platform Fees" value={`${stats.totalFeesCollected.toFixed(2)} ◎`} icon="📊" />
            <StatCard
              label="Last Updated"
              value={new Date(stats.updatedAt + 'Z').toLocaleTimeString('en-US', {
                timeZone: 'America/New_York',
                hour: '2-digit', minute: '2-digit', hour12: true,
              }) + ' EST'}
              icon="🕐"
            />
          </div>
        )}

        {/* Personal Stats Section */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: 28,
          marginBottom: 32,
        }}>
          <h2 style={{
            fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#9945ff', fontFamily: "'Space Mono', monospace",
            margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>📊</span> YOUR STATS
          </h2>

          {!connected ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ color: '#6b6b80', marginBottom: 20, fontFamily: 'Outfit, sans-serif', fontSize: 15 }}>Connect your wallet to see your personal stats</p>
              <button
                onClick={() => {
                  const btn = document.querySelector('.wallet-adapter-button') as HTMLButtonElement | null;
                  btn?.click();
                }}
                style={{
                  background: 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)',
                  color: '#07070e', padding: '12px 32px', borderRadius: 12,
                  fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Connect Wallet
              </button>
              <div style={{ display: 'none' }}><WalletMultiButton /></div>
            </div>
          ) : myStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
              className="stats-grid-responsive">
              <StatCard label="Record" value={`${myStats.gamesWon ?? 0}W - ${myStats.gamesLost ?? 0}L`} icon="📈" highlight />
              <StatCard label="Win Rate" value={`${myStats.winRate ?? 0}%`} icon="🎯" />
              <StatCard
                label="Net Profit"
                value={`${(myStats.netProfit ?? 0) > 0 ? '+' : ''}${(myStats.netProfit ?? 0).toFixed(2)} ◎`}
                icon={(myStats.netProfit ?? 0) >= 0 ? '💰' : '📉'}
                highlight
              />
              <StatCard label="Best Streak" value={(myStats.bestStreak ?? 0) > 0 ? `🔥 ${myStats.bestStreak}` : '-'} icon="⚡" />
              <StatCard label="Total Games" value={(myStats.gamesPlayed ?? 0).toString()} icon="🎮" />
              <StatCard label="Wager Games" value={`${myStats.wagerGamesWon ?? 0}/${myStats.wagerGamesPlayed ?? 0}`} icon="⚔️" />
              <StatCard label="SOL Wagered" value={`${(myStats.totalSolWagered ?? 0).toFixed(2)} ◎`} icon="🪙" />
              <StatCard label="SOL Won" value={`${(myStats.totalSolWon ?? 0).toFixed(2)} ◎`} icon="🏆" />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ color: '#6b6b80', fontFamily: 'Outfit, sans-serif', fontSize: 15 }}>No games played yet. Start playing to see your stats!</p>
              <a
                href="/play"
                style={{
                  display: 'inline-block', marginTop: 16,
                  background: 'linear-gradient(135deg, #00ffa3 0%, #9945ff 100%)',
                  color: '#07070e', padding: '10px 24px', borderRadius: 12,
                  fontWeight: 700, fontSize: 14, textDecoration: 'none',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Play Now
              </a>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: 28,
        }}>
          <h2 style={{
            fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#9945ff', fontFamily: "'Space Mono', monospace",
            margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>🏆</span> LEADERBOARD
          </h2>

          {leaderboard.length === 0 ? (
            <p style={{ color: '#6b6b80', textAlign: 'center', padding: '32px 0', fontFamily: 'Outfit, sans-serif' }}>
              No games played yet. Be the first!
            </p>
          ) : (
            <>
              {/* Column Headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: leaderboardGridCols, gap: 12,
                padding: '0 20px 10px',
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
                color: '#333', fontFamily: "'Space Mono', monospace",
              }}
                className="leaderboard-header-responsive"
              >
                <style>{`@media (max-width: 640px) { .leaderboard-header-responsive, .leaderboard-row-responsive { grid-template-columns: 40px 1fr 50px 50px 60px !important; } .lb-hide-mobile { display: none !important; } }`}</style>
                <div>Rank</div>
                <div>Player</div>
                <div style={{ textAlign: 'center' }}>Games</div>
                <div style={{ textAlign: 'center' }}>Won</div>
                <div style={{ textAlign: 'center' }}>Win%</div>
                <div style={{ textAlign: 'center' }} className="lb-hide-mobile">Streak</div>
                <div style={{ textAlign: 'right' }} className="lb-hide-mobile">Profit</div>
              </div>

              {/* Rows */}
              <div>
                {leaderboard.map((player, index) => {
                  const isYou = connectedWallet === player.walletAddress;
                  const bg = rowBg(index);
                  return (
                    <div
                      key={player.walletAddress}
                      className="leaderboard-row-responsive"
                      style={{
                        display: 'grid', gridTemplateColumns: leaderboardGridCols, gap: 12,
                        alignItems: 'center', padding: '14px 20px', borderRadius: 14,
                        marginBottom: 6, transition: 'all 0.2s', cursor: 'default',
                        ...bg,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = bg.background;
                        e.currentTarget.style.border = bg.border;
                      }}
                    >
                      {/* Rank */}
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: index < 3 ? 20 : 14, color: '#6b6b80' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </div>

                      {/* Player */}
                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontFamily: "'Space Mono', monospace", fontSize: 13,
                          color: isYou ? '#00ffa3' : '#a0a0b8',
                          fontWeight: isYou ? 700 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {player.username || formatWallet(player.walletAddress)}
                        </span>
                        {isYou && (
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 6,
                            background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.15)',
                            color: '#00ffa3', fontFamily: "'Space Mono', monospace", fontWeight: 700,
                            flexShrink: 0,
                          }}>YOU</span>
                        )}
                      </div>

                      {/* Games */}
                      <div style={{ textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b6b80' }}>
                        {player.gamesPlayed}
                      </div>

                      {/* Won */}
                      <div style={{ textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#22c55e' }}>
                        {player.gamesWon}
                      </div>

                      {/* Win% */}
                      <div style={{
                        textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 13,
                        color: player.winRate >= 60 ? '#22c55e' : player.winRate >= 40 ? '#eab308' : '#ff5050',
                      }}>
                        {player.winRate}%
                      </div>

                      {/* Streak */}
                      <div className="lb-hide-mobile" style={{ textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#9945ff' }}>
                        {player.bestStreak > 0 ? `🔥${player.bestStreak}` : '-'}
                      </div>

                      {/* Profit */}
                      <div className="lb-hide-mobile" style={{
                        textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
                        color: player.netProfit > 0 ? '#22c55e' : player.netProfit < 0 ? '#ff5050' : '#6b6b80',
                      }}>
                        {player.netProfit > 0 ? '+' : ''}{player.netProfit.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer Link */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a
            href="/"
            style={{
              color: '#6b6b80', fontSize: 14, fontWeight: 600,
              textDecoration: 'none', fontFamily: 'Outfit, sans-serif',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e8f0')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6b80')}
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 20,
        overflow: 'hidden',
        minWidth: 0,
        transition: 'all 0.2s',
        cursor: 'default',
        background: highlight
          ? 'linear-gradient(135deg, rgba(153,69,255,0.06), rgba(153,69,255,0.02))'
          : 'rgba(255,255,255,0.02)',
        border: highlight
          ? '1px solid rgba(153,69,255,0.15)'
          : '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = highlight ? 'rgba(153,69,255,0.15)' : 'rgba(255,255,255,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minWidth: 0 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontSize: 12, color: '#6b6b80', fontFamily: "'Space Mono', monospace",
          textTransform: 'uppercase', letterSpacing: '0.05em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, fontFamily: "'Space Mono', monospace",
        color: highlight ? '#9945ff' : '#e8e8f0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  );
}
