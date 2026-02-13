import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  staticFile,
  Audio,
  Easing,
} from 'remotion';

// ============================================
// COLOR PALETTE
// ============================================
const COLORS = {
  background: '#0b0b12',
  purple: '#9945FF',
  purpleGlow: '#9945FF66',
  gold: '#FFD700',
  green: '#14F195',
  white: '#ffffff',
  gray: '#888888',
  darkGray: '#1a1a24',
};

// ============================================
// FILM GRAIN OVERLAY
// ============================================
const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.03 }) => {
  const frame = useCurrentFrame();
  const seed = frame % 10;
  
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${seed}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ============================================
// AMBIENT GLOW BACKGROUND
// ============================================
const AmbientGlow: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.02), [-1, 1], [0.8, 1.2]);
  
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 50% 40%, ${COLORS.purple}${Math.round(15 * intensity * pulse).toString(16).padStart(2, '0')} 0%, transparent 50%),
          radial-gradient(ellipse at 30% 70%, ${COLORS.purple}0a 0%, transparent 40%),
          radial-gradient(ellipse at 70% 60%, ${COLORS.purple}08 0%, transparent 45%)
        `,
      }}
    />
  );
};

// ============================================
// FLOATING CHESS GRID
// ============================================
const FloatingChessGrid: React.FC<{ opacity?: number; scale?: number }> = ({ 
  opacity = 0.15, 
  scale = 1 
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const gridOpacity = interpolate(frame, [0, 60], [0, opacity], {
    extrapolateRight: 'clamp',
  });
  
  const rotation = interpolate(frame, [0, 900], [0, 5]);
  const yOffset = interpolate(frame, [0, 900], [0, -20]);
  
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) perspective(1000px) rotateX(60deg) rotateZ(${rotation}deg) translateY(${yOffset}px) scale(${scale})`,
        opacity: gridOpacity,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 80px)' }}>
        {Array.from({ length: 64 }).map((_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const isLight = (row + col) % 2 === 0;
          
          return (
            <div
              key={i}
              style={{
                width: 80,
                height: 80,
                backgroundColor: isLight ? COLORS.purple + '22' : 'transparent',
                border: `1px solid ${COLORS.purple}11`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// SCENE 1: INTRO SCENE (0-3s)
// ============================================
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Camera push-in effect
  const cameraZoom = interpolate(frame, [0, 90], [1, 1.05], {
    easing: Easing.out(Easing.cubic),
  });
  
  // Logo animation
  const logoOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const logoScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  
  // Subtext animation
  const subtextOpacity = interpolate(frame, [45, 70], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const subtextY = interpolate(frame, [45, 70], [20, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, transform: `scale(${cameraZoom})` }}>
      <AmbientGlow intensity={1.2} />
      <FloatingChessGrid opacity={0.1} scale={1.5} />
      <FilmGrain opacity={0.025} />
      
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Logo */}
          <div
            style={{
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              marginBottom: 20,
            }}
          >
            <Img
              src={staticFile('images/solmate-logo.png')}
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          </div>
          
          {/* Main title */}
          <h1
            style={{
              fontSize: 90,
              fontWeight: 700,
              color: COLORS.white,
              margin: 0,
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              letterSpacing: -2,
              textShadow: `0 0 60px ${COLORS.purple}44`,
            }}
          >
            SolMate
          </h1>
          
          {/* Subtext */}
          <p
            style={{
              fontSize: 28,
              color: COLORS.gray,
              margin: 0,
              marginTop: 16,
              opacity: subtextOpacity,
              transform: `translateY(${subtextY}px)`,
              letterSpacing: 3,
            }}
          >
            Where skill meets Solana.
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: PRODUCT REVEAL (3-7s)
// ============================================
const ProductReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Board slide in
  const boardProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60 },
  });
  
  const boardX = interpolate(boardProgress, [0, 1], [-100, 0]);
  const boardOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  
  // Text animations
  const text1Opacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });
  const text2Opacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow />
      <FilmGrain />
      
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 80 }}>
          {/* Chess board */}
          <div
            style={{
              opacity: boardOpacity,
              transform: `translateX(${boardX}px) perspective(800px) rotateY(-5deg)`,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 50px)',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: `0 0 80px ${COLORS.purple}33`,
                border: `2px solid ${COLORS.purple}33`,
              }}
            >
              {Array.from({ length: 64 }).map((_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const isLight = (row + col) % 2 === 0;
                const pieceDelay = (row + col) * 3;
                const pieceOpacity = interpolate(frame - pieceDelay, [0, 20], [0, 1], {
                  extrapolateRight: 'clamp',
                });
                
                // Initial chess position pieces
                const pieces: { [key: number]: string } = {
                  0: '♜', 1: '♞', 2: '♝', 3: '♛', 4: '♚', 5: '♝', 6: '♞', 7: '♜',
                  8: '♟', 9: '♟', 10: '♟', 11: '♟', 12: '♟', 13: '♟', 14: '♟', 15: '♟',
                  48: '♙', 49: '♙', 50: '♙', 51: '♙', 52: '♙', 53: '♙', 54: '♙', 55: '♙',
                  56: '♖', 57: '♘', 58: '♗', 59: '♕', 60: '♔', 61: '♗', 62: '♘', 63: '♖',
                };
                
                return (
                  <div
                    key={i}
                    style={{
                      width: 50,
                      height: 50,
                      backgroundColor: isLight ? '#2d2d3d' : '#1c1c28',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pieces[i] && (
                      <span
                        style={{
                          fontSize: 32,
                          opacity: pieceOpacity,
                          color: row < 2 ? COLORS.purple : COLORS.white,
                          filter: `drop-shadow(0 0 8px ${row < 2 ? COLORS.purple : COLORS.white}44)`,
                        }}
                      >
                        {pieces[i]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Text content */}
          <div style={{ maxWidth: 500 }}>
            <h2
              style={{
                fontSize: 42,
                fontWeight: 600,
                color: COLORS.white,
                margin: 0,
                marginBottom: 20,
                opacity: text1Opacity,
              }}
            >
              A competitive chess platform
            </h2>
            <p
              style={{
                fontSize: 24,
                color: COLORS.gray,
                margin: 0,
                lineHeight: 1.5,
                opacity: text2Opacity,
              }}
            >
              Built for real players.<br />
              <span style={{ color: COLORS.purple }}>Powered by Solana.</span>
            </p>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: APP INTERFACE MOCKUP (7-11s)
// ============================================
const AppInterfaceMockup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone mockup animation
  const phoneProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 70 },
  });

  const phoneScale = interpolate(phoneProgress, [0, 1], [0.8, 1]);
  const phoneOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // App interface content animations
  const appBarOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });
  const boardOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' });
  const statsOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={0.8} />
      <FilmGrain />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {/* Phone Mockup */}
        <div
          style={{
            width: 380,
            height: 760,
            borderRadius: 40,
            backgroundColor: '#1a1a24',
            border: `8px solid ${COLORS.darkGray}`,
            boxShadow: `0 0 100px ${COLORS.purple}33, 0 30px 80px rgba(0,0,0,0.6)`,
            opacity: phoneOpacity,
            transform: `scale(${phoneScale}) perspective(1000px) rotateY(-8deg)`,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Status Bar */}
          <div
            style={{
              height: 44,
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 14,
              color: COLORS.white,
              opacity: appBarOpacity,
            }}
          >
            <span>9:41</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>

          {/* App Bar */}
          <div
            style={{
              padding: '16px 20px',
              background: `linear-gradient(135deg, ${COLORS.purple}22, transparent)`,
              borderBottom: `1px solid ${COLORS.purple}22`,
              opacity: appBarOpacity,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, margin: 0 }}>
                SolMate Arena
              </h3>
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  backgroundColor: COLORS.green + '22',
                  border: `1px solid ${COLORS.green}44`,
                  fontSize: 12,
                  color: COLORS.green,
                  fontWeight: 600,
                }}
              >
                0.5 SOL
              </div>
            </div>
          </div>

          {/* Chess Board */}
          <div
            style={{
              margin: '30px auto',
              width: 320,
              opacity: boardOpacity,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 40px)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: `0 0 40px ${COLORS.purple}33`,
              }}
            >
              {Array.from({ length: 64 }).map((_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const isLight = (row + col) % 2 === 0;

                // Opening position pieces
                const pieces: { [key: number]: string } = {
                  0: '♜', 1: '♞', 2: '♝', 3: '♛', 4: '♚', 5: '♝', 6: '♞', 7: '♜',
                  8: '♟', 9: '♟', 10: '♟', 11: '♟', 12: '♟', 13: '♟', 14: '♟', 15: '♟',
                  48: '♙', 49: '♙', 50: '♙', 51: '♙', 52: '♙', 53: '♙', 54: '♙', 55: '♙',
                  56: '♖', 57: '♘', 58: '♗', 59: '♕', 60: '♔', 61: '♗', 62: '♘', 63: '♖',
                };

                return (
                  <div
                    key={i}
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: isLight ? '#2d2d3d' : '#1c1c28',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}
                  >
                    {pieces[i] && (
                      <span style={{ color: row < 2 ? COLORS.purple : COLORS.white }}>
                        {pieces[i]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player Stats */}
          <div
            style={{
              padding: '0 20px',
              opacity: statsOpacity,
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.darkGray}, ${COLORS.background})`,
                borderRadius: 16,
                padding: '20px',
                border: `1px solid ${COLORS.purple}33`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 12, color: COLORS.gray, margin: 0 }}>Your ELO</p>
                  <p style={{ fontSize: 24, color: COLORS.white, margin: 0, fontWeight: 700 }}>
                    1580
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, color: COLORS.gray, margin: 0 }}>Stake</p>
                  <p style={{ fontSize: 24, color: COLORS.green, margin: 0, fontWeight: 700 }}>
                    0.5 SOL
                  </p>
                </div>
              </div>

              <button
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 12,
                  border: 'none',
                  background: `linear-gradient(135deg, ${COLORS.purple}, #7c3aed)`,
                  color: COLORS.white,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px ${COLORS.purple}44`,
                }}
              >
                Find Match
              </button>
            </div>
          </div>
        </div>

        {/* Feature Label */}
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: 200,
            opacity: statsOpacity,
          }}
        >
          <p
            style={{
              fontSize: 32,
              color: COLORS.white,
              fontWeight: 600,
              textShadow: `0 0 30px ${COLORS.purple}66`,
            }}
          >
            Seamless mobile experience
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: HOW IT WORKS (11-17s)
// ============================================
const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Three beats timing
  const beat1Start = 0;
  const beat2Start = 60;  // 2s
  const beat3Start = 120; // 4s
  
  const Beat: React.FC<{
    startFrame: number;
    icon: string;
    text: string;
    visual: React.ReactNode;
  }> = ({ startFrame, icon, text, visual }) => {
    const progress = spring({
      frame: frame - startFrame,
      fps,
      config: { damping: 15, stiffness: 80 },
    });
    
    const opacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
      extrapolateRight: 'clamp',
    });
    
    const exitOpacity = interpolate(frame - startFrame, [50, 60], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    
    const finalOpacity = startFrame === beat3Start ? opacity : Math.min(opacity, exitOpacity);
    
    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: finalOpacity,
          transform: `scale(${progress})`,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 30 }}>{visual}</div>
          <p
            style={{
              fontSize: 36,
              color: COLORS.white,
              margin: 0,
              fontWeight: 500,
            }}
          >
            {text}
          </p>
        </div>
      </AbsoluteFill>
    );
  };
  
  // Wallet connect visual
  const WalletVisual = () => (
    <div
      style={{
        padding: '20px 40px',
        background: 'linear-gradient(135deg, #ab9ff2, #7c3aed)',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        boxShadow: '0 10px 50px rgba(124, 58, 237, 0.4)',
      }}
    >
      <span style={{ fontSize: 36 }}>👻</span>
      <span style={{ color: COLORS.white, fontSize: 22, fontWeight: 600 }}>
        Connect Wallet
      </span>
    </div>
  );
  
  // Escrow visual
  const EscrowVisual = () => {
    const lockScale = spring({
      frame: frame - beat2Start - 20,
      fps,
      config: { damping: 12, stiffness: 100 },
    });
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.gold})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          ◎
        </div>
        <div style={{ fontSize: 36, color: COLORS.gray }}>→</div>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            backgroundColor: COLORS.darkGray,
            border: `2px solid ${COLORS.purple}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            transform: `scale(${lockScale})`,
            boxShadow: `0 0 30px ${COLORS.purple}44`,
          }}
        >
          🔒
        </div>
      </div>
    );
  };
  
  // Checkmate visual
  const CheckmateVisual = () => {
    const pulseIntensity = interpolate(
      Math.sin((frame - beat3Start) * 0.15),
      [-1, 1],
      [0.6, 1]
    );
    
    return (
      <div
        style={{
          fontSize: 80,
          filter: `drop-shadow(0 0 ${30 * pulseIntensity}px ${COLORS.gold})`,
        }}
      >
        ♔
      </div>
    );
  };
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow />
      <FilmGrain />
      
      <Beat
        startFrame={beat1Start}
        icon="👻"
        text="Create or join a match"
        visual={<WalletVisual />}
      />
      
      <Beat
        startFrame={beat2Start}
        icon="🔒"
        text="Funds lock securely"
        visual={<EscrowVisual />}
      />
      
      <Beat
        startFrame={beat3Start}
        icon="♔"
        text="Winner takes the match"
        visual={<CheckmateVisual />}
      />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: PHILOSOPHY (13-18s)
// ============================================
const Philosophy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  // Lines timing
  const line1Opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const line2Opacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const line3Opacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });
  const line4Opacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp' });
  
  // Camera zoom
  const cameraZoom = interpolate(frame, [0, 150], [1, 1.1], {
    easing: Easing.out(Easing.cubic),
  });
  
  // King glow
  const kingOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, transform: `scale(${cameraZoom})` }}>
      <AmbientGlow intensity={0.5} />
      <FilmGrain />
      
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Philosophy lines */}
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontSize: 42, color: COLORS.gray, margin: '10px 0', opacity: line1Opacity }}>
              No luck.
            </p>
            <p style={{ fontSize: 42, color: COLORS.gray, margin: '10px 0', opacity: line2Opacity }}>
              No house edge.
            </p>
            <p style={{ fontSize: 42, color: COLORS.gray, margin: '10px 0', opacity: line3Opacity }}>
              No gimmicks.
            </p>
          </div>
          
          {/* King */}
          <div
            style={{
              opacity: kingOpacity,
              fontSize: 100,
              filter: `drop-shadow(0 0 ${40 * glowPulse}px ${COLORS.purple}) drop-shadow(0 0 ${80 * glowPulse}px ${COLORS.purple}44)`,
              marginBottom: 20,
            }}
          >
            ♚
          </div>
          
          {/* Just skill */}
          <p
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.white,
              margin: 0,
              opacity: line4Opacity,
              textShadow: `0 0 40px ${COLORS.purple}66`,
            }}
          >
            Just skill.
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5: VICTORY MODAL (18-23s)
// ============================================
const VictoryModal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Modal animation
  const modalProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  const modalY = interpolate(modalProgress, [0, 1], [100, 0]);
  const modalOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  
  // Confetti particles
  const Confetti = () => {
    const particles = React.useMemo(() => {
      return Array.from({ length: 30 }).map((_, i) => ({
        x: Math.random() * 100,
        delay: Math.random() * 30,
        speed: Math.random() * 2 + 1,
        size: Math.random() * 8 + 4,
        color: [COLORS.purple, COLORS.gold, COLORS.green, COLORS.white][Math.floor(Math.random() * 4)],
      }));
    }, []);
    
    return (
      <>
        {particles.map((p, i) => {
          const y = ((frame - p.delay) * p.speed * 2) % 150 - 20;
          const opacity = interpolate(frame - p.delay, [0, 20, 120, 150], [0, 0.8, 0.8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: 2,
                opacity,
                transform: `rotate(${frame * 3 + i * 45}deg)`,
              }}
            />
          );
        })}
      </>
    );
  };
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={1.5} />
      <FilmGrain />
      <Confetti />
      
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {/* Victory Modal */}
        <div
          style={{
            opacity: modalOpacity,
            transform: `translateY(${modalY}px)`,
            background: `linear-gradient(180deg, ${COLORS.darkGray} 0%, ${COLORS.background} 100%)`,
            borderRadius: 24,
            padding: '50px 80px',
            border: `2px solid ${COLORS.purple}44`,
            boxShadow: `0 0 100px ${COLORS.purple}33, 0 20px 60px rgba(0,0,0,0.5)`,
            textAlign: 'center',
          }}
        >
          {/* Crown */}
          <div
            style={{
              fontSize: 70,
              marginBottom: 20,
              filter: `drop-shadow(0 0 20px ${COLORS.gold})`,
            }}
          >
            👑
          </div>
          
          {/* Victory text */}
          <h2
            style={{
              fontSize: 56,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.gold})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              marginBottom: 15,
            }}
          >
            Victory
          </h2>
          
          {/* Subtitle */}
          <p
            style={{
              fontSize: 22,
              color: COLORS.gray,
              margin: 0,
              marginBottom: 30,
            }}
          >
            Match complete. Winnings secured.
          </p>
          
          {/* Payout info */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 40,
              padding: '20px 30px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 12,
            }}
          >
            <div>
              <p style={{ fontSize: 14, color: COLORS.gray, margin: 0 }}>Winnings</p>
              <p style={{ fontSize: 28, color: COLORS.green, margin: 0, fontWeight: 700 }}>
                +0.9 SOL
              </p>
            </div>
            <div style={{ width: 1, backgroundColor: COLORS.gray + '33' }} />
            <div>
              <p style={{ fontSize: 14, color: COLORS.gray, margin: 0 }}>Platform Fee</p>
              <p style={{ fontSize: 28, color: COLORS.gray, margin: 0, fontWeight: 500 }}>
                0.1 SOL
              </p>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 6: OUTRO (23-30s)
