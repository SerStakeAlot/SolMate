import Database from 'better-sqlite3';
import path from 'path';

// Database file path - use /data for Railway persistent storage, fallback to local
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'solmate-stats.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize tables
db.exec(`
  -- Global platform statistics
  CREATE TABLE IF NOT EXISTS platform_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_games INTEGER DEFAULT 0,
    total_wager_games INTEGER DEFAULT 0,
    total_free_games INTEGER DEFAULT 0,
    total_sol_wagered REAL DEFAULT 0,
    total_sol_paid_out REAL DEFAULT 0,
    total_fees_collected REAL DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Individual player statistics
  CREATE TABLE IF NOT EXISTS player_stats (
    wallet_address TEXT PRIMARY KEY,
    username TEXT,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_drawn INTEGER DEFAULT 0,
    wager_games_played INTEGER DEFAULT 0,
    wager_games_won INTEGER DEFAULT 0,
    total_wagered REAL DEFAULT 0,
    total_winnings REAL DEFAULT 0,
    total_losses REAL DEFAULT 0,
    net_profit REAL DEFAULT 0,
    biggest_win REAL DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    first_played TEXT DEFAULT CURRENT_TIMESTAMP,
    last_played TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Game history log
  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT UNIQUE,
    white_wallet TEXT,
    black_wallet TEXT,
    winner_wallet TEXT,
    result TEXT, -- 'white', 'black', 'draw', 'abandoned'
    stake_amount REAL DEFAULT 0,
    is_wager_game INTEGER DEFAULT 0,
    match_pubkey TEXT,
    game_duration_seconds INTEGER,
    total_moves INTEGER,
    ended_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Daily statistics for trending/charts
  CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    wager_games INTEGER DEFAULT 0,
    unique_players INTEGER DEFAULT 0,
    sol_wagered REAL DEFAULT 0,
    new_players INTEGER DEFAULT 0
  );

  -- Initialize platform_stats if empty
  INSERT OR IGNORE INTO platform_stats (id) VALUES (1);
`);

// Prepared statements for performance
const statements = {
  // Platform stats
  getPlatformStats: db.prepare('SELECT * FROM platform_stats WHERE id = 1'),
  
  incrementGameCount: db.prepare(`
    UPDATE platform_stats SET 
      total_games = total_games + 1,
      total_wager_games = total_wager_games + @isWager,
      total_free_games = total_free_games + @isFree,
      total_sol_wagered = total_sol_wagered + @wagered,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `),
  
  recordPayout: db.prepare(`
    UPDATE platform_stats SET
      total_sol_paid_out = total_sol_paid_out + @paidOut,
      total_fees_collected = total_fees_collected + @fees,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `),

  // Player stats
  getPlayerStats: db.prepare('SELECT * FROM player_stats WHERE wallet_address = ?'),
  
  getTopPlayers: db.prepare(`
    SELECT * FROM player_stats 
    ORDER BY games_won DESC 
    LIMIT ?
  `),
  
  getTopEarners: db.prepare(`
    SELECT * FROM player_stats 
    WHERE wager_games_played > 0
    ORDER BY net_profit DESC 
    LIMIT ?
  `),

  getLeaderboard: db.prepare(`
    SELECT wallet_address, username, games_played, games_won, games_lost, games_drawn,
           wager_games_played, wager_games_won, net_profit, best_streak
    FROM player_stats 
    WHERE games_played >= ?
    ORDER BY games_won DESC 
    LIMIT ?
  `),
  
  upsertPlayer: db.prepare(`
    INSERT INTO player_stats (wallet_address, username)
    VALUES (@wallet, @username)
    ON CONFLICT(wallet_address) DO UPDATE SET
      username = COALESCE(@username, username),
      last_played = CURRENT_TIMESTAMP
  `),
  
  recordPlayerWin: db.prepare(`
    UPDATE player_stats SET
      games_played = games_played + 1,
      games_won = games_won + 1,
      wager_games_played = wager_games_played + @isWager,
      wager_games_won = wager_games_won + @isWager,
      total_wagered = total_wagered + @wagered,
      total_winnings = total_winnings + @winnings,
      net_profit = net_profit + @profit,
      biggest_win = MAX(biggest_win, @profit),
      current_streak = current_streak + 1,
      best_streak = MAX(best_streak, current_streak + 1),
      last_played = CURRENT_TIMESTAMP
    WHERE wallet_address = @wallet
  `),
  
  recordPlayerLoss: db.prepare(`
    UPDATE player_stats SET
      games_played = games_played + 1,
      games_lost = games_lost + 1,
      wager_games_played = wager_games_played + @isWager,
      total_wagered = total_wagered + @wagered,
      total_losses = total_losses + @loss,
      net_profit = net_profit - @loss,
      current_streak = 0,
      last_played = CURRENT_TIMESTAMP
    WHERE wallet_address = @wallet
  `),
  
  recordPlayerDraw: db.prepare(`
    UPDATE player_stats SET
      games_played = games_played + 1,
      games_drawn = games_drawn + 1,
      wager_games_played = wager_games_played + @isWager,
      total_wagered = total_wagered + @wagered,
      last_played = CURRENT_TIMESTAMP
    WHERE wallet_address = @wallet
  `),

  // Game history
  insertGame: db.prepare(`
    INSERT INTO game_history (
      game_id, white_wallet, black_wallet, winner_wallet, result,
      stake_amount, is_wager_game, match_pubkey, game_duration_seconds, total_moves
    ) VALUES (
      @gameId, @whiteWallet, @blackWallet, @winnerWallet, @result,
      @stakeAmount, @isWagerGame, @matchPubkey, @durationSeconds, @totalMoves
    )
  `),
  
  getRecentGames: db.prepare(`
    SELECT * FROM game_history 
    ORDER BY ended_at DESC 
    LIMIT ?
  `),
  
  getPlayerGames: db.prepare(`
    SELECT * FROM game_history 
    WHERE white_wallet = ? OR black_wallet = ?
    ORDER BY ended_at DESC 
    LIMIT ?
  `),

  // Daily stats
  upsertDailyStats: db.prepare(`
    INSERT INTO daily_stats (date, games_played, wager_games, sol_wagered)
    VALUES (@date, 1, @isWager, @wagered)
    ON CONFLICT(date) DO UPDATE SET
      games_played = games_played + 1,
      wager_games = wager_games + @isWager,
      sol_wagered = sol_wagered + @wagered
  `),
  
  getDailyStats: db.prepare(`
    SELECT * FROM daily_stats 
    ORDER BY date DESC 
    LIMIT ?
  `),

  // Unique player count
  getUniquePlayerCount: db.prepare('SELECT COUNT(*) as count FROM player_stats'),
};

