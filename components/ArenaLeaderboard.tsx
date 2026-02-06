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
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

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

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <RefreshCw style={{ width: 32, height: 32, color: '#eab308', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ color: '#f87171', marginBottom: 16, fontSize: 14 }}>{error}</p>
        <button
          onClick={fetchLeaderboard}
          style={{
            padding: '10px 24px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e8e8f0', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw style={{ width: 16, height: 16 }} />
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b6b80', fontSize: 14 }}>
        No leaderboard data available.
      </div>
    );
  }

  const totalPlayers = data.entries.length;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Main leaderboard card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: '24px 28px',
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#eab308',
            fontFamily: "'Space Mono', monospace",
          }}>Season 1 Rankings</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 12, color: '#444',
              fontFamily: "'Space Mono', monospace",
            }}>Ends Feb 20, 2026</span>
            <button
              onClick={fetchLeaderboard}
              style={{
                padding: 6, borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title="Refresh"
            >
              <RefreshCw style={{ width: 14, height: 14, color: '#6b6b80' }} />
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '50px 1fr 80px 80px 90px',
          gap: 12, padding: '0 20px 10px',
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: '#333',
          fontFamily: "'Space Mono', monospace",
        }}>
          <span>Rank</span>
          <span>Player</span>
          <span style={{ textAlign: 'center' }}>Played</span>
          <span style={{ textAlign: 'center' }}>Wins</span>
          <span style={{ textAlign: 'right' }}>Score</span>
        </div>

        {/* Entries */}
        {data.entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(234,179,8,0.06)',
              border: '1px solid rgba(234,179,8,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>♟</div>
            <p style={{ color: '#6b6b80', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              No players yet
            </p>
            <p style={{ color: '#444', fontSize: 13 }}>
              Be the first to compete!
            </p>
          </div>
        ) : (
          <div>
            {data.entries.map((entry, index) => {
              const isCurrentUser = walletAddress === entry.walletAddress;
              const medal = getMedalEmoji(entry.rank);
              const isHovered = hoveredRow === index;

              return (
                <motion.div
                  key={entry.walletAddress}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onMouseEnter={() => setHoveredRow(index)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr 80px 80px 90px',
                    gap: 12, alignItems: 'center',
                    padding: '14px 20px', borderRadius: 14,
                    marginBottom: 6,
                    background: isCurrentUser
                      ? 'linear-gradient(135deg, rgba(234,179,8,0.06), rgba(234,179,8,0.02))'
                      : isHovered
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(255,255,255,0.015)',
                    border: `1px solid ${isCurrentUser
                      ? 'rgba(234,179,8,0.15)'
                      : isHovered
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(255,255,255,0.04)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Rank */}
                  <span style={{
                    fontSize: medal ? 20 : 15,
                    fontWeight: 700,
                    fontFamily: "'Space Mono', monospace",
                    color: entry.rank <= 3 ? '#eab308' : '#6b6b80',
                  }}>
                    {medal || `#${entry.rank}`}
                  </span>

                  {/* Player */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: isCurrentUser
                        ? 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.1))'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCurrentUser ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                    }}>👤</div>
                    <span style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 13, fontWeight: isCurrentUser ? 700 : 400,
                      color: isCurrentUser ? '#eab308' : '#a0a0b8',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.username || formatAddress(entry.walletAddress)}
                      {isCurrentUser && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, padding: '2px 8px',
                          borderRadius: 6, background: 'rgba(234,179,8,0.1)',
                          border: '1px solid rgba(234,179,8,0.15)',
                          color: '#eab308', fontWeight: 700,
                          display: 'inline-block', verticalAlign: 'middle',
                        }}>YOU</span>
                      )}
                    </span>
                  </div>

                  {/* Played */}
                  <span style={{
                    textAlign: 'center', fontFamily: "'Space Mono', monospace",
                    fontSize: 13, color: '#6b6b80',
                  }}>{entry.matchesPlayed}</span>

                  {/* Wins */}
                  <span style={{
                    textAlign: 'center', fontFamily: "'Space Mono', monospace",
                    fontSize: 13, color: '#22c55e',
                  }}>{entry.wins}</span>

                  {/* Score */}
                  <span style={{
                    textAlign: 'right', fontFamily: "'Space Mono', monospace",
                    fontSize: 15, fontWeight: 700,
                    color: entry.rank <= 3 ? '#eab308' : '#e8e8f0',
                  }}>{entry.score.toFixed(1)}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* User's Position (if not in top entries) */}
        {data.userEntry && data.userEntry.rank > 20 && (
          <div style={{
            marginTop: 12, padding: '14px 20px', borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(234,179,8,0.04), rgba(234,179,8,0.01))',
            border: '1px solid rgba(234,179,8,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 13, color: '#eab308',
            fontFamily: "'Space Mono', monospace", fontWeight: 600,
          }}>
            Your rank: #{data.userEntry.rank}{totalPlayers > 0 ? ` of ${totalPlayers} players` : ''} • Keep climbing!
          </div>
        )}

        {/* Score formula footer */}
        <div style={{
          paddingTop: 14, marginTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: 12, color: '#444',
            fontFamily: "'Space Mono', monospace",
          }}>
            Score = (Matches × 1.0) + (Wins × 0.5)
          </span>
        </div>
      </div>
    </div>
  );
}
