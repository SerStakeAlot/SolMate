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
  Easing,
} from 'remotion';

// ============================================
// COLOR PALETTE - Solana inspired
// ============================================
const COLORS = {
  background: '#08080c',
  purple: '#9945FF',
  gold: '#FFD700',
  green: '#14F195',
  white: '#ffffff',
  gray: '#888888',
  darkPurple: '#1a0a2e',
};

// ============================================
// PARTICLES EFFECT
// ============================================
const Particles: React.FC<{ count?: number; color?: string }> = ({ 
  count = 50, 
  color = COLORS.purple 
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const particles = React.useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 0.5 + 0.2,
      delay: Math.random() * 100,
    }));
  }, [count, width, height]);
  
  return (
    <>
      {particles.map((p, i) => {
        const y = (p.y - (frame * p.speed * 2) % (height + 100) + height) % height;
        const opacity = interpolate(
          Math.sin((frame + p.delay) * 0.05),
          [-1, 1],
          [0.1, 0.6]
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: color,
              opacity,
              filter: 'blur(1px)',
              boxShadow: `0 0 ${p.size * 2}px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

// ============================================
// LIGHT STREAKS
// ============================================
const LightStreaks: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  return (
    <>
      {[0, 1, 2].map((i) => {
        const progress = ((frame * 0.5 + i * 100) % 300) / 300;
        const x = interpolate(progress, [0, 1], [-200, width + 200]);
        const opacity = interpolate(progress, [0, 0.3, 0.7, 1], [0, 0.3, 0.3, 0]);
        
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: height * 0.3 + i * 100,
              width: 300,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.purple}88, ${COLORS.gold}88, transparent)`,
              opacity,
              transform: 'rotate(-15deg)',
              filter: 'blur(2px)',
            }}
          />
        );
      })}
    </>
  );
};

// ============================================
// GLOWING CHESS PIECE
// ============================================
const GlowingChessPiece: React.FC<{
  piece: string;
  x: number;
  y: number;
  color: 'white' | 'gold';
  delay?: number;
  size?: number;
}> = ({ piece, x, y, color, delay = 0, size = 80 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  const glow = interpolate(
    Math.sin((frame - delay) * 0.1),
    [-1, 1],
    [0.5, 1]
  );
  
  const pieceColor = color === 'white' ? COLORS.white : COLORS.gold;
  const glowColor = color === 'white' ? COLORS.purple : COLORS.gold;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: size,
        color: pieceColor,
        transform: `scale(${scale})`,
        filter: `drop-shadow(0 0 ${20 * glow}px ${glowColor}) drop-shadow(0 0 ${40 * glow}px ${glowColor}44)`,
        textShadow: `0 0 30px ${glowColor}`,
      }}
    >
      {piece}
    </div>
  );
};

// ============================================
// ANIMATED CHESS BOARD
// ============================================
const ChessBoard: React.FC<{ scale?: number; rotation?: number }> = ({ 
  scale = 1, 
  rotation = 0 
}) => {
  const frame = useCurrentFrame();
  const tilt = interpolate(frame, [0, 300], [45, 50]);
  
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 60px)',
        transform: `perspective(1000px) rotateX(${tilt}deg) rotateZ(${rotation}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
      }}
    >
      {Array.from({ length: 64 }).map((_, i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const isLight = (row + col) % 2 === 0;
        const delay = (row + col) * 2;
        const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
          extrapolateRight: 'clamp',
        });
        
        return (
          <div
            key={i}
            style={{
              width: 60,
              height: 60,
              backgroundColor: isLight ? '#2a2a3a' : '#1a1a2a',
              opacity,
              border: `1px solid ${COLORS.purple}22`,
              boxShadow: isLight ? `inset 0 0 20px ${COLORS.purple}11` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// ANIMATED TEXT
// ============================================
const AnimatedText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  gradient?: boolean;
}> = ({ text, delay = 0, fontSize = 60, color = COLORS.white, gradient = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const words = text.split(' ');
  
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
      {words.map((word, i) => {
        const wordDelay = delay + i * 8;
        const progress = spring({
          frame: frame - wordDelay,
          fps,
          config: { damping: 15, stiffness: 100 },
        });
        const opacity = interpolate(frame - wordDelay, [0, 15], [0, 1], {
          extrapolateRight: 'clamp',
        });
        
        const style: React.CSSProperties = {
          fontSize,
          fontWeight: 700,
          transform: `translateY(${(1 - progress) * 40}px)`,
          opacity,
          letterSpacing: -1,
        };
        
        if (gradient) {
          style.background = `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.gold})`;
          style.WebkitBackgroundClip = 'text';
          style.WebkitTextFillColor = 'transparent';
        } else {
          style.color = color;
        }
        
        return (
          <span key={i} style={style}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ============================================
// WALLET CONNECT ANIMATION
// ============================================
const WalletConnect: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  const buttonProgress = spring({
    frame: frame - delay - 30,
    fps,
    config: { damping: 15, stiffness: 100 },
  });
  
  const connectingOpacity = interpolate(frame - delay - 60, [0, 10, 50, 60], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });
  
  const connectedOpacity = interpolate(frame - delay - 90, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      {/* Phantom-style wallet button */}
      <div
        style={{
          padding: '20px 40px',
          background: 'linear-gradient(135deg, #ab9ff2, #7c3aed)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 15,
          transform: `scale(${buttonProgress})`,
          boxShadow: '0 10px 40px rgba(124, 58, 237, 0.4)',
        }}
      >
        <span style={{ fontSize: 30 }}>👻</span>
        <span style={{ color: COLORS.white, fontSize: 24, fontWeight: 600 }}>
          Connect Phantom
        </span>
      </div>
      
      {/* Connecting state */}
      <div style={{ opacity: connectingOpacity, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 20,
            height: 20,
            border: `3px solid ${COLORS.purple}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ color: COLORS.gray, fontSize: 18 }}>Connecting...</span>
      </div>
      
      {/* Connected state */}
      <div
        style={{
          opacity: connectedOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          backgroundColor: 'rgba(20, 241, 149, 0.1)',
          borderRadius: 12,
          border: `1px solid ${COLORS.green}44`,
        }}
      >
        <span style={{ color: COLORS.green, fontSize: 20 }}>✓</span>
        <span style={{ color: COLORS.green, fontSize: 18, fontWeight: 500 }}>
          Connected: 7BKq...f87B
        </span>
      </div>
    </div>
  );
};