// Stats store interface
export interface PlatformStats {
  totalGames: number;
  totalWagerGames: number;
  totalFreeGames: number;
  totalSolWagered: number;
  totalSolPaidOut: number;
  totalFeesCollected: number;
  uniquePlayers: number;
  updatedAt: string;
}

export interface PlayerStats {
  walletAddress: string;
  username: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  wagerGamesPlayed: number;
  wagerGamesWon: number;
  totalWagered: number;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
  biggestWin: number;
  currentStreak: number;
  bestStreak: number;
  winRate: number;
  firstPlayed: string;
  lastPlayed: string;
}

export interface GameRecord {
  gameId: string;
  whiteWallet: string;
  blackWallet: string;
  winnerWallet: string | null;
  result: 'white' | 'black' | 'draw' | 'abandoned';
  stakeAmount: number;
  isWagerGame: boolean;
  matchPubkey: string | null;
  durationSeconds: number;
  totalMoves: number;
  endedAt: string;
}

class StatsStore {
  // Get platform-wide statistics
  getPlatformStats(): PlatformStats {
    const row = statements.getPlatformStats.get() as any;
    const uniqueCount = statements.getUniquePlayerCount.get() as any;
    
    return {
      totalGames: row.total_games,
      totalWagerGames: row.total_wager_games,
      totalFreeGames: row.total_free_games,
      totalSolWagered: row.total_sol_wagered,
      totalSolPaidOut: row.total_sol_paid_out,
      totalFeesCollected: row.total_fees_collected,
      uniquePlayers: uniqueCount.count,
      updatedAt: row.updated_at,
    };
  }

  // Get individual player statistics
  getPlayerStats(walletAddress: string): PlayerStats | null {
    const row = statements.getPlayerStats.get(walletAddress) as any;
    if (!row) return null;

    const winRate = row.games_played > 0 
      ? Math.round((row.games_won / row.games_played) * 100) 
      : 0;

    return {
      walletAddress: row.wallet_address,
      username: row.username,
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      gamesLost: row.games_lost,
      gamesDrawn: row.games_drawn,
      wagerGamesPlayed: row.wager_games_played,
      wagerGamesWon: row.wager_games_won,
      totalWagered: row.total_wagered,
      totalWinnings: row.total_winnings,
      totalLosses: row.total_losses,
      netProfit: row.net_profit,
      biggestWin: row.biggest_win,
      currentStreak: row.current_streak,
      bestStreak: row.best_streak,
      winRate,
      firstPlayed: row.first_played,
      lastPlayed: row.last_played,
    };
  }

  // Ensure player exists in database
  ensurePlayer(walletAddress: string, username?: string): void {
    statements.upsertPlayer.run({
      wallet: walletAddress,
      username: username || null,
    });
  }

