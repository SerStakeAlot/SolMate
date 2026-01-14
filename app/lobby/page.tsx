"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Plus, Clock, User, Coins } from "lucide-react";

import { WalletButton } from "@/components/WalletButton";
import {
  EscrowClient,
  MatchAccount,
  getStakeTierInfo,
  MatchStatus,
} from "@/utils/escrow";

interface MatchWithPubkey {
  pubkey: PublicKey;
  account: MatchAccount;
}

export default function LobbyPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;

  const [matches, setMatches] = useState<MatchWithPubkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [joiningMatch, setJoiningMatch] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadMatches();
    const interval = setInterval(() => {
      loadMatches();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [connected, refreshKey]);

  const loadMatches = async () => {
    try {
      const client = new EscrowClient(connection, wallet);
      const openMatches = await client.fetchAllOpenMatches();
      setMatches(openMatches);
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMatch = async (matchPubkey: PublicKey) => {
    if (!connected || !publicKey) {
      alert("Please connect your wallet");
      return;
    }

    setJoiningMatch(matchPubkey.toString());
    try {
      const client = new EscrowClient(connection, wallet);
      const signature = await client.joinMatch(matchPubkey);

      alert(`Joined match! Redirecting to game...`);
      router.push(`/game?mode=host&match=${matchPubkey.toString()}`);
    } catch (error) {
      console.error("Error joining match:", error);
      alert(`Failed to join match: ${error}`);
    } finally {
      setJoiningMatch(null);
    }
  };

  const getTimeRemaining = (deadline: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;

    if (remaining <= 0) return "Expired";

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const filteredMatches = selectedTier !== null
    ? matches.filter((m) => m.account.stakeTier === selectedTier)
    : matches;

  const isOwnMatch = (match: MatchAccount) => {
    return publicKey && match.playerA.equals(publicKey);
  };

  const tierOptions = [
    { value: null, label: "All" },
    { value: 0, label: "0.5 SOL" },
    { value: 1, label: "1 SOL" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              Match <span className="text-gradient">Lobby</span>
            </h1>
            <p className="text-lg text-neutral-400">
              Join an open match or create your own
            </p>
          </div>
        </header>

        {/* Navigation & Actions */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => router.push("/play")}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to modes
          </button>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group"
          >
            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Refresh
          </button>
        </div>

        {/* Main Content */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Tier Filter */}
          <div className="p-6 border-b border-white/5">
            <h3 className="text-sm font-medium text-neutral-400 mb-4">Filter by Stake</h3>
            <div className="flex flex-wrap gap-2">
              {tierOptions.map((tier) => (
                <button
                  key={tier.label}
                  onClick={() => setSelectedTier(tier.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedTier === tier.value
                      ? "bg-gradient-to-r from-solana-purple to-solana-green text-white shadow-glow-sm"
                      : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matches List */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Open Matches
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  ({filteredMatches.length})
                </span>
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-solana-purple border-t-transparent"></div>
                <p className="mt-4 text-neutral-400">Loading matches...</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Plus className="w-8 h-8 text-neutral-600" />
                </div>
                <p className="text-neutral-400 mb-6">No open matches found</p>
                <button
                  onClick={() => router.push("/play")}
                  className="btn-glow inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-bold text-white"
                >
                  Create a Match
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMatches.map((match, index) => {
                  const tierInfo = getStakeTierInfo(match.account.stakeTier);
                  const deadline = match.account.joinDeadline.toNumber();
                  const timeLeft = getTimeRemaining(deadline);
                  const isExpired = timeLeft === "Expired";
                  const isOwn = isOwnMatch(match.account);
                  const isJoining = joiningMatch === match.pubkey.toString();

                  return (
                    <motion.div
                      key={match.pubkey.toString()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-solana-purple/20 to-solana-green/20 text-white border border-solana-purple/30">
                              <Coins className="w-3 h-3" />
                              {tierInfo.label}
                            </span>
                            {isOwn && (
                              <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Your Match
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
                                isExpired
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {isExpired ? "Expired" : timeLeft}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 text-neutral-400">
                              <User className="w-4 h-4" />
                              <span className="font-mono">
                                {match.account.playerA.toString().slice(0, 4)}...
                                {match.account.playerA.toString().slice(-4)}
                              </span>
                            </div>
                            <span className="text-neutral-600">•</span>
                            <span className="text-neutral-500 font-mono text-xs">
                              {match.pubkey.toString().slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {!connected ? (
                            <button
                              disabled
                              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-neutral-500 cursor-not-allowed"
                            >
                              Connect Wallet
                            </button>
                          ) : isOwn ? (
                            <button
                              disabled
                              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-neutral-500 cursor-not-allowed"
                            >
                              Your Match
                            </button>
                          ) : isExpired ? (
                            <button
                              disabled
                              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-neutral-500 cursor-not-allowed"
                            >
                              Expired
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinMatch(match.pubkey)}
                              disabled={isJoining}
                              className="btn-glow px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isJoining ? "Joining..." : "Join Match"}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
