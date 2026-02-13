import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors — calm, clean, confidence-building. Warm neutrals with soft blue accents
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  gold: '#FFD700',
  warmBlue: '#5B8DBE',
  softCream: '#F5E6CA',
  calmGreen: '#7BC67E',
  slate: '#64748B',
  bgDark: '#0c0c10',
  bgGradientStart: '#141420',
  boardLight: '#F0E4D4',
  boardDark: '#A47551',
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
        backgroundImage: `linear-gradient(rgba(91, 141, 190, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(91, 141, 190, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px',
      }} />
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 400,
        background: `radial-gradient(ellipse, ${COLORS.warmBlue}15 0%, transparent 70%)`,
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
  children?: React.ReactNode;
}> = ({
  highlightedSquares = [], glowSquares = [], attackLine = [],
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
      boxShadow: `0 0 40px ${COLORS.warmBlue}25, 0 20px 40px rgba(0,0,0,0.4)`,
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
                    backgroundColor: COLORS.warmBlue, opacity: 0.3,
                  }} />
                )}
                {isGlow && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.softCream, opacity: glowPulse,
                    boxShadow: `inset 0 0 18px ${COLORS.softCream}`,
                  }} />
                )}
                {isAttackLine && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: COLORS.calmGreen, opacity: glowPulse * 0.5,
                    boxShadow: `inset 0 0 12px ${COLORS.calmGreen}`,
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
      border: `2px solid ${COLORS.warmBlue}`, opacity,
      textAlign: 'center', boxShadow: `0 0 30px ${COLORS.warmBlue}30`,
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
          fontSize: 22, color: COLORS.calmGreen,
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
      border: `2px solid ${COLORS.warmBlue}`,
      boxShadow: `0 0 30px ${COLORS.warmBlue}30`, maxWidth: 450,
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
            fontSize: 20, color: COLORS.calmGreen,
            fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 16,
            opacity: itemOpacity, transform: `translateX(${translateX}px)`,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ color: COLORS.warmBlue }}>▸</span>
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
              filter: `drop-shadow(0 0 30px ${COLORS.warmBlue}60)`,
            }}
          />
        </div>

        {/* Mini chessboard silhouette */}
        <div style={{
          opacity: boardOpacity,
          display: 'grid', gridTemplateColumns: 'repeat(4, 40px)',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: `0 0 40px ${COLORS.warmBlue}40`,
        }}>
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
            const isCenter = i === 5 || i === 6 || i === 9 || i === 10;
            return (
              <div key={i} style={{
                width: 40, height: 40,
                backgroundColor: (Math.floor(i/4) + i%4) % 2 === 0 ? COLORS.boardLight : COLORS.boardDark,
                boxShadow: isCenter ? `inset 0 0 15px ${COLORS.warmBlue}${Math.floor(glowPulse * 255).toString(16).padStart(2, '0')}` : 'none',
              }} />
            );
          })}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72, fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.warmBlue} 0%, ${COLORS.softCream} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          The London System
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          Structure First
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 2 — Calm Beginning (90–210 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const CalmBeginningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  const whitePieces = fullWhitePieces(['d2']);
  const blackPieces = fullBlackPieces(['d7']);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardOpacity,
      }}>
        <ChessBoard glowSquares={frame > 20 ? ['d4'] : []}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 1. d4 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="d2" toSquare="d4"
            squareSize={squareSize} startFrame={15} glow={COLORS.softCream}
          />
          {/* 1... d5 */}
          <AnimatedPiece
            symbol={PIECES.p} fromSquare="d7" toSquare="d5"
            squareSize={squareSize} startFrame={55}
          />
        </ChessBoard>
        <InfoBox title={`"Want something simple?"`} delay={65} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 3 — The Defining Move (210–330 frames / 4s)
// ════════════════════════════════════════════════════════════════════════════

const DefiningMoveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Position after 1.d4 d5
  const whitePieces = [
    ...fullWhitePieces(['d2', 'c1']),
    { piece: PIECES.P, square: 'd4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['d7']),
    { piece: PIECES.p, square: 'd5' },
  ];

  // Title impact
  const titleProgress = spring({ frame: frame - 60, fps, config: { damping: 18, stiffness: 90 } });
  const titleScale = interpolate(titleProgress, [0, 1], [1.1, 1]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardOpacity,
      }}>
        <ChessBoard glowSquares={frame > 30 ? ['f4'] : ['d4']}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 2. Bf4 — the defining move */}
          <AnimatedPiece
            symbol={PIECES.B} fromSquare="c1" toSquare="f4"
            squareSize={squareSize} startFrame={20} duration={25} glow={COLORS.warmBlue}
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
          background: `linear-gradient(135deg, ${COLORS.warmBlue} 0%, ${COLORS.softCream} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
          filter: `drop-shadow(0 0 25px ${COLORS.warmBlue}60)`,
        }}>
          London System.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 4 — The Setup Continues (330–510 frames / 6s)
