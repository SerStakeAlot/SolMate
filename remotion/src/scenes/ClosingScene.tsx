import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig, Img } from 'remotion';
import { Background } from '../components/Background';
import { GradientText, AnimatedText } from '../components/AnimatedText';
import { COLORS, PIECE_SYMBOLS } from '../styles/theme';

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Logo animation
  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  const logoOpacity = interpolate(logoScale, [0, 1], [0, 1]);
  
  // Chess pieces floating behind
  const pieces = [PIECE_SYMBOLS.K, PIECE_SYMBOLS.Q, PIECE_SYMBOLS.R, PIECE_SYMBOLS.B, PIECE_SYMBOLS.N, PIECE_SYMBOLS.P];
  
  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.5, 1]
  );
  
  return (
    <AbsoluteFill>
      <Background showGrid showParticles />
      
      {/* Floating pieces background */}
      <AbsoluteFill style={{ opacity: 0.1 }}>
        {pieces.map((piece, i) => {
          const delay = i * 5;
          const x = 15 + i * 14;
          const y = interpolate(
            (frame + delay * 10) % 200,
            [0, 200],
            [110, -10]
          );
          const rotation = interpolate(frame + delay * 10, [0, 200], [-20, 20]);
          const opacity = spring({
            frame: frame - delay,
            fps,
            config: { damping: 30 },
          });
          
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                fontSize: 100,
                color: COLORS.textPrimary,
                transform: `rotate(${rotation}deg)`,
                opacity: opacity * 0.5,
              }}
            >
              {piece}
            </div>
          );
        })}
      </AbsoluteFill>
      
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        {/* SolMate Logo/Text */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              boxShadow: `0 0 ${40 * glowIntensity}px ${COLORS.purple}`,
            }}
          >
            ♞
          </div>
          <GradientText delay={10} style={{ fontSize: 72 }}>
            SolMate
          </GradientText>
        </div>
        
        {/* Tagline */}
        <AnimatedText delay={25} type="subheading" style={{ fontSize: 32 }}>
          Learn. Play. Compete.
        </AnimatedText>
        
        {/* Chess symbol */}
        <div
          style={{
            marginTop: 20,
            opacity: interpolate(
              spring({ frame: frame - 40, fps, config: { damping: 20 } }),
              [0, 1],
              [0, 1]
            ),
            fontSize: 48,
            color: COLORS.textMuted,
          }}
        >
          ♟️
        </div>
        
        {/* Decorative glow */}
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            width: 600,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${COLORS.purple}80, ${COLORS.green}80, transparent)`,
            borderRadius: 2,
            opacity: interpolate(
              spring({ frame: frame - 50, fps, config: { damping: 20 } }),
              [0, 1],
              [0, 1]
            ),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
