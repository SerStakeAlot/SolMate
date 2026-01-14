import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { playerStore } from './playerStore';
import { matchmaking } from './matchmaking';
import { gameRoomManager } from './gameRoom';
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
  });
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

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const player = playerStore.getPlayerBySocket(socket.id);
    if (player) {
      // Remove from matchmaking
      matchmaking.removeFromQueue(player.id);
      
      // Handle game disconnect
      gameRoomManager.handleDisconnect(player.id, io);
      
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