// ════════════════════════════════════════════════════════════════════════════

const SetupContinuesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Position after 1.d4 d5 2.Bf4
  const whitePieces = [
    ...fullWhitePieces(['d2', 'c1', 'e2']),
    { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.B, square: 'f4' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['d7']),
    { piece: PIECES.p, square: 'd5' },
  ];

  // Gentle zoom out
  const cameraScale = interpolate(frame, [0, 160], [1.04, 1.0], {
    extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring, transform: `scale(${cameraScale})`,
      }}>
        <ChessBoard
          glowSquares={['f4', 'd4']}
          highlightedSquares={frame > 30 ? ['e3'] : []}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* 3. e3 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="e2" toSquare="e3"
            squareSize={squareSize} startFrame={25} glow={COLORS.softCream}
          />
        </ChessBoard>

        <InfoBox title="Simple. Consistent." delay={50} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 5 — The Core Idea (510–750 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const CoreIdeaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Position after 1.d4 d5 2.Bf4 e3
  const whitePieces = [
    ...fullWhitePieces(['d2', 'c1', 'e2']),
    { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.B, square: 'f4' },
    { piece: PIECES.P, square: 'e3' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['d7']),
    { piece: PIECES.p, square: 'd5' },
  ];

  // Second text
  const text2Opacity = spring({ frame: frame - 100, fps, config: { damping: 22, stiffness: 80 } });
  const text2Y = interpolate(text2Opacity, [0, 1], [20, 0]);

  // Voiceover text
  const voiceOpacity = spring({ frame: frame - 150, fps, config: { damping: 22, stiffness: 80 } });
  const voiceY = interpolate(voiceOpacity, [0, 1], [15, 0]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['f4', 'd4', 'e3']}
        >
          {whitePieces.map(({ piece, square }) => {
            if (square === 'f4') {
              return <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} glow={COLORS.warmBlue} />;
            }
            return <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />;
          })}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <InfoBox title="Bishop develops early." subtitle="Solid pawn structure." delay={30} />
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
          No early complications. Just safe development and control.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 6 — Why Beginners Love It (750–990 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const WhyBeginnersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardSpring = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 80 } });

  // Position after 1.d4 d5 2.Bf4 Nf6 3.e3 — now animate Nf3, c3, O-O
  const whitePieces = [
    ...fullWhitePieces(['d2', 'c1', 'e2', 'g1', 'c2', 'e1', 'h1']),
    { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.B, square: 'f4' },
    { piece: PIECES.P, square: 'e3' },
    { piece: PIECES.B, square: 'f1' },
  ];
  const blackPieces = [
    ...fullBlackPieces(['d7', 'g8']),
    { piece: PIECES.p, square: 'd5' },
    { piece: PIECES.n, square: 'f6' },
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: boardSpring,
      }}>
        <ChessBoard
          glowSquares={['f4', 'd4', 'e3']}
          attackLine={frame > 120 ? ['c3', 'f3'] : frame > 60 ? ['f3'] : []}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* Nf3 */}
          <AnimatedPiece
            symbol={PIECES.N} fromSquare="g1" toSquare="f3"
            squareSize={squareSize} startFrame={25} glow={COLORS.softCream}
          />
          {/* c3 */}
          <AnimatedPiece
            symbol={PIECES.P} fromSquare="c2" toSquare="c3"
            squareSize={squareSize} startFrame={80}
          />
          {/* Castling — King to g1, Rook to f1 */}
          <AnimatedPiece
            symbol={PIECES.K} fromSquare="e1" toSquare="g1"
            squareSize={squareSize} startFrame={140} glow={COLORS.warmBlue}
          />
          <AnimatedPiece
            symbol={PIECES.R} fromSquare="h1" toSquare="f1"
            squareSize={squareSize} startFrame={140}
          />
        </ChessBoard>

        <InfoBox title="Same setup." subtitle="Almost any Black response." delay={100} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 7 — Learning Value (990–1230 frames / 8s)
