"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Coins } from "lucide-react";
import Link from "next/link";

import { WalletButton } from "@/components/WalletButton";
import { EscrowClient, MatchAccount, MatchStatus, getStakeTierInfo } from "@/utils/escrow";

interface MatchWithPubkey {
  pubkey: PublicKey;
  account: MatchAccount;
  isPlayerA: boolean;
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
          // This includes Active (stuck) or Finished (payout failed)
          if ((isPlayerA || isPlayerB) && escrowBalance > 0) {
            userMatches.push({
              pubkey,
              account: matchAccount,
              isPlayerA,
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

    if (!match.account.playerB) {
      alert("This match has no Player B - use Cancel Match instead");
      return;
    }

    setAbandoningMatch(match.pubkey.toBase58());
    setResult(null);

    try {
      const client = new EscrowClient(connection, wallet);
      let signature: string;
      
      // Use forceRefund for Finished matches (payout failed), abandonMatch for Active
      if (match.account.status === MatchStatus.Finished) {
        signature = await client.forceRefund(
          match.pubkey,
          match.account.playerA,
          match.account.playerB
        );
      } else {
        signature = await client.abandonMatch(
          match.pubkey,
          match.account.playerA,
          match.account.playerB
        );
      }

      setResult({
        success: true,
        message: `Refund claimed! Both players received their stake. Signature: ${signature.slice(0, 8)}...`,
      });

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
            Claim <span className="text-gradient">Refund</span>
          </h1>
          <p className="text-lg text-neutral-400">
            Recover funds from abandoned or stuck matches
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
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
                <h2 className="text-xl font-semibold mb-2">No Refunds Available</h2>
                <p className="text-neutral-400">
                  You don't have any stuck or abandoned matches to claim.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => {
                  const tierInfo = getStakeTierInfo(match.account.stakeTier);
                  const isAbandoning = abandoningMatch === match.pubkey.toBase58();

                  return (
                    <motion.div
                      key={match.pubkey.toBase58()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card rounded-xl p-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              match.isPlayerA 
                                ? "bg-blue-500/20 text-blue-400" 
                                : "bg-purple-500/20 text-purple-400"
                            }`}>
                              {match.isPlayerA ? "You are Player A" : "You are Player B"}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              match.account.status === MatchStatus.Finished
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                              {match.account.status === MatchStatus.Finished ? "Payout Failed" : "Active (Stuck)"}
                            </span>
                          </div>
                          <p className="font-mono text-sm text-neutral-400 mb-1">
                            Match: {match.pubkey.toBase58().slice(0, 12)}...
                          </p>
                          <p className="text-sm">
                            Stake: <span className="text-white font-semibold">{tierInfo.label}</span>
                            <span className="text-neutral-500 mx-2">•</span>
                            Your refund: <span className="text-solana-green font-semibold">{tierInfo.label}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleAbandonMatch(match)}
                          disabled={isAbandoning}
                          className="btn-glow px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAbandoning ? "Processing..." : "Claim Refund"}
                        </button>
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
                <li>• Either player can abandon a stuck match</li>
                <li>• Both players receive their original stake back</li>
                <li>• The match account is closed and rent returned to Player A</li>
                <li>• This is for matches where the game was never played</li>
              </ul>
            </div>
          </>
        )}
      </motion.div>
    </main>
  );
}