  // Record a completed game
  recordGame(params: {
    gameId: string;
    whiteWallet: string;
    blackWallet: string;
    winnerWallet: string | null;
    result: 'white' | 'black' | 'draw' | 'abandoned';
    stakeAmount: number;
    matchPubkey?: string;
    durationSeconds: number;
    totalMoves: number;
    whiteUsername?: string;
    blackUsername?: string;
  }): void {
    const isWagerGame = params.stakeAmount > 0;
    const totalPot = params.stakeAmount * 2;
    const winnings = isWagerGame ? totalPot * 0.9 : 0; // 90% to winner
    const today = new Date().toISOString().split('T')[0];

    // Ensure both players exist
    this.ensurePlayer(params.whiteWallet, params.whiteUsername);
    this.ensurePlayer(params.blackWallet, params.blackUsername);

    // Insert game record
    try {
      statements.insertGame.run({
        gameId: params.gameId,
        whiteWallet: params.whiteWallet,
        blackWallet: params.blackWallet,
        winnerWallet: params.winnerWallet,
        result: params.result,
        stakeAmount: params.stakeAmount,
        isWagerGame: isWagerGame ? 1 : 0,
        matchPubkey: params.matchPubkey || null,
        durationSeconds: params.durationSeconds,
        totalMoves: params.totalMoves,
      });
    } catch (e: any) {
      // Ignore duplicate game_id errors
      if (!e.message.includes('UNIQUE constraint')) throw e;
      console.log(`Game ${params.gameId} already recorded, skipping`);
      return;
    }

    // Update platform stats
    statements.incrementGameCount.run({
      isWager: isWagerGame ? 1 : 0,
      isFree: isWagerGame ? 0 : 1,
      wagered: totalPot,
    });

    // Update daily stats
    statements.upsertDailyStats.run({
      date: today,
      isWager: isWagerGame ? 1 : 0,
      wagered: totalPot,
    });

    // Update player stats based on result
    if (params.result === 'draw') {
      statements.recordPlayerDraw.run({
        wallet: params.whiteWallet,
        isWager: isWagerGame ? 1 : 0,
        wagered: params.stakeAmount,
      });
      statements.recordPlayerDraw.run({
        wallet: params.blackWallet,
        isWager: isWagerGame ? 1 : 0,
        wagered: params.stakeAmount,
      });
    } else if (params.result === 'white' || params.result === 'black') {
      const winnerWallet = params.result === 'white' ? params.whiteWallet : params.blackWallet;
      const loserWallet = params.result === 'white' ? params.blackWallet : params.whiteWallet;

      statements.recordPlayerWin.run({
        wallet: winnerWallet,
        isWager: isWagerGame ? 1 : 0,
        wagered: params.stakeAmount,
        winnings: winnings,
        profit: isWagerGame ? params.stakeAmount * 0.8 : 0, // Net profit (won opponent's stake minus fee)
      });

      statements.recordPlayerLoss.run({
        wallet: loserWallet,
        isWager: isWagerGame ? 1 : 0,
        wagered: params.stakeAmount,
        loss: params.stakeAmount,
      });

      // Record payout stats
      if (isWagerGame) {
        statements.recordPayout.run({
          paidOut: winnings,
          fees: totalPot * 0.1,
        });
      }
    }

    console.log(`📊 Recorded game: ${params.gameId} | Result: ${params.result} | Stake: ${params.stakeAmount} SOL`);
  }

  // Get leaderboard
  getLeaderboard(minGames: number = 3, limit: number = 20): PlayerStats[] {
    const rows = statements.getLeaderboard.all(minGames, limit) as any[];
    return rows.map(row => ({
      walletAddress: row.wallet_address,
      username: row.username,
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      gamesLost: row.games_lost,
      gamesDrawn: row.games_drawn,
      wagerGamesPlayed: row.wager_games_played,
      wagerGamesWon: row.wager_games_won,
      totalWagered: 0,
      totalWinnings: 0,
      totalLosses: 0,
      netProfit: row.net_profit,
      biggestWin: 0,
      currentStreak: 0,
      bestStreak: row.best_streak,
      winRate: row.games_played > 0 ? Math.round((row.games_won / row.games_played) * 100) : 0,
      firstPlayed: '',
      lastPlayed: '',
    }));
  }

  // Get recent games
  getRecentGames(limit: number = 20): GameRecord[] {
    const rows = statements.getRecentGames.all(limit) as any[];
    return rows.map(row => ({
      gameId: row.game_id,
      whiteWallet: row.white_wallet,
      blackWallet: row.black_wallet,
      winnerWallet: row.winner_wallet,
      result: row.result,
      stakeAmount: row.stake_amount,
      isWagerGame: row.is_wager_game === 1,
      matchPubkey: row.match_pubkey,
      durationSeconds: row.game_duration_seconds,
      totalMoves: row.total_moves,
      endedAt: row.ended_at,
    }));
  }

  // Get player's game history
  getPlayerGames(walletAddress: string, limit: number = 20): GameRecord[] {
    const rows = statements.getPlayerGames.all(walletAddress, walletAddress, limit) as any[];
    return rows.map(row => ({
      gameId: row.game_id,
      whiteWallet: row.white_wallet,
      blackWallet: row.black_wallet,
      winnerWallet: row.winner_wallet,
      result: row.result,
      stakeAmount: row.stake_amount,
      isWagerGame: row.is_wager_game === 1,
      matchPubkey: row.match_pubkey,
      durationSeconds: row.game_duration_seconds,
      totalMoves: row.total_moves,
      endedAt: row.ended_at,
    }));
  }

  // Get daily stats for charts
  getDailyStats(days: number = 30): any[] {
    return statements.getDailyStats.all(days) as any[];
  }
}

export const statsStore = new StatsStore();
