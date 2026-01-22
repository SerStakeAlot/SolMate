import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
} from 'remotion';

const COLORS = {
  background: '#0a0a0f',
  purple: '#9945FF',
  green: '#14F195',
  white: '#ffffff',
  gray: '#888888',
};

// Animated feature item
const Feature: React.FC<{
  icon: string;
  title: string;
  description: string;
  delay: number;
}> = ({ icon, title, description, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const progress = spring({
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
        alignItems: 'center',
        gap: 30,
        padding: '30px 40px',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        border: `1px solid ${COLORS.purple}33`,
        transform: `translateX(${(1 - progress) * -100}px)`,
        opacity,
        width: 600,
      }}
    >
      <span style={{ fontSize: 50 }}>{icon}</span>
      <div>
        <h3 style={{ fontSize: 28, color: COLORS.white, margin: 0, marginBottom: 5 }}>{title}</h3>
        <p style={{ fontSize: 18, color: COLORS.gray, margin: 0 }}>{description}</p>
      </div>
    </div>
  );
};

// Chess board pattern
const ChessPattern: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = interpolate(frame, [0, 450], [0, 10]);
  
  return (
    <div
      style={{
        position: 'absolute',
        right: -100,
        top: '50%',
        transform: `translateY(-50%) rotate(${rotation}deg)`,
        opacity: 0.1,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 60px)' }}>
        {Array.from({ length: 64 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 60,
              height: 60,
              backgroundColor: (Math.floor(i / 8) + i) % 2 === 0 ? COLORS.purple : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const SolMateFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  
  const features = [
    { icon: '⚡', title: 'Lightning Fast', description: 'Instant moves with real-time sync' },
    { icon: '💰', title: 'Stake & Win', description: 'Wager 0.05 to 1 SOL per match' },
    { icon: '🔒', title: 'Secure Escrow', description: 'Smart contract holds stakes safely' },
    { icon: '🏆', title: '90% Payouts', description: 'Winner takes almost all' },
    { icon: '👀', title: 'Spectator Mode', description: 'Watch live matches with friends' },
  ];
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <ChessPattern />
      
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 100,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <h1
          style={{
            fontSize: 60,
            fontWeight: 800,
            color: COLORS.white,
            margin: 0,
          }}
        >
          Features
        </h1>
        <div
          style={{
            width: 100,
            height: 4,
            background: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.green})`,
            marginTop: 15,
            borderRadius: 2,
          }}
        />
      </div>
      
      {/* Feature list */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {features.map((feature, i) => (
          <Feature
            key={i}
            {...feature}
            delay={30 + i * 20}
          />
        ))}
      </div>
      
      {/* Logo watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 15,
          opacity: interpolate(frame, [60, 90], [0, 0.7], { extrapolateRight: 'clamp' }),
        }}
      >
        <span style={{ fontSize: 40 }}>♟️</span>
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.green})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          SolMate
        </span>
      </div>
    </AbsoluteFill>
  );
};
