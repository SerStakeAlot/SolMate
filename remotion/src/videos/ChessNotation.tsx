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
      {/* Subtle grid overlay */}
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
  
  const x = interpolate(Math.min(1, Math.max(0, progress)), [0, 1], [fromPos.x, toPos.x]);
  const y = interpolate(Math.min(1, Math.max(0, progress)), [0, 1], [fromPos.y, toPos.y]);
  
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

// ChessBoard with notation labels
const ChessBoard: React.FC<{
  highlightedSquares?: string[];
  dangerSquares?: string[];
  showLabels?: boolean;
  labelOpacity?: number;
  children?: React.ReactNode;
}> = ({ highlightedSquares = [], dangerSquares = [], showLabels = true, labelOpacity = 1, children }) => {
  const frame = useCurrentFrame();
  const squareSize = 56;
  const boardSize = squareSize * 8;
  
  const highlightOpacity = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.6]);
  const dangerPulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.4, 0.7]);
  
  return (
    <div style={{ position: 'relative' }}>
      {/* File labels (a-h) */}
      {showLabels && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          width: boardSize,
          marginBottom: 8,
          opacity: labelOpacity,
        }}>
          {FILES.map((file, idx) => (
            <div key={file} style={{
              width: squareSize,
              textAlign: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.purple,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {file}
            </div>
          ))}
        </div>
      )}
      
      <div style={{ display: 'flex' }}>
        {/* Rank labels (8-1) */}
        {showLabels && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            marginRight: 8,
            opacity: labelOpacity,
          }}>
            {RANKS.map((rank) => (
              <div key={rank} style={{
                height: squareSize,
                display: 'flex',
                alignItems: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.green,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {rank}
              </div>
            ))}
          </div>
        )}
        
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
                const isDanger = dangerSquares.includes(square);
                
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
                    {isDanger && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: COLORS.red,
                          opacity: dangerPulse,
                          boxShadow: `inset 0 0 15px ${COLORS.red}`,
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
      </div>
    </div>
  );
};

// Notation Overlay - shows notation text near the board
const NotationOverlay: React.FC<{
  text: string;
  position: 'right' | 'bottom';
  delay?: number;
}> = ({ text, position, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateX = position === 'right' ? interpolate(slideIn, [0, 1], [30, 0]) : 0;
  const translateY = position === 'bottom' ? interpolate(slideIn, [0, 1], [20, 0]) : 0;
  
  return (
    <div
      style={{
        position: 'absolute',
        ...(position === 'right' ? { right: -180, top: '50%', transform: `translateY(-50%) translateX(${translateX}px)` } : {}),
        ...(position === 'bottom' ? { bottom: -80, left: '50%', transform: `translateX(-50%) translateY(${translateY}px)` } : {}),
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '16px 24px',
        borderRadius: 12,
        border: `2px solid ${COLORS.purple}`,
        opacity,
        boxShadow: `0 0 20px ${COLORS.purple}40`,
      }}
    >
      <div style={{
        fontSize: 36,
        fontWeight: 700,
        color: COLORS.green,
        fontFamily: 'monospace',
      }}>
        {text}
      </div>
    </div>
  );
};

// Info Box Component
const InfoBox: React.FC<{ 
  title?: string;
  lines: string[]; 
  delay?: number;
}> = ({ title, lines, delay = 0 }) => {
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
      {title && (
        <div style={{ 
          fontSize: 42, 
          fontWeight: 700, 
          color: '#ffffff', 
          marginBottom: 16, 
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          {title}
        </div>
      )}
      {lines.map((line, idx) => (
        <div key={idx} style={{ 
          fontSize: 24, 
          color: '#d4d4d4', 
          lineHeight: 1.6, 
          fontFamily: 'Inter, system-ui, sans-serif',
          marginBottom: 8,
        }}>
          {line}
        </div>
      ))}
    </div>
  );
};

// Piece Symbol Display
const PieceSymbolRow: React.FC<{
  piece: string;
  symbol: string;
  letter: string;
  delay: number;
  highlight?: boolean;
}> = ({ piece, symbol, letter, delay, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(slideIn, [0, 1], [0, 1]);
  const translateX = interpolate(slideIn, [0, 1], [30, 0]);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      opacity,
      transform: `translateX(${translateX}px)`,
      padding: '12px 20px',
      backgroundColor: highlight ? `${COLORS.purple}30` : 'transparent',
      borderRadius: 12,
      border: highlight ? `2px solid ${COLORS.purple}` : '2px solid transparent',
    }}>
      <div style={{ fontSize: 48, color: '#ffffff' }}>{symbol}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {piece}
      </div>
      <div style={{ fontSize: 28, color: COLORS.green, fontFamily: 'monospace', fontWeight: 700 }}>
        = {letter}
      </div>
    </div>
  );
};