// ════════════════════════════════════════════════════════════════════════════

const LearningValueScene: React.FC = () => {
  const squareSize = 56;

  // Classic London structure — fully developed
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'g1' }, { piece: PIECES.R, square: 'f1' },
    { piece: PIECES.N, square: 'f3' }, { piece: PIECES.N, square: 'd2' },
    { piece: PIECES.B, square: 'f4' }, { piece: PIECES.B, square: 'd3' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c3' }, { piece: PIECES.P, square: 'd4' },
    { piece: PIECES.P, square: 'e3' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];

  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.b, square: 'c8' },
    { piece: PIECES.q, square: 'd8' }, { piece: PIECES.k, square: 'g8' },
    { piece: PIECES.r, square: 'f8' }, { piece: PIECES.b, square: 'e7' },
    { piece: PIECES.n, square: 'f6' }, { piece: PIECES.n, square: 'b8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
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
          glowSquares={['d4', 'e3', 'c3', 'f4']}
          highlightedSquares={['d3', 'f3', 'd2']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>

        <BulletList
          header="Great for learning fundamentals."
          items={[
            'Structure and coordination',
            'Long-term planning',
            'Consistent development',
            'Works at every level',
          ]}
          delay={15}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SCENE 8 — End Card (1230–1380 frames / 5s)
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

      {/* Darkened board with only bishop on f4 and d4 pawn glowing */}
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
                const isGlowing = ['f4', 'd4'].includes(square);

                return (
                  <div key={square} style={{
                    width: squareSize, height: squareSize,
                    backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
                    position: 'relative',
                  }}>
                    {isGlowing && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: COLORS.softCream, opacity: softGlow * 0.5,
                        boxShadow: `inset 0 0 18px ${COLORS.softCream}`,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <StaticPiece symbol={PIECES.B} square="f4" squareSize={squareSize} glow={COLORS.warmBlue} />
          <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} glow={COLORS.softCream} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16,
      }}>
        {/* Glowing bishop symbol */}
        <div style={{
          fontSize: 80, color: '#ffffff',
          textShadow: `0 0 ${25 * softGlow}px ${COLORS.warmBlue}, 0 0 ${50 * softGlow}px ${COLORS.warmBlue}`,
          transform: `scale(${logoScale})`,
          marginBottom: 10,
        }}>
          {PIECES.B}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 48, fontWeight: 700,
          background: `linear-gradient(135deg, ${COLORS.warmBlue} 0%, ${COLORS.softCream} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          opacity: titleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center',
        }}>
          London System — Beginner
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
              filter: `drop-shadow(0 0 30px ${COLORS.warmBlue}60)`,
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

export const LondonSystem: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Scene 1: Title Card (0–90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Calm Beginning (90–210 frames / 4s) */}
      <Sequence from={90} durationInFrames={120}>
        <CalmBeginningScene />
      </Sequence>

      {/* Scene 3: The Defining Move (210–330 frames / 4s) */}
      <Sequence from={210} durationInFrames={120}>
        <DefiningMoveScene />
      </Sequence>

      {/* Scene 4: The Setup Continues (330–510 frames / 6s) */}
      <Sequence from={330} durationInFrames={180}>
        <SetupContinuesScene />
      </Sequence>

      {/* Scene 5: The Core Idea (510–750 frames / 8s) */}
      <Sequence from={510} durationInFrames={240}>
        <CoreIdeaScene />
      </Sequence>

      {/* Scene 6: Why Beginners Love It (750–990 frames / 8s) */}
      <Sequence from={750} durationInFrames={240}>
        <WhyBeginnersScene />
      </Sequence>

      {/* Scene 7: Learning Value (990–1230 frames / 8s) */}
      <Sequence from={990} durationInFrames={240}>
        <LearningValueScene />
      </Sequence>

      {/* Scene 8: End Card (1230–1380 frames / 5s) */}
      <Sequence from={1230} durationInFrames={150}>
        <EndCardScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default LondonSystem;
