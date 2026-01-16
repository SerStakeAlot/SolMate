import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { playerStore } from './playerStore';
import { matchmaking } from './matchmaking';
import { gameRoomManager } from './gameRoom';
import { hostedMatchManager } from './hostedMatch';
import { ChessMove } from './types';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

// Health check endpoint
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

// Register a new match (POST /api/matches)
app.post('/api/matches', (req, res) => {
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Player registration
  socket.on('player:register', ({ walletAddress, username }) => {
    console.log(`Player registering: ${walletAddress}`);
    const player = playerStore.createPlayer(walletAddress, socket.id);
    
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

    const room = gameRoomManager.getRoom(result.roomId!);
    if (!room) {
      socket.emit('match:joinError', { error: 'Room creation failed' });
      return;
    }

    // Join socket room
    socket.join(result.roomId!);

    // Determine player's color
    const isWhite = room.playerWhite.walletAddress === walletToUse;

    socket.emit('match:joined', {
      matchCode: result.match!.matchCode,
      roomId: result.roomId,
      yourColor: isWhite ? 'w' : 'b',
      opponent: {
        walletAddress: isWhite ? room.playerBlack.walletAddress : room.playerWhite.walletAddress,
      },
      stakeTier: room.stakeTier,
      matchPubkey: result.match!.matchPubkey,
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
    });

    // Notify the room to start the game (host needs to join socket room)
    const hostSocketId = result.match!.hostSocketId;
    const hostSocket = io.sockets.sockets.get(hostSocketId);
    if (hostSocket) {
      hostSocket.join(result.roomId!);
    }

    // Emit game start to both players
    io.to(result.roomId!).emit('game:start', {
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
    });
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
    
    freePlayRooms.set(code, { hostSocketId: socket.id, hostWallet: walletAddress });
    console.log(`Free play room created: ${code} by ${walletAddress?.slice(0, 8) || 'anonymous'}`);
    
    socket.emit('freeplay:hosted', { code });
  });
  
  // Join a free play game
  socket.on('freeplay:join', ({ code, walletAddress }) => {
    const room = freePlayRooms.get(code.toUpperCase());
    if (!room) {
      socket.emit('freeplay:error', { error: 'Room not found' });
      return;
    }
    if (room.guestSocketId) {
      socket.emit('freeplay:error', { error: 'Room is full' });
      return;
    }
    
    room.guestSocketId = socket.id;
    room.guestWallet = walletAddress;
    
    // Create a simple game room ID
    const roomId = `free_${code}`;
    
    // Create game room for free play
    const gameRoom = gameRoomManager.createRoomFromHosted(
      roomId,
      code,
      'FREE_PLAY', // No match pubkey
      -1, // Free tier indicator
      { wallet: room.hostWallet || 'host', socketId: room.hostSocketId },
      { wallet: walletAddress || 'guest', socketId: socket.id },
      io
    );
    
    console.log(`Free play room ${code} - guest joined. Room: ${roomId}`);
    
    // Notify host
    io.to(room.hostSocketId).emit('freeplay:started', {
      roomId,
      yourColor: 'w',
      opponent: walletAddress?.slice(0, 8) || 'Guest'
    });
    
    // Notify guest
    socket.emit('freeplay:started', {
      roomId,
      yourColor: 'b',
      opponent: room.hostWallet?.slice(0, 8) || 'Host'
    });
    
    // Emit game start to both
    io.to(room.hostSocketId).emit('game:start', { whiteTimeMs: 600000, blackTimeMs: 600000 });
    socket.emit('game:start', { whiteTimeMs: 600000, blackTimeMs: 600000 });
    
    // Clean up the free play room listing (game has started)
    freePlayRooms.delete(code.toUpperCase());
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

  // ============ END HOSTED MATCH EVENTS ============

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const player = playerStore.getPlayerBySocket(socket.id);
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
