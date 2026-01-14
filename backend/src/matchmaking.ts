import { v4 as uuidv4 } from 'uuid';
import { MatchmakingRequest, Player, getSkillTier, canMatchPlayers, SkillTier } from './types';
import { Server as SocketServer } from 'socket.io';
import { gameRoomManager } from './gameRoom';
import { playerStore } from './playerStore';

class Matchmaking {
  private queues: Map<number, MatchmakingRequest[]> = new Map();
  
  constructor() {
    // Initialize queues for each stake tier
    for (let tier = 0; tier <= 3; tier++) {
      this.queues.set(tier, []);
    }
  }

  addToQueue(player: Player, stakeTier: number, io: SocketServer): void {
    const skillTier = getSkillTier(player);
    
    const request: MatchmakingRequest = {
      playerId: player.id,
      stakeTier,
      walletAddress: player.walletAddress,
      timestamp: Date.now(),
      skillTier,
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
    console.log(`Player ${player.id} (${skillTier}) joined matchmaking queue for tier ${stakeTier}. Queue size: ${queue.length}`);

    // Emit queue status to player
    io.to(player.socketId).emit('matchmaking:queued', {
      stakeTier,
      skillTier,
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

    // Skill-based matching: find compatible players
    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const request1 = queue[i];
        const request2 = queue[j];
        
        const player1 = playerStore.getPlayerById(request1.playerId);
        const player2 = playerStore.getPlayerById(request2.playerId);
        
        if (!player1 || !player2) continue;
        
        // Check if players can be matched based on skill
        if (canMatchPlayers(player1, player2)) {
          // Remove both from queue
          queue.splice(j, 1);
          queue.splice(i, 1);
          
          console.log(`Skill-based match: ${request1.playerId} (${request1.skillTier}) vs ${request2.playerId} (${request2.skillTier}) at tier ${stakeTier}`);

          // Create game room
          const roomId = uuidv4();
          gameRoomManager.createRoom(roomId, request1, request2, io);

          // Notify both players
          io.emit('matchmaking:matched', {
            roomId,
            stakeTier,
            player1: request1.playerId,
            player2: request2.playerId,
            player1Skill: request1.skillTier,
            player2Skill: request2.skillTier,
          });
          
          return;
        }
      }
    }
    
    // If no skill-compatible match found and queue has been waiting, 
    // allow any match after 30 seconds
    const now = Date.now();
    const oldestRequest = queue[0];
    if (oldestRequest && now - oldestRequest.timestamp > 30000 && queue.length >= 2) {
      const [player1Request, player2Request] = queue.splice(0, 2);
      
      console.log(`Fallback match (waited 30s): ${player1Request.playerId} vs ${player2Request.playerId} at tier ${stakeTier}`);

      const roomId = uuidv4();
      gameRoomManager.createRoom(roomId, player1Request, player2Request, io);

      io.emit('matchmaking:matched', {
        roomId,
        stakeTier,
        player1: player1Request.playerId,
        player2: player2Request.playerId,
        fallbackMatch: true,
      });
    }
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
