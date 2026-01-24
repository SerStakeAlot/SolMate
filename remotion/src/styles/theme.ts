// SolMate Video Theme - Consistent across all educational videos

export const COLORS = {
  // Solana-inspired palette
  purple: '#9945FF',
  purpleLight: '#B87CFF',
  purpleDark: '#7B2FD9',
  green: '#14F195',
  greenDark: '#0FD982',
  
  // Background
  bgDark: '#0a0a0a',
  bgGradientStart: '#1a1025',
  bgGradientEnd: '#0a0a0a',
  
  // Board colors
  boardLight: '#d4d0e8',
  boardDark: '#6b5b95',
  
  // Highlights
  highlightMove: 'rgba(153, 69, 255, 0.5)',
  highlightCapture: 'rgba(239, 68, 68, 0.5)',
  highlightGlow: '#9945FF',
  
  // Text
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
};

export const FONTS = {
  heading: 'Inter, system-ui, sans-serif',
  body: 'Inter, system-ui, sans-serif',
  mono: 'JetBrains Mono, monospace',
};

export const TIMINGS = {
  // Standard durations in frames (at 30fps)
  titleCard: 90,      // 3 seconds
  pieceScene: 105,    // 3.5 seconds
  knightScene: 120,   // 4 seconds
  pawnScene: 120,     // 4 seconds
  closingCard: 75,    // 2.5 seconds
  
  // Transition durations
  fadeIn: 15,
  fadeOut: 15,
  slideIn: 20,
};

export const BOARD = {
  size: 480,
  squareSize: 60,
  borderRadius: 12,
};

// Chess piece Unicode symbols
export const PIECE_SYMBOLS: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

// Square coordinates
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Helper to convert algebraic notation to coordinates
export const squareToCoords = (square: string): { x: number; y: number } => {
  const file = square[0];
  const rank = square[1];
  return {
    x: FILES.indexOf(file),
    y: RANKS.indexOf(rank),
  };
};

// Helper to convert coordinates to algebraic notation
export const coordsToSquare = (x: number, y: number): string => {
  return `${FILES[x]}${RANKS[y]}`;
};
