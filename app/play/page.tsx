"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, Swords, Bot, Zap, ArrowLeft, ArrowRight } from "lucide-react";

type PlayMode = "multiplayer" | "join" | "host" | "computer";

export default function PlayPage() {
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode | null>(null);

  const gameHref = useMemo(() => {
    if (mode === 'multiplayer') {
      return '/multiplayer';
    }
    if (mode === 'join') {
      return '/lobby';
    }
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    return `/game?${params.toString()}`;
  }, [mode]);

  const modeOptions = [
    {
      id: "multiplayer" as const,
      title: "Multiplayer",
      description: "Real-time matches with 10min timer",
      icon: Zap,
      featured: true,
      gradient: "from-solana-purple via-violet-500 to-solana-green",
    },
    {
      id: "join" as const,
      title: "Join Match",
      description: "Browse and join open staked matches",
      icon: Users,
      featured: false,
    },
    {
      id: "host" as const,
      title: "Host Match",
      description: "Create a new staked match",
      icon: Swords,
      featured: false,
    },
    {
      id: "computer" as const,
      title: "Practice",
      description: "Train against AI - no stakes",
      icon: Bot,
      featured: false,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
            Select <span className="text-gradient">Mode</span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-400">
            Choose your path to victory
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8 sm:mb-10">
          {modeOptions.map((option, index) => (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              className={`relative group text-left transition-all duration-300 rounded-2xl overflow-hidden ${
                option.featured
                  ? "lg:col-span-1"
                  : ""
              }`}
            >
              {/* Background */}
              <div className={`absolute inset-0 ${
                option.featured
                  ? `bg-gradient-to-br ${option.gradient} opacity-20`
                  : "bg-white/[0.03]"
              }`} />
              
              {/* Border glow for selected */}
              <div className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
                mode === option.id
                  ? "ring-2 ring-solana-purple shadow-glow"
                  : "ring-1 ring-white/10 group-hover:ring-white/20"
              }`} />
              
              {/* Content */}
              <div className="relative p-4 sm:p-6">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-all duration-300 ${
                  option.featured
                    ? "bg-gradient-to-br from-solana-purple to-solana-green"
                    : mode === option.id
                    ? "bg-solana-purple/20"
                    : "bg-white/5 group-hover:bg-white/10"
                }`}>
                  <option.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${
                    option.featured || mode === option.id
                      ? "text-white"
                      : "text-neutral-400 group-hover:text-white"
                  }`} />
                </div>
                
                <h3 className="text-base sm:text-xl font-bold mb-1 sm:mb-2 text-white">{option.title}</h3>
                <p className={`text-xs sm:text-sm ${
                  option.featured ? "text-neutral-300" : "text-neutral-500"
                } line-clamp-2`}>
                  {option.description}
                </p>

                {option.featured && (
                  <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-solana-green bg-solana-green/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full">
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-solana-green animate-pulse" />
                    Recommended
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <motion.button
            type="button"
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-xl transition-all border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </motion.button>

          <motion.button
            type="button"
            disabled={!mode}
            onClick={() => router.push(gameHref)}
            whileHover={mode ? { scale: 1.02 } : {}}
            whileTap={mode ? { scale: 0.98 } : {}}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 text-base font-bold rounded-xl transition-all ${
              mode
                ? "btn-glow text-white shadow-glow"
                : "bg-white/5 text-neutral-600 cursor-not-allowed border border-white/5"
            }`}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
}
