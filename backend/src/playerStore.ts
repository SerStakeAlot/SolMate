import { Player, calculateRank } from './types';

class PlayerStore {
  private players: Map<string, Player> = new Map();
  private socketToPlayer: Map<string, string> = new Map();

  createPlayer(walletAddress: string, socketId: string): Player {
    const playerId = walletAddress;
    
    // Check if player already exists
    let player = this.players.get(playerId);
    
    if (player) {
      // Update socket ID for reconnection
      const oldSocketId = player.socketId;
      if (oldSocketId) {
        this.socketToPlayer.delete(oldSocketId);
      }
      player.socketId = socketId;
    } else {
      // Create new player
      player = {
        id: playerId,
        walletAddress,
        socketId,
        xp: 0,
        rank: 'Novice',
        gamesPlayed: 0,
        gamesWon: 0,
      };
      this.players.set(playerId, player);
    }
    
    this.socketToPlayer.set(socketId, playerId);
    return player;
  }

  getPlayerById(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    const playerId = this.socketToPlayer.get(socketId);
    return playerId ? this.players.get(playerId) : undefined;
  }

  updatePlayerXP(playerId: string, xpGain: number): void {
    const player = this.players.get(playerId);
    if (player) {
      player.xp += xpGain;
      player.rank = calculateRank(player.xp);
    }
  }

  recordGameResult(playerId: string, won: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.gamesPlayed++;
      if (won) {
        player.gamesWon++;
      }
    }
  }

  setPlayerRoom(playerId: string, roomId: string | undefined): void {
    const player = this.players.get(playerId);
    if (player) {
      player.currentRoomId = roomId;
    }
  }

  removePlayerBySocket(socketId: string): void {
    const playerId = this.socketToPlayer.get(socketId);
    if (playerId) {
      const player = this.players.get(playerId);
      if (player && !player.currentRoomId) {
        // Only remove if not in a game
        this.players.delete(playerId);
      }
      this.socketToPlayer.delete(socketId);
    }
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}

export const playerStore = new PlayerStore();
