import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Arena configuration
const MAX_GAMES_PER_DAY = 20;
const COOLDOWN_SECONDS = 30;
const MIN_MOVES_TO_COUNT = 10; // Full moves (white + black = 1 move)
const SHARE_BONUS = 0.25;

interface ArenaGame {
  id: number;
  wallet_address: string;
  result: 'win' | 'loss' | 'draw';
  move_count: number;
  counts: boolean;
  played_at: number;
  week_number: number;
}

interface AllTimeStats {
  wallet_address: string;
  matches_played: number;
  wins: number;
  score: number;
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  username?: string;
  matchesPlayed: number;
  wins: number;
  score: number;
}

// In-memory daily bonus allowances (admin override, resets on restart)
const dailyBonusGames: Map<string, number> = new Map();

class ArenaStore {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DATABASE_PATH 
      ? path.join(path.dirname(process.env.DATABASE_PATH), 'arena.db')
      : path.join(__dirname, '../data/arena.db');
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    // Create arena games table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS arena_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        result TEXT NOT NULL,
        move_count INTEGER NOT NULL,
        counts INTEGER NOT NULL DEFAULT 1,
        played_at INTEGER NOT NULL,
        week_number INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_arena_wallet ON arena_games(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_arena_week ON arena_games(week_number);
      CREATE INDEX IF NOT EXISTS idx_arena_played ON arena_games(played_at);
    `);

    // Create all-time stats table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS arena_stats (
        wallet_address TEXT PRIMARY KEY,
        matches_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        score REAL NOT NULL DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_arena_stats_score ON arena_stats(score DESC);
    `);

