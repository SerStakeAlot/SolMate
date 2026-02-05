'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trophy, Zap, Shield, Crown, ExternalLink, Loader2, DollarSign, Gift, Calendar } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { ArenaChessGame } from '@/components/ArenaChessGame';
import { ArenaLeaderboard } from '@/components/ArenaLeaderboard';
import { 
  checkHolderArenaAccess, 
  SOLMATE_TOKEN_MINT,
  SKR_TOKEN_MINT,
  formatTokenBalance,
  formatSkrBalance,
  getMinimumRequiredDisplay,
  getSkrMinimumRequiredDisplay
} from '@/utils/tokenGate';

export default function ArenaPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  
  const [accessStatus, setAccessStatus] = useState<{
    checked: boolean;
    hasAccess: boolean;
    balance: number;
    mateBalance?: number;
    skrBalance?: number;
    qualifyingToken?: 'MATE' | 'SKR' | null;
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
        mateBalance: result.mateBalance,
        skrBalance: result.skrBalance,
        qualifyingToken: result.qualifyingToken,
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
            mateBalance={accessStatus.mateBalance}
            skrBalance={accessStatus.skrBalance}
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
            Exclusive AI challenge for $MATE & $SKR token holders
          </p>
          
          {/* Prize Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 inline-flex items-center gap-3 px-6 py-3 rounded-[32px] bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border-2 border-green-400/50 shadow-lg shadow-green-500/20"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 animate-pulse">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-green-400">$500 PRIZE</p>
              <p className="text-sm text-white/70">Top scorer wins at season end!</p>
            </div>
            <Gift className="w-8 h-8 text-green-400 animate-bounce" />
          </motion.div>
          
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
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
            className="px-6 py-3 rounded-2xl font-semibold transition-all border border-white/10"
            style={{
              background: !showLeaderboard && !isPlaying 
                ? 'linear-gradient(to right, #eab308, #f59e0b)' 
                : '#262626',
              color: !showLeaderboard && !isPlaying ? '#000000' : '#ffffff',
              textShadow: !showLeaderboard && !isPlaying ? 'none' : '0 1px 2px rgba(0,0,0,0.8)',
              WebkitTextFillColor: !showLeaderboard && !isPlaying ? '#000000' : '#ffffff'
            }}
          >
            <Zap className="w-5 h-5 inline-block mr-2" />
            Play Arena
          </button>
          <button
            onClick={() => { setShowLeaderboard(true); setIsPlaying(false); }}
            className="px-6 py-3 rounded-2xl font-semibold transition-all border border-white/10"
            style={{
              background: showLeaderboard 
                ? 'linear-gradient(to right, #eab308, #f59e0b)' 
                : '#262626',
              color: showLeaderboard ? '#000000' : '#ffffff',
              textShadow: showLeaderboard ? 'none' : '0 1px 2px rgba(0,0,0,0.8)',
              WebkitTextFillColor: showLeaderboard ? '#000000' : '#ffffff'
            }}
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
function LockedHero({ reason, mateBalance, skrBalance, onConnect }: { 
  reason: 'wallet' | 'tokens';
  mateBalance?: number;
  skrBalance?: number;
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
      
      {/* Prize Banner for locked users */}
      <div className="mb-6 inline-flex items-center gap-3 px-6 py-3 rounded-[32px] bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border-2 border-green-400/50">
        <DollarSign className="w-8 h-8 text-green-400" />
        <div className="text-left">
          <p className="text-xl font-bold text-green-400">$500 PRIZE POOL</p>
          <p className="text-sm text-white/70">Compete for the top spot!</p>
        </div>
      </div>
      
      <p className="text-xl text-white/60 mb-8 max-w-md mx-auto">
        {reason === 'wallet' 
          ? 'Connect your wallet to access the exclusive Holder Arena'
          : 'Hold $MATE or $SKR tokens to unlock the exclusive Holder Arena'
        }
      </p>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10">
          <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold mb-1 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>Unlimited AI Matches</h3>
          <p className="text-sm text-neutral-300">Challenge our high-ELO bot</p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10">
          <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold mb-1 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>All-Time Leaderboard</h3>
          <p className="text-sm text-neutral-300">Compete for top ranks</p>
        </div>
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10">
          <Shield className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold mb-1 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>Exclusive Access</h3>
          <p className="text-sm text-neutral-300">Token holders only</p>
        </div>
      </div>

      {/* Action */}
      {reason === 'wallet' ? (
        <div className="flex justify-center">
          <WalletButton />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Token Balance Display */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* MATE Balance */}
            <div className="px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-center min-w-[180px]">
              <p className="text-sm text-white/50 mb-1">$MATE</p>
              <p className="text-xl text-red-400 font-bold mb-2">{formatTokenBalance(mateBalance || 0)}</p>
              <p className="text-xs text-white/40">Need: {getMinimumRequiredDisplay()}</p>
            </div>
            
            {/* SKR Balance */}
            <div className="px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-center min-w-[180px]">
              <p className="text-sm text-white/50 mb-1">$SKR</p>
              <p className="text-xl text-red-400 font-bold mb-2">{formatSkrBalance(skrBalance || 0)}</p>
              <p className="text-xs text-white/40">Need: {getSkrMinimumRequiredDisplay()}</p>
            </div>
          </div>
          
          {/* Get Tokens Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`https://pump.fun/coin/${SOLMATE_TOKEN_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold hover:from-yellow-400 hover:to-amber-400 transition-all"
            >
              Get $MATE
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="https://solanamobile.com/skr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold hover:from-purple-400 hover:to-violet-400 transition-all"
            >
              Get $SKR
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          
          <p className="text-xs text-white/40">
            $MATE: {SOLMATE_TOKEN_MINT.slice(0, 6)}...{SOLMATE_TOKEN_MINT.slice(-4)} | $SKR: {SKR_TOKEN_MINT.slice(0, 6)}...{SKR_TOKEN_MINT.slice(-4)}
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
      {/* Prize Card */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 sm:p-6 rounded-3xl sm:rounded-[32px] bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-green-500/20 border-2 border-green-400/50 mb-6 relative overflow-hidden shadow-xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-400/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-green-400 flex items-center gap-2">
              <Trophy className="w-7 h-7" />
              Season 1 Prize
            </h2>
            <p className="text-white/70 mt-1">Top scorer wins!</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold text-green-400">$500</p>
            <p className="text-sm text-white/50">USD Prize</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-green-400/20 flex items-center justify-center gap-2">
          <Calendar className="w-5 h-5 text-yellow-400" />
          <p className="text-yellow-400 font-semibold">
            Season ends February 20, 2026
          </p>
        </div>
      </motion.div>

      {/* Rules Card */}
      <div className="p-4 sm:p-6 rounded-3xl sm:rounded-[32px] bg-gradient-to-br from-neutral-900 to-neutral-800 border border-white/10 mb-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          <Shield className="w-6 h-6 text-yellow-400" />
          Arena Rules
        </h2>
        <ul className="space-y-3 text-neutral-300">
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
            <span className="text-yellow-400">•</span>
            Play against SolMate AI (~1500 ELO with opening book)
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
            <span className="text-yellow-400">•</span>
            Maximum 20 games per day per wallet
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
            <span className="text-yellow-400">•</span>
            Games must have at least 10 moves to count
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
            <span className="text-yellow-400">•</span>
            Resignation is allowed - losses still count toward participation
          </li>
          <li className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
            <span className="text-yellow-400">•</span>
            All-time leaderboard - your progress is permanent!
          </li>
        </ul>
      </div>

      {/* Scoring Card */}
      <div className="p-4 sm:p-6 rounded-3xl sm:rounded-[32px] bg-gradient-to-br from-neutral-900 to-neutral-800 border border-white/10 mb-8 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          <Trophy className="w-6 h-6 text-yellow-400" />
          Scoring System
        </h2>
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-neutral-300">Each match played</span>
            <span className="text-yellow-400 font-bold text-lg">+1.0 pts</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-neutral-300">Win bonus</span>
            <span className="text-green-400 font-bold text-lg">+0.5 pts</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
            <span className="text-neutral-300">Share on X bonus</span>
            <span className="text-blue-400 font-bold text-lg">+0.25 pts</span>
          </div>
        </div>
        <p className="text-neutral-400 text-sm text-center">
          Min 10 moves per game • Share after each match for extra points!
        </p>
      </div>

      {/* Start Button */}
      <div className="text-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartGame}
          className="px-12 py-5 rounded-3xl font-bold text-xl shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all"
          style={{
            background: 'linear-gradient(to right, #eab308, #f59e0b, #eab308)',
            color: '#000000',
            WebkitTextFillColor: '#000000'
          }}
        >
          <Zap className="w-6 h-6 inline-block mr-3" />
          Start Arena Match
        </motion.button>
      </div>
    </div>
  );
}
