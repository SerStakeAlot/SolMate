"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Trophy, ChevronRight, Sparkles, User, Users, Gamepad2, Coins, HelpCircle, X, Smartphone, Globe, Crown, Swords, UserPlus } from "lucide-react";
import { UsernameSetting } from "@/components/UsernameSetting";
import { useState, useEffect } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

interface PlatformStats {
  totalGames: number;
  uniquePlayers: number;
  totalSolWagered: number;
}

export default function Home() {
  const router = useRouter();
  const { connected } = useWallet();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [usernameCount, setUsernameCount] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch game stats
        const res = await fetch(`${BACKEND_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
        
        // Fetch username count
        const usernamesRes = await fetch(`${BACKEND_URL}/api/usernames`);
        if (usernamesRes.ok) {
          const usernamesData = await usernamesRes.json();
          setUsernameCount(usernamesData.count);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center pt-12 sm:pt-20 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative"
        >
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 bg-solana-purple/30 rounded-full blur-[80px]" />
          </div>
          
          <div className="relative flex flex-col items-center justify-center mb-8">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image 
                src="/images/solmate-logo.png" 
                alt="SolMate" 
                width={160} 
                height={160}
                className="drop-shadow-2xl"
                priority
              />
            </motion.div>
          </div>
          
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 tracking-tight">
            <span className="text-gradient">Stake.</span>{" "}
            <span className="text-white">Compete.</span>{" "}
            <span className="text-gradient">Conquer.</span>
          </h1>
          
          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed px-2 font-medium">
            The premier chess battleground on Solana. Challenge opponents in tactical duels 
            with real stakes and instant payouts.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-2 sm:px-0"
        >
          <motion.button
            type="button"
            disabled={!connected}
            onClick={() => router.push("/play")}
            whileHover={connected ? { scale: 1.02 } : {}}
            whileTap={connected ? { scale: 0.98 } : {}}
            className={`group relative px-8 sm:px-10 py-4 sm:py-4.5 text-base sm:text-lg font-semibold rounded-xl transition-all w-full sm:w-auto ${
              connected
                ? "btn-glow text-white"
                : "btn-secondary text-neutral-500 cursor-not-allowed"
            }`}
          >
            <span className="flex items-center justify-center gap-2.5">
              {connected ? (
                <>
                  Enter Arena
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-300" />
                </>
              ) : (
                "Connect Wallet to Play"
              )}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => router.push("/game?mode=computer")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary px-8 sm:px-10 py-4 sm:py-4.5 text-base sm:text-lg font-semibold text-white rounded-xl w-full sm:w-auto"
          >
            Practice Mode
          </motion.button>
        </motion.div>

        {/* How to Play Button */}
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowHowToPlay(true);
          }}
          className="mt-4 flex items-center gap-2 transition-colors text-sm font-medium px-4 py-2 rounded-lg border border-solana-purple/30 cursor-pointer relative z-10"
          style={{
            backgroundColor: '#1a1a2e',
            color: '#9945FF',
            WebkitTextFillColor: '#9945FF'
          }}
        >
          <HelpCircle className="w-4 h-4" style={{ color: '#9945FF' }} />
          How to Play
        </motion.button>

        {!connected && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-sm text-neutral-500 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-solana-purple" />
            Connect your wallet to access competitive staked matches
          </motion.p>
        )}

        {connected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 w-full max-w-sm"
          >
            <UsernameSetting />
          </motion.div>
        )}
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-16 sm:mb-20 px-2 sm:px-0">
        {[
          {
            icon: Zap,
            title: "Instant Payouts",
            description: "Winners receive 90% of the stake pool immediately upon victory",
            delay: 0.1,
            gradient: "from-yellow-500/20 to-orange-500/20"
          },
          {
            icon: Shield,
            title: "Secure Escrow",
            description: "Smart contract holds stakes until match completion",
            delay: 0.2,
            gradient: "from-solana-purple/20 to-blue-500/20"
          },
          {
            icon: Trophy,
            title: "Competitive Stakes",
            description: "Choose from 0.05, 0.1, 0.5 or 1 SOL stake tiers",
            delay: 0.3,
            gradient: "from-solana-green/20 to-emerald-500/20"
          }
        ].map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: feature.delay }}
            className="group glass-card glass-card-hover rounded-2xl p-8 transition-all duration-300"
          >
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
              <feature.icon className="h-7 w-7 text-white" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2 text-white">{feature.title}</h3>
            <p className="text-neutral-400 leading-relaxed text-sm">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </section>

      {/* Token Banner Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="relative mb-8 overflow-hidden"
      >
        <a 
          href="https://pump.fun/coin/5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump"
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="glass-card glass-card-hover rounded-2xl p-6 sm:p-8 border-2 border-solana-purple/30 hover:border-solana-purple/60 transition-all">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-1 flex items-center gap-2 justify-center sm:justify-start">
                    SOLMATE Token
                  </h3>
                  <p className="text-sm text-neutral-400 font-medium">
                    Trade the official SolMate token on Pump.fun
                  </p>
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="btn-glow px-6 py-3 text-sm font-semibold rounded-xl text-white whitespace-nowrap"
              >
                Trade Now →
              </motion.div>
            </div>
          </div>
        </a>
      </motion.section>

      {/* Live Stats Section */}
      {stats && (stats.totalGames > 0 || stats.uniquePlayers > 0 || (usernameCount !== null && usernameCount > 0)) && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-8"
        >
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="status-dot status-dot-online" />
              <span className="stat-label">Live Platform Stats</span>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Gamepad2 className="w-5 h-5 text-solana-purple" />
                </div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">{stats.totalGames.toLocaleString()}</p>
                <p className="stat-label mt-1">Games Played</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-solana-green" />
                </div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  {usernameCount !== null ? usernameCount.toLocaleString() : stats.uniquePlayers.toLocaleString()}
                </p>
                <p className="stat-label mt-1">Players</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">{stats.totalSolWagered.toFixed(1)} <span className="text-lg">◎</span></p>
                <p className="stat-label mt-1">SOL Wagered</p>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="relative mb-16 overflow-hidden"
      >
        <div className="border-gradient p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-solana-purple/5 via-transparent to-solana-green/5" />
          <div className="relative z-10">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4">
              Ready to <span className="text-gradient">dominate</span>?
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto text-sm sm:text-base">
              Join thousands of players competing in strategic chess battles with real SOL stakes on the fastest blockchain.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8 mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-neutral-500 text-sm">
            © 2026 SolMate. All rights reserved.
          </p>
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-end">
            <a 
              href="/security" 
              className="text-neutral-400 hover:text-solana-green transition-colors text-sm"
            >
              Security Audit
            </a>
            <a 
              href="/refund" 
              className="text-neutral-400 hover:text-solana-green transition-colors text-sm"
            >
              Claim Refund
            </a>
            <a 
              href="/privacy.html" 
              className="text-neutral-400 hover:text-solana-purple transition-colors text-sm"
            >
              Privacy Policy
            </a>
            <a 
              href="/terms.html" 
              className="text-neutral-400 hover:text-solana-purple transition-colors text-sm"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>

      {/* How to Play Modal */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
            onClick={() => setShowHowToPlay(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10"
              style={{ backgroundColor: '#0a0a0a' }}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowHowToPlay(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {/* Modal Content */}
              <div className="p-6 sm:p-8">
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
                  <span className="text-gradient">How to Play</span> SolMate
                </h2>

                {/* Step 1: Connect Wallet */}
                <div className="mb-8 p-4 rounded-xl border border-solana-purple/30" style={{ backgroundColor: '#1a1a2e' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black" style={{ backgroundColor: '#9945FF' }}>1</div>
                    <h3 className="text-lg font-bold text-white" style={{ WebkitTextFillColor: 'white' }}>Connect Your Wallet</h3>
                  </div>
                  <div className="space-y-3 text-neutral-300 text-sm">
                    <div className="flex items-start gap-3">
                      <Smartphone className="w-5 h-5 text-solana-purple flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>On Mobile (Recommended):</p>
                        <p>Open the <strong>Phantom app</strong> → tap the globe icon (browser) → go to <strong>playsolmate.fun</strong></p>
                        <p className="text-neutral-400 mt-1">This connects your wallet automatically!</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-solana-green flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>On Desktop:</p>
                        <p>Install the Phantom browser extension, then click "Connect Wallet" on SolMate</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Holder Arena */}
                <div className="mb-8 p-4 rounded-xl border border-yellow-500/30" style={{ backgroundColor: '#1a1a1a' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black" style={{ backgroundColor: '#eab308' }}>2</div>
                    <h3 className="text-lg font-bold text-white" style={{ WebkitTextFillColor: 'white' }}>Holder Arena (Token Holders)</h3>
                  </div>
                  <div className="space-y-2 text-neutral-300 text-sm">
                    <div className="flex items-start gap-3">
                      <Crown className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p>Hold <strong>2M+ $MATE tokens</strong> to unlock the exclusive Holder Arena</p>
                        <p className="text-neutral-400 mt-1">Play vs AI, compete on the leaderboard, win the <strong>$500 prize</strong>!</p>
                      </div>
                    </div>
                    <p className="pl-8">Go to <strong>Arena</strong> from the navigation menu to start playing</p>
                  </div>
                </div>

                {/* Step 3: Play with Friends */}
                <div className="mb-8 p-4 rounded-xl border border-solana-green/30" style={{ backgroundColor: '#0d1a0d' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black" style={{ backgroundColor: '#14F195' }}>3</div>
                    <h3 className="text-lg font-bold text-white" style={{ WebkitTextFillColor: 'white' }}>Practice Mode & Free Play</h3>
                  </div>
                  <div className="space-y-3 text-neutral-300 text-sm">
                    <div className="flex items-start gap-3">
                      <Gamepad2 className="w-5 h-5 text-solana-green flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>Train vs AI:</p>
                        <p>Click <strong>"Practice Mode"</strong> on the home page to play against the computer</p>
                        <p className="text-neutral-400 mt-1">Choose difficulty: Novice, Club, or Master level AI</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <UserPlus className="w-5 h-5 text-solana-green flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>Host a Game with Friends:</p>
                        <p>In Practice Mode → scroll down → "Create Game" under Free Online Play</p>
                        <p className="text-neutral-400 mt-1">Share the 4-letter code with your friend</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-solana-purple flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>Join a Friend's Game:</p>
                        <p>In Practice Mode → scroll down → enter friend's code → "Join"</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4: Wager Matches */}
                <div className="mb-6 p-4 rounded-xl border border-orange-500/30" style={{ backgroundColor: '#1a0d0d' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-black" style={{ backgroundColor: '#f97316' }}>4</div>
                    <h3 className="text-lg font-bold text-white" style={{ WebkitTextFillColor: 'white' }}>Staked Wager Matches</h3>
                  </div>
                  <div className="space-y-3 text-neutral-300 text-sm">
                    <div className="flex items-start gap-3">
                      <Swords className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>Host a Wager Match:</p>
                        <p>Click "Enter Arena" → "Host Match" → Select stake tier (0.05-1 SOL)</p>
                        <p className="text-neutral-400 mt-1">Your SOL is locked in escrow. Share match code with opponent.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Coins className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white" style={{ WebkitTextFillColor: 'white' }}>Join a Wager Match:</p>
                        <p>Click "Enter Arena" → "Join Match" → Browse open matches or enter code</p>
                        <p className="text-neutral-400 mt-1">Winner takes 90% of the pot instantly!</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="w-full py-3 rounded-xl font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(to right, #9945FF, #14F195)',
                    color: '#ffffff',
                    WebkitTextFillColor: '#ffffff'
                  }}
                >
                  Got it, let's play!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