// ============================================
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Logo animation
  const logoScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  
  const logoOpacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' });
  
  // Text animations
  const titleOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });
  const taglineOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [110, 130], [0, 1], { extrapolateRight: 'clamp' });
  
  // Fade to black
  const fadeOut = interpolate(frame, [180, 210], [0, 1], { extrapolateRight: 'clamp' });
  
  // Glow pulse
  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.6, 1]);
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={1.2} />
      <FilmGrain />
      
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Logo */}
          <div
            style={{
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              marginBottom: 30,
              filter: `drop-shadow(0 0 ${50 * glowPulse}px ${COLORS.purple}66)`,
            }}
          >
            <Img
              src={staticFile('images/solmate-logo.png')}
              style={{ width: 160, height: 160, objectFit: 'contain' }}
            />
          </div>
          
          {/* Title */}
          <h1
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: COLORS.white,
              margin: 0,
              marginBottom: 10,
              opacity: titleOpacity,
              letterSpacing: -2,
              textShadow: `0 0 60px ${COLORS.purple}44`,
            }}
          >
            SolMate
          </h1>
          
          {/* Tagline */}
          <p
            style={{
              fontSize: 28,
              color: COLORS.purple,
              margin: 0,
              marginBottom: 40,
              opacity: taglineOpacity,
              letterSpacing: 2,
            }}
          >
            Competitive Chess. On-Chain.
          </p>
          
          {/* CTA */}
          <p
            style={{
              fontSize: 22,
              color: COLORS.gray,
              margin: 0,
              opacity: ctaOpacity,
              fontStyle: 'italic',
            }}
          >
            Play smart. Win clean.
          </p>
        </div>
      </AbsoluteFill>
      
      {/* Fade to black overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000',
          opacity: fadeOut,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION - 30 seconds (900 frames @ 30fps)
// ============================================
export const SolMatePromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Background ambient audio - cinematic electronic */}
      <Audio
        src={staticFile('audio/ambient-cinematic.mp3')}
        volume={0.6}
        startFrom={0}
      />
      
      {/* Scene 1: Intro (0-3s / 0-90 frames) */}
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>

      {/* Scene 2: Product Reveal (3-6s / 90-180 frames) */}
      <Sequence from={90} durationInFrames={90}>
        <ProductReveal />
      </Sequence>

      {/* Scene 3: App Interface Mockup (6-10s / 180-300 frames) */}
      <Sequence from={180} durationInFrames={120}>
        <AppInterfaceMockup />
      </Sequence>

      {/* Scene 4: How It Works (10-16s / 300-480 frames) */}
      <Sequence from={300} durationInFrames={180}>
        <HowItWorks />
      </Sequence>

      {/* Scene 5: Philosophy (16-20s / 480-600 frames) */}
      <Sequence from={480} durationInFrames={120}>
        <Philosophy />
      </Sequence>

      {/* Scene 6: Victory Modal (20-24s / 600-720 frames) */}
      <Sequence from={600} durationInFrames={120}>
        <VictoryModal />
      </Sequence>

      {/* Scene 7: Outro (24-30s / 720-900 frames) */}
      <Sequence from={720} durationInFrames={180}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};

// Square version export
export const SolMatePromoSquare: React.FC = () => <SolMatePromo />;
