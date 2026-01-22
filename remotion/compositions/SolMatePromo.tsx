import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
} from 'remotion';

// Color palette
const COLORS = {
  background: '#0a0a0f',
  purple: '#9945FF',
  green: '#14F195',
  white: '#ffffff',
  gray: '#888888',
};

// Chess piece SVG
const ChessPiece: React.FC<{ type: 'king' | 'queen' | 'knight'; color: string; size?: number }> = ({ 
  type, 
  color, 
  size = 100 
}) => {
  const pieces = {
    king: '♔',
    queen: '♕',
    knight: '♘',
  };
  return (
    <span style={{ fontSize: size, color, filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}>
      {pieces[type]}
    </span>
  );
};

// Animated gradient background
const GradientBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = interpolate(frame, [0, 900], [0, 360]);
  
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <div
        style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          top: '-50%',
          left: '-50%',
          background: `conic-gradient(from ${rotation}deg at 50% 50%, 
            ${COLORS.purple}22 0deg, 
            ${COLORS.green}22 120deg, 
            ${COLORS.purple}22 240deg, 
            ${COLORS.green}22 360deg)`,
          filter: 'blur(100px)',
        }}
      />
    </AbsoluteFill>
  );
};

// Logo animation
const AnimatedLogo: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div style={{ fontSize: 120, marginBottom: 20 }}>♟️</div>
      <h1
        style={{
          fontSize: 100,
          fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.green})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
          letterSpacing: -2,
        }}
      >
        SolMate
      </h1>
    </div>
  );
};

// Tagline animation
const AnimatedTagline: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const words = text.split(' ');
  
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
      {words.map((word, i) => {
        const wordDelay = delay + i * 5;
        const y = spring({
          frame: frame - wordDelay,
          fps,
          config: { damping: 15, stiffness: 150 },
        });
        const opacity = interpolate(frame - wordDelay, [0, 10], [0, 1], {
          extrapolateRight: 'clamp',
        });
        
        return (
          <span
            key={i}
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: i === 1 ? COLORS.green : COLORS.white,
              transform: `translateY(${(1 - y) * 50}px)`,
              opacity,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Feature card
const FeatureCard: React.FC<{ 
  icon: string; 
  title: string; 
  description: string; 
  delay?: number;
  x?: number;
}> = ({ icon, title, description, delay = 0, x = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const slideIn = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  
  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        border: `2px solid ${COLORS.purple}44`,
        width: 300,
        transform: `translateX(${(1 - slideIn) * (x > 0 ? 200 : -200)}px)`,
        opacity,
      }}
    >
      <span style={{ fontSize: 60, marginBottom: 20 }}>{icon}</span>
      <h3 style={{ fontSize: 28, color: COLORS.white, margin: 0, marginBottom: 10 }}>{title}</h3>
      <p style={{ fontSize: 18, color: COLORS.gray, margin: 0, textAlign: 'center' }}>{description}</p>
    </div>
  );
};

// Solana logo
const SolanaLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
    <defs>
      <linearGradient id="solGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9945FF" />
        <stop offset="50%" stopColor="#14F195" />
        <stop offset="100%" stopColor="#00C2FF" />
      </linearGradient>
    </defs>
    <path
      d="M93.5 42.5H34.5C33.4 42.5 32.3 43 31.5 43.8L21 54.3C19.8 55.5 20.6 57.5 22.3 57.5H81.3C82.4 57.5 83.5 57 84.3 56.2L94.8 45.7C96 44.5 95.2 42.5 93.5 42.5Z"
      fill="url(#solGrad)"
    />
    <path
      d="M93.5 70.5H34.5C33.4 70.5 32.3 71 31.5 71.8L21 82.3C19.8 83.5 20.6 85.5 22.3 85.5H81.3C82.4 85.5 83.5 85 84.3 84.2L94.8 73.7C96 72.5 95.2 70.5 93.5 70.5Z"
      fill="url(#solGrad)"
    />
    <path
      d="M22.3 28.5H81.3C82.4 28.5 83.5 29 84.3 29.8L94.8 40.3C96 41.5 95.2 43.5 93.5 43.5H34.5C33.4 43.5 32.3 43 31.5 42.2L21 31.7C19.8 30.5 20.6 28.5 22.3 28.5Z"
      fill="url(#solGrad)"
    />
  </svg>
);

// Main promo composition
export const SolMatePromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  return (
    <AbsoluteFill style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <GradientBackground />
      
      {/* Scene 1: Logo intro (0-5s) */}
      <Sequence from={0} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <AnimatedLogo />
        </AbsoluteFill>
      </Sequence>
      
      {/* Scene 2: Tagline (5-10s) */}
      <Sequence from={150} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
          <AnimatedTagline text="Stake. Compete. Conquer." />
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 15, 
            marginTop: 20,
            opacity: interpolate(frame - 180, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
          }}>
            <span style={{ color: COLORS.gray, fontSize: 24 }}>Powered by</span>
            <SolanaLogo size={30} />
            <span style={{ color: COLORS.white, fontSize: 24, fontWeight: 600 }}>Solana</span>
          </div>
        </AbsoluteFill>
      </Sequence>
      
      {/* Scene 3: Features (10-20s) */}
      <Sequence from={300} durationInFrames={300}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 60 }}>
          <h2 style={{ 
            fontSize: 48, 
            color: COLORS.white, 
            margin: 0,
            opacity: interpolate(frame - 300, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
          }}>
            Why Players Love SolMate
          </h2>
          <div style={{ display: 'flex', gap: 40 }}>
            <FeatureCard 
              icon="⚡" 
              title="Instant Payouts" 
              description="Win and receive SOL directly to your wallet"
              delay={30}
              x={-1}
            />
            <FeatureCard 
              icon="🔒" 
              title="Secure Escrow" 
              description="Stakes locked in smart contracts"
              delay={45}
              x={0}
            />
            <FeatureCard 
              icon="🎯" 
              title="Fair Play" 
              description="Decentralized and transparent"
              delay={60}
              x={1}
            />
          </div>
        </AbsoluteFill>
      </Sequence>
      
      {/* Scene 4: CTA (20-30s) */}
      <Sequence from={600} durationInFrames={300}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
          <div style={{
            opacity: interpolate(frame - 600, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `scale(${spring({ frame: frame - 600, fps: 30, config: { damping: 12 } })})`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
              <ChessPiece type="knight" color={COLORS.purple} size={150} />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: 72, color: COLORS.white, margin: 0, marginBottom: 10 }}>
                  Ready to Play?
                </h2>
                <p style={{ fontSize: 32, color: COLORS.gray, margin: 0 }}>
                  Challenge players worldwide
                </p>
              </div>
            </div>
          </div>
          
          <div style={{
            marginTop: 40,
            padding: '24px 60px',
            background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.green})`,
            borderRadius: 20,
            opacity: interpolate(frame - 660, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `scale(${spring({ frame: frame - 660, fps: 30, config: { damping: 15 } })})`,
          }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: COLORS.white }}>
              playsolmate.fun
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            gap: 40,
            marginTop: 30,
            opacity: interpolate(frame - 720, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🎮</span>
              <span style={{ color: COLORS.white, fontSize: 20 }}>Free Play Available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>💰</span>
              <span style={{ color: COLORS.white, fontSize: 20 }}>Starting at 0.05 SOL</span>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
