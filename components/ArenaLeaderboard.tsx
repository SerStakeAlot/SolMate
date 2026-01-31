'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, RefreshCw, User } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  username?: string;
  matchesPlayed: number;
  wins: number;
  score: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  type: string;
  userEntry?: LeaderboardEntry;
}

interface ArenaLeaderboardProps {
  walletAddress?: string;
}

export function ArenaLeaderboard({ walletAddress }: ArenaLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = walletAddress ? `?wallet=${walletAddress}` : '';
      const res = await fetch(`${BACKEND_URL}/api/arena/leaderboard${params}`);
      
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      
      const leaderboardData = await res.json();
      setData(leaderboardData);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-white/40 font-mono">#{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/40';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/40';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/40';
    return 'bg-white/5 border-white/10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchLeaderboard}
          className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5 inline-block mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-white/60">
        No leaderboard data available.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-2 text-white/60">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span>All-Time Leaderboard</span>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* User's Position (if not in top 20) */}
      {data.userEntry && data.userEntry.rank > 20 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-gradient-to-r from-solana-purple/20 to-solana-green/20 border border-solana-purple/40"
        >
          <p className="text-sm text-white/60 mb-2">Your Position</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold">#{data.userEntry.rank}</span>
              <div>
                <p className="font-semibold">
                  {data.userEntry.username || formatAddress(data.userEntry.walletAddress)}
                </p>
                <p className="text-sm text-white/50">
                  {data.userEntry.matchesPlayed} matches • {data.userEntry.wins} wins
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-400">{data.userEntry.score.toFixed(1)}</p>
              <p className="text-xs text-white/50">SCORE</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard Table */}
      <div className="rounded-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 text-white/60 text-sm font-semibold border-b border-white/10">
          <div className="col-span-1">Rank</div>
          <div className="col-span-5">Player</div>
          <div className="col-span-2 text-center">Matches</div>
          <div className="col-span-2 text-center">Wins</div>
          <div className="col-span-2 text-right">Score</div>
        </div>

        {/* Entries */}
        {data.entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-white/40">
            No entries yet. Be the first to play!
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {data.entries.map((entry, index) => {
              const isCurrentUser = walletAddress === entry.walletAddress;
              
              return (
                <motion.div
                  key={entry.walletAddress}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors
                    ${getRankStyle(entry.rank)}
                    ${isCurrentUser ? 'ring-2 ring-solana-purple ring-inset' : ''}
                    hover:bg-white/5
                  `}
                >
                  {/* Rank */}
                  <div className="col-span-1 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Player */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-solana-purple/30 to-solana-green/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-white/60" />
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${isCurrentUser ? 'text-yellow-400' : 'text-white'}`}>
                        {entry.username || formatAddress(entry.walletAddress)}
                        {isCurrentUser && <span className="ml-2 text-xs">(You)</span>}
                      </p>
                    </div>
                  </div>

                  {/* Matches */}
                  <div className="col-span-2 text-center">
                    <span className="text-white/80">{entry.matchesPlayed}</span>
                  </div>

                  {/* Wins */}
                  <div className="col-span-2 text-center">
                    <span className="text-green-400">{entry.wins}</span>
                  </div>

                  {/* Score */}
                  <div className="col-span-2 text-right">
                    <span className={`font-bold ${entry.rank <= 3 ? 'text-yellow-400 text-lg' : 'text-white'}`}>
                      {entry.score.toFixed(1)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scoring Info */}
      <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
        <p className="text-white/50 text-sm">
          <TrendingUp className="w-4 h-4 inline-block mr-2" />
          Score = (Matches × 1.0) + (Wins × 0.5)
        </p>
      </div>
    </div>
  );
}
