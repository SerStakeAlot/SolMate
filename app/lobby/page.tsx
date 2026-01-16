"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, Plus, Clock, User, Coins, Search, Wifi, WifiOff } from "lucide-react";
import { io, Socket } from "socket.io-client";

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

interface HostedMatch {
  matchCode: string;
  matchPubkey: string;
  hostWallet: string;
  stakeTier: number;
  createdAt: number;
  joinDeadline: number;
}

const BACKEND_URL = 'https://solmate-production.up.railway.app';

export default function LobbyPage() {
  const router = useRouter();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;

  // On-chain matches
  const [matches, setMatches] = useState<MatchWithPubkey[]>([]);
  // WebSocket hosted matches
  const [hostedMatches, setHostedMatches] = useState<HostedMatch[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [joiningMatch, setJoiningMatch] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Search by match code
  const [searchCode, setSearchCode] = useState("");
  const [searchResult, setSearchResult] = useState<HostedMatch | null>(null);
  const [searchError, setSearchError] = useState("");
  
  // WebSocket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to lobby server');
      setIsConnected(true);
      
      // Subscribe to lobby updates immediately
      newSocket.emit('lobby:subscribe');
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from lobby server');
      setIsConnected(false);
    });

    // Lobby events
    newSocket.on('lobby:matches', ({ matches }) => {
      setHostedMatches(matches);
      setLoading(false);
    });

    newSocket.on('lobby:newMatch', (match: HostedMatch) => {
      setHostedMatches(prev => [match, ...prev]);
    });

    newSocket.on('lobby:matchRemoved', ({ matchCode }) => {
      setHostedMatches(prev => prev.filter(m => m.matchCode !== matchCode));
    });

    // Search result
    newSocket.on('match:found', (match: HostedMatch) => {
      setSearchResult(match);
      setSearchError("");
    });

    newSocket.on('match:notFound', ({ matchCode }) => {
      setSearchResult(null);
      setSearchError(`No match found with code: ${matchCode}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('lobby:unsubscribe');
      newSocket.disconnect();
    };
  }, []);
  
  // Register player when wallet connects
  useEffect(() => {
    if (socket && isConnected && publicKey) {
      console.log('Registering player with wallet:', publicKey.toString());
      socket.emit('player:register', { walletAddress: publicKey.toString() });
    }
  }, [socket, isConnected, publicKey]);

  // Load on-chain matches for fallback
  useEffect(() => {
    loadOnChainMatches();
    const interval = setInterval(() => {
      loadOnChainMatches();
    }, 30000); // Refresh on-chain matches every 30 seconds
    return () => clearInterval(interval);
  }, [connected, refreshKey]);

  const loadOnChainMatches = async () => {
    try {
      const client = new EscrowClient(connection, wallet);
      const openMatches = await client.fetchAllOpenMatches();
      setMatches(openMatches);
    } catch (error) {
      console.error("Error loading on-chain matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchCode || searchCode.length !== 4) {
      setSearchError("Please enter a 4-letter match code");
      return;
    }
    
    if (socket && isConnected) {
      socket.emit('match:search', { matchCode: searchCode.toUpperCase() });
    } else {
      setSearchError("Not connected to server");
    }
  };

  const handleJoinHostedMatch = async (match: HostedMatch) => {
    if (!connected || !publicKey) {
      alert("Please connect your wallet");
      return;
    }

    setJoiningMatch(match.matchCode);
    try {
      // First join on-chain
      console.log('Joining match on-chain...', match.matchPubkey);
      const matchPubkey = new PublicKey(match.matchPubkey);
      const client = new EscrowClient(connection, wallet);
      const signature = await client.joinMatch(matchPubkey);
      
      console.log('Successfully joined match on-chain! Signature:', signature);

      // Redirect to game as joiner (black)
      // The ChessGame component will emit match:join to WebSocket
      router.push(`/game?mode=join&match=${match.matchPubkey}&code=${match.matchCode}&tier=${match.stakeTier}`);
    } catch (error) {
      console.error("Error joining match on-chain:", error);
      alert(`Failed to join match: ${error}`);
    } finally {
      setJoiningMatch(null);
    }
  };

  const handleJoinMatch = async (matchPubkey: PublicKey, stakeTier: number) => {
    if (!connected || !publicKey) {
      alert("Please connect your wallet");
      return;
    }

    setJoiningMatch(matchPubkey.toString());
    try {
      const client = new EscrowClient(connection, wallet);
      const signature = await client.joinMatch(matchPubkey);
      const code = matchPubkey.toString().slice(0, 4).toUpperCase();

      alert(`Joined match! Redirecting to game...`);
      router.push(`/game?mode=join&match=${matchPubkey.toString()}&code=${code}&tier=${stakeTier}`);
    } catch (error) {
      console.error("Error joining match:", error);
      alert(`Failed to join match: ${error}`);
    } finally {
      setJoiningMatch(null);
    }
  };

  const getTimeRemaining = (deadline: number, isTimestamp: boolean = false): string => {
    const now = isTimestamp ? Date.now() : Math.floor(Date.now() / 1000);
    const deadlineValue = isTimestamp ? deadline : deadline;
    const remaining = isTimestamp 
      ? Math.floor((deadline - now) / 1000) 
      : deadline - now;

    if (remaining <= 0) return "Expired";

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Filter matches by tier
  const filteredHostedMatches = selectedTier !== null
    ? hostedMatches.filter((m) => m.stakeTier === selectedTier)
    : hostedMatches;

  const filteredOnChainMatches = selectedTier !== null
    ? matches.filter((m) => m.account.stakeTier === selectedTier)
    : matches;

  const isOwnMatch = (hostWallet: string): boolean => {
    return !!publicKey && hostWallet === publicKey.toString();
  };

  const isOwnOnChainMatch = (match: MatchAccount) => {
    return publicKey && match.playerA.equals(publicKey);
  };

  const tierOptions = [
    { value: null, label: "All" },
    { value: 0, label: "0.5 SOL" },
    { value: 1, label: "1 SOL" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-3 sm:px-6 py-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <header className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">
              Match <span className="text-gradient">Lobby</span>
            </h1>
            <p className="text-sm sm:text-lg text-neutral-400">
              Join an open match or create your own
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-3 h-3" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
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

        {/* Search by Match Code */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-neutral-400 mb-4">Search by Match Code</h3>
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                value={searchCode}
                onChange={(e) => {
                  setSearchCode(e.target.value.toUpperCase().slice(0, 4));
                  setSearchError("");
                  setSearchResult(null);
                }}
                placeholder="ABCD"
                maxLength={4}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 focus:outline-none focus:border-solana-purple/50 focus:ring-2 focus:ring-solana-purple/20 font-mono text-lg tracking-widest text-center uppercase"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searchCode.length !== 4}
              className="btn-glow px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
          
          {/* Search Error */}
          {searchError && (
            <p className="mt-3 text-sm text-red-400">{searchError}</p>
          )}
          
          {/* Search Result */}
          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 rounded-xl border border-solana-purple/30 bg-solana-purple/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-lg text-white">{searchResult.matchCode}</span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-solana-purple/30 to-solana-green/30 text-white">
                        {searchResult.stakeTier === 0 ? "0.5 SOL" : "1 SOL"}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400">
                      Host: {searchResult.hostWallet.slice(0, 4)}...{searchResult.hostWallet.slice(-4)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinHostedMatch(searchResult)}
                    disabled={joiningMatch === searchResult.matchCode || isOwnMatch(searchResult.hostWallet)}
                    className="btn-glow px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {joiningMatch === searchResult.matchCode ? "Joining..." : "Join Match"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

          {/* Live Hosted Matches */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                Live Matches
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  ({filteredHostedMatches.length})
                </span>
              </h3>
            </div>

            {filteredHostedMatches.length === 0 ? (
              <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-white/5">
                <p className="text-neutral-400">No live matches available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHostedMatches.map((match, index) => {
                  const timeLeft = getTimeRemaining(match.joinDeadline, true);
                  const isExpired = timeLeft === "Expired";
                  const isOwn = isOwnMatch(match.hostWallet);
                  const isJoining = joiningMatch === match.matchCode;

                  return (
                    <motion.div
                      key={match.matchCode}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="font-mono text-xl font-bold text-white bg-gradient-to-r from-solana-purple/20 to-solana-green/20 px-3 py-1 rounded-lg border border-solana-purple/30">
                              {match.matchCode}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-solana-purple/20 to-solana-green/20 text-white border border-solana-purple/30">
                              <Coins className="w-3 h-3" />
                              {match.stakeTier === 0 ? "0.5 SOL" : "1 SOL"}
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
                                {match.hostWallet.slice(0, 4)}...
                                {match.hostWallet.slice(-4)}
                              </span>
                            </div>
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
                              onClick={() => handleJoinHostedMatch(match)}
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

          {/* On-Chain Matches (Fallback) */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                On-Chain Matches
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  ({filteredOnChainMatches.length})
                </span>
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-solana-purple border-t-transparent"></div>
                <p className="mt-4 text-neutral-400">Loading matches...</p>
              </div>
            ) : filteredOnChainMatches.length === 0 ? (
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
                {filteredOnChainMatches.map((match, index) => {
                  const tierInfo = getStakeTierInfo(match.account.stakeTier);
                  const deadline = match.account.joinDeadline.toNumber();
                  const timeLeft = getTimeRemaining(deadline);
                  const isExpired = timeLeft === "Expired";
                  const isOwn = isOwnOnChainMatch(match.account);
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
                              onClick={() => handleJoinMatch(match.pubkey, match.account.stakeTier)}
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
