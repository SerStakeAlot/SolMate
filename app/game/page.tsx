"use client";

import { ChessGame } from "@/components/ChessGame";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { io, Socket } from "socket.io-client";

import {
  EscrowClient,
  STAKE_TIERS,
  getStakeTierInfo,
} from "@/utils/escrow";

type PlayMode = "join" | "host" | "computer" | "spectate";

type ChessMode = "practice" | "wager";

const normalizeMode = (value: string | null): PlayMode | null => {
  if (value === "join" || value === "host" || value === "computer" || value === "spectate") return value;
  return null;
};

const BACKEND_URL_HOST = 'https://solmate-production.up.railway.app';

// ─── TIER VISUAL CONFIG ───
const TIER_VISUALS: Record<number, { color: string; bg: string; border: string; glow: string }> = {
  4: { color: "#00d4ff", bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.25)", glow: "rgba(0,212,255,0.15)" },
  2: { color: "#00ffa3", bg: "rgba(0,255,163,0.08)", border: "rgba(0,255,163,0.25)", glow: "rgba(0,255,163,0.15)" },
  5: { color: "#00ffa3", bg: "rgba(0,255,163,0.08)", border: "rgba(0,255,163,0.25)", glow: "rgba(0,255,163,0.15)" },
  0: { color: "#9945ff", bg: "rgba(153,69,255,0.08)", border: "rgba(153,69,255,0.25)", glow: "rgba(153,69,255,0.15)" },
  1: { color: "#ff6b6b", bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.25)", glow: "rgba(255,107,107,0.15)" },
};

function getTierVisual(tier: number) {
  return TIER_VISUALS[tier] || TIER_VISUALS[4];
}

type HostStep = "select-tier" | "creating" | "waiting" | "ready";

