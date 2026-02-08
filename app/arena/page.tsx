'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trophy, Zap, Shield, Crown, ExternalLink, Loader2, DollarSign, Gift, Calendar, Copy, Check } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { ArenaChessGame } from '@/components/ArenaChessGame';
import { ArenaLeaderboard } from '@/components/ArenaLeaderboard';
import { 
  checkHolderArenaAccess, 
  SOLMATE_TOKEN_MINT,
  SKR_TOKEN_MINT,
  formatTokenBalance,
  formatSkrBalance,
  getMinimumRequiredDisplay,
  getSkrMinimumRequiredDisplay
} from '@/utils/tokenGate';

export default function ArenaPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  
  const [accessStatus, setAccessStatus] = useState<{
    checked: boolean;
    hasAccess: boolean;
    balance: number;
    mateBalance?: number;
    skrBalance?: number;
    qualifyingToken?: 'MATE' | 'SKR' | null;
    error?: string;
  }>({ checked: false, hasAccess: false, balance: 0 });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Check token gate access
  const checkAccess = useCallback(async () => {
    if (!connected || !publicKey) {
      setAccessStatus({ checked: true, hasAccess: false, balance: 0 });
      return;
    }

    try {
      const result = await checkHolderArenaAccess(connection, publicKey.toBase58());
      setAccessStatus({
        checked: true,
        hasAccess: result.hasAccess,
        balance: result.balance,
        mateBalance: result.mateBalance,
        skrBalance: result.skrBalance,
        qualifyingToken: result.qualifyingToken,
        error: result.error,
      });
    } catch (error: any) {
      setAccessStatus({
        checked: true,
        hasAccess: false,
        balance: 0,
        error: error.message,
      });
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Locked state - wallet not connected
  if (!connected) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={{ background: '#07070e' }}>
        <LockedHero 
          reason="wallet"
          onConnect={() => {}}
        />
      </div>
    );
  }

  // Loading state
  if (!accessStatus.checked) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-solana-purple animate-spin mx-auto mb-4" />
          <p className="text-white/60">Checking token balance...</p>
        </div>
      </div>
    );
  }

  // Locked state - insufficient tokens
  if (!accessStatus.hasAccess) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={{ background: '#07070e' }}>
        <LockedHero 
          reason="tokens"
          mateBalance={accessStatus.mateBalance}
          skrBalance={accessStatus.skrBalance}
        />
      </div>
    );
  }

  // Access granted - show arena
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#07070e', color: '#e8e8f0', fontFamily: "'Outfit', 'SF Pro Display', sans-serif" }}>
      <ParticleField />

      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: '-10%', left: '30%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(234,179,8,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-5%', right: '5%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(153,69,255,0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <style>{`
        @keyframes arena-glow-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes arena-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .arena-gold-shimmer {
          background: linear-gradient(90deg, #eab308 0%, #fde68a 25%, #eab308 50%, #fde68a 75%, #eab308 100%);
          background-size: 200% auto;
          animation: arena-shimmer 3s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: isPlaying ? 960 : 760, margin: '0 auto', padding: isPlaying ? '12px 24px 40px' : '20px 24px 80px', textAlign: 'center', transition: 'max-width 0.3s' }}>

        {/* Header — compact when game is active */}
        <div style={{ marginBottom: isPlaying ? 4 : 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: isPlaying ? 4 : 8 }}>
            <span style={{ fontSize: isPlaying ? 20 : 28 }}>👑</span>
            <h1 style={{ fontSize: isPlaying ? 24 : 36, fontWeight: 800, letterSpacing: '-0.03em' }}>
              <span className="arena-gold-shimmer">Holder Arena</span>
            </h1>
            <span style={{ fontSize: isPlaying ? 20 : 28 }}>👑</span>
          </div>
          {!isPlaying && (
            <p style={{ fontSize: 15, color: '#6b6b80' }}>
              Exclusive AI challenge for $MATE & $SKR token holders
            </p>
          )}
        </div>

        {/* Access badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 100, marginBottom: isPlaying ? 12 : 28,
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
            background: '#22c55e',
            animation: 'arena-glow-pulse 2s infinite',
          }} />
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#22c55e',
            fontFamily: "'Space Mono', monospace",
          }}>
            Access Granted • {formatTokenBalance(accessStatus.balance)}
          </span>
        </div>

        {/* Tab Navigation — hidden when game active */}
        {!isPlaying && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
            {[
              { id: 'play', label: '⚡ Play Arena', active: !showLeaderboard && !isPlaying },
              { id: 'leaderboard', label: '🏆 Leaderboard', active: showLeaderboard },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'play') { setShowLeaderboard(false); setIsPlaying(false); }
                  else { setShowLeaderboard(true); setIsPlaying(false); }
                }}
                style={{
                  padding: '12px 28px', borderRadius: 12,
                  fontSize: 14, fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: 'pointer', transition: 'all 0.25s',
                  border: tab.active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  background: tab.active
                    ? 'linear-gradient(135deg, #eab308, #f59e0b)'
                    : 'rgba(255,255,255,0.02)',
                  color: tab.active ? '#07070e' : '#6b6b80',
                  WebkitTextFillColor: tab.active ? '#07070e' : '#6b6b80',
                  boxShadow: tab.active
                    ? '0 4px 20px rgba(234,179,8,0.25)'
                    : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {/* Content */}
        <AnimatePresence mode="wait">
          {showLeaderboard ? (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ArenaLeaderboard walletAddress={publicKey?.toBase58()} />
            </motion.div>
          ) : isPlaying ? (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ArenaChessGame 
                walletAddress={publicKey?.toBase58() || ''} 
                onGameEnd={() => setIsPlaying(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ArenaLobby onStartGame={() => setIsPlaying(true)} walletAddress={publicKey?.toBase58() || ''} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Copyable Address Component
function CopyableAddress({ label, address, accentColor = '#9945ff' }: { label: string; address: string; accentColor?: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopy = async () => {
    // Method 1: Modern Clipboard API (works on HTTPS)
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(address);
        markCopied();
        return;
      }
    } catch (_) { /* fall through */ }

    // Method 2: Temporary textarea + execCommand (iOS Safari / Android / older browsers)
    try {
      const ta = document.createElement('textarea');
      ta.value = address;
      ta.setAttribute('readonly', '');
      // Prevent zoom on iOS
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;font-size:16px;';
      document.body.appendChild(ta);

      // iOS-specific selection
      const range = document.createRange();
      const sel = window.getSelection();
      ta.contentEditable = 'true';
      ta.readOnly = false;
      range.selectNodeContents(ta);
      sel?.removeAllRanges();
      sel?.addRange(range);
      ta.setSelectionRange(0, 999999);

      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { markCopied(); return; }
    } catch (_) { /* fall through */ }

    // Method 3: Hidden textarea ref fallback
    if (textAreaRef.current) {
      textAreaRef.current.select();
      textAreaRef.current.setSelectionRange(0, 999999);
      try {
        if (document.execCommand('copy')) { markCopied(); return; }
      } catch (_) { /* ignore */ }
    }
  };

  const truncated = address.slice(0, 6) + '...' + address.slice(-4);
  const isGold = accentColor === '#eab308';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCopy}
      role="button"
      tabIndex={0}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
        background: hovered
          ? `linear-gradient(135deg, ${accentColor}12, ${accentColor}08)`
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? accentColor + '30' : 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        width: '100%', boxSizing: 'border-box',
      }}
    >
      {/* Hidden textarea for fallback copy */}
      <textarea
        ref={textAreaRef}
        value={address}
        readOnly
        aria-hidden
        tabIndex={-1}
        style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, fontSize: 16 }}
      />

      {/* Left: label + address */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${accentColor}14`,
          border: `1px solid ${accentColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: accentColor,
          fontFamily: "'Space Mono', monospace",
        }}>
          {isGold ? '♟' : '⬡'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#e8e8f0',
            marginBottom: 2, fontFamily: "'Outfit', sans-serif",
          }}>
            {label} Token
          </div>
          <div style={{
            fontSize: 12, fontFamily: "'Space Mono', monospace",
            color: '#6b6b80', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {/* Show truncated on small screens, full on larger */}
            <span style={{ display: 'none' }} className="addr-full">{address}</span>
            <span>{truncated}</span>
          </div>
        </div>
      </div>

      {/* Right: copy button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 10, flexShrink: 0,
        fontSize: 12, fontWeight: 700, fontFamily: "'Outfit', sans-serif",
        transition: 'all 0.2s',
        background: copied
          ? 'rgba(34,197,94,0.12)'
          : `${accentColor}15`,
        border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : accentColor + '30'}`,
        color: copied ? '#22c55e' : accentColor,
      }}>
        {copied ? (
          <><Check style={{ width: 14, height: 14 }} /> Copied!</>
        ) : (
          <><Copy style={{ width: 14, height: 14 }} /> Copy</>
        )}
      </div>
    </div>
  );
}

// ─── PARTICLE BACKGROUND ───
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const particles = Array.from({ length: 45 }, () => ({
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
        ctx!.fillStyle = `rgba(234,179,8,${p.o})`; ctx!.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx!.beginPath(); ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(234,179,8,${0.03 * (1 - dist / 100)})`;
            ctx!.lineWidth = 0.5; ctx!.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

// Locked Hero Component
function LockedHero({ reason, mateBalance, skrBalance, onConnect }: { 
  reason: 'wallet' | 'tokens';
  mateBalance?: number;
  skrBalance?: number;
  onConnect?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [hoveredBenefit, setHoveredBenefit] = useState<number | null>(null);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const fadeUp = (delay = 0): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  const BENEFITS = [
    { icon: '⚡', title: 'Unlimited AI Matches', desc: 'Challenge our high-ELO bot anytime' },
    { icon: '🏆', title: 'All-Time Leaderboard', desc: 'Compete for the #1 spot' },
    { icon: '🛡️', title: 'Exclusive Access', desc: 'Token holders only arena' },
  ];

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      color: '#e8e8f0', fontFamily: "'Outfit', 'SF Pro Display', sans-serif",
    }}>
      {/* Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Particle field */}
      <ParticleField />

      {/* Ambient glows — gold theme */}
      <div style={{ position: 'absolute', top: '-15%', left: '20%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(234,179,8,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(153,69,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <style>{`
        @keyframes glow-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .gold-shimmer {
          background: linear-gradient(90deg, #eab308 0%, #fde68a 25%, #eab308 50%, #fde68a 75%, #eab308 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* ─── MAIN CONTENT ─── */}
      <div style={{
        position: 'relative', zIndex: 1, maxWidth: 700, margin: '0 auto',
        padding: '40px 24px 80px', textAlign: 'center',
      }}>

        {/* Lock icon */}
        <div style={{ marginBottom: 28, ...fadeUp(0.1) }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
            background: 'linear-gradient(135deg, rgba(234,179,8,0.1), rgba(234,179,8,0.03))',
            border: '1px solid rgba(234,179,8,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            animation: 'float 4s ease-in-out infinite',
          }}>
            <Lock style={{ width: 42, height: 42, color: '#eab308' }} />
            {/* Crown badge */}
            <div style={{
              position: 'absolute', top: -6, right: -6,
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #eab308, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(234,179,8,0.4)',
            }}>
              <Crown style={{ width: 18, height: 18, color: '#07070e' }} />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800,
          letterSpacing: '-0.03em', marginBottom: 12,
          ...fadeUp(0.15),
        }}>
          <span className="gold-shimmer">Holder Arena</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 16, color: '#6b6b80', maxWidth: 400, margin: '0 auto 32px',
          lineHeight: 1.6, ...fadeUp(0.2),
        }}>
          {reason === 'wallet'
            ? 'Connect your wallet to access the exclusive Holder Arena'
            : 'Hold $MATE or $SKR tokens to unlock the exclusive Holder Arena'
          }
        </p>

        {/* Prize Banner */}
        <div style={{
          margin: '0 auto 40px', maxWidth: 420,
          padding: '20px 28px',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.04))',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 20, position: 'relative', overflow: 'hidden',
          ...fadeUp(0.25),
        }}>
          {/* Top glow line */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: 150, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.6), transparent)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DollarSign style={{ width: 22, height: 22, color: '#22c55e' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: "'Space Mono', monospace",
                color: '#22c55e', letterSpacing: '-0.02em',
              }}>$500</div>
              <div style={{ fontSize: 13, color: '#6b6b80', fontWeight: 500 }}>
                Prize pool — top 3 win!
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14, marginBottom: 40,
        }}>
          {BENEFITS.map((b, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredBenefit(i)}
              onMouseLeave={() => setHoveredBenefit(null)}
              style={{
                background: hoveredBenefit === i
                  ? 'rgba(234,179,8,0.04)'
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${hoveredBenefit === i
                  ? 'rgba(234,179,8,0.15)'
                  : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 18, padding: '28px 20px',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredBenefit === i ? 'translateY(-3px)' : 'translateY(0)',
                cursor: 'default',
                ...fadeUp(0.3 + i * 0.06),
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(234,179,8,0.08)',
                border: '1px solid rgba(234,179,8,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, margin: '0 auto 14px',
                transition: 'transform 0.3s',
                transform: hoveredBenefit === i ? 'scale(1.1)' : 'scale(1)',
              }}>{b.icon}</div>
              <h3 style={{
                fontSize: 15, fontWeight: 700, marginBottom: 5, color: '#e8e8f0',
              }}>{b.title}</h3>
              <p style={{
                fontSize: 13, color: '#6b6b80', lineHeight: 1.5,
              }}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Action section */}
        {reason === 'wallet' ? (
          <>
            {/* Connect Wallet CTA */}
            <div style={{ ...fadeUp(0.5) }}>
              <WalletButton />
              <p style={{
                marginTop: 14, fontSize: 12, color: '#444',
                fontFamily: "'Space Mono', monospace",
              }}>
                Requires $MATE or $SKR tokens
              </p>
            </div>

            {/* Divider */}
            <div style={{
              width: 60, height: 1, margin: '40px auto',
              background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.2), transparent)',
              ...fadeUp(0.55),
            }} />

            {/* Token info for users who don't have tokens yet */}
            <div style={{ ...fadeUp(0.6) }}>
              <p style={{
                fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#444', marginBottom: 16,
                fontFamily: "'Space Mono', monospace",
              }}>Don&apos;t have tokens yet?</p>

              <div style={{
                display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
              }}>
                <a
                  href={`https://pump.fun/coin/${SOLMATE_TOKEN_MINT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(234,179,8,0.1), rgba(234,179,8,0.04))',
                    border: '1px solid rgba(234,179,8,0.2)',
                    color: '#eab308', fontSize: 14, fontWeight: 700,
                    textDecoration: 'none', fontFamily: "'Outfit', sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  Get $MATE
                  <ExternalLink style={{ width: 12, height: 12 }} />
                </a>
                <a
                  href="https://solanamobile.com/skr"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '12px 24px', borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(153,69,255,0.1), rgba(153,69,255,0.04))',
                    border: '1px solid rgba(153,69,255,0.2)',
                    color: '#9945ff', fontSize: 14, fontWeight: 700,
                    textDecoration: 'none', fontFamily: "'Outfit', sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  Get $SKR
                  <ExternalLink style={{ width: 12, height: 12 }} />
                </a>
              </div>
            </div>

            {/* Token Addresses */}
            <div style={{ ...fadeUp(0.65), maxWidth: 480, margin: '24px auto 0', padding: '0 16px' }}>
              <p style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#444', marginBottom: 14,
                fontFamily: "'Space Mono', monospace",
              }}>Token Addresses (tap to copy)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                <CopyableAddress label="$MATE" address={SOLMATE_TOKEN_MINT} accentColor="#eab308" />
                <CopyableAddress label="$SKR" address={SKR_TOKEN_MINT} accentColor="#9945ff" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Token Balance Display */}
            <div style={{ ...fadeUp(0.5) }}>
              <div style={{
                display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
                marginBottom: 28,
              }}>
                {/* MATE Balance */}
                <div style={{
                  padding: '24px 28px', borderRadius: 18, textAlign: 'center',
                  minWidth: 180,
                  background: 'rgba(234,179,8,0.04)',
                  border: '1px solid rgba(234,179,8,0.15)',
                }}>
                  <p style={{ fontSize: 13, color: '#6b6b80', marginBottom: 8, fontWeight: 600 }}>$MATE</p>
                  <p style={{
                    fontSize: 22, color: '#eab308', fontWeight: 800,
                    fontFamily: "'Space Mono', monospace", marginBottom: 8,
                  }}>{formatTokenBalance(mateBalance || 0)}</p>
                  <p style={{ fontSize: 11, color: '#444' }}>Need: {getMinimumRequiredDisplay()}</p>
                </div>

                {/* SKR Balance */}
                <div style={{
                  padding: '24px 28px', borderRadius: 18, textAlign: 'center',
                  minWidth: 180,
                  background: 'rgba(153,69,255,0.04)',
                  border: '1px solid rgba(153,69,255,0.15)',
                }}>
                  <p style={{ fontSize: 13, color: '#6b6b80', marginBottom: 8, fontWeight: 600 }}>$SKR</p>
                  <p style={{
                    fontSize: 22, color: '#9945ff', fontWeight: 800,
                    fontFamily: "'Space Mono', monospace", marginBottom: 8,
                  }}>{formatSkrBalance(skrBalance || 0)}</p>
                  <p style={{ fontSize: 11, color: '#444' }}>Need: {getSkrMinimumRequiredDisplay()}</p>
                </div>
              </div>
            </div>

            {/* Get Tokens Buttons */}
            <div style={{ ...fadeUp(0.55) }}>
              <div style={{
                display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
                marginBottom: 28,
              }}>
                <a
                  href={`https://pump.fun/coin/${SOLMATE_TOKEN_MINT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 14,
                    background: 'linear-gradient(135deg, #eab308 0%, #f59e0b 50%, #eab308 100%)',
                    color: '#07070e', fontSize: 15, fontWeight: 800,
                    textDecoration: 'none', fontFamily: "'Outfit', sans-serif",
                    boxShadow: '0 8px 32px rgba(234,179,8,0.25)',
                    transition: 'all 0.3s',
                  }}
                >
                  Get $MATE
                  <ExternalLink style={{ width: 14, height: 14 }} />
                </a>
                <a
                  href="https://solanamobile.com/skr"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(153,69,255,0.15), rgba(153,69,255,0.08))',
                    border: '1px solid rgba(153,69,255,0.3)',
                    color: '#9945ff', fontSize: 15, fontWeight: 800,
                    textDecoration: 'none', fontFamily: "'Outfit', sans-serif",
                    transition: 'all 0.3s',
                  }}
                >
                  Get $SKR
                  <ExternalLink style={{ width: 14, height: 14 }} />
                </a>
              </div>
            </div>

            {/* Token Addresses */}
            <div style={{ ...fadeUp(0.6), maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
              <p style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#444', marginBottom: 14,
                fontFamily: "'Space Mono', monospace",
              }}>Token Addresses (tap to copy)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                <CopyableAddress label="$MATE" address={SOLMATE_TOKEN_MINT} accentColor="#eab308" />
                <CopyableAddress label="$SKR" address={SKR_TOKEN_MINT} accentColor="#9945ff" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Arena Lobby Component
