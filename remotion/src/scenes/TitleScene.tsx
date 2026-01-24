import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { GradientText, AnimatedText } from '../components/AnimatedText';
import { COLORS, PIECE_SYMBOLS } from '../styles/theme';

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Knight icon animation
  const knightScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  const knightRotate = interpolate(
    spring({
      frame: frame - 10,
      fps,
      config: { damping: 15, stiffness: 60 },
    }),
    [0, 1],
    [-10, 0]
  );
  
  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.5, 1]
  );
  
  return (
    <AbsoluteFill>
      <Background showGrid showParticles />
      
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
        }}
      >
        {/* Knight icon */}
        <div
          style={{
            fontSize: 120,
            transform: `scale(${knightScale}) rotate(${knightRotate}deg)`,
            filter: `drop-shadow(0 0 ${30 * glowIntensity}px ${COLORS.purple})`,
            color: COLORS.textPrimary,
          }}
        >
          {PIECE_SYMBOLS.N}
        </div>
        
        {/* Title */}
        <GradientText delay={15} style={{ fontSize: 80 }}>
          How Chess Pieces Move
        </GradientText>
        
        {/* Subtitle */}
        <AnimatedText delay={30} type="subheading">
          Beginner Guide
        </AnimatedText>
        
        {/* Decorative line */}
        <div
          style={{
            width: interpolate(
              spring({ frame: frame - 40, fps, config: { damping: 20 } }),
              [0, 1],
              [0, 200]
            ),
            height: 3,
            background: `linear-gradient(90deg, transparent, ${COLORS.purple}, ${COLORS.green}, transparent)`,
            borderRadius: 2,
            marginTop: 10,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
