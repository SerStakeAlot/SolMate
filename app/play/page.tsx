"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type PlayMode = "join" | "host" | "freeplay";

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
      ctx!.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(153, 69, 255, ${p.o})`;
        ctx!.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(0, 255, 163, ${0.04 * (1 - dist / 100)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    const resize = () => {
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

const MODES: {
  id: PlayMode;
  icon: string;
  title: string;
  desc: string;
  featured: boolean;
  accent: string;
  badge: string | null;
}[] = [
  {
    id: "freeplay",
    icon: "🎮",
    title: "Free Play",
    desc: "Play friends online — no wallet needed",
    featured: true,
    accent: "#9945ff",
    badge: "Recommended",
  },
  {
    id: "join",
    icon: "👥",
    title: "Join Match",
    desc: "Browse and join open staked matches",
    featured: false,
    accent: "#00ffa3",
    badge: null,
  },
  {
    id: "host",
    icon: "⚔️",
    title: "Host Match",
    desc: "Create a new staked match and wait for a challenger",
    featured: false,
    accent: "#00d4ff",
    badge: null,
  },
];

export default function PlayPage() {
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode | null>(null);
  const [hovered, setHovered] = useState<PlayMode | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  const gameHref = useMemo(() => {
    if (mode === "join") {
      return "/lobby";
    }
    if (mode === "freeplay") {
      return "/freeplay";
    }
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    return `/game?${params.toString()}`;
  }, [mode]);

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "calc(100vh - 72px)",
      }}
    >
      <ParticleField />

      {/* Ambient glows */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: 500,
          height: 500,
          background:
            "radial-gradient(circle, rgba(153,69,255,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-5%",
          width: 400,
          height: 400,
          background:
            "radial-gradient(circle, rgba(0,255,163,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <style>{`
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ─── PAGE CONTENT ─── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 900,
          margin: "0 auto",
          padding: "40px 24px 80px",
          textAlign: "center",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 48, ...fadeUp(0.1) }}>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 10,
              color: "#e8e8f0",
            }}
          >
            Select{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #00ffa3, #00d4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Mode
            </span>
          </h1>
          <p style={{ fontSize: 16, color: "#6b6b80", fontWeight: 400 }}>
            Choose your path to victory
          </p>
        </div>

        {/* Mode Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
            marginBottom: 48,
          }}
        >
          {MODES.map((m, i) => {
            const isSelected = mode === m.id;
            const isHovered = hovered === m.id;

            return (
              <div
                key={m.id}
                onClick={() => setMode(m.id)}
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setMode(m.id);
                }}
                style={{
                  position: "relative",
                  background: isSelected
                    ? `linear-gradient(135deg, ${m.accent}12, ${m.accent}06)`
                    : m.featured
                    ? "rgba(153,69,255,0.04)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${
                    isSelected
                      ? `${m.accent}50`
                      : isHovered
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.06)"
                  }`,
                  borderRadius: 20,
                  padding: "32px 28px",
                  cursor: "pointer",
                  transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                  transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  boxShadow: isSelected
                    ? `0 8px 40px ${m.accent}15, 0 0 0 1px ${m.accent}30`
                    : isHovered
                    ? "0 16px 40px rgba(0,0,0,0.3)"
                    : "none",
                  textAlign: "left",
                  overflow: "hidden",
                  ...fadeUp(0.2 + i * 0.08),
                }}
              >
                {/* Top glow line on selected */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: isSelected
                      ? `linear-gradient(90deg, transparent, ${m.accent}, transparent)`
                      : "transparent",
                    transition: "all 0.3s",
                  }}
                />

                {/* Icon */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: isSelected
                      ? `linear-gradient(135deg, ${m.accent}30, ${m.accent}15)`
                      : m.featured
                      ? "linear-gradient(135deg, rgba(153,69,255,0.15), rgba(0,255,163,0.1))"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${
                      isSelected
                        ? `${m.accent}40`
                        : "rgba(255,255,255,0.06)"
                    }`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    marginBottom: 20,
                    transition: "all 0.3s",
                    transform: isHovered ? "scale(1.08)" : "scale(1)",
                    boxShadow: isSelected
                      ? `0 4px 20px ${m.accent}20`
                      : m.featured
                      ? "0 4px 20px rgba(153,69,255,0.15)"
                      : "none",
                  }}
                >
                  {m.icon}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: isSelected ? "#fff" : "#e8e8f0",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {m.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: 14,
                    color: "#6b6b80",
                    lineHeight: 1.55,
                    fontWeight: 400,
                  }}
                >
                  {m.desc}
                </p>

                {/* Badge */}
                {m.badge && (
                  <div
                    style={{
                      marginTop: 16,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "'Space Mono', monospace",
                      background: "rgba(0,255,163,0.08)",
                      border: "1px solid rgba(0,255,163,0.15)",
                      color: "#00ffa3",
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#00ffa3",
                        animation: "glow-pulse 2s infinite",
                      }}
                    />
                    {m.badge}
                  </div>
                )}

                {/* Selected check */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: m.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      color: "#07070e",
                      fontWeight: 800,
                      boxShadow: `0 2px 12px ${m.accent}50`,
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
            ...fadeUp(0.5),
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#6b6b80",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={!mode}
            onClick={() => router.push(gameHref)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 40px",
              borderRadius: 14,
              background: mode
                ? "linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)"
                : "rgba(255,255,255,0.03)",
              border: mode ? "none" : "1px solid rgba(255,255,255,0.06)",
              color: mode ? "#07070e" : "#333",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              cursor: mode ? "pointer" : "not-allowed",
              transition: "all 0.3s",
              boxShadow: mode
                ? "0 8px 40px rgba(0,255,163,0.25), 0 0 60px rgba(153,69,255,0.1)"
                : "none",
              opacity: mode ? 1 : 0.5,
            }}
          >
            Continue →
          </button>
        </div>

        {/* Helper text */}
        {!mode && (
          <p
            style={{
              marginTop: 20,
              fontSize: 13,
              color: "#444",
              fontStyle: "italic",
              ...fadeUp(0.6),
            }}
          >
            Select a mode to continue
          </p>
        )}
      </div>
    </div>
  );
}