    // Add shares column if it doesn't exist (migration for existing DBs)
    try {
      this.db.exec(`ALTER TABLE arena_stats ADD COLUMN shares INTEGER NOT NULL DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }

    console.log('ArenaStore initialized');
  }

  // Get leaderboard type for display
  getLeaderboardType(): string {
    return 'all-time';
  }

  // Get start of today in UTC timestamp
  private getStartOfToday(): number {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return startOfDay.getTime();
  }

  // Get games played today by wallet
  getGamesToday(walletAddress: string): number {
    const startOfToday = this.getStartOfToday();
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM arena_games WHERE wallet_address = ? AND played_at >= ?'
    );
    const row = stmt.get(walletAddress, startOfToday) as { count: number };
    return row.count;
  }

  // Get last game time for cooldown check
  getLastGameTime(walletAddress: string): number | null {
    const stmt = this.db.prepare(
      'SELECT played_at FROM arena_games WHERE wallet_address = ? ORDER BY played_at DESC LIMIT 1'
    );
    const row = stmt.get(walletAddress) as { played_at: number } | undefined;
    return row?.played_at || null;
  }

  // Get effective daily limit (base + any admin bonus)
  getEffectiveDailyLimit(walletAddress: string): number {
    const bonus = dailyBonusGames.get(walletAddress) || 0;
    return MAX_GAMES_PER_DAY + bonus;
  }

  // Admin: grant extra daily games
  grantBonusGames(walletAddress: string, count: number): void {
    const current = dailyBonusGames.get(walletAddress) || 0;
    dailyBonusGames.set(walletAddress, current + count);
  }

  // Check if player can start a new game
  canStartGame(walletAddress: string): { canPlay: boolean; reason?: string; cooldownEndsAt?: number } {
    // Check daily limit (including any admin bonus)
    const gamesToday = this.getGamesToday(walletAddress);
    const effectiveLimit = this.getEffectiveDailyLimit(walletAddress);
    if (gamesToday >= effectiveLimit) {
      return { canPlay: false, reason: `Daily limit reached (${MAX_GAMES_PER_DAY} games)` };
    }

    // Check cooldown
    const lastGame = this.getLastGameTime(walletAddress);
    if (lastGame) {
      const cooldownEndsAt = lastGame + (COOLDOWN_SECONDS * 1000);
      if (Date.now() < cooldownEndsAt) {
        return { canPlay: false, reason: 'Cooldown active', cooldownEndsAt };
      }
    }

    return { canPlay: true };
  }

  // Record a game result
  recordGame(
    walletAddress: string,
    result: 'win' | 'loss' | 'draw',
    moveCount: number,
    counts: boolean = true
  ): { success: boolean; stats: any } {
    const now = Date.now();

    // Only count if meets minimum moves
    const shouldCount = counts && moveCount >= MIN_MOVES_TO_COUNT;

    // Insert game record
    const insertGame = this.db.prepare(`
      INSERT INTO arena_games (wallet_address, result, move_count, counts, played_at, week_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertGame.run(walletAddress, result, moveCount, shouldCount ? 1 : 0, now, 0);

    // Update all-time stats if game counts
    if (shouldCount) {
      const matchIncrement = 1;
      const winIncrement = result === 'win' ? 1 : 0;
      const scoreIncrement = 1.0 + (result === 'win' ? 0.5 : 0);

      const upsertStats = this.db.prepare(`
        INSERT INTO arena_stats (wallet_address, matches_played, wins, score)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET
          matches_played = matches_played + ?,
          wins = wins + ?,
          score = score + ?
      `);
      upsertStats.run(
        walletAddress, matchIncrement, winIncrement, scoreIncrement,
        matchIncrement, winIncrement, scoreIncrement
      );
    }

    // Get updated stats
    const stats = this.getPlayerStats(walletAddress);
    return { success: true, stats };
  }

  // Get player's current stats
  getPlayerStats(walletAddress: string): {
    matchesPlayed: number;
    wins: number;
    score: number;
    rank: number;
    gamesRemainingToday: number;
    cooldownEndsAt?: number;
  } {
    // Get all-time stats
    const statsStmt = this.db.prepare(`
      SELECT matches_played, wins, score FROM arena_stats
      WHERE wallet_address = ?
    `);
    const statsRow = statsStmt.get(walletAddress) as AllTimeStats | undefined;

    // Get rank
    const rankStmt = this.db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM arena_stats
      WHERE score > COALESCE((
        SELECT score FROM arena_stats WHERE wallet_address = ?
      ), 0)
    `);
    const rankRow = rankStmt.get(walletAddress) as { rank: number };

    // Get games remaining today (including any admin bonus)
    const gamesToday = this.getGamesToday(walletAddress);
    const effectiveLimit = this.getEffectiveDailyLimit(walletAddress);
    const gamesRemaining = Math.max(0, effectiveLimit - gamesToday);

    // Get cooldown
    const lastGame = this.getLastGameTime(walletAddress);
    let cooldownEndsAt: number | undefined;
    if (lastGame) {
      const ends = lastGame + (COOLDOWN_SECONDS * 1000);
      if (Date.now() < ends) {
        cooldownEndsAt = ends;
      }
    }

    return {
      matchesPlayed: statsRow?.matches_played || 0,
      wins: statsRow?.wins || 0,
      score: statsRow?.score || 0,
      rank: rankRow.rank,
      gamesRemainingToday: gamesRemaining,
      cooldownEndsAt,
    };
  }

  // Record a share and give bonus points
  recordShare(walletAddress: string): { success: boolean; bonusAwarded: number; newScore: number } {
    // Check if player has any stats (must have played at least one game)
    const statsStmt = this.db.prepare(`
      SELECT score, shares FROM arena_stats WHERE wallet_address = ?
    `);
    const statsRow = statsStmt.get(walletAddress) as { score: number; shares: number } | undefined;
    
    if (!statsRow) {
      return { success: false, bonusAwarded: 0, newScore: 0 };
    }

    // Award share bonus
    const updateStmt = this.db.prepare(`
      UPDATE arena_stats 
      SET shares = shares + 1, score = score + ?
      WHERE wallet_address = ?
    `);
    updateStmt.run(SHARE_BONUS, walletAddress);

    const newScore = statsRow.score + SHARE_BONUS;
    console.log(`Share bonus awarded: ${walletAddress} +${SHARE_BONUS} (new score: ${newScore})`);
    
    return { success: true, bonusAwarded: SHARE_BONUS, newScore };
  }

  // Get all-time leaderboard
  getLeaderboard(limit: number = 20): LeaderboardEntry[] {
    const stmt = this.db.prepare(`
      SELECT 
        wallet_address,
        matches_played,
        wins,
        score
      FROM arena_stats
      ORDER BY score DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as Array<{
      wallet_address: string;
      matches_played: number;
      wins: number;
      score: number;
    }>;

    return rows.map((row, index) => ({
      rank: index + 1,
      walletAddress: row.wallet_address,
      matchesPlayed: row.matches_played,
      wins: row.wins,
      score: row.score,
    }));
  }

  // Get a specific player's leaderboard entry (for showing their position)
  getPlayerLeaderboardEntry(walletAddress: string): LeaderboardEntry | null {
    // Get player stats
    const statsStmt = this.db.prepare(`
      SELECT matches_played, wins, score FROM arena_stats
      WHERE wallet_address = ?
    `);
    const stats = statsStmt.get(walletAddress) as AllTimeStats | undefined;

    if (!stats) return null;

    // Get rank
    const rankStmt = this.db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM arena_stats
      WHERE score > ?
    `);
    const rankRow = rankStmt.get(stats.score) as { rank: number };

    return {
      rank: rankRow.rank,
      walletAddress,
      matchesPlayed: stats.matches_played,
      wins: stats.wins,
      score: stats.score,
    };
  }

  // Admin: Manually adjust player stats (for correcting bugs/issues)
  removeTodayGame(walletAddress: string, preserveStats: boolean = true): { success: boolean; removed: boolean; gamesRemainingToday: number } {
    const startOfToday = this.getStartOfToday();
    // Find the most recent game today
    const findStmt = this.db.prepare(
      'SELECT rowid, result, counts FROM arena_games WHERE wallet_address = ? AND played_at >= ? ORDER BY played_at DESC LIMIT 1'
    );
    const row = findStmt.get(walletAddress, startOfToday) as { rowid: number; result: string; counts: number } | undefined;

    if (!row) {
      const stats = this.getPlayerStats(walletAddress);
      return { success: true, removed: false, gamesRemainingToday: stats.gamesRemainingToday };
    }

    // Delete the game record
    const deleteStmt = this.db.prepare('DELETE FROM arena_games WHERE rowid = ?');
    deleteStmt.run(row.rowid);

    // Only reverse stats if explicitly requested (preserveStats=false)
    if (!preserveStats && row.counts) {
      const winDecrement = row.result === 'win' ? -1 : 0;
      const scoreDecrement = -(1.0 + (row.result === 'win' ? 0.5 : 0));
      const updateStmt = this.db.prepare(`
        UPDATE arena_stats
        SET matches_played = matches_played - 1,
            wins = wins + ?,
            score = score + ?
        WHERE wallet_address = ?
      `);
      updateStmt.run(winDecrement, scoreDecrement, walletAddress);
    }

    const stats = this.getPlayerStats(walletAddress);
    return { success: true, removed: true, gamesRemainingToday: stats.gamesRemainingToday };
  }

  adjustPlayerStats(
    walletAddress: string,
    matchesIncrement: number = 0,
    winsIncrement: number = 0,
    scoreIncrement: number = 0
  ): { success: boolean; newStats: any } {
    // Check if player exists
    const statsStmt = this.db.prepare(`
      SELECT matches_played, wins, score FROM arena_stats
      WHERE wallet_address = ?
    `);
    const existingStats = statsStmt.get(walletAddress) as AllTimeStats | undefined;

    if (!existingStats) {
      // Create new entry if doesn't exist
      const insertStmt = this.db.prepare(`
        INSERT INTO arena_stats (wallet_address, matches_played, wins, score)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run(walletAddress, matchesIncrement, winsIncrement, scoreIncrement);
    } else {
      // Update existing entry
      const updateStmt = this.db.prepare(`
        UPDATE arena_stats
        SET matches_played = matches_played + ?,
            wins = wins + ?,
            score = score + ?
        WHERE wallet_address = ?
      `);
      updateStmt.run(matchesIncrement, winsIncrement, scoreIncrement, walletAddress);
    }

    // Get updated stats
    const newStats = this.getPlayerStats(walletAddress);
    console.log(`Arena stats adjusted: ${walletAddress} +${matchesIncrement} matches, +${winsIncrement} wins, +${scoreIncrement} score`);

    return { success: true, newStats };
  }
}

export const arenaStore = new ArenaStore();
