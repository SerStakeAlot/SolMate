'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trophy, Zap, Shield, Crown, ExternalLink, Loader2 } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { ArenaChessGame } from '@/components/ArenaChessGame';
import { ArenaLeaderboard } from '@/components/ArenaLeaderboard';
import { 
  checkHolderArenaAccess, 
  SOLMATE_TOKEN_MINT, 
  formatTokenBalance,
  getMinimumRequiredDisplay 
} from '@/utils/tokenGate';

export default function ArenaPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  
  const [accessStatus, setAccessStatus] = useState<{
    checked: boolean;
    hasAccess: boolean;
    balance: number;
    error?: string;
  }>({ checked: false, hasAccess: false, balance: 0 });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Check token gate access
  const checkAccess = useCallback(async () => {
    if (!connected || !publicKey) {
      setAccessStatus({ checked: true, hasAccess: false, balance: 0 });
      return;
    }

    try {
      const result = await checkHolderArenaAccess(connection, publicKey.toBase58());
      setAccessStatus({
        checked: true,
        hasAccess: result.hasAccess,
        balance: result.balance,
        error: result.error,
      });
    } catch (error: any) {
      setAccessStatus({
        checked: true,
        hasAccess: false,
        balance: 0,
        error: error.message,
      });
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Locked state - wallet not connected
  if (!connected) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <LockedHero 
            reason="wallet"
            onConnect={() => {}}
          />
        </div>
      </div>
    );
  }

  // Loading state
  if (!accessStatus.checked) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-solana-purple animate-spin mx-auto mb-4" />
          <p className="text-white/60">Checking token balance...</p>
        </div>
      </div>
    );
  }

  // Locked state - insufficient tokens
  if (!accessStatus.hasAccess) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <LockedHero 
            reason="tokens"
            balance={accessStatus.balance}
          />
        </div>
      </div>
    );
  }

  // Access granted - show arena
  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              Holder Arena
            </h1>
            <Crown className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-white/60 text-lg">
            Exclusive AI challenge for SolMate token holders
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm font-medium">
              Access Granted • {formatTokenBalance(accessStatus.balance)}
            </span>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => { setShowLeaderboard(false); setIsPlaying(false); }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              !showLeaderboard && !isPlaying
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Zap className="w-5 h-5 inline-block mr-2" />
            Play Arena
          </button>
          <button
            onClick={() => { setShowLeaderboard(true); setIsPlaying(false); }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              showLeaderboard
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            <Trophy className="w-5 h-5 inline-block mr-2" />
            Leaderboard
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {showLeaderboard ? (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ArenaLeaderboard walletAddress={publicKey?.toBase58()} />
            </motion.div>
          ) : isPlaying ? (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ArenaChessGame 
                walletAddress={publicKey?.toBase58() || ''} 
                onGameEnd={() => setIsPlaying(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ArenaLobby onStartGame={() => setIsPlaying(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Locked Hero Component
function LockedHero({ reason, balance, onConnect }: { 
  reason: 'wallet' | 'tokens';
  balance?: number;
  onConnect?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12"
    >
      {/* Locked Icon */}
      <div className="relative inline-block mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center border border-yellow-500/30">
          <Lock className="w-16 h-16 text-yellow-400" />
        </div>
        <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center">
          <Crown className="w-6 h-6 text-black" />
        </div>
      </div>

      <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
        Holder Arena
      </h1>
      
      <p className="text-xl text-white/60 mb-8 max-w-md mx-auto">
        {reason === 'wallet' 
          ? 'Connect your wallet to access the exclusive Holder Arena'
          : 'Hold $MATE tokens to unlock the exclusive Holder Arena'
        }
      </p>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold mb-1">Unlimited AI Matches</h3>
          <p className="text-sm text-white/50">Challenge our high-ELO bot</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold mb-1">All-Time Leaderboard</h3>
          <p className="text-sm text-white/50">Compete for top ranks</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <Shield className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold mb-1">Exclusive Access</h3>
          <p className="text-sm text-white/50">Token holders only</p>
        </div>
      </div>

      {/* Action */}
      {reason === 'wallet' ? (
        <div className="flex justify-center">
          <WalletButton />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="inline-block px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-red-400">
              Your balance: <span className="font-bold">{formatTokenBalance(balance || 0)}</span>
            </p>
            <p className="text-sm text-white/50 mt-1">
              Required: <span className="font-bold">{getMinimumRequiredDisplay()}</span>
            </p>
          </div>
          
          <div>
            <a
              href={`https://pump.fun/coin/${SOLMATE_TOKEN_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold hover:from-yellow-400 hover:to-amber-400 transition-all"
            >
              Get $MATE Tokens
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
          
          <p className="text-sm text-white/40">
            Token: {SOLMATE_TOKEN_MINT.slice(0, 8)}...{SOLMATE_TOKEN_MINT.slice(-8)}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// Arena Lobby Component
function ArenaLobby({ onStartGame }: { onStartGame: () => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Rules Card */}
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-yellow-400" />
          Arena Rules
        </h2>
        <ul className="space-y-3 text-white/70">
          <li className="flex items-start gap-3">
            <span className="text-yellow-400">•</span>
            Play against our high-ELO AI bot (Stockfish level 15)
          </li>
          <li className="flex items-start gap-3">
            <span className="text-yellow-400">•</span>
            Maximum 20 games per day per wallet
          </li>
          <li className="flex items-start gap-3">
            <span className="text-yellow-400">•</span>
            Games must have at least 10 moves to count
          </li>
          <li className="flex items-start gap-3">
            <span className="text-yellow-400">•</span>
            Resignation is allowed - losses still count toward participation
          </li>
          <li className="flex items-start gap-3">
            <span className="text-yellow-400">•</span>
            All-time leaderboard - your progress is permanent!
          </li>
        </ul>
      </div>

      {/* Scoring Card */}
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Scoring System
        </h2>
        <div className="bg-black/30 rounded-xl p-4 font-mono text-center">
          <p className="text-2xl text-yellow-400">
            Score = (Matches × 1.0) + (Wins × 0.5)
          </p>
        </div>
        <p className="text-white/50 text-sm mt-4 text-center">
          Play more games to climb the leaderboard! Wins give a small bonus.
        </p>
      </div>

      {/* Start Button */}
      <div className="text-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartGame}
          className="px-12 py-5 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 text-black font-bold text-xl shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all"
        >
          <Zap className="w-6 h-6 inline-block mr-3" />
          Start Arena Match
        </motion.button>
      </div>
    </div>
  );
}
