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
  // Skill-based matchmaking fields
  solProfit: number; // Net SOL profit/loss (positive = winning, negative = losing)
  totalWagered: number; // Total SOL wagered
}

// Skill tiers for matchmaking
export type SkillTier = 'new' | 'negative' | 'neutral' | 'positive';

// Get skill tier based on SOL profit
export function getSkillTier(player: Player): SkillTier {
  // New players (less than 2 games)
  if (player.gamesPlayed < 2) {
    return 'new';
  }
  
  // Negative (lost more than 0.5 SOL)
  if (player.solProfit < -0.5) {
    return 'negative';
  }
  
  // Positive (won more than 0.5 SOL)
  if (player.solProfit > 0.5) {
    return 'positive';
  }
  
  // Neutral (between -0.5 and +0.5 SOL)
  return 'neutral';
}

// Check if two players can be matched based on skill
export function canMatchPlayers(player1: Player, player2: Player): boolean {
  const tier1 = getSkillTier(player1);
  const tier2 = getSkillTier(player2);
  
  // Define compatible tiers
  // New players: match with new or negative
  // Negative players: match with negative or new
  // Neutral players: match with neutral or positive
  // Positive players: match with positive or neutral
  
  const compatibilityMap: Record<SkillTier, SkillTier[]> = {
    'new': ['new', 'negative'],
    'negative': ['negative', 'new'],
    'neutral': ['neutral', 'positive'],
    'positive': ['positive', 'neutral'],
  };
  
  return compatibilityMap[tier1].includes(tier2) || compatibilityMap[tier2].includes(tier1);
}

export interface MatchmakingRequest {
  playerId: string;
  stakeTier: number; // 0 = 0.5 SOL, 1 = 1 SOL
  walletAddress: string;
  timestamp: number;
  skillTier: SkillTier; // For skill-based matching
}

// Hosted match (on-chain match registered with backend for real-time)
export interface HostedMatch {
  matchCode: string; // 4-letter code for easy search
  matchPubkey: string; // On-chain match account address
  hostWallet: string;
  hostSocketId: string;
  stakeTier: number;
  createdAt: number;
  joinDeadline: number;
  status: 'waiting' | 'active' | 'finished' | 'cancelled';
  guestWallet?: string;
  guestSocketId?: string;
  roomId?: string; // Game room ID once matched
}

export interface GameRoom {
  id: string;
  matchCode?: string; // Link to hosted match
  matchPubkey?: string; // On-chain match address
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
  gameStarted?: boolean; // Whether the clock has started (first move made)
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
