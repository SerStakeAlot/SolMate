"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChessGame } from "@/components/ChessGame";

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

// ─── WAITING OVERLAY (shown when hosting, code ready) ───
function WaitingOverlay({
  roomCode,
  onCancel,
}: {
  roomCode: string;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  const shareLink = `${typeof window !== "undefined" ? window.location.origin : ""}/freeplay?code=${roomCode}`;

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const input = document.createElement("input");
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    []
  );

  const fadeIn = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
    transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(7,7,14,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={fadeIn(0.05)}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(153,69,255,0.2), rgba(0,255,163,0.15))",
              border: "1px solid rgba(153,69,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 24px",
            }}
          >
            🎮
          </div>

          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 8,
              color: "#e8e8f0",
            }}
          >
            Waiting for{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Opponent
            </span>
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "#6b6b80",
              marginBottom: 32,
              fontWeight: 400,
            }}
          >
            Share the code or link with a friend to start
          </p>
        </div>

        {/* Room Code */}
        <div style={fadeIn(0.12)}>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "28px 32px",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "#6b6b80",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 12,
              }}
            >
              Room Code
            </p>
            <span
              style={{
                fontFamily: "'Space Mono', 'JetBrains Mono', monospace",
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "0.22em",
                background: "linear-gradient(135deg, #00ffa3, #9945ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "block",
              }}
            >
              {roomCode}
            </span>
            <button
              onClick={() => handleCopy(roomCode)}
              style={{
                marginTop: 16,
                padding: "8px 22px",
                borderRadius: 10,
                background: "rgba(153,69,255,0.1)",
                border: "1px solid rgba(153,69,255,0.2)",
                color: "#9945ff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copied ? "✓ Copied!" : "Copy Code"}
            </button>
          </div>
        </div>

        {/* Share Link */}
        <div style={fadeIn(0.18)}>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "18px 20px",
              marginBottom: 28,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "#6b6b80",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 10,
              }}
            >
              Or share invite link
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#6b6b80",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                }}
              >
                {shareLink}
              </div>
              <button
                onClick={() => handleCopy(shareLink)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)",
                  border: "none",
                  color: "#07070e",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>

        {/* Spinner */}
        <div style={fadeIn(0.24)}>
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid rgba(153,69,255,0.15)",
              borderTop: "3px solid #9945ff",
              borderRadius: "50%",
              animation: "freeplay-spin 1s linear infinite",
              margin: "0 auto",
            }}
          />
          <style>{`@keyframes freeplay-spin { to { transform: rotate(360deg); } }`}</style>
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#555",
              fontStyle: "italic",
            }}
          >
            Waiting for player to join...
          </p>
        </div>

        {/* Cancel */}
        <div style={{ marginTop: 24, ...fadeIn(0.3) }}>
          <button
            onClick={onCancel}
            style={{
              padding: "12px 28px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#6b6b80",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ← Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOBBY SCREEN (Create / Join selection) ───
function FreePlayLobby({
  onCreateGame,
  onJoinGame,
  isCreating,
  isJoining,
  onBack,
}: {
  onCreateGame: () => void;
  onJoinGame: (code: string) => void;
  isCreating: boolean;
  isJoining: boolean;
  onBack: () => void;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 700,
        margin: "0 auto",
        padding: "48px 24px 80px",
        textAlign: "center",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 48, ...fadeUp(0.1) }}>
        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: 10,
            color: "#e8e8f0",
          }}
        >
          Free{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Play
          </span>
        </h1>
        <p style={{ fontSize: 16, color: "#6b6b80", fontWeight: 400 }}>
          Play a friend online — no wallet or stakes needed
        </p>
      </div>

      {/* Two cards: Create & Join */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
          marginBottom: 40,
        }}
      >
        {/* Create Game Card */}
        <div
          style={{
            background: "rgba(153,69,255,0.04)",
            border: "1px solid rgba(153,69,255,0.15)",
            borderRadius: 20,
            padding: "36px 28px",
            textAlign: "left",
            position: "relative",
            overflow: "hidden",
            ...fadeUp(0.2),
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background:
                "linear-gradient(90deg, transparent, #9945ff, transparent)",
            }}
          />
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, rgba(153,69,255,0.2), rgba(0,255,163,0.12))",
              border: "1px solid rgba(153,69,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 20,
              boxShadow: "0 4px 20px rgba(153,69,255,0.15)",
            }}
          >
            🏠
          </div>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 8,
              color: "#e8e8f0",
            }}
          >
            Create Game
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "#6b6b80",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            Host a new game and get a code to share with your friend. They can
            join from any device.
          </p>
          <button
            onClick={onCreateGame}
            disabled={isCreating}
            style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: 14,
              background: isCreating
                ? "rgba(153,69,255,0.15)"
                : "linear-gradient(135deg, #9945ff 0%, #7b3fe4 100%)",
              border: "none",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: isCreating ? "not-allowed" : "pointer",
              transition: "all 0.3s",
              boxShadow: isCreating
                ? "none"
                : "0 4px 20px rgba(153,69,255,0.3)",
              opacity: isCreating ? 0.7 : 1,
            }}
          >
            {isCreating ? "Creating..." : "Create Game →"}
          </button>
        </div>

        {/* Join Game Card */}
        <div
          style={{
            background: "rgba(0,255,163,0.03)",
            border: "1px solid rgba(0,255,163,0.12)",
            borderRadius: 20,
            padding: "36px 28px",
            textAlign: "left",
            position: "relative",
            overflow: "hidden",
            ...fadeUp(0.28),
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background:
                "linear-gradient(90deg, transparent, #00ffa3, transparent)",
            }}
          />
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, rgba(0,255,163,0.15), rgba(0,212,255,0.1))",
              border: "1px solid rgba(0,255,163,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 20,
              boxShadow: "0 4px 20px rgba(0,255,163,0.1)",
            }}
          >
            🔗
          </div>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 8,
              color: "#e8e8f0",
            }}
          >
            Join Game
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "#6b6b80",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            Enter the 4-character room code from your friend to join their game
            instantly.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              maxLength={4}
              placeholder="CODE"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && joinCode.length === 4) {
                  onJoinGame(joinCode);
                }
              }}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e8e8f0",
                fontSize: 16,
                fontFamily: "'Space Mono', 'JetBrains Mono', monospace",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textAlign: "center",
                outline: "none",
                textTransform: "uppercase",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(0,255,163,0.4)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />
            <button
              onClick={() => onJoinGame(joinCode)}
              disabled={joinCode.length !== 4 || isJoining}
              style={{
                padding: "14px 24px",
                borderRadius: 12,
                background:
                  joinCode.length === 4 && !isJoining
                    ? "linear-gradient(135deg, #00ffa3 0%, #00d4ff 100%)"
                    : "rgba(255,255,255,0.04)",
                border:
                  joinCode.length === 4
                    ? "none"
                    : "1px solid rgba(255,255,255,0.06)",
                color: joinCode.length === 4 ? "#07070e" : "#444",
                fontSize: 15,
                fontWeight: 700,
                cursor:
                  joinCode.length === 4 && !isJoining
                    ? "pointer"
                    : "not-allowed",
                transition: "all 0.3s",
                boxShadow:
                  joinCode.length === 4
                    ? "0 4px 20px rgba(0,255,163,0.2)"
                    : "none",
                opacity: joinCode.length === 4 ? 1 : 0.5,
                whiteSpace: "nowrap",
              }}
            >
              {isJoining ? "Joining..." : "Join →"}
            </button>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div style={fadeUp(0.4)}>
        <button
          onClick={onBack}
          style={{
            padding: "12px 28px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#6b6b80",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          ← Back to Play
        </button>
      </div>

      {/* Info badges */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
          ...fadeUp(0.5),
        }}
      >
        {[
          { icon: "🆓", text: "No wallet needed" },
          { icon: "⚡", text: "Instant matchmaking" },
          { icon: "🌍", text: "Play from any device" },
        ].map((badge) => (
          <div
            key={badge.text}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 500,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#6b6b80",
            }}
          >
            <span style={{ fontSize: 14 }}>{badge.icon}</span>
            {badge.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN CONTENT ───
function FreePlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  // Phase: "lobby" = create/join selection, "game" = ChessGame active
  const [phase, setPhase] = useState<"lobby" | "game">(
    codeFromUrl ? "game" : "lobby"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [freePlayJoinCode, setFreePlayJoinCode] = useState<string | undefined>(
    codeFromUrl?.toUpperCase() || undefined
  );
  const [autoCreate, setAutoCreate] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // If joining via URL code, go straight to game
  useEffect(() => {
    if (codeFromUrl && codeFromUrl.length === 4) {
      setFreePlayJoinCode(codeFromUrl.toUpperCase());
      setPhase("game");
    }
  }, [codeFromUrl]);

  // When ChessGame generates a room code, show the waiting overlay
  const handleCodeGenerated = useCallback((code: string) => {
    setRoomCode(code);
    setIsCreating(false);
  }, []);

  // When game actually starts (opponent connected), dismiss the overlay
  const handleGameStarted = useCallback(() => {
    setGameStarted(true);
    setRoomCode(null); // Dismiss overlay
  }, []);

  const handleCreateGame = useCallback(() => {
    setIsCreating(true);
    setAutoCreate(true);
    setPhase("game");
  }, []);

  const handleJoinGame = useCallback((code: string) => {
    if (code.length !== 4) return;
    setIsJoining(true);
    setFreePlayJoinCode(code.toUpperCase());
    setPhase("game");
  }, []);

  const handleBack = useCallback(() => {
    router.push("/play");
  }, [router]);

  const handleCancelHosting = useCallback(() => {
    // Full page reload to cleanly reset ChessGame socket state
    router.push("/freeplay");
    window.location.href = "/freeplay";
  }, [router]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
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

      {phase === "lobby" ? (
        <FreePlayLobby
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          isCreating={isCreating}
          isJoining={isJoining}
          onBack={handleBack}
        />
      ) : (
        <>
          {/* Page Header */}
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
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                <span
                  style={{
                    background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Free Online Match
                </span>
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(0,255,163,0.1)",
                  border: "1px solid rgba(0,255,163,0.2)",
                  color: "#00ffa3",
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                FREE PLAY
              </span>
            </div>
            <p
              style={{
                fontSize: 14,
                color: "#6b6b80",
                fontWeight: 500,
              }}
            >
              No wallet needed — play with a friend for fun
            </p>
          </div>

          {/* Game Area */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 40px 60px",
              ...fadeUp(0.2),
            }}
          >
            <ChessGame
              initialMode="practice"
              showModeSelector={false}
              freePlayJoinCode={freePlayJoinCode}
              autoCreateFreePlay={autoCreate}
              onFreePlayCodeGenerated={handleCodeGenerated}
              onFreePlayGameStarted={handleGameStarted}
            />
          </div>

          {/* Waiting overlay — shown while hosting until opponent joins */}
          {roomCode && !gameStarted && (
            <WaitingOverlay roomCode={roomCode} onCancel={handleCancelHosting} />
          )}
        </>
      )}
    </div>
  );
}

export default function FreePlayPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "40px",
            color: "#6b6b80",
          }}
        >
          Loading...
        </div>
      }
    >
      <FreePlayContent />
    </Suspense>
  );
}
