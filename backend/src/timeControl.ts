import { Server as SocketServer } from 'socket.io';

// Forward declaration for type safety
interface GameRoomManagerInterface {
  getRoom(roomId: string): any;
  endGame(roomId: string, winner: string, reason: string, io: SocketServer): void;
}

class TimeControl {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  startRoom(roomId: string, roomManager: GameRoomManagerInterface, io: SocketServer): void {
    // Check time every second
    const interval = setInterval(() => {
      const room = roomManager.getRoom(roomId);
      
      if (!room || room.status !== 'active') {
        this.stopRoom(roomId);
        return;
      }

      const now = Date.now();
      const timeDiff = now - room.lastMoveTime;

      // Update the current player's time
      if (room.currentTurn === 'w') {
        room.whiteTimeMs -= timeDiff;
      } else {
        room.blackTimeMs -= timeDiff;
      }

      room.lastMoveTime = now;

      // Check for timeout
      if (room.whiteTimeMs <= 0) {
        roomManager.endGame(roomId, 'b', 'timeout', io);
        this.stopRoom(roomId);
        return;
      }

      if (room.blackTimeMs <= 0) {
        roomManager.endGame(roomId, 'w', 'timeout', io);
        this.stopRoom(roomId);
        return;
      }

      // Broadcast time update to both players
      const timeUpdate = {
        whiteTimeMs: Math.max(0, room.whiteTimeMs),
        blackTimeMs: Math.max(0, room.blackTimeMs),
        currentTurn: room.currentTurn,
      };

      io.to(room.playerWhite.socketId).emit('game:timeUpdate', timeUpdate);
      io.to(room.playerBlack.socketId).emit('game:timeUpdate', timeUpdate);
    }, 1000); // Update every second

    this.timers.set(roomId, interval);
    console.log(`Time control started for room ${roomId}`);
  }

  stopRoom(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(roomId);
      console.log(`Time control stopped for room ${roomId}`);
    }
  }

  stopAll(): void {
    for (const [roomId, timer] of this.timers.entries()) {
      clearInterval(timer);
      console.log(`Time control stopped for room ${roomId}`);
    }
    this.timers.clear();
  }
}

export const timeControl = new TimeControl();
