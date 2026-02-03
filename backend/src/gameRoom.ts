import { GameRoom, ChessMove, TimeUpdate, GAME_DURATION_MS } from './types';
import { Server as SocketServer } from 'socket.io';
import { timeControl } from './timeControl';
import { playerStore } from './playerStore';
import { statsStore } from './statsStore';
import { Chess } from 'chess.js';

class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  createRoom(
    roomId: string,
    player1Request: any,
    player2Request: any,
    io: SocketServer
  ): GameRoom {
    // Randomly assign colors
    const whiteFirst = Math.random() < 0.5;
    const whitePlayerId = whiteFirst ? player1Request.playerId : player2Request.playerId;
    const blackPlayerId = whiteFirst ? player2Request.playerId : player1Request.playerId;

    const room: GameRoom = {
      id: roomId,
      stakeTier: player1Request.stakeTier,
      playerWhite: {
        id: whitePlayerId,
        walletAddress: whiteFirst ? player1Request.walletAddress : player2Request.walletAddress,
        socketId: '', // Will be set when players join room
        xp: 0,
        rank: 'Novice',
        gamesPlayed: 0,
        gamesWon: 0,
        solProfit: 0,
        totalWagered: 0,
      },
      playerBlack: {
        id: blackPlayerId,
        walletAddress: whiteFirst ? player2Request.walletAddress : player1Request.walletAddress,
        socketId: '',
        xp: 0,
        rank: 'Novice',
        gamesPlayed: 0,
        gamesWon: 0,
        solProfit: 0,
        totalWagered: 0,
      },
      whiteTimeMs: GAME_DURATION_MS,
      blackTimeMs: GAME_DURATION_MS,
      currentTurn: 'w',
      startTime: Date.now(),
      lastMoveTime: Date.now(),
      moves: [],
      status: 'waiting',
    };

    this.rooms.set(roomId, room);
    this.playerToRoom.set(whitePlayerId, roomId);
    this.playerToRoom.set(blackPlayerId, roomId);

    console.log(`Game room ${roomId} created: ${whitePlayerId} (white) vs ${blackPlayerId} (black)`);

    // Start the time control for this room
    timeControl.startRoom(roomId, this, io);

    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByPlayer(playerId: string): GameRoom | undefined {
    const roomId = this.playerToRoom.get(playerId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  joinRoom(roomId: string, playerId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    if (room.playerWhite.id === playerId) {
      room.playerWhite.socketId = socketId;
    } else if (room.playerBlack.id === playerId) {
      room.playerBlack.socketId = socketId;
    } else {
      return false;
    }

    // Check if both players have joined
    if (room.playerWhite.socketId && room.playerBlack.socketId && room.status === 'waiting') {
      room.status = 'active';
      room.startTime = Date.now();
      room.lastMoveTime = Date.now();
      console.log(`Game room ${roomId} is now active`);
    }

    return true;
  }

  makeMove(roomId: string, playerId: string, move: ChessMove, io: SocketServer): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'active') {
      return false;
    }

    // Verify it's the player's turn
    const isWhiteTurn = room.currentTurn === 'w';
    const isWhitePlayer = room.playerWhite.id === playerId;

    if (isWhiteTurn !== isWhitePlayer) {
      console.log(`Invalid move: Not player's turn. Room: ${roomId}, Player: ${playerId}`);
      return false;
    }

    // Start time control on first move
    const now = Date.now();
    if (!room.gameStarted) {
      room.gameStarted = true;
      room.lastMoveTime = now;
      timeControl.startRoom(roomId, this, io);
      console.log(`Time control started for room ${roomId} (first move)`);
    }

    // Update time
    const timeDiff = now - room.lastMoveTime;

    if (room.currentTurn === 'w') {
      room.whiteTimeMs -= timeDiff;
    } else {
      room.blackTimeMs -= timeDiff;
    }

    room.lastMoveTime = now;

    // Check for timeout
    if (room.whiteTimeMs <= 0 || room.blackTimeMs <= 0) {
      this.endGame(roomId, room.whiteTimeMs <= 0 ? 'b' : 'w', 'timeout', io);
      return false;
    }

    // Record move
    room.moves.push(move.san);
    room.currentTurn = room.currentTurn === 'w' ? 'b' : 'w';
    room.currentFen = move.fen; // Track current position for spectators

    console.log(`Move made in room ${roomId}: ${move.san}. Total moves: ${room.moves.length}`);

    // Check for game end (checkmate, stalemate, draw) using the FEN from the move
    const chess = new Chess(move.fen);
    if (chess.isCheckmate()) {
      // The player who just moved wins (opponent is in checkmate)
      const winner = isWhitePlayer ? 'w' : 'b';
      console.log(`Checkmate detected in room ${roomId}! Winner: ${winner}`);
      this.endGame(roomId, winner, 'checkmate', io);
      return true;
    }
    if (chess.isStalemate() || chess.isDraw()) {
      console.log(`Draw detected in room ${roomId}`);
      this.endGame(roomId, 'draw', chess.isStalemate() ? 'stalemate' : 'draw', io);
      return true;
    }

    // Broadcast move to opponent
    const opponentSocketId = isWhitePlayer ? room.playerBlack.socketId : room.playerWhite.socketId;
    io.to(opponentSocketId).emit('game:move', {
      move,
      timeUpdate: {
        whiteTimeMs: room.whiteTimeMs,
        blackTimeMs: room.blackTimeMs,
        currentTurn: room.currentTurn,
      },
    });
    
    // Broadcast to spectators for wager matches
    if (room.spectators && room.spectators.length > 0) {
      for (const spectatorId of room.spectators) {
        io.to(spectatorId).emit('spectator:move', { 
          move, 
          fen: move.fen,
          timeUpdate: {
            whiteTimeMs: room.whiteTimeMs,
            blackTimeMs: room.blackTimeMs,
            currentTurn: room.currentTurn,
          },
        });
      }
      console.log(`Broadcasted move to ${room.spectators.length} spectators in room ${roomId}`);
    }
    
    // Broadcast to spectators for free play games
    if (roomId.startsWith('free_')) {
      const code = roomId.replace('free_', '');
      const freePlayRooms = (global as any).freePlayRooms;
      if (freePlayRooms) {
        const freeRoom = freePlayRooms.get(code);
        if (freeRoom) {
          freeRoom.currentFen = move.fen;
          if (freeRoom.spectators && freeRoom.spectators.length > 0) {
            for (const spectatorId of freeRoom.spectators) {
              io.to(spectatorId).emit('spectator:move', { move, fen: move.fen });
            }
          }
        }
      }
    }

    return true;
  }

  endGame(roomId: string, winner: 'w' | 'b' | 'draw', reason: string, io: SocketServer): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    room.status = 'finished';
    room.winner = winner;
    room.endReason = reason as any;

    console.log(`Game room ${roomId} ended. Winner: ${winner}, Reason: ${reason}`);

    // Stop time control
    timeControl.stopRoom(roomId);

    // Calculate game duration
    const durationSeconds = Math.round((Date.now() - room.startTime) / 1000);

    // Record to stats database
    try {
      // stakeTier can be a number or 'free' string from free play
      const tierValue = room.stakeTier;
      
      // Map stake tier number to actual SOL amount
      // Tiers: 4 = 0.05 SOL, 5 = 0.1 SOL, 0 = 0.5 SOL, 1 = 1 SOL
      const TIER_TO_SOL: Record<number, number> = {
        4: 0.05,
        5: 0.1,
        0: 0.5,
        1: 1.0,
      };
      
      const stakeAmount = typeof tierValue === 'string' ? 0 : 
                          (TIER_TO_SOL[tierValue] || 0);
      
      const result = winner === 'w' ? 'white' : winner === 'b' ? 'black' : 'draw';
      const winnerWallet = winner === 'w' ? room.playerWhite.walletAddress :
                          winner === 'b' ? room.playerBlack.walletAddress : null;

      statsStore.recordGame({
        gameId: roomId,
        whiteWallet: room.playerWhite.walletAddress,
        blackWallet: room.playerBlack.walletAddress,
        winnerWallet,
        result: result as 'white' | 'black' | 'draw',
        stakeAmount,
        matchPubkey: room.matchPubkey,
        durationSeconds,
        totalMoves: room.moves.length,
      });
    } catch (error) {
      console.error('Failed to record game stats:', error);
    }

    // Record game results for skill-based matchmaking
    if (winner !== 'draw') {
      const winnerId = winner === 'w' ? room.playerWhite.id : room.playerBlack.id;
      const loserId = winner === 'w' ? room.playerBlack.id : room.playerWhite.id;
      
      playerStore.recordGameResult(winnerId, true, room.stakeTier);
      playerStore.recordGameResult(loserId, false, room.stakeTier);
    } else {
      // Draw - no profit/loss, just record games played
      playerStore.recordGameResult(room.playerWhite.id, false);
      playerStore.recordGameResult(room.playerBlack.id, false);
    }

    // Notify both players
    io.to(room.playerWhite.socketId).emit('game:end', {
      winner,
      reason,
      yourColor: 'w',
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
    });

    io.to(room.playerBlack.socketId).emit('game:end', {
      winner,
      reason,
      yourColor: 'b',
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
    });
    
    // Notify spectators for wager matches
    if (room.spectators && room.spectators.length > 0) {
      for (const spectatorId of room.spectators) {
        io.to(spectatorId).emit('spectator:gameEnd', { winner, reason });
      }
      console.log(`Notified ${room.spectators.length} spectators of game end in room ${roomId}`);
    }
    
    // Notify spectators for free play games
    if (roomId.startsWith('free_')) {
      const code = roomId.replace('free_', '');
      const freePlayRooms = (global as any).freePlayRooms;
      if (freePlayRooms) {
        const freeRoom = freePlayRooms.get(code);
        if (freeRoom && freeRoom.spectators && freeRoom.spectators.length > 0) {
          for (const spectatorId of freeRoom.spectators) {
            io.to(spectatorId).emit('spectator:gameEnd', { winner, reason });
          }
        }
      }
    }

    // Clean up after a delay
    setTimeout(() => {
      this.removeRoom(roomId);
    }, 60000); // Keep room for 1 minute for data retrieval
  }

  handleResignation(roomId: string, playerId: string, io: SocketServer): void {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'active') {
      return;
    }

    const isWhite = room.playerWhite.id === playerId;
    const winner = isWhite ? 'b' : 'w';

    this.endGame(roomId, winner, 'resignation', io);
  }

  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.playerToRoom.delete(room.playerWhite.id);
      this.playerToRoom.delete(room.playerBlack.id);
      this.rooms.delete(roomId);
      console.log(`Game room ${roomId} removed`);
    }
  }

  handleDisconnect(playerId: string, io: SocketServer): void {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'active') {
      return;
    }

    const isWhite = room.playerWhite.id === playerId;
    const winner = isWhite ? 'b' : 'w';
    
    // Give player 30 seconds to reconnect before declaring abandonment
    const disconnectDelay = 30000;
    
    console.log(`Player ${playerId.slice(0, 8)} disconnected from room ${roomId}. Waiting ${disconnectDelay/1000}s for reconnect...`);

    setTimeout(() => {
      const currentRoom = this.rooms.get(roomId);
      if (currentRoom && currentRoom.status === 'active') {
        console.log(`Player did not reconnect. ${winner === 'w' ? 'White' : 'Black'} wins by abandonment.`);
        this.endGame(roomId, winner, 'abandonment', io);
      }
    }, disconnectDelay);
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  getActiveRoomCount(): number {
    return Array.from(this.rooms.values()).filter(r => r.status === 'active').length;
  }

  // Add a spectator to a wager room
  addSpectator(roomId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    if (!room.spectators) {
      room.spectators = [];
    }

    // Prevent duplicate spectators
    if (!room.spectators.includes(socketId)) {
      room.spectators.push(socketId);
      console.log(`Spectator ${socketId} joined wager room ${roomId} (${room.spectators.length} spectators)`);
    }
    return true;
  }

  // Remove a spectator from a wager room
  removeSpectator(roomId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.spectators) {
      return;
    }

    room.spectators = room.spectators.filter(id => id !== socketId);
    console.log(`Spectator ${socketId} left wager room ${roomId} (${room.spectators.length} spectators remaining)`);
  }

  // Remove spectator from all rooms (on disconnect)
  removeSpectatorFromAllRooms(socketId: string): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.spectators && room.spectators.includes(socketId)) {
        this.removeSpectator(roomId, socketId);
      }
    }
  }

  // Get spectator count for a room
  getSpectatorCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room?.spectators?.length || 0;
  }

  // Create room from hosted match (already has colors assigned)
  createRoomFromHosted(
    roomId: string,
    matchCode: string,
    matchPubkey: string,
    stakeTier: number,
    white: { wallet: string; socketId: string },
    black: { wallet: string; socketId: string },
    io: SocketServer
  ): GameRoom {
    const room: GameRoom = {
      id: roomId,
      matchCode,
      matchPubkey,
      stakeTier,
      playerWhite: {
        id: white.wallet,
        walletAddress: white.wallet,
        socketId: white.socketId,
        xp: 0,
        rank: 'Novice',
        gamesPlayed: 0,
        gamesWon: 0,
        solProfit: 0,
        totalWagered: 0,
      },
      playerBlack: {
        id: black.wallet,
        walletAddress: black.wallet,
        socketId: black.socketId,
        xp: 0,
        rank: 'Novice',
        gamesPlayed: 0,
        gamesWon: 0,
        solProfit: 0,
        totalWagered: 0,
      },
      whiteTimeMs: GAME_DURATION_MS,
      blackTimeMs: GAME_DURATION_MS,
      currentTurn: 'w',
      startTime: Date.now(),
      lastMoveTime: Date.now(),
      moves: [],
      status: 'active', // Game is active but time doesn't start until first move
      gameStarted: false, // Track if clock has started
    };

    this.rooms.set(roomId, room);
    this.playerToRoom.set(white.wallet, roomId);
    this.playerToRoom.set(black.wallet, roomId);

    console.log(`Hosted game room ${roomId} created from match ${matchCode}: ${white.wallet.slice(0, 8)}... (white) vs ${black.wallet.slice(0, 8)}... (black)`);

    // Don't start time control yet - it starts on first move

    return room;
  }
}

export const gameRoomManager = new GameRoomManager();
