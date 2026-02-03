import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { playerStore } from './playerStore';
import { matchmaking } from './matchmaking';
import { gameRoomManager } from './gameRoom';
import { hostedMatchManager } from './hostedMatch';
import { userStore } from './userStore';
import { statsStore } from './statsStore';
import { arenaStore } from './arenaStore';
import { ChessMove } from './types';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ============= Rate Limiting =============

// General API rate limit: 100 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for sensitive endpoints: 10 requests per minute
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Rate limit exceeded for this endpoint' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Match creation rate limit: 5 per minute
const matchCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many match creation attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============= Signature Verification Helper =============

function verifyWalletSignature(walletAddress: string, message: string, signature: string): boolean {
  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// ============= WebSocket Connection Tracking =============
const connectionsByIP = new Map<string, Set<string>>();
const MAX_CONNECTIONS_PER_IP = 5;

const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Connection rate limiting
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
  },
});

// Apply general rate limiting to all routes
app.use(generalLimiter);
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit payload size

// ============= Security Headers Middleware =============
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check endpoint (no rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activePlayers: playerStore.getAllPlayers().length,
    activeGames: gameRoomManager.getActiveRoomCount(),
    queues: matchmaking.getAllQueueStatus(),
    hostedMatches: hostedMatchManager.getWaitingMatches().length,
  });
});

