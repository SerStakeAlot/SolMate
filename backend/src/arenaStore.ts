import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Arena configuration
const MAX_GAMES_PER_DAY = 20;
const COOLDOWN_SECONDS = 30;
const MIN_MOVES_TO_COUNT = 10;

interface ArenaGame {
  id: number;
  wallet_address: string;
  result: 'win' | 'loss' | 'draw';
  move_count: number;
  counts: boolean;
  played_at: number;
  week_number: number;
}

interface WeeklyStats {
  wallet_address: string;
  matches_played: number;
  wins: number;
  score: number;
  week_number: number;
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  username?: string;
  matchesPlayed: number;
  wins: number;
  score: number;
}

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

    // Create weekly stats table (materialized for performance)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS arena_weekly_stats (
        wallet_address TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        matches_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        score REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (wallet_address, week_number)
      );
      
      CREATE INDEX IF NOT EXISTS idx_weekly_week ON arena_weekly_stats(week_number);
      CREATE INDEX IF NOT EXISTS idx_weekly_score ON arena_weekly_stats(score DESC);
    `);

    console.log('ArenaStore initialized');
  }

  // Get current week number (ISO week, resets Monday 00:00 UTC)
  private getCurrentWeek(): number {
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getUTCDay() + 1) / 7);
  }

  // Get week date range for display
  getWeekDateRange(): { start: string; end: string } {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysToMonday);
    monday.setUTCHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    
    const format = (d: Date) => d.toISOString().split('T')[0];
    
    return { start: format(monday), end: format(sunday) };
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

  // Check if player can start a new game
  canStartGame(walletAddress: string): { canPlay: boolean; reason?: string; cooldownEndsAt?: number } {
    // Check daily limit
    const gamesToday = this.getGamesToday(walletAddress);
    if (gamesToday >= MAX_GAMES_PER_DAY) {
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
    const weekNumber = this.getCurrentWeek();
    const now = Date.now();

    // Only count if meets minimum moves
    const shouldCount = counts && moveCount >= MIN_MOVES_TO_COUNT;

    // Insert game record
    const insertGame = this.db.prepare(`
      INSERT INTO arena_games (wallet_address, result, move_count, counts, played_at, week_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertGame.run(walletAddress, result, moveCount, shouldCount ? 1 : 0, now, weekNumber);

    // Update weekly stats if game counts
    if (shouldCount) {
      const matchIncrement = 1;
      const winIncrement = result === 'win' ? 1 : 0;
      const scoreIncrement = 1.0 + (result === 'win' ? 0.5 : 0);

      const upsertStats = this.db.prepare(`
        INSERT INTO arena_weekly_stats (wallet_address, week_number, matches_played, wins, score)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(wallet_address, week_number) DO UPDATE SET
          matches_played = matches_played + ?,
          wins = wins + ?,
          score = score + ?
      `);
      upsertStats.run(
        walletAddress, weekNumber, matchIncrement, winIncrement, scoreIncrement,
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
    const weekNumber = this.getCurrentWeek();
    
    // Get weekly stats
    const statsStmt = this.db.prepare(`
      SELECT matches_played, wins, score FROM arena_weekly_stats
      WHERE wallet_address = ? AND week_number = ?
    `);
    const statsRow = statsStmt.get(walletAddress, weekNumber) as WeeklyStats | undefined;

    // Get rank
    const rankStmt = this.db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM arena_weekly_stats
      WHERE week_number = ? AND score > COALESCE((
        SELECT score FROM arena_weekly_stats WHERE wallet_address = ? AND week_number = ?
      ), 0)
    `);
    const rankRow = rankStmt.get(weekNumber, walletAddress, weekNumber) as { rank: number };

    // Get games remaining today
    const gamesToday = this.getGamesToday(walletAddress);
    const gamesRemaining = Math.max(0, MAX_GAMES_PER_DAY - gamesToday);

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

  // Get leaderboard for current week
  getLeaderboard(limit: number = 20): LeaderboardEntry[] {
    const weekNumber = this.getCurrentWeek();
    
    const stmt = this.db.prepare(`
      SELECT 
        wallet_address,
        matches_played,
        wins,
        score
      FROM arena_weekly_stats
      WHERE week_number = ?
      ORDER BY score DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(weekNumber, limit) as Array<{
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
    const weekNumber = this.getCurrentWeek();
    
    // Get player stats
    const statsStmt = this.db.prepare(`
      SELECT matches_played, wins, score FROM arena_weekly_stats
      WHERE wallet_address = ? AND week_number = ?
    `);
    const stats = statsStmt.get(walletAddress, weekNumber) as WeeklyStats | undefined;
    
    if (!stats) return null;

    // Get rank
    const rankStmt = this.db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM arena_weekly_stats
      WHERE week_number = ? AND score > ?
    `);
    const rankRow = rankStmt.get(weekNumber, stats.score) as { rank: number };

    return {
      rank: rankRow.rank,
      walletAddress,
      matchesPlayed: stats.matches_played,
      wins: stats.wins,
      score: stats.score,
    };
  }
}

export const arenaStore = new ArenaStore();
