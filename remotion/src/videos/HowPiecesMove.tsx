import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from 'remotion';

// Theme colors
const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  bgDark: '#0a0a0a',
  bgGradientStart: '#1a1025',
  boardLight: '#e8e4f0',
  boardDark: '#6b5b95',
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

// Animated Piece that moves through multiple squares
const AnimatedPiece: React.FC<{
  symbol: string;
  moves: { square: string; frame: number }[];
  squareSize: number;
}> = ({ symbol, moves, squareSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Find current position based on frame
  let currentPos = getSquarePos(moves[0].square, squareSize);
  
  for (let i = 0; i < moves.length - 1; i++) {
    const fromMove = moves[i];
    const toMove = moves[i + 1];
    
    if (frame >= fromMove.frame && frame < toMove.frame + 15) {
      const fromPos = getSquarePos(fromMove.square, squareSize);
      const toPos = getSquarePos(toMove.square, squareSize);
      
      const progress = spring({
        frame: frame - toMove.frame,
        fps,
        config: { damping: 20, stiffness: 120 },
      });
      
      const clampedProgress = Math.max(0, Math.min(1, progress));
      
      currentPos = {
        x: interpolate(clampedProgress, [0, 1], [fromPos.x, toPos.x]),
        y: interpolate(clampedProgress, [0, 1], [fromPos.y, toPos.y]),
      };
      break;
    } else if (frame >= toMove.frame + 15) {
      currentPos = getSquarePos(toMove.square, squareSize);
    }
  }
  
  return (
    <div
      style={{
        position: 'absolute',
        left: currentPos.x,
        top: currentPos.y,
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

// ChessBoard Component
const ChessBoard: React.FC<{
  highlightedSquares?: string[];
  trailSquares?: string[];
  children?: React.ReactNode;
}> = ({ highlightedSquares = [], trailSquares = [], children }) => {
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
            const isTrail = trailSquares.includes(square);
            
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
                {isTrail && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: COLORS.green,
                      opacity: 0.3,
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
const InfoBox: React.FC<{ pieceName: string; description: string; delay?: number }> = ({
  pieceName,
  description,
  delay = 0,
}) => {
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
        padding: '32px 40px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        opacity,
        transform: `translateX(${translateX}px)`,
        maxWidth: 380,
      }}
    >
      <div style={{ fontSize: 48, fontWeight: 700, color: '#ffffff', marginBottom: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {pieceName}
      </div>
      <div style={{ fontSize: 22, color: '#a1a1aa', lineHeight: 1.4, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {description}
      </div>
    </div>
  );
};

// Title Scene
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const knightScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 80 } });
  const titleOpacity = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 80 } });
  const subtitleOpacity = spring({ frame: frame - 35, fps, config: { damping: 20, stiffness: 80 } });
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{ fontSize: 120, transform: `scale(${knightScale})`, color: '#ffffff', filter: `drop-shadow(0 0 30px ${COLORS.purple})` }}>
          {PIECES.N}
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
          }}
        >
          How Chess Pieces Move
        </div>
        <div style={{ fontSize: 32, color: '#a1a1aa', opacity: subtitleOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Beginner Guide
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// King Scene - moves one square in multiple directions
const KingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // King moves: e4 -> e5 -> f5 -> f4 -> e4 (shows all directions)
  const moves = [
    { square: 'e4', frame: 0 },
    { square: 'e5', frame: 25 },
    { square: 'f5', frame: 50 },
    { square: 'f4', frame: 75 },
  ];
  
  // Trail shows where king has been
  const trailSquares = moves
    .filter(m => frame > m.frame + 15)
    .map(m => m.square);
  
  // Highlight possible moves from current position
  const currentSquare = frame < 25 ? 'e4' : frame < 50 ? 'e5' : frame < 75 ? 'f5' : 'f4';
  const highlightMap: Record<string, string[]> = {
    'e4': ['d5', 'e5', 'f5', 'd4', 'f4', 'd3', 'e3', 'f3'],
    'e5': ['d6', 'e6', 'f6', 'd5', 'f5', 'd4', 'e4', 'f4'],
    'f5': ['e6', 'f6', 'g6', 'e5', 'g5', 'e4', 'f4', 'g4'],
    'f4': ['e5', 'f5', 'g5', 'e4', 'g4', 'e3', 'f3', 'g3'],
  };
  const highlights = frame > 10 ? highlightMap[currentSquare] || [] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 100px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} trailSquares={trailSquares}>
            <AnimatedPiece symbol={PIECES.K} moves={moves} squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox pieceName="King" description="Moves one square in any direction" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Queen Scene - moves across the board
const QueenScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Queen moves: d4 -> d8 -> h8 -> h4 (shows vertical, horizontal, diagonal)
  const moves = [
    { square: 'd4', frame: 0 },
    { square: 'd8', frame: 25 },
    { square: 'h8', frame: 50 },
    { square: 'h4', frame: 75 },
  ];
  
  const trailSquares = moves
    .filter(m => frame > m.frame + 15)
    .map(m => m.square);
  
  // Show movement lines
  const highlights = frame > 10 ? ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4', 'a1', 'b2', 'c3', 'e5', 'f6', 'g7', 'h8', 'a7', 'b6', 'c5', 'e3', 'f2', 'g1'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 100px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} trailSquares={trailSquares}>
            <AnimatedPiece symbol={PIECES.Q} moves={moves} squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox pieceName="Queen" description="Moves any number of squares in any direction" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Rook Scene - moves horizontally and vertically
const RookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Rook moves: d4 -> d8 -> h8 -> h4
  const moves = [
    { square: 'd4', frame: 0 },
    { square: 'd8', frame: 25 },
    { square: 'h8', frame: 50 },
    { square: 'h1', frame: 75 },
  ];
  
  const trailSquares = moves
    .filter(m => frame > m.frame + 15)
    .map(m => m.square);
  
  const highlights = frame > 10 ? ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 100px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} trailSquares={trailSquares}>
            <AnimatedPiece symbol={PIECES.R} moves={moves} squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox pieceName="Rook" description="Moves horizontally or vertically" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Bishop Scene - moves diagonally
const BishopScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Bishop moves diagonally: c1 -> h6 -> e3 -> a7
  const moves = [
    { square: 'c1', frame: 0 },
    { square: 'h6', frame: 25 },
    { square: 'd2', frame: 50 },
    { square: 'a5', frame: 75 },
  ];
  
  const trailSquares = moves
    .filter(m => frame > m.frame + 15)
    .map(m => m.square);
  
  const highlights = frame > 10 ? ['a3', 'b2', 'd2', 'e3', 'f4', 'g5', 'h6', 'b4', 'a5'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 100px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} trailSquares={trailSquares}>
            <AnimatedPiece symbol={PIECES.B} moves={moves} squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox pieceName="Bishop" description="Moves diagonally across the board" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Knight Scene - L-shape movement
const KnightScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Knight L-shape moves: d4 -> e6 -> g5 -> f3
  const moves = [
    { square: 'd4', frame: 0 },
    { square: 'e6', frame: 30 },
    { square: 'g5', frame: 60 },
    { square: 'f3', frame: 90 },
  ];
  
  const trailSquares = moves
    .filter(m => frame > m.frame + 15)
    .map(m => m.square);
  
  // Knight can reach these squares from d4
  const highlights = frame > 10 ? ['c6', 'e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 100px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} trailSquares={trailSquares}>
            <AnimatedPiece symbol={PIECES.N} moves={moves} squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox pieceName="Knight" description="Moves in an L-shape and can jump over pieces" delay={20} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Pawn Scene - forward movement and capture
const PawnScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const squareSize = 56;
  
  const boardScale = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  
  // Pawn moves: e2 -> e4 (double move) -> e5 -> d6 (capture)
  const moves = [
    { square: 'e2', frame: 0 },
    { square: 'e4', frame: 30 },
    { square: 'e5', frame: 60 },
    { square: 'd6', frame: 90 },
  ];
  
  const trailSquares = moves
    .filter(m => frame > m.frame + 15)
    .map(m => m.square);
  
  // Show forward moves and diagonal captures
  const highlights = frame > 10 && frame < 30 ? ['e3', 'e4', 'd3', 'f3'] : 
                     frame >= 30 && frame < 60 ? ['e5', 'd5', 'f5'] :
                     frame >= 60 ? ['e6', 'd6', 'f6'] : [];
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 100px' }}>
        <div style={{ transform: `scale(${boardScale})` }}>
          <ChessBoard highlightedSquares={highlights} trailSquares={trailSquares}>
            <AnimatedPiece symbol={PIECES.P} moves={moves} squareSize={squareSize} />
          </ChessBoard>
        </div>
        <InfoBox pieceName="Pawn" description="Moves forward, captures diagonally" delay={20} />
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
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <div style={{ transform: `scale(${logoScale})` }}>
          <Img
            src={staticFile('images/solmate-logo.png')}
            style={{
              height: 120,
              filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
            }}
          />
        </div>
        <div style={{ fontSize: 32, color: '#a1a1aa', opacity: taglineOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Learn. Play. Compete.
        </div>
        <div style={{ fontSize: 48, color: '#71717a', opacity: taglineOpacity }}>♟️</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Scene timings
const SCENES = {
  title: { start: 0, duration: 90 },
  king: { start: 90, duration: 105 },
  queen: { start: 195, duration: 105 },
  rook: { start: 300, duration: 105 },
  bishop: { start: 405, duration: 105 },
  knight: { start: 510, duration: 120 },
  pawn: { start: 630, duration: 120 },
  closing: { start: 750, duration: 150 },
};

// Main composition
export const HowPiecesMove: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Sequence from={SCENES.title.start} durationInFrames={SCENES.title.duration}>
        <TitleScene />
      </Sequence>
      
      <Sequence from={SCENES.king.start} durationInFrames={SCENES.king.duration}>
        <KingScene />
      </Sequence>
      
      <Sequence from={SCENES.queen.start} durationInFrames={SCENES.queen.duration}>
        <QueenScene />
      </Sequence>
      
      <Sequence from={SCENES.rook.start} durationInFrames={SCENES.rook.duration}>
        <RookScene />
      </Sequence>
      
      <Sequence from={SCENES.bishop.start} durationInFrames={SCENES.bishop.duration}>
        <BishopScene />
      </Sequence>
      
      <Sequence from={SCENES.knight.start} durationInFrames={SCENES.knight.duration}>
        <KnightScene />
      </Sequence>
      
      <Sequence from={SCENES.pawn.start} durationInFrames={SCENES.pawn.duration}>
        <PawnScene />
      </Sequence>
      
      <Sequence from={SCENES.closing.start} durationInFrames={SCENES.closing.duration}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