// Get username count and list
app.get('/api/usernames', (req, res) => {
  try {
    const count = userStore.getUserCount();
    const usernames = userStore.getAllUsernames();
    res.json({ 
      count, 
      usernames: usernames.map(u => ({
        username: u.username,
        wallet: `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`,
        createdAt: new Date(u.createdAt).toISOString(),
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch usernames' });
  }
});

// Get lobby matches (REST API for initial load)
app.get('/lobby', (req, res) => {
  const matches = hostedMatchManager.getWaitingMatches().map(m => ({
    matchCode: m.matchCode,
    matchPubkey: m.matchPubkey,
    hostWallet: m.hostWallet,
    stakeTier: m.stakeTier,
    createdAt: m.createdAt,
    joinDeadline: m.joinDeadline,
  }));
  res.json({ matches });
});

// Register a new match (POST /api/matches) - with strict rate limit
app.post('/api/matches', matchCreationLimiter, (req, res) => {
  const { matchCode, matchPubkey, hostWallet, stakeTier, joinDeadline } = req.body;
  
  if (!matchCode || !matchPubkey || !hostWallet) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`Registering match via REST: ${matchCode} from ${hostWallet}`);
  
  // Use hostMatch with empty socketId for REST-based registration
  // Pass the provided matchCode as the preferred code
  const match = hostedMatchManager.hostMatch(hostWallet, '', stakeTier, matchPubkey, 30, io, matchCode);
  
  res.json({ success: true, matchCode: match.matchCode });
});

// ============= Match Winner API Endpoint =============

// Get game result by match pubkey (for refund page winner verification)
app.get('/api/match-winner/:matchPubkey', (req, res) => {
  const { matchPubkey } = req.params;
  const game = statsStore.getGameByMatchPubkey(matchPubkey);
  
  if (!game) {
    return res.json({ found: false, winnerWallet: null });
  }
  
  res.json({
    found: true,
    winnerWallet: game.winnerWallet,
    result: game.result,
    whiteWallet: game.whiteWallet,
    blackWallet: game.blackWallet,
  });
});

// ============= Username API Endpoints =============

// Get username for a wallet address
app.get('/api/username/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;
  const username = userStore.getUsername(walletAddress);
  res.json({ username });
});

// Get multiple usernames (batch lookup)
app.post('/api/usernames', (req, res) => {
  const { walletAddresses } = req.body;
  if (!Array.isArray(walletAddresses)) {
    return res.status(400).json({ error: 'walletAddresses must be an array' });
  }
  const usernames = userStore.getUsernames(walletAddresses);
  res.json({ usernames });
});

// Check if username is available
app.get('/api/username/check/:username', (req, res) => {
  const { username } = req.params;
  const { wallet } = req.query;
  const available = userStore.isUsernameAvailable(username, wallet as string | undefined);
  res.json({ available });
});

// Debug: Check who has a username
app.get('/api/username/lookup/:username', (req, res) => {
  const { username } = req.params;
  const wallet = userStore.getWalletByUsername(username);
  if (wallet) {
    // Only show partial wallet for privacy
    res.json({ 
      taken: true, 
      partialWallet: `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
      fullWallet: wallet // For debugging
    });
  } else {
    res.json({ taken: false });
  }
});

// Set username for a wallet (with signature verification)
app.post('/api/username', strictLimiter, (req, res) => {
  const { walletAddress, username, signature, message } = req.body;
  
  if (!walletAddress || !username) {
    return res.status(400).json({ error: 'walletAddress and username are required' });
  }

  // Validate wallet address format
  try {
    new PublicKey(walletAddress);
  } catch {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }

  // Validate username format (alphanumeric, 3-16 chars)
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-16 alphanumeric characters' });
  }

  // Check if this username (case-insensitive) belongs to this wallet already
  const existingWallet = userStore.getWalletByUsername(username);
  if (existingWallet && existingWallet === walletAddress) {
    // User already has this username (maybe different case), update to new casing
    const result = userStore.setUsername(walletAddress, username);
    return res.json({ success: true, username: result.success ? username : userStore.getUsername(walletAddress) });
  }

  // Verify signature if provided (recommended for production)
  if (signature && message) {
    const isValid = verifyWalletSignature(walletAddress, message, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    console.log(`Verified signature for ${walletAddress} setting username to ${username}`);
  } else {
    // Log warning for unsigned requests
    console.log(`WARN: Unsigned username change for ${walletAddress} -> ${username}`);
  }
  
  const result = userStore.setUsername(walletAddress, username);
  
  if (result.success) {
    res.json({ success: true, username });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

// ============= Stats API Endpoints =============

// Get platform-wide statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = statsStore.getPlatformStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get player statistics
app.get('/api/stats/player/:walletAddress', (req, res) => {
  try {
    const { walletAddress } = req.params;
    const stats = statsStore.getPlayerStats(walletAddress);
    if (!stats) {
      return res.json({ 
        walletAddress,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,
        wagerGamesPlayed: 0,
        netProfit: 0,
        winRate: 0,
      });
    }
    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Get leaderboard
app.get('/api/stats/leaderboard', (req, res) => {
  try {
    const minGames = parseInt(req.query.minGames as string) || 3;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const leaderboard = statsStore.getLeaderboard(minGames, limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get recent games
app.get('/api/stats/games', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const games = statsStore.getRecentGames(limit);
    res.json({ games });
  } catch (error) {
    console.error('Error fetching recent games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get player's game history
app.get('/api/stats/player/:walletAddress/games', (req, res) => {
  try {
    const { walletAddress } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const games = statsStore.getPlayerGames(walletAddress, limit);
    res.json({ games });
  } catch (error) {
    console.error('Error fetching player games:', error);
    res.status(500).json({ error: 'Failed to fetch player games' });
  }
});

// Admin endpoint to reset/fix corrupted stats (recalculate from game history)
// Protected by admin secret key
app.post('/api/admin/reset-stats', (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
    const expectedKey = process.env.ADMIN_SECRET || 'REDACTED_ADMIN_SECRET';
    
    if (adminKey !== expectedKey) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const result = statsStore.resetPlatformStats();
    console.log('Stats reset:', result);
    res.json({ 
      success: true, 
      message: 'Stats recalculated from game history',
      ...result 
    });
  } catch (error) {
    console.error('Error resetting stats:', error);
    res.status(500).json({ error: 'Failed to reset stats' });
  }
});

// Admin endpoint to fix game history records with wrong stake amounts
// (stake tier numbers were stored instead of SOL amounts)
app.post('/api/admin/fix-stakes', (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
    const expectedKey = process.env.ADMIN_SECRET || 'REDACTED_ADMIN_SECRET';
    
    if (adminKey !== expectedKey) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const result = statsStore.fixGameHistoryStakes();
    const newStats = statsStore.getPlatformStats();
    console.log('Stakes fixed:', result);
    res.json({ 
      success: true, 
      message: `Fixed ${result.fixed} game records`,
      ...result,
      newStats,
    });
  } catch (error) {
    console.error('Error fixing stakes:', error);
    res.status(500).json({ error: 'Failed to fix stakes' });
  }
});

// ============= Holder Arena API Endpoints =============

// Get arena status for a wallet (games remaining, cooldown, stats)
app.get('/api/arena/status/:walletAddress', (req, res) => {
  try {
    const { walletAddress } = req.params;
    const stats = arenaStore.getPlayerStats(walletAddress);
    const canPlay = arenaStore.canStartGame(walletAddress);
    res.json({ ...stats, ...canPlay });
  } catch (error) {
    console.error('Error fetching arena status:', error);
    res.status(500).json({ error: 'Failed to fetch arena status' });
  }
});

// Submit arena game result
app.post('/api/arena/result', strictLimiter, (req, res) => {
  try {
    const { walletAddress, result, moveCount, reason, counts } = req.body;
    
    if (!walletAddress || !result) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate result
    if (!['win', 'loss', 'draw'].includes(result)) {
      return res.status(400).json({ error: 'Invalid result' });
    }
    
    // Resignations never count towards leaderboard (anti-abuse)
    const isResignation = reason === 'resignation';
    const shouldCount = counts !== false && !isResignation;
    
    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    
    // Check if player can play (for anti-cheat)
    const canPlayCheck = arenaStore.canStartGame(walletAddress);
    // Allow the result even if cooldown/limit since game already started
    
    // Record the game
    const gameResult = arenaStore.recordGame(
      walletAddress,
      result,
      moveCount || 0,
      shouldCount
    );
    
    console.log(`Arena game recorded: ${walletAddress} - ${result} (${moveCount} moves)`);
    
    res.json(gameResult);
  } catch (error) {
    console.error('Error recording arena result:', error);
    res.status(500).json({ error: 'Failed to record arena result' });
  }
});

// Record arena share for bonus points
app.post('/api/arena/share', strictLimiter, (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }

    const shareResult = arenaStore.recordShare(walletAddress);
    
    if (shareResult.success) {
      console.log(`Arena share recorded: ${walletAddress} +${shareResult.bonusAwarded}`);
    }
    
    res.json(shareResult);
  } catch (error) {
    console.error('Error recording arena share:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

// Get arena leaderboard
app.get('/api/arena/leaderboard', (req, res) => {
  try {
    const walletAddress = req.query.wallet as string | undefined;
    const entries = arenaStore.getLeaderboard(20);
    
    // Get usernames for leaderboard entries
    const wallets = entries.map(e => e.walletAddress);
    const usernames = userStore.getUsernames(wallets);
    
    // Attach usernames to entries
    const entriesWithUsernames = entries.map(entry => ({
      ...entry,
      username: usernames[entry.walletAddress] || undefined,
    }));
    
    // Get user's entry if they're not in top 20
    let userEntry: any = null;
    if (walletAddress) {
      const inTop20 = entries.some(e => e.walletAddress === walletAddress);
      if (!inTop20) {
        userEntry = arenaStore.getPlayerLeaderboardEntry(walletAddress);
        if (userEntry) {
          userEntry.username = usernames[walletAddress] || undefined;
        }
      }
    }
    
    res.json({
      entries: entriesWithUsernames,
      type: 'all-time',
      userEntry,
    });
  } catch (error) {
    console.error('Error fetching arena leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch arena leaderboard' });
  }
});

// Socket.IO connection handling with rate limiting
io.on('connection', (socket) => {
  // Get client IP for connection limiting
  const clientIP = socket.handshake.headers['x-forwarded-for'] as string || 
                   socket.handshake.address || 
                   'unknown';
  const ip = clientIP.split(',')[0].trim(); // Handle proxy chains
  
  // Check connection limit per IP
  if (!connectionsByIP.has(ip)) {
    connectionsByIP.set(ip, new Set());
  }
  const ipConnections = connectionsByIP.get(ip)!;
  
  if (ipConnections.size >= MAX_CONNECTIONS_PER_IP) {
    console.log(`Connection limit exceeded for IP: ${ip}`);
    socket.emit('error', { message: 'Too many connections from your IP' });
    socket.disconnect(true);
    return;
  }
  
  ipConnections.add(socket.id);
  console.log(`Client connected: ${socket.id} from ${ip} (${ipConnections.size}/${MAX_CONNECTIONS_PER_IP})`);

  // Clean up on disconnect
  socket.on('disconnect', () => {
    const ipConns = connectionsByIP.get(ip);
    if (ipConns) {
      ipConns.delete(socket.id);
      if (ipConns.size === 0) {
        connectionsByIP.delete(ip);
      }
    }
  });

  // Player registration
  socket.on('player:register', ({ walletAddress, username }) => {
    // Validate wallet address format (skip validation for guest IDs)
    const isGuest = walletAddress.startsWith('guest_') || walletAddress === 'anonymous';
    if (!isGuest) {
      try {
        new PublicKey(walletAddress);
      } catch {
        socket.emit('error', { message: 'Invalid wallet address' });
        return;
      }
    }
    
    console.log(`Player registering: ${walletAddress}${isGuest ? ' (guest)' : ''}`);
    const player = playerStore.createPlayer(walletAddress, socket.id);
    
    // Update hosted match socket ID if this wallet has an active match
    // This handles reconnection scenarios where the socket ID changes
    if (!isGuest) {
      hostedMatchManager.updateHostSocket(walletAddress, socket.id);
    }
    
    socket.emit('player:registered', {
      playerId: player.id,
      xp: player.xp,
      rank: player.rank,
      gamesPlayed: player.gamesPlayed,
      gamesWon: player.gamesWon,
    });
  });

  // Join matchmaking queue
  socket.on('matchmaking:join', ({ stakeTier }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    if (matchmaking.isPlayerInQueue(player.id)) {
      socket.emit('error', { message: 'Already in queue' });
      return;
    }

    console.log(`Player ${player.id} joining matchmaking for tier ${stakeTier}`);
    matchmaking.addToQueue(player, stakeTier, io);
  });

  // Leave matchmaking queue
  socket.on('matchmaking:leave', () => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      return;
    }

    console.log(`Player ${player.id} leaving matchmaking`);
    matchmaking.removeFromQueue(player.id);
    socket.emit('matchmaking:left');
  });

  // Join game room
  socket.on('game:joinRoom', ({ roomId }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    const success = gameRoomManager.joinRoom(roomId, player.id, socket.id);
    if (!success) {
      socket.emit('error', { message: 'Failed to join room' });
      return;
    }

    const room = gameRoomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    // Join socket room for this game
    socket.join(roomId);

    // Determine player's color
    const isWhite = room.playerWhite.id === player.id;
    const yourColor = isWhite ? 'w' : 'b';
    const opponent = isWhite ? room.playerBlack : room.playerWhite;

    socket.emit('game:joined', {
      roomId,
      yourColor,
      opponent: {
        id: opponent.id,
        walletAddress: opponent.walletAddress,
        rank: opponent.rank,
      },
      stakeTier: room.stakeTier,
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
      currentTurn: room.currentTurn,
      status: room.status,
    });

    // If both players joined, notify game start
    if (room.status === 'active') {
      io.to(roomId).emit('game:start', {
        whiteTimeMs: room.whiteTimeMs,
        blackTimeMs: room.blackTimeMs,
      });
    }
  });

  // Make a move
  socket.on('game:makeMove', ({ roomId, move }: { roomId: string; move: ChessMove }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    const success = gameRoomManager.makeMove(roomId, player.id, move, io);
    if (!success) {
      socket.emit('error', { message: 'Invalid move' });
      return;
    }

    // Echo move confirmation back to sender
    socket.emit('game:moveConfirmed', { move });
  });

  // Handle resignation
  socket.on('game:resign', ({ roomId }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      return;
    }

    console.log(`Player ${player.id} resigned from room ${roomId}`);
    gameRoomManager.handleResignation(roomId, player.id, io);
  });

  // Handle game end (checkmate, draw)
  socket.on('game:end', ({ roomId, winner, reason }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      return;
    }

    console.log(`Game ending in room ${roomId}. Winner: ${winner}, Reason: ${reason}`);
    gameRoomManager.endGame(roomId, winner, reason, io);
  });

  // Spectator joins a wager match
  socket.on('spectator:joinWager', ({ roomId }) => {
    const room = gameRoomManager.getRoom(roomId);
    if (!room) {
      socket.emit('spectator:error', { error: 'Game not found' });
      return;
    }

    if (room.status !== 'active') {
      socket.emit('spectator:error', { error: 'Game is not active' });
      return;
    }

    // Add as spectator
    gameRoomManager.addSpectator(roomId, socket.id);
    
    // Join the socket room to receive broadcasts
    socket.join(roomId);

    // Send current game state to spectator
    socket.emit('spectator:joined', {
      roomId,
      fen: room.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      whitePlayer: room.playerWhite.walletAddress?.slice(0, 8) || 'White',
      blackPlayer: room.playerBlack.walletAddress?.slice(0, 8) || 'Black',
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
      currentTurn: room.currentTurn,
      stakeTier: room.stakeTier,
      moves: room.moves || [],
    });

    // Notify players about spectator count
    const spectatorCount = gameRoomManager.getSpectatorCount(roomId);
    io.to(room.playerWhite.socketId).emit('game:spectatorCount', { count: spectatorCount });
    io.to(room.playerBlack.socketId).emit('game:spectatorCount', { count: spectatorCount });
    
    console.log(`Spectator joined wager match ${roomId}, ${spectatorCount} total spectators`);
  });

  // Spectator leaves a wager match
  socket.on('spectator:leaveWager', ({ roomId }) => {
    gameRoomManager.removeSpectator(roomId, socket.id);
    socket.leave(roomId);
    
    const room = gameRoomManager.getRoom(roomId);
    if (room) {
      const spectatorCount = gameRoomManager.getSpectatorCount(roomId);
      io.to(room.playerWhite.socketId).emit('game:spectatorCount', { count: spectatorCount });
      io.to(room.playerBlack.socketId).emit('game:spectatorCount', { count: spectatorCount });
    }
  });

  // Get queue status
  socket.on('matchmaking:getStatus', () => {
    const status = matchmaking.getAllQueueStatus();
    socket.emit('matchmaking:status', status);
  });

  // ============ HOSTED MATCH EVENTS ============

  // Host a new match
  socket.on('match:host', ({ stakeTier, matchPubkey, joinDeadlineMinutes = 5 }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    console.log(`Player ${player.walletAddress.slice(0, 8)}... hosting match (${stakeTier === 0 ? '0.5' : '1'} SOL)`);
    
    // Derive preferred code from matchPubkey (first 4 chars, uppercase)
    const preferredCode = matchPubkey ? matchPubkey.slice(0, 4).toUpperCase() : undefined;
    
    const match = hostedMatchManager.hostMatch(
      player.walletAddress,
      socket.id,
      stakeTier,
      matchPubkey,
      joinDeadlineMinutes,
      io,
      preferredCode
    );

    socket.emit('match:hosted', {
      matchCode: match.matchCode,
      matchPubkey: match.matchPubkey,
      joinDeadline: match.joinDeadline,
    });
  });

  // Join hosted match by code
  socket.on('match:join', ({ matchCode, guestWallet }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    const walletToUse = guestWallet || player.walletAddress;
    console.log(`Player ${walletToUse.slice(0, 8)}... attempting to join match ${matchCode}`);

    const result = hostedMatchManager.joinMatch(matchCode, walletToUse, socket.id, io);

    if (!result.success) {
      socket.emit('match:joinError', { error: result.error });
      return;
    }

    // Guest joins lobby (waiting for host to start)
    const match = result.match!;
    const guestColor = match.hostColor === 'w' ? 'b' : 'w';
    
    socket.emit('match:joinedLobby', {
      matchCode: match.matchCode,
      hostWallet: match.hostWallet,
      yourColor: guestColor,
      stakeTier: match.stakeTier,
      matchPubkey: match.matchPubkey,
    });
  });

  // Host sets their color preference
  socket.on('match:setColor', ({ matchCode, color }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) return;
    
    hostedMatchManager.setHostColor(matchCode, color, io);
  });

  // Host starts the game
  socket.on('match:startGame', ({ matchCode }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not registered' });
      return;
    }

    const result = hostedMatchManager.startGame(matchCode, socket.id, io);

    if (!result.success) {
      socket.emit('match:startError', { error: result.error });
    }
  });

  // Cancel hosted match
  socket.on('match:cancel', ({ matchCode }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) {
      return;
    }

    const match = hostedMatchManager.searchByCode(matchCode);
    if (match && match.hostWallet === player.walletAddress) {
      hostedMatchManager.cancelMatch(matchCode, io);
      socket.emit('match:cancelled', { matchCode });
    } else {
      socket.emit('error', { message: 'Cannot cancel this match' });
    }
  });

  // Search match by code
  socket.on('match:search', ({ matchCode }) => {
    const match = hostedMatchManager.searchByCode(matchCode);
    if (match && match.status === 'waiting') {
      socket.emit('match:found', {
        matchCode: match.matchCode,
        matchPubkey: match.matchPubkey,
        hostWallet: match.hostWallet,
        stakeTier: match.stakeTier,
        joinDeadline: match.joinDeadline,
      });
    } else {
      socket.emit('match:notFound', { matchCode });
    }
  });

  // Get lobby updates (subscribe)
  socket.on('lobby:subscribe', () => {
    socket.join('lobby');
    const matches = hostedMatchManager.getWaitingMatches().map(m => ({
      matchCode: m.matchCode,
      matchPubkey: m.matchPubkey,
      hostWallet: m.hostWallet,
      stakeTier: m.stakeTier,
      createdAt: m.createdAt,
      joinDeadline: m.joinDeadline,
    }));
    socket.emit('lobby:matches', { matches });
  });

  socket.on('lobby:unsubscribe', () => {
    socket.leave('lobby');
  });

  // ============ FREE PLAY (NO BLOCKCHAIN) EVENTS ============
  
  // Store for free play rooms (in-memory, no persistence needed)
  const freePlayRooms = (global as any).freePlayRooms || new Map<string, { hostSocketId: string; hostWallet: string; guestSocketId?: string; guestWallet?: string }>();
  (global as any).freePlayRooms = freePlayRooms;
  
  // Host a free play game
  socket.on('freeplay:host', ({ walletAddress }) => {
    // Get the player from store to ensure we use the same ID
    const player = playerStore.getPlayerBySocket(socket.id);
    const playerId = player?.id || walletAddress || `host_${socket.id}`;
    
    // Generate a 4-char code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    while (freePlayRooms.has(code)) {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    freePlayRooms.set(code, { hostSocketId: socket.id, hostWallet: playerId });
    console.log(`Free play room created: ${code} by ${playerId?.slice(0, 8) || 'anonymous'}`);
    
    socket.emit('freeplay:hosted', { code });
  });
  
  // Join a free play game
  socket.on('freeplay:join', ({ code, walletAddress }) => {
    // Get the player from store to ensure we use the same ID
    const player = playerStore.getPlayerBySocket(socket.id);
    const playerId = player?.id || walletAddress || `guest_${socket.id}`;
    
    const room = freePlayRooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('freeplay:error', { error: 'Room not found' });
      return;
    }
    
    // If game already started, join as spectator
    if (room.ready) {
      if (!room.spectators) room.spectators = [];
      room.spectators.push(socket.id);
      const spectatorCount = room.spectators.length;
      console.log(`Free play room ${code} - spectator joined (${spectatorCount} spectators)`);
      
      // Send spectator the current game state
      socket.emit('freeplay:spectating', {
        code,
        fen: room.currentFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        hostColor: room.hostColor,
        whitePlayer: room.hostColor === 'w' ? (room.hostWallet?.slice(0, 8) || 'Host') : (room.guestWallet?.slice(0, 8) || 'Guest'),
        blackPlayer: room.hostColor === 'b' ? (room.hostWallet?.slice(0, 8) || 'Host') : (room.guestWallet?.slice(0, 8) || 'Guest'),
      });
      
      // Notify players about updated spectator count
      console.log(`Emitting spectatorCount=${spectatorCount} to host (${room.hostSocketId}) and guest (${room.guestSocketId})`);
      io.to(room.hostSocketId).emit('freeplay:spectatorCount', { count: spectatorCount });
      if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('freeplay:spectatorCount', { count: spectatorCount });
      }
      return;
    }
    
    if (room.guestSocketId) {
      socket.emit('freeplay:error', { error: 'Room is full' });
      return;
    }
    
    room.guestSocketId = socket.id;
    room.guestWallet = playerId;
    room.hostColor = 'w'; // Default: host is white
    room.ready = false; // Not started yet
    
    console.log(`Free play room ${code} - guest ${playerId.slice(0, 8)} joined lobby`);
    
    // Notify host that guest joined (lobby state)
    io.to(room.hostSocketId).emit('freeplay:guestJoined', {
      code,
      guestWallet: playerId !== `guest_${socket.id}` ? playerId : null,
      guest: playerId?.slice(0, 8) || 'Guest',
      hostColor: room.hostColor
    });
    
    // Notify guest they're in the lobby
    socket.emit('freeplay:joinedLobby', {
      code,
      hostWallet: room.hostWallet && !room.hostWallet.startsWith('host_') ? room.hostWallet : null,
      host: room.hostWallet?.slice(0, 8) || 'Host',
      yourColor: 'b'
    });
  });
  
  // Host swaps colors
  socket.on('freeplay:swapColors', ({ code }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (!room || room.hostSocketId !== socket.id || room.ready) return;
    
    room.hostColor = room.hostColor === 'w' ? 'b' : 'w';
    console.log(`Room ${code} - host swapped colors, now ${room.hostColor === 'w' ? 'white' : 'black'}`);
    
    // Notify both players
    io.to(room.hostSocketId).emit('freeplay:colorsUpdated', { hostColor: room.hostColor });
    if (room.guestSocketId) {
      io.to(room.guestSocketId).emit('freeplay:colorsUpdated', { hostColor: room.hostColor });
    }
  });
  
  // Guest requests to swap colors (can request either color)
  socket.on('freeplay:requestSwap', ({ code, wantColor }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (!room || room.guestSocketId !== socket.id || room.ready) return;
    
    console.log(`Room ${code} - guest requesting to play as ${wantColor === 'w' ? 'white' : 'black'}`);
    io.to(room.hostSocketId).emit('freeplay:swapRequest', { code, wantColor });
  });
  
  // Guest requests to be white (legacy - still support it)
  socket.on('freeplay:requestWhite', ({ code }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (!room || room.guestSocketId !== socket.id || room.ready) return;
    
    console.log(`Room ${code} - guest requesting white`);
    io.to(room.hostSocketId).emit('freeplay:swapRequest', { code, wantColor: 'w' });
  });
  
  // Host responds to swap request
  socket.on('freeplay:respondSwapRequest', ({ code, accepted }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (!room || room.hostSocketId !== socket.id || room.ready) return;
    
    if (accepted) {
      room.hostColor = room.hostColor === 'w' ? 'b' : 'w'; // Swap colors
      console.log(`Room ${code} - host accepted swap request, host is now ${room.hostColor === 'w' ? 'white' : 'black'}`);
      io.to(room.hostSocketId).emit('freeplay:colorsUpdated', { hostColor: room.hostColor });
      if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('freeplay:colorsUpdated', { hostColor: room.hostColor });
        io.to(room.guestSocketId).emit('freeplay:swapRequestResponse', { accepted: true });
      }
    } else {
      console.log(`Room ${code} - host declined swap request`);
      if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('freeplay:swapRequestResponse', { accepted: false });
      }
    }
  });
  
  // Host responds to white request (legacy - map to swap response)
  socket.on('freeplay:respondWhiteRequest', ({ code, accepted }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (!room || room.hostSocketId !== socket.id || room.ready) return;
    
    if (accepted) {
      room.hostColor = 'b'; // Host becomes black
      console.log(`Room ${code} - host accepted white request`);
      io.to(room.hostSocketId).emit('freeplay:colorsUpdated', { hostColor: room.hostColor });
      if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('freeplay:colorsUpdated', { hostColor: room.hostColor });
        io.to(room.guestSocketId).emit('freeplay:whiteRequestResponse', { accepted: true });
      }
    } else {
      console.log(`Room ${code} - host declined white request`);
      if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('freeplay:whiteRequestResponse', { accepted: false });
      }
    }
  });
  
  // Host starts the game
  socket.on('freeplay:startGame', ({ code }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (!room || room.hostSocketId !== socket.id || !room.guestSocketId || room.ready) return;
    
    room.ready = true;
    room.currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Initial position
    const roomId = `free_${code}`;
    
    // Determine who is white/black based on hostColor
    const whitePlayer = room.hostColor === 'w' 
      ? { wallet: room.hostWallet, socketId: room.hostSocketId }
      : { wallet: room.guestWallet!, socketId: room.guestSocketId };
    const blackPlayer = room.hostColor === 'w'
      ? { wallet: room.guestWallet!, socketId: room.guestSocketId }
      : { wallet: room.hostWallet, socketId: room.hostSocketId };
    
    // Create game room
    const gameRoom = gameRoomManager.createRoomFromHosted(
      roomId,
      code,
      'FREE_PLAY',
      -1,
      whitePlayer,
      blackPlayer,
      io
    );
    
    console.log(`Free play room ${code} - game started! Host is ${room.hostColor === 'w' ? 'white' : 'black'}`);
    
    // Notify host
    io.to(room.hostSocketId).emit('freeplay:started', {
      roomId,
      yourColor: room.hostColor,
      opponentWallet: room.guestWallet && !room.guestWallet.startsWith('guest_') ? room.guestWallet : null,
      opponent: room.guestWallet?.slice(0, 8) || 'Guest'
    });
    
    // Notify guest
    io.to(room.guestSocketId).emit('freeplay:started', {
      roomId,
      yourColor: room.hostColor === 'w' ? 'b' : 'w',
      opponentWallet: room.hostWallet && !room.hostWallet.startsWith('host_') ? room.hostWallet : null,
      opponent: room.hostWallet?.slice(0, 8) || 'Host'
    });
    
    // Emit game start to both
    io.to(room.hostSocketId).emit('game:start', { whiteTimeMs: 600000, blackTimeMs: 600000 });
    io.to(room.guestSocketId).emit('game:start', { whiteTimeMs: 600000, blackTimeMs: 600000 });
    
    // Note: Don't delete the room - keep it for spectators to join
    // The room will be cleaned up when the game ends or players disconnect
  });
  
  // Cancel free play hosting
  socket.on('freeplay:cancel', ({ code }) => {
    const room = freePlayRooms.get(code?.toUpperCase());
    if (room && room.hostSocketId === socket.id) {
      freePlayRooms.delete(code.toUpperCase());
      console.log(`Free play room ${code} cancelled`);
    }
  });

  // ============ END FREE PLAY EVENTS ============

  // ============ EMOJI REACTIONS ============
  
  // Send emoji reaction to opponent
  socket.on('game:reaction', ({ roomId, emoji }) => {
    // Find the opponent's socket and forward the reaction
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player) return;
    
    // First try to find room by player (works for both wager and free play after room creation)
    let gameRoom = gameRoomManager.getRoomByPlayer(player.id);
    
    // If not found by player, try by roomId (free play rooms use roomId directly)
    if (!gameRoom && roomId) {
      gameRoom = gameRoomManager.getRoom(roomId);
    }
    
    if (gameRoom) {
      const isWhite = gameRoom.playerWhite.id === player.id;
      const opponentSocketId = isWhite ? gameRoom.playerBlack.socketId : gameRoom.playerWhite.socketId;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:reaction', { emoji });
        console.log(`Reaction ${emoji} sent from ${player.id.slice(0, 8)} to opponent`);
      }
    }
  });
  
  // ============ END EMOJI REACTIONS ============

  // ============ CHAT MESSAGES ============
  
  // Send chat message to opponent
  socket.on('game:chat', ({ roomId, message }) => {
    const player = playerStore.getPlayerBySocket(socket.id);
    if (!player || !message || message.trim().length === 0) return;
    
    // Limit message length
    const trimmedMessage = message.trim().slice(0, 200);
    
    // Find room by player or roomId
    let gameRoom = gameRoomManager.getRoomByPlayer(player.id);
    if (!gameRoom && roomId) {
      gameRoom = gameRoomManager.getRoom(roomId);
    }
    
    if (gameRoom) {
      const isWhite = gameRoom.playerWhite.id === player.id;
      const opponentSocketId = isWhite ? gameRoom.playerBlack.socketId : gameRoom.playerWhite.socketId;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:chat', { 
          message: trimmedMessage,
          sender: 'opponent',
          timestamp: Date.now()
        });
        console.log(`Chat from ${player.id.slice(0, 8)}: ${trimmedMessage.slice(0, 30)}...`);
      }
    }
  });
  
  // ============ END CHAT MESSAGES ============

  // ============ END HOSTED MATCH EVENTS ============

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const player = playerStore.getPlayerBySocket(socket.id);
    
    // Handle free play lobby disconnect
    const freePlayRooms = (global as any).freePlayRooms;
    if (freePlayRooms) {
      for (const [code, room] of freePlayRooms.entries()) {
        if (room.hostSocketId === socket.id) {
          // Host left - notify guest if present
          if (room.guestSocketId) {
            io.to(room.guestSocketId).emit('freeplay:hostLeft', { code });
          }
          freePlayRooms.delete(code);
          console.log(`Free play room ${code} deleted - host disconnected`);
        } else if (room.guestSocketId === socket.id) {
          // Guest left - notify host
          io.to(room.hostSocketId).emit('freeplay:guestLeft', { code });
          room.guestSocketId = undefined;
          room.guestWallet = undefined;
          console.log(`Free play room ${code} - guest disconnected`);
        } else if (room.spectators && room.spectators.includes(socket.id)) {
          // Spectator left - remove from list and notify players
          room.spectators = room.spectators.filter((id: string) => id !== socket.id);
          const spectatorCount = room.spectators.length;
          console.log(`Free play room ${code} - spectator left (${spectatorCount} remaining)`);
          io.to(room.hostSocketId).emit('freeplay:spectatorCount', { count: spectatorCount });
          if (room.guestSocketId) {
            io.to(room.guestSocketId).emit('freeplay:spectatorCount', { count: spectatorCount });
          }
        }
      }
    }

    // Clean up wager match spectators
    gameRoomManager.removeSpectatorFromAllRooms(socket.id);
    
    if (player) {
      // Remove from matchmaking
      matchmaking.removeFromQueue(player.id);
      
      // Handle game disconnect
      gameRoomManager.handleDisconnect(player.id, io);
      
      // Handle hosted match disconnect
      hostedMatchManager.handleDisconnect(socket.id, io);
      
      // Clean up player store
      playerStore.removePlayerBySocket(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 SolMate backend server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
  console.log(`🎮 Matchmaking system active`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