const ARENA_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';
const MAX_DAILY_GAMES = 20;

function ArenaLobby({ onStartGame, walletAddress }: { onStartGame: () => void; walletAddress: string }) {
  const [hoveredRule, setHoveredRule] = useState<number | null>(null);
  const [gamesRemaining, setGamesRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | undefined>();

  useEffect(() => {
    if (!walletAddress) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${ARENA_BACKEND_URL}/api/arena/status/${walletAddress}`);
        const data = await res.json();
        const remaining = data.gamesRemainingToday ?? MAX_DAILY_GAMES;
        setGamesRemaining(remaining);
        setLimitReached(remaining <= 0);
        if (data.cooldownEndsAt) setCooldownEndsAt(data.cooldownEndsAt);
      } catch {
        // If we can't reach backend, allow play (backend will enforce)
        setGamesRemaining(null);
        setLimitReached(false);
      }
    };
    fetchStatus();
  }, [walletAddress]);

  const RULES = [
    'Play against SolMate AI (~1500 ELO with opening book)',
    'Maximum 20 games per day per wallet',
    'Games must have at least 10 moves to count',
    'Resignation is allowed \u2014 losses still count toward participation',
    'All-time leaderboard \u2014 your progress is permanent!',
  ];

  const SCORING = [
    { label: 'Each match played', points: '+1.0 pts', color: '#eab308' },
    { label: 'Win bonus', points: '+0.5 pts', color: '#22c55e' },
    { label: 'Share on X bonus', points: '+0.25 pts', color: '#3b82f6' },
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'left' }}>
      {/* Season Prize Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(16,185,129,0.02))',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 20,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '30%', width: 200, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>🏆</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>Season 1 Prize</span>
            </div>
            <p style={{ fontSize: 14, color: '#6b6b80' }}>Top 3 scorers win!</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 42, fontWeight: 800,
              fontFamily: "'Space Mono', monospace",
              color: '#22c55e', letterSpacing: '-0.03em', lineHeight: 1,
            }}>$500</div>
            <div style={{
              fontSize: 12, color: '#6b6b80', fontWeight: 500, marginTop: 4,
              fontFamily: "'Space Mono', monospace",
            }}>USD Prize Pool</div>
          </div>
        </div>
        <div style={{
          marginTop: 16, paddingTop: 14,
          borderTop: '1px solid rgba(34,197,94,0.1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, width: '100%' }}>
            <span style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#eab308', fontWeight: 700 }}>1st $250</span>
            <span style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#a0a0b8', fontWeight: 600 }}>2nd $150</span>
            <span style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#cd7f32', fontWeight: 600 }}>3rd $100</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>📅</span>
            <span style={{
              fontSize: 13, fontWeight: 700, color: '#eab308',
              fontFamily: "'Space Mono', monospace",
            }}>Season ends February 20, 2026</span>
          </div>
        </div>
      </div>

      {/* Rules Card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <span style={{
            fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#eab308',
            fontFamily: "'Space Mono', monospace",
          }}>Arena Rules</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {RULES.map((rule, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredRule(i)}
              onMouseLeave={() => setHoveredRule(null)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: hoveredRule === i
                  ? 'rgba(234,179,8,0.04)'
                  : 'rgba(255,255,255,0.015)',
                border: `1px solid ${hoveredRule === i
                  ? 'rgba(234,179,8,0.1)'
                  : 'rgba(255,255,255,0.03)'}`,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 8, color: '#eab308', marginTop: 6, flexShrink: 0 }}>●</span>
              <span style={{ fontSize: 14, color: '#a0a0b8', lineHeight: 1.5 }}>{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring System Card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <span style={{
            fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: '#eab308',
            fontFamily: "'Space Mono', monospace",
          }}>Scoring System</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCORING.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderRadius: 12,
              background: s.color === '#3b82f6'
                ? 'rgba(59,130,246,0.06)'
                : 'rgba(255,255,255,0.015)',
              border: `1px solid ${s.color === '#3b82f6'
                ? 'rgba(59,130,246,0.15)'
                : 'rgba(255,255,255,0.04)'}`,
            }}>
              <span style={{ fontSize: 14, color: '#a0a0b8' }}>{s.label}</span>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 15, fontWeight: 700, color: s.color,
              }}>{s.points}</span>
            </div>
          ))}
        </div>
        <p style={{
          marginTop: 14, textAlign: 'center',
          fontSize: 12, color: '#444',
          fontFamily: "'Space Mono', monospace",
        }}>
          Min 10 moves per game • Share after each match for extra points!
        </p>
      </div>

      {/* Start Match Button */}
      <div style={{ textAlign: 'center' }}>
        <motion.button
          whileHover={!limitReached ? { scale: 1.05 } : {}}
          whileTap={!limitReached ? { scale: 0.95 } : {}}
          onClick={!limitReached ? onStartGame : undefined}
          disabled={limitReached}
          style={{
            padding: '18px 56px', borderRadius: 16,
            background: limitReached
              ? 'linear-gradient(135deg, #444 0%, #555 50%, #444 100%)'
              : 'linear-gradient(135deg, #eab308 0%, #f59e0b 50%, #eab308 100%)',
            color: limitReached ? '#888' : '#07070e',
            fontSize: 18, fontWeight: 800, border: 'none',
            cursor: limitReached ? 'not-allowed' : 'pointer',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.01em',
            boxShadow: limitReached
              ? 'none'
              : '0 8px 40px rgba(234,179,8,0.3), 0 0 60px rgba(234,179,8,0.08)',
            transition: 'all 0.3s',
            opacity: limitReached ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 10,
            WebkitTextFillColor: limitReached ? '#888' : '#07070e',
          }}
        >
          <span style={{ fontSize: 20 }}>{limitReached ? '🔒' : '⚡'}</span>
          {limitReached ? 'Daily Limit Reached' : 'Start Arena Match'}
        </motion.button>
        {limitReached && (
          <p style={{
            marginTop: 12, fontSize: 13, color: '#eab308',
            fontFamily: "'Space Mono', monospace",
          }}>
            You've played {MAX_DAILY_GAMES} games today. Come back tomorrow!
          </p>
        )}
        {gamesRemaining !== null && !limitReached && (
          <p style={{
            marginTop: 10, fontSize: 12, color: '#6b6b80',
            fontFamily: "'Space Mono', monospace",
          }}>
            {gamesRemaining} / {MAX_DAILY_GAMES} games remaining today
          </p>
        )}
      </div>
    </div>
  );
}
