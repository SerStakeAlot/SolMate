'use client';

import { useEffect, useState } from 'react';
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading statistics...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Platform Statistics
          </h1>
          <p className="text-gray-400">Real-time SolMate activity</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <StatCard
              label="Total Games"
              value={stats.totalGames.toLocaleString()}
              icon="🎮"
            />
            <StatCard
              label="Unique Players"
              value={stats.uniquePlayers.toLocaleString()}
              icon="👥"
            />
            <StatCard
              label="SOL Wagered"
              value={`${stats.totalSolWagered.toFixed(2)} ◎`}
              icon="💰"
              highlight
            />
            <StatCard
              label="SOL Paid Out"
              value={`${stats.totalSolPaidOut.toFixed(2)} ◎`}
              icon="🏆"
              highlight
            />
            <StatCard
              label="Wager Games"
              value={stats.totalWagerGames.toLocaleString()}
              icon="⚔️"
            />
            <StatCard
              label="Free Games"
              value={stats.totalFreeGames.toLocaleString()}
              icon="♟️"
            />
            <StatCard
              label="Platform Fees"
              value={`${stats.totalFeesCollected.toFixed(2)} ◎`}
              icon="📊"
            />
            <StatCard
              label="Last Updated"
              value={new Date(stats.updatedAt + 'Z').toLocaleTimeString('en-US', { 
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }) + ' EST'}
              icon="🕐"
            />
          </div>
        )}

        {/* Personal Stats Section */}
        <div className="bg-[#12121a] rounded-2xl border border-purple-500/20 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span>📊</span> Your Stats
          </h2>

          {!connected ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Connect your wallet to see your personal stats</p>
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-500" />
            </div>
          ) : myStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Record"
                value={`${myStats.gamesWon ?? 0}W - ${myStats.gamesLost ?? 0}L`}
                icon="📈"
                highlight
              />
              <StatCard
                label="Win Rate"
                value={`${myStats.winRate ?? 0}%`}
                icon="🎯"
              />
              <StatCard
                label="Net Profit"
                value={`${(myStats.netProfit ?? 0) > 0 ? '+' : ''}${(myStats.netProfit ?? 0).toFixed(2)} ◎`}
                icon={(myStats.netProfit ?? 0) >= 0 ? '💰' : '📉'}
                highlight
              />
              <StatCard
                label="Best Streak"
                value={(myStats.bestStreak ?? 0) > 0 ? `🔥 ${myStats.bestStreak}` : '-'}
                icon="⚡"
              />
              <StatCard
                label="Total Games"
                value={(myStats.gamesPlayed ?? 0).toString()}
                icon="🎮"
              />
              <StatCard
                label="Wager Games"
                value={`${myStats.wagerGamesWon ?? 0}/${myStats.wagerGamesPlayed ?? 0}`}
                icon="⚔️"
              />
              <StatCard
                label="SOL Wagered"
                value={`${(myStats.totalSolWagered ?? 0).toFixed(2)} ◎`}
                icon="🪙"
              />
              <StatCard
                label="SOL Won"
                value={`${(myStats.totalSolWon ?? 0).toFixed(2)} ◎`}
                icon="🏆"
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No games played yet. Start playing to see your stats!</p>
              <a
                href="/play"
                className="inline-block mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
              >
                Play Now
              </a>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-[#12121a] rounded-2xl border border-purple-500/20 p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span>🏆</span> Leaderboard
          </h2>

          {leaderboard.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No games played yet. Be the first!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Player</th>
                    <th className="pb-3 font-medium text-center">Games</th>
                    <th className="pb-3 font-medium text-center">Won</th>
                    <th className="pb-3 font-medium text-center">Win Rate</th>
                    <th className="pb-3 font-medium text-center">Best Streak</th>
                    <th className="pb-3 font-medium text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player, index) => (
                    <tr
                      key={player.walletAddress}
                      className="border-b border-gray-800 hover:bg-purple-500/5 transition-colors"
                    >
                      <td className="py-4 font-bold">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && <span className="text-gray-500">{index + 1}</span>}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {player.username || formatWallet(player.walletAddress)}
                          </span>
                          {player.username && (
                            <span className="text-gray-500 text-sm">
                              ({formatWallet(player.walletAddress)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-center text-gray-300">
                        {player.gamesPlayed}
                      </td>
                      <td className="py-4 text-center text-green-400">
                        {player.gamesWon}
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            player.winRate >= 60
                              ? 'bg-green-500/20 text-green-400'
                              : player.winRate >= 40
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {player.winRate}%
                        </span>
                      </td>
                      <td className="py-4 text-center text-purple-400">
                        {player.bestStreak > 0 ? `🔥 ${player.bestStreak}` : '-'}
                      </td>
                      <td className="py-4 text-right font-medium">
                        <span
                          className={
                            player.netProfit > 0
                              ? 'text-green-400'
                              : player.netProfit < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }
                        >
                          {player.netProfit > 0 ? '+' : ''}
                          {player.netProfit.toFixed(2)} SOL
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="text-purple-400 hover:text-purple-300 transition-colors"
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
      className={`rounded-xl p-5 ${
        highlight
          ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
          : 'bg-[#12121a] border border-purple-500/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-purple-300' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
