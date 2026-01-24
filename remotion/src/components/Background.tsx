import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS } from '../styles/theme';

interface BackgroundProps {
  showGrid?: boolean;
  showParticles?: boolean;
}

export const Background: React.FC<BackgroundProps> = ({
  showGrid = true,
  showParticles = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  // Subtle gradient animation
  const gradientOffset = interpolate(frame, [0, 300], [0, 20], {
    extrapolateRight: 'extend',
  });
  
  // Particle positions (deterministic for consistent renders)
  const particles = React.useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      x: (i * 137.5) % 100,
      y: (i * 89.3) % 100,
      size: 2 + (i % 4),
      speed: 0.3 + (i % 5) * 0.1,
      delay: i * 10,
    }));
  }, []);
  
  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(
              ellipse at 50% ${30 + gradientOffset}%, 
              ${COLORS.bgGradientStart} 0%, 
              ${COLORS.bgGradientEnd} 70%
            )
          `,
        }}
      />
      
      {/* Subtle purple glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 400,
          background: `radial-gradient(ellipse, ${COLORS.purple}20 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />
      
      {/* Grid pattern */}
      {showGrid && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
          }}
          width={width}
          height={height}
        >
          <defs>
            <pattern
              id="grid"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke={COLORS.textPrimary}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      )}
      
      {/* Floating particles */}
      {showParticles && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
          }}
          width={width}
          height={height}
        >
          {particles.map((particle, i) => {
            const progress = spring({
              frame: frame - particle.delay,
              fps,
              config: { damping: 100, stiffness: 10 },
            });
            
            const y = interpolate(
              (frame * particle.speed) % 200,
              [0, 200],
              [particle.y, particle.y - 10]
            );
            
            return (
              <circle
                key={i}
                cx={`${particle.x}%`}
                cy={`${y}%`}
                r={particle.size}
                fill={i % 2 === 0 ? COLORS.purple : COLORS.green}
                opacity={0.2 * progress}
              />
            );
          })}
        </svg>
      )}
      
      {/* Vignette effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, ${COLORS.bgDark}90 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
