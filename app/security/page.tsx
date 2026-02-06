'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// ─── PARTICLE BACKGROUND (subtle, fewer particles for document page) ───
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
    const particles = Array.from({ length: 22 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
      r: Math.random() * 1.2 + 0.4, o: Math.random() * 0.15 + 0.03,
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
            ctx!.strokeStyle = `rgba(0,255,163,${0.03 * (1 - dist / 100)})`;
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

// ─── ANIMATION DEFAULTS ───
const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.55, ease },
});

// ─── STYLES ───
const S = {
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 28,
    marginBottom: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#9945ff',
    fontFamily: "'Space Mono', monospace",
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  } as React.CSSProperties,
  subCard: {
    background: 'rgba(255,255,255,0.015)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 8,
    transition: 'background 0.2s, border-color 0.2s',
  } as React.CSSProperties,
  subCardHover: {
    background: 'rgba(255,255,255,0.025)',
    borderColor: 'rgba(255,255,255,0.06)',
  } as React.CSSProperties,
  label: { fontSize: 14, color: '#6b6b80' } as React.CSSProperties,
  value: { fontSize: 14, color: '#e8e8f0' } as React.CSSProperties,
  mono: { fontFamily: "'Space Mono', monospace", fontSize: 13 } as React.CSSProperties,
  divider: { borderBottom: '1px solid rgba(255,255,255,0.04)' } as React.CSSProperties,
  desc: { fontSize: 13, color: '#6b6b80', lineHeight: 1.55 } as React.CSSProperties,
};

// ─── HOVERABLE SUB-CARD ───
function SubCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      style={S.subCard}
      onMouseEnter={() => { if (ref.current) { ref.current.style.background = 'rgba(255,255,255,0.025)'; ref.current.style.borderColor = 'rgba(255,255,255,0.06)'; } }}
      onMouseLeave={() => { if (ref.current) { ref.current.style.background = 'rgba(255,255,255,0.015)'; ref.current.style.borderColor = 'rgba(255,255,255,0.03)'; } }}
    >
      {children}
    </div>
  );
}

