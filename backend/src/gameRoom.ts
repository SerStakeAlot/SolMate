import { GameRoom, ChessMove, TimeUpdate, GAME_DURATION_MS } from './types';
import { Server as SocketServer } from 'socket.io';
import { timeControl } from './timeControl';

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
      },
      playerBlack: {
        id: blackPlayerId,
        walletAddress: whiteFirst ? player2Request.walletAddress : player1Request.walletAddress,
        socketId: '',
        xp: 0,
        rank: 'Novice',
        gamesPlayed: 0,
        gamesWon: 0,
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

    // Update time
    const now = Date.now();
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

    console.log(`Move made in room ${roomId}: ${move.san}. Total moves: ${room.moves.length}`);

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

    // Give player 30 seconds to reconnect
    setTimeout(() => {
      const currentRoom = this.rooms.get(roomId);
      if (currentRoom && currentRoom.status === 'active') {
        const isWhite = currentRoom.playerWhite.id === playerId;
        const winner = isWhite ? 'b' : 'w';
        this.endGame(roomId, winner, 'resignation', io);
      }
    }, 30000);
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  getActiveRoomCount(): number {
    return Array.from(this.rooms.values()).filter(r => r.status === 'active').length;
  }
}

export const gameRoomManager = new GameRoomManager();
