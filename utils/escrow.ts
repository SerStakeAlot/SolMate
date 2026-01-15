import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

// BN implementation for timestamp handling
class BN {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  toNumber(): number {
    return this.value;
  }

  toArrayLike(buffer: typeof Buffer, endian: 'le' | 'be', length: number): Buffer {
    const buf = Buffer.alloc(length);
    if (endian === 'le') {
      buf.writeUInt32LE(this.value & 0xffffffff, 0);
      buf.writeUInt32LE(Math.floor(this.value / 0x100000000), 4);
    } else {
      buf.writeUInt32BE(Math.floor(this.value / 0x100000000), 0);
      buf.writeUInt32BE(this.value & 0xffffffff, 4);
    }
    return buf;
  }
}

// Program ID
export const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');

// Stake tier configuration (limited to 0.5 and 1 SOL for audit/launch)
export const STAKE_TIERS = [
  { tier: 0, label: '0.5 SOL', lamports: 0.5 * LAMPORTS_PER_SOL, stake: 0.5 },
  { tier: 1, label: '1 SOL', lamports: 1 * LAMPORTS_PER_SOL, stake: 1 },
];

export function getStakeTierInfo(tier: number) {
  return STAKE_TIERS.find(t => t.tier === tier) || STAKE_TIERS[0];
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

// PDA derivation functions
export function deriveMatchPDA(
  playerA: PublicKey,
  timestamp: BN,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('match'),
      playerA.toBuffer(),
      timestamp.toArrayLike(Buffer, 'le', 8),
    ],
    programId
  );
  return [pda, bump];
}

export function deriveEscrowPDA(
  matchPubkey: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), matchPubkey.toBuffer()],
    programId
  );
  return [pda, bump];
}

export function deriveFeeVaultPDA(
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault')],
    programId
  );
  return [pda, bump];
}

// Match status enum
export enum MatchStatus {
  Open = 'Open',
  Active = 'Active',
  Finished = 'Finished',
  Cancelled = 'Cancelled',
}

// Match account data structure
export interface MatchAccount {
  playerA: PublicKey;
  playerB: PublicKey | null;
  stakeTier: number;
  joinDeadline: BN;
  status: MatchStatus;
  winner: PublicKey | null;
  bump: number;
  escrowBump: number;
}

// Helper to parse match status from chain data
export function parseMatchStatus(statusObj: any): MatchStatus {
  if (statusObj.open) return MatchStatus.Open;
  if (statusObj.active) return MatchStatus.Active;
  if (statusObj.finished) return MatchStatus.Finished;
  if (statusObj.cancelled) return MatchStatus.Cancelled;
  return MatchStatus.Open;
}

// Escrow client class
export class EscrowClient {
  constructor(
    private connection: Connection,
    private wallet: WalletContextState
  ) {}

  async createMatch(
    stakeTier: number,
    joinDeadlineMinutes: number = 30
  ): Promise<{ signature: string; matchPubkey: PublicKey }> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const timestamp = new BN(Math.floor(Date.now() / 1000));
    const [matchPDA] = deriveMatchPDA(this.wallet.publicKey, timestamp);
    const [escrowPDA] = deriveEscrowPDA(matchPDA);

    const joinDeadline = new BN(
      Math.floor(Date.now() / 1000) + joinDeadlineMinutes * 60
    );

    // Build instruction data manually
    const instructionData = Buffer.alloc(17);
    // Instruction discriminator for create_match (8 bytes - hash of "global:create_match")
    const discriminator = Buffer.from([
      0x8a, 0x3e, 0x3e, 0x64, 0x9f, 0x4a, 0x3c, 0x8e,
    ]);
    discriminator.copy(instructionData, 0);
    instructionData.writeUInt8(stakeTier, 8);
    joinDeadline.toArrayLike(Buffer, 'le', 8).copy(instructionData, 9);

