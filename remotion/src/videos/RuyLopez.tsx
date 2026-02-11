import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors — warm classical tone with gold highlights
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  gold: '#FFD700',
  warmGold: '#D4A843',
  bgDark: '#0a0a0a',
  bgGradientStart: '#1a1025',
  boardLight: '#e8e4f0',
  boardDark: '#6b5b95',
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
  children?: React.ReactNode;
}> = ({
  highlightedSquares = [], glowSquares = [], attackLine = [],
  children,
}) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);

  return (
    <div style={{
      width: boardSize, height: boardSize,
      borderRadius: 12, overflow: 'hidden', position: 'relative',
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
        const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
        const translateX = interpolate(itemSpring, [0, 1], [30, 0]);

        return (
          <div key={idx} style={{
            fontSize: 20, color: COLORS.green,
            fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16,
            opacity: itemOpacity, transform: `translateX(${translateX}px)`,
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

// ── Starting position helpers ───────────────────────────────────────────────

const fullWhitePieces = (exclude: string[] = []) => [
  { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
  { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
  { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
  { piece: PIECES.N, square: 'g1' }, { piece: PIECES.R, square: 'h1' },
  { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
  { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
  { piece: PIECES.P, square: 'e2' }, { piece: PIECES.P, square: 'f2' },
  { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
].filter(p => !exclude.includes(p.square));

const fullBlackPieces = (exclude: string[] = []) => [
  { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'b8' },
  { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
  { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
  { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
  { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
  { piece: PIECES.p, square: 'c7' }, { piece: PIECES.p, square: 'd7' },
  { piece: PIECES.p, square: 'e7' }, { piece: PIECES.p, square: 'f7' },
  { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
].filter(p => !exclude.includes(p.square));

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

        {/* Mini chessboard silhouette */}
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
          The Ruy Lopez
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          The Spanish Game
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — Classical Symmetry (90–210 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const ClassicalSymmetryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  // Camera push: start zoomed in, ease out
  const cameraScale = interpolate(frame, [0, 100], [1.06, 1.0], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Full position minus e2 and e7 (will animate)
  const whitePieces = fullWhitePieces(['e2']);
  const blackPieces = fullBlackPieces(['e7']);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${cameraScale})`, opacity: boardOpacity,
      }}>
        <ChessBoard glowSquares={frame > 60 ? ['e4', 'e5'] : []}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 1. e4 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="e2" toSquare="e4"
            squareSize={squareSize} startFrame={15} glow={COLORS.gold}
          />
          {/* 1... e5 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="e7" toSquare="e5"
            squareSize={squareSize} startFrame={50}
          />
        </ChessBoard>
        <InfoBox title="Classical chess begins." delay={70} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 3 — Development with Purpose (210–330 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const DevelopmentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position after 1.e4 e5 — knights will animate
  const whitePieces = [
    ...fullWhitePieces(['e2', 'g1']),
    { piece: PIECES.P, square: 'e4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'b8']),
    { piece: PIECES.p, square: 'e5' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardOpacity,
      }}>
        <ChessBoard
          highlightedSquares={['e4', 'e5']}
          glowSquares={frame > 60 ? ['f3', 'c6'] : []}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 2. Nf3 */}
          <AnimatedPiece
            symbol={PIECES.N} fromSquare="g1" toSquare="f3"
            squareSize={squareSize} startFrame={15} glow={COLORS.gold}
          />
          {/* 2... Nc6 */}
          <AnimatedPiece
            symbol={PIECES.n} fromSquare="b8" toSquare="c6"
            squareSize={squareSize} startFrame={50}
          />
        </ChessBoard>
        <InfoBox title="Development. Control. Balance." delay={65} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 4 — The Defining Move (330–510 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const DefiningMoveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position after 1.e4 e5 2.Nf3 Nc6 — bishop will animate to b5
  const whitePieces = [
    ...fullWhitePieces(['e2', 'g1', 'f1']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.N, square: 'f3' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'b8']),
    { piece: PIECES.p, square: 'e5' },
    { piece: PIECES.n, square: 'c6' },
  ];

  // Gradient text impact for "Ruy Lopez."
  const titleProgress = spring({ frame: frame - 55, fps, config: { damping: 15, stiffness: 100 } });
  const titleScale = interpolate(titleProgress, [0, 1], [1.15, 1]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardOpacity,
      }}>
        <ChessBoard
          highlightedSquares={['e4', 'e5', 'f3', 'c6']}
          glowSquares={frame > 40 ? ['b5', 'c6'] : []}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 3. Bb5 — the defining move */}
          <AnimatedPiece
            symbol={PIECES.B} fromSquare="f1" toSquare="b5"
            squareSize={squareSize} startFrame={20} duration={25} glow={COLORS.gold}
          />
        </ChessBoard>
      </AbsoluteFill>

      {/* Title overlay */}
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
          Ruy Lopez.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 5 — The Idea (510–690 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const TheIdeaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position after 3. Bb5
  const whitePieces = [
    ...fullWhitePieces(['e2', 'g1', 'f1']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.N, square: 'f3' },
    { piece: PIECES.B, square: 'b5' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'b8']),
    { piece: PIECES.p, square: 'e5' },
    { piece: PIECES.n, square: 'c6' },
  ];

  // Animated arrows: Bb5 → Nc6 (bishop pressures knight), Nc6 → e5 (knight defends e5)
  const arrowProgress1 = spring({ frame: frame - 30, fps, config: { damping: 15, stiffness: 100 } });
  const arrowProgress2 = spring({ frame: frame - 60, fps, config: { damping: 15, stiffness: 100 } });

  const boardSize = squareSize * 8;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['b5']}
          attackLine={['c6']}
          highlightedSquares={['e5']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}

          {/* Arrows */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: boardSize, height: boardSize, pointerEvents: 'none', zIndex: 20,
          }}>
            <defs>
              <marker id="ah-rl-1" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.gold} opacity={arrowProgress1} />
              </marker>
              <marker id="ah-rl-2" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.cyan} opacity={arrowProgress2} />
              </marker>
            </defs>
            {/* Bb5 → Nc6 (bishop pressures knight) */}
            <line
              x1={1.5 * squareSize} y1={3.5 * squareSize}
              x2={1.5 * squareSize + (2.5 * squareSize - 1.5 * squareSize) * arrowProgress1}
              y2={3.5 * squareSize + (2.5 * squareSize - 3.5 * squareSize) * arrowProgress1}
              stroke={COLORS.gold} strokeWidth={4}
              markerEnd={arrowProgress1 > 0.8 ? 'url(#ah-rl-1)' : undefined} opacity={0.9}
            />
            {/* Nc6 → e5 (knight defends e5) */}
            <line
              x1={2.5 * squareSize} y1={2.5 * squareSize}
              x2={2.5 * squareSize + (4.5 * squareSize - 2.5 * squareSize) * arrowProgress2}
              y2={2.5 * squareSize + (3.5 * squareSize - 2.5 * squareSize) * arrowProgress2}
              stroke={COLORS.cyan} strokeWidth={3}
              markerEnd={arrowProgress2 > 0.8 ? 'url(#ah-rl-2)' : undefined} opacity={0.7}
              strokeDasharray="8 4"
            />
          </svg>
        </ChessBoard>

        <InfoBox
          title="Pressure the defender of e5."
          delay={50}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 6 — Strategic Identity (690–930 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const StrategicIdentityScene: React.FC = () => {
  const squareSize = 56;

  // Position after 3...a6 4.Ba4: typical Ruy Lopez structure
  const whitePieces = [
    ...fullWhitePieces(['e2', 'g1', 'f1']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.N, square: 'f3' },
    { piece: PIECES.B, square: 'a4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'b8', 'a7']),
    { piece: PIECES.p, square: 'e5' },
    { piece: PIECES.n, square: 'c6' },
    { piece: PIECES.p, square: 'a6' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 150,
      }}>
        <ChessBoard
          glowSquares={['a4', 'e4']}
          highlightedSquares={['a6', 'c6', 'e5']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <BulletList
          header="One of the most respected openings."
          items={[
            'Long-term strategic pressure',
            'Flexible pawn structure',
            'Rich middlegame plans',
            'Played at every level',
          ]}
          delay={15}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 7 — Depth & Theory (930–1140 frames / 7s)
// ════════════════════════════════════════════════════════════════════════════

const DepthTheoryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sequential text reveals
  const text1Spring = spring({ frame: frame - 15, fps, config: { damping: 20, stiffness: 80 } });
  const text2Spring = spring({ frame: frame - 60, fps, config: { damping: 20, stiffness: 80 } });
  const text3Spring = spring({ frame: frame - 105, fps, config: { damping: 20, stiffness: 80 } });

  const text1Y = interpolate(text1Spring, [0, 1], [40, 0]);
  const text2Y = interpolate(text2Spring, [0, 1], [40, 0]);
  const text3Y = interpolate(text3Spring, [0, 1], [40, 0]);

  // Subtle background board
  const boardPulse = interpolate(Math.sin(frame * 0.05), [-1, 1], [0.05, 0.1]);

  return (
    <AbsoluteFill>
      <Background />

      {/* Faint background board */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: 'blur(6px)', opacity: boardPulse,
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

      {/* Text reveals */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 40,
      }}>
        <div style={{
          fontSize: 56, fontWeight: 800, color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          opacity: text1Spring,
          transform: `translateY(${text1Y}px)`,
          textShadow: `0 0 40px ${COLORS.purple}60`,
        }}>
          Highly strategic.
        </div>

        <div style={{
          fontSize: 56, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.warmGold} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif',
          opacity: text2Spring,
          transform: `translateY(${text2Y}px)`,
        }}>
          Rich in theory.
        </div>

        <div style={{
          fontSize: 56, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif',
          opacity: text3Spring,
          transform: `translateY(${text3Y}px)`,
        }}>
          Endless ideas.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 8 — Historical Touch (1140–1260 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const HistoricalTouchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Show the defining Bb5 position with warm sepia overlay
  const whitePieces = [
    ...fullWhitePieces(['e2', 'g1', 'f1']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.N, square: 'f3' },
    { piece: PIECES.B, square: 'b5' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'b8']),
    { piece: PIECES.p, square: 'e5' },
    { piece: PIECES.n, square: 'c6' },
  ];

  const nameOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const yearOpacity = spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />

      {/* Warm sepia overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(180, 130, 60, 0.08) 0%, transparent 70%)',
      }} />

      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard glowSquares={['b5']}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>
      </AbsoluteFill>

      {/* Historical text */}
      <div style={{
        position: 'absolute', bottom: 100, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          fontSize: 36, fontWeight: 700, color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          opacity: nameOpacity,
          textShadow: `0 0 20px ${COLORS.warmGold}40`,
        }}>
          Named after a Spanish priest.
        </div>
        <div style={{
          fontSize: 22, color: COLORS.warmGold,
          fontFamily: 'Inter, system-ui, sans-serif',
          opacity: yearOpacity,
        }}>
          Rodrigo L&oacute;pez de Segura — 1561
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 9 — End Card (1260–1350 frames / 3s)
// ════════════════════════════════════════════════════════════════════════════

const EndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pieceGlow = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.6, 1]);
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
        {/* Glowing bishop */}
        <div style={{
          fontSize: 80, color: '#ffffff',
          textShadow: `0 0 ${30 * pieceGlow}px ${COLORS.gold}, 0 0 ${60 * pieceGlow}px ${COLORS.gold}, 0 0 ${90 * pieceGlow}px ${COLORS.purple}40`,
          transform: `scale(${logoScale})`,
          marginBottom: 10,
        }}>
          {PIECES.B}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 48, fontWeight: 700,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.gold} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          Ruy Lopez — Intermediate
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

export const RuyLopez: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Scene 1: Title Card (0–90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Classical Symmetry (90–210 frames / 4s) */}
      <Sequence from={90} durationInFrames={120}>
        <ClassicalSymmetryScene />
      </Sequence>

      {/* Scene 3: Development with Purpose (210–330 frames / 4s) */}
      <Sequence from={210} durationInFrames={120}>
        <DevelopmentScene />
      </Sequence>

      {/* Scene 4: The Defining Move (330–510 frames / 6s) */}
      <Sequence from={330} durationInFrames={180}>
        <DefiningMoveScene />
      </Sequence>

      {/* Scene 5: The Idea (510–690 frames / 6s) */}
      <Sequence from={510} durationInFrames={180}>
        <TheIdeaScene />
      </Sequence>

      {/* Scene 6: Strategic Identity (690–930 frames / 8s) */}
      <Sequence from={690} durationInFrames={240}>
        <StrategicIdentityScene />
      </Sequence>

      {/* Scene 7: Depth & Theory (930–1140 frames / 7s) */}
      <Sequence from={930} durationInFrames={210}>
        <DepthTheoryScene />
      </Sequence>

      {/* Scene 8: Historical Touch (1140–1260 frames / 4s) */}
      <Sequence from={1140} durationInFrames={120}>
        <HistoricalTouchScene />
      </Sequence>

      {/* Scene 9: End Card (1260–1350 frames / 3s) */}
      <Sequence from={1260} durationInFrames={90}>
        <EndCardScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default RuyLopez;
