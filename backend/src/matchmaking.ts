import { v4 as uuidv4 } from 'uuid';
import { MatchmakingRequest, Player } from './types';
import { Server as SocketServer } from 'socket.io';
import { gameRoomManager } from './gameRoom';

class Matchmaking {
  private queues: Map<number, MatchmakingRequest[]> = new Map();
  
  constructor() {
    // Initialize queues for each stake tier
    for (let tier = 0; tier <= 3; tier++) {
      this.queues.set(tier, []);
    }
  }

  addToQueue(player: Player, stakeTier: number, io: SocketServer): void {
    const request: MatchmakingRequest = {
      playerId: player.id,
      stakeTier,
      walletAddress: player.walletAddress,
      timestamp: Date.now(),
    };

    const queue = this.queues.get(stakeTier);
    if (!queue) {
      console.error(`Invalid stake tier: ${stakeTier}`);
      return;
    }

    // Check if player already in queue
    const existingIndex = queue.findIndex(r => r.playerId === player.id);
    if (existingIndex !== -1) {
      console.log(`Player ${player.id} already in queue for tier ${stakeTier}`);
      return;
    }

    queue.push(request);
    console.log(`Player ${player.id} joined matchmaking queue for tier ${stakeTier}. Queue size: ${queue.length}`);

    // Emit queue status to player
    io.to(player.socketId).emit('matchmaking:queued', {
      stakeTier,
      queuePosition: queue.length,
      queueSize: queue.length,
    });

    // Try to match immediately
    this.tryMatch(stakeTier, io);
  }

  removeFromQueue(playerId: string, stakeTier?: number): void {
    if (stakeTier !== undefined) {
      const queue = this.queues.get(stakeTier);
      if (queue) {
        const index = queue.findIndex(r => r.playerId === playerId);
        if (index !== -1) {
          queue.splice(index, 1);
          console.log(`Player ${playerId} removed from tier ${stakeTier} queue`);
        }
      }
    } else {
      // Remove from all queues
      for (const [tier, queue] of this.queues.entries()) {
        const index = queue.findIndex(r => r.playerId === playerId);
        if (index !== -1) {
          queue.splice(index, 1);
          console.log(`Player ${playerId} removed from tier ${tier} queue`);
        }
      }
    }
  }

  private tryMatch(stakeTier: number, io: SocketServer): void {
    const queue = this.queues.get(stakeTier);
    if (!queue || queue.length < 2) {
      return;
    }

    // Match first two players in queue
    const [player1Request, player2Request] = queue.splice(0, 2);
    
    console.log(`Matching players: ${player1Request.playerId} vs ${player2Request.playerId} at tier ${stakeTier}`);

    // Create game room
    const roomId = uuidv4();
    gameRoomManager.createRoom(roomId, player1Request, player2Request, io);

    // Notify both players
    io.emit('matchmaking:matched', {
      roomId,
      stakeTier,
      player1: player1Request.playerId,
      player2: player2Request.playerId,
    });
  }

  getQueueStatus(stakeTier: number): number {
    const queue = this.queues.get(stakeTier);
    return queue ? queue.length : 0;
  }

  getAllQueueStatus(): { tier: number; count: number }[] {
    const status: { tier: number; count: number }[] = [];
    for (let tier = 0; tier <= 3; tier++) {
      status.push({
        tier,
        count: this.getQueueStatus(tier),
      });
    }
    return status;
  }

  isPlayerInQueue(playerId: string): boolean {
    for (const queue of this.queues.values()) {
      if (queue.some(r => r.playerId === playerId)) {
        return true;
      }
    }
    return false;
  }
}

export const matchmaking = new Matchmaking();
