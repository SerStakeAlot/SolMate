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
  redGlow: '#ff000080',
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
}> = ({ symbol, fromSquare, toSquare, squareSize, startFrame, duration }) => {
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
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10,
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
}> = ({ fromSquare, toSquare, squareSize, opacity }) => {
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
        backgroundColor: COLORS.red,
        transform: `rotate(${angle}rad)`,
        transformOrigin: '0 50%',
        opacity,
        boxShadow: `0 0 10px ${COLORS.red}`,
        zIndex: 5,
      }}
    >
      {/* Arrow head */}
      <div
        style={{
          position: 'absolute',
          right: -8,
          top: -6,
          width: 0,
          height: 0,
          borderLeft: '12px solid ' + COLORS.red,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
        }}
      />
    </div>
  );
};

// ChessBoard Component
const ChessBoard: React.FC<{
  dangerSquares?: string[];
  blockedSquares?: string[];
  neutralSquares?: string[];
  dimBoard?: boolean;
  children?: React.ReactNode;
}> = ({ dangerSquares = [], blockedSquares = [], neutralSquares = [], dimBoard = false, children }) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  
  const pulseOpacity = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 0.7]);
  
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
      {/* Board squares */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
        {RANKS.map((rank, rankIdx) =>
          FILES.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const isLight = (fileIdx + rankIdx) % 2 === 0;
            const isDanger = dangerSquares.includes(square);
            const isBlocked = blockedSquares.includes(square);
            const isNeutral = neutralSquares.includes(square);
            
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
                {isDanger && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.red,
                      opacity: pulseOpacity,
                      boxShadow: `inset 0 0 15px ${COLORS.red}`,
                    }}
                  />
                )}
                {isBlocked && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.red,
                      opacity: 0.4,
                    }}
                  />
                )}
                {isNeutral && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.gray,
                      opacity: 0.5,
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
  titleColor?: string;
  delay?: number;
}> = ({ title, lines, titleColor = COLORS.purple, delay = 0 }) => {
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

// Title Scene
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const kingScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 80 } });
  const kingGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.8]);
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 80 } });
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{ 
          fontSize: 120, 
          transform: `scale(${kingScale})`, 
          color: '#ffffff',
          filter: `drop-shadow(0 0 ${30 + kingGlow * 20}px ${COLORS.red})`,
          opacity: 0.9,
        }}>
          {PIECES.K}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            background: `linear-gradient(135deg, #ffffff 0%, ${COLORS.red} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: titleOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          Check, Checkmate & Stalemate
        </div>
        <div style={{ 
          fontSize: 32, 
          color: '#a1a1aa', 
          opacity: subtitleOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif' 
        }}>
          How Chess Games End
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Check Scene
const CheckScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Queen moves to attack king
  const queenMoveStart = 30;
  const queenMoved = frame >= queenMoveStart + 20;
  
  // Show danger after queen moves
  const showDanger = frame > queenMoveStart + 25;
  const arrowOpacity = showDanger ? interpolate(frame, [queenMoveStart + 25, queenMoveStart + 35], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  
  const dangerSquares = showDanger ? ['e8'] : [];
  const kingGlow = showDanger ? COLORS.red : undefined;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard dangerSquares={dangerSquares}>
            {/* White King */}
            <StaticPiece symbol={PIECES.K} square="e8" squareSize={squareSize} glow={kingGlow} />
            
            {/* Black Queen attacking */}
            {frame < queenMoveStart ? (
              <StaticPiece symbol={PIECES.q} square="e1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.q}
                fromSquare="e1"
                toSquare="e4"
                squareSize={squareSize}
                startFrame={queenMoveStart}
                duration={20}
              />
            )}
            
            {/* Attack arrow */}
            {queenMoved && (
              <AttackArrow
                fromSquare="e4"
                toSquare="e8"
                squareSize={squareSize}
                opacity={arrowOpacity}
              />
            )}
          </ChessBoard>
        </div>
        <InfoBox 
          title="Check" 
          titleColor={COLORS.red}
          lines={[
            "Your king is under attack",
            "You must respond immediately",
          ]}
          delay={queenMoveStart + 30} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Checkmate Scene
const CheckmateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Show all blocked squares progressively
  const showBlocked = frame > 30;
  const dimBoard = frame > 90;
  
  // Blocked escape squares for king on h8
  const blockedSquares = showBlocked ? ['g8', 'g7', 'h7'] : [];
  const dangerSquares = showBlocked ? ['h8'] : [];
  
  // Game over text
  const gameOverOpacity = frame > 100 ? interpolate(frame, [100, 120], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  
  const kingGlow = showBlocked ? COLORS.red : undefined;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard dangerSquares={dangerSquares} blockedSquares={blockedSquares} dimBoard={dimBoard}>
            {/* White King trapped in corner */}
            <StaticPiece symbol={PIECES.K} square="h8" squareSize={squareSize} glow={kingGlow} />
            
            {/* Black Queen delivering checkmate */}
            <StaticPiece symbol={PIECES.q} square="g6" squareSize={squareSize} />
            
            {/* Black King cutting off escape */}
            <StaticPiece symbol={PIECES.k} square="f7" squareSize={squareSize} />
          </ChessBoard>
          
          {/* Game Over overlay */}
          {gameOverOpacity > 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 12,
              opacity: gameOverOpacity,
            }}>
              <div style={{
                fontSize: 48,
                fontWeight: 800,
                color: COLORS.red,
                fontFamily: 'Inter, system-ui, sans-serif',
                textShadow: `0 0 30px ${COLORS.red}`,
              }}>
                Game Over
              </div>
            </div>
          )}
        </div>
        <InfoBox 
          title="Checkmate" 
          titleColor={COLORS.red}
          lines={[
            "The king is in check with no escape",
            "Game Over",
          ]}
          delay={40} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Stalemate Scene
const StalemateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Show neutral blocked squares
  const showBlocked = frame > 30;
  
  // King on a8, all moves blocked but NOT in check
  const neutralSquares = showBlocked ? ['a7', 'b8', 'b7'] : [];
  
  // Draw text
  const drawOpacity = frame > 80 ? interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard neutralSquares={neutralSquares}>
            {/* White King trapped but NOT in check */}
            <StaticPiece symbol={PIECES.K} square="a8" squareSize={squareSize} />
            
            {/* Black Queen blocking but not giving check */}
            <StaticPiece symbol={PIECES.q} square="b6" squareSize={squareSize} />
            
            {/* Black King */}
            <StaticPiece symbol={PIECES.k} square="c7" squareSize={squareSize} />
          </ChessBoard>
          
          {/* Draw overlay */}
          {drawOpacity > 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 12,
              opacity: drawOpacity,
            }}>
              <div style={{
                fontSize: 48,
                fontWeight: 800,
                color: COLORS.gray,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                Draw
              </div>
            </div>
          )}
        </div>
        <InfoBox 
          title="Stalemate" 
          titleColor={COLORS.gray}
          lines={[
            "No legal moves, but not in check",
            "Result: Draw",
          ]}
          delay={40} 
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
          Always Look for Checkmate
        </div>
        <div style={{ fontSize: 48, color: '#71717a', opacity: subtitleOpacity }}>♟️</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene timings (30fps, ~27 seconds total)
const SCENES = {
  title: { start: 0, duration: 90 },         // 0-3s
  check: { start: 90, duration: 150 },       // 3-8s
  checkmate: { start: 240, duration: 180 },  // 8-14s
  stalemate: { start: 420, duration: 150 },  // 14-19s
  closing: { start: 570, duration: 90 },     // 19-22s
};

// Total: 660 frames = 22 seconds

// Main composition
export const CheckmateBasics: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Sequence from={SCENES.title.start} durationInFrames={SCENES.title.duration}>
        <TitleScene />
      </Sequence>
      
      <Sequence from={SCENES.check.start} durationInFrames={SCENES.check.duration}>
        <CheckScene />
      </Sequence>
      
      <Sequence from={SCENES.checkmate.start} durationInFrames={SCENES.checkmate.duration}>
        <CheckmateScene />
      </Sequence>
      
      <Sequence from={SCENES.stalemate.start} durationInFrames={SCENES.stalemate.duration}>
        <StalemateScene />
      </Sequence>
      
      <Sequence from={SCENES.closing.start} durationInFrames={SCENES.closing.duration}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
