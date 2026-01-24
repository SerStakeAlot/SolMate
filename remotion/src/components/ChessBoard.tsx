import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { COLORS, BOARD, FILES, RANKS } from '../styles/theme';

interface ChessBoardProps {
  highlightedSquares?: string[];
  highlightColor?: string;
  pieces?: { square: string; piece: string; color: 'white' | 'black' }[];
  arrows?: { from: string; to: string }[];
  showCoordinates?: boolean;
  animateHighlights?: boolean;
  scale?: number;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  highlightedSquares = [],
  highlightColor = COLORS.highlightMove,
  pieces = [],
  arrows = [],
  showCoordinates = true,
  animateHighlights = true,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const boardSize = BOARD.size * scale;
  const squareSize = BOARD.squareSize * scale;
  
  // Pulsing highlight animation
  const highlightOpacity = animateHighlights
    ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.7])
    : 0.5;
  
  const renderSquare = (file: number, rank: number) => {
    const isLight = (file + rank) % 2 === 0;
    const squareName = `${FILES[file]}${RANKS[rank]}`;
    const isHighlighted = highlightedSquares.includes(squareName);
    
    return (
      <div
        key={squareName}
        style={{
          width: squareSize,
          height: squareSize,
          backgroundColor: isLight ? COLORS.boardLight : COLORS.boardDark,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Highlight overlay */}
        {isHighlighted && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: highlightColor,
              opacity: highlightOpacity,
              boxShadow: animateHighlights 
                ? `inset 0 0 ${10 * scale}px ${COLORS.highlightGlow}` 
                : 'none',
            }}
          />
        )}
        
        {/* Coordinate labels */}
        {showCoordinates && file === 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2 * scale,
              left: 3 * scale,
              fontSize: 10 * scale,
              fontWeight: 700,
              color: isLight ? COLORS.boardDark : COLORS.boardLight,
              opacity: 0.8,
            }}
          >
            {RANKS[rank]}
          </span>
        )}
        {showCoordinates && rank === 7 && (
          <span
            style={{
              position: 'absolute',
              bottom: 2 * scale,
              right: 3 * scale,
              fontSize: 10 * scale,
              fontWeight: 700,
              color: isLight ? COLORS.boardDark : COLORS.boardLight,
              opacity: 0.8,
            }}
          >
            {FILES[file]}
          </span>
        )}
      </div>
    );
  };
  
  const renderPiece = (pieceData: { square: string; piece: string; color: 'white' | 'black' }) => {
    const fileIndex = FILES.indexOf(pieceData.square[0]);
    const rankIndex = RANKS.indexOf(pieceData.square[1]);
    
    return (
      <div
        key={`piece-${pieceData.square}`}
        style={{
          position: 'absolute',
          left: fileIndex * squareSize,
          top: rankIndex * squareSize,
          width: squareSize,
          height: squareSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: squareSize * 0.75,
          color: pieceData.color === 'white' ? '#ffffff' : '#1a1a1a',
          textShadow: pieceData.color === 'white' 
            ? '0 2px 4px rgba(0,0,0,0.5)' 
            : '0 2px 4px rgba(255,255,255,0.3)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {pieceData.piece}
      </div>
    );
  };
  
  const renderArrow = (arrow: { from: string; to: string }, index: number) => {
    const fromFile = FILES.indexOf(arrow.from[0]);
    const fromRank = RANKS.indexOf(arrow.from[1]);
    const toFile = FILES.indexOf(arrow.to[0]);
    const toRank = RANKS.indexOf(arrow.to[1]);
    
    const fromX = (fromFile + 0.5) * squareSize;
    const fromY = (fromRank + 0.5) * squareSize;
    const toX = (toFile + 0.5) * squareSize;
    const toY = (toRank + 0.5) * squareSize;
    
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    
    // Animate arrow drawing
    const progress = spring({
      frame: frame - index * 3,
      fps,
      config: { damping: 15, stiffness: 100 },
    });
    
    return (
      <svg
        key={`arrow-${index}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: boardSize,
          height: boardSize,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <defs>
          <marker
            id={`arrowhead-${index}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={COLORS.green}
              opacity={progress}
            />
          </marker>
        </defs>
        <line
          x1={fromX}
          y1={fromY}
          x2={fromX + (toX - fromX) * progress}
          y2={fromY + (toY - fromY) * progress}
          stroke={COLORS.green}
          strokeWidth={4 * scale}
          markerEnd={progress > 0.8 ? `url(#arrowhead-${index})` : undefined}
          opacity={0.9}
        />
      </svg>
    );
  };
  
  return (
    <div
      style={{
        width: boardSize,
        height: boardSize,
        borderRadius: BOARD.borderRadius * scale,
        overflow: 'hidden',
        boxShadow: `0 0 ${60 * scale}px ${COLORS.purple}40, 0 ${20 * scale}px ${40 * scale}px rgba(0,0,0,0.5)`,
        position: 'relative',
      }}
    >
      {/* Board grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${squareSize}px)`,
          gridTemplateRows: `repeat(8, ${squareSize}px)`,
        }}
      >
        {RANKS.map((_, rankIndex) =>
          FILES.map((_, fileIndex) => renderSquare(fileIndex, rankIndex))
        )}
      </div>
      
      {/* Pieces layer */}
      {pieces.map(renderPiece)}
      
      {/* Arrows layer */}
      {arrows.map(renderArrow)}
    </div>
  );
};
