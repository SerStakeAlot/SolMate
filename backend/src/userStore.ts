import Database from 'better-sqlite3';
import path from 'path';

// User data stored in SQLite
interface User {
  wallet_address: string;
  username: string;
  created_at: number;
  updated_at: number;
}

class UserStore {
  private db: Database.Database;

  constructor() {
    // Use /data directory for persistent storage on Railway, fallback to local
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/users.db');
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    const fs = require('fs');
    if (!fs.existsSync(dataDir)) {
      console.log(`Creating data directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Check if database file exists
    const dbExists = fs.existsSync(dbPath);
    console.log(`Database path: ${dbPath}, exists: ${dbExists}`);

    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    // Create users table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_username ON users(username);
    `);
    console.log('UserStore initialized');
  }

  // Get username by wallet address
  getUsername(walletAddress: string): string | null {
    const stmt = this.db.prepare('SELECT username FROM users WHERE wallet_address = ?');
    const row = stmt.get(walletAddress) as { username: string } | undefined;
    return row?.username || null;
  }

  // Get wallet address by username
  getWalletByUsername(username: string): string | null {
    const stmt = this.db.prepare('SELECT wallet_address FROM users WHERE LOWER(username) = LOWER(?)');
    const row = stmt.get(username) as { wallet_address: string } | undefined;
    return row?.wallet_address || null;
  }

  // Check if username is available
  isUsernameAvailable(username: string, excludeWallet?: string): boolean {
    const normalized = username.toLowerCase();
    
    // Check for reserved/inappropriate names
    const reserved = ['admin', 'solmate', 'system', 'moderator', 'support', 'official'];
    if (reserved.includes(normalized)) {
      return false;
    }

    const stmt = this.db.prepare('SELECT wallet_address FROM users WHERE LOWER(username) = ?');
    const row = stmt.get(normalized) as { wallet_address: string } | undefined;
    
    // If no user has this name, it's available
    if (!row) return true;
    
    // If the current wallet already owns this username, it's "available" for them
    if (excludeWallet && row.wallet_address === excludeWallet) return true;
    
    return false;
  }

  // Set or update username for a wallet
  setUsername(walletAddress: string, username: string): { success: boolean; error?: string } {
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
    if (!usernameRegex.test(username)) {
      return { 
        success: false, 
        error: 'Username must be 3-16 characters, alphanumeric and underscores only' 
      };
    }

    // Check availability
    if (!this.isUsernameAvailable(username, walletAddress)) {
      return { success: false, error: 'Username is already taken' };
    }

    const now = Date.now();
    
    try {
      // Use upsert (INSERT OR REPLACE)
      const stmt = this.db.prepare(`
        INSERT INTO users (wallet_address, username, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET
          username = excluded.username,
          updated_at = excluded.updated_at
      `);
      
      stmt.run(walletAddress, username, now, now);
      console.log(`Username set: ${walletAddress} -> ${username}`);
      return { success: true };
    } catch (error: any) {
      // Handle unique constraint violation on username
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, error: 'Username is already taken' };
      }
      console.error('Error setting username:', error);
      return { success: false, error: 'Database error' };
    }
  }

  // Get multiple usernames by wallet addresses (for game displays)
  getUsernames(walletAddresses: string[]): Record<string, string> {
    if (walletAddresses.length === 0) return {};
    
    const placeholders = walletAddresses.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT wallet_address, username FROM users WHERE wallet_address IN (${placeholders})`);
    const rows = stmt.all(...walletAddresses) as { wallet_address: string; username: string }[];
    
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.wallet_address] = row.username;
    }
    return result;
  }

  // Get user stats (for profile)
  getUser(walletAddress: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE wallet_address = ?');
    return stmt.get(walletAddress) as User | undefined || null;
  }
}

export const userStore = new UserStore();