// ─── PARTICLE BACKGROUND ───
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.5 + 0.5,
      o: Math.random() * 0.3 + 0.05,
    }));
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(153, 69, 255, ${p.o})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 255, 163, ${0.04 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    const resize = () => {
      if (!canvas) return;
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playMode = normalizeMode(searchParams.get("mode"));
  const matchParam = searchParams.get("match");
  const codeParam = searchParams.get("code");
  const tierParam = searchParams.get("tier");
  const freePlayCode = searchParams.get("freeplay"); // Join free play via link
  const spectateRoom = searchParams.get("room"); // Spectate wager match by room ID

  // Host setup: if mode=host but no match param, show host setup flow
  const isHostSetup = playMode === "host" && !matchParam;

  const isSpectating = playMode === "spectate" && spectateRoom;
  const initialMode: ChessMode = (playMode === "computer" || freePlayCode) ? "practice" : "wager";
  const stakeTier = tierParam ? parseInt(tierParam, 10) : 4; // Default to test tier

  // ─── HOST SETUP STATE ───
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;

  const [hostStep, setHostStep] = useState<HostStep>("select-tier");
  const [selectedTier, setSelectedTier] = useState<number>(4);
  const [hoveredTier, setHoveredTier] = useState<number | null>(null);
  const [hostMatchPubkey, setHostMatchPubkey] = useState<PublicKey | null>(null);
  const [hostMatchCode, setHostMatchCode] = useState<string>("");
  const [hostTxSignature, setHostTxSignature] = useState<string>("");
  const [hostError, setHostError] = useState<string>("");
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isCancellingMatch, setIsCancellingMatch] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [hostOpponentWallet, setHostOpponentWallet] = useState<string>("");
  const [hostSocket, setHostSocket] = useState<Socket | null>(null);
  const [hostConnected, setHostConnected] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const [hostSelectedColor, setHostSelectedColor] = useState<'w' | 'b'>('w');

  // Refs to access latest state in socket callbacks
  const hostMatchRef = useRef<{ pubkey: PublicKey | null; code: string; tier: number; step: HostStep }>({
    pubkey: null, code: "", tier: 4, step: "select-tier"
  });
  useEffect(() => {
    hostMatchRef.current = { pubkey: hostMatchPubkey, code: hostMatchCode, tier: selectedTier, step: hostStep };
  }, [hostMatchPubkey, hostMatchCode, selectedTier, hostStep]);

  // Animate waiting dots
  useEffect(() => {
    if (hostStep !== "waiting") return;
    const interval = setInterval(() => setDotCount(d => (d + 1) % 4), 500);
    return () => clearInterval(interval);
  }, [hostStep]);

  // Fallback: poll on-chain match state in case WebSocket notification was missed
  useEffect(() => {
    if (hostStep !== "waiting" || !hostMatchPubkey || !connected) return;
    
    const checkOnChain = async () => {
      try {
        const client = new EscrowClient(connection, wallet);
        const matchData = await client.fetchMatch(hostMatchPubkey);
        if (matchData && matchData.playerB) {
          console.log('On-chain poll: opponent joined!', matchData.playerB.toBase58());
          setOpponentJoined(true);
          setHostOpponentWallet(matchData.playerB.toBase58());
          setHostStep("ready");
        }
      } catch (e) {
        // Ignore poll errors
      }
    };

    // Poll every 5 seconds as fallback
    const interval = setInterval(checkOnChain, 5000);
    // Also check immediately
    checkOnChain();
    return () => clearInterval(interval);
  }, [hostStep, hostMatchPubkey, connected, connection, wallet]);

  // Host WebSocket
  useEffect(() => {
    if (!isHostSetup) return;
    const newSocket = io(BACKEND_URL_HOST, { transports: ['websocket', 'polling'] });
    newSocket.on('connect', () => setHostConnected(true));
    newSocket.on('disconnect', () => setHostConnected(false));
    newSocket.on('match:playerJoined', ({ guestWallet }: { guestWallet: string }) => {
      setOpponentJoined(true);
      setHostOpponentWallet(guestWallet);
      setHostStep("ready");
    });
    // After registration completes, re-register the match to update server-side socket ID
    // This handles reconnection scenarios (mobile wallet approval, background tab, etc.)
    newSocket.on('player:registered', () => {
      const { pubkey, code, tier, step } = hostMatchRef.current;
      if (pubkey && (step === "waiting" || step === "ready")) {
        console.log('Re-registering match after socket reconnect:', code);
        newSocket.emit('match:host', {
          matchCode: code,
          matchPubkey: pubkey.toBase58(),
          hostWallet: wallet.publicKey?.toBase58(),
          stakeTier: tier,
        });
      }
    });
    setHostSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [isHostSetup]);

  useEffect(() => {
    if (hostSocket && hostConnected && publicKey) {
      hostSocket.emit('player:register', { walletAddress: publicKey.toString() });
    }
  }, [hostSocket, hostConnected, publicKey]);

  const handleHostCreateMatch = async () => {
    if (!connected || !publicKey) {
      setHostError("Please connect your wallet first");
      return;
    }
    setIsCreatingMatch(true);
    setHostError("");
    setHostStep("creating");
    try {
      const client = new EscrowClient(connection, wallet);
      const balance = await connection.getBalance(publicKey);
      const stakeInfo = getStakeTierInfo(selectedTier);
      const requiredLamports = stakeInfo.lamports + 10000000;
      if (balance < requiredLamports) {
        throw new Error(`Insufficient balance. You have ${(balance / 1e9).toFixed(4)} SOL but need at least ${(requiredLamports / 1e9).toFixed(4)} SOL (stake + fees).`);
      }
      const { signature, matchPubkey: newMatchPubkey } = await client.createMatch(selectedTier, 30);
      const lobbyCode = newMatchPubkey.toBase58().slice(0, 4).toUpperCase();
      setHostTxSignature(signature);
      setHostMatchPubkey(newMatchPubkey);
      setHostMatchCode(lobbyCode);
      setHostStep("waiting");
      try {
        await fetch(`${BACKEND_URL_HOST}/api/matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchCode: lobbyCode,
            matchPubkey: newMatchPubkey.toBase58(),
            hostWallet: publicKey.toBase58(),
            stakeTier: selectedTier,
            joinDeadline: Date.now() + 30 * 60 * 1000,
          }),
        });
      } catch (e) { /* offline mode */ }
      if (hostSocket && hostConnected) {
        hostSocket.emit('match:host', {
          matchCode: lobbyCode,
          matchPubkey: newMatchPubkey.toBase58(),
          hostWallet: publicKey.toBase58(),
          stakeTier: selectedTier,
        });
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes('User rejected') || msg.includes('rejected')) {
        setHostError("Transaction was cancelled");
      } else if (msg.includes('Insufficient') || msg.includes('debit')) {
        setHostError("Insufficient SOL balance.");
      } else if (msg.includes('blockhash') || msg.includes('expired')) {
        setHostError("Transaction expired. Please try again.");
      } else {
        setHostError(`Failed to create match: ${msg}`);
      }
      setHostStep("select-tier");
    } finally {
      setIsCreatingMatch(false);
    }
  };

  const handleHostCancelMatch = async () => {
    if (!connected || !publicKey || !hostMatchPubkey) return;
    setIsCancellingMatch(true);
    try {
      const client = new EscrowClient(connection, wallet);
      await client.cancelMatch(hostMatchPubkey);
      setHostMatchPubkey(null);
      setHostMatchCode("");
      setHostTxSignature("");
      setHostStep("select-tier");
      setOpponentJoined(false);
      setHostOpponentWallet("");
    } catch (err: any) {
      const msg = err.message || String(err);
      if (!msg.includes('User rejected') && !msg.includes('rejected')) {
        setHostError(`Failed to cancel: ${msg}`);
      }
    } finally {
      setIsCancellingMatch(false);
    }
  };

  const getHostShareableLink = () => {
    if (!hostMatchPubkey) return "";
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/game?mode=join&match=${hostMatchPubkey.toBase58()}&code=${hostMatchCode}&tier=${selectedTier}`;
  };

  const handleStartGame = () => {
    if (!hostMatchPubkey) return;
    // Set host's chosen color before navigating
    if (hostSocket && hostMatchCode && hostSelectedColor !== 'w') {
      hostSocket.emit('match:setColor', { matchCode: hostMatchCode, color: hostSelectedColor });
    }
    // Navigate to the game with match params (client-side to preserve wallet state)
    router.push(`/game?mode=host&match=${hostMatchPubkey.toBase58()}&code=${hostMatchCode}&tier=${selectedTier}`);
  };

  // Non-host mode display values
  const title =
    isSpectating
      ? "Spectating Match"
      : freePlayCode
        ? "Free Online Match"
        : playMode === "join"
          ? "Active Match (Black)"
          : playMode === "host"
            ? "Staked Match (White)"
            : "Practice Mode";
  
  const subtitle =
    isSpectating
      ? "Watch the match live"
      : playMode === "computer"
        ? "Train your tactics against the bot. No stakes, no pressure."
        : playMode === "join"
          ? "You are playing as Black"
          : playMode === "host"
            ? "You are playing as White - waiting for opponent"
            : "May the best strategist win";

  const badge =
    playMode === "computer"
      ? "vs AI"
      : isSpectating
        ? "LIVE"
        : freePlayCode
          ? "FREE PLAY"
          : playMode === "host" || playMode === "join"
            ? "STAKED"
            : null;

  // Determine player role for multiplayer
  const playerRole = playMode === "host" ? "host" : playMode === "join" ? "join" : undefined;

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const fadeUp = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  const tierInfo = hostMatchPubkey ? getStakeTierInfo(selectedTier) : getStakeTierInfo(selectedTier);
  const tv = getTierVisual(selectedTier);

  // ─── HOST SETUP FLOW ───
  if (isHostSetup) {
    return (
      <div style={{
        minHeight: "100vh", background: "#07070e", color: "#e8e8f0",
        fontFamily: "'Outfit', 'SF Pro Display', sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <ParticleField />

        <div style={{ position: "absolute", top: "-10%", right: "10%", width: 500, height: 500, background: "radial-gradient(circle, rgba(153,69,255,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: "0", left: "-5%", width: 400, height: 400, background: "radial-gradient(circle, rgba(0,255,163,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <style>{`
          @keyframes glow-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.8); opacity: 0; } }
          @keyframes fade-in-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto",
          padding: "20px 40px 80px",
        }}>
          <div style={{ textAlign: "center", marginBottom: 40, ...fadeUp(0.1) }}>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
              Host a{" "}
              <span style={{ background: "linear-gradient(135deg, #00ffa3, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Match</span>
            </h1>
            <p style={{ fontSize: 15, color: "#6b6b80" }}>
              {hostStep === "select-tier" && "Choose your stake level and create a match on-chain"}
              {hostStep === "creating" && "Creating your match on the Solana blockchain..."}
              {hostStep === "waiting" && "Your match is live — share the link and wait for a challenger"}
              {hostStep === "ready" && "Your opponent has joined — start the game!"}
            </p>
          </div>

          {/* ─── SELECT TIER ─── */}
          {hostStep === "select-tier" && (
            <div style={{ ...fadeUp(0.2) }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 32 }}>
                {STAKE_TIERS.map((tier) => {
                  const v = getTierVisual(tier.tier);
                  const isSelected = selectedTier === tier.tier;
                  const isHovered = hoveredTier === tier.tier;
                  const potWin = (tier.stake * 2 * 0.9).toFixed(2);
                  return (
                    <div
                      key={tier.tier}
                      onClick={() => setSelectedTier(tier.tier)}
                      onMouseEnter={() => setHoveredTier(tier.tier)}
                      onMouseLeave={() => setHoveredTier(null)}
                      style={{
                        position: "relative", padding: "24px 20px", borderRadius: 18,
                        background: isSelected ? v.bg : "rgba(255,255,255,0.015)",
                        border: `1.5px solid ${isSelected ? v.border : isHovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`,
                        cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                        transform: isHovered ? "translateY(-3px)" : "translateY(0)",
                        boxShadow: isSelected ? `0 8px 40px ${v.glow}, 0 0 0 1px ${v.border}` : isHovered ? "0 12px 30px rgba(0,0,0,0.3)" : "none",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: isSelected ? v.color : "transparent", transition: "all 0.3s" }} />
                      {isSelected && (
                        <div style={{
                          position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: "50%",
                          background: v.color, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, color: "#07070e", fontWeight: 800, boxShadow: `0 2px 12px ${v.glow}`,
                        }}>✓</div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 20, color: v.color, filter: `drop-shadow(0 0 6px ${v.glow})` }}>◆</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: v.color }}>{tier.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#6b6b80" }}>
                        Winner pot: <span style={{ color: "#e8e8f0", fontWeight: 600 }}>{potWin} SOL</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>10% platform fee</div>
                    </div>
                  );
                })}
              </div>

              {!connected && (
                <div style={{
                  marginBottom: 20, padding: "14px 20px", borderRadius: 14, fontSize: 13,
                  background: "rgba(255,180,50,0.06)", border: "1px solid rgba(255,180,50,0.15)",
                  color: "#ffb432", display: "flex", alignItems: "center", gap: 10,
                  fontFamily: "'Space Mono', monospace",
                }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>Connect your wallet to create a match
                </div>
              )}

              {hostError && (
                <div style={{
                  marginBottom: 20, padding: "14px 20px", borderRadius: 14, fontSize: 13, color: "#ff5050",
                  background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.12)",
                  fontFamily: "'Space Mono', monospace",
                }}>{hostError}</div>
              )}

              <div style={{
                padding: "20px 24px", borderRadius: 16,
                background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)",
                marginBottom: 24,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: "#6b6b80" }}>Your stake</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: tv.color }}>{tierInfo.label}</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: 13, color: "#6b6b80" }}>Winner receives</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 600, color: "#00ffa3" }}>
                    {(tierInfo.stake * 2 * 0.9).toFixed(2)} SOL
                  </span>
                </div>
                <button
                  onClick={handleHostCreateMatch}
                  disabled={!connected || isCreatingMatch}
                  style={{
                    width: "100%", padding: "16px 32px", borderRadius: 14,
                    background: connected ? "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)" : "rgba(255,255,255,0.04)",
                    color: connected ? "#07070e" : "#444",
                    fontSize: 16, fontWeight: 700, border: "none",
                    fontFamily: "'Outfit', sans-serif", cursor: connected ? "pointer" : "not-allowed",
                    boxShadow: connected ? "0 6px 30px rgba(0,255,163,0.2)" : "none",
                    transition: "all 0.25s", opacity: isCreatingMatch ? 0.6 : 1,
                  }}
                >
                  {isCreatingMatch ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: "2px solid #07070e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                      Creating Match...
                    </span>
                  ) : connected ? `Create Match — ${tierInfo.label}` : "Connect Wallet to Create"}
                </button>
              </div>

              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => window.history.back()}
                  style={{
                    padding: "10px 24px", borderRadius: 12,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#6b6b80", fontSize: 14, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif", cursor: "pointer", transition: "all 0.2s",
                  }}
                >← Back</button>
              </div>
            </div>
          )}

          {/* ─── CREATING ─── */}
          {hostStep === "creating" && (
            <div style={{ textAlign: "center", padding: "60px 20px", ...fadeUp(0.2) }}>
              <div style={{
                width: 64, height: 64, margin: "0 auto 24px",
                border: "3px solid #9945ff", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spin 1s linear infinite",
              }} />
              <p style={{ color: "#e8e8f0", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Creating Match On-Chain</p>
              <p style={{ color: "#6b6b80", fontSize: 14 }}>Confirm the transaction in your wallet...</p>
            </div>
          )}

          {/* ─── WAITING FOR OPPONENT ─── */}
          {hostStep === "waiting" && (
            <div style={{ animation: "fade-in-up 0.5s ease-out" }}>
              <div style={{
                padding: "28px", borderRadius: 20,
                background: "rgba(255,255,255,0.02)", border: `1px solid ${tv.border}`,
                marginBottom: 20, position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${tv.color}, transparent)` }} />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#00ffa3", display: "block", animation: "glow-pulse 2s infinite" }} />
                    <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid rgba(0,255,163,0.3)", animation: "pulse-ring 2s infinite" }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#00ffa3", fontFamily: "'Outfit', sans-serif" }}>
                    Waiting for opponent{".".repeat(dotCount)}
                  </span>
                </div>

                {/* Match Code */}
                <div style={{
                  textAlign: "center", marginBottom: 24, padding: "20px", borderRadius: 16,
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.15em", color: "#6b6b80", marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>Match Code</div>
                  <div style={{
                    fontFamily: "'Space Mono', monospace", fontSize: 42, fontWeight: 700, color: tv.color,
                    letterSpacing: "0.2em", textShadow: `0 0 30px ${tv.glow}`,
                  }}>{hostMatchCode}</div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(hostMatchCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                    style={{
                      marginTop: 10, padding: "6px 16px", borderRadius: 8,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      color: codeCopied ? "#00ffa3" : "#6b6b80", fontSize: 12, fontWeight: 600,
                      fontFamily: "'Space Mono', monospace", cursor: "pointer", transition: "all 0.2s",
                    }}
                  >{codeCopied ? "✓ Copied!" : "Copy Code"}</button>
                </div>

                {/* Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 11, color: "#444", marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>Stake</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: tv.color, fontFamily: "'Space Mono', monospace" }}>◆ {tierInfo.label}</div>
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 11, color: "#444", marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>Winner Pot</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#00ffa3", fontFamily: "'Space Mono', monospace" }}>{(tierInfo.stake * 2 * 0.9).toFixed(2)} SOL</div>
                  </div>
                </div>

                {/* Shareable Link */}
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 8, fontFamily: "'Space Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Shareable Link</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{
                      flex: 1, padding: "10px 14px", borderRadius: 10,
                      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)",
                      fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b80",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{getHostShareableLink()}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(getHostShareableLink()); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                      style={{
                        padding: "10px 20px", borderRadius: 10,
                        background: linkCopied ? "rgba(0,255,163,0.1)" : "linear-gradient(135deg, #00ffa3 0%, #9945ff 100%)",
                        border: linkCopied ? "1px solid rgba(0,255,163,0.25)" : "none",
                        color: linkCopied ? "#00ffa3" : "#07070e", fontSize: 13, fontWeight: 700,
                        fontFamily: "'Outfit', sans-serif", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                      }}
                    >{linkCopied ? "✓ Copied!" : "Copy Link"}</button>
                  </div>
                </div>

                {/* TX info */}
                {hostTxSignature && (
                  <div style={{
                    fontSize: 11, color: "#444", fontFamily: "'Space Mono', monospace",
                    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
                  }}>
                    <span>TX: {hostTxSignature.slice(0, 12)}...{hostTxSignature.slice(-8)}</span>
                    <a href={`https://solscan.io/tx/${hostTxSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" style={{ color: "#9945ff", textDecoration: "none" }}>View on Solscan ↗</a>
                  </div>
                )}

                {/* Cancel */}
                <button
                  onClick={handleHostCancelMatch}
                  disabled={isCancellingMatch}
                  style={{
                    width: "100%", padding: "14px 24px", borderRadius: 14,
                    background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.15)",
                    color: "#ff5050", fontSize: 14, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif", cursor: isCancellingMatch ? "not-allowed" : "pointer",
                    transition: "all 0.2s", opacity: isCancellingMatch ? 0.5 : 1,
                  }}
                >
                  {isCancellingMatch ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ width: 14, height: 14, border: "2px solid #ff5050", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                      Cancelling...
                    </span>
                  ) : "Cancel Match & Refund SOL"}
                </button>
              </div>

              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => router.push("/lobby")}
                  style={{
                    padding: "10px 24px", borderRadius: 12,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#6b6b80", fontSize: 14, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif", cursor: "pointer", transition: "all 0.2s",
                  }}
                >← Back to Lobby</button>
              </div>
            </div>
          )}

          {/* ─── READY — OPPONENT JOINED ─── */}
          {hostStep === "ready" && (
            <div style={{ animation: "fade-in-up 0.5s ease-out" }}>
              <div style={{
                padding: "36px 28px", borderRadius: 20,
                background: "rgba(0,255,163,0.03)", border: "1px solid rgba(0,255,163,0.2)",
                textAlign: "center", marginBottom: 24,
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: "rgba(0,255,163,0.1)", border: "2px solid rgba(0,255,163,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px", fontSize: 32,
                }}>⚔️</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
                  Opponent{" "}
                  <span style={{ background: "linear-gradient(135deg, #00ffa3, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Found!</span>
                </h2>
                <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 24 }}>
                  {hostOpponentWallet ? `${hostOpponentWallet.slice(0, 6)}...${hostOpponentWallet.slice(-4)} has joined your match` : "A challenger has joined your match"}
                </p>

                <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 28 }}>
                  <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#444", marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>Code</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: tv.color, fontFamily: "'Space Mono', monospace" }}>{hostMatchCode}</div>
                  </div>
                  <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#444", marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>Stake</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: tv.color, fontFamily: "'Space Mono', monospace" }}>◆ {tierInfo.label}</div>
                  </div>
                  <div style={{ padding: "12px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#444", marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>Pot</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#00ffa3", fontFamily: "'Space Mono', monospace" }}>{(tierInfo.stake * 2 * 0.9).toFixed(2)}</div>
                  </div>
                </div>

                {/* Color Picker */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
                  marginBottom: 24, padding: "16px 20px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                }}>
                  {/* White side */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "#e8e8f0", border: hostSelectedColor === 'w' ? "2px solid #00ffa3" : "2px solid rgba(255,255,255,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: hostSelectedColor === 'w' ? "0 4px 16px rgba(0,255,163,0.2)" : "0 4px 16px rgba(255,255,255,0.1)",
                    }}>
                      <img src="/pieces/wK.svg" alt="White King" style={{ width: 32, height: 32 }} draggable={false} />
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                      color: hostSelectedColor === 'w' ? '#00ffa3' : '#a0a0b8',
                    }}>
                      {hostSelectedColor === 'w' ? 'You' : hostOpponentWallet ? `${hostOpponentWallet.slice(0, 4)}...` : 'Opponent'}
                    </span>
                  </div>

                  {/* Flip button */}
                  <button
                    onClick={() => {
                      const newColor = hostSelectedColor === 'w' ? 'b' : 'w';
                      setHostSelectedColor(newColor);
                      if (hostSocket && hostMatchCode) {
                        hostSocket.emit('match:setColor', { matchCode: hostMatchCode, color: newColor });
                      }
                    }}
                    style={{
                      padding: "8px 16px", borderRadius: 10,
                      background: "rgba(153,69,255,0.08)",
                      border: "1px solid rgba(153,69,255,0.2)",
                      color: "#9945ff", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.2s",
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >⟳ Flip</button>

                  {/* Black side */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "#1a1a2e", border: hostSelectedColor === 'b' ? "2px solid #00ffa3" : "2px solid rgba(255,255,255,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: hostSelectedColor === 'b' ? "0 4px 16px rgba(0,255,163,0.2)" : "0 4px 16px rgba(0,0,0,0.3)",
                    }}>
                      <img src="/pieces/bK.svg" alt="Black King" style={{ width: 32, height: 32 }} draggable={false} />
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                      color: hostSelectedColor === 'b' ? '#00ffa3' : '#a0a0b8',
                    }}>
                      {hostSelectedColor === 'b' ? 'You' : hostOpponentWallet ? `${hostOpponentWallet.slice(0, 4)}...` : 'Opponent'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleStartGame}
                  style={{
                    width: "100%", padding: "18px 32px", borderRadius: 16,
                    background: "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)",
                    color: "#07070e", fontSize: 18, fontWeight: 800, border: "none",
                    fontFamily: "'Outfit', sans-serif", cursor: "pointer",
                    boxShadow: "0 8px 40px rgba(0,255,163,0.25), 0 0 60px rgba(153,69,255,0.1)",
                    transition: "all 0.25s", letterSpacing: "-0.01em",
                  }}
                >Start Match →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ParticleField />

      {/* Ambient glows */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "-5%",
          width: 500,
          height: 500,
          background:
            "radial-gradient(circle, rgba(153,69,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          right: "-5%",
          width: 400,
          height: 400,
          background:
            "radial-gradient(circle, rgba(0,255,163,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ─── PAGE HEADER ─── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "20px 40px 24px",
          ...fadeUp(0.1),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            <span
              style={{
                background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {title}
            </span>
          </h1>
          {badge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(153,69,255,0.1)",
                border: "1px solid rgba(153,69,255,0.2)",
                color: "#9945ff",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 14,
            color: "#6b6b80",
            fontWeight: 500,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* ─── GAME AREA ─── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 clamp(6px, 2vw, 40px) 60px",
          ...fadeUp(0.2),
        }}
      >
        <ChessGame
          initialMode={initialMode}
          showModeSelector={playMode === "computer" && !freePlayCode && !isSpectating}
          matchPubkey={matchParam || undefined}
          playerRole={playerRole as "host" | "join" | undefined}
          matchCode={codeParam || undefined}
          initialStakeTier={stakeTier}
          freePlayJoinCode={freePlayCode || undefined}
          spectateRoomId={spectateRoom || undefined}
        />
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "40px",
            color: "#6b6b80",
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Loading...
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
