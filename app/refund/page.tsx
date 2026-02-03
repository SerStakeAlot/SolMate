"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Coins, Trophy } from "lucide-react";
import Link from "next/link";

import { WalletButton } from "@/components/WalletButton";
import { EscrowClient, MatchAccount, MatchStatus, getStakeTierInfo } from "@/utils/escrow";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

interface MatchWithPubkey {
  pubkey: PublicKey;
  account: MatchAccount;
  isPlayerA: boolean;
  isWinner: boolean;           // On-chain winner
  isBackendWinner: boolean;    // Backend says this user won (even if not recorded on-chain yet)
  isBackendLoser: boolean;     // Backend says someone ELSE won (this user lost)
}

export default function RefundPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;

  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchWithPubkey[]>([]);
  const [abandoningMatch, setAbandoningMatch] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load matches where the user is involved
  const loadMatches = async () => {
    if (!connected || !publicKey) return;

    setLoading(true);
    try {
      const client = new EscrowClient(connection, wallet);
      
      // Get all program accounts
      const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      
      const userMatches: MatchWithPubkey[] = [];
      
      for (const { pubkey, account } of accounts) {
        try {
          const matchAccount = await client.fetchMatch(pubkey);
          if (!matchAccount) continue;
          
          const isPlayerA = matchAccount.playerA.equals(publicKey);
          const isPlayerB = matchAccount.playerB?.equals(publicKey) || false;
          
          // Check escrow balance to see if funds are stuck
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('escrow'), pubkey.toBytes()],
            PROGRAM_ID
          );
          const escrowBalance = await connection.getBalance(escrowPda);
          
          // Show matches where user is involved AND escrow has funds
          // This includes Open (no one joined yet), Active (stuck) or Finished (payout failed)
          if ((isPlayerA || isPlayerB) && escrowBalance > 0) {
            // Check if current user is the winner on-chain
            const isWinner = matchAccount.winner?.equals(publicKey) || false;
            
            // Also check backend for winner (in case submit_result failed)
            let isBackendWinner = false;
            let isBackendLoser = false;
            try {
              const res = await fetch(`${BACKEND_URL}/api/match-winner/${pubkey.toBase58()}`);
              const data = await res.json();
              if (data.found && data.winnerWallet) {
                if (data.winnerWallet === publicKey.toBase58()) {
                  isBackendWinner = true;
                } else {
                  // Someone else won - this user is the loser
                  isBackendLoser = true;
                }
              }
            } catch (e) {
              // Backend unavailable, just use on-chain data
            }
            
            userMatches.push({
              pubkey,
              account: matchAccount,
              isPlayerA,
              isWinner,
              isBackendWinner,
              isBackendLoser,
            });
          }
        } catch (e) {
          // Skip invalid accounts
        }
      }
      
      setMatches(userMatches);
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, [connected, publicKey]);

  const handleAbandonMatch = async (match: MatchWithPubkey) => {
    if (!connected || !publicKey) {
      alert("Please connect your wallet");
      return;
    }

    // Block losers from claiming refund - the winner gets the pot
    if (match.isBackendLoser) {
      alert("You lost this match. The winner will claim the winnings.");
      return;
    }

    setAbandoningMatch(match.pubkey.toBase58());
    setResult(null);

    try {
      const client = new EscrowClient(connection, wallet);
      let signature: string;
      
      // If user is the on-chain winner, claim winnings via confirmPayout
      if (match.isWinner && match.account.winner) {
        signature = await client.confirmPayout(
          match.pubkey,
          match.account.winner,
          match.account.playerA
        );
        
        setResult({
          success: true,
          message: `🎉 Winnings claimed! You received the pot. Signature: ${signature.slice(0, 8)}...`,
        });
      }
      // If backend says user is winner but not recorded on-chain, submit result first then claim
      else if (match.isBackendWinner && match.account.status === MatchStatus.Active) {
        // First submit the result to record winner on-chain
        const winnerPubkey = publicKey;
        console.log('Backend says you won - submitting result to chain first...');
        const resultSig = await client.submitResult(match.pubkey, winnerPubkey);
        console.log('Result submitted:', resultSig);
        
        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now claim payout
        signature = await client.confirmPayout(
          match.pubkey,
          winnerPubkey,
          match.account.playerA
        );
        
        setResult({
          success: true,
          message: `🎉 Winnings claimed! Result submitted and payout received. Signature: ${signature.slice(0, 8)}...`,
        });
      }
      // Use cancelMatch for Open matches (no player B joined)
      else if (match.account.status === MatchStatus.Open) {
        signature = await client.cancelMatch(match.pubkey);
        
        setResult({
          success: true,
          message: `Refund claimed! Your stake was returned. Signature: ${signature.slice(0, 8)}...`,
        });
      }
      // Use forceRefund for Finished matches (payout failed), abandonMatch for Active
      else if (match.account.status === MatchStatus.Finished) {
        if (!match.account.playerB) {
          throw new Error("No Player B - cannot force refund");
        }
        signature = await client.forceRefund(
          match.pubkey,
          match.account.playerA,
          match.account.playerB
        );
        
        setResult({
          success: true,
          message: `Refund claimed! Both players received their stake. Signature: ${signature.slice(0, 8)}...`,
        });
      } else {
        if (!match.account.playerB) {
          throw new Error("No Player B - cannot abandon match");
        }
        signature = await client.abandonMatch(
          match.pubkey,
          match.account.playerA,
          match.account.playerB
        );
        
        setResult({
          success: true,
          message: `Refund claimed! Both players received their stake. Signature: ${signature.slice(0, 8)}...`,
        });
      }

      // Refresh the list
      await loadMatches();
    } catch (error: any) {
      console.error("Error claiming refund:", error);
      setResult({
        success: false,
        message: `Failed: ${error.message || error}`,
      });
    } finally {
      setAbandoningMatch(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-2">
            Claim <span className="text-gradient">Funds</span>
          </h1>
          <p className="text-lg text-neutral-400">
            Claim winnings from won matches or recover funds from stuck matches
          </p>
        </header>

        {/* Wallet Connection */}
        {!connected ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Coins className="w-12 h-12 text-solana-purple mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-neutral-400 mb-6">
              Connect your wallet to check for refundable matches
            </p>
            <WalletButton />
          </div>
        ) : (
          <>
            {/* Actions */}
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-neutral-400">
                Connected: <span className="text-white font-mono">{publicKey?.toBase58().slice(0, 8)}...</span>
              </p>
              <button
                onClick={loadMatches}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm text-white border border-white/10"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Result Message */}
            {result && (
              <div
                className={`mb-6 p-4 rounded-xl border ${
                  result.success
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span>{result.message}</span>
                </div>
              </div>
            )}

            {/* Matches List */}
            {loading ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <RefreshCw className="w-8 h-8 text-solana-purple mx-auto mb-4 animate-spin" />
                <p className="text-neutral-400">Searching for refundable matches...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Funds to Claim</h2>
                <p className="text-neutral-400">
                  You don't have any unclaimed winnings or stuck matches.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => {
                  const tierInfo = getStakeTierInfo(match.account.stakeTier);
                  const isAbandoning = abandoningMatch === match.pubkey.toBase58();
                  const potAmount = tierInfo.stake * 2; // Both players' stakes

                  return (
                    <motion.div
                      key={match.pubkey.toBase58()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`glass-card rounded-xl p-6 ${(match.isWinner || match.isBackendWinner) ? 'border-2 border-green-500/50' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {(match.isWinner || match.isBackendWinner) && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                Winner - Claim Your Prize!
                              </span>
                            )}
                            {match.isBackendWinner && !match.isWinner && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                                (Pending on-chain)
                              </span>
                            )}
                            {match.isBackendLoser && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                                You Lost - No Refund
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              match.isPlayerA 
                                ? "bg-blue-500/20 text-blue-400" 
                                : "bg-purple-500/20 text-purple-400"
                            }`}>
                              {match.isPlayerA ? "You created this match" : "You are Player B"}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              match.account.status === MatchStatus.Open
                                ? "bg-blue-500/20 text-blue-400"
                                : match.account.status === MatchStatus.Finished
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                              {match.account.status === MatchStatus.Open 
                                ? "Open (No Opponent)" 
                                : match.account.status === MatchStatus.Finished 
                                ? "Payout Failed" 
                                : "Active (Stuck)"}
                            </span>
                          </div>
                          <p className="font-mono text-sm text-neutral-400 mb-1">
                            Match: {match.pubkey.toBase58().slice(0, 12)}...
                          </p>
                          <p className="text-sm">
                            Stake: <span className="text-white font-semibold">{tierInfo.label}</span>
                            <span className="text-neutral-500 mx-2">•</span>
                            {(match.isWinner || match.isBackendWinner) ? (
                              <>Prize: <span className="text-green-400 font-bold">{potAmount.toFixed(2)} SOL</span></>
                            ) : match.isBackendLoser ? (
                              <>Lost: <span className="text-red-400 font-bold">-{tierInfo.stake} SOL</span></>
                            ) : (
                              <>Your refund: <span className="text-solana-green font-semibold">{tierInfo.label}</span></>
                            )}
                          </p>
                        </div>
                        {/* Hide button for losers, show for winners and stuck matches */}
                        {!match.isBackendLoser && (
                          <button
                            onClick={() => handleAbandonMatch(match)}
                            disabled={isAbandoning}
                            className={`px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              (match.isWinner || match.isBackendWinner) 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/30' 
                                : 'btn-glow'
                            }`}
                          >
                            {isAbandoning 
                              ? "Processing..." 
                              : (match.isWinner || match.isBackendWinner)
                                ? "🎉 Claim Winnings" 
                                : match.account.status === MatchStatus.Open 
                                  ? "Cancel & Refund" 
                                  : "Claim Refund"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Info */}
            <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                How it works
              </h3>
              <ul className="text-sm text-neutral-400 space-y-1">
                <li>• <strong className="text-green-400">Won matches:</strong> Claim your winnings if the auto-payout failed</li>
                <li>• <strong className="text-red-400">Lost matches:</strong> No refund - the winner claims the pot</li>
                <li>• <strong>Open matches:</strong> No one joined - you get your full stake back</li>
                <li>• <strong>Stuck matches:</strong> Either player can abandon and both get refunds</li>
                <li>• <strong>Failed payouts:</strong> Force refund returns stakes to both players</li>
                <li>• The match account is closed and rent returned to you</li>
              </ul>
            </div>
          </>
        )}
      </motion.div>
    </main>
  );
}
