import { Player, calculateRank, getSkillTier } from './types';

// Stake amounts in SOL for each tier
const STAKE_AMOUNTS = [0.5, 1.0]; // tier 0 = 0.5 SOL, tier 1 = 1 SOL

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
        solProfit: 0,
        totalWagered: 0,
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

  recordGameResult(playerId: string, won: boolean, stakeTier?: number): void {
    const player = this.players.get(playerId);
    if (player) {
      player.gamesPlayed++;
      if (won) {
        player.gamesWon++;
      }
      
      // Update SOL profit if stake tier provided
      if (stakeTier !== undefined) {
        const stakeAmount = STAKE_AMOUNTS[stakeTier] || 0.5;
        player.totalWagered += stakeAmount;
        
        if (won) {
          // Winner gets 90% of pot (2 players), so profit is ~0.8x stake (after 10% fee)
          player.solProfit += stakeAmount * 0.8;
        } else {
          // Loser loses their stake
          player.solProfit -= stakeAmount;
        }
        
        console.log(`Player ${playerId} ${won ? 'won' : 'lost'}. SOL Profit: ${player.solProfit.toFixed(2)}, Skill Tier: ${getSkillTier(player)}`);
      }
    }
  }

  getPlayerStats(playerId: string): { solProfit: number; skillTier: string; gamesPlayed: number } | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    
    return {
      solProfit: player.solProfit,
      skillTier: getSkillTier(player),
      gamesPlayed: player.gamesPlayed,
    };
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
