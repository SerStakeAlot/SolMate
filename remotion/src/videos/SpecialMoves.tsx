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
  red: '#ff4444',
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

// Animated Chess Piece
const AnimatedPiece: React.FC<{
  symbol: string;
  fromSquare: string;
  toSquare: string;
  squareSize: number;
  startFrame: number;
  duration: number;
  fadeOut?: boolean;
  fadeOutStart?: number;
}> = ({ symbol, fromSquare, toSquare, squareSize, startFrame, duration, fadeOut, fadeOutStart }) => {
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
  
  let opacity = 1;
  if (fadeOut && fadeOutStart !== undefined) {
    opacity = interpolate(frame, [fadeOutStart, fadeOutStart + 15], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }
  
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
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10,
        opacity,
      }}
    >
      {symbol}
    </div>
  );
};

// Static Piece
const StaticPiece: React.FC<{
  symbol: string;
  square: string;
  squareSize: number;
  opacity?: number;
}> = ({ symbol, square, squareSize, opacity = 1 }) => {
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
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10,
        opacity,
      }}
    >
      {symbol}
    </div>
  );
};

// ChessBoard Component
const ChessBoard: React.FC<{
  highlightedSquares?: string[];
  glowSquares?: string[];
  children?: React.ReactNode;
}> = ({ highlightedSquares = [], glowSquares = [], children }) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  
  const highlightOpacity = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.6]);
  
  return (
    <div
      style={{
        width: boardSize,
        height: boardSize,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `0 0 60px ${COLORS.purple}40, 0 20px 40px rgba(0,0,0,0.5)`,
        position: 'relative',
      }}
    >
      {/* Board squares */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
        {RANKS.map((rank, rankIdx) =>
          FILES.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const isLight = (fileIdx + rankIdx) % 2 === 0;
            const isHighlighted = highlightedSquares.includes(square);
            const isGlow = glowSquares.includes(square);
            
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
                      backgroundColor: COLORS.purple,
                      opacity: highlightOpacity,
                    }}
                  />
                )}
                {isGlow && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.cyan,
                      opacity: 0.4,
                      boxShadow: `inset 0 0 20px ${COLORS.cyan}`,
                    }}
                  />
                )}
                {/* Coordinates */}
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
  warnings?: string[];
  delay?: number;
}> = ({ title, lines, warnings = [], delay = 0 }) => {
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
        maxWidth: 400,
      }}
    >
      <div style={{ 
        fontSize: 42, 
        fontWeight: 700, 
        color: '#ffffff', 
        marginBottom: 16, 
        fontFamily: 'Inter, system-ui, sans-serif',
        background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.cyan} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {title}
      </div>
      {lines.map((line, idx) => (
        <div key={idx} style={{ 
          fontSize: 20, 
          color: '#d4d4d4', 
          lineHeight: 1.5, 
          fontFamily: 'Inter, system-ui, sans-serif',
          marginBottom: 8,
        }}>
          {line}
        </div>
      ))}
      {warnings.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {warnings.map((warning, idx) => (
            <div key={idx} style={{ 
              fontSize: 16, 
              color: COLORS.red, 
              lineHeight: 1.5, 
              fontFamily: 'Inter, system-ui, sans-serif',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>❌</span> {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Title Scene
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const iconScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 80 } });
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{ 
          fontSize: 100, 
          transform: `scale(${iconScale})`, 
          filter: `drop-shadow(0 0 30px ${COLORS.purple})`,
          display: 'flex',
          gap: 20,
        }}>
          <span style={{ color: '#ffffff' }}>{PIECES.K}</span>
          <span style={{ color: '#ffffff' }}>{PIECES.R}</span>
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.cyan} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: titleOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          Special Moves in Chess
        </div>
        <div style={{ fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Beginner Guide
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Castling Scene
const CastlingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Animation timing
  const kingMoveStart = 30;
  const rookMoveStart = 50;
  
  // Determine piece positions based on frame
  const kingMoved = frame >= kingMoveStart + 20;
  const rookMoved = frame >= rookMoveStart + 20;
  
  // Highlight squares that show the castling path
  const highlights = frame > 20 ? ['e1', 'f1', 'g1', 'h1'] : [];
  const glowSquares = kingMoved && rookMoved ? ['g1', 'f1'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} glowSquares={glowSquares}>
            {/* King animation */}
            {frame < kingMoveStart ? (
              <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.K}
                fromSquare="e1"
                toSquare="g1"
                squareSize={squareSize}
                startFrame={kingMoveStart}
                duration={20}
              />
            )}
            
            {/* Rook animation */}
            {frame < rookMoveStart ? (
              <StaticPiece symbol={PIECES.R} square="h1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.R}
                fromSquare="h1"
                toSquare="f1"
                squareSize={squareSize}
                startFrame={rookMoveStart}
                duration={20}
              />
            )}
          </ChessBoard>
        </div>
        <InfoBox 
          title="Castling" 
          lines={[
            "King moves two squares toward rook",
            "Rook jumps over the king",
          ]}
          warnings={[
            "Not allowed if king or rook has moved",
            "Not allowed through check",
          ]}
          delay={20} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// En Passant Scene
const EnPassantScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Animation timing
  const blackPawnMoveStart = 25;
  const whitePawnCaptureStart = 55;
  const fadeOutStart = 75;
  
  // Positions
  const blackPawnMoved = frame >= blackPawnMoveStart + 15;
  const captureStarted = frame >= whitePawnCaptureStart;
  
  // Highlights
  const highlights = frame > 20 && frame < whitePawnCaptureStart ? ['d7', 'd5'] : [];
  const captureHighlights = frame >= whitePawnCaptureStart ? ['d6'] : [];
  const glowSquares = frame >= fadeOutStart + 15 ? ['d6'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={[...highlights, ...captureHighlights]} glowSquares={glowSquares}>
            {/* White pawn on e5 */}
            {!captureStarted ? (
              <StaticPiece symbol={PIECES.P} square="e5" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.P}
                fromSquare="e5"
                toSquare="d6"
                squareSize={squareSize}
                startFrame={whitePawnCaptureStart}
                duration={20}
              />
            )}
            
            {/* Black pawn moving d7-d5, then getting captured */}
            {frame < blackPawnMoveStart ? (
              <StaticPiece symbol={PIECES.p} square="d7" squareSize={squareSize} />
            ) : !captureStarted ? (
              <AnimatedPiece
                symbol={PIECES.p}
                fromSquare="d7"
                toSquare="d5"
                squareSize={squareSize}
                startFrame={blackPawnMoveStart}
                duration={15}
              />
            ) : (
              <AnimatedPiece
                symbol={PIECES.p}
                fromSquare="d5"
                toSquare="d5"
                squareSize={squareSize}
                startFrame={whitePawnCaptureStart}
                duration={1}
                fadeOut={true}
                fadeOutStart={fadeOutStart}
              />
            )}
          </ChessBoard>
        </div>
        <InfoBox 
          title="En Passant" 
          lines={[
            "Capture a pawn that just moved two squares",
            "Must be done immediately",
          ]}
          delay={20} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Pawn Promotion Scene
const PromotionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Animation timing
  const pawnMoveStart = 25;
  const promotionStart = 55;
  const selectionStart = 70;
  const queenSelectedStart = 100;
  
  const pawnReached = frame >= pawnMoveStart + 20;
  const showSelection = frame >= selectionStart && frame < queenSelectedStart;
  const queenSelected = frame >= queenSelectedStart;
  
  // Highlights
  const highlights = frame > 20 ? ['e7', 'e8'] : [];
  const glowSquares = pawnReached ? ['e8'] : [];
  
  // Selection box animation
  const selectionOpacity = showSelection ? interpolate(frame, [selectionStart, selectionStart + 10], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const queenOpacity = queenSelected ? interpolate(frame, [queenSelectedStart, queenSelectedStart + 15], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard highlightedSquares={highlights} glowSquares={glowSquares}>
            {/* Pawn moving to 8th rank */}
            {!queenSelected && (
              frame < pawnMoveStart ? (
                <StaticPiece symbol={PIECES.P} square="e7" squareSize={squareSize} />
              ) : (
                <AnimatedPiece
                  symbol={PIECES.P}
                  fromSquare="e7"
                  toSquare="e8"
                  squareSize={squareSize}
                  startFrame={pawnMoveStart}
                  duration={20}
                />
              )
            )}
            
            {/* Queen after promotion */}
            {queenSelected && (
              <StaticPiece symbol={PIECES.Q} square="e8" squareSize={squareSize} opacity={queenOpacity} />
            )}
          </ChessBoard>
          
          {/* Promotion selection UI */}
          {showSelection && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0,0,0,0.9)',
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              gap: 16,
              opacity: selectionOpacity,
              border: `2px solid ${COLORS.purple}`,
              boxShadow: `0 0 30px ${COLORS.purple}60`,
            }}>
              {[PIECES.Q, PIECES.R, PIECES.B, PIECES.N].map((piece, idx) => (
                <div key={idx} style={{
                  width: 60,
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 44,
                  color: '#ffffff',
                  backgroundColor: idx === 0 ? COLORS.purple : 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}>
                  {piece}
                </div>
              ))}
            </div>
          )}
        </div>
        <InfoBox 
          title="Pawn Promotion" 
          lines={[
            "Pawn reaching the 8th rank becomes any piece",
            "(Usually a Queen)",
          ]}
          delay={20} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Closing Scene
const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 12, stiffness: 80 } });
  const taglineOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 80 } });
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{ transform: `scale(${logoScale})` }}>
          <Img
            src={staticFile('images/solmate-logo.png')}
            style={{
              height: 120,
              filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
            }}
          />
        </div>
        <div style={{ 
          fontSize: 36, 
          color: '#ffffff', 
          opacity: taglineOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          Master the Rules.
        </div>
        <div style={{ 
          fontSize: 28, 
          color: '#a1a1aa', 
          opacity: subtitleOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          Play with Confidence.
        </div>
        <div style={{ fontSize: 48, color: '#71717a', opacity: subtitleOpacity }}>♟️</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene timings (30fps, ~32 seconds total)
const SCENES = {
  title: { start: 0, duration: 90 },        // 0-3s
  castling: { start: 90, duration: 180 },   // 3-9s
  enPassant: { start: 270, duration: 150 }, // 9-14s
  promotion: { start: 420, duration: 150 }, // 14-19s
  closing: { start: 570, duration: 90 },    // 19-22s
};

// Total: 660 frames = 22 seconds

// Main composition
export const SpecialMoves: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Sequence from={SCENES.title.start} durationInFrames={SCENES.title.duration}>
        <TitleScene />
      </Sequence>
      
      <Sequence from={SCENES.castling.start} durationInFrames={SCENES.castling.duration}>
        <CastlingScene />
      </Sequence>
      
      <Sequence from={SCENES.enPassant.start} durationInFrames={SCENES.enPassant.duration}>
        <EnPassantScene />
      </Sequence>
      
      <Sequence from={SCENES.promotion.start} durationInFrames={SCENES.promotion.duration}>
        <PromotionScene />
      </Sequence>
      
      <Sequence from={SCENES.closing.start} durationInFrames={SCENES.closing.duration}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
