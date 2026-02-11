import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors — premium dark tone with gold accents
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  gold: '#FFD700',
  goldDim: '#B8960F',
  bgDark: '#0a0a0a',
  bgGradientStart: '#1a1025',
  boardLight: '#e8e4f0',
  boardDark: '#6b5b95',
  red: '#ff4444',
};

const PIECES = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// ── Background ──────────────────────────────────────────────────────────────

const Background: React.FC = () => {
  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 30%, ${COLORS.bgGradientStart} 0%, ${COLORS.bgDark} 70%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(rgba(153, 69, 255, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(153, 69, 255, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }} />
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400,
        background: `radial-gradient(ellipse, ${COLORS.purple}20 0%, transparent 70%)`,
        filter: 'blur(60px)',
      }} />
    </AbsoluteFill>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const getSquarePos = (square: string, squareSize: number) => {
  const file = FILES.indexOf(square[0]);
  const rank = RANKS.indexOf(square[1]);
  return { x: file * squareSize, y: rank * squareSize };
};

// ── StaticPiece ─────────────────────────────────────────────────────────────

const StaticPiece: React.FC<{
  symbol: string;
  square: string;
  squareSize: number;
  opacity?: number;
  glow?: string;
}> = ({ symbol, square, squareSize, opacity = 1, glow }) => {
  const pos = getSquarePos(square, squareSize);
  return (
    <div style={{
      position: 'absolute', left: pos.x, top: pos.y,
      width: squareSize, height: squareSize,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: squareSize * 0.75, color: '#ffffff',
      textShadow: glow
        ? `0 0 20px ${glow}, 0 0 40px ${glow}`
        : '0 2px 4px rgba(0,0,0,0.5)',
      zIndex: 10, opacity,
    }}>
      {symbol}
    </div>
  );
};

// ── AnimatedPiece ───────────────────────────────────────────────────────────

const AnimatedPiece: React.FC<{
  symbol: string;
  fromSquare: string;
  toSquare: string;
  squareSize: number;
  startFrame: number;
  duration?: number;
  glow?: string;
}> = ({ symbol, fromSquare, toSquare, squareSize, startFrame, duration = 20, glow }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fromPos = getSquarePos(fromSquare, squareSize);
  const toPos = getSquarePos(toSquare, squareSize);

  const progress = spring({
    frame: frame - startFrame, fps,
    config: { damping: 20, stiffness: 100 },
    durationInFrames: duration,
  });

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const x = interpolate(clampedProgress, [0, 1], [fromPos.x, toPos.x]);
  const y = interpolate(clampedProgress, [0, 1], [fromPos.y, toPos.y]);

  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: squareSize, height: squareSize,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: squareSize * 0.75, color: '#ffffff',
      textShadow: glow
        ? `0 0 20px ${glow}, 0 0 40px ${glow}`
        : '0 2px 4px rgba(0,0,0,0.5)',
      zIndex: 15,
    }}>
      {symbol}
    </div>
  );
};

// ── ChessBoard ──────────────────────────────────────────────────────────────

