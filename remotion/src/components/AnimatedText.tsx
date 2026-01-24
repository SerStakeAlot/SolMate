import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../styles/theme';

interface AnimatedTextProps {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  type?: 'heading' | 'subheading' | 'body' | 'label';
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  children,
  delay = 0,
  style = {},
  type = 'body',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  
  const translateY = interpolate(
    spring({
      frame: frame - delay,
      fps,
      config: { damping: 20, stiffness: 80 },
    }),
    [0, 1],
    [20, 0]
  );
  
  const typeStyles: Record<string, React.CSSProperties> = {
    heading: {
      fontSize: 72,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: COLORS.textPrimary,
    },
    subheading: {
      fontSize: 36,
      fontWeight: 500,
      letterSpacing: '0.02em',
      color: COLORS.textSecondary,
    },
    body: {
      fontSize: 28,
      fontWeight: 400,
      lineHeight: 1.5,
      color: COLORS.textSecondary,
    },
    label: {
      fontSize: 20,
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      color: COLORS.purple,
    },
  };
  
  return (
    <div
      style={{
        fontFamily: FONTS.heading,
        opacity,
        transform: `translateY(${translateY}px)`,
        ...typeStyles[type],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

interface GradientTextProps {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  delay = 0,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const opacity = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  
  const scale = interpolate(
    spring({
      frame: frame - delay,
      fps,
      config: { damping: 15, stiffness: 100 },
    }),
    [0, 1],
    [0.9, 1]
  );
  
  return (
    <div
      style={{
        fontFamily: FONTS.heading,
        fontSize: 72,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        opacity,
        transform: `scale(${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

interface PieceInfoBoxProps {
  pieceName: string;
  description: string;
  delay?: number;
}

export const PieceInfoBox: React.FC<PieceInfoBoxProps> = ({
  pieceName,
  description,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const slideIn = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  
  const translateX = interpolate(slideIn, [0, 1], [50, 0]);
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  
  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '32px 40px',
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        opacity,
        transform: `translateX(${translateX}px)`,
        maxWidth: 400,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.heading,
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.textPrimary,
          marginBottom: 12,
        }}
      >
        {pieceName}
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 24,
          fontWeight: 400,
          color: COLORS.textSecondary,
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
  );
};
