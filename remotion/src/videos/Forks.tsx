import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  bgDark: '#0a0a0a',
  bgGradientStart: '#1a1025',
  boardLight: '#e8e4f0',
  boardDark: '#6b5b95',
  gold: '#FFD700',
  goldGlow: '#FFD70080',
  red: '#ff4444',
  gray: '#666666',
};

// Chess piece symbols
const PIECES = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Background Component
const Background: React.FC = () => {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, ${COLORS.bgGradientStart} 0%, ${COLORS.bgDark} 70%)`,
        }}
      />
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
    </AbsoluteFill>
  );
};

// Get square position
const getSquarePos = (square: string, squareSize: number) => {
  const file = FILES.indexOf(square[0]);
  const rank = RANKS.indexOf(square[1]);
  return { x: file * squareSize, y: rank * squareSize };
};

// Static Piece
const StaticPiece: React.FC<{
  symbol: string;
  square: string;
  squareSize: number;
  opacity?: number;
  glow?: string;
}> = ({ symbol, square, squareSize, opacity = 1, glow }) => {
  const pos = getSquarePos(square, squareSize);

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: squareSize,
        height: squareSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: squareSize * 0.75,
        color: '#ffffff',
        textShadow: glow ? `0 0 20px ${glow}, 0 0 40px ${glow}` : '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10,
        opacity,
      }}
    >
      {symbol}
    </div>
  );
};

// Animated Piece Movement
const AnimatedPiece: React.FC<{
  symbol: string;
  fromSquare: string;
  toSquare: string;
  squareSize: number;
  startFrame: number;
  duration: number;
  glow?: string;
}> = ({ symbol, fromSquare, toSquare, squareSize, startFrame, duration, glow }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fromPos = getSquarePos(fromSquare, squareSize);
  const toPos = getSquarePos(toSquare, squareSize);

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
    durationInFrames: duration,
  });

  const x = interpolate(progress, [0, 1], [fromPos.x, toPos.x]);
  const y = interpolate(progress, [0, 1], [fromPos.y, toPos.y]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: squareSize,
        height: squareSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: squareSize * 0.75,
        color: '#ffffff',
        textShadow: glow ? `0 0 20px ${glow}, 0 0 40px ${glow}` : '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 15,
      }}
    >
      {symbol}
    </div>
  );
};

// Attack Arrow
const AttackArrow: React.FC<{
  fromSquare: string;
  toSquare: string;
  squareSize: number;
  opacity: number;
  color?: string;
}> = ({ fromSquare, toSquare, squareSize, opacity, color = COLORS.gold }) => {
  const fromPos = getSquarePos(fromSquare, squareSize);
  const toPos = getSquarePos(toSquare, squareSize);

  const fromX = fromPos.x + squareSize / 2;
  const fromY = fromPos.y + squareSize / 2;
  const toX = toPos.x + squareSize / 2;
  const toY = toPos.y + squareSize / 2;

  const angle = Math.atan2(toY - fromY, toX - fromX);
  const length = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2) - squareSize * 0.6;

  return (
    <div
      style={{
        position: 'absolute',
        left: fromX,
        top: fromY,
        width: length,
        height: 4,
        backgroundColor: color,
        transform: `rotate(${angle}rad)`,
        transformOrigin: '0 50%',
        opacity,
        boxShadow: `0 0 10px ${color}`,
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -8,
          top: -6,
          width: 0,
          height: 0,
          borderLeft: `12px solid ${color}`,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
        }}
      />
    </div>
  );
};

// ChessBoard Component
const ChessBoard: React.FC<{
  highlightSquares?: string[];
  candidateSquares?: string[];
  dimBoard?: boolean;
  children?: React.ReactNode;
}> = ({ highlightSquares = [], candidateSquares = [], dimBoard = false, children }) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;

  const pulseOpacity = interpolate(Math.sin(frame * 0.12), [-1, 1], [0.25, 0.6]);
  const candidatePulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.15, 0.4]);

  return (
    <div
      style={{
        width: boardSize,
        height: boardSize,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `0 0 60px ${COLORS.purple}40, 0 20px 40px rgba(0,0,0,0.5)`,
        position: 'relative',
        opacity: dimBoard ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
        {RANKS.map((rank, rankIdx) =>
          FILES.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const isLight = (fileIdx + rankIdx) % 2 === 0;
            const isHighlighted = highlightSquares.includes(square);
            const isCandidate = candidateSquares.includes(square);

            return (
              <div
                key={square}
                style={{
                  width: squareSize,
                  height: squareSize,
                  backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
                  position: 'relative',
                }}
              >
                {isHighlighted && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.gold,
                      opacity: pulseOpacity,
                      boxShadow: `inset 0 0 15px ${COLORS.gold}`,
                    }}
                  />
                )}
                {isCandidate && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.purple,
                      opacity: candidatePulse,
                      boxShadow: `inset 0 0 12px ${COLORS.purple}`,
                    }}
                  />
                )}
                {fileIdx === 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 2,
                    left: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    color: isLight ? COLORS.boardDark : COLORS.boardLight,
                  }}>
                    {rank}
                  </span>
                )}
                {rankIdx === 7 && (
                  <span style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    color: isLight ? COLORS.boardDark : COLORS.boardLight,
                  }}>
                    {file}
                  </span>
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

// Info Box Component
const InfoBox: React.FC<{
  title: string;
  lines: string[];
  titleColor?: string;
  delay?: number;
}> = ({ title, lines, titleColor = COLORS.gold, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 100 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateX = interpolate(slideIn, [0, 1], [50, 0]);

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '28px 36px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        opacity,
        transform: `translateX(${translateX}px)`,
        maxWidth: 420,
      }}
    >
      <div style={{
        fontSize: 48,
        fontWeight: 700,
        color: titleColor,
        marginBottom: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
        textShadow: `0 0 30px ${titleColor}60`,
      }}>
        {title}
      </div>
      {lines.map((line, idx) => (
        <div key={idx} style={{
          fontSize: 22,
          color: '#d4d4d4',
          lineHeight: 1.5,
          fontFamily: 'Inter, system-ui, sans-serif',
          marginBottom: 8,
        }}>
          {line}
        </div>
      ))}
    </div>
  );
};

// ─── Scene 1: Title Scene ───────────────────────────────────────────

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const knightScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 80 } });
  const knightGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.8]);
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{
          fontSize: 120,
          transform: `scale(${knightScale})`,
          color: '#ffffff',
          filter: `drop-shadow(0 0 ${30 + knightGlow * 20}px ${COLORS.gold})`,
          opacity: 0.9,
        }}>
          {PIECES.N}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            background: `linear-gradient(135deg, #ffffff 0%, ${COLORS.gold} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: titleOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          Forks
        </div>
        <div style={{
          fontSize: 32,
          color: '#a1a1aa',
          opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          Beginner Tactics
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 2: The Surprise Move ─────────────────────────────────────
// Knight jumps from b5 to c7, forking King on e8 and Rook on a8

const SurpriseMoveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  const knightMoveStart = 25;
  const knightMoved = frame >= knightMoveStart + 20;

  const showHighlights = frame > knightMoveStart + 25;
  const arrowOpacity = showHighlights ? interpolate(frame, [knightMoveStart + 25, knightMoveStart + 35], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  const highlightSquares = showHighlights ? ['e8', 'a8'] : [];

  // Text fade-in
  const textOpacity = showHighlights ? interpolate(frame, [knightMoveStart + 30, knightMoveStart + 45], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightSquares={highlightSquares}>
            {/* Black pieces */}
            <StaticPiece symbol={PIECES.k} square="e8" squareSize={squareSize} glow={showHighlights ? COLORS.gold : undefined} />
            <StaticPiece symbol={PIECES.r} square="a8" squareSize={squareSize} glow={showHighlights ? COLORS.gold : undefined} />
            <StaticPiece symbol={PIECES.q} square="d8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.b} square="f8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="d7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="e6" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="f7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="g7" squareSize={squareSize} />

            {/* White pieces */}
            <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="e5" squareSize={squareSize} />

            {/* Knight jumps to c7 — the fork! */}
            {frame < knightMoveStart ? (
              <StaticPiece symbol={PIECES.N} square="b5" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.N}
                fromSquare="b5"
                toSquare="c7"
                squareSize={squareSize}
                startFrame={knightMoveStart}
                duration={18}
                glow={knightMoved ? COLORS.gold : undefined}
              />
            )}

            {/* Attack arrows */}
            {knightMoved && (
              <>
                <AttackArrow fromSquare="c7" toSquare="e8" squareSize={squareSize} opacity={arrowOpacity} />
                <AttackArrow fromSquare="c7" toSquare="a8" squareSize={squareSize} opacity={arrowOpacity} />
              </>
            )}
          </ChessBoard>
        </div>

        {/* Text panel */}
        <div style={{ opacity: textOpacity, maxWidth: 420 }}>
          <div style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#ffffff',
            fontFamily: 'Inter, system-ui, sans-serif',
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            One move.
          </div>
          <div style={{
            fontSize: 52,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${COLORS.gold} 0%, #FFA500 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'Inter, system-ui, sans-serif',
            lineHeight: 1.2,
          }}>
            Two threats.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Define the Tactic ─────────────────────────────────────
// Same position, both attacked pieces glow. Text: "Fork."

const DefineForkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const highlightSquares = ['e8', 'a8'];

  const titleScale = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 80 } });
  const descOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightSquares={highlightSquares}>
            <StaticPiece symbol={PIECES.k} square="e8" squareSize={squareSize} glow={COLORS.gold} />
            <StaticPiece symbol={PIECES.r} square="a8" squareSize={squareSize} glow={COLORS.gold} />
            <StaticPiece symbol={PIECES.q} square="d8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.b} square="f8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="d7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="e6" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="f7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="g7" squareSize={squareSize} />

            <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="e5" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="c7" squareSize={squareSize} glow={COLORS.gold} />

            <AttackArrow fromSquare="c7" toSquare="e8" squareSize={squareSize} opacity={0.8} />
            <AttackArrow fromSquare="c7" toSquare="a8" squareSize={squareSize} opacity={0.8} />
          </ChessBoard>
        </div>

        <div style={{ maxWidth: 420 }}>
          <div style={{
            fontSize: 72,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${COLORS.gold} 0%, #FFA500 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'Inter, system-ui, sans-serif',
            transform: `scale(${titleScale})`,
            marginBottom: 24,
          }}>
            Fork.
          </div>
          <div style={{
            fontSize: 24,
            color: '#d4d4d4',
            lineHeight: 1.6,
            fontFamily: 'Inter, system-ui, sans-serif',
            opacity: descOpacity,
          }}>
            Attack two or more pieces at once with a single piece.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Knights Are the Best ──────────────────────────────────
// Knight forks King on e8 and Queen on d8 (royal fork from f7)

const KnightsBestScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  // Phase 1: Knight jumps to f7 (0-60 frames)
  const knightMoveStart = 20;
  const knightMoved = frame >= knightMoveStart + 18;
  const showHighlights = frame > knightMoveStart + 25;
  const arrowOpacity = showHighlights ? interpolate(frame, [knightMoveStart + 25, knightMoveStart + 35], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  // Phase 2: "Big material gain" text (after 100 frames)
  const phase2 = frame > 100;
  const phase2Opacity = phase2 ? interpolate(frame, [100, 115], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  const highlightSquares = showHighlights ? ['e8', 'd8'] : [];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightSquares={highlightSquares}>
            {/* Black pieces — royal fork setup */}
            <StaticPiece symbol={PIECES.k} square="e8" squareSize={squareSize} glow={showHighlights ? COLORS.gold : undefined} />
            <StaticPiece symbol={PIECES.q} square="d8" squareSize={squareSize} glow={showHighlights ? COLORS.gold : undefined} />
            <StaticPiece symbol={PIECES.r} square="a8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.r} square="h8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="d7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="e6" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="g7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="h7" squareSize={squareSize} />

            {/* White pieces */}
            <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.R} square="e1" squareSize={squareSize} />

            {/* Knight jumps to f7 — royal fork! */}
            {frame < knightMoveStart ? (
              <StaticPiece symbol={PIECES.N} square="g5" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.N}
                fromSquare="g5"
                toSquare="f7"
                squareSize={squareSize}
                startFrame={knightMoveStart}
                duration={18}
                glow={knightMoved ? COLORS.gold : undefined}
              />
            )}

            {knightMoved && (
              <>
                <AttackArrow fromSquare="f7" toSquare="e8" squareSize={squareSize} opacity={arrowOpacity} color={COLORS.gold} />
                <AttackArrow fromSquare="f7" toSquare="d8" squareSize={squareSize} opacity={arrowOpacity} color={COLORS.gold} />
              </>
            )}
          </ChessBoard>
        </div>

        <div style={{ maxWidth: 420 }}>
          <InfoBox
            title="Royal Fork"
            titleColor={COLORS.gold}
            lines={[
              'Knights are the best forking pieces.',
              'Their L-shaped move is hard to see coming.',
            ]}
            delay={knightMoveStart + 30}
          />
          {phase2 && (
            <div style={{
              marginTop: 24,
              padding: '16px 24px',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.gold}15, ${COLORS.purple}10)`,
              border: `1px solid ${COLORS.gold}30`,
              opacity: phase2Opacity,
            }}>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.gold,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                King + Queen fork = big material gain
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 5: Other Pieces Can Fork Too ─────────────────────────────
// Quick montage: Pawn fork, Bishop fork, Queen fork

const OtherForksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  // Three sub-scenes: 0-80 (pawn), 80-160 (bishop), 160-240 (queen)
  const subScene = frame < 80 ? 'pawn' : frame < 160 ? 'bishop' : 'queen';

  // Pawn fork: Pawn on d4 attacks c5 (knight) and e5 (bishop)
  const pawnMoveStart = 15;
  const pawnMoved = frame >= pawnMoveStart + 15;

  // Bishop fork: Bishop on c4 moves to e6 forking rook on d7 and knight on f7
  const bishopFrame = frame - 80;
  const bishopMoveStart = 15;
  const bishopMoved = bishopFrame >= bishopMoveStart + 15;

  // Queen fork: Queen on d1 moves to a4 forking king on e8 and rook on a7
  const queenFrame = frame - 160;
  const queenMoveStart = 15;
  const queenMoved = queenFrame >= queenMoveStart + 15;

  // Label for current sub-scene
  const labelOpacity = interpolate(
    subScene === 'pawn' ? frame : subScene === 'bishop' ? bishopFrame : queenFrame,
    [0, 10],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const labels: Record<string, string> = {
    pawn: 'Pawn Fork',
    bishop: 'Bishop Fork',
    queen: 'Queen Fork',
  };

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          {/* ─── Pawn Fork ─── */}
          {subScene === 'pawn' && (
            <ChessBoard highlightSquares={pawnMoved ? ['c5', 'e5'] : []}>
              <StaticPiece symbol={PIECES.n} square="c5" squareSize={squareSize} glow={pawnMoved ? COLORS.gold : undefined} />
              <StaticPiece symbol={PIECES.b} square="e5" squareSize={squareSize} glow={pawnMoved ? COLORS.gold : undefined} />
              <StaticPiece symbol={PIECES.k} square="e8" squareSize={squareSize} />
              <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />

              {frame < pawnMoveStart ? (
                <StaticPiece symbol={PIECES.P} square="d3" squareSize={squareSize} />
              ) : (
                <AnimatedPiece
                  symbol={PIECES.P}
                  fromSquare="d3"
                  toSquare="d4"
                  squareSize={squareSize}
                  startFrame={pawnMoveStart}
                  duration={12}
                  glow={pawnMoved ? COLORS.gold : undefined}
                />
              )}
              {pawnMoved && (
                <>
                  <AttackArrow fromSquare="d4" toSquare="c5" squareSize={squareSize} opacity={0.8} />
                  <AttackArrow fromSquare="d4" toSquare="e5" squareSize={squareSize} opacity={0.8} />
                </>
              )}
            </ChessBoard>
          )}

          {/* ─── Bishop Fork ─── */}
          {subScene === 'bishop' && (
            <ChessBoard highlightSquares={bishopMoved ? ['d7', 'g8'] : []}>
              <StaticPiece symbol={PIECES.r} square="d7" squareSize={squareSize} glow={bishopMoved ? COLORS.gold : undefined} />
              <StaticPiece symbol={PIECES.k} square="g8" squareSize={squareSize} glow={bishopMoved ? COLORS.gold : undefined} />
              <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />

              {bishopFrame < bishopMoveStart ? (
                <StaticPiece symbol={PIECES.B} square="c4" squareSize={squareSize} />
              ) : (
                <AnimatedPiece
                  symbol={PIECES.B}
                  fromSquare="c4"
                  toSquare="e6"
                  squareSize={squareSize}
                  startFrame={80 + bishopMoveStart}
                  duration={15}
                  glow={bishopMoved ? COLORS.gold : undefined}
                />
              )}
              {bishopMoved && (
                <>
                  <AttackArrow fromSquare="e6" toSquare="d7" squareSize={squareSize} opacity={0.8} />
                  <AttackArrow fromSquare="e6" toSquare="g8" squareSize={squareSize} opacity={0.8} />
                </>
              )}
            </ChessBoard>
          )}

          {/* ─── Queen Fork ─── */}
          {subScene === 'queen' && (
            <ChessBoard highlightSquares={queenMoved ? ['e8', 'a7'] : []}>
              <StaticPiece symbol={PIECES.k} square="e8" squareSize={squareSize} glow={queenMoved ? COLORS.gold : undefined} />
              <StaticPiece symbol={PIECES.r} square="a7" squareSize={squareSize} glow={queenMoved ? COLORS.gold : undefined} />
              <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />

              {queenFrame < queenMoveStart ? (
                <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
              ) : (
                <AnimatedPiece
                  symbol={PIECES.Q}
                  fromSquare="d1"
                  toSquare="a4"
                  squareSize={squareSize}
                  startFrame={160 + queenMoveStart}
                  duration={15}
                  glow={queenMoved ? COLORS.gold : undefined}
                />
              )}
              {queenMoved && (
                <>
                  <AttackArrow fromSquare="a4" toSquare="e8" squareSize={squareSize} opacity={0.8} />
                  <AttackArrow fromSquare="a4" toSquare="a7" squareSize={squareSize} opacity={0.8} />
                </>
              )}
            </ChessBoard>
          )}
        </div>

        {/* Side panel */}
        <div style={{ maxWidth: 420 }}>
          <div style={{
            fontSize: 44,
            fontWeight: 800,
            color: COLORS.gold,
            fontFamily: 'Inter, system-ui, sans-serif',
            textShadow: `0 0 30px ${COLORS.gold}40`,
            opacity: labelOpacity,
            marginBottom: 20,
          }}>
            {labels[subScene]}
          </div>
          <div style={{
            fontSize: 22,
            color: '#d4d4d4',
            lineHeight: 1.6,
            fontFamily: 'Inter, system-ui, sans-serif',
            opacity: labelOpacity,
          }}>
            {subScene === 'pawn' && 'Pawns attack diagonally — perfect for forks.'}
            {subScene === 'bishop' && 'Bishops can fork along long diagonals.'}
            {subScene === 'queen' && 'The queen combines all fork patterns.'}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 6: How to Spot Forks ─────────────────────────────────────
// Board pauses, candidate knight squares pulse

const SpotForksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  // Knight on e4, show all possible landing squares pulsing
  // Knight on e4 can jump to: d6, f6, g5, g3, f2, d2, c3, c5
  const showCandidates = frame > 30;
  const candidateSquares = showCandidates ? ['d6', 'f6', 'g5', 'g3', 'f2', 'd2', 'c3', 'c5'] : [];

  // At frame 90, highlight d6 as the fork square (enemy queen on c8, enemy rook on e8)
  const showFork = frame > 120;
  const forkArrowOpacity = showFork ? interpolate(frame, [120, 135], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const highlightSquares = showFork ? ['c8', 'e8'] : [];

  // Phase text
  const phase1Opacity = showCandidates && !showFork ? interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const phase2Opacity = showFork ? interpolate(frame, [120, 135], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard candidateSquares={showFork ? ['d6'] : candidateSquares} highlightSquares={highlightSquares}>
            {/* Position: scattered pieces, knight on e4 */}
            <StaticPiece symbol={PIECES.k} square="g8" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.q} square="c8" squareSize={squareSize} glow={showFork ? COLORS.gold : undefined} />
            <StaticPiece symbol={PIECES.r} square="e8" squareSize={squareSize} glow={showFork ? COLORS.gold : undefined} />
            <StaticPiece symbol={PIECES.p} square="d7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="f7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="g6" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="h7" squareSize={squareSize} />

            <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="e4" squareSize={squareSize} glow={showCandidates ? COLORS.purple : undefined} />
            <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="f2" squareSize={squareSize} />

            {/* Show fork arrows when d6 is identified */}
            {showFork && (
              <>
                <AttackArrow fromSquare="e4" toSquare="d6" squareSize={squareSize} opacity={forkArrowOpacity} color={COLORS.green} />
              </>
            )}
          </ChessBoard>
        </div>

        <div style={{ maxWidth: 420 }}>
          {/* Phase 1: Scan candidates */}
          {!showFork && (
            <div style={{ opacity: phase1Opacity }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.purple,
                fontFamily: 'Inter, system-ui, sans-serif',
                textShadow: `0 0 20px ${COLORS.purple}40`,
                marginBottom: 16,
              }}>
                After every move...
              </div>
              <div style={{
                fontSize: 22,
                color: '#d4d4d4',
                lineHeight: 1.6,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                Look at every square your knight can jump to. Check for forks.
              </div>
            </div>
          )}

          {/* Phase 2: Found the fork! */}
          {showFork && (
            <div style={{ opacity: phase2Opacity }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.green,
                fontFamily: 'Inter, system-ui, sans-serif',
                textShadow: `0 0 20px ${COLORS.green}40`,
                marginBottom: 16,
              }}>
                Nd6! Fork found!
              </div>
              <div style={{
                fontSize: 22,
                color: '#d4d4d4',
                lineHeight: 1.6,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                Knight to d6 attacks both the queen on c8 and rook on e8. Win material.
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 7: Beginner Training Tip ─────────────────────────────────
// Player finds fork, enemy piece disappears

const TrainingTipScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;

  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  // Knight moves to fork at frame 30
  const knightMoveStart = 30;
  const knightMoved = frame >= knightMoveStart + 18;

  // King moves away at frame 80 (forced)
  const kingMovesStart = 80;
  const kingMoved = frame >= kingMovesStart + 15;

  // Knight captures queen at frame 110
  const captureStart = 110;
  const captured = frame >= captureStart + 15;

  // Text phases
  const forkFoundOpacity = knightMoved ? interpolate(frame, [knightMoveStart + 20, knightMoveStart + 35], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const capturedOpacity = captured ? interpolate(frame, [captureStart + 15, captureStart + 30], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightSquares={knightMoved && !captured ? ['e8', 'c7'] : []}>
            {/* Black King — moves away when forked */}
            {!kingMoved ? (
              <StaticPiece symbol={PIECES.k} square="e8" squareSize={squareSize} glow={knightMoved ? COLORS.gold : undefined} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.k}
                fromSquare="e8"
                toSquare="f8"
                squareSize={squareSize}
                startFrame={kingMovesStart}
                duration={15}
              />
            )}

            {/* Black Queen — gets captured */}
            {!captured && (
              <StaticPiece symbol={PIECES.q} square="c7" squareSize={squareSize} glow={knightMoved ? COLORS.gold : undefined} />
            )}
            <StaticPiece symbol={PIECES.p} square="d7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="f7" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="g7" squareSize={squareSize} />

            {/* White pieces */}
            <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />

            {/* Knight: starts on e4, jumps to d6 (fork), then captures on c7 */}
            {frame < knightMoveStart ? (
              <StaticPiece symbol={PIECES.N} square="e4" squareSize={squareSize} />
            ) : frame < captureStart ? (
              <AnimatedPiece
                symbol={PIECES.N}
                fromSquare="e4"
                toSquare="d6"
                squareSize={squareSize}
                startFrame={knightMoveStart}
                duration={18}
                glow={knightMoved ? COLORS.gold : undefined}
              />
            ) : (
              <AnimatedPiece
                symbol={PIECES.N}
                fromSquare="d6"
                toSquare="c7"
                squareSize={squareSize}
                startFrame={captureStart}
                duration={15}
                glow={COLORS.green}
              />
            )}

            {/* Fork arrows */}
            {knightMoved && !kingMoved && (
              <>
                <AttackArrow fromSquare="d6" toSquare="e8" squareSize={squareSize} opacity={0.8} />
                <AttackArrow fromSquare="d6" toSquare="c7" squareSize={squareSize} opacity={0.8} />
              </>
            )}
          </ChessBoard>
        </div>

        <div style={{ maxWidth: 420 }}>
          {!captured ? (
            <div style={{ opacity: forkFoundOpacity }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.gold,
                fontFamily: 'Inter, system-ui, sans-serif',
                marginBottom: 12,
              }}>
                Nd6+ Fork!
              </div>
              <div style={{
                fontSize: 22,
                color: '#d4d4d4',
                lineHeight: 1.6,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                King must move. Queen is lost.
              </div>
            </div>
          ) : (
            <div style={{ opacity: capturedOpacity }}>
              <div style={{
                fontSize: 42,
                fontWeight: 800,
                background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.cyan} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: 'Inter, system-ui, sans-serif',
                marginBottom: 16,
              }}>
                Tactics win games.
              </div>
              <div style={{
                fontSize: 22,
                color: '#a1a1aa',
                lineHeight: 1.6,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                Always look for forks after every move.
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene 8: End Card / Closing ────────────────────────────────────

const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const knightScale = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 80 } });
  const knightGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 1.0]);
  const logoScale = spring({ frame: frame - 20, fps, config: { damping: 12, stiffness: 80 } });
  const taglineOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 80 } });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        {/* Glowing knight */}
        <div style={{
          fontSize: 100,
          color: '#ffffff',
          transform: `scale(${knightScale})`,
          filter: `drop-shadow(0 0 ${30 + knightGlow * 30}px ${COLORS.gold})`,
          marginBottom: 16,
        }}>
          {PIECES.N}
        </div>

        {/* SolMate logo */}
        <div style={{ transform: `scale(${logoScale})` }}>
          <Img
            src={staticFile('images/solmate-logo.png')}
            style={{
              height: 100,
              filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
            }}
          />
        </div>

        {/* Title */}
        <div style={{
          fontSize: 40,
          fontWeight: 800,
          background: `linear-gradient(135deg, ${COLORS.gold} 0%, #FFA500 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          opacity: taglineOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          Forks — Beginner
        </div>

        <div style={{
          fontSize: 24,
          color: '#a1a1aa',
          opacity: subtitleOpacity,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          Always look for forks.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Scene Timings ──────────────────────────────────────────────────
// 30fps, ~48 seconds total = 1440 frames

const SCENES = {
  title:       { start: 0,    duration: 90 },    // 0–3s
  surprise:    { start: 90,   duration: 120 },   // 3–7s
  define:      { start: 210,  duration: 120 },   // 7–11s
  knightsBest: { start: 330,  duration: 240 },   // 11–19s
  otherForks:  { start: 570,  duration: 240 },   // 19–27s
  spotForks:   { start: 810,  duration: 210 },   // 27–34s
  trainingTip: { start: 1020, duration: 180 },   // 34–40s
  closing:     { start: 1200, duration: 150 },   // 40–45s
};

// Total: 1350 frames = 45 seconds

// ─── Main Composition ───────────────────────────────────────────────

export const Forks: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Sequence from={SCENES.title.start} durationInFrames={SCENES.title.duration}>
        <TitleScene />
      </Sequence>

      <Sequence from={SCENES.surprise.start} durationInFrames={SCENES.surprise.duration}>
        <SurpriseMoveScene />
      </Sequence>

      <Sequence from={SCENES.define.start} durationInFrames={SCENES.define.duration}>
        <DefineForkScene />
      </Sequence>

      <Sequence from={SCENES.knightsBest.start} durationInFrames={SCENES.knightsBest.duration}>
        <KnightsBestScene />
      </Sequence>

      <Sequence from={SCENES.otherForks.start} durationInFrames={SCENES.otherForks.duration}>
        <OtherForksScene />
      </Sequence>

      <Sequence from={SCENES.spotForks.start} durationInFrames={SCENES.spotForks.duration}>
        <SpotForksScene />
      </Sequence>

      <Sequence from={SCENES.trainingTip.start} durationInFrames={SCENES.trainingTip.duration}>
        <TrainingTipScene />
      </Sequence>

      <Sequence from={SCENES.closing.start} durationInFrames={SCENES.closing.duration}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