const ChessBoard: React.FC<{
  highlightedSquares?: string[];
  glowSquares?: string[];
  attackLine?: string[];
  goldColumns?: string[];
  scale?: number;
  children?: React.ReactNode;
}> = ({
  highlightedSquares = [], glowSquares = [], attackLine = [], goldColumns = [],
  scale = 1, children,
}) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);

  return (
    <div style={{
      width: boardSize, height: boardSize,
      borderRadius: 12, overflow: 'hidden', position: 'relative',
      transform: `scale(${scale})`,
      boxShadow: `0 0 60px ${COLORS.purple}40, 0 20px 40px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
        {RANKS.map((rank, rankIdx) =>
          FILES.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const isLight = (fileIdx + rankIdx) % 2 === 0;
            const isHighlighted = highlightedSquares.includes(square);
            const isGlow = glowSquares.includes(square);
            const isAttackLine = attackLine.includes(square);
            const isGoldCol = goldColumns.includes(square);

            return (
              <div key={square} style={{
                width: squareSize, height: squareSize,
                backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
                position: 'relative',
              }}>
                {isHighlighted && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.purple, opacity: 0.4,
                  }} />
                )}
                {isGlow && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.gold, opacity: glowPulse,
                    boxShadow: `inset 0 0 20px ${COLORS.gold}`,
                  }} />
                )}
                {isAttackLine && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.cyan, opacity: glowPulse * 0.6,
                    boxShadow: `inset 0 0 15px ${COLORS.cyan}`,
                  }} />
                )}
                {isGoldCol && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.gold, opacity: glowPulse * 0.5,
                    boxShadow: `inset 0 0 15px ${COLORS.gold}`,
                  }} />
                )}
              </div>
            );
          })
        )}
      </div>
      {children}
    </div>
  );
};

// ── InfoBox ─────────────────────────────────────────────────────────────────

const InfoBox: React.FC<{
  title: string;
  subtitle?: string;
  delay?: number;
}> = ({ title, subtitle, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 100 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateY = interpolate(slideIn, [0, 1], [30, 0]);

  return (
    <div style={{
      position: 'absolute', bottom: 120, left: '50%',
      transform: `translateX(-50%) translateY(${translateY}px)`,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(20px)',
      borderRadius: 16, padding: '24px 48px',
      border: `2px solid ${COLORS.purple}`, opacity,
      textAlign: 'center', boxShadow: `0 0 40px ${COLORS.purple}40`,
    }}>
      <div style={{
        fontSize: 36, fontWeight: 700, color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        marginBottom: subtitle ? 12 : 0,
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 22, color: COLORS.green,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

// ── BulletList ──────────────────────────────────────────────────────────────

const BulletList: React.FC<{
  header: string;
  items: string[];
  delay?: number;
}> = ({ header, items, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{
      position: 'absolute', right: 100, top: '50%', transform: 'translateY(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(20px)',
      borderRadius: 16, padding: '32px 40px',
      border: `2px solid ${COLORS.purple}`,
      boxShadow: `0 0 40px ${COLORS.purple}40`, maxWidth: 450,
    }}>
      <div style={{
        fontSize: 28, fontWeight: 700, color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 24, textAlign: 'center',
      }}>
        {header}
      </div>
      {items.map((item, idx) => {
        const itemDelay = delay + idx * 25;
        const itemSpring = spring({ frame: frame - itemDelay, fps, config: { damping: 20, stiffness: 100 } });
        const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
        const translateX = interpolate(itemSpring, [0, 1], [30, 0]);

        return (
          <div key={idx} style={{
            fontSize: 20, color: COLORS.green,
            fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16,
            opacity, transform: `translateX(${translateX}px)`,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ color: COLORS.gold }}>▸</span>
            <span>{item}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── MoveNotation ────────────────────────────────────────────────────────────

const MoveNotation: React.FC<{
  moves: string;
  delay?: number;
}> = ({ moves, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 100 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);

  return (
    <div style={{
      position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(15px)',
      borderRadius: 10, padding: '12px 32px',
      border: `1px solid ${COLORS.purple}60`, opacity,
    }}>
      <div style={{
        fontSize: 22, fontWeight: 500, color: COLORS.gold,
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
      }}>
        {moves}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 1 — Title Card (0–90 frames / 3s)
// ════════════════════════════════════════════════════════════════════════════

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });
  const boardOpacity = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 80 } });

  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30,
      }}>
        {/* Logo */}
        <div style={{ opacity: logoOpacity, transform: `scale(${logoOpacity})` }}>
          <Img
            src={staticFile('images/solmate-logo.png')}
            style={{
              height: 100,
              filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
            }}
          />
        </div>

        {/* Mini chessboard silhouette with glow */}
        <div style={{
          opacity: boardOpacity,
          display: 'grid', gridTemplateColumns: 'repeat(4, 40px)',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: `0 0 60px ${COLORS.purple}70`,
        }}>
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
            const isCenter = i === 5 || i === 6 || i === 9 || i === 10;
            return (
              <div key={i} style={{
                width: 40, height: 40,
                backgroundColor: (Math.floor(i/4) + i%4) % 2 === 0 ? COLORS.boardLight : COLORS.boardDark,
                boxShadow: isCenter ? `inset 0 0 20px ${COLORS.gold}${Math.floor(glowPulse * 255).toString(16).padStart(2, '0')}` : 'none',
              }} />
            );
          })}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          The Sicilian Defense
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          A Fighting Chess Opening
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — Opening Hook (90–210 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const OpeningHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  // Cinematic camera push: start zoomed in, ease out
  const cameraScale = interpolate(frame, [0, 90], [1.08, 1.0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Full starting position minus e2 pawn (will animate)
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.N, square: 'g1' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'f2' }, { piece: PIECES.P, square: 'g2' },
    { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'b8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c7' }, { piece: PIECES.p, square: 'd7' },
    { piece: PIECES.p, square: 'e7' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${cameraScale})`, opacity: boardOpacity,
      }}>
        <ChessBoard glowSquares={frame > 30 ? ['e4'] : []}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="e2" toSquare="e4"
            squareSize={squareSize} startFrame={15} glow={COLORS.gold}
          />
        </ChessBoard>
        <InfoBox title="The most popular response to 1.e4." delay={50} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — The Shock Response (120–270 frames / 5s)
// ════════════════════════════════════════════════════════════════════════════

const ShockResponseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  // Board shake after c5 lands (~frame 30)
  const shakeStart = 30;
  const shakeElapsed = Math.max(0, frame - shakeStart);
  const shakeDecay = Math.exp(-shakeElapsed * 0.15);
  const shakeX = shakeElapsed > 0 ? Math.sin(shakeElapsed * 2.5) * 8 * shakeDecay : 0;
  const shakeY = shakeElapsed > 0 ? Math.cos(shakeElapsed * 3.0) * 5 * shakeDecay : 0;

  // Gradient text impact
  const titleProgress = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 120 } });
  const titleScale = interpolate(titleProgress, [0, 1], [1.3, 1]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  // Position: after 1. e4 (pawn on e4, c-pawn will animate)
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.N, square: 'g1' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'b8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'd7' },
    { piece: PIECES.p, square: 'e7' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 40,
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}>
        <ChessBoard glowSquares={frame > 35 ? ['c5'] : []} highlightedSquares={['e4']}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="c7" toSquare="c5"
            squareSize={squareSize} startFrame={10} duration={15} glow={COLORS.gold}
          />
        </ChessBoard>
      </AbsoluteFill>

      {/* Title overlay below board */}
      <div style={{
        position: 'absolute', bottom: 100, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: titleOpacity, transform: `scale(${titleScale})`,
      }}>
        <div style={{
          fontSize: 72, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
          filter: `drop-shadow(0 0 30px ${COLORS.purple}80)`,
        }}>
          Sicilian Defense.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 3 — Attack from the Flank (270–420 frames / 5s)
// ════════════════════════════════════════════════════════════════════════════

const FlankAttackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position: after 1.e4 c5
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.N, square: 'g1' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'b8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c5' }, { piece: PIECES.p, square: 'd7' },
    { piece: PIECES.p, square: 'e7' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  // Animated arrows: c5→d4 pressure, c-file upward
  const arrowProgress1 = spring({ frame: frame - 30, fps, config: { damping: 15, stiffness: 100 } });
  const arrowProgress2 = spring({ frame: frame - 50, fps, config: { damping: 15, stiffness: 100 } });

  const boardSize = squareSize * 8;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['c5']}
          attackLine={['c5', 'd4']}
          highlightedSquares={['d4', 'e4']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}

          {/* Arrow: c5 → d4 */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: boardSize, height: boardSize, pointerEvents: 'none', zIndex: 20,
          }}>
            <defs>
              <marker id="ah-flank-1" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.gold} opacity={arrowProgress1} />
              </marker>
              <marker id="ah-flank-2" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.cyan} opacity={arrowProgress2} />
              </marker>
            </defs>
            {/* c5 → d4 pressure */}
            <line
              x1={2.5 * squareSize} y1={3.5 * squareSize}
              x2={2.5 * squareSize + (3.5 * squareSize - 2.5 * squareSize) * arrowProgress1}
              y2={3.5 * squareSize + (4.5 * squareSize - 3.5 * squareSize) * arrowProgress1 * (-1) + squareSize * arrowProgress1}
              stroke={COLORS.gold} strokeWidth={4}
              markerEnd={arrowProgress1 > 0.8 ? 'url(#ah-flank-1)' : undefined} opacity={0.9}
            />
            {/* c-file upward: c5 → c1 */}
            <line
              x1={2.5 * squareSize} y1={3.5 * squareSize}
              x2={2.5 * squareSize}
              y2={3.5 * squareSize + (7.5 * squareSize - 3.5 * squareSize) * arrowProgress2}
              stroke={COLORS.cyan} strokeWidth={3}
              markerEnd={arrowProgress2 > 0.8 ? 'url(#ah-flank-2)' : undefined} opacity={0.7}
              strokeDasharray="8 4"
            />
          </svg>
        </ChessBoard>

        <InfoBox
          title="Black doesn't mirror. Black counterattacks."
          delay={40}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 5 — Main Line Snapshot (600–810 frames / 7s)
