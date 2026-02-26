"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";



import {
  EscrowClient,
  MatchAccount,
  getStakeTierInfo,
  MatchStatus,
} from "@/utils/escrow";
import {
  TokenEscrowClient,
  WagerCurrency,
  getTokenStakeTierInfo,
  getMintForCurrency,
} from "@/utils/tokenEscrow";
import {
  getUsernames,
  getPlayerStats,
  formatDisplayName,
  PlayerStats,
} from "@/utils/username";

// ─── TYPES ───
interface MatchWithPubkey {
  pubkey: PublicKey;
  account: MatchAccount;
}

interface HostedMatch {
  matchCode: string;
  matchPubkey: string;
  hostWallet: string;
  stakeTier: number;
  currency?: WagerCurrency;
  createdAt: number;
  joinDeadline: number;
}

// ─── TIER COLOR MAP ───
const TIER_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  4:  { bg: "rgba(0,212,255,0.08)",   border: "rgba(0,212,255,0.2)",   text: "#00d4ff" },   // 0.05 SOL = cyan
  5:  { bg: "rgba(0,255,163,0.08)",   border: "rgba(0,255,163,0.2)",   text: "#00ffa3" },   // 0.1 SOL  = green
  2:  { bg: "rgba(0,255,163,0.08)",   border: "rgba(0,255,163,0.2)",   text: "#00ffa3" },   // 0.1 SOL alt tier id
  0:  { bg: "rgba(153,69,255,0.08)",  border: "rgba(153,69,255,0.2)",  text: "#9945ff" },   // 0.5 SOL = purple
  1:  { bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.2)", text: "#ff6b6b" },   // 1 SOL   = red
};

const TIER_FILTER_COLORS: Record<string, string> = {
  "All":      "#e8e8f0",
  "0.05 SOL": "#00d4ff",
  "0.1 SOL":  "#00ffa3",
  "0.5 SOL":  "#9945ff",
  "1 SOL":    "#ff6b6b",
};

