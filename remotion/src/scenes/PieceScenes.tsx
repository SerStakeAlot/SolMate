import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { ChessBoard } from '../components/ChessBoard';
import { PieceInfoBox } from '../components/AnimatedText';
import { PIECE_SYMBOLS, COLORS } from '../styles/theme';

interface PieceSceneProps {
  pieceName: string;
  pieceSymbol: string;
  pieceSquare: string;
  highlightedSquares: string[];
  description: string;
  arrows?: { from: string; to: string }[];
  additionalPieces?: { square: string; piece: string; color: 'white' | 'black' }[];
}

export const PieceScene: React.FC<PieceSceneProps> = ({
  pieceName,
  pieceSymbol,
  pieceSquare,
  highlightedSquares,
  description,
  arrows = [],
  additionalPieces = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Board entrance animation
  const boardScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  
  const boardOpacity = interpolate(boardScale, [0, 1], [0, 1]);
  
  // Stagger highlight squares
  const visibleHighlights = highlightedSquares.filter((_, i) => {
    const delay = 20 + i * 3;
    return frame > delay;
  });
  
  // Piece animation
  const pieceScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  return (
    <AbsoluteFill>
      <Background showGrid={false} showParticles />
      
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 100,
          padding: '0 100px',
        }}
      >
        {/* Chess Board */}
        <div
          style={{
            transform: `scale(${boardScale})`,
            opacity: boardOpacity,
          }}
        >
          <ChessBoard
            highlightedSquares={visibleHighlights}
            pieces={[
              { square: pieceSquare, piece: pieceSymbol, color: 'white' },
              ...additionalPieces,
            ]}
            arrows={frame > 50 ? arrows : []}
            animateHighlights
          />
        </div>
        
        {/* Info Panel */}
        <PieceInfoBox
          pieceName={pieceName}
          description={description}
          delay={25}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Pre-configured scenes for each piece
export const KingScene: React.FC = () => (
  <PieceScene
    pieceName="King"
    pieceSymbol={PIECE_SYMBOLS.K}
    pieceSquare="e4"
    highlightedSquares={['d5', 'e5', 'f5', 'd4', 'f4', 'd3', 'e3', 'f3']}
    description="Moves one square in any direction"
  />
);

export const QueenScene: React.FC = () => (
  <PieceScene
    pieceName="Queen"
    pieceSymbol={PIECE_SYMBOLS.Q}
    pieceSquare="d4"
    highlightedSquares={[
      // Horizontal
      'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4',
      // Vertical
      'd1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8',
      // Diagonal
      'a1', 'b2', 'c3', 'e5', 'f6', 'g7', 'h8',
      'a7', 'b6', 'c5', 'e3', 'f2', 'g1',
    ]}
    description="Moves any number of squares in any direction"
    arrows={[
      { from: 'd4', to: 'h4' },
      { from: 'd4', to: 'd8' },
      { from: 'd4', to: 'h8' },
    ]}
  />
);

export const RookScene: React.FC = () => (
  <PieceScene
    pieceName="Rook"
    pieceSymbol={PIECE_SYMBOLS.R}
    pieceSquare="d4"
    highlightedSquares={[
      // Horizontal
      'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4',
      // Vertical
      'd1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8',
    ]}
    description="Moves horizontally or vertically"
    arrows={[
      { from: 'd4', to: 'h4' },
      { from: 'd4', to: 'd8' },
    ]}
  />
);

export const BishopScene: React.FC = () => (
  <PieceScene
    pieceName="Bishop"
    pieceSymbol={PIECE_SYMBOLS.B}
    pieceSquare="d4"
    highlightedSquares={[
      // Diagonal 1
      'a1', 'b2', 'c3', 'e5', 'f6', 'g7', 'h8',
      // Diagonal 2
      'a7', 'b6', 'c5', 'e3', 'f2', 'g1',
    ]}
    description="Moves diagonally across the board"
    arrows={[
      { from: 'd4', to: 'h8' },
      { from: 'd4', to: 'a7' },
    ]}
  />
);

export const KnightScene: React.FC = () => (
  <PieceScene
    pieceName="Knight"
    pieceSymbol={PIECE_SYMBOLS.N}
    pieceSquare="d4"
    highlightedSquares={['c6', 'e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5']}
    description="Moves in an L-shape and can jump over pieces"
    additionalPieces={[
      { square: 'd5', piece: PIECE_SYMBOLS.p, color: 'black' },
      { square: 'e4', piece: PIECE_SYMBOLS.p, color: 'black' },
      { square: 'c4', piece: PIECE_SYMBOLS.p, color: 'black' },
      { square: 'd3', piece: PIECE_SYMBOLS.p, color: 'black' },
    ]}
  />
);

export const PawnScene: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Show different highlights based on time
  const showDoubleMove = frame > 40;
  const showCapture = frame > 70;
  
  let highlights = ['e3'];
  if (showDoubleMove) highlights = ['e3', 'e4'];
  if (showCapture) highlights = ['e3', 'e4', 'd3', 'f3'];
  
  return (
    <PieceScene
      pieceName="Pawn"
      pieceSymbol={PIECE_SYMBOLS.P}
      pieceSquare="e2"
      highlightedSquares={highlights}
      description="Moves forward, captures diagonally"
      additionalPieces={showCapture ? [
        { square: 'd3', piece: PIECE_SYMBOLS.p, color: 'black' },
        { square: 'f3', piece: PIECE_SYMBOLS.p, color: 'black' },
      ] : []}
    />
  );
};
