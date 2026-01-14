"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Zap, Trophy, ChevronRight, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { connected } = useWallet();

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
          
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold mb-4 sm:mb-6 tracking-tight">
            <span className="text-gradient">Stake.</span>{" "}
            <span className="text-white">Compete.</span>{" "}
            <span className="text-gradient">Conquer.</span>
          </h1>
          
          <p className="text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed px-2">
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
            whileHover={connected ? { scale: 1.03 } : {}}
            whileTap={connected ? { scale: 0.97 } : {}}
            className={`group relative px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-bold rounded-2xl transition-all w-full sm:w-auto ${
              connected
                ? "btn-glow text-white shadow-glow"
                : "bg-white/5 text-neutral-500 cursor-not-allowed border border-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              {connected ? (
                <>
                  Enter Arena
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                "Connect Wallet to Play"
              )}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => router.push("/game?mode=computer")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all border border-white/10 hover:border-white/20 w-full sm:w-auto"
          >
            Practice Mode
          </motion.button>
        </motion.div>

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
            description: "Choose from 0.5 or 1 SOL stake tiers",
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
            <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
            <p className="text-neutral-400 leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </section>

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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to <span className="text-gradient">dominate</span>?
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto">
              Join thousands of players competing in strategic chess battles with real SOL stakes on the fastest blockchain.
            </p>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