// ============================================
// ESCROW LOCK ANIMATION
// ============================================
const EscrowAnimation: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  
  const lockProgress = spring({
    frame: frame - delay - 60,
    fps,
    config: { damping: 15, stiffness: 100 },
  });
  
  const solMovement = interpolate(frame - delay, [0, 40], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 30,
        opacity: progress,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
        {/* Player 1 */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.darkPurple})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              marginBottom: 10,
            }}
          >
            ♔
          </div>
          <span style={{ color: COLORS.white, fontSize: 16 }}>Player 1</span>
          <div
            style={{
              marginTop: 10,
              padding: '8px 16px',
              backgroundColor: 'rgba(255,215,0,0.1)',
              borderRadius: 8,
              transform: `translateX(${solMovement * 100}px)`,
              opacity: 1 - solMovement,
            }}
          >
            <span style={{ color: COLORS.gold, fontWeight: 600 }}>0.5 SOL</span>
          </div>
        </div>
        
        {/* Escrow Lock */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${COLORS.purple}33, ${COLORS.gold}33)`,
            border: `2px solid ${COLORS.purple}66`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${lockProgress})`,
            boxShadow: `0 0 40px ${COLORS.purple}44`,
          }}
        >
          <span style={{ fontSize: 40 }}>🔒</span>
          <span style={{ color: COLORS.white, fontSize: 14, marginTop: 5 }}>Escrow</span>
          <span style={{ color: COLORS.gold, fontSize: 18, fontWeight: 700 }}>1.0 SOL</span>
        </div>
        
        {/* Player 2 */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.purple})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              marginBottom: 10,
            }}
          >
            ♚
          </div>
          <span style={{ color: COLORS.white, fontSize: 16 }}>Player 2</span>
          <div
            style={{
              marginTop: 10,
              padding: '8px 16px',
              backgroundColor: 'rgba(255,215,0,0.1)',
              borderRadius: 8,
              transform: `translateX(${-solMovement * 100}px)`,
              opacity: 1 - solMovement,
            }}
          >
            <span style={{ color: COLORS.gold, fontWeight: 600 }}>0.5 SOL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CHECKMATE ANIMATION
// ============================================
const CheckmateAnimation: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 8, stiffness: 80 },
  });
  
  const glowIntensity = interpolate(
    Math.sin((frame - delay) * 0.15),
    [-1, 1],
    [0.5, 1]
  );
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: 120,
          filter: `drop-shadow(0 0 ${30 * glowIntensity}px ${COLORS.gold}) drop-shadow(0 0 ${60 * glowIntensity}px ${COLORS.gold}44)`,
        }}
      >
        ♔
      </div>
      <h2
        style={{
          fontSize: 72,
          fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.purple})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
          marginTop: 20,
          letterSpacing: 4,
        }}
      >
        CHECKMATE
      </h2>
    </div>
  );
};

