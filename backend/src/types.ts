export interface Player {
  id: string;
  walletAddress: string;
  socketId: string;
  username?: string;
  xp: number;
  rank: string;
  gamesPlayed: number;
  gamesWon: number;
  currentRoomId?: string;
}

export interface MatchmakingRequest {
  playerId: string;
  stakeTier: number; // 0 = 0.5 SOL, 1 = 1 SOL
  walletAddress: string;
  timestamp: number;
}

export interface GameRoom {
  id: string;
  stakeTier: number;
  playerWhite: Player;
  playerBlack: Player;
  whiteTimeMs: number;
  blackTimeMs: number;
  currentTurn: 'w' | 'b';
  startTime: number;
  lastMoveTime: number;
  moves: string[]; // Array of moves in algebraic notation
  status: 'waiting' | 'active' | 'finished';
  winner?: 'w' | 'b' | 'draw';
  endReason?: 'checkmate' | 'timeout' | 'resignation' | 'draw';
}

export interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
  fen: string;
  san: string; // Standard algebraic notation
}

export interface TimeUpdate {
  whiteTimeMs: number;
  blackTimeMs: number;
  currentTurn: 'w' | 'b';
}

export const STAKE_TIERS = [
  { tier: 0, amount: 0.5, label: '0.5 SOL' },
  { tier: 1, amount: 1.0, label: '1 SOL' },
];

export const GAME_DURATION_MS = 10 * 60 * 1000; // 10 minutes per player

export const RANK_THRESHOLDS = {
  NOVICE: 0,
  AMATEUR: 100,
  INTERMEDIATE: 500,
  ADVANCED: 1500,
  EXPERT: 3000,
  MASTER: 5000,
};

export function calculateRank(xp: number): string {
  if (xp >= RANK_THRESHOLDS.MASTER) return 'Master';
  if (xp >= RANK_THRESHOLDS.EXPERT) return 'Expert';
  if (xp >= RANK_THRESHOLDS.ADVANCED) return 'Advanced';
  if (xp >= RANK_THRESHOLDS.INTERMEDIATE) return 'Intermediate';
  if (xp >= RANK_THRESHOLDS.AMATEUR) return 'Amateur';
  return 'Novice';
}

export function calculateXPGain(won: boolean, opponentRank: string): number {
  const baseXP = won ? 50 : 10; // Win gives 50 XP, loss gives 10 XP
  const rankMultiplier: { [key: string]: number } = {
    'Novice': 1.0,
    'Amateur': 1.2,
    'Intermediate': 1.5,
    'Advanced': 1.8,
    'Expert': 2.0,
    'Master': 2.5,
  };
  return Math.floor(baseXP * (rankMultiplier[opponentRank] || 1.0));
}
