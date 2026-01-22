import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';

const COLORS = {
  background: '#0a0a0f',
  purple: '#9945FF',
  green: '#14F195',
  white: '#ffffff',
};

export const SolMateIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Logo scale animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 80 },
  });
  
  // Text fade in
  const textOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  // Glow pulse
  const glowIntensity = Math.sin(frame * 0.1) * 0.3 + 0.7;
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Animated background glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.purple}44 0%, transparent 70%)`,
          transform: `scale(${glowIntensity})`,
          filter: 'blur(60px)',
        }}
      />
      
      {/* Chess piece icon */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 150, marginBottom: 20 }}>♟️</span>
        
        {/* Logo text */}
        <h1
          style={{
            fontSize: 120,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.green})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            letterSpacing: -3,
            opacity: textOpacity,
          }}
        >
          SolMate
        </h1>
        
        {/* Tagline */}
        <p
          style={{
            fontSize: 36,
            color: COLORS.white,
            margin: 0,
            marginTop: 20,
            opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' }),
            letterSpacing: 8,
            textTransform: 'uppercase',
          }}
        >
          Chess on Solana
        </p>
      </div>
    </AbsoluteFill>
  );
};
