"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  getUsernames,
  getPlayerStats,
  formatDisplayName,
  PlayerStats,
} from "@/utils/username";

// ─── TYPES ───
interface FreePlayRoom {
  code: string;
  hostWallet: string;
  createdAt: number;
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

export default function FreePlayLobbyPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState<FreePlayRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});

  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  // Time ago helper
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const getTimeAgo = (createdAt: number): string => {
    const seconds = Math.floor((now - createdAt) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // ─── WEBSOCKET INIT ───
  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('freeplayLobby:subscribe');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('freeplayLobby:rooms', ({ rooms: roomList }: { rooms: FreePlayRoom[] }) => {
      setRooms(roomList);
      setLoading(false);
    });

    newSocket.on('freeplayLobby:newRoom', (room: FreePlayRoom) => {
      setRooms(prev => [room, ...prev]);
    });

    newSocket.on('freeplayLobby:roomRemoved', ({ code }: { code: string }) => {
      setRooms(prev => prev.filter(r => r.code !== code));
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('freeplayLobby:unsubscribe');
      newSocket.disconnect();
    };
  }, []);

  // Fetch usernames + stats for visible hosts
  useEffect(() => {
    const wallets = new Set<string>();
    rooms.forEach((r) => {
      // Only look up real wallet addresses (not host_xxx or guest_xxx)
      if (r.hostWallet && !r.hostWallet.startsWith('host_') && !r.hostWallet.startsWith('guest_')) {
        wallets.add(r.hostWallet);
      }
    });
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
  }, [rooms]);

  // Filter by search code
  const filteredRooms = rooms.filter((r) => {
    if (!searchCode) return true;
    return r.code.includes(searchCode.toUpperCase());
  });

  const handleJoin = (code: string) => {
    router.push(`/freeplay?code=${code}`);
  };

  const getDisplayName = (wallet: string): string => {
    if (wallet.startsWith('host_') || wallet.startsWith('guest_')) {
      return 'Guest';
    }
    return formatDisplayName(wallet, usernames[wallet]);
  };

  const isNamedUser = (wallet: string): boolean => {
    if (wallet.startsWith('host_') || wallet.startsWith('guest_')) return false;
    return !!usernames[wallet];
  };

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  // ─── ROW RENDERER ───
  const renderRoomRow = (room: FreePlayRoom) => {
    return (
      <div key={room.code} className="match-row">
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 16, fontWeight: 700, color: "#e8e8f0",
          letterSpacing: "0.06em",
        }}>
          {room.code}
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
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              color: isNamedUser(room.hostWallet) ? "#e8e8f0" : "#6b6b80",
              fontWeight: isNamedUser(room.hostWallet) ? 600 : 400,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {getDisplayName(room.hostWallet)}
            </span>
            {playerStats[room.hostWallet] && (
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11, color: "#555",
              }}>
                {playerStats[room.hostWallet].gamesWon}W - {playerStats[room.hostWallet].gamesLost}L
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#00ffa3" }}>⏱</span>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 13, fontWeight: 600, color: "#a0a0b8",
          }}>
            {getTimeAgo(room.createdAt)}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <button
            className="join-btn"
            onClick={() => handleJoin(room.code)}
          >
            Join
          </button>
        </div>
      </div>
    );
  };

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
          grid-template-columns: 80px 1fr 100px 100px;
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
          border-color: rgba(0,255,163,0.2);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.2), 0 0 20px rgba(0,255,163,0.06);
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
              Free Play{" "}
              <span style={{
                background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Lobby</span>
            </h1>
            <p style={{ fontSize: 15, color: "#6b6b80" }}>
              Browse open free play games and join instantly
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

        {/* ─── SEARCH BAR ─── */}
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
              onChange={(e) => setSearchCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="Filter by code..."
              maxLength={4}
              style={{
                width: 180, padding: "10px 16px 10px 38px",
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

          <div style={{ flex: 1 }} />

          {/* Free play badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 8,
            background: "rgba(0,255,163,0.08)",
            border: "1px solid rgba(0,255,163,0.2)",
            fontSize: 13, fontWeight: 700, color: "#00ffa3",
            fontFamily: "'Space Mono', monospace",
          }}>
            🆓 Free Play
          </div>
        </div>

        {/* ─── LIVE GAMES SECTION ─── */}
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
            }}>Open Games</span>
            <span style={{
              fontSize: 12, color: "#444",
              fontFamily: "'Space Mono', monospace",
            }}>({filteredRooms.length})</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="col-headers" style={{
          display: "grid",
          gridTemplateColumns: "80px 1fr 100px 100px",
          gap: 16, padding: "0 24px 12px",
          fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const,
          letterSpacing: "0.1em", color: "#444",
          fontFamily: "'Space Mono', monospace",
          ...fadeUp(0.25),
        }}>
          <span>Code</span>
          <span>Host</span>
          <span>Created</span>
          <span style={{ textAlign: "right" }}>Action</span>
        </div>

        {/* Room list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, ...fadeUp(0.3) }}>
          {loading ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 16,
            }}>
              <div style={{
                width: 40, height: 40, margin: "0 auto 16px",
                border: "2px solid #00ffa3", borderTopColor: "transparent",
                borderRadius: "50%", animation: "spin 1s linear infinite",
              }} />
              <p style={{ color: "#6b6b80", fontSize: 15 }}>Loading games...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
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
                No open games right now
              </p>
              <p style={{ color: "#444", fontSize: 13 }}>
                {searchCode ? "Try a different code" : "Create one and others can join from here"}
              </p>
              <button
                onClick={() => router.push("/freeplay")}
                style={{
                  marginTop: 20, padding: "10px 24px", borderRadius: 12,
                  background: "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)",
                  color: "#07070e", fontSize: 14, fontWeight: 700, border: "none",
                  cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                }}
              >
                + Create a Game
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => renderRoomRow(room))
          )}
        </div>

        {/* Room count footer */}
        {filteredRooms.length > 0 && (
          <div style={{
            marginTop: 20, padding: "12px 24px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 12, color: "#444", fontFamily: "'Space Mono', monospace",
            ...fadeUp(0.4),
          }}>
            <span>
              {filteredRooms.length} game{filteredRooms.length !== 1 ? "s" : ""} available
            </span>
            <span>Updates in real time</span>
          </div>
        )}

        {/* Back + Create buttons */}
        <div style={{
          display: "flex", gap: 14, justifyContent: "center", marginTop: 40,
          ...fadeUp(0.45),
        }}>
          <button
            onClick={() => router.push("/freeplay")}
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
            ← Back to Free Play
          </button>
          <button
            onClick={() => router.push("/freeplay")}
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
            + Create a Game
          </button>
        </div>
      </div>
    </div>
  );
}
