'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, XCircle, Minus, Share2, TrendingUp, Medal, Gamepad2, Target, X } from 'lucide-react';

interface ArenaStats {
  matchesPlayed: number;
  wins: number;
  score: number;
  rank: number;
  gamesRemainingToday: number;
}

interface ArenaResultModalProps {
  result: 'win' | 'loss' | 'draw';
  moveCount: number;
  stats: ArenaStats;
  minMovesToCount: number;
  onClose: () => void;
}

export function ArenaResultModal({
  result,
  moveCount,
  stats,
  minMovesToCount,
  onClose,
}: ArenaResultModalProps) {
  const gameCounts = moveCount >= minMovesToCount;
  
  const resultConfig = {
    win: {
      icon: Trophy,
      title: 'Victory!',
      subtitle: 'You defeated the AI!',
      bgClass: 'from-yellow-500/20 to-green-500/20',
      borderClass: 'border-yellow-500/40',
      iconColor: 'text-yellow-400',
    },
    loss: {
      icon: XCircle,
      title: 'Defeat',
      subtitle: 'The AI won this time',
      bgClass: 'from-red-500/20 to-orange-500/20',
      borderClass: 'border-red-500/40',
      iconColor: 'text-red-400',
    },
    draw: {
      icon: Minus,
      title: 'Draw',
      subtitle: 'A hard-fought stalemate',
      bgClass: 'from-gray-500/20 to-blue-500/20',
      borderClass: 'border-gray-400/40',
      iconColor: 'text-gray-400',
    },
  };

  const config = resultConfig[result];
  const ResultIcon = config.icon;

  // Generate share text
  const shareText = `I just played SolMate's Holder Arena ♟️
Matches played: ${stats.matchesPlayed}
Current rank: #${stats.rank}
Skill over hype.

Play now: https://playsolmate.fun/arena`;

  const handleShare = async () => {
    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SolMate Holder Arena',
          text: shareText,
        });
        return;
      } catch (err) {
        // User cancelled or not supported, fall through to Twitter
      }
    }
    
    // Fall back to Twitter/X intent
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`
          relative w-full max-w-md p-6 rounded-2xl 
          bg-gradient-to-br ${config.bgClass}
          border ${config.borderClass}
          backdrop-blur-xl shadow-2xl
        `}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>

        {/* Result Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className={`inline-flex p-4 rounded-full bg-white/10 mb-4`}
          >
            <ResultIcon className={`w-12 h-12 ${config.iconColor}`} />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-1">{config.title}</h2>
          <p className="text-white/60">{config.subtitle}</p>
        </div>

        {/* Game Stats Warning */}
        {!gameCounts && (
          <div className="mb-4 p-3 rounded-xl bg-orange-500/20 border border-orange-500/30">
            <p className="text-orange-400 text-sm text-center">
              ⚠️ Game didn't count - needed {minMovesToCount} moves (had {moveCount})
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Gamepad2 className="w-6 h-6 text-solana-purple mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.matchesPlayed}</p>
            <p className="text-xs text-white/50">Matches Played</p>
          </div>
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Target className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.wins}</p>
            <p className="text-xs text-white/50">Wins</p>
          </div>
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <TrendingUp className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-400">{stats.score.toFixed(1)}</p>
            <p className="text-xs text-white/50">Score</p>
          </div>
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Medal className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">#{stats.rank}</p>
            <p className="text-xs text-white/50">Rank</p>
          </div>
        </div>

        {/* Games Remaining */}
        <div className="mb-6 text-center">
          <p className="text-white/50 text-sm">
            Games remaining today: <span className="text-white font-semibold">{stats.gamesRemainingToday}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors border border-white/10"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
          >
            Continue
          </button>
          
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold transition-all"
          >
            <Share2 className="w-5 h-5" />
            Share
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
