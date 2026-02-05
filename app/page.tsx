"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Trophy, ChevronRight, Sparkles, User, Users, Gamepad2, Coins, HelpCircle, X } from "lucide-react";
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
    <>
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
            className={`group relative px-8 sm:px-10 py-4 sm:py-4.5 text-base sm:text-lg font-semibold rounded-2xl transition-all w-full sm:w-auto ${
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
            className="btn-secondary px-8 sm:px-10 py-4 sm:py-4.5 text-base sm:text-lg font-semibold text-white rounded-2xl w-full sm:w-auto"
          >
            Practice Mode
          </motion.button>
        </motion.div>

        {/* How to Play Button */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => {
            console.log('How to Play clicked, current state:', showHowToPlay);
            setShowHowToPlay(prev => {
              console.log('Setting showHowToPlay from', prev, 'to true');
              return true;
            });
          }}
          className="mt-4 flex items-center gap-2 transition-colors text-sm font-medium px-4 py-2 rounded-lg border border-solana-purple/30 cursor-pointer select-none"
          style={{
            backgroundColor: '#1a1a2e',
            color: '#9945FF',
            WebkitTextFillColor: '#9945FF',
            WebkitTapHighlightColor: 'rgba(153, 69, 255, 0.3)',
            touchAction: 'manipulation'
          }}
        >
          <HelpCircle className="w-4 h-4" style={{ color: '#9945FF' }} />
          How to Play
        </div>

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
            className="group glass-card glass-card-hover rounded-3xl p-8 transition-all duration-300"
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
          <div className="glass-card glass-card-hover rounded-3xl p-6 sm:p-8 border-2 border-solana-purple/30 hover:border-solana-purple/60 transition-all">
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
                className="btn-glow px-6 py-3 text-sm font-semibold rounded-2xl text-white whitespace-nowrap"
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
          <div className="glass-card rounded-3xl p-6 sm:p-8">
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
    </main>

      {/* How to Play Modal - Outside main for proper fixed positioning */}
      {showHowToPlay && (
        <div
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '672px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#0a0a0a',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowHowToPlay(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '8px',
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X style={{ width: '20px', height: '20px', color: 'white' }} />
            </button>

              {/* Modal Content */}
              <div style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: 'white', WebkitTextFillColor: 'white' }}>
                  How to Play SolMate
                </h2>

                {/* Step 1: Connect Wallet */}
                <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(153, 69, 255, 0.3)', backgroundColor: '#1a1a2e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#9945FF' }}>1</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Connect Your Wallet</h3>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                    <p>Click the wallet button in the top right to connect your Solana wallet.</p>
                  </div>
                </div>

                {/* Step 2: Create Username */}
                <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(20, 241, 149, 0.3)', backgroundColor: '#0d1a0d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#14F195' }}>2</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Create Username</h3>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                    <p>Set your username to appear on the leaderboard and in multiplayer games.</p>
                  </div>
                </div>

                {/* Step 3: Holder Arena */}
                <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(234, 179, 8, 0.3)', backgroundColor: '#1a1a1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#eab308' }}>3</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Holder Arena ($500 Prize!)</h3>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                    <p>Hold <strong style={{ color: 'white' }}>2M+ $MATE tokens</strong> to unlock the exclusive Holder Arena. Play vs AI, compete on the leaderboard!</p>
                  </div>
                </div>

                {/* Step 4: Play with Friends */}
                <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(153, 69, 255, 0.3)', backgroundColor: '#1a1a2e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#9945FF' }}>4</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Free Play with Friends</h3>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Train vs AI:</strong> Click "Practice Mode" on home page</p>
                    <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Host a Game:</strong> Practice Mode → Create Game → Share 4-letter code</p>
                    <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Join a Game:</strong> Practice Mode → Enter friend's code → Join</p>
                    <p style={{ marginTop: '12px', color: '#a3a3a3', fontStyle: 'italic' }}>💡 Tip: You can also access Free Play from "Enter Arena" → "Free Play" tab!</p>
                  </div>
                </div>

                {/* Step 5: Wager Matches */}
                <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(249, 115, 22, 0.3)', backgroundColor: '#1a0d0d' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#f97316' }}>5</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Staked Wager Matches</h3>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Host:</strong> Enter Arena → Host Match → Select stake (0.05-1 SOL)</p>
                    <p><strong style={{ color: 'white' }}>Join:</strong> Enter Arena → Join Match → Winner takes 90%!</p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setShowHowToPlay(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '16px',
                    fontWeight: '600',
                    background: 'linear-gradient(to right, #9945FF, #14F195)',
                    color: '#ffffff',
                    WebkitTextFillColor: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Got it, let's play!
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
