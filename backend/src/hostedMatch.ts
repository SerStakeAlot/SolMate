import { v4 as uuidv4 } from 'uuid';
import { Server as SocketServer } from 'socket.io';
import { HostedMatch, Player, GAME_DURATION_MS } from './types';
import { gameRoomManager } from './gameRoom';

// Generate a random 4-letter code (uppercase)
function generateMatchCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

class HostedMatchManager {
  private matches: Map<string, HostedMatch> = new Map(); // matchCode -> HostedMatch
  private walletToMatch: Map<string, string> = new Map(); // walletAddress -> matchCode
  private pubkeyToCode: Map<string, string> = new Map(); // matchPubkey -> matchCode

  // Host a new match
  hostMatch(
    hostWallet: string,
    hostSocketId: string,
    stakeTier: number,
    matchPubkey: string,
    joinDeadlineMinutes: number,
    io: SocketServer
  ): HostedMatch {
    // Check if host already has an active match
    const existingCode = this.walletToMatch.get(hostWallet);
    if (existingCode) {
      const existing = this.matches.get(existingCode);
      if (existing && existing.status === 'waiting') {
        // Cancel the old one
        this.cancelMatch(existingCode, io);
      }
    }

    // Generate unique match code
    let matchCode = generateMatchCode();
    while (this.matches.has(matchCode)) {
      matchCode = generateMatchCode();
    }

    const match: HostedMatch = {
      matchCode,
      matchPubkey,
      hostWallet,
      hostSocketId,
      stakeTier,
      createdAt: Date.now(),
      joinDeadline: Date.now() + joinDeadlineMinutes * 60 * 1000,
      status: 'waiting',
    };

    this.matches.set(matchCode, match);
    this.walletToMatch.set(hostWallet, matchCode);
    this.pubkeyToCode.set(matchPubkey, matchCode);

    console.log(`Match hosted: ${matchCode} by ${hostWallet.slice(0, 8)}... (${stakeTier === 0 ? '0.5' : '1'} SOL)`);

    // Broadcast new match to all connected clients
    io.emit('lobby:newMatch', {
      matchCode,
      matchPubkey,
      hostWallet,
      stakeTier,
      joinDeadline: match.joinDeadline,
    });

    return match;
  }

  // Join a hosted match
  joinMatch(
    matchCode: string,
    guestWallet: string,
    guestSocketId: string,
    io: SocketServer
  ): { success: boolean; match?: HostedMatch; roomId?: string; error?: string } {
    const match = this.matches.get(matchCode.toUpperCase());
    
    if (!match) {
      return { success: false, error: 'Match not found' };
    }

    if (match.status !== 'waiting') {
      return { success: false, error: 'Match is no longer available' };
    }

    if (Date.now() > match.joinDeadline) {
      return { success: false, error: 'Match has expired' };
    }

    if (match.hostWallet === guestWallet) {
      return { success: false, error: 'Cannot join your own match' };
    }

    // Update match
    match.guestWallet = guestWallet;
    match.guestSocketId = guestSocketId;
    match.status = 'active';

    // Create game room
    const roomId = uuidv4();
    match.roomId = roomId;

    // Randomly assign colors
    const hostIsWhite = Math.random() < 0.5;
    const whiteWallet = hostIsWhite ? match.hostWallet : guestWallet;
    const blackWallet = hostIsWhite ? guestWallet : match.hostWallet;
    const whiteSocketId = hostIsWhite ? match.hostSocketId : guestSocketId;
    const blackSocketId = hostIsWhite ? guestSocketId : match.hostSocketId;

    const room = gameRoomManager.createRoomFromHosted(
      roomId,
      match.matchCode,
      match.matchPubkey,
      match.stakeTier,
      { wallet: whiteWallet, socketId: whiteSocketId },
      { wallet: blackWallet, socketId: blackSocketId },
      io
    );

    console.log(`Match ${matchCode} joined by ${guestWallet.slice(0, 8)}... Room: ${roomId}`);

    // Notify host that someone joined
    io.to(match.hostSocketId).emit('match:playerJoined', {
      matchCode,
      roomId,
      guestWallet,
      yourColor: hostIsWhite ? 'w' : 'b',
    });

    // Broadcast match removal from lobby
    io.emit('lobby:matchRemoved', { matchCode });

    return { success: true, match, roomId };
  }

  // Search matches by code
  searchByCode(code: string): HostedMatch | undefined {
    return this.matches.get(code.toUpperCase());
  }

  // Get all waiting matches
  getWaitingMatches(): HostedMatch[] {
    const now = Date.now();
    const waiting: HostedMatch[] = [];
    
    for (const match of this.matches.values()) {
      if (match.status === 'waiting' && match.joinDeadline > now) {
        waiting.push(match);
      }
    }
    
    return waiting.sort((a, b) => b.createdAt - a.createdAt); // Newest first
  }

  // Get matches by stake tier
  getMatchesByTier(stakeTier: number): HostedMatch[] {
    return this.getWaitingMatches().filter(m => m.stakeTier === stakeTier);
  }

  // Cancel a match
  cancelMatch(matchCode: string, io: SocketServer): boolean {
    const match = this.matches.get(matchCode);
    if (!match) return false;

    match.status = 'cancelled';
    this.walletToMatch.delete(match.hostWallet);
    this.pubkeyToCode.delete(match.matchPubkey);
    this.matches.delete(matchCode);

    console.log(`Match ${matchCode} cancelled`);

    // Broadcast match removal
    io.emit('lobby:matchRemoved', { matchCode });

    return true;
  }

  // Handle host disconnect
  handleDisconnect(socketId: string, io: SocketServer): void {
    for (const [code, match] of this.matches.entries()) {
      if (match.hostSocketId === socketId && match.status === 'waiting') {
        // Give host 30 seconds to reconnect
        setTimeout(() => {
          const currentMatch = this.matches.get(code);
          if (currentMatch && currentMatch.status === 'waiting' && currentMatch.hostSocketId === socketId) {
            this.cancelMatch(code, io);
          }
        }, 30000);
      }
    }
  }

  // Update host socket ID on reconnect
  updateHostSocket(walletAddress: string, newSocketId: string): void {
    const matchCode = this.walletToMatch.get(walletAddress);
    if (matchCode) {
      const match = this.matches.get(matchCode);
      if (match && match.status === 'waiting') {
        match.hostSocketId = newSocketId;
        console.log(`Updated socket for match ${matchCode}`);
      }
    }
  }

  // Get match by pubkey
  getMatchByPubkey(pubkey: string): HostedMatch | undefined {
    const code = this.pubkeyToCode.get(pubkey);
    return code ? this.matches.get(code) : undefined;
  }

  // Cleanup expired matches
  cleanupExpired(io: SocketServer): void {
    const now = Date.now();
    for (const [code, match] of this.matches.entries()) {
      if (match.status === 'waiting' && match.joinDeadline < now) {
        this.cancelMatch(code, io);
      }
    }
  }
}

export const hostedMatchManager = new HostedMatchManager();

// Cleanup expired matches every minute
setInterval(() => {
  // This will be called with io from server.ts
}, 60000);
