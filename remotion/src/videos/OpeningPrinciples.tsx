import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  cyan: '#00D4FF',
  gold: '#FFD700',
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
          inset: 0,
          backgroundImage: `linear-gradient(rgba(153, 69, 255, 0.03) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(153, 69, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
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
  scale?: number;
}> = ({ symbol, square, squareSize, opacity = 1, glow, scale = 1 }) => {
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
        fontSize: squareSize * 0.75 * scale,
        color: '#ffffff',
        textShadow: glow ? `0 0 20px ${glow}, 0 0 40px ${glow}` : '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10,
        opacity,
        transform: `scale(${scale})`,
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
  duration?: number;
  glow?: string;
}> = ({ symbol, fromSquare, toSquare, squareSize, startFrame, duration = 20, glow }) => {
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
  
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const x = interpolate(clampedProgress, [0, 1], [fromPos.x, toPos.x]);
  const y = interpolate(clampedProgress, [0, 1], [fromPos.y, toPos.y]);
  
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

// Multi-move animated piece
const MultiMovePiece: React.FC<{
  symbol: string;
  moves: { square: string; frame: number }[];
  squareSize: number;
  glow?: string;
}> = ({ symbol, moves, squareSize, glow }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Find current move segment
  let currentMoveIdx = 0;
  for (let i = 0; i < moves.length - 1; i++) {
    if (frame >= moves[i].frame) {
      currentMoveIdx = i;
    }
  }
  
  const fromMove = moves[currentMoveIdx];
  const toMove = moves[currentMoveIdx + 1] || fromMove;
  
  const fromPos = getSquarePos(fromMove.square, squareSize);
  const toPos = getSquarePos(toMove.square, squareSize);
  
  const moveProgress = spring({
    frame: frame - fromMove.frame,
    fps,
    config: { damping: 20, stiffness: 100 },
    durationInFrames: 20,
  });
  
  const clampedProgress = Math.min(1, Math.max(0, moveProgress));
  const x = interpolate(clampedProgress, [0, 1], [fromPos.x, toPos.x]);
  const y = interpolate(clampedProgress, [0, 1], [fromPos.y, toPos.y]);
  
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

// ChessBoard Component
const ChessBoard: React.FC<{
  highlightedSquares?: string[];
  glowSquares?: string[];
  dangerSquares?: string[];
  shieldSquare?: string;
  scale?: number;
  children?: React.ReactNode;
}> = ({ highlightedSquares = [], glowSquares = [], dangerSquares = [], shieldSquare, scale = 1, children }) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);
  const shieldPulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.4, 0.7]);
  
  return (
    <div
      style={{
        width: boardSize,
        height: boardSize,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `0 0 60px ${COLORS.purple}40, 0 20px 40px rgba(0,0,0,0.5)`,
        position: 'relative',
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${squareSize}px)` }}>
        {RANKS.map((rank, rankIdx) =>
          FILES.map((file, fileIdx) => {
            const square = `${file}${rank}`;
            const isLight = (fileIdx + rankIdx) % 2 === 0;
            const isHighlighted = highlightedSquares.includes(square);
            const isGlow = glowSquares.includes(square);
            const isDanger = dangerSquares.includes(square);
            const isShield = shieldSquare === square;
            
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
                      opacity: 0.4,
                    }}
                  />
                )}
                {isGlow && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.gold,
                      opacity: glowPulse,
                      boxShadow: `inset 0 0 20px ${COLORS.gold}`,
                    }}
                  />
                )}
                {isDanger && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.red,
                      opacity: glowPulse,
                    }}
                  />
                )}
                {isShield && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.green,
                      opacity: shieldPulse * 0.5,
                      boxShadow: `inset 0 0 25px ${COLORS.green}`,
                    }}
                  />
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
  subtitle?: string;
  delay?: number;
}> = ({ title, subtitle, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 100 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateY = interpolate(slideIn, [0, 1], [30, 0]);
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: '50%',
        transform: `translateX(-50%) translateY(${translateY}px)`,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '24px 48px',
        border: `2px solid ${COLORS.purple}`,
        opacity,
        textAlign: 'center',
        boxShadow: `0 0 40px ${COLORS.purple}40`,
      }}
    >
      <div style={{ 
        fontSize: 36, 
        fontWeight: 700, 
        color: '#ffffff', 
        fontFamily: 'Inter, system-ui, sans-serif',
        marginBottom: subtitle ? 12 : 0,
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ 
          fontSize: 22, 
          color: COLORS.green, 
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

// X Mark for "Don't" scenes
const XMark: React.FC<{ x: number; y: number; delay: number }> = ({ x, y, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scaleIn = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 150 } });
  const opacity = interpolate(scaleIn, [0, 0.5, 1], [0, 1, 1]);
  
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: 48,
        color: COLORS.red,
        fontWeight: 900,
        opacity,
        transform: `scale(${scaleIn})`,
        textShadow: `0 0 20px ${COLORS.red}`,
        zIndex: 20,
      }}
    >
      ✕
    </div>
  );
};