// ============================================
// LOGO REVEAL
// ============================================
const LogoReveal: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 10, stiffness: 60 },
  });
  
  const textOpacity = interpolate(frame - delay - 30, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const taglineOpacity = interpolate(frame - delay - 60, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const glowPulse = interpolate(
    Math.sin((frame - delay) * 0.08),
    [-1, 1],
    [0.6, 1]
  );
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `scale(${scale})`,
      }}
    >
      {/* Logo image */}
      <div
        style={{
          filter: `drop-shadow(0 0 ${40 * glowPulse}px ${COLORS.purple}88) drop-shadow(0 0 ${80 * glowPulse}px ${COLORS.purple}44)`,
        }}
      >
        <Img
          src={staticFile('images/solmate-logo.png')}
          style={{
            width: 200,
            height: 200,
            objectFit: 'contain',
          }}
        />
      </div>
      
      {/* Logo text */}
      <h1
        style={{
          fontSize: 100,
          fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.gold})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
          marginTop: 20,
          letterSpacing: -2,
          opacity: textOpacity,
        }}
      >
        SolMate
      </h1>
      
      {/* Tagline */}
      <p
        style={{
          fontSize: 32,
          color: COLORS.gray,
          margin: 0,
          marginTop: 20,
          opacity: taglineOpacity,
          letterSpacing: 2,
        }}
      >
        Where Skill Meets Solana
      </p>
    </div>
  );
};

// ============================================
// MAIN PROMO COMPOSITION - 45 seconds (1350 frames @ 30fps)
// ============================================
export const SolMatePromo: React.FC = () => {
  const { width, height } = useVideoConfig();
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Background effects */}
      <Particles count={60} color={COLORS.purple} />
      <LightStreaks />
      
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: `radial-gradient(ellipse at 30% 50%, ${COLORS.purple}15 0%, transparent 50%),
                       radial-gradient(ellipse at 70% 50%, ${COLORS.gold}10 0%, transparent 50%)`,
        }}
      />
      
      {/* ==========================================
          SCENE 1: Chess board zoom (0-6s / 0-180 frames)
          ========================================== */}
      <Sequence from={0} durationInFrames={180}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <ChessBoard scale={1.5} />
          <GlowingChessPiece piece="♔" x={width/2 - 200} y={height/2 - 100} color="white" delay={30} size={100} />
          <GlowingChessPiece piece="♛" x={width/2 + 100} y={height/2 - 50} color="gold" delay={45} size={100} />
          <GlowingChessPiece piece="♘" x={width/2 - 50} y={height/2 + 50} color="white" delay={60} size={80} />
        </AbsoluteFill>
      </Sequence>
      
      {/* ==========================================
          SCENE 2: Taglines (6-14s / 180-420 frames)
          ========================================== */}
      <Sequence from={180} durationInFrames={240}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 60 }}>
          <AnimatedText text="Skill. Strategy. Ownership." fontSize={72} gradient delay={0} />
          <AnimatedText text="Play Chess. Win On-Chain." fontSize={56} color={COLORS.white} delay={60} />
          <AnimatedText text="No middlemen. Instant payouts." fontSize={40} color={COLORS.gray} delay={120} />
        </AbsoluteFill>
      </Sequence>
      
      {/* ==========================================
          SCENE 3: Wallet connect (14-22s / 420-660 frames)
          ========================================== */}
      <Sequence from={420} durationInFrames={240}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <WalletConnect delay={0} />
        </AbsoluteFill>
      </Sequence>
      
      {/* ==========================================
          SCENE 4: Match & Escrow (22-32s / 660-960 frames)
          ========================================== */}
      <Sequence from={660} durationInFrames={300}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
          <AnimatedText text="Funds Locked in Escrow" fontSize={48} color={COLORS.white} delay={0} />
          <EscrowAnimation delay={30} />
        </AbsoluteFill>
      </Sequence>
      
      {/* ==========================================
          SCENE 5: Checkmate (32-38s / 960-1140 frames)
          ========================================== */}
      <Sequence from={960} durationInFrames={180}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
          <CheckmateAnimation delay={0} />
          <AnimatedText text="Winner takes the match" fontSize={36} color={COLORS.gold} delay={60} />
        </AbsoluteFill>
      </Sequence>
      
      {/* ==========================================
          SCENE 6: Trust text (38-42s / 1140-1260 frames)
          ========================================== */}
      <Sequence from={1140} durationInFrames={120}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <AnimatedText text="Trustless. Transparent. Instant." fontSize={64} gradient delay={0} />
        </AbsoluteFill>
      </Sequence>
      
      {/* ==========================================
          SCENE 7: Logo reveal (42-45s / 1260-1350 frames)
          ========================================== */}
      <Sequence from={1260} durationInFrames={90}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <LogoReveal delay={0} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================
// SQUARE VERSION (1:1) - Same content, adjusted
// ============================================
export const SolMatePromoSquare: React.FC = () => {
  return <SolMatePromo />;
};