    const keys = [
      { pubkey: matchPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;
    
    // Retry logic for getting recent blockhash
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        
        const signed = await this.wallet.signTransaction(transaction);
        
        const signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        
        await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');
        
        return { signature, matchPubkey: matchPDA };
      } catch (error: any) {
        lastError = error;
        if (error.message?.includes('Attempt to debit an account')) {
          throw new Error(
            'Insufficient SOL balance. Please add more SOL to your wallet.'
          );
        }
        if (error.message?.includes('blockhash') && retries > 1) {
          console.log(`Retrying due to blockhash error, ${retries - 1} retries left...`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`Failed after retries: ${lastError?.message || 'Unknown error'}`);
  }

  async joinMatch(matchPubkey: PublicKey): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const [escrowPDA] = deriveEscrowPDA(matchPubkey);

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for join_match
    const discriminator = Buffer.from([
      0xd4, 0xa0, 0x8f, 0x3c, 0x6e, 0x7b, 0x5a, 0x9c,
    ]);
    discriminator.copy(instructionData, 0);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    const signed = await this.wallet.signTransaction(transaction);
    
    try {
      const signature = await this.connection.sendRawTransaction(signed.serialize());
      await this.connection.confirmTransaction(signature);
      return signature;
    } catch (error: any) {
      if (error.message?.includes('Attempt to debit an account')) {
        throw new Error(
          'Insufficient SOL balance. Please fund your wallet from the Solana devnet faucet: https://faucet.solana.com/'
        );
      }
      throw error;
    }
  }

  async submitResult(matchPubkey: PublicKey, winner: PublicKey): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    // Build instruction data manually
    const instructionData = Buffer.alloc(40);
    // Instruction discriminator for submit_result
    const discriminator = Buffer.from([
      0xf2, 0x3a, 0x1d, 0x9e, 0x4c, 0x7b, 0x8a, 0x5f,
    ]);
    discriminator.copy(instructionData, 0);
    winner.toBuffer().copy(instructionData, 8);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    const signed = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  async confirmPayout(
    matchPubkey: PublicKey,
    winner: PublicKey,
    playerA: PublicKey
  ): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const [escrowPDA] = deriveEscrowPDA(matchPubkey);
    const [feeVaultPDA] = deriveFeeVaultPDA();

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for confirm_payout
    const discriminator = Buffer.from([
      0xa5, 0x8c, 0x2f, 0x1e, 0x9d, 0x4b, 0x7a, 0x3c,
    ]);
    discriminator.copy(instructionData, 0);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: feeVaultPDA, isSigner: false, isWritable: true },
      { pubkey: winner, isSigner: false, isWritable: true },
      { pubkey: playerA, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    const signed = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  async cancelMatch(matchPubkey: PublicKey): Promise<string> {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const [escrowPDA] = deriveEscrowPDA(matchPubkey);

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for cancel_match
    const discriminator = Buffer.from([
      0xc1, 0x5d, 0x8e, 0x2a, 0x7f, 0x9b, 0x3c, 0x4d,
    ]);
    discriminator.copy(instructionData, 0);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    const signed = await this.wallet.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signed.serialize());
    await this.connection.confirmTransaction(signature);

    return signature;
  }

  async fetchMatch(matchPubkey: PublicKey): Promise<MatchAccount | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(matchPubkey);
      if (!accountInfo) return null;

      // Parse account data manually (this is a simplified parser)
      const data = accountInfo.data;
      
      // Skip 8-byte discriminator
      let offset = 8;
      
      const playerA = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      const hasPlayerB = data[offset] === 1;
      offset += 1;
      const playerB = hasPlayerB ? new PublicKey(data.slice(offset, offset + 32)) : null;
      offset += 32;
      
      const stakeTier = data[offset];
      offset += 1;
      
      const joinDeadlineBytes = data.slice(offset, offset + 8);
      const joinDeadline = new BN(
        joinDeadlineBytes.readUInt32LE(0) + 
        joinDeadlineBytes.readUInt32LE(4) * 0x100000000
      );
      offset += 8;
      
      const statusByte = data[offset];
      offset += 1;
      let status: MatchStatus;
      switch (statusByte) {
        case 0: status = MatchStatus.Open; break;
        case 1: status = MatchStatus.Active; break;
        case 2: status = MatchStatus.Finished; break;
        case 3: status = MatchStatus.Cancelled; break;
        default: status = MatchStatus.Open;
      }
      
      const hasWinner = data[offset] === 1;
      offset += 1;
      const winner = hasWinner ? new PublicKey(data.slice(offset, offset + 32)) : null;
      offset += 32;
      
      const bump = data[offset];
      offset += 1;
      const escrowBump = data[offset];

      return {
        playerA,
        playerB,
        stakeTier,
        joinDeadline,
        status,
        winner,
        bump,
        escrowBump,
      };
    } catch (error) {
      console.error('Error fetching match:', error);
      return null;
    }
  }

  async fetchAllOpenMatches(): Promise<Array<{ pubkey: PublicKey; account: MatchAccount }>> {
    try {
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 8 + 32 + 33 + 1 + 8, // Skip to status field
              bytes: '1', // Open status
            },
          },
        ],
      });

      const matches: Array<{ pubkey: PublicKey; account: MatchAccount }> = [];
      
      for (const { pubkey, account } of accounts) {
        const matchAccount = await this.fetchMatch(pubkey);
        if (matchAccount && matchAccount.status === MatchStatus.Open) {
          matches.push({ pubkey, account: matchAccount });
        }
      }

      return matches;
    } catch (error) {
      console.error('Error fetching open matches:', error);
      return [];
    }
  }
}