// ════════════════════════════════════════════════════════════════════════════

const MainLineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const squareSize = 56;

  // Move timings (relative to scene start)
  const MOVE_GAP = 30;

  // Moves: 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4
  // We start from the initial position and animate each move
  // For simplicity, show the final position and animate the last few key moves

  // Position after 1.e4 c5 2.Nf3 d6 (static pieces)
  const staticWhite = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const staticBlack = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'b8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'e7' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  // Animated moves:
  // Move 1: Nf3 already on f3, but animate Nf3 from g1→f3
  // Move 2: d6 from d7→d6
  // Move 3: d4 from d2→d4
  // Move 4: cxd4 from c5→d4
  // Move 5: Nxd4 from f3→d4

  // Show c-file highlight after cxd4
  const cFileHighlightFrame = MOVE_GAP * 4 + 20;
  const showCFile = frame > cFileHighlightFrame;
  const cFileSquares = showCFile ? ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] : [];

  // Notation build-up
  const notation1 = frame > 5 ? '1.e4 c5' : '';
  const notation2 = frame > MOVE_GAP ? ' 2.Nf3 d6' : '';
  const notation3 = frame > MOVE_GAP * 2 ? ' 3.d4' : '';
  const notation4 = frame > MOVE_GAP * 3 ? ' cxd4' : '';
  const notation5 = frame > MOVE_GAP * 4 ? ' 4.Nxd4' : '';
  const fullNotation = `${notation1}${notation2}${notation3}${notation4}${notation5}`;

  // Visibility: hide pieces that get captured / moved away
  // After d4 (frame MOVE_GAP*2+20), hide d2 pawn from static (it moved to d4)
  // After cxd4 (frame MOVE_GAP*3+20), the c5 pawn captures d4 pawn
  // After Nxd4 (frame MOVE_GAP*4+20), knight takes back on d4

  return (
    <AbsoluteFill>
      <Background />
      <MoveNotation moves={fullNotation} delay={5} />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ChessBoard
          goldColumns={cFileSquares}
          glowSquares={frame > MOVE_GAP * 4 ? ['d4'] : []}
        >
          {staticWhite.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {staticBlack.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}

          {/* Animate Nf3: g1→f3 */}
          <AnimatedPiece
            symbol={PIECES.N} fromSquare="g1" toSquare="f3"
            squareSize={squareSize} startFrame={MOVE_GAP}
          />
          {/* Animate d6: d7→d6 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="d7" toSquare="d6"
            squareSize={squareSize} startFrame={MOVE_GAP + 15}
          />
          {/* Animate d4: d2→d4 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="d2" toSquare="d4"
            squareSize={squareSize} startFrame={MOVE_GAP * 2}
          />
          {/* Animate cxd4: c5→d4 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="c5" toSquare="d4"
            squareSize={squareSize} startFrame={MOVE_GAP * 3} glow={COLORS.gold}
          />
          {/* Animate Nxd4: f3→d4 */}
          <AnimatedPiece
            symbol={PIECES.N} fromSquare="f3" toSquare="d4"
            squareSize={squareSize} startFrame={MOVE_GAP * 4}
          />
        </ChessBoard>

        <InfoBox
          title="Open c-file. Counterplay begins."
          delay={cFileHighlightFrame}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 6 — Strategic Themes (810–960 frames / 5s)
// ════════════════════════════════════════════════════════════════════════════

const StrategicThemesScene: React.FC = () => {
  const squareSize = 56;

  // Final Open Sicilian position after 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.R, square: 'h1' }, { piece: PIECES.N, square: 'd4' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'b8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'd6' },
    { piece: PIECES.p, square: 'e7' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 150,
      }}>
        <ChessBoard
          glowSquares={['d4', 'e4']}
          goldColumns={['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']}
          highlightedSquares={['a7', 'b7', 'b5', 'a5']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <BulletList
          header="Game plan for Black."
          items={[
            'Control d4',
            'Pressure the c-file',
            'Queenside expansion',
          ]}
          delay={15}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 7 — Fighting Chance Moment (960–1110 frames / 5s)
// ════════════════════════════════════════════════════════════════════════════

const FightingChanceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  // Subtle zoom toward center
  const zoomScale = interpolate(frame, [0, 120], [1.0, 1.06], {
    extrapolateRight: 'clamp',
  });

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Common Najdorf-style Sicilian setup
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'g1' }, { piece: PIECES.R, square: 'f1' },
    { piece: PIECES.N, square: 'c3' }, { piece: PIECES.N, square: 'd4' },
    { piece: PIECES.B, square: 'e2' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.n, square: 'c6' }, { piece: PIECES.n, square: 'f6' },
    { piece: PIECES.p, square: 'a6' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'd6' }, { piece: PIECES.p, square: 'e5' },
    { piece: PIECES.p, square: 'f7' }, { piece: PIECES.p, square: 'g7' },
    { piece: PIECES.p, square: 'h7' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${zoomScale})`, opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['d4', 'e5', 'e4']}
          highlightedSquares={['c6', 'f6', 'a6', 'd6']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <InfoBox
          title="Complex positions. Real winning chances."
          delay={30}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 8 — End Card (1110–1200 frames / 3s)
// ════════════════════════════════════════════════════════════════════════════

const EndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pawnGlow = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.6, 1]);
  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 80 } });
  const brandOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />

      {/* Blurred chessboard in background */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: 'blur(8px)', opacity: 0.1,
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(8, 50px)', borderRadius: 8,
        }}>
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} style={{
              width: 50, height: 50,
              backgroundColor: (Math.floor(i / 8) + i % 8) % 2 === 0
                ? COLORS.boardLight : COLORS.boardDark,
            }} />
          ))}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16,
      }}>
        {/* Glowing c5 pawn */}
        <div style={{
          fontSize: 80, color: '#ffffff',
          textShadow: `0 0 ${30 * pawnGlow}px ${COLORS.gold}, 0 0 ${60 * pawnGlow}px ${COLORS.gold}, 0 0 ${90 * pawnGlow}px ${COLORS.purple}40`,
          transform: `scale(${logoScale})`,
          marginBottom: 10,
        }}>
          {PIECES.p}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 48, fontWeight: 700,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.gold} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          Sicilian Defense — Intermediate
        </div>

        {/* Logo */}
        <div style={{
          opacity: brandOpacity, marginTop: 20,
          transform: `scale(${logoScale})`,
        }}>
          <Img
            src={staticFile('images/solmate-logo.png')}
            style={{
              height: 120,
              filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
            }}
          />
        </div>

        {/* SolMate text */}
        <div style={{
          fontSize: 24, color: '#a1a1aa', opacity: brandOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', marginTop: 10,
        }}>
          SolMate
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ════════════════════════════════════════════════════════════════════════════

export const SicilianDefense: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Scene 1: Title Card (0–90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Opening Hook (90–210 frames / 4s) */}
      <Sequence from={90} durationInFrames={120}>
        <OpeningHookScene />
      </Sequence>

      {/* Scene 3: The Shock Response (210–360 frames / 5s) */}
      <Sequence from={210} durationInFrames={150}>
        <ShockResponseScene />
      </Sequence>

      {/* Scene 4: Attack from the Flank (360–510 frames / 5s) */}
      <Sequence from={360} durationInFrames={150}>
        <FlankAttackScene />
      </Sequence>

      {/* Scene 5: Main Line Snapshot (510–720 frames / 7s) */}
      <Sequence from={510} durationInFrames={210}>
        <MainLineScene />
      </Sequence>

      {/* Scene 6: Strategic Themes (720–870 frames / 5s) */}
      <Sequence from={720} durationInFrames={150}>
        <StrategicThemesScene />
      </Sequence>

      {/* Scene 7: Fighting Chance Moment (870–1020 frames / 5s) */}
      <Sequence from={870} durationInFrames={150}>
        <FightingChanceScene />
      </Sequence>

      {/* Scene 8: End Card (1020–1110 frames / 3s) */}
      <Sequence from={1020} durationInFrames={90}>
        <EndCardScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default SicilianDefense;
