"use client";

import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight, Sparkles, Users, Gamepad2, Coins, HelpCircle, X } from "lucide-react";
import { UsernameSetting } from "@/components/UsernameSetting";
import { useState, useEffect, useRef } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

interface PlatformStats {
  totalGames: number;
  uniquePlayers: number;
  totalSolWagered: number;
}

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant Payouts",
    desc: "Winners receive 90% of the stake pool immediately upon victory. No delays, no middlemen.",
    accent: "#00ffa3",
  },
  {
    icon: "🔒",
    title: "Secure Escrow",
    desc: "Smart contracts hold stakes until match completion. Funds are PDA-custodied on-chain.",
    accent: "#9945ff",
  },
  {
    icon: "🏆",
    title: "Competitive Stakes",
    desc: "Choose from 0.05, 0.1, 0.5 or 1 SOL stake tiers. Climb ranks from Novice to Master.",
    accent: "#14f195",
  },
  {
    icon: "🎯",
    title: "Auto Matchmaking",
    desc: "Get paired by stake tier instantly. 10-minute time controls with real-time clocks.",
    accent: "#00d4ff",
  },
];

const STAKE_TIERS = ["0.05 SOL", "0.1 SOL", "0.5 SOL", "1 SOL"];

// Floating particle background
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

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      o: Math.random() * 0.4 + 0.1,
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
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 255, 163, ${0.06 * (1 - dist / 120)})`;
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

// Animated counter
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / 40;
    const interval = setInterval(() => {
      start += step;
      if (start >= target) {
        setVal(target);
        clearInterval(interval);
      } else {
        setVal(Math.round(start));
      }
    }, 30);
    return () => clearInterval(interval);
  }, [target]);
  return (
    <span>
      {val}
      {suffix}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const { connected } = useWallet();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [usernameCount, setUsernameCount] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
        
        const usernamesRes = await fetch(`${BACKEND_URL}/api/usernames`);
        if (usernamesRes.ok) {
          const usernamesData = await usernamesRes.json();
          setUsernameCount(usernamesData.count);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const fadeUp = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(30px)",
    transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .btn-primary-new {
          position: relative;
          background: linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%);
          color: #07070e;
          font-weight: 700;
          font-size: 16px;
          padding: 16px 40px;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.3s ease;
          font-family: 'Outfit', sans-serif;
        }
        .btn-primary-new:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 40px rgba(0, 255, 163, 0.3), 0 0 80px rgba(153, 69, 255, 0.15);
        }
        .btn-primary-new:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .btn-secondary-new {
          background: rgba(255,255,255,0.04);
          color: #a0a0b8;
          font-weight: 600;
          font-size: 15px;
          padding: 14px 36px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Outfit', sans-serif;
          backdrop-filter: blur(10px);
        }
        .btn-secondary-new:hover {
          background: rgba(255,255,255,0.08);
          color: #e8e8f0;
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-1px);
        }
        .feature-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 32px 28px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,255,163,0.3), transparent);
          opacity: 0;
          transition: opacity 0.4s;
        }
        .feature-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .feature-card:hover::before {
          opacity: 1;
        }
        .tier-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          color: #a0a0b8;
          transition: all 0.3s;
          cursor: default;
        }
        .tier-chip:hover {
          background: rgba(0,255,163,0.08);
          border-color: rgba(0,255,163,0.25);
          color: #00ffa3;
        }
        .stat-card-new {
          text-align: center;
          padding: 24px;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#07070e",
          color: "#e8e8f0",
          fontFamily: "'Outfit', 'SF Pro Display', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <ParticleField />

        {/* Ambient glow effects */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            left: "-10%",
            width: "500px",
            height: "500px",
            background: "radial-gradient(circle, rgba(0,255,163,0.05) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* HERO */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1200,
            margin: "0 auto",
            padding: "80px 40px 60px",
            textAlign: "center",
          }}
        >
          {/* Logo */}
          <div style={fadeUp(0.15)}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image 
                src="/images/solmate-logo.png" 
                alt="SolMate" 
                width={160} 
                height={160}
                style={{ margin: "0 auto 24px", filter: "drop-shadow(0 0 40px rgba(153, 69, 255, 0.3))" }}
                priority
              />
            </motion.div>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(42px, 6vw, 76px)",
              fontWeight: 800,
              lineHeight: 1.05,
              marginBottom: 20,
              letterSpacing: "-0.03em",
              ...fadeUp(0.2),
            }}
          >
            <span style={{ color: "#e8e8f0" }}>Stake.</span>{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #00ffa3 0%, #00d4ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Compete.
            </span>{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #9945ff 0%, #00ffa3 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Conquer.
            </span>
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "#6b6b80",
              maxWidth: 520,
              margin: "0 auto 40px",
              lineHeight: 1.65,
              fontWeight: 400,
              ...fadeUp(0.3),
            }}
          >
            The premier chess battleground on Solana. Challenge opponents in
            tactical duels with real stakes and instant payouts.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 24,
              ...fadeUp(0.4),
            }}
          >
            <button 
              className="btn-primary-new" 
              disabled={!connected}
              onClick={() => router.push("/play")}
            >
              {connected ? "Enter the Arena" : "Connect Wallet to Play"}
            </button>
            <button 
              className="btn-secondary-new"
              onClick={() => window.location.href = "https://playsolmate.fun/freeplay/"}
            >
              Free Play
            </button>
            <button 
              className="btn-secondary-new"
              onClick={() => router.push("/game?mode=computer")}
            >
              Practice Mode
            </button>
          </div>

          {/* How to Play Button */}
          <div 
            role="button"
            tabIndex={0}
            onClick={() => setShowHowToPlay(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "rgba(153, 69, 255, 0.1)",
              border: "1px solid rgba(153, 69, 255, 0.3)",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              color: "#9945ff",
              cursor: "pointer",
              marginBottom: 32,
              ...fadeUp(0.45),
            }}
          >
            <HelpCircle style={{ width: 16, height: 16 }} />
            How to Play
          </div>

          {/* Stake tiers */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              ...fadeUp(0.5),
            }}
          >
            {STAKE_TIERS.map((t) => (
              <span key={t} className="tier-chip">
                <span style={{ color: "#00ffa3", fontSize: 11 }}>◆</span>
                {t}
              </span>
            ))}
          </div>

          {/* Username Setting (when connected) */}
          {connected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ marginTop: 32, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}
            >
              <UsernameSetting />
            </motion.div>
          )}
        </section>

        {/* STATS BAR */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 800,
            margin: "20px auto 60px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
            ...fadeUp(0.55),
          }}
        >
          {[
            { label: "Games Played", value: stats?.totalGames || 0, suffix: "+", icon: Gamepad2 },
            { label: "Players", value: usernameCount || stats?.uniquePlayers || 0, suffix: "", icon: Users },
            { label: "SOL Wagered", value: Math.round(stats?.totalSolWagered || 0), suffix: " ◎", icon: Coins },
          ].map((s, i) => (
            <div key={i} className="stat-card-new">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                <s.icon style={{ width: 20, height: 20, color: i === 0 ? "#9945ff" : i === 1 ? "#00ffa3" : "#eab308" }} />
              </div>
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#e8e8f0",
                  marginBottom: 4,
                }}
              >
                <AnimatedNumber target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 13, color: "#6b6b80", fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* FEATURES */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 40px 80px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 48,
              ...fadeUp(0.6),
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#9945ff",
                marginBottom: 12,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              Why SolMate
            </h2>
            <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Built for competitive players
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 16,
            }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feature-card"
                style={fadeUp(0.65 + i * 0.08)}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: `${f.accent}10`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    marginBottom: 20,
                    transition: "transform 0.3s",
                    transform: hoveredFeature === i ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "#e8e8f0",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "#6b6b80",
                    lineHeight: 1.6,
                    fontWeight: 400,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 900,
            margin: "0 auto",
            padding: "40px 40px 100px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 48, ...fadeUp(0.9) }}>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#00ffa3",
                marginBottom: 12,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              How it Works
            </h2>
            <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Three steps to victory
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                step: "01",
                title: "Connect & Stake",
                desc: "Connect your Phantom or Solflare wallet. Choose your stake tier and enter the arena.",
              },
              {
                step: "02",
                title: "Get Matched & Play",
                desc: "Auto-matchmaking pairs you with a player at your tier. 10-minute clocks. Every move counts.",
              },
              {
                step: "03",
                title: "Win & Collect",
                desc: "Checkmate your opponent. 90% of the stake pool hits your wallet instantly. No waiting.",
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 28,
                  alignItems: "flex-start",
                  padding: "28px 0",
                  borderBottom:
                    i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  ...fadeUp(0.95 + i * 0.08),
                }}
              >
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 40,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.06)",
                    minWidth: 70,
                    lineHeight: 1,
                  }}
                >
                  {s.step}
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      marginBottom: 6,
                      color: "#e8e8f0",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 15,
                      color: "#6b6b80",
                      lineHeight: 1.6,
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Token Banner Section */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 800,
            margin: "0 auto",
            padding: "0 40px 60px",
            ...fadeUp(1.1),
          }}
        >
          <a 
            href="https://pump.fun/coin/5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, rgba(153,69,255,0.1), rgba(0,255,163,0.1))",
                border: "1px solid rgba(153,69,255,0.3)",
                borderRadius: 20,
                padding: "24px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                transition: "all 0.3s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #9945ff, #00ffa3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles style={{ width: 24, height: 24, color: "white" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#e8e8f0", marginBottom: 4 }}>
                    SOLMATE Token
                  </h3>
                  <p style={{ fontSize: 14, color: "#6b6b80" }}>
                    Trade the official SolMate token on Pump.fun
                  </p>
                </div>
              </div>
              <div
                style={{
                  background: "linear-gradient(135deg, #00ffa3, #9945ff)",
                  color: "#07070e",
                  fontWeight: 700,
                  padding: "12px 24px",
                  borderRadius: 12,
                  fontSize: 14,
                }}
              >
                Trade Now →
              </div>
            </div>
          </a>
        </section>

        {/* CTA FOOTER */}
        <section
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 800,
            margin: "0 auto",
            padding: "0 40px 80px",
            textAlign: "center",
            ...fadeUp(1.2),
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(0,255,163,0.04), rgba(153,69,255,0.04))",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 24,
              padding: "56px 40px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 200,
                height: 1,
                background: "linear-gradient(90deg, transparent, #00ffa3, transparent)",
              }}
            />
            <h2
              style={{
                fontSize: 32,
                fontWeight: 800,
                marginBottom: 14,
                letterSpacing: "-0.02em",
              }}
            >
              Ready to play?
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#6b6b80",
                marginBottom: 32,
                maxWidth: 400,
                margin: "0 auto 32px",
                lineHeight: 1.6,
              }}
            >
              Connect your wallet and enter the arena. Your next checkmate is
              waiting.
            </p>
            <button 
              className="btn-primary-new"
              disabled={!connected}
              onClick={() => router.push("/play")}
            >
              {connected ? "Enter the Arena" : "Connect Wallet to Play"}
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1200,
            margin: "0 auto",
            padding: "24px 40px 40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Image 
              src="/images/solmate-logo.png" 
              alt="SolMate" 
              width={24} 
              height={24}
            />
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                color: "#6b6b80",
              }}
            >
              SolMate © 2026
            </span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <a
              href="/security"
              style={{ color: "#6b6b80", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
            >
              Security Audit
            </a>
            <a
              href="/refund"
              style={{ color: "#6b6b80", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
            >
              Claim Refund
            </a>
            <a
              href="/privacy.html"
              style={{ color: "#6b6b80", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
            >
              Privacy Policy
            </a>
            <a
              href="/terms.html"
              style={{ color: "#6b6b80", fontSize: 13, textDecoration: "none", transition: "color 0.2s" }}
            >
              Terms of Service
            </a>
          </div>
        </footer>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '672px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#0a0a0a',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <button
              onClick={() => setShowHowToPlay(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '8px',
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X style={{ width: '20px', height: '20px', color: 'white' }} />
            </button>

            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center', color: 'white', WebkitTextFillColor: 'white' }}>
                How to Play SolMate
              </h2>

              {/* Step 1 */}
              <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(153, 69, 255, 0.3)', backgroundColor: '#1a1a2e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#9945FF' }}>1</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Connect Your Wallet</h3>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                  <p>Click the wallet button in the top right to connect your Solana wallet.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(20, 241, 149, 0.3)', backgroundColor: '#0d1a0d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#14F195' }}>2</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Create Username</h3>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                  <p>Set your username to appear on the leaderboard and in multiplayer games.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(234, 179, 8, 0.3)', backgroundColor: '#1a1a1a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#eab308' }}>3</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Holder Arena ($500 Prize Pool!)</h3>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                  <p>Hold <strong style={{ color: 'white' }}>2M+ $MATE</strong> or <strong style={{ color: 'white' }}>10K+ $SKR</strong> tokens to unlock the exclusive Holder Arena. Play vs AI, compete on the leaderboard!</p>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(153, 69, 255, 0.3)', backgroundColor: '#1a1a2e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#9945FF' }}>4</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Free Play with Friends</h3>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                  <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Train vs AI:</strong> Click "Practice Mode" on home page</p>
                  <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Host a Game:</strong> Practice Mode → Create Game → Share 4-letter code</p>
                  <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Join a Game:</strong> Practice Mode → Enter friend's code → Join</p>
                  <p style={{ marginTop: '12px', color: '#a3a3a3', fontStyle: 'italic' }}>💡 Tip: You can also access Free Play from "Enter Arena" → "Free Play" tab!</p>
                </div>
              </div>

              {/* Step 5 */}
              <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', border: '1px solid rgba(249, 115, 22, 0.3)', backgroundColor: '#1a0d0d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', backgroundColor: '#f97316' }}>5</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', WebkitTextFillColor: 'white' }}>Staked Wager Matches</h3>
                </div>
                <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                  <p style={{ marginBottom: '8px' }}><strong style={{ color: 'white' }}>Host:</strong> Enter Arena → Host Match → Select stake (0.05-1 SOL)</p>
                  <p><strong style={{ color: 'white' }}>Join:</strong> Enter Arena → Join Match → Winner takes 90%!</p>
                </div>
              </div>

              <button
                onClick={() => setShowHowToPlay(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '16px',
                  fontWeight: '600',
                  background: 'linear-gradient(to right, #9945FF, #14F195)',
                  color: '#ffffff',
                  WebkitTextFillColor: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Got it, let's play!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