// Attack Arrow
const AttackArrow: React.FC<{
  from: string;
  to: string;
  squareSize: number;
  delay: number;
}> = ({ from, to, squareSize, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const fromPos = getSquarePos(from, squareSize);
  const toPos = getSquarePos(to, squareSize);
  
  const progress = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 100 } });
  
  const centerOffset = squareSize / 2;
  const x1 = fromPos.x + centerOffset;
  const y1 = fromPos.y + centerOffset;
  const x2 = toPos.x + centerOffset;
  const y2 = toPos.y + centerOffset;
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return (
    <div
      style={{
        position: 'absolute',
        left: x1,
        top: y1 - 3,
        width: length * progress,
        height: 6,
        backgroundColor: COLORS.red,
        opacity: 0.8,
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%',
        borderRadius: 3,
        zIndex: 5,
      }}
    />
  );
};

// Scene 1: Title Card
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 80 } });
  
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        {/* Mini board with center glow */}
        <div style={{ 
          opacity: boardOpacity,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 35px)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: `0 0 50px ${COLORS.purple}60`,
          position: 'relative',
        }}>
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
            const isCenter = i === 5 || i === 6 || i === 9 || i === 10;
            return (
              <div key={i} style={{
                width: 35,
                height: 35,
                backgroundColor: (Math.floor(i/4) + i%4) % 2 === 0 ? COLORS.boardLight : COLORS.boardDark,
                boxShadow: isCenter ? `inset 0 0 20px ${COLORS.gold}${Math.floor(glowPulse * 255).toString(16).padStart(2, '0')}` : 'none',
              }} />
            );
          })}
        </div>
        
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: titleOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          Opening Principles
        </div>
        <div style={{ 
          fontSize: 32, 
          color: '#a1a1aa', 
          opacity: subtitleOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif' 
        }}>
          The Golden Rules of the Opening
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 2: Control the Center
const ControlCenterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Pawn moves
  const e4Start = 20;
  const d4Start = 45;
  
  const e4Moved = frame >= e4Start + 20;
  const d4Moved = frame >= d4Start + 20;
  
  const centerSquares = ['e4', 'd4', 'e5', 'd5'];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard glowSquares={centerSquares}>
            {/* e-pawn */}
            {frame < e4Start ? (
              <StaticPiece symbol={PIECES.P} square="e2" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.P}
                fromSquare="e2"
                toSquare="e4"
                squareSize={squareSize}
                startFrame={e4Start}
              />
            )}
            
            {/* d-pawn */}
            {frame < d4Start ? (
              <StaticPiece symbol={PIECES.P} square="d2" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.P}
                fromSquare="d2"
                toSquare="d4"
                squareSize={squareSize}
                startFrame={d4Start}
              />
            )}
            
            {/* Other starting pawns */}
            {['a2', 'b2', 'c2', 'f2', 'g2', 'h2'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.P} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Back rank pieces */}
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="b1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="c1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="f1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="g1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.R} square="h1" squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox title="Control the Center" subtitle="e4 • d4 • e5 • d5" delay={30} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 3: Develop Your Pieces
const DevelopPiecesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Development moves
  const nf3Start = 15;
  const bc4Start = 40;
  const nc3Start = 65;
  const bf4Start = 90;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard>
            {/* Central pawns already out */}
            <StaticPiece symbol={PIECES.P} square="e4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} />
            {['a2', 'b2', 'c2', 'f2', 'g2', 'h2'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.P} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Knight g1 -> f3 */}
            {frame < nf3Start ? (
              <StaticPiece symbol={PIECES.N} square="g1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece symbol={PIECES.N} fromSquare="g1" toSquare="f3" squareSize={squareSize} startFrame={nf3Start} />
            )}
            
            {/* Bishop f1 -> c4 */}
            {frame < bc4Start ? (
              <StaticPiece symbol={PIECES.B} square="f1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece symbol={PIECES.B} fromSquare="f1" toSquare="c4" squareSize={squareSize} startFrame={bc4Start} />
            )}
            
            {/* Knight b1 -> c3 */}
            {frame < nc3Start ? (
              <StaticPiece symbol={PIECES.N} square="b1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece symbol={PIECES.N} fromSquare="b1" toSquare="c3" squareSize={squareSize} startFrame={nc3Start} />
            )}
            
            {/* Bishop c1 -> f4 */}
            {frame < bf4Start ? (
              <StaticPiece symbol={PIECES.B} square="c1" squareSize={squareSize} />
            ) : (
              <AnimatedPiece symbol={PIECES.B} fromSquare="c1" toSquare="f4" squareSize={squareSize} startFrame={bf4Start} />
            )}
            
            {/* Stationary pieces */}
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.R} square="h1" squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox title="Develop Your Pieces" subtitle="Knights and Bishops First" delay={25} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 4: Castle Early
const CastleEarlyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  const castleStart = 30;
  const castled = frame >= castleStart + 25;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard shieldSquare={castled ? 'g1' : undefined}>
            {/* Pawns */}
            <StaticPiece symbol={PIECES.P} square="e4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} />
            {['a2', 'b2', 'c2', 'f2', 'g2', 'h2'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.P} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Developed pieces */}
            <StaticPiece symbol={PIECES.N} square="f3" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="c4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="c3" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="e3" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={squareSize} />
            
            {/* King castles */}
            {frame < castleStart ? (
              <>
                <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />
                <StaticPiece symbol={PIECES.R} square="h1" squareSize={squareSize} />
              </>
            ) : (
              <>
                <AnimatedPiece symbol={PIECES.K} fromSquare="e1" toSquare="g1" squareSize={squareSize} startFrame={castleStart} glow={castled ? COLORS.green : undefined} />
                <AnimatedPiece symbol={PIECES.R} fromSquare="h1" toSquare="f1" squareSize={squareSize} startFrame={castleStart + 5} />
              </>
            )}
          </ChessBoard>
        </div>
        <InfoBox title="Castle Early" subtitle="Protect Your King" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 5: Don't Move Same Piece Twice
const DontMoveTwiceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Knight moves to f3, then tries to move to g5 (bad)
  const firstMoveStart = 15;
  const badMoveStart = 50;
  const showX = frame >= badMoveStart + 15;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard dangerSquares={showX ? ['g5'] : []}>
            {/* Pawns */}
            <StaticPiece symbol={PIECES.P} square="e4" squareSize={squareSize} />
            {['a2', 'b2', 'c2', 'd2', 'f2', 'g2', 'h2'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.P} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Knight movement sequence */}
            {frame < firstMoveStart ? (
              <StaticPiece symbol={PIECES.N} square="g1" squareSize={squareSize} />
            ) : frame < badMoveStart ? (
              <AnimatedPiece symbol={PIECES.N} fromSquare="g1" toSquare="f3" squareSize={squareSize} startFrame={firstMoveStart} />
            ) : (
              <MultiMovePiece
                symbol={PIECES.N}
                moves={[
                  { square: 'f3', frame: 0 },
                  { square: 'g5', frame: badMoveStart },
                ]}
                squareSize={squareSize}
              />
            )}
            
            {/* Other pieces */}
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="b1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="c1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="f1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.R} square="h1" squareSize={squareSize} />
          </ChessBoard>
          
          {/* X Mark */}
          {showX && (
            <XMark x={6 * squareSize + 10} y={3 * squareSize - 10} delay={badMoveStart + 15} />
          )}
        </div>
        <InfoBox title="Avoid Moving the Same Piece Twice" subtitle="Develop All Your Pieces" delay={25} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 6: Don't Bring Queen Out Early
const DontQueenEarlyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Queen moves out, gets attacked, retreats
  const queenOutStart = 15;
  const showAttacks = frame >= 45;
  const queenRetreatStart = 70;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard dangerSquares={showAttacks && frame < queenRetreatStart ? ['h5'] : []}>
            {/* Pawns */}
            <StaticPiece symbol={PIECES.P} square="e4" squareSize={squareSize} />
            {['a2', 'b2', 'c2', 'd2', 'f2', 'g2', 'h2'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.P} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Black pieces attacking */}
            <StaticPiece symbol={PIECES.n} square="c6" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.p} square="g6" squareSize={squareSize} />
            {['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'h7'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.p} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Queen movement */}
            {frame < queenOutStart ? (
              <StaticPiece symbol={PIECES.Q} square="d1" squareSize={squareSize} />
            ) : frame < queenRetreatStart ? (
              <AnimatedPiece symbol={PIECES.Q} fromSquare="d1" toSquare="h5" squareSize={squareSize} startFrame={queenOutStart} />
            ) : (
              <AnimatedPiece symbol={PIECES.Q} fromSquare="h5" toSquare="f3" squareSize={squareSize} startFrame={queenRetreatStart} />
            )}
            
            {/* Attack arrows */}
            {showAttacks && frame < queenRetreatStart && (
              <>
                <AttackArrow from="c6" to="h5" squareSize={squareSize} delay={45} />
                <AttackArrow from="g6" to="h5" squareSize={squareSize} delay={50} />
              </>
            )}
            
            {/* Other white pieces */}
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="b1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="c1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.K} square="e1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="f1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="g1" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.R} square="h1" squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox title="Don't Bring the Queen Out Too Early" subtitle="She Becomes a Target" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 7: Connect Your Rooks
const ConnectRooksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  const connected = frame >= 40;
  const connectionGlow = connected ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.6]) : 0;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard highlightedSquares={connected ? ['d1', 'e1', 'f1'] : []}>
            {/* Developed position */}
            <StaticPiece symbol={PIECES.P} square="e4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.P} square="d4" squareSize={squareSize} />
            {['a2', 'b2', 'c2', 'f2', 'g2', 'h2'].map(sq => (
              <StaticPiece key={sq} symbol={PIECES.P} square={sq} squareSize={squareSize} />
            ))}
            
            {/* Developed pieces - clear back rank between rooks */}
            <StaticPiece symbol={PIECES.N} square="f3" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="c4" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.N} square="c3" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.B} square="e3" squareSize={squareSize} />
            <StaticPiece symbol={PIECES.Q} square="e2" squareSize={squareSize} />
            
            {/* King castled */}
            <StaticPiece symbol={PIECES.K} square="g1" squareSize={squareSize} />
            
            {/* Rooks connected */}
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={squareSize} glow={connected ? COLORS.green : undefined} />
            <StaticPiece symbol={PIECES.R} square="f1" squareSize={squareSize} glow={connected ? COLORS.green : undefined} />
            
            {/* Connection line */}
            {connected && (
              <div
                style={{
                  position: 'absolute',
                  left: squareSize * 0.5,
                  top: squareSize * 7.5 - 2,
                  width: squareSize * 5,
                  height: 4,
                  backgroundColor: COLORS.green,
                  opacity: connectionGlow,
                  borderRadius: 2,
                  zIndex: 5,
                }}
              />
            )}
          </ChessBoard>
        </div>
        <InfoBox title="Connect Your Rooks" subtitle="Prepare for the Middlegame" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 8: Closing
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
          fontSize: 40, 
          color: '#ffffff', 
          opacity: taglineOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
          textAlign: 'center',
        }}>
          Strong Openings Win Games
        </div>
        <div style={{ fontSize: 48, color: '#71717a', opacity: subtitleOpacity }}>♟️</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene timings (30fps, ~32 seconds total)
const SCENES = {
  title: { start: 0, duration: 90 },              // 0-3s
  controlCenter: { start: 90, duration: 135 },    // 3-7.5s
  developPieces: { start: 225, duration: 135 },   // 7.5-12s
  castleEarly: { start: 360, duration: 120 },     // 12-16s
  dontMoveTwice: { start: 480, duration: 105 },   // 16-19.5s
  dontQueenEarly: { start: 585, duration: 120 },  // 19.5-23.5s
  connectRooks: { start: 705, duration: 105 },    // 23.5-27s
  closing: { start: 810, duration: 90 },          // 27-30s
};

// Total: 900 frames = 30 seconds

// Main composition
export const OpeningPrinciples: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Sequence from={SCENES.title.start} durationInFrames={SCENES.title.duration}>
        <TitleScene />
      </Sequence>
      
      <Sequence from={SCENES.controlCenter.start} durationInFrames={SCENES.controlCenter.duration}>
        <ControlCenterScene />
      </Sequence>
      
      <Sequence from={SCENES.developPieces.start} durationInFrames={SCENES.developPieces.duration}>
        <DevelopPiecesScene />
      </Sequence>
      
      <Sequence from={SCENES.castleEarly.start} durationInFrames={SCENES.castleEarly.duration}>
        <CastleEarlyScene />
      </Sequence>
      
      <Sequence from={SCENES.dontMoveTwice.start} durationInFrames={SCENES.dontMoveTwice.duration}>
        <DontMoveTwiceScene />
      </Sequence>
      
      <Sequence from={SCENES.dontQueenEarly.start} durationInFrames={SCENES.dontQueenEarly.duration}>
        <DontQueenEarlyScene />
      </Sequence>
      
      <Sequence from={SCENES.connectRooks.start} durationInFrames={SCENES.connectRooks.duration}>
        <ConnectRooksScene />
      </Sequence>
      
      <Sequence from={SCENES.closing.start} durationInFrames={SCENES.closing.duration}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
