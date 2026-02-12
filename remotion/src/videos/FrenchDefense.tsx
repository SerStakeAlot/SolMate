import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors — steely, disciplined tone with muted gold accents
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  gold: '#FFD700',
  warmGold: '#D4A843',
  steelBlue: '#4A6FA5',
  dimGold: '#8B7335',
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
  dimSquares?: string[];
  children?: React.ReactNode;
}> = ({
  highlightedSquares = [], glowSquares = [], attackLine = [], dimSquares = [],
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
            const isDim = dimSquares.includes(square);

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
                {isDim && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: '#000000', opacity: 0.4,
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
                boxShadow: isCenter ? `inset 0 0 20px ${COLORS.steelBlue}${Math.floor(glowPulse * 255).toString(16).padStart(2, '0')}` : 'none',
              }} />
            );
          })}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.steelBlue} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          The French Defense
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          Controlled Resistance
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — The Quiet Response (90–210 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const QuietResponseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  // Camera pulls BACK (opposite of other videos — symbolizes restraint)
  const cameraScale = interpolate(frame, [0, 100], [1.0, 0.96], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Full starting position minus e2 and e7 pawns (will animate)
  const whitePieces = fullWhitePieces(['e2']);
  const blackPieces = fullBlackPieces(['e7']);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${cameraScale})`, opacity: boardOpacity,
      }}>
        <ChessBoard glowSquares={frame > 40 ? ['e4'] : []}>
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
          {/* 1... e6 — quiet, deliberate */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="e7" toSquare="e6"
            squareSize={squareSize} startFrame={55} duration={25}
          />
        </ChessBoard>
        <InfoBox title="Not every defense fights immediately." delay={70} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — The Structure Forms (120–300 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const StructureFormsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position after 1.e4 e6 — d2 and d7 pawns will animate
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2']),
    { piece: PIECES.P, square: 'e4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'd7']),
    { piece: PIECES.p, square: 'e6' },
  ];

  // Title impact after pawns lock
  const titleProgress = spring({ frame: frame - 80, fps, config: { damping: 15, stiffness: 100 } });
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
          glowSquares={frame > 70 ? ['e4', 'd5'] : ['e4']}
          highlightedSquares={frame > 70 ? ['d4', 'e6'] : []}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 2. d4 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="d2" toSquare="d4"
            squareSize={squareSize} startFrame={20} glow={COLORS.gold}
          />
          {/* 2... d5 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="d7" toSquare="d5"
            squareSize={squareSize} startFrame={50}
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
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.steelBlue} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
          filter: `drop-shadow(0 0 30px ${COLORS.purple}80)`,
        }}>
          French Defense.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 3 — The Pawn Chain Identity (300–540 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const PawnChainScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position after 1.e4 e6 2.d4 d5
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.P, square: 'd4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'd7']),
    { piece: PIECES.p, square: 'e6' },
    { piece: PIECES.p, square: 'd5' },
  ];

  // Diagonal chain line: d5→e6 (Black's pawn chain)
  const arrowProgress = spring({ frame: frame - 40, fps, config: { damping: 15, stiffness: 100 } });
  const boardSize = squareSize * 8;

  // Subtitle fade-in
  const subtitleOpacity = spring({ frame: frame - 90, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleY = interpolate(subtitleOpacity, [0, 1], [20, 0]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['d5', 'e6']}
          highlightedSquares={['e4', 'd4']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}

          {/* Diagonal line showing pawn chain d5→e6 */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: boardSize, height: boardSize, pointerEvents: 'none', zIndex: 20,
          }}>
            <defs>
              <marker id="ah-fd-chain" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.steelBlue} opacity={arrowProgress} />
              </marker>
            </defs>
            {/* d5 → e6 chain direction */}
            <line
              x1={3.5 * squareSize} y1={3.5 * squareSize}
              x2={3.5 * squareSize + (4.5 * squareSize - 3.5 * squareSize) * arrowProgress}
              y2={3.5 * squareSize + (2.5 * squareSize - 3.5 * squareSize) * arrowProgress}
              stroke={COLORS.steelBlue} strokeWidth={4}
              markerEnd={arrowProgress > 0.8 ? 'url(#ah-fd-chain)' : undefined} opacity={0.9}
            />
            {/* Extended chain line showing direction: could extend to f7 */}
            <line
              x1={4.5 * squareSize} y1={2.5 * squareSize}
              x2={4.5 * squareSize + (5.5 * squareSize - 4.5 * squareSize) * arrowProgress}
              y2={2.5 * squareSize + (1.5 * squareSize - 2.5 * squareSize) * arrowProgress}
              stroke={COLORS.steelBlue} strokeWidth={3}
              strokeDasharray="8 4" opacity={0.5 * arrowProgress}
            />
          </svg>
        </ChessBoard>

        <InfoBox title="Solid pawn structure." delay={30} />
      </AbsoluteFill>

      {/* Subtitle text */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)`,
      }}>
        <div style={{
          fontSize: 22, color: '#a1a1aa',
          fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic',
          textAlign: 'center', maxWidth: 600,
        }}>
          Black builds a resilient foundation — even if it means less space.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 4 — The Counterattack Plan (540–780 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const CounterattackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Position after 1.e4 e6 2.d4 d5 — c7 pawn will animate to c5
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.P, square: 'd4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['e7', 'd7', 'c7']),
    { piece: PIECES.p, square: 'e6' },
    { piece: PIECES.p, square: 'd5' },
  ];

  // Arrow: c5 → d4
  const arrowProgress = spring({ frame: frame - 60, fps, config: { damping: 15, stiffness: 100 } });
  const boardSize = squareSize * 8;

  // Subtle tension increase — slight zoom
  const tensionZoom = interpolate(frame, [40, 180], [1.0, 1.03], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring, transform: `scale(${tensionZoom})`,
      }}>
        <ChessBoard
          glowSquares={frame > 40 ? ['c5'] : []}
          highlightedSquares={['d4', 'e4']}
          attackLine={frame > 60 ? ['c5', 'd4'] : []}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* ...c5 push */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="c7" toSquare="c5"
            squareSize={squareSize} startFrame={20} duration={22} glow={COLORS.gold}
          />

          {/* Arrow: c5 → d4 */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: boardSize, height: boardSize, pointerEvents: 'none', zIndex: 20,
          }}>
            <defs>
              <marker id="ah-fd-counter" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.gold} opacity={arrowProgress} />
              </marker>
            </defs>
            <line
              x1={2.5 * squareSize} y1={3.5 * squareSize}
              x2={2.5 * squareSize + (3.5 * squareSize - 2.5 * squareSize) * arrowProgress}
              y2={3.5 * squareSize + (4.5 * squareSize - 3.5 * squareSize) * arrowProgress}
              stroke={COLORS.gold} strokeWidth={4}
              markerEnd={arrowProgress > 0.8 ? 'url(#ah-fd-counter)' : undefined} opacity={0.9}
            />
          </svg>
        </ChessBoard>

        <InfoBox
          title="Strike back with …c5."
          subtitle="Black challenges White's center from the side."
          delay={50}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 5 — The Strategic Tradeoff (780–1020 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const StrategicTradeoffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });

  // Typical French position after 1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.e5
  // Black's light-squared bishop is hemmed in
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.B, square: 'c1' },
    { piece: PIECES.Q, square: 'd1' }, { piece: PIECES.K, square: 'e1' },
    { piece: PIECES.B, square: 'f1' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.N, square: 'c3' }, { piece: PIECES.N, square: 'g1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.P, square: 'e5' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.b, square: 'c8' },
    { piece: PIECES.q, square: 'd8' }, { piece: PIECES.k, square: 'e8' },
    { piece: PIECES.b, square: 'f8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.n, square: 'b8' }, { piece: PIECES.n, square: 'f6' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c7' }, { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.p, square: 'e6' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  // Bishop dims over time
  const bishopDim = interpolate(frame, [30, 80], [1, 0.35], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  // Second text appears later
  const text2Opacity = spring({ frame: frame - 120, fps, config: { damping: 20, stiffness: 80 } });
  const text2Y = interpolate(text2Opacity, [0, 1], [20, 0]);

  // Subtle zoom to queenside
  const qsideShift = interpolate(frame, [0, 180], [0, 30], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
        transform: `translateX(-${qsideShift}px)`,
      }}>
        <ChessBoard
          glowSquares={['d5', 'e6']}
          highlightedSquares={['e5', 'd4']}
          dimSquares={['c8']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => {
            // Dim the c8 bishop
            if (square === 'c8') {
              return <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} opacity={bishopDim} />;
            }
            return <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />;
          })}
        </ChessBoard>

        <InfoBox title="Cramped… but dynamic." delay={30} />
      </AbsoluteFill>

      {/* Second line of text */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: text2Opacity, transform: `translateY(${text2Y}px)`,
      }}>
        <div style={{
          fontSize: 22, color: COLORS.warmGold,
          fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic',
          textAlign: 'center', maxWidth: 600,
        }}>
          The bishop on c8 can struggle — but strong players know how to free it.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 6 — Middlegame Identity (1020–1200 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const MiddlegameScene: React.FC = () => {
  const squareSize = 56;

  // Typical French middlegame: locked center, queenside tension, kingside space
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'g1' }, { piece: PIECES.R, square: 'f1' },
    { piece: PIECES.N, square: 'c3' }, { piece: PIECES.B, square: 'd3' },
    { piece: PIECES.N, square: 'f3' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.P, square: 'e5' }, { piece: PIECES.P, square: 'f4' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.b, square: 'b7' },
    { piece: PIECES.q, square: 'c7' }, { piece: PIECES.k, square: 'g8' },
    { piece: PIECES.r, square: 'f8' }, { piece: PIECES.b, square: 'e7' },
    { piece: PIECES.n, square: 'c6' }, { piece: PIECES.n, square: 'd7' },
    { piece: PIECES.p, square: 'a6' }, { piece: PIECES.p, square: 'b5' },
    { piece: PIECES.p, square: 'c5' }, { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.p, square: 'e6' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 150,
      }}>
        <ChessBoard
          glowSquares={['d4', 'e5', 'd5', 'e6']}
          highlightedSquares={['c5', 'b5', 'a6']}
          attackLine={['f4', 'f3']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <BulletList
          header="Closed center. Strategic battles."
          items={[
            'Locked pawn center',
            'Queenside counterplay for Black',
            'Kingside attacking potential for White',
          ]}
          delay={15}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 7 — End Card (1200–1350 frames / 5s)
// ════════════════════════════════════════════════════════════════════════════

const EndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const squareSize = 56;
  const boardSize = squareSize * 8;

  // Only the pawn chain remains illuminated — board fades dark
  const boardFade = interpolate(frame, [0, 40], [0.15, 0.08], {
    extrapolateRight: 'clamp',
  });

  const chainGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 0.9]);

  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const brandOpacity = spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />

      {/* Darkened board with only pawn chain glowing */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: boardSize, height: boardSize,
          borderRadius: 12, overflow: 'hidden', position: 'relative',
          opacity: boardFade,
          filter: 'blur(2px)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
            {RANKS.map((rank, rankIdx) =>
              FILES.map((file, fileIdx) => {
                const square = `${file}${rank}`;
                const isLight = (fileIdx + rankIdx) % 2 === 0;
                const isChain = ['d5', 'e6'].includes(square);

                return (
                  <div key={square} style={{
                    width: squareSize, height: squareSize,
                    backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
                    position: 'relative',
                  }}>
                    {isChain && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: COLORS.gold, opacity: chainGlow,
                        boxShadow: `inset 0 0 20px ${COLORS.gold}`,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          {/* Pawn chain pieces */}
          <StaticPiece symbol={PIECES.p} square="d5" squareSize={squareSize} glow={COLORS.gold} />
          <StaticPiece symbol={PIECES.p} square="e6" squareSize={squareSize} glow={COLORS.gold} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16,
      }}>
        {/* Glowing pawn chain symbol */}
        <div style={{
          fontSize: 80, color: '#ffffff', display: 'flex', gap: 8,
          textShadow: `0 0 ${30 * chainGlow}px ${COLORS.steelBlue}, 0 0 ${60 * chainGlow}px ${COLORS.steelBlue}, 0 0 ${90 * chainGlow}px ${COLORS.purple}40`,
          transform: `scale(${logoScale})`,
          marginBottom: 10,
        }}>
          {PIECES.p}{PIECES.p}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 48, fontWeight: 700,
          background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.steelBlue} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          French Defense — Intermediate
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

export const FrenchDefense: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Scene 1: Title Card (0–90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: The Quiet Response (90–210 frames / 4s) */}
      <Sequence from={90} durationInFrames={120}>
        <QuietResponseScene />
      </Sequence>

      {/* Scene 3: The Structure Forms (210–390 frames / 6s) */}
      <Sequence from={210} durationInFrames={180}>
        <StructureFormsScene />
      </Sequence>

      {/* Scene 4: The Pawn Chain Identity (390–630 frames / 8s) */}
      <Sequence from={390} durationInFrames={240}>
        <PawnChainScene />
      </Sequence>

      {/* Scene 5: The Counterattack Plan (630–870 frames / 8s) */}
      <Sequence from={630} durationInFrames={240}>
        <CounterattackScene />
      </Sequence>

      {/* Scene 6: The Strategic Tradeoff (870–1110 frames / 8s) */}
      <Sequence from={870} durationInFrames={240}>
        <StrategicTradeoffScene />
      </Sequence>

      {/* Scene 7: Middlegame Identity (1110–1290 frames / 6s) */}
      <Sequence from={1110} durationInFrames={180}>
        <MiddlegameScene />
      </Sequence>

      {/* Scene 8: End Card (1290–1440 frames / 5s) */}
      <Sequence from={1290} durationInFrames={150}>
        <EndCardScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default FrenchDefense;