export default function SecurityAuditPage() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#07070e', fontFamily: "'Outfit', sans-serif" }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'rgba(153,69,255,0.04)', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0 }} />
      <ParticleField />

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', padding: '56px 20px 80px' }}>

        {/* ── HEADER ── */}
        <motion.div {...fadeUp(0)} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              🛡️
            </div>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 8px', fontFamily: "'Outfit', sans-serif" }}>Security Audit Report</h1>
          <p style={{ fontSize: 15, color: '#6b6b80', margin: '0 0 16px' }}>SolMate Chess Escrow Smart Contract</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.12)', borderRadius: 999, padding: '5px 14px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#00ffa3' }}>
            Solana Mainnet • Anchor v0.29.0
          </div>
        </motion.div>

        {/* ── EXECUTIVE SUMMARY ── */}
        <motion.section {...fadeUp(0.05)} style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: 28, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', margin: 0 }}>Overall Assessment: PASS</h2>
          </div>
          <p style={{ fontSize: 14, color: '#a0a0b8', margin: '0 0 20px', lineHeight: 1.55 }}>
            The SolMate escrow program has undergone comprehensive security review and is deployed on Solana Mainnet.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {['Code Quality', 'Arithmetic Safety', 'Access Control', 'PDA Security', 'Frontend Security'].map((label) => (
              <div key={label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>✓</div>
                <div style={{ fontSize: 12, color: '#6b6b80', fontFamily: "'Space Mono', monospace" }}>{label}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── PROGRAM DETAILS ── */}
        <motion.section {...fadeUp(0.1)} style={S.card}>
          <h2 style={S.sectionTitle}>💻 Program Details</h2>
          <div>
            {([
              ['Program ID', <a key="pid" href="https://solscan.io/account/H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV" target="_blank" rel="noopener noreferrer" style={{ ...S.mono, color: '#9945ff', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#00ffa3')} onMouseLeave={e => (e.currentTarget.style.color = '#9945ff')}>H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV ↗</a>],
              ['Network', <span key="net" style={{ color: '#22c55e', fontWeight: 700 }}>Solana Mainnet</span>],
              ['Framework', <span key="fw" style={S.mono}>Anchor v0.29.0</span>],
              ['Audit Date', <span key="ad" style={S.value}>February 2, 2026 (Updated)</span>],
              ['App Version', <span key="av" style={S.mono}>1.5.0</span>],
              ['Source Code', <a key="gh" href="https://github.com/SerStakeAlot/SolMate" target="_blank" rel="noopener noreferrer" style={{ color: '#9945ff', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#00ffa3')} onMouseLeave={e => (e.currentTarget.style.color = '#9945ff')}>GitHub Repository ↗</a>],
            ] as [string, React.ReactNode][]).map(([label, val], i, arr) => (
              <div key={label} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', ...(i < arr.length - 1 ? S.divider : {}) }}>
                <span style={S.label}>{label}</span>
                {val}
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SECURITY FEATURES ── */}
        <motion.section {...fadeUp(0.15)} style={S.card}>
          <h2 style={S.sectionTitle}>🔒 Security Features</h2>
          {([
            ['Arithmetic Safety', "All arithmetic operations use Rust\u2019s checked_mul, checked_div, and checked_sub methods to prevent integer overflow/underflow vulnerabilities."],
            ['Access Control', 'Every instruction validates signers. Only authorized parties can execute actions: match creators can cancel, winners can claim payouts, and only the admin can withdraw fees.'],
            ['PDA Security', 'Program Derived Addresses (PDAs) are used for escrow accounts with unique seeds. Bumps are stored and validated to prevent address spoofing attacks.'],
            ['State Machine Integrity', 'Match status transitions are strictly enforced: Open \u2192 Matched \u2192 ResultSubmitted \u2192 Completed. Invalid state transitions are rejected by the program.'],
            ['CPI Transfer Security', 'All fund transfers use Cross-Program Invocation (CPI) to the System Program, ensuring proper signature verification and preventing unauthorized fund movements.'],
          ]).map(([title, desc]) => (
            <SubCard key={title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f0', marginBottom: 6 }}>
                <span style={{ color: '#22c55e' }}>✓ </span>{title}
              </div>
              <p style={{ ...S.desc, margin: 0 }}>{desc}</p>
            </SubCard>
          ))}
        </motion.section>

        {/* ── FRONTEND SECURITY ── */}
        <motion.section {...fadeUp(0.2)} style={S.card}>
          <h2 style={S.sectionTitle}>🌐 Frontend Security (February 2026 Update)</h2>
          {([
            ['Android WebView Hardening', "All UI components use inline styles with -webkit-text-fill-color for reliable rendering in Phantom\u2019s in-app browser and other mobile wallet WebViews."],
            ['Modal Click-Jacking Prevention', 'Critical modals (How to Play, game results, payouts) use isolated rendering with z-index 99999 and proper event handling to prevent overlay attacks.'],
            ['Touch Event Security', 'Mobile-optimized touch handlers with touchAction: manipulation prevent unintended zoom gestures and ensure reliable button interactions on all devices.'],
          ]).map(([title, desc]) => (
            <SubCard key={title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f0', marginBottom: 6 }}>
                <span style={{ color: '#22c55e' }}>✓ </span>{title}
              </div>
              <p style={{ ...S.desc, margin: 0 }}>{desc}</p>
            </SubCard>
          ))}
        </motion.section>

        {/* ── ANTI-ABUSE MEASURES ── */}
        <motion.section {...fadeUp(0.25)} style={S.card}>
          <h2 style={S.sectionTitle}>⚠️ Anti-Abuse Measures</h2>
          {([
            ['Arena Leaderboard Protection', 'Resignations in the Holder Arena do not count towards leaderboard standings, preventing score farming through intentional losses.'],
            ['AI Difficulty Calibration', 'Arena AI uses opening book and move ordering at ~1500 ELO to prevent trivial wins while maintaining fair competition for the $500 prize pool.'],
            ['Token Gate Verification', 'Holder Arena requires verified ownership of 2M+ $MATE or 10K+ $SKR tokens, with real-time balance checks to prevent unauthorized access.'],
          ]).map(([title, desc]) => (
            <SubCard key={title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f0', marginBottom: 6 }}>
                <span style={{ color: '#22c55e' }}>✓ </span>{title}
              </div>
              <p style={{ ...S.desc, margin: 0 }}>{desc}</p>
            </SubCard>
          ))}
        </motion.section>

        {/* ── HOW THE ESCROW WORKS ── */}
        <motion.section {...fadeUp(0.3)} style={S.card}>
          <h2 style={S.sectionTitle}>🔄 How the Escrow Works</h2>
          <div style={{ position: 'relative' }}>
            {([
              ['Create Match', 'Player A creates a match and deposits their stake into a program-controlled escrow PDA.'],
              ['Join Match', 'Player B joins by depositing a matching stake. Both stakes are now locked in escrow.'],
              ['Play Chess', 'Players compete in real-time chess. The game server tracks moves and determines the winner.'],
              ['Submit Result', 'The backend authority submits the game result (winner or draw) to the program.'],
              ['Claim Payout', 'Winner receives 90% of the total pot. 10% goes to the platform fee vault. In case of a draw, both players are refunded.'],
            ]).map(([title, desc], i, arr) => (
              <div key={title} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                {/* Vertical connector line */}
                {i < arr.length - 1 && (
                  <div style={{ position: 'absolute', left: 15, top: 36, width: 1, height: 'calc(100% - 20px)', background: 'rgba(153,69,255,0.1)' }} />
                )}
                <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'rgba(153,69,255,0.1)', border: '1px solid rgba(153,69,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9945ff', fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, position: 'relative', zIndex: 1 }}>
                  {i + 1}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? 20 : 0, flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0', margin: '0 0 4px' }}>{title}</h3>
                  <p style={{ ...S.desc, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── FEE STRUCTURE ── */}
        <motion.section {...fadeUp(0.35)} style={S.card}>
          <h2 style={S.sectionTitle}>💰 Fee Structure</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 36, fontWeight: 800, color: '#22c55e' }}>90%</div>
              <div style={{ fontSize: 12, color: '#6b6b80', marginTop: 4 }}>Winner Payout</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 36, fontWeight: 800, color: '#9945ff' }}>10%</div>
              <div style={{ fontSize: 12, color: '#6b6b80', marginTop: 4 }}>Platform Fee</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#444', marginTop: 16, marginBottom: 0 }}>
            Example: In a 0.1 SOL match (0.05 SOL each), winner receives 0.09 SOL and platform collects 0.01 SOL.
          </p>
        </motion.section>

        {/* ── STAKE TIERS ── */}
        <motion.section {...fadeUp(0.4)} style={S.card}>
          <h2 style={S.sectionTitle}>🎯 Available Stake Tiers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {([
              ['0.05', '#06b6d4'],
              ['0.1', '#22c55e'],
              ['0.5', '#9945ff'],
              ['1.0', '#ef4444'],
            ] as [string, string][]).map(([amount, accentColor]) => (
              <div key={amount} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderTop: `2px solid ${accentColor}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 800, color: '#e8e8f0' }}>{amount}</div>
                <div style={{ fontSize: 12, color: '#6b6b80', marginTop: 4 }}>SOL</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── ATTACK VECTORS REVIEWED ── */}
        <motion.section {...fadeUp(0.45)} style={S.card}>
          <h2 style={S.sectionTitle}>🔍 Attack Vectors Reviewed</h2>
          {([
            ['Re-entrancy', 'Not Applicable (Solana prevents by design)'],
            ['Integer Overflow', 'Protected (checked arithmetic)'],
            ['Front-running', 'Low Risk (first-come-first-served)'],
            ['Denial of Service', 'Minimal (no unbounded loops)'],
            ['Unauthorized Withdrawal', 'Protected (signer validation)'],
          ]).map(([attack, status], i, arr) => (
            <div key={attack} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', ...(i < arr.length - 1 ? S.divider : {}) }}>
              <span style={{ color: '#a0a0b8', fontSize: 14 }}>{attack}</span>
              <span style={{ color: '#22c55e', fontSize: 13 }}>{status}</span>
            </div>
          ))}
        </motion.section>

        {/* ── KNOWN LIMITATIONS ── */}
        <motion.section {...fadeUp(0.5)} style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.04), rgba(234,179,8,0.01))', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 20, padding: 28, marginBottom: 20 }}>
          <h2 style={{ ...S.sectionTitle, color: '#eab308' }}>⚠️ Known Limitations</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              'Upstream dependency advisories exist in Solana SDK (affects all Anchor programs)',
              'Game result submission requires trust in the backend authority',
              'No time-based match expiration (unmatched games must be manually cancelled)',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, lineHeight: 1.55 }}>
                <span style={{ color: '#eab308', flexShrink: 0 }}>•</span>
                <span style={{ color: '#a0a0b8' }}>{item}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* ── DISCLAIMER ── */}
        <motion.section {...fadeUp(0.55)} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 20, padding: 28, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#6b6b80', margin: '0 0 12px' }}>Disclaimer</h2>
          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 }}>
            This security audit was conducted internally by the SolMate development team. While comprehensive
            testing and review have been performed, no audit can guarantee the complete absence of vulnerabilities.
            Users should only stake amounts they can afford to lose. Smart contract interactions carry inherent risks.
          </p>
        </motion.section>

        {/* ── BACK TO HOME ── */}
        <motion.div {...fadeUp(0.6)} style={{ textAlign: 'center', marginTop: 32 }}>
          <Link
            href="/"
            style={{ color: '#9945ff', fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00ffa3')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9945ff')}
          >
            ← Back to Home
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
