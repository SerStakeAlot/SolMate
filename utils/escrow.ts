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
  private value: bigint;

  constructor(value: number | bigint) {
    this.value = BigInt(value);
  }

  toNumber(): number {
    return Number(this.value);
  }

  toArrayLike(_buffer: typeof Buffer, endian: 'le' | 'be', length: number): Buffer {
    const buf = Buffer.alloc(length);
    let val = this.value;
    
    // Handle negative values by converting to unsigned representation
    if (val < 0n) {
      val = (1n << BigInt(length * 8)) + val;
    }
    
    if (endian === 'le') {
      for (let i = 0; i < length; i++) {
        buf[i] = Number(val & 0xffn);
        val = val >> 8n;
      }
    } else {
      for (let i = length - 1; i >= 0; i--) {
        buf[i] = Number(val & 0xffn);
        val = val >> 8n;
      }
    }
    return buf;
  }
}

// Program ID
export const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');

// Stake tier configuration
export const STAKE_TIERS = [
  { tier: 4, label: '0.05 SOL', lamports: 0.05 * LAMPORTS_PER_SOL, stake: 0.05 },
  { tier: 2, label: '0.1 SOL', lamports: 0.1 * LAMPORTS_PER_SOL, stake: 0.1 },
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
  seed: BN,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('match'),
      playerA.toBuffer(),
      seed.toArrayLike(Buffer, 'le', 8),
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
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Check for either signTransaction or sendTransaction (some wallets only support sendTransaction)
    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    // Use a random seed for PDA derivation
    const seed = new BN(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    const [matchPDA] = deriveMatchPDA(this.wallet.publicKey, seed);
    const [escrowPDA] = deriveEscrowPDA(matchPDA);

    const joinDeadline = new BN(
      Math.floor(Date.now() / 1000) + joinDeadlineMinutes * 60
    );

    // Debug logging
    console.log('=== CREATE MATCH DEBUG (v2) ===');
    console.log('Seed (BigInt):', seed.toNumber());
    console.log('Seed bytes:', seed.toArrayLike(Buffer, 'le', 8).toString('hex'));
    console.log('Connected Wallet (signer):', this.wallet.publicKey.toBase58());
    console.log('Match PDA:', matchPDA.toBase58());
    console.log('Escrow PDA:', escrowPDA.toBase58());
    console.log('Program ID:', PROGRAM_ID.toBase58());

    // Build instruction data manually
    const instructionData = Buffer.alloc(25); // 8 (discriminator) + 1 (stake_tier) + 8 (seed) + 8 (join_deadline)
    // Instruction discriminator for create_match (8 bytes - hash of "global:create_match")
    const discriminator = Buffer.from([
      0x6b, 0x02, 0xb8, 0x91, 0x46, 0x8e, 0x11, 0xa5,
    ]);
    discriminator.copy(instructionData, 0);
    instructionData.writeUInt8(stakeTier, 8);
    seed.toArrayLike(Buffer, 'le', 8).copy(instructionData, 9);
    joinDeadline.toArrayLike(Buffer, 'le', 8).copy(instructionData, 17);

    console.log('Instruction data:', instructionData.toString('hex'));

    const keys = [
      { pubkey: matchPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    console.log('Transaction accounts:');
    keys.forEach((k, i) => console.log(`  ${i}: ${k.pubkey.toBase58()} (signer: ${k.isSigner})`));

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const walletPubkey = this.wallet.publicKey;

    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    // Verify: only the wallet should be a local signer
    const localSigners = keys.filter(k => k.isSigner);
    console.log('Local signers in instruction:', localSigners.map(s => s.pubkey.toBase58()));
    if (localSigners.length !== 1 || !localSigners[0].pubkey.equals(walletPubkey)) {
      throw new Error(
        `Unexpected signers in createMatch instruction. Expected only ${walletPubkey.toBase58()}, got: ${localSigners.map(s => s.pubkey.toBase58()).join(', ')}`
      );
    }

    // Retry logic for getting recent blockhash
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        // Use "finalized" commitment for blockhash – more reliable on Seed Vault / mobile
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;

        // === TEMP DEBUG: createMatch signer diagnosis ===
        console.log('[createMatch] wallet:', this.wallet.publicKey?.toBase58());
        console.log('[createMatch] feePayer:', tx.feePayer?.toBase58());
        const compiledMsg = tx.compileMessage();
        console.log('[createMatch] requiredSigners:', compiledMsg.header.numRequiredSignatures);
        compiledMsg.accountKeys.slice(0, compiledMsg.header.numRequiredSignatures)
          .forEach((k: PublicKey, i: number) => console.log('[createMatch] reqSigner', i, k.toBase58()));
        tx.signatures.forEach(s => console.log('[createMatch] PRE-SIGN', s.publicKey.toBase58(), 'hasSig:', !!s.signature));
        // === END PRE-SIGN DEBUG ===

        let signature: string;

        if (this.wallet.signTransaction) {
          console.log('[createMatch] calling wallet.signTransaction...');
          const signedTx = await this.wallet.signTransaction(tx);

          // === TEMP DEBUG: post-sign ===
          signedTx.signatures.forEach(s => console.log('[createMatch] POST-SIGN', s.publicKey.toBase58(), 'hasSig:', !!s.signature));

          // Hard assertion: wallet MUST have signed
          const walletSig = signedTx.signatures.find(s => s.publicKey.equals(walletPubkey));
          if (!walletSig?.signature) {
            throw new Error('[createMatch] Wallet did not sign - missing signature for ' + walletPubkey.toBase58());
          }

          // Serialize the SIGNED tx (not the original `tx`)
          console.log('[createMatch] serializing signedTx (not tx)');
          const rawBytes = signedTx.serialize();
          console.log('[createMatch] serialized length:', rawBytes.length, 'first 64 bytes (sig):', Buffer.from(rawBytes.slice(0, 64)).toString('hex'));
          signature = await this.connection.sendRawTransaction(rawBytes, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        } else if (this.wallet.sendTransaction) {
          console.log('[createMatch] using sendTransaction fallback');
          signature = await this.wallet.sendTransaction(tx, this.connection, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        } else {
          throw new Error('Wallet does not support transaction signing');
        }

        console.log('Transaction sent, signature:', signature);
        console.log('Waiting for confirmation...');

        const confirmation = await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        if (confirmation.value.err) {
          console.error('Transaction failed:', confirmation.value.err);
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log('Create match confirmed on-chain:', signature);

        return { signature, matchPubkey: matchPDA };
      } catch (error: any) {
        lastError = error;

        if (error.message?.includes('Attempt to debit an account')) {
          throw new Error(
            'Insufficient SOL balance. Please add more SOL to your wallet.'
          );
        }
        if (error.message?.includes('missing signature')) {
          console.error('=== MISSING SIGNATURE DEBUG (createMatch) ===');
          console.error('Wallet publicKey:', walletPubkey.toBase58());
          console.error('Wallet adapter name:', this.wallet.wallet?.adapter?.name);
          console.error('Raw error:', error.message);
          throw new Error(
            `Transaction signing failed for ${walletPubkey.toBase58()}. ` +
            `The wallet did not produce a valid signature. ` +
            `Please disconnect and reconnect your wallet, then try again.`
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
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    const walletPubkey = this.wallet.publicKey;
    const [escrowPDA] = deriveEscrowPDA(matchPubkey);

    console.log('=== JOIN MATCH DEBUG ===');
    console.log('Wallet publicKey:', walletPubkey.toBase58());
    console.log('Match PDA:', matchPubkey.toBase58());
    console.log('Escrow PDA:', escrowPDA.toBase58());
    console.log('Wallet adapter:', this.wallet.wallet?.adapter?.name ?? 'unknown');

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for join_match
    const discriminator = Buffer.from([
      0xf4, 0x08, 0x2f, 0x82, 0xc0, 0x3b, 0xb3, 0x2c,
    ]);
    discriminator.copy(instructionData, 0);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },   // PDA – NOT a signer
      { pubkey: escrowPDA, isSigner: false, isWritable: true },     // PDA – NOT a signer
      { pubkey: walletPubkey, isSigner: true, isWritable: true },   // user wallet – only local signer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    // Verify: only the wallet should be a signer
    const localSigners = keys.filter(k => k.isSigner);
    console.log('Local signers in instruction:', localSigners.map(s => s.pubkey.toBase58()));
    if (localSigners.length !== 1 || !localSigners[0].pubkey.equals(walletPubkey)) {
      throw new Error(
        `Unexpected signers in joinMatch instruction. Expected only ${walletPubkey.toBase58()}, got: ${localSigners.map(s => s.pubkey.toBase58()).join(', ')}`
      );
    }

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    // Use "finalized" commitment for blockhash – more reliable on Seed Vault / mobile
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    // === TEMP DEBUG: joinMatch signer diagnosis ===
    console.log('[joinMatch] wallet:', this.wallet.publicKey?.toBase58());
    console.log('[joinMatch] feePayer:', tx.feePayer?.toBase58());
    const compiledMsg = tx.compileMessage();
    console.log('[joinMatch] requiredSigners:', compiledMsg.header.numRequiredSignatures);
    compiledMsg.accountKeys.slice(0, compiledMsg.header.numRequiredSignatures)
      .forEach((k: PublicKey, i: number) => console.log('[joinMatch] reqSigner', i, k.toBase58()));
    tx.signatures.forEach(s => console.log('[joinMatch] PRE-SIGN', s.publicKey.toBase58(), 'hasSig:', !!s.signature));
    // === END PRE-SIGN DEBUG ===

    try {
      let signature: string;

      if (this.wallet.signTransaction) {
        console.log('[joinMatch] calling wallet.signTransaction...');
        const signedTx = await this.wallet.signTransaction(tx);

        // === TEMP DEBUG: post-sign ===
        signedTx.signatures.forEach(s => console.log('[joinMatch] POST-SIGN', s.publicKey.toBase58(), 'hasSig:', !!s.signature));

        // Hard assertion: wallet MUST have signed
        const walletSig = signedTx.signatures.find(s => s.publicKey.equals(walletPubkey));
        if (!walletSig?.signature) {
          throw new Error('[joinMatch] Wallet did not sign - missing signature for ' + walletPubkey.toBase58());
        }

        // Serialize the SIGNED tx (not the original `tx`)
        console.log('[joinMatch] serializing signedTx (not tx)');
        const rawBytes = signedTx.serialize();
        console.log('[joinMatch] serialized length:', rawBytes.length, 'first 64 bytes (sig):', Buffer.from(rawBytes.slice(0, 64)).toString('hex'));
        signature = await this.connection.sendRawTransaction(rawBytes, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
      } else if (this.wallet.sendTransaction) {
        console.log('[joinMatch] using sendTransaction fallback');
        signature = await this.wallet.sendTransaction(tx, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
      } else {
        throw new Error('Wallet does not support transaction signing');
      }

      console.log('Join transaction sent, signature:', signature);
      console.log('Waiting for confirmation...');

      const confirmation = await this.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Join transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('Join match confirmed on-chain:', signature);
      return signature;
    } catch (error: any) {
      if (error.message?.includes('Attempt to debit an account')) {
        throw new Error(
          'Insufficient SOL balance. Please ensure you have enough SOL to cover the stake.'
        );
      }
      if (error.message?.includes('missing signature')) {
        console.error('=== MISSING SIGNATURE DEBUG ===');
        console.error('Wallet publicKey:', walletPubkey.toBase58());
        console.error('Wallet adapter name:', this.wallet.wallet?.adapter?.name);
        console.error('Raw error:', error.message);
        throw new Error(
          `Transaction signing failed for ${walletPubkey.toBase58()}. ` +
          `The wallet did not produce a valid signature. ` +
          `Please disconnect and reconnect your wallet, then try again.`
        );
      }
      throw error;
    }
  }

  async submitResult(matchPubkey: PublicKey, winner: PublicKey): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    // Build instruction data manually
    const instructionData = Buffer.alloc(40);
    // Instruction discriminator for submit_result
    const discriminator = Buffer.from([
      0xf0, 0x2a, 0x59, 0xb4, 0x0a, 0xef, 0x09, 0xd6,
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

    const walletPubkey = this.wallet.publicKey;
    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    let signature: string;

    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(tx);

      const walletSig = signed.signatures.find(s => s.publicKey.equals(walletPubkey));
      if (!walletSig?.signature) {
        throw new Error(
          `Wallet did not sign the submitResult transaction. Expected signature for ${walletPubkey.toBase58()}.`
        );
      }

      signature = await this.connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    } else if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      throw new Error('Wallet does not support transaction signing');
    }

    const confirmation = await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  }

  async confirmPayout(
    matchPubkey: PublicKey,
    winner: PublicKey,
    playerA: PublicKey
  ): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    const [escrowPDA] = deriveEscrowPDA(matchPubkey);
    const [feeVaultPDA] = deriveFeeVaultPDA();

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for confirm_payout: sha256("global:confirm_payout")[0..8]
    const discriminator = Buffer.from([
      0x94, 0x61, 0x91, 0x02, 0x55, 0x8b, 0x04, 0x8c,
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

    const walletPubkey = this.wallet.publicKey;
    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    let signature: string;

    if (this.wallet.signTransaction) {
      console.log('Signing confirmPayout with wallet.signTransaction...');
      const signed = await this.wallet.signTransaction(tx);

      const walletSig = signed.signatures.find(s => s.publicKey.equals(walletPubkey));
      if (!walletSig?.signature) {
        throw new Error(
          `Wallet did not sign the confirmPayout transaction. Expected signature for ${walletPubkey.toBase58()}.`
        );
      }

      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else if (this.wallet.sendTransaction) {
      console.log('Using sendTransaction for confirmPayout (fallback)...');
      signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      throw new Error('Wallet does not support transaction signing');
    }

    const confirmation = await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Payout transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  }

  async cancelMatch(matchPubkey: PublicKey): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    const [escrowPDA] = deriveEscrowPDA(matchPubkey);

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for cancel_match: sha256("global:cancel_match")[0..8]
    const discriminator = Buffer.from([
      0x8e, 0x88, 0xf7, 0x2d, 0x5c, 0x70, 0xb4, 0x53,
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

    const walletPubkey = this.wallet.publicKey;
    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    let signature: string;

    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(tx);

      const walletSig = signed.signatures.find(s => s.publicKey.equals(walletPubkey));
      if (!walletSig?.signature) {
        throw new Error(
          `Wallet did not sign the cancelMatch transaction. Expected signature for ${walletPubkey.toBase58()}.`
        );
      }

      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      throw new Error('Wallet does not support transaction signing');
    }

    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return signature;
  }

  /**
   * Abandon an active match and refund both players.
   * Can be called by either player when the match has no winner.
   */
  async abandonMatch(matchPubkey: PublicKey, playerA: PublicKey, playerB: PublicKey): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    const walletPubkey = this.wallet.publicKey;
    const [escrowPDA] = deriveEscrowPDA(matchPubkey);

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for abandon_match: sha256("global:abandon_match")[0..8]
    const discriminator = Buffer.from([150, 220, 114, 43, 193, 29, 117, 253]);
    discriminator.copy(instructionData, 0);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: playerA, isSigner: false, isWritable: true },
      { pubkey: playerB, isSigner: false, isWritable: true },
      { pubkey: walletPubkey, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    let signature: string;

    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(tx);

      const walletSig = signed.signatures.find(s => s.publicKey.equals(walletPubkey));
      if (!walletSig?.signature) {
        throw new Error(
          `Wallet did not sign the abandonMatch transaction. Expected signature for ${walletPubkey.toBase58()}.`
        );
      }

      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      throw new Error('Wallet does not support transaction signing');
    }

    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return signature;
  }

  /**
   * Force refund for a Finished match where payout failed.
   * Splits remaining escrow balance between both players.
   */
  async forceRefund(matchPubkey: PublicKey, playerA: PublicKey, playerB: PublicKey): Promise<string> {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    if (!this.wallet.signTransaction && !this.wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    const [escrowPDA] = deriveEscrowPDA(matchPubkey);

    // Build instruction data manually
    const instructionData = Buffer.alloc(8);
    // Instruction discriminator for force_refund: sha256("global:force_refund")[0..8]
    const discriminator = Buffer.from([127, 173, 30, 92, 164, 123, 109, 177]);
    discriminator.copy(instructionData, 0);

    const keys = [
      { pubkey: matchPubkey, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: playerA, isSigner: false, isWritable: true },
      { pubkey: playerB, isSigner: false, isWritable: true },
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = {
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    };

    const walletPubkey = this.wallet.publicKey;
    const tx = new Transaction().add(instruction);
    tx.feePayer = walletPubkey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    let signature: string;

    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(tx);

      const walletSig = signed.signatures.find(s => s.publicKey.equals(walletPubkey));
      if (!walletSig?.signature) {
        throw new Error(
          `Wallet did not sign the forceRefund transaction. Expected signature for ${walletPubkey.toBase58()}.`
        );
      }

      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      throw new Error('Wallet does not support transaction signing');
    }

    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

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

  /**
   * Find active matches where the connected wallet is a player (either A or B).
   * Useful for finding stuck matches to abandon.
   */
  async findMyActiveMatches(): Promise<Array<{ pubkey: PublicKey; account: MatchAccount; isPlayerA: boolean }>> {
    if (!this.wallet.publicKey) {
      return [];
    }

    try {
      // Get all program accounts
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID);
      const myMatches: Array<{ pubkey: PublicKey; account: MatchAccount; isPlayerA: boolean }> = [];

      for (const { pubkey } of accounts) {
        const matchAccount = await this.fetchMatch(pubkey);
        if (!matchAccount) continue;
        
        // Only look at Active matches (status = 1)
        if (matchAccount.status !== MatchStatus.Active) continue;
        
        // Check if we're a player
        const isPlayerA = matchAccount.playerA.equals(this.wallet.publicKey);
        const isPlayerB = matchAccount.playerB?.equals(this.wallet.publicKey) ?? false;
        
        if (isPlayerA || isPlayerB) {
          myMatches.push({ pubkey, account: matchAccount, isPlayerA });
        }
      }

      return myMatches;
    } catch (error) {
      console.error('Error finding active matches:', error);
      return [];
    }
  }
}
// Build trigger: 1768469499
