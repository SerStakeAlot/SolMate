"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Trophy } from "lucide-react";
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
      // For Finished matches, use confirmPayout (forceRefund requires Active status)
      else if (match.account.status === MatchStatus.Finished) {
        // If the match has a winner on-chain, try confirmPayout
        if (match.account.winner) {
          // Check if the current user is the on-chain winner
          const userIsOnChainWinner = match.account.winner.equals(publicKey);
          if (userIsOnChainWinner || match.isBackendWinner) {
            signature = await client.confirmPayout(
              match.pubkey,
              match.account.winner,
              match.account.playerA
            );
            setResult({
              success: true,
              message: `🎉 Winnings claimed! Signature: ${signature.slice(0, 8)}...`,
            });
          } else {
            throw new Error("This match has ended and the winner has been declared on-chain. Only the winner can claim the pot.");
          }
        } else {
          throw new Error("Match is finished but no winner was recorded on-chain. Please contact support.");
        }
      } else {
        if (!match.account.playerB) {
          throw new Error("No Player B - cannot abandon match");
        }
        try {
          signature = await client.abandonMatch(
            match.pubkey,
            match.account.playerA,
            match.account.playerB
          );
        } catch (abandonErr: any) {
          const errMsg = abandonErr?.message || String(abandonErr);
          // If abandonMatch fails due to time gate, fall back to forceRefund (both require Active)
          if (errMsg.includes('MatchLockedIn')) {
            console.log('abandonMatch time-gated, trying forceRefund...');
            signature = await client.forceRefund(
              match.pubkey,
              match.account.playerA,
              match.account.playerB!
            );
          } else {
            throw abandonErr;
          }
        }
        
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

  // Particle field for background
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 4,
  }));

  return (
    <main style={{
      minHeight: '100vh',
      background: '#07070e',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed',
        top: '-200px',
        right: '-200px',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'rgba(0,255,163,0.04)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Particle field */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.03, 0.08, 0.03],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px',
        position: 'relative',
        zIndex: 1,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <header style={{ marginBottom: '40px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#6b6b80',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                marginBottom: '20px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6b80')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <h1 style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800,
              marginBottom: '8px',
              color: '#fff',
              fontFamily: "'Outfit', sans-serif",
            }}>
              Claim{' '}
              <span style={{
                background: 'linear-gradient(135deg, #00ffa3, #00d4ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Funds</span>
            </h1>
            <p style={{ fontSize: '15px', color: '#6b6b80', margin: 0 }}>
              Claim winnings from won matches or recover funds from stuck matches
            </p>
          </header>

          {/* Wallet Connection */}
          {!connected ? (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
              padding: '48px 32px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(153,69,255,0.08)',
                border: '1px solid rgba(153,69,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '28px',
              }}>
                💰
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                Connect Your Wallet
              </h2>
              <p style={{ fontSize: '14px', color: '#6b6b80', marginBottom: '24px' }}>
                Connect your wallet to check for refundable matches
              </p>
              <WalletButton />
            </div>
          ) : (
            <>
              {/* Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
              }}>
                <p style={{ fontSize: '13px', color: '#6b6b80', margin: 0 }}>
                  Connected:{' '}
                  <span style={{ fontFamily: "'Space Mono', monospace", color: '#e8e8f0', fontSize: '13px' }}>
                    {publicKey?.toBase58().slice(0, 8)}...
                  </span>
                </p>
                <button
                  onClick={loadMatches}
                  disabled={loading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#6b6b80',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e8e8f0'; }}}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#6b6b80'; }}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Result Message */}
              {result && (
                <div style={{
                  marginBottom: '24px',
                  padding: '14px 20px',
                  borderRadius: '14px',
                  background: result.success ? 'rgba(34,197,94,0.06)' : 'rgba(255,80,80,0.06)',
                  border: result.success ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,80,80,0.2)',
                  color: result.success ? '#22c55e' : '#ff5050',
                  fontSize: '14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{result.success ? '✓' : '✕'}</span>
                    <span>{result.message}</span>
                  </div>
                </div>
              )}

              {/* Matches List */}
              {loading ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                  padding: '48px 32px',
                  textAlign: 'center',
                }}>
                  <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" style={{ color: '#9945ff' }} />
                  <p style={{ color: '#6b6b80', fontSize: '14px', margin: 0 }}>Searching for refundable matches...</p>
                </div>
              ) : matches.length === 0 ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                  padding: '48px 32px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    fontSize: '28px',
                  }}>
                    ✅
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                    No Funds to Claim
                  </h2>
                  <p style={{ fontSize: '14px', color: '#6b6b80', margin: 0 }}>
                    You don&apos;t have any unclaimed winnings or stuck matches.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {matches.map((match) => {
                    const tierInfo = getStakeTierInfo(match.account.stakeTier);
                    const isAbandoning = abandoningMatch === match.pubkey.toBase58();
                    const potAmount = tierInfo.stake * 2; // Both players' stakes
                    const isWinnerMatch = match.isWinner || match.isBackendWinner;
                    const isLoserMatch = match.isBackendLoser;

                    return (
                      <motion.div
                        key={match.pubkey.toBase58()}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          background: isWinnerMatch
                            ? 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(34,197,94,0.01))'
                            : 'rgba(255,255,255,0.02)',
                          border: isWinnerMatch
                            ? '1px solid rgba(34,197,94,0.25)'
                            : isLoserMatch
                            ? '1px solid rgba(255,80,80,0.15)'
                            : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '16px',
                          padding: '20px 24px',
                          opacity: isLoserMatch ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                              {isWinnerMatch && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  fontFamily: "'Space Mono', monospace",
                                  background: 'rgba(34,197,94,0.1)',
                                  border: '1px solid rgba(34,197,94,0.2)',
                                  color: '#22c55e',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <Trophy className="w-3 h-3" />
                                  Winner - Claim Your Prize!
                                </span>
                              )}
                              {match.isBackendWinner && !match.isWinner && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  fontFamily: "'Space Mono', monospace",
                                  background: 'rgba(234,179,8,0.1)',
                                  border: '1px solid rgba(234,179,8,0.2)',
                                  color: '#eab308',
                                }}>
                                  (Pending on-chain)
                                </span>
                              )}
                              {isLoserMatch && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  fontFamily: "'Space Mono', monospace",
                                  background: 'rgba(255,80,80,0.1)',
                                  border: '1px solid rgba(255,80,80,0.2)',
                                  color: '#ff5050',
                                }}>
                                  You Lost - No Refund
                                </span>
                              )}
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: "'Space Mono', monospace",
                                background: match.isPlayerA ? 'rgba(0,212,255,0.1)' : 'rgba(153,69,255,0.1)',
                                border: match.isPlayerA ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(153,69,255,0.2)',
                                color: match.isPlayerA ? '#00d4ff' : '#9945ff',
                              }}>
                                {match.isPlayerA ? "Player A" : "Player B"}
                              </span>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: "'Space Mono', monospace",
                                ...(match.account.status === MatchStatus.Open
                                  ? { background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }
                                  : match.account.status === MatchStatus.Finished
                                  ? { background: 'rgba(255,80,80,0.08)', color: '#ff5050' }
                                  : { background: 'rgba(234,179,8,0.08)', color: '#eab308' }),
                              }}>
                                {match.account.status === MatchStatus.Open 
                                  ? "Open (No Opponent)" 
                                  : match.account.status === MatchStatus.Finished 
                                  ? "Payout Failed" 
                                  : "Active (Stuck)"}
                              </span>
                            </div>
                            <p style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: '13px',
                              color: '#6b6b80',
                              marginBottom: '6px',
                            }}>
                              Match: {match.pubkey.toBase58().slice(0, 12)}...
                            </p>
                            <p style={{ fontSize: '14px', color: '#6b6b80', margin: 0 }}>
                              Stake:{' '}
                              <span style={{ color: '#e8e8f0', fontWeight: 700 }}>{tierInfo.label}</span>
                              <span style={{ color: '#3a3a4a', margin: '0 8px' }}>•</span>
                              {isWinnerMatch ? (
                                <>Prize:{' '}
                                  <span style={{
                                    color: '#22c55e',
                                    fontWeight: 800,
                                    fontFamily: "'Space Mono', monospace",
                                  }}>{potAmount.toFixed(2)} SOL</span>
                                </>
                              ) : isLoserMatch ? (
                                <>Lost:{' '}
                                  <span style={{
                                    color: '#ff5050',
                                    fontWeight: 700,
                                    fontFamily: "'Space Mono', monospace",
                                  }}>-{tierInfo.stake} SOL</span>
                                </>
                              ) : (
                                <>Your refund:{' '}
                                  <span style={{ color: '#e8e8f0', fontWeight: 700 }}>{tierInfo.label}</span>
                                </>
                              )}
                            </p>
                          </div>
                          {/* Hide button for losers, show for winners and stuck matches */}
                          {!isLoserMatch && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleAbandonMatch(match)}
                                disabled={isAbandoning}
                                style={{
                                  padding: '10px 24px',
                                  borderRadius: '12px',
                                  border: 'none',
                                  fontWeight: isWinnerMatch ? 800 : 700,
                                  fontSize: '13px',
                                  color: '#07070e',
                                  cursor: isAbandoning ? 'not-allowed' : 'pointer',
                                  opacity: isAbandoning ? 0.6 : 1,
                                  transition: 'all 0.2s',
                                  fontFamily: "'Outfit', sans-serif",
                                  ...(isWinnerMatch
                                    ? {
                                        background: 'linear-gradient(135deg, #22c55e, #10b981)',
                                        boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
                                      }
                                    : {
                                        background: 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)',
                                      }),
                                }}
                                onMouseEnter={(e) => {
                                  if (!isAbandoning) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.filter = 'brightness(1.1)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.filter = 'brightness(1)';
                                }}
                              >
                                {isAbandoning ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Processing...
                                  </span>
                                ) : isWinnerMatch
                                  ? "🎉 Claim Winnings" 
                                  : match.account.status === MatchStatus.Open 
                                    ? "Cancel & Refund" 
                                    : "Claim Refund"}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* How it works Info Card */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '20px 24px',
                marginTop: '32px',
              }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#e8e8f0',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span>⚠️</span> How it works
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '8px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, marginTop: '6px' }}></span>
                    <span style={{ fontSize: '13px', color: '#6b6b80' }}>
                      <strong style={{ color: '#22c55e' }}>Won matches:</strong> Claim your winnings if the auto-payout failed
                    </span>
                  </div>
                  <div style={{ padding: '8px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff5050', flexShrink: 0, marginTop: '6px' }}></span>
                    <span style={{ fontSize: '13px', color: '#6b6b80' }}>
                      <strong style={{ color: '#ff5050' }}>Lost matches:</strong> No refund — the winner claims the pot
                    </span>
                  </div>
                  <div style={{ padding: '8px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff', flexShrink: 0, marginTop: '6px' }}></span>
                    <span style={{ fontSize: '13px', color: '#6b6b80' }}>
                      <strong style={{ color: '#00d4ff' }}>Open matches:</strong> No one joined — you get your full stake back
                    </span>
                  </div>
                  <div style={{ padding: '8px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#eab308', flexShrink: 0, marginTop: '6px' }}></span>
                    <span style={{ fontSize: '13px', color: '#6b6b80' }}>
                      <strong style={{ color: '#eab308' }}>Stuck matches:</strong> Either player can abandon and both get refunds
                    </span>
                  </div>
                  <div style={{ padding: '8px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9945ff', flexShrink: 0, marginTop: '6px' }}></span>
                    <span style={{ fontSize: '13px', color: '#6b6b80' }}>
                      <strong style={{ color: '#9945ff' }}>Failed payouts:</strong> Force refund returns stakes to both players
                    </span>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    <span style={{ fontSize: '13px', color: '#6b6b80', paddingLeft: '14px' }}>
                      The match account is closed and rent returned to you
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}
