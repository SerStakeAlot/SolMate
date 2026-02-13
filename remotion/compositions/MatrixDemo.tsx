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
  OffthreadVideo,
} from 'remotion';

// ============================================
// MATRIX COLOR PALETTE
// ============================================
const COLORS = {
  background: '#000000',
  matrixGreen: '#00FF41',
  matrixDarkGreen: '#003B00',
  matrixLightGreen: '#39FF14',
  purple: '#9945FF',
  gold: '#FFD700',
  white: '#ffffff',
  gray: '#888888',
  darkGray: '#0a0a0a',
  cyan: '#00D4FF',
  green: '#14F195',
};

// ============================================
// MATRIX RAIN (falling characters)
// ============================================
const MatrixRain: React.FC<{ opacity?: number; density?: number }> = ({
  opacity = 0.15,
  density = 30,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Generate stable columns of falling chars
  const columns = React.useMemo(() => {
    const cols: Array<{
      x: number;
      speed: number;
      chars: string[];
      offset: number;
      fontSize: number;
    }> = [];
    for (let i = 0; i < density; i++) {
      const charPool = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789♔♕♖♗♘♙';
      const chars: string[] = [];
      for (let j = 0; j < 30; j++) {
        chars.push(charPool[Math.floor((i * 31 + j * 7) % charPool.length)]);
      }
      cols.push({
        x: (i / density) * width + ((i * 37) % 20) - 10,
        speed: 1.5 + ((i * 13) % 30) / 10,
        chars,
        offset: (i * 97) % 500,
        fontSize: 14 + ((i * 7) % 8),
      });
    }
    return cols;
  }, [density, width]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity,
        pointerEvents: 'none',
      }}
    >
      {columns.map((col, ci) => {
        const yOffset = (frame * col.speed + col.offset) % (height + 600);
        return (
          <div
            key={ci}
            style={{
              position: 'absolute',
              left: col.x,
              top: yOffset - 600,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {col.chars.map((char, charIdx) => {
              const charOpacity =
                charIdx === 0
                  ? 1
                  : interpolate(charIdx, [0, col.chars.length - 1], [0.9, 0.05]);
              const isHead = charIdx === 0;
              return (
                <span
                  key={charIdx}
                  style={{
                    color: isHead ? COLORS.white : COLORS.matrixGreen,
                    fontSize: col.fontSize,
                    fontFamily: 'monospace',
                    opacity: charOpacity,
                    textShadow: isHead
                      ? `0 0 10px ${COLORS.matrixGreen}, 0 0 20px ${COLORS.matrixGreen}`
                      : `0 0 5px ${COLORS.matrixDarkGreen}`,
                    lineHeight: 1.2,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// MATRIX SCAN LINE EFFECT
// ============================================
const ScanLines: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 255, 65, ${opacity}) 2px,
          rgba(0, 255, 65, ${opacity}) 4px
        )`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ============================================
// GLOWING BORDER FRAME
// ============================================
const GlowingFrame: React.FC<{
  children: React.ReactNode;
  color?: string;
  borderWidth?: number;
  glowIntensity?: number;
}> = ({
  children,
  color = COLORS.matrixGreen,
  borderWidth = 2,
  glowIntensity = 1,
}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.6, 1]);

  return (
    <div
      style={{
        position: 'relative',
        border: `${borderWidth}px solid ${color}88`,
        borderRadius: 16,
        boxShadow: `0 0 ${20 * glowIntensity * pulse}px ${color}44, 
                     inset 0 0 ${10 * glowIntensity * pulse}px ${color}22`,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// MATRIX TEXT COMPONENT
// ============================================
const MatrixText: React.FC<{
  children: string;
  fontSize?: number;
  delay?: number;
  typewriter?: boolean;
}> = ({ children, fontSize = 32, delay = 0, typewriter = false }) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - delay;

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayText = typewriter
    ? children.slice(
        0,
        Math.floor(
          interpolate(adjustedFrame, [0, children.length * 2], [0, children.length], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        )
      )
    : children;

  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);

  return (
    <span
      style={{
        fontSize,
        fontFamily: '"Courier New", monospace',
        fontWeight: 700,
        color: COLORS.matrixGreen,
        opacity,
        textShadow: `0 0 ${10 * glowPulse}px ${COLORS.matrixGreen}88, 
                      0 0 ${20 * glowPulse}px ${COLORS.matrixDarkGreen}`,
        letterSpacing: 2,
      }}
    >
      {displayText}
      {typewriter && adjustedFrame < children.length * 2 && (
        <span
          style={{
            opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
          }}
        >
          █
        </span>
      )}
    </span>
  );
};

// ============================================
// SCENE 1: MATRIX INTRO (0-4s / 0-120 frames)
// ============================================
const MatrixIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo fade in
  const logoOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const logoScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 70 },
  });

  // Title typewriter
  const titleStart = 40;

  // Subtitle
  const subtitleOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <MatrixRain opacity={0.2} density={40} />
      <ScanLines opacity={0.03} />

      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          {/* Logo */}
          <div
            style={{
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              marginBottom: 40,
              filter: `drop-shadow(0 0 40px ${COLORS.matrixGreen}66)`,
            }}
          >
            <Img
              src={staticFile('images/solmate-logo.png')}
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          </div>

          {/* Title */}
          <div style={{ marginBottom: 24 }}>
            <MatrixText fontSize={72} delay={titleStart} typewriter>
              SolMate
            </MatrixText>
          </div>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 28,
              color: COLORS.matrixGreen,
              opacity: subtitleOpacity,
              fontFamily: 'monospace',
              letterSpacing: 6,
              textTransform: 'uppercase',
              margin: 0,
              textShadow: `0 0 10px ${COLORS.matrixDarkGreen}`,
            }}
          >
            {'// APP DEMO'}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: PHONE DEMO VIEW (4s - 4m22s)
// Phone recording embedded in a device frame
// with Matrix overlay effects
// ============================================
const PhoneDemoScene: React.FC<{
  startFrom?: number;
  label?: string;
  labelDelay?: number;
}> = ({ startFrom = 0, label, labelDelay = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone entrance animation
  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60 },
  });

  const phoneScale = interpolate(entranceProgress, [0, 1], [0.85, 1]);
  const phoneOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtle float animation
  const floatY = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [-3, 3]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <MatrixRain opacity={0.08} density={20} />

      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        {/* Phone Device Frame */}
        <div
          style={{
            opacity: phoneOpacity,
            transform: `scale(${phoneScale}) translateY(${floatY}px)`,
          }}
        >
          <GlowingFrame color={COLORS.matrixGreen} borderWidth={3} glowIntensity={0.8}>
            <div
              style={{
                width: 360,
                height: 780,
                backgroundColor: COLORS.background,
                borderRadius: 14,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Embedded video */}
              <OffthreadVideo
                src={staticFile('Matrix-demo-h264.mp4')}
                startFrom={startFrom * 30} // convert seconds to frames at 30fps
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {/* Subtle scan line overlay on video */}
              <ScanLines opacity={0.02} />
            </div>
          </GlowingFrame>
        </div>

        {/* Section Label */}
        {label && (
          <div
            style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${COLORS.background}ee, ${COLORS.darkGray}dd)`,
                border: `1px solid ${COLORS.matrixGreen}44`,
                borderRadius: 12,
                padding: '12px 32px',
                boxShadow: `0 0 20px ${COLORS.matrixGreen}22`,
              }}
            >
              <MatrixText fontSize={22} delay={labelDelay} typewriter>
                {label}
              </MatrixText>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE TRANSITION: GLITCH
// ============================================
const GlitchTransition: React.FC = () => {
  const frame = useCurrentFrame();

  const glitchBars = React.useMemo(() => {
    const bars: Array<{ y: number; h: number; offset: number }> = [];
    for (let i = 0; i < 15; i++) {
      bars.push({
        y: (i * 73) % 100,
        h: 2 + ((i * 11) % 8),
        offset: ((i * 37) % 200) - 100,
      });
    }
    return bars;
  }, []);

  const intensity = interpolate(frame, [0, 8, 15, 20], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (intensity < 0.01) return null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(0, 255, 65, ${0.1 * intensity})`,
        zIndex: 100,
      }}
    >
      {glitchBars.map((bar, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${bar.y}%`,
            left: 0,
            right: 0,
            height: bar.h * intensity,
            backgroundColor: `rgba(0, 255, 65, ${0.3 * intensity})`,
            transform: `translateX(${bar.offset * intensity}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ============================================
// SCENE: SECTION TITLE CARD
// ============================================
const SectionTitle: React.FC<{
  title: string;
  subtitle?: string;
  icon?: string;
}> = ({ title, subtitle, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  const subtitleOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const lineWidth = interpolate(frame, [20, 50], [0, 300], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <MatrixRain opacity={0.12} density={35} />
      <ScanLines opacity={0.03} />

      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          {/* Icon */}
          {icon && (
            <div
              style={{
                fontSize: 64,
                marginBottom: 24,
                opacity: interpolate(frame, [5, 20], [0, 1], {
                  extrapolateRight: 'clamp',
                }),
                filter: `drop-shadow(0 0 20px ${COLORS.matrixGreen}66)`,
              }}
            >
              {icon}
            </div>
          )}

          {/* Title */}
          <div style={{ transform: `scale(${titleScale})` }}>
            <MatrixText fontSize={56}>{title}</MatrixText>
          </div>

          {/* Divider line */}
          <div
            style={{
              width: lineWidth,
              height: 2,
              backgroundColor: COLORS.matrixGreen,
              margin: '20px auto',
              boxShadow: `0 0 10px ${COLORS.matrixGreen}88`,
            }}
          />

          {/* Subtitle */}
          {subtitle && (
            <p
              style={{
                fontSize: 24,
                color: COLORS.matrixGreen,
                opacity: subtitleOpacity * 0.7,
                fontFamily: 'monospace',
                margin: 0,
                letterSpacing: 3,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE: CLOSING
// ============================================
const MatrixClosing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const logoScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  const textOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Fade out
  const fadeOut = interpolate(frame, [150, 180], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <MatrixRain opacity={0.15} density={35} />
      <ScanLines opacity={0.03} />

      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          {/* Logo */}
          <div
            style={{
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              marginBottom: 30,
              filter: `drop-shadow(0 0 ${40 * glowPulse}px ${COLORS.matrixGreen}66)`,
            }}
          >
            <Img
              src={staticFile('images/solmate-logo.png')}
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: COLORS.matrixGreen,
              margin: 0,
              marginBottom: 16,
              opacity: textOpacity,
              fontFamily: '"Courier New", monospace',
              letterSpacing: 4,
              textShadow: `0 0 20px ${COLORS.matrixGreen}88`,
            }}
          >
            SolMate
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: 28,
              color: COLORS.matrixGreen,
              margin: 0,
              marginBottom: 40,
              opacity: textOpacity * 0.8,
              fontFamily: 'monospace',
              letterSpacing: 3,
            }}
          >
            Play Smart. Win Clean.
          </p>

          {/* CTA button */}
          <div
            style={{
              opacity: ctaOpacity,
              display: 'inline-block',
            }}
          >
            <GlowingFrame color={COLORS.matrixGreen} borderWidth={2} glowIntensity={1.2}>
              <div
                style={{
                  padding: '16px 48px',
                  backgroundColor: `${COLORS.matrixDarkGreen}88`,
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    color: COLORS.matrixGreen,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: 3,
                  }}
                >
                  {'> START PLAYING'}
                </span>
              </div>
            </GlowingFrame>
          </div>
        </div>
      </AbsoluteFill>

      {/* Fade to black */}
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.background,
          opacity: fadeOut,
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// 4s intro + 272s full video + 7s closing = 283s @ 30fps = 8490 frames
// ============================================
export const MatrixDemo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: '"Courier New", monospace',
      }}
    >
      {/* ---- INTRO (0:00 - 0:04 / frames 0-120) ---- */}
      <Sequence from={0} durationInFrames={120}>
        <MatrixIntro />
      </Sequence>

      {/* ---- FULL UNCUT VIDEO (0:04 - 4:36 / frames 120-8280) ---- */}
      <Sequence from={120} durationInFrames={8160}>
        <PhoneDemoScene startFrom={0} />
      </Sequence>

      {/* ---- CLOSING (4:36 - 4:43 / frames 8280-8490) ---- */}
      <Sequence from={8280} durationInFrames={210}>
        <MatrixClosing />
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================
// ALTERNATE FORMATS
// ============================================

// Square version (1080x1080) - same content, different crop
export const MatrixDemoSquare: React.FC = () => <MatrixDemo />;
