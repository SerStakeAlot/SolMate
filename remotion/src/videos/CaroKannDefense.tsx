import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors — disciplined, confident, positional strength. Deep teal/slate tones
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  gold: '#FFD700',
  teal: '#2E8B8B',
  deepTeal: '#1A6B6B',
  slate: '#708090',
  silver: '#C0C0C0',
  warmWhite: '#F5F0E8',
  bgDark: '#0a0b0e',
  bgGradientStart: '#0f1520',
  boardLight: '#E8E0D4',
  boardDark: '#7B8B6F',
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
        backgroundImage: `linear-gradient(rgba(46, 139, 139, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(46, 139, 139, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }} />
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400,
        background: `radial-gradient(ellipse, ${COLORS.teal}12 0%, transparent 70%)`,
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
    config: { damping: 22, stiffness: 90 },
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
  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.2, 0.45]);

  return (
    <div style={{
      width: boardSize, height: boardSize,
      borderRadius: 12, overflow: 'hidden', position: 'relative',
      boxShadow: `0 0 40px ${COLORS.teal}25, 0 20px 40px rgba(0,0,0,0.4)`,
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
                    backgroundColor: COLORS.teal, opacity: 0.3,
                  }} />
                )}
                {isGlow && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.warmWhite, opacity: glowPulse,
                    boxShadow: `inset 0 0 18px ${COLORS.warmWhite}`,
                  }} />
                )}
                {isAttackLine && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.teal, opacity: glowPulse * 0.5,
                    boxShadow: `inset 0 0 12px ${COLORS.teal}`,
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

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 90 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateY = interpolate(slideIn, [0, 1], [25, 0]);

  return (
    <div style={{
      position: 'absolute', bottom: 120, left: '50%',
      transform: `translateX(-50%) translateY(${translateY}px)`,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(20px)',
      borderRadius: 16, padding: '24px 48px',
      border: `2px solid ${COLORS.teal}`, opacity,
      textAlign: 'center', boxShadow: `0 0 30px ${COLORS.teal}30`,
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(20px)',
      borderRadius: 16, padding: '32px 40px',
      border: `2px solid ${COLORS.teal}`,
      boxShadow: `0 0 30px ${COLORS.teal}30`, maxWidth: 450,
    }}>
      <div style={{
        fontSize: 28, fontWeight: 700, color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 24, textAlign: 'center',
      }}>
        {header}
      </div>
      {items.map((item, idx) => {
        const itemDelay = delay + idx * 25;
        const itemSpring = spring({ frame: frame - itemDelay, fps, config: { damping: 22, stiffness: 90 } });
        const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);
        const translateX = interpolate(itemSpring, [0, 1], [25, 0]);

        return (
          <div key={idx} style={{
            fontSize: 20, color: COLORS.green,
            fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16,
            opacity: itemOpacity, transform: `translateX(${translateX}px)`,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ color: COLORS.teal }}>▸</span>
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

  const logoOpacity = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });
  const boardOpacity = spring({ frame: frame - 15, fps, config: { damping: 22, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 22, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 40, fps, config: { damping: 22, stiffness: 80 } });

  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.2, 0.4]);

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
              filter: `drop-shadow(0 0 30px ${COLORS.teal}60)`,
            }}
          />
        </div>

        {/* Mini chessboard silhouette */}
        <div style={{
          opacity: boardOpacity,
          display: 'grid', gridTemplateColumns: 'repeat(4, 40px)',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: `0 0 40px ${COLORS.teal}40`,
        }}>
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
            const isCenter = i === 5 || i === 6 || i === 9 || i === 10;
            return (
              <div key={i} style={{
                width: 40, height: 40,
                backgroundColor: (Math.floor(i/4) + i%4) % 2 === 0 ? COLORS.boardLight : COLORS.boardDark,
                boxShadow: isCenter ? `inset 0 0 15px ${COLORS.teal}${Math.floor(glowPulse * 255).toString(16).padStart(2, '0')}` : 'none',
              }} />
            );
          })}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.warmWhite} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          The Caro-Kann Defense
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          Modern Solidity
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — The Calm Response (90–210 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const CalmResponseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  const whitePieces = fullWhitePieces(['e2']);
  const blackPieces = fullBlackPieces(['c7']);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardOpacity,
      }}>
        <ChessBoard glowSquares={frame > 20 ? ['e4'] : []}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 1. e4 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="e2" toSquare="e4"
            squareSize={squareSize} startFrame={15} glow={COLORS.warmWhite}
          />
          {/* 1... c6 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="c7" toSquare="c6"
            squareSize={squareSize} startFrame={55}
          />
        </ChessBoard>
        <InfoBox title={`"Strength through structure."`} delay={65} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 3 — The Center Is Challenged (210–390 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const CenterChallengedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Position after 1.e4 c6
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2']),
    { piece: PIECES.P, square: 'e4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['c7', 'd7']),
    { piece: PIECES.p, square: 'c6' },
  ];

  // Title impact
  const titleProgress = spring({ frame: frame - 100, fps, config: { damping: 18, stiffness: 90 } });
  const titleScale = interpolate(titleProgress, [0, 1], [1.1, 1]);
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
          highlightedSquares={frame > 70 ? ['d4', 'c6'] : []}
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
            squareSize={squareSize} startFrame={20} glow={COLORS.warmWhite}
          />
          {/* 2... d5 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="d7" toSquare="d5"
            squareSize={squareSize} startFrame={55}
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
          background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.warmWhite} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
          filter: `drop-shadow(0 0 25px ${COLORS.teal}60)`,
        }}>
          Caro-Kann Defense.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 4 — The Structural Identity (390–630 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const StructuralIdentityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  const boardSize = squareSize * 8;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Position after 1.e4 c6 2.d4 d5
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.P, square: 'd4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['c7', 'd7']),
    { piece: PIECES.p, square: 'c6' },
    { piece: PIECES.p, square: 'd5' },
  ];

  // Chain arrow c6→d5
  const arrowProgress = spring({ frame: frame - 40, fps, config: { damping: 15, stiffness: 90 } });

  // Voiceover text
  const voiceOpacity = spring({ frame: frame - 110, fps, config: { damping: 22, stiffness: 80 } });
  const voiceY = interpolate(voiceOpacity, [0, 1], [15, 0]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['c6', 'd5']}
          highlightedSquares={['e4', 'd4']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}

          {/* Structural line c6→d5 */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: boardSize, height: boardSize, pointerEvents: 'none', zIndex: 20,
          }}>
            <defs>
              <marker id="ah-ck-chain" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.teal} opacity={arrowProgress} />
              </marker>
            </defs>
            <line
              x1={2.5 * squareSize} y1={2.5 * squareSize}
              x2={2.5 * squareSize + (3.5 * squareSize - 2.5 * squareSize) * arrowProgress}
              y2={2.5 * squareSize + (3.5 * squareSize - 2.5 * squareSize) * arrowProgress}
              stroke={COLORS.teal} strokeWidth={4}
              markerEnd={arrowProgress > 0.8 ? 'url(#ah-ck-chain)' : undefined} opacity={0.9}
            />
          </svg>
        </ChessBoard>

        <InfoBox title="Very solid pawn structure." delay={30} />
      </AbsoluteFill>

      {/* Voiceover text */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: voiceOpacity, transform: `translateY(${voiceY}px)`,
      }}>
        <div style={{
          fontSize: 22, color: '#a1a1aa',
          fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic',
          textAlign: 'center', maxWidth: 600,
        }}>
          Black challenges the center without weakening the position.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 5 — The Key Difference (630–870 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const KeyDifferenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 40;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // French structure (left) — bishop blocked on c8
  const frenchWhite = [
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.N, square: 'c3' },
  ];
  const frenchBlack = [
    { piece: PIECES.p, square: 'e6' }, { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.b, square: 'c8' },
  ];

  // Caro-Kann structure (right) — bishop free on f5
  const ckWhite = [
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.N, square: 'c3' },
  ];
  const ckBlack = [
    { piece: PIECES.p, square: 'c6' }, { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.b, square: 'f5' },
  ];

  // Bishop dim on French side
  const bishopDim = interpolate(frame, [60, 120], [1, 0.3], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  // Bishop glow on CK side
  const bishopGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.5, 1.0]);

  // Labels
  const labelOpacity = spring({ frame: frame - 40, fps, config: { damping: 22, stiffness: 80 } });

  const renderMiniBoard = (
    pieces: { piece: string; square: string; opacity?: number; glow?: string }[],
    label: string,
    dimSquares: string[],
    glowSquares: string[],
  ) => {
    const boardSize = squareSize * 8;
    const boardGlow = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.2, 0.4]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          fontSize: 24, fontWeight: 700, color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif', opacity: labelOpacity,
        }}>
          {label}
        </div>
        <div style={{
          width: boardSize, height: boardSize,
          borderRadius: 10, overflow: 'hidden', position: 'relative',
          boxShadow: `0 0 30px ${COLORS.teal}20`,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
            {RANKS.map((rank, rankIdx) =>
              FILES.map((file, fileIdx) => {
                const square = `${file}${rank}`;
                const isLight = (fileIdx + rankIdx) % 2 === 0;
                const isDim = dimSquares.includes(square);
                const isGlow = glowSquares.includes(square);

                return (
                  <div key={square} style={{
                    width: squareSize, height: squareSize,
                    backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
                    position: 'relative',
                  }}>
                    {isDim && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', opacity: 0.35 }} />
                    )}
                    {isGlow && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: COLORS.teal, opacity: boardGlow * 0.4,
                        boxShadow: `inset 0 0 12px ${COLORS.teal}`,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          {pieces.map(({ piece, square, opacity, glow }) => {
            const pos = getSquarePos(square, squareSize);
            return (
              <div key={square} style={{
                position: 'absolute', left: pos.x, top: pos.y,
                width: squareSize, height: squareSize,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: squareSize * 0.7, color: '#ffffff',
                textShadow: glow
                  ? `0 0 15px ${glow}, 0 0 30px ${glow}`
                  : '0 2px 4px rgba(0,0,0,0.5)',
                zIndex: 10, opacity: opacity ?? 1,
              }}>
                {piece}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 60, opacity: boardSpring,
      }}>
        {renderMiniBoard(
          [
            ...frenchWhite.map(p => ({ ...p })),
            ...frenchBlack.map(p =>
              p.square === 'c8' ? { ...p, opacity: bishopDim } : { ...p }
            ),
          ],
          'French Defense',
          ['c8'],
          ['e6', 'd5'],
        )}
        {renderMiniBoard(
          [
            ...ckWhite.map(p => ({ ...p })),
            ...ckBlack.map(p =>
              p.square === 'f5' ? { ...p, glow: `rgba(46, 139, 139, ${bishopGlow})` } : { ...p }
            ),
          ],
          'Caro-Kann Defense',
          [],
          ['c6', 'd5', 'f5'],
        )}
      </AbsoluteFill>

      <InfoBox title="Light-squared bishop stays active." delay={60} />
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 6 — Space & Comfort (870–1050 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const SpaceComfortScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Balanced Caro-Kann position after ...Bf5
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2', 'b1']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.N, square: 'c3' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['c7', 'd7', 'c8', 'g8']),
    { piece: PIECES.p, square: 'c6' },
    { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.b, square: 'f5' },
    { piece: PIECES.n, square: 'f6' },
  ];

  // Gentle zoom out
  const cameraScale = interpolate(frame, [0, 160], [1.05, 1.0], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  // Voiceover text
  const voiceOpacity = spring({ frame: frame - 90, fps, config: { damping: 22, stiffness: 80 } });
  const voiceY = interpolate(voiceOpacity, [0, 1], [15, 0]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring, transform: `scale(${cameraScale})`,
      }}>
        <ChessBoard
          glowSquares={['f5']}
          highlightedSquares={['c6', 'd5']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize}
              glow={square === 'f5' ? COLORS.teal : undefined}
            />
          ))}
        </ChessBoard>

        <InfoBox title="Less cramped than the French." delay={30} />
      </AbsoluteFill>

      {/* Voiceover */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        opacity: voiceOpacity, transform: `translateY(${voiceY}px)`,
      }}>
        <div style={{
          fontSize: 22, color: '#a1a1aa',
          fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'italic',
          textAlign: 'center', maxWidth: 600,
        }}>
          Black avoids long-term passivity and keeps pieces flexible.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 7 — Championship Credibility (1050–1230 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const ChampionshipScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Same balanced position
  const whitePieces = [
    ...fullWhitePieces(['e2', 'd2', 'b1']),
    { piece: PIECES.P, square: 'e4' },
    { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.N, square: 'c3' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['c7', 'd7', 'c8', 'g8']),
    { piece: PIECES.p, square: 'c6' },
    { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.b, square: 'f5' },
    { piece: PIECES.n, square: 'f6' },
  ];

  // Spotlight vignette effect
  const spotlightSize = interpolate(frame, [0, 80], [300, 500], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['c6', 'd5', 'f5']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}

          {/* Spotlight overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none',
            background: `radial-gradient(circle ${spotlightSize}px at 50% 50%, transparent 0%, rgba(0,0,0,0.3) 100%)`,
          }} />
        </ChessBoard>

        <InfoBox title={`"Favorite of Karpov and Anand."`} delay={40} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 8 — Strategic Middlegame Preview (1230–1350 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const MiddlegamePreviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Developed Caro-Kann — ...Bf5, ...e6, O-O
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'g1' }, { piece: PIECES.R, square: 'f1' },
    { piece: PIECES.N, square: 'f3' }, { piece: PIECES.N, square: 'd2' },
    { piece: PIECES.B, square: 'd3' }, { piece: PIECES.B, square: 'c1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'g8' }, { piece: PIECES.r, square: 'f8' },
    { piece: PIECES.b, square: 'f5' }, { piece: PIECES.b, square: 'e7' },
    { piece: PIECES.n, square: 'f6' }, { piece: PIECES.n, square: 'd7' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c6' }, { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.p, square: 'e6' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 150,
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['f5', 'c6', 'd5']}
          highlightedSquares={['e6', 'e7', 'g8']}
          attackLine={['f1', 'f8']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <BulletList
          header="Reliable. Durable. Precise."
          items={[
            'Bishop to f5 — active development',
            'Pawn to e6 — solid structure',
            'Short castle — king safety',
          ]}
          delay={15}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 9 — End Card (1350–1500 frames / 5s)
// ════════════════════════════════════════════════════════════════════════════

const EndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const squareSize = 56;
  const boardSize = squareSize * 8;

  const boardFade = interpolate(frame, [0, 40], [0.15, 0.07], {
    extrapolateRight: 'clamp',
  });

  const softGlow = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.4, 0.8]);

  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 22, stiffness: 80 } });
  const brandOpacity = spring({ frame: frame - 50, fps, config: { damping: 22, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />

      {/* Darkened board with only c6–d5 pawn chain glowing */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: boardSize, height: boardSize,
          borderRadius: 12, overflow: 'hidden', position: 'relative',
          opacity: boardFade, filter: 'blur(2px)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
            {RANKS.map((rank, rankIdx) =>
              FILES.map((file, fileIdx) => {
                const square = `${file}${rank}`;
                const isLight = (fileIdx + rankIdx) % 2 === 0;
                const isGlowing = ['c6', 'd5'].includes(square);

                return (
                  <div key={square} style={{
                    width: squareSize, height: squareSize,
                    backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
                    position: 'relative',
                  }}>
                    {isGlowing && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: COLORS.teal, opacity: softGlow * 0.4,
                        boxShadow: `inset 0 0 18px ${COLORS.teal}`,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <StaticPiece symbol={PIECES.p} square="c6" squareSize={squareSize} glow={COLORS.teal} />
          <StaticPiece symbol={PIECES.p} square="d5" squareSize={squareSize} glow={COLORS.teal} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16,
      }}>
        {/* Glowing pawn chain symbol */}
        <div style={{
          fontSize: 80, color: '#ffffff', display: 'flex', gap: 8,
          textShadow: `0 0 ${25 * softGlow}px ${COLORS.teal}, 0 0 ${50 * softGlow}px ${COLORS.teal}`,
          transform: `scale(${logoScale})`,
          marginBottom: 10,
        }}>
          {PIECES.p}{PIECES.p}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 48, fontWeight: 700,
          background: `linear-gradient(135deg, ${COLORS.teal} 0%, ${COLORS.warmWhite} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          Caro-Kann Defense — Intermediate
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
              filter: `drop-shadow(0 0 30px ${COLORS.teal}60)`,
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

export const CaroKannDefense: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Scene 1: Title Card (0–90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: The Calm Response (90–210 frames / 4s) */}
      <Sequence from={90} durationInFrames={120}>
        <CalmResponseScene />
      </Sequence>

      {/* Scene 3: The Center Is Challenged (210–390 frames / 6s) */}
      <Sequence from={210} durationInFrames={180}>
        <CenterChallengedScene />
      </Sequence>

      {/* Scene 4: The Structural Identity (390–630 frames / 8s) */}
      <Sequence from={390} durationInFrames={240}>
        <StructuralIdentityScene />
      </Sequence>

      {/* Scene 5: The Key Difference (630–870 frames / 8s) */}
      <Sequence from={630} durationInFrames={240}>
        <KeyDifferenceScene />
      </Sequence>

      {/* Scene 6: Space & Comfort (870–1050 frames / 6s) */}
      <Sequence from={870} durationInFrames={180}>
        <SpaceComfortScene />
      </Sequence>

      {/* Scene 7: Championship Credibility (1050–1230 frames / 6s) */}
      <Sequence from={1050} durationInFrames={180}>
        <ChampionshipScene />
      </Sequence>

      {/* Scene 8: Strategic Middlegame Preview (1230–1350 frames / 4s) */}
      <Sequence from={1230} durationInFrames={120}>
        <MiddlegamePreviewScene />
      </Sequence>

      {/* Scene 9: End Card (1350–1500 frames / 5s) */}
      <Sequence from={1350} durationInFrames={150}>
        <EndCardScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default CaroKannDefense;