// Title Scene
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const boardOpacity = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 25, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 80 } });
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        {/* Mini board icon */}
        <div style={{ 
          opacity: boardOpacity,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 30px)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: `0 0 40px ${COLORS.purple}60`,
        }}>
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => (
            <div key={i} style={{
              width: 30,
              height: 30,
              backgroundColor: (Math.floor(i/4) + i%4) % 2 === 0 ? COLORS.boardLight : COLORS.boardDark,
            }} />
          ))}
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
          Chess Notation
        </div>
        <div style={{ 
          fontSize: 32, 
          color: '#a1a1aa', 
          opacity: subtitleOpacity, 
          fontFamily: 'Inter, system-ui, sans-serif' 
        }}>
          Read & Write Moves Like a Pro
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Files & Ranks Scene
const FilesRanksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const labelOpacity = spring({ frame: frame - 20, fps, config: { damping: 15, stiffness: 80 } });
  
  // Highlight e4 square
  const showHighlight = frame > 60;
  const highlights = showHighlight ? ['e4'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard 
            highlightedSquares={highlights} 
            showLabels={true} 
            labelOpacity={labelOpacity}
          />
          {showHighlight && (
            <NotationOverlay text="e4" position="right" delay={60} />
          )}
        </div>
        <InfoBox 
          lines={[
            "Files: a–h (left to right)",
            "Ranks: 1–8 (bottom to top)",
            "",
            "Every square has a name!",
          ]}
          delay={30} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Piece Symbols Scene
const PieceSymbolsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  const pieces = [
    { piece: 'King', symbol: PIECES.K, letter: 'K', delay: 15 },
    { piece: 'Queen', symbol: PIECES.Q, letter: 'Q', delay: 25 },
    { piece: 'Rook', symbol: PIECES.R, letter: 'R', delay: 35 },
    { piece: 'Bishop', symbol: PIECES.B, letter: 'B', delay: 45 },
    { piece: 'Knight', symbol: PIECES.N, letter: 'N', delay: 55, highlight: true },
  ];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 100, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard showLabels={false}>
            <StaticPiece symbol={PIECES.K} square="e1" squareSize={56} />
            <StaticPiece symbol={PIECES.Q} square="d1" squareSize={56} />
            <StaticPiece symbol={PIECES.R} square="a1" squareSize={56} />
            <StaticPiece symbol={PIECES.R} square="h1" squareSize={56} />
            <StaticPiece symbol={PIECES.B} square="c1" squareSize={56} />
            <StaticPiece symbol={PIECES.B} square="f1" squareSize={56} />
            <StaticPiece symbol={PIECES.N} square="b1" squareSize={56} />
            <StaticPiece symbol={PIECES.N} square="g1" squareSize={56} />
          </ChessBoard>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pieces.map((p) => (
            <PieceSymbolRow 
              key={p.piece}
              piece={p.piece}
              symbol={p.symbol}
              letter={p.letter}
              delay={p.delay}
              highlight={p.highlight}
            />
          ))}
          <div style={{
            marginTop: 16,
            fontSize: 18,
            color: '#a1a1aa',
            fontFamily: 'Inter, system-ui, sans-serif',
            opacity: frame > 70 ? 1 : 0,
          }}>
            (N for Knight to avoid confusion with King)
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Pawn Moves Scene
const PawnMovesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  const pawnMoveStart = 30;
  const pawnMoved = frame >= pawnMoveStart + 20;
  
  const highlights = pawnMoved ? ['e4'] : ['e2'];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard highlightedSquares={highlights} showLabels={true} labelOpacity={1}>
            {frame < pawnMoveStart ? (
              <StaticPiece symbol={PIECES.P} square="e2" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.P}
                fromSquare="e2"
                toSquare="e4"
                squareSize={squareSize}
                startFrame={pawnMoveStart}
                duration={20}
              />
            )}
          </ChessBoard>
          {pawnMoved && (
            <NotationOverlay text="e4" position="right" delay={pawnMoveStart + 25} />
          )}
        </div>
        <InfoBox 
          lines={[
            "Pawns use only the",
            "destination square",
            "",
            "Example: e4",
          ]}
          delay={20} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Captures Scene
const CapturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  const captureStart = 35;
  const captured = frame >= captureStart + 20;
  
  const highlights = captured ? ['e5'] : ['d3', 'e5'];
  
  // Black pawn opacity (fades out when captured)
  const pawnOpacity = captured ? interpolate(frame, [captureStart + 15, captureStart + 25], [1, 0], { extrapolateRight: 'clamp' }) : 1;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard highlightedSquares={highlights} showLabels={true} labelOpacity={1}>
            {/* Black pawn being captured */}
            {pawnOpacity > 0 && (
              <StaticPiece symbol={PIECES.p} square="e5" squareSize={squareSize} opacity={pawnOpacity} />
            )}
            
            {/* Knight captures */}
            {frame < captureStart ? (
              <StaticPiece symbol={PIECES.N} square="d3" squareSize={squareSize} />
            ) : (
              <AnimatedPiece
                symbol={PIECES.N}
                fromSquare="d3"
                toSquare="e5"
                squareSize={squareSize}
                startFrame={captureStart}
                duration={20}
              />
            )}
          </ChessBoard>
          {captured && (
            <NotationOverlay text="Nxe5" position="right" delay={captureStart + 25} />
          )}
        </div>
        <InfoBox 
          lines={[
            "Captures use \"x\"",
            "",
            "Example: Nxe5",
            "(Knight takes e5)",
          ]}
          delay={20} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Check & Checkmate Scene
const CheckCheckmateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Show check first, then checkmate
  const showCheck = frame > 20 && frame < 70;
  const showCheckmate = frame >= 70;
  
  const dangerSquares = showCheck || showCheckmate ? ['e8'] : [];
  const kingGlow = showCheck || showCheckmate ? COLORS.red : undefined;
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 80px' }}>
        <div style={{ transform: `scale(${boardScale})`, position: 'relative' }}>
          <ChessBoard dangerSquares={dangerSquares} showLabels={false}>
            {/* King in danger */}
            <StaticPiece symbol={PIECES.K} square="e8" squareSize={squareSize} glow={kingGlow} />
            
            {/* Attacking queen */}
            <StaticPiece symbol={PIECES.q} square="e1" squareSize={squareSize} />
            
            {showCheckmate && (
              <>
                <StaticPiece symbol={PIECES.r} square="a8" squareSize={squareSize} />
                <StaticPiece symbol={PIECES.k} square="e6" squareSize={squareSize} />
              </>
            )}
          </ChessBoard>
          
          {/* Notation symbols */}
          {showCheck && !showCheckmate && (
            <div style={{
              position: 'absolute',
              right: -120,
              top: '40%',
              fontSize: 72,
              fontWeight: 800,
              color: COLORS.red,
              fontFamily: 'monospace',
              textShadow: `0 0 20px ${COLORS.red}`,
            }}>
              +
            </div>
          )}
          {showCheckmate && (
            <div style={{
              position: 'absolute',
              right: -120,
              top: '40%',
              fontSize: 72,
              fontWeight: 800,
              color: COLORS.red,
              fontFamily: 'monospace',
              textShadow: `0 0 30px ${COLORS.red}`,
            }}>
              #
            </div>
          )}
        </div>
        <InfoBox 
          lines={[
            "Check: +",
            "(King under attack)",
            "",
            "Checkmate: #",
            "(Game over!)",
          ]}
          delay={25} 
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
          Read the Game.
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

// Scene timings (30fps, ~28 seconds total)
const SCENES = {
  title: { start: 0, duration: 90 },           // 0-3s
  filesRanks: { start: 90, duration: 135 },    // 3-7.5s
  pieceSymbols: { start: 225, duration: 135 }, // 7.5-12s
  pawnMoves: { start: 360, duration: 105 },    // 12-15.5s
  captures: { start: 465, duration: 120 },     // 15.5-19.5s
  checkCheckmate: { start: 585, duration: 135 },// 19.5-24s
  closing: { start: 720, duration: 90 },       // 24-27s
};

// Total: 810 frames = 27 seconds

// Main composition
export const ChessNotation: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Sequence from={SCENES.title.start} durationInFrames={SCENES.title.duration}>
        <TitleScene />
      </Sequence>
      
      <Sequence from={SCENES.filesRanks.start} durationInFrames={SCENES.filesRanks.duration}>
        <FilesRanksScene />
      </Sequence>
      
      <Sequence from={SCENES.pieceSymbols.start} durationInFrames={SCENES.pieceSymbols.duration}>
        <PieceSymbolsScene />
      </Sequence>
      
      <Sequence from={SCENES.pawnMoves.start} durationInFrames={SCENES.pawnMoves.duration}>
        <PawnMovesScene />
      </Sequence>
      
      <Sequence from={SCENES.captures.start} durationInFrames={SCENES.captures.duration}>
        <CapturesScene />
      </Sequence>
      
      <Sequence from={SCENES.checkCheckmate.start} durationInFrames={SCENES.checkCheckmate.duration}>
        <CheckCheckmateScene />
      </Sequence>
      
      <Sequence from={SCENES.closing.start} durationInFrames={SCENES.closing.duration}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
