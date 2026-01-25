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

// ChessBoard Component
const ChessBoard: React.FC<{
  highlightedSquares?: string[];
  glowSquares?: string[];
  attackLine?: string[];
  scale?: number;
  children?: React.ReactNode;
}> = ({ highlightedSquares = [], glowSquares = [], attackLine = [], scale = 1, children }) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  
  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);
  
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
            const isAttackLine = attackLine.includes(square);
            
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
                {isAttackLine && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.cyan,
                      opacity: glowPulse * 0.6,
                      boxShadow: `inset 0 0 15px ${COLORS.cyan}`,
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

// Bullet Point List Component
const BulletList: React.FC<{
  items: string[];
  delay?: number;
}> = ({ items, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  return (
    <div
      style={{
        position: 'absolute',
        right: 100,
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '32px 40px',
        border: `2px solid ${COLORS.purple}`,
        boxShadow: `0 0 40px ${COLORS.purple}40`,
        maxWidth: 450,
      }}
    >
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        marginBottom: 24,
        textAlign: 'center',
      }}>
        Key Ideas
      </div>
      {items.map((item, idx) => {
        const itemDelay = delay + idx * 25;
        const itemSpring = spring({ frame: frame - itemDelay, fps, config: { damping: 20, stiffness: 100 } });
        const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
        const translateX = interpolate(itemSpring, [0, 1], [30, 0]);
        
        return (
          <div
            key={idx}
            style={{
              fontSize: 20,
              color: COLORS.green,
              fontFamily: 'Inter, system-ui, sans-serif',
              marginBottom: 16,
              opacity,
              transform: `translateX(${translateX}px)`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <span style={{ color: COLORS.cyan }}>•</span>
            <span>{item}</span>
          </div>
        );
      })}
    </div>
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
        {/* Chessboard silhouette with glow */}
        <div style={{ 
          opacity: boardOpacity,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 40px)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: `0 0 60px ${COLORS.purple}70`,
          position: 'relative',
        }}>
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
            const isCenter = i === 5 || i === 6 || i === 9 || i === 10;
            return (
              <div key={i} style={{
                width: 40,
                height: 40,
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
          The Italian Game
        </div>
        <div style={{ 
          fontSize: 32, 
          color: '#a1a1aa', 
          opacity: subtitleOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif' 
        }}>
          A Classic Chess Opening
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 2: Opening Position Introduction
const OpeningIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 80 } });
  const scale = interpolate(boardScale, [0, 1], [0.9, 1]);
  
  // Starting position pieces
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.N, square: 'g1' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'e2' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
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
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChessBoard scale={scale}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>
        <InfoBox 
          title="One of the oldest openings" 
          subtitle="Fast development and central control"
          delay={20}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 3: Move 1 - e4 e5
const Move1Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  
  // After e4 e5
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
    { piece: PIECES.p, square: 'f7' }, { piece: PIECES.p, square: 'g7' },
    { piece: PIECES.p, square: 'h7' },
  ];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChessBoard glowSquares={['e4', 'e5', 'd4', 'd5']}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* Animate e4 */}
          <AnimatedPiece
            symbol={PIECES.P}
            fromSquare="e2"
            toSquare="e4"
            squareSize={squareSize}
            startFrame={10}
          />
          {/* Animate e5 */}
          <AnimatedPiece
            symbol={PIECES.p}
            fromSquare="e7"
            toSquare="e5"
            squareSize={squareSize}
            startFrame={50}
          />
        </ChessBoard>
        <InfoBox 
          title="1. e4   e5" 
          subtitle="White takes the center, Black mirrors"
          delay={70}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 4: Move 2 - Nf3 Nc6
const Move2Scene: React.FC = () => {
  const squareSize = 56;
  
  // Position after 1. e4 e5
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'f1' },
    { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];
  
  const blackPieces = [
    { piece: PIECES.r, square: 'a8' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c7' }, { piece: PIECES.p, square: 'd7' },
    { piece: PIECES.p, square: 'e5' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChessBoard highlightedSquares={['f3', 'c6', 'e5']}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* Animate Nf3 */}
          <AnimatedPiece
            symbol={PIECES.N}
            fromSquare="g1"
            toSquare="f3"
            squareSize={squareSize}
            startFrame={10}
          />
          {/* Animate Nc6 */}
          <AnimatedPiece
            symbol={PIECES.n}
            fromSquare="b8"
            toSquare="c6"
            squareSize={squareSize}
            startFrame={50}
          />
        </ChessBoard>
        <InfoBox 
          title="2. Nf3   Nc6" 
          subtitle="Knights develop toward the center"
          delay={70}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 5: Move 3 - Bc4 (The Italian!)
const Move3Scene: React.FC = () => {
  const squareSize = 56;
  
  // Position after 1. e4 e5 2. Nf3 Nc6
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' },
    { piece: PIECES.N, square: 'f3' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];
  
  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'c6' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c7' }, { piece: PIECES.p, square: 'd7' },
    { piece: PIECES.p, square: 'e5' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChessBoard attackLine={['c4', 'd5', 'e6', 'f7']} highlightedSquares={['c4']}>
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {/* Animate Bc4 */}
          <AnimatedPiece
            symbol={PIECES.B}
            fromSquare="f1"
            toSquare="c4"
            squareSize={squareSize}
            startFrame={10}
            glow={COLORS.cyan}
          />
        </ChessBoard>
        <InfoBox 
          title="3. Bc4" 
          subtitle="The bishop targets the weak f7 pawn"
          delay={40}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 6: Key Ideas Summary
const KeyIdeasScene: React.FC = () => {
  const squareSize = 56;
  
  // Final Italian Game position
  const whitePieces = [
    { piece: PIECES.R, square: 'a1' }, { piece: PIECES.N, square: 'b1' },
    { piece: PIECES.B, square: 'c1' }, { piece: PIECES.Q, square: 'd1' },
    { piece: PIECES.K, square: 'e1' }, { piece: PIECES.B, square: 'c4' },
    { piece: PIECES.N, square: 'f3' }, { piece: PIECES.R, square: 'h1' },
    { piece: PIECES.P, square: 'a2' }, { piece: PIECES.P, square: 'b2' },
    { piece: PIECES.P, square: 'c2' }, { piece: PIECES.P, square: 'd2' },
    { piece: PIECES.P, square: 'e4' }, { piece: PIECES.P, square: 'f2' },
    { piece: PIECES.P, square: 'g2' }, { piece: PIECES.P, square: 'h2' },
  ];
  
  const blackPieces = [
    { piece: PIECES.r, square: 'a8' }, { piece: PIECES.n, square: 'c6' },
    { piece: PIECES.b, square: 'c8' }, { piece: PIECES.q, square: 'd8' },
    { piece: PIECES.k, square: 'e8' }, { piece: PIECES.b, square: 'f8' },
    { piece: PIECES.n, square: 'g8' }, { piece: PIECES.r, square: 'h8' },
    { piece: PIECES.p, square: 'a7' }, { piece: PIECES.p, square: 'b7' },
    { piece: PIECES.p, square: 'c7' }, { piece: PIECES.p, square: 'd7' },
    { piece: PIECES.p, square: 'e5' }, { piece: PIECES.p, square: 'f7' },
    { piece: PIECES.p, square: 'g7' }, { piece: PIECES.p, square: 'h7' },
  ];
  
  const keyPoints = [
    'Control the center with e4',
    'Develop knight to f3',
    'Bishop targets f7',
    'Prepare quick castling',
  ];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 150 }}>
        <ChessBoard 
          glowSquares={['e4', 'e5']} 
          highlightedSquares={['f3', 'c4']}
          attackLine={['c4', 'd5', 'e6', 'f7']}
        >
          {whitePieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
          {blackPieces.map(({ piece, square }) => (
            <StaticPiece key={square} symbol={piece} square={square} squareSize={squareSize} />
          ))}
        </ChessBoard>
        <BulletList items={keyPoints} delay={15} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene 7: Closing
const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 80 } });
  const taglineOpacity = spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 45, fps, config: { damping: 20, stiffness: 80 } });
  
  return (
    <AbsoluteFill>
      <Background />
      
      {/* Blurred chessboard in background */}
      <AbsoluteFill style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        filter: 'blur(8px)',
        opacity: 0.15,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 50px)',
          borderRadius: 8,
        }}>
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} style={{
              width: 50,
              height: 50,
              backgroundColor: (Math.floor(i/8) + i%8) % 2 === 0 ? COLORS.boardLight : COLORS.boardDark,
            }} />
          ))}
        </div>
      </AbsoluteFill>
      
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {/* Logo */}
        <div style={{ transform: `scale(${logoScale})` }}>
          <Img
            src={staticFile('images/solmate-logo.png')}
            style={{
              height: 120,
              filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
            }}
          />
        </div>
        
        {/* Tagline */}
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: '#ffffff',
            opacity: taglineOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          Solid. Classical. Aggressive.
        </div>
        
        {/* Opening name */}
        <div
          style={{
            fontSize: 28,
            background: `linear-gradient(135deg, ${COLORS.purple} 0%, ${COLORS.green} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: subtitleOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          The Italian Game
        </div>
        
        {/* SolMate text */}
        <div
          style={{
            fontSize: 24,
            color: '#a1a1aa',
            opacity: subtitleOpacity,
            fontFamily: 'Inter, system-ui, sans-serif',
            marginTop: 10,
          }}
        >
          SolMate ♟️
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Main Composition
export const ItalianGame: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      {/* Scene 1: Title (0-90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>
      
      {/* Scene 2: Opening Position Intro (90-180 frames / 3s) */}
      <Sequence from={90} durationInFrames={90}>
        <OpeningIntroScene />
      </Sequence>
      
      {/* Scene 3: Move 1 e4 e5 (180-330 frames / 5s) */}
      <Sequence from={180} durationInFrames={150}>
        <Move1Scene />
      </Sequence>
      
      {/* Scene 4: Move 2 Nf3 Nc6 (330-480 frames / 5s) */}
      <Sequence from={330} durationInFrames={150}>
        <Move2Scene />
      </Sequence>
      
      {/* Scene 5: Move 3 Bc4 (480-630 frames / 5s) */}
      <Sequence from={480} durationInFrames={150}>
        <Move3Scene />
      </Sequence>
      
      {/* Scene 6: Key Ideas (630-810 frames / 6s) */}
      <Sequence from={630} durationInFrames={180}>
        <KeyIdeasScene />
      </Sequence>
      
      {/* Scene 7: Closing (810-900 frames / 3s) */}
      <Sequence from={810} durationInFrames={90}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default ItalianGame;