function getTierColor(tier: number) {
  return TIER_COLORS[tier] || { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)", text: "#e8e8f0" };
}

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
    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.5 + 0.5, o: Math.random() * 0.25 + 0.05,
    }));
    function draw() {
      ctx!.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(153,69,255,${p.o})`; ctx!.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx!.beginPath(); ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(0,255,163,${0.04 * (1 - dist / 100)})`;
            ctx!.lineWidth = 0.5; ctx!.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
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

  // Username + stats lookup
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});

  // Visibility animation
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  // ─── WEBSOCKET INIT ───
  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to lobby server');
      setIsConnected(true);
      newSocket.emit('lobby:subscribe');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from lobby server');
      setIsConnected(false);
    });

    newSocket.on('lobby:matches', ({ matches }: { matches: HostedMatch[] }) => {
      setHostedMatches(matches);
      setLoading(false);
    });

    newSocket.on('lobby:newMatch', (match: HostedMatch) => {
      setHostedMatches(prev => [match, ...prev]);
    });

    newSocket.on('lobby:matchRemoved', ({ matchCode }: { matchCode: string }) => {
      setHostedMatches(prev => prev.filter(m => m.matchCode !== matchCode));
    });

    newSocket.on('match:found', (match: HostedMatch) => {
      setSearchResult(match);
      setSearchError("");
      // Fetch username + stats for search result host
      getUsernames([match.hostWallet]).then((names) => {
        setUsernames((prev) => ({ ...prev, ...names }));
      });
      getPlayerStats(match.hostWallet).then((s) => {
        if (s) setPlayerStats((prev) => ({ ...prev, [match.hostWallet]: s }));
      });
    });

    newSocket.on('match:notFound', ({ matchCode }: { matchCode: string }) => {
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

  // Fetch usernames + stats for all visible host wallets
  useEffect(() => {
    const wallets = new Set<string>();
    hostedMatches.forEach((m) => wallets.add(m.hostWallet));
    matches.forEach((m) => wallets.add(m.account.playerA.toString()));
    const walletArr = Array.from(wallets);
    if (walletArr.length === 0) return;

    getUsernames(walletArr).then((names) => {
      setUsernames((prev) => ({ ...prev, ...names }));
    });

    Promise.all(
      walletArr.map((w) =>
        getPlayerStats(w).then((s) => [w, s] as const)
      )
    ).then((results) => {
      const statsMap: Record<string, PlayerStats> = {};
      results.forEach(([w, s]) => {
        if (s) statsMap[w] = s;
      });
      setPlayerStats((prev) => ({ ...prev, ...statsMap }));
    });
  }, [hostedMatches, matches]);

  // Load on-chain matches for fallback
  useEffect(() => {
    loadOnChainMatches();
    const interval = setInterval(() => {
      loadOnChainMatches();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      console.log('Joining match on-chain...', match.matchPubkey);
      const matchPubkey = new PublicKey(match.matchPubkey);
      const currency = match.currency || 'SOL';

      if (currency !== 'SOL') {
        // Token wager join
        const tokenClient = new TokenEscrowClient(connection, wallet);
        const mint = getMintForCurrency(currency)!;
        await tokenClient.joinTokenMatch(matchPubkey, mint);
      } else {
        // SOL wager join
        const client = new EscrowClient(connection, wallet);
        await client.joinMatch(matchPubkey);
      }

      console.log('Successfully joined match on-chain!');
      const currencyParam = currency !== 'SOL' ? `&currency=${currency}` : '';
      router.push(`/game?mode=join&match=${match.matchPubkey}&code=${match.matchCode}&tier=${match.stakeTier}${currencyParam}`);
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

  // Filter matches by tier + search code for live filtering
  const filteredHostedMatches = hostedMatches.filter((m) => {
    const tierMatch = selectedTier === null || m.stakeTier === selectedTier;
    const codeMatch = !searchCode || m.matchCode.includes(searchCode.toUpperCase());
    return tierMatch && codeMatch;
  });

  const filteredOnChainMatches = matches.filter((m) => {
    const tierMatch = selectedTier === null || m.account.stakeTier === selectedTier;
    return tierMatch;
  });

  const isOwnMatch = (hostWallet: string): boolean => {
    return !!publicKey && hostWallet === publicKey.toString();
  };

  const isOwnOnChainMatch = (match: MatchAccount) => {
    return publicKey && match.playerA.equals(publicKey);
  };

  const tierOptions = [
    { value: null, label: "All" },
    { value: 4, label: "0.05 SOL" },
    { value: 5, label: "0.1 SOL" },
    { value: 0, label: "0.5 SOL" },
    { value: 1, label: "1 SOL" },
  ];

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  // ─── Row renderer: hosted matches ───
  const renderHostedRow = (match: HostedMatch, index: number) => {
    const timeLeft = getTimeRemaining(match.joinDeadline, true);
    const isExpired = timeLeft === "Expired";
    const isOwn = isOwnMatch(match.hostWallet);
    const isJoining = joiningMatch === match.matchCode;
    const currency = match.currency || 'SOL';
    const solTierInfo = getStakeTierInfo(match.stakeTier);
    const tokenTierInfo = currency !== 'SOL' ? getTokenStakeTierInfo(currency as WagerCurrency, match.stakeTier) : null;
    const tierInfo = tokenTierInfo ? { ...solTierInfo, label: tokenTierInfo.label } : solTierInfo;
    const tc = currency === 'MATE'
      ? { bg: "rgba(0,255,163,0.08)", border: "rgba(0,255,163,0.2)", text: "#00ffa3" }
      : currency === 'SKR'
        ? { bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.2)", text: "#00d4ff" }
        : getTierColor(match.stakeTier);

    return (
      <div
        key={match.matchCode}
        className="match-row"
        style={{ opacity: isExpired ? 0.4 : 1 }}
      >
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 16, fontWeight: 700, color: "#e8e8f0",
          letterSpacing: "0.06em",
        }}>
          {match.matchCode}
        </span>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 8,
          background: tc.bg, border: `1px solid ${tc.border}`,
          fontSize: 13, fontWeight: 700, color: tc.text,
          fontFamily: "'Space Mono', monospace",
          whiteSpace: "nowrap",
        }}>
          ◆ {tierInfo.label}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(153,69,255,0.15), rgba(0,255,163,0.1))",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, flexShrink: 0,
          }}>👤</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13, color: usernames[match.hostWallet] ? "#e8e8f0" : "#6b6b80",
                fontWeight: usernames[match.hostWallet] ? 600 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {formatDisplayName(match.hostWallet, usernames[match.hostWallet])}
              </span>
              {isOwn && (
                <span style={{
                  fontSize: 11, color: "#00d4ff",
                  background: "rgba(0,212,255,0.08)", padding: "2px 8px",
                  borderRadius: 6, border: "1px solid rgba(0,212,255,0.15)",
                  flexShrink: 0,
                }}>You</span>
              )}
            </div>
            {playerStats[match.hostWallet] && (
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11, color: "#555",
              }}>
                {playerStats[match.hostWallet].gamesWon}W - {playerStats[match.hostWallet].gamesLost}L
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: isExpired ? "#ff5050" : "#00ffa3" }}>⏱</span>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 13, fontWeight: 600,
            color: isExpired ? "#ff5050" : "#a0a0b8",
          }}>
            {timeLeft}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          {!connected ? (
            <button disabled className="join-btn join-btn-disabled">Connect</button>
          ) : isOwn ? (
            <button disabled className="join-btn join-btn-disabled">Your Match</button>
          ) : isExpired ? (
            <button disabled className="join-btn join-btn-expired">Expired</button>
          ) : (
            <button
              className="join-btn"
              disabled={isJoining}
              onClick={() => handleJoinHostedMatch(match)}
              style={{ opacity: isJoining ? 0.6 : 1 }}
            >
              {isJoining ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <span className="join-spinner" />
                  Joining
                </span>
              ) : "Join"}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ─── Row renderer: on-chain matches ───
  const renderOnChainRow = (match: MatchWithPubkey, index: number) => {
    const tierInfo = getStakeTierInfo(match.account.stakeTier);
    const deadline = match.account.joinDeadline.toNumber();
    const timeLeft = getTimeRemaining(deadline);
    const isExpired = timeLeft === "Expired";
    const isOwn = isOwnOnChainMatch(match.account);
    const isJoining = joiningMatch === match.pubkey.toString();
    const tc = getTierColor(match.account.stakeTier);
    const code = match.pubkey.toString().slice(0, 4).toUpperCase();

    return (
      <div
        key={match.pubkey.toString()}
        className="match-row"
        style={{ opacity: isExpired ? 0.4 : 1 }}
      >
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 16, fontWeight: 700, color: "#e8e8f0",
          letterSpacing: "0.06em",
        }}>
          {code}
        </span>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 8,
          background: tc.bg, border: `1px solid ${tc.border}`,
          fontSize: 13, fontWeight: 700, color: tc.text,
          fontFamily: "'Space Mono', monospace",
          whiteSpace: "nowrap",
        }}>
          ◆ {tierInfo.label}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(153,69,255,0.15), rgba(0,255,163,0.1))",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, flexShrink: 0,
          }}>👤</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13, color: usernames[match.account.playerA.toString()] ? "#e8e8f0" : "#6b6b80",
                fontWeight: usernames[match.account.playerA.toString()] ? 600 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {formatDisplayName(match.account.playerA.toString(), usernames[match.account.playerA.toString()])}
              </span>
              {isOwn && (
                <span style={{
                  fontSize: 11, color: "#00d4ff",
                  background: "rgba(0,212,255,0.08)", padding: "2px 8px",
                  borderRadius: 6, border: "1px solid rgba(0,212,255,0.15)",
                  flexShrink: 0,
                }}>You</span>
              )}
            </div>
            {playerStats[match.account.playerA.toString()] && (
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11, color: "#555",
              }}>
                {playerStats[match.account.playerA.toString()].gamesWon}W - {playerStats[match.account.playerA.toString()].gamesLost}L
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: isExpired ? "#ff5050" : "#00ffa3" }}>⏱</span>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 13, fontWeight: 600,
            color: isExpired ? "#ff5050" : "#a0a0b8",
          }}>
            {timeLeft}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          {!connected ? (
            <button disabled className="join-btn join-btn-disabled">Connect</button>
          ) : isOwn ? (
            <button disabled className="join-btn join-btn-disabled">Your Match</button>
          ) : isExpired ? (
            <button disabled className="join-btn join-btn-expired">Expired</button>
          ) : (
            <button
              className="join-btn"
              disabled={isJoining}
              onClick={() => handleJoinMatch(match.pubkey, match.account.stakeTier)}
              style={{ opacity: isJoining ? 0.6 : 1 }}
            >
              {isJoining ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <span className="join-spinner" />
                  Joining
                </span>
              ) : "Join"}
            </button>
          )}
        </div>
      </div>
    );
  };

  const totalCount = filteredHostedMatches.length + filteredOnChainMatches.length;

  return (
    <div style={{
      minHeight: "100vh", background: "#07070e", color: "#e8e8f0",
      fontFamily: "'Outfit', 'SF Pro Display', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <ParticleField />

      {/* Ambient glows */}
      <div style={{ position: "absolute", top: "-10%", right: "10%", width: 500, height: 500, background: "radial-gradient(circle, rgba(153,69,255,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: "0", left: "-5%", width: 400, height: 400, background: "radial-gradient(circle, rgba(0,255,163,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <style>{`
        @keyframes glow-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .match-row {
          display: grid;
          grid-template-columns: 80px 110px 1fr 100px 120px;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 14px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
        }
        .match-row:hover {
          background: rgba(255,255,255,0.035);
          border-color: rgba(153,69,255,0.2);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.2), 0 0 20px rgba(153,69,255,0.06);
        }
        @media (max-width: 768px) {
          .match-row {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 14px 16px;
          }
          .col-headers { display: none !important; }
        }
        .join-btn {
          padding: 8px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.25s;
          border: none;
          background: linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%);
          color: #07070e;
          white-space: nowrap;
        }
        .join-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0,255,163,0.3);
        }
        .join-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .join-btn-disabled {
          background: rgba(255,255,255,0.04) !important;
          color: #444 !important;
          cursor: not-allowed !important;
        }
        .join-btn-expired {
          background: rgba(255,255,255,0.04) !important;
          color: #ff5050 !important;
          cursor: not-allowed !important;
        }
        .join-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #07070e;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
        .tier-filter {
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          color: #6b6b80;
        }
        .tier-filter:hover {
          background: rgba(255,255,255,0.05);
          color: #e8e8f0;
          border-color: rgba(255,255,255,0.1);
        }
        .tier-filter-active {
          background: rgba(0,255,163,0.08) !important;
          border-color: rgba(0,255,163,0.25) !important;
          color: #00ffa3 !important;
        }
        .search-result-row {
          display: grid;
          grid-template-columns: 80px 110px 1fr 100px 120px;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          background: rgba(153,69,255,0.06);
          border: 1px solid rgba(153,69,255,0.2);
          border-radius: 14px;
        }
        @media (max-width: 768px) {
          .search-result-row {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 14px 16px;
          }
        }
      `}</style>

      {/* ─── PAGE CONTENT ─── */}
      <div style={{
        position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto",
        padding: "20px 40px 80px",
      }}>

        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 36, ...fadeUp(0.1),
        }}>
          <div>
            <h1 style={{
              fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800,
              letterSpacing: "-0.03em", marginBottom: 8,
            }}>
              Match{" "}
              <span style={{
                background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Lobby</span>
            </h1>
            <p style={{ fontSize: 15, color: "#6b6b80" }}>
              Browse open matches and join a challenger at your stake level
            </p>
          </div>

          {/* Connection status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 100,
            background: isConnected ? "rgba(0,255,163,0.06)" : "rgba(255,80,80,0.06)",
            border: `1px solid ${isConnected ? "rgba(0,255,163,0.15)" : "rgba(255,80,80,0.15)"}`,
            fontSize: 12, fontWeight: 600,
            fontFamily: "'Space Mono', monospace",
            color: isConnected ? "#00ffa3" : "#ff5050",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isConnected ? "#00ffa3" : "#ff5050",
              animation: isConnected ? "glow-pulse 2s infinite" : "none",
            }} />
            {isConnected ? "Live" : "Offline"}
          </div>
        </div>

        {/* ─── UNIFIED SEARCH + FILTER BAR ─── */}
        <div style={{
          display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap",
          alignItems: "center",
          ...fadeUp(0.2),
        }}>
          {/* Search input */}
          <div style={{ position: "relative", flex: "0 0 auto" }}>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => {
                setSearchCode(e.target.value.toUpperCase().slice(0, 4));
                setSearchError("");
                setSearchResult(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search code..."
              maxLength={4}
              style={{
                width: 160, padding: "10px 16px 10px 38px",
                borderRadius: 12, fontSize: 14,
                fontFamily: "'Space Mono', monospace",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e8e8f0", letterSpacing: "0.08em",
                outline: "none", textTransform: "uppercase",
              }}
            />
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              fontSize: 14, color: "#444",
            }}>🔍</span>
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={searchCode.length !== 4}
            style={{
              padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif", cursor: searchCode.length === 4 ? "pointer" : "not-allowed",
              border: "none",
              background: searchCode.length === 4
                ? "linear-gradient(135deg, #00ffa3 0%, #9945ff 100%)"
                : "rgba(255,255,255,0.03)",
              color: searchCode.length === 4 ? "#07070e" : "#444",
              opacity: searchCode.length === 4 ? 1 : 0.5,
              transition: "all 0.2s",
            }}
          >
            Search
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.06)" }} />

          {/* Tier filters */}
          {tierOptions.map((tier) => {
            const filterColor = TIER_FILTER_COLORS[tier.label] || "#e8e8f0";
            return (
              <button
                key={tier.label}
                onClick={() => setSelectedTier(tier.value)}
                className={`tier-filter ${selectedTier === tier.value ? "tier-filter-active" : ""}`}
              >
                {tier.value !== null && (
                  <span style={{
                    display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                    background: filterColor, marginRight: 6,
                  }} />
                )}
                {tier.label}
              </button>
            );
          })}

          {/* Spacer + Refresh */}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif", cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)", color: "#6b6b80",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Search Error */}
        {searchError && (
          <div style={{
            marginBottom: 16, padding: "10px 20px",
            borderRadius: 10, fontSize: 13, color: "#ff5050",
            background: "rgba(255,80,80,0.06)",
            border: "1px solid rgba(255,80,80,0.12)",
            fontFamily: "'Space Mono', monospace",
          }}>
            {searchError}
          </div>
        )}

        {/* Search Result */}
        {searchResult && (() => {
          const srCurrency = searchResult.currency || 'SOL';
          const srSolTierInfo = getStakeTierInfo(searchResult.stakeTier);
          const srTokenTierInfo = srCurrency !== 'SOL' ? getTokenStakeTierInfo(srCurrency as WagerCurrency, searchResult.stakeTier) : null;
          const srTierInfo = srTokenTierInfo ? { ...srSolTierInfo, label: srTokenTierInfo.label } : srSolTierInfo;
          const srTc = srCurrency === 'MATE'
            ? { bg: "rgba(0,255,163,0.08)", border: "rgba(0,255,163,0.2)", text: "#00ffa3" }
            : srCurrency === 'SKR'
              ? { bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.2)", text: "#00d4ff" }
              : getTierColor(searchResult.stakeTier);
          const srIsOwn = isOwnMatch(searchResult.hostWallet);
          const srIsJoining = joiningMatch === searchResult.matchCode;
          return (
            <div style={{ marginBottom: 16, ...fadeUp(0.15) }}>
              <div style={{
                fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.1em", color: "#9945ff", marginBottom: 8,
                fontFamily: "'Space Mono', monospace",
              }}>
                Search Result
              </div>
              <div className="search-result-row">
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 16, fontWeight: 700, color: "#e8e8f0",
                  letterSpacing: "0.06em",
                }}>
                  {searchResult.matchCode}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 8,
                  background: srTc.bg, border: `1px solid ${srTc.border}`,
                  fontSize: 13, fontWeight: 700, color: srTc.text,
                  fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap",
                }}>
                  ◆ {srTierInfo.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{
                      fontFamily: "'Space Mono', monospace", fontSize: 13,
                      color: usernames[searchResult.hostWallet] ? "#e8e8f0" : "#6b6b80",
                      fontWeight: usernames[searchResult.hostWallet] ? 600 : 400,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {formatDisplayName(searchResult.hostWallet, usernames[searchResult.hostWallet])}
                    </span>
                    {playerStats[searchResult.hostWallet] && (
                      <span style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 11, color: "#555",
                      }}>
                        {playerStats[searchResult.hostWallet].gamesWon}W - {playerStats[searchResult.hostWallet].gamesLost}L
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#a0a0b8" }}>—</span>
                <div style={{ textAlign: "right" }}>
                  {srIsOwn ? (
                    <button disabled className="join-btn join-btn-disabled">Your Match</button>
                  ) : (
                    <button
                      className="join-btn"
                      disabled={srIsJoining}
                      onClick={() => handleJoinHostedMatch(searchResult)}
                      style={{ opacity: srIsJoining ? 0.6 : 1 }}
                    >
                      {srIsJoining ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                          <span className="join-spinner" />
                          Joining
                        </span>
                      ) : "Join"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── LIVE MATCHES SECTION ─── */}
        <div style={{ marginBottom: 12, ...fadeUp(0.22) }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#00ffa3",
              animation: "glow-pulse 2s infinite",
            }} />
            <span style={{
              fontSize: 14, fontWeight: 700, color: "#e8e8f0",
              fontFamily: "'Outfit', sans-serif",
            }}>Live Matches</span>
            <span style={{
              fontSize: 12, color: "#444",
              fontFamily: "'Space Mono', monospace",
            }}>({filteredHostedMatches.length})</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="col-headers" style={{
          display: "grid",
          gridTemplateColumns: "80px 110px 1fr 100px 120px",
          gap: 16, padding: "0 24px 12px",
          fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const,
          letterSpacing: "0.1em", color: "#444",
          fontFamily: "'Space Mono', monospace",
          ...fadeUp(0.25),
        }}>
          <span>Code</span>
          <span>Stake</span>
          <span>Host</span>
          <span>Time Left</span>
          <span style={{ textAlign: "right" }}>Action</span>
        </div>

        {/* Match list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, ...fadeUp(0.3) }}>
          {loading && filteredHostedMatches.length === 0 && filteredOnChainMatches.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 16,
            }}>
              <div style={{
                width: 40, height: 40, margin: "0 auto 16px",
                border: "2px solid #9945ff", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spin 1s linear infinite",
              }} />
              <p style={{ color: "#6b6b80", fontSize: 15 }}>Loading matches...</p>
            </div>
          ) : filteredHostedMatches.length === 0 && filteredOnChainMatches.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
                background: "rgba(255,255,255,0.03)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24,
              }}>♟</div>
              <p style={{ color: "#6b6b80", fontSize: 15, marginBottom: 8 }}>
                No matches found
              </p>
              <p style={{ color: "#444", fontSize: 13 }}>
                {searchCode ? "Try a different code" : "Be the first to create one"}
              </p>
              <button
                onClick={() => router.push("/game?mode=host")}
                style={{
                  marginTop: 20, padding: "10px 24px", borderRadius: 12,
                  background: "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)",
                  color: "#07070e", fontSize: 14, fontWeight: 700, border: "none",
                  cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                }}
              >
                + Create a Match
              </button>
            </div>
          ) : (
            <>
              {filteredHostedMatches.map((match, i) => renderHostedRow(match, i))}

              {filteredOnChainMatches.length > 0 && (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    marginTop: 20, marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: "#a0a0b8",
                      fontFamily: "'Outfit', sans-serif",
                    }}>On-Chain Matches</span>
                    <span style={{
                      fontSize: 12, color: "#444",
                      fontFamily: "'Space Mono', monospace",
                    }}>({filteredOnChainMatches.length})</span>
                  </div>
                  {filteredOnChainMatches.map((match, i) => renderOnChainRow(match, i))}
                </>
              )}
            </>
          )}
        </div>

        {/* Match count footer */}
        {totalCount > 0 && (
          <div style={{
            marginTop: 20, padding: "12px 24px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 12, color: "#444", fontFamily: "'Space Mono', monospace",
            ...fadeUp(0.4),
          }}>
            <span>
              {totalCount} match{totalCount !== 1 ? "es" : ""} found
              {selectedTier !== null && (() => {
                const tierLabel = tierOptions.find(t => t.value === selectedTier)?.label;
                return tierLabel ? ` at ${tierLabel}` : "";
              })()}
            </span>
            <span>Auto-refreshes every 30s</span>
          </div>
        )}

        {/* Back + Create buttons */}
        <div style={{
          display: "flex", gap: 14, justifyContent: "center", marginTop: 40,
          ...fadeUp(0.45),
        }}>
          <button
            onClick={() => router.push("/play")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 24px", borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#6b6b80", fontSize: 14, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif", cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ← Back to Modes
          </button>
          <button
            onClick={() => router.push("/game?mode=host")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 32px", borderRadius: 14,
              background: "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)",
              color: "#07070e", fontSize: 14, fontWeight: 700, border: "none",
              fontFamily: "'Outfit', sans-serif", cursor: "pointer",
              boxShadow: "0 6px 30px rgba(0,255,163,0.2)",
              transition: "all 0.2s",
            }}
          >
            + Host a Match
          </button>
        </div>
      </div>
    </div>
  );
}
