import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { PROGRAM_ID, MatchStatus } from './escrow';

// ═══════════════════════════════════════════════════════
// Mint addresses
// ═══════════════════════════════════════════════════════
export const MATE_MINT = new PublicKey('5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump');
export const SKR_MINT  = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');

export type WagerCurrency = 'SOL' | 'MATE' | 'SKR';

// ═══════════════════════════════════════════════════════
// Token stake tiers
// ═══════════════════════════════════════════════════════
export interface TokenStakeTier {
  tier: number;
  label: string;
  rawAmount: number; // raw token units (with 6 decimals)
  displayAmount: number; // human-readable amount
  currency: WagerCurrency;
  mint: PublicKey;
}

export const MATE_STAKE_TIERS: TokenStakeTier[] = [
  { tier: 0, label: '50K $MATE',    rawAmount: 50_000_000_000,     displayAmount: 50_000,    currency: 'MATE', mint: MATE_MINT },
  { tier: 1, label: '100K $MATE',   rawAmount: 100_000_000_000,    displayAmount: 100_000,   currency: 'MATE', mint: MATE_MINT },
  { tier: 2, label: '250K $MATE',   rawAmount: 250_000_000_000,    displayAmount: 250_000,   currency: 'MATE', mint: MATE_MINT },
  { tier: 3, label: '500K $MATE',   rawAmount: 500_000_000_000,    displayAmount: 500_000,   currency: 'MATE', mint: MATE_MINT },
  { tier: 4, label: '1M $MATE',     rawAmount: 1_000_000_000_000,  displayAmount: 1_000_000, currency: 'MATE', mint: MATE_MINT },
];

export const SKR_STAKE_TIERS: TokenStakeTier[] = [
  { tier: 0, label: '500 $SKR',     rawAmount: 500_000_000,        displayAmount: 500,       currency: 'SKR',  mint: SKR_MINT },
  { tier: 1, label: '1K $SKR',      rawAmount: 1_000_000_000,      displayAmount: 1_000,     currency: 'SKR',  mint: SKR_MINT },
  { tier: 2, label: '2.5K $SKR',    rawAmount: 2_500_000_000,      displayAmount: 2_500,     currency: 'SKR',  mint: SKR_MINT },
  { tier: 3, label: '5K $SKR',      rawAmount: 5_000_000_000,      displayAmount: 5_000,     currency: 'SKR',  mint: SKR_MINT },
  { tier: 4, label: '10K $SKR',     rawAmount: 10_000_000_000,     displayAmount: 10_000,    currency: 'SKR',  mint: SKR_MINT },
];

export function getTokenStakeTiers(currency: WagerCurrency): TokenStakeTier[] {
  if (currency === 'MATE') return MATE_STAKE_TIERS;
  if (currency === 'SKR')  return SKR_STAKE_TIERS;
  return [];
}

export function getTokenStakeTierInfo(currency: WagerCurrency, tier: number): TokenStakeTier | undefined {
  return getTokenStakeTiers(currency).find(t => t.tier === tier);
}

export function getMintForCurrency(currency: WagerCurrency): PublicKey | null {
  if (currency === 'MATE') return MATE_MINT;
  if (currency === 'SKR')  return SKR_MINT;
  return null;
}

/**
 * Returns the correct SPL Token program ID for a given mint.
 * MATE uses Token-2022, SKR uses standard Token program.
 */
export function getTokenProgramForMint(mint: PublicKey): PublicKey {
  if (mint.equals(MATE_MINT)) return TOKEN_2022_PROGRAM_ID;
  // Default to standard Token program (SKR and any others)
  return TOKEN_PROGRAM_ID;
}

// ═══════════════════════════════════════════════════════
// Minimal base58 encoder (duplicated from escrow.ts to avoid circular dep)
// ═══════════════════════════════════════════════════════
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

// BN class for serialising u64/i64 values
class BN {
  private value: bigint;
  constructor(value: number | bigint) { this.value = BigInt(value); }
  toNumber(): number { return Number(this.value); }
  toArrayLike(_buf: typeof Buffer, endian: 'le' | 'be', length: number): Buffer {
    const buf = Buffer.alloc(length);
    let val = this.value < 0n ? (1n << BigInt(length * 8)) + this.value : this.value;
    if (endian === 'le') {
      for (let i = 0; i < length; i++) { buf[i] = Number(val & 0xffn); val >>= 8n; }
    } else {
      for (let i = length - 1; i >= 0; i--) { buf[i] = Number(val & 0xffn); val >>= 8n; }
    }
    return buf;
  }
}

// ═══════════════════════════════════════════════════════
// PDA derivation (token match variants)
// ═══════════════════════════════════════════════════════
export function deriveTokenMatchPDA(
  playerA: PublicKey,
  seed: BN,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token_match'), playerA.toBuffer(), seed.toArrayLike(Buffer, 'le', 8)],
    programId
  );
}

export function deriveTokenEscrowAuthorityPDA(
  matchPubkey: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), matchPubkey.toBuffer()],
    programId
  );
}

export function deriveTokenFeeVaultAuthorityPDA(
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token_fee_vault')],
    programId
  );
}

// ═══════════════════════════════════════════════════════
// TokenMatch account data structure
// ═══════════════════════════════════════════════════════
export interface TokenMatchAccount {
  playerA: PublicKey;
  playerB: PublicKey | null;
  mint: PublicKey;
  stakeTier: number;
  stakeAmount: bigint;
  joinDeadline: number;
  status: MatchStatus;
  winner: PublicKey | null;
  bump: number;
  escrowBump: number;
  activatedAt: number;
}

// ═══════════════════════════════════════════════════════
// Instruction discriminators (sha256("global:<name>")[0..8])
// ═══════════════════════════════════════════════════════
const DISC = {
  createTokenMatch:   Buffer.from([0x1f, 0xd3, 0x25, 0xea, 0xc1, 0xc4, 0xe6, 0x6f]),
  joinTokenMatch:     Buffer.from([0x8e, 0x23, 0x5a, 0xce, 0xf2, 0x80, 0xdd, 0x55]),
  submitTokenResult:  Buffer.from([0xe9, 0x5e, 0x34, 0x4b, 0x86, 0x94, 0x5a, 0x52]),
  confirmTokenPayout: Buffer.from([0x34, 0x52, 0x8a, 0xe5, 0xf1, 0x22, 0x43, 0xce]),
  cancelTokenMatch:   Buffer.from([0xd2, 0x6c, 0xfa, 0x75, 0x73, 0x76, 0xf7, 0x86]),
  abandonTokenMatch:  Buffer.from([0xc7, 0xdf, 0x4e, 0x11, 0x52, 0xe1, 0x38, 0x48]),
  forceTokenRefund:   Buffer.from([0xc2, 0x68, 0xa5, 0xa3, 0x0c, 0xf0, 0x85, 0xf8]),
};

// ═══════════════════════════════════════════════════════
// Token Escrow Client
// ═══════════════════════════════════════════════════════
export class TokenEscrowClient {
  constructor(
    private connection: Connection,
    private wallet: WalletContextState
  ) {}

  // ── helpers ─────────────────────────────────────────
  private normalizeSignature(sig: string): string {
    const looksBase64 = /[+/=]/.test(sig);
    if (looksBase64) {
      try {
        const bytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
        if (bytes.length === 64) return base58Encode(bytes);
      } catch { /* ignore */ }
    }
    return sig;
  }

  private isMobileWalletAdapter(): boolean {
    return (this.wallet.wallet?.adapter?.name ?? '').includes('Mobile Wallet Adapter');
  }

  private async buildSignAndSend(
    instruction: TransactionInstruction,
    blockhash: string,
    lastValidBlockHeight: number,
    label: string,
  ): Promise<string> {
    return this.buildMultiSignAndSend([instruction], blockhash, lastValidBlockHeight, label);
  }

  private async buildMultiSignAndSend(
    instructions: TransactionInstruction[],
    blockhash: string,
    lastValidBlockHeight: number,
    label: string,
  ): Promise<string> {
    const walletPubkey = this.wallet.publicKey!;

    if (this.isMobileWalletAdapter()) {
      const messageV0 = new TransactionMessage({
        payerKey: walletPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();
      const vTx = new VersionedTransaction(messageV0);
      const sig = await this.wallet.sendTransaction(vTx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      return this.normalizeSignature(sig);
    }

    const tx = new Transaction();
    for (const ix of instructions) tx.add(ix);
    tx.feePayer = walletPubkey;
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(tx);
      return await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    }
    if (this.wallet.sendTransaction) {
      return await this.wallet.sendTransaction(tx, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    }
    throw new Error('Wallet does not support transaction signing');
  }

  private requireWallet(): PublicKey {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    if (!this.wallet.signTransaction && !this.wallet.sendTransaction)
      throw new Error('Wallet does not support transaction signing');
    return this.wallet.publicKey;
  }

  // ═══════════════════════════════════════════════════
  // create_token_match
  // ═══════════════════════════════════════════════════
  async createTokenMatch(
    mint: PublicKey,
    stakeTier: number,
    joinDeadlineMinutes: number = 30,
  ): Promise<{ signature: string; matchPubkey: PublicKey }> {
    const walletPubkey = this.requireWallet();

    const seed = new BN(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    const [matchPDA] = deriveTokenMatchPDA(walletPubkey, seed);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPDA);
    const tokenProgramId = getTokenProgramForMint(mint);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const playerATA = getAssociatedTokenAddressSync(mint, walletPubkey, false, tokenProgramId);
    const joinDeadline = new BN(Math.floor(Date.now() / 1000) + joinDeadlineMinutes * 60);

    console.log('=== CREATE TOKEN MATCH ===');
    console.log('Mint:', mint.toBase58());
    console.log('Token Program:', tokenProgramId.toBase58());
    console.log('Match PDA:', matchPDA.toBase58());
    console.log('Escrow Authority:', escrowAuthority.toBase58());
    console.log('Escrow ATA:', escrowATA.toBase58());

    // Instruction data: disc(8) + stake_tier(1) + seed(8) + join_deadline(8)
    const data = Buffer.alloc(25);
    DISC.createTokenMatch.copy(data, 0);
    data.writeUInt8(stakeTier, 8);
    seed.toArrayLike(Buffer, 'le', 8).copy(data, 9);
    joinDeadline.toArrayLike(Buffer, 'le', 8).copy(data, 17);

    const keys = [
      { pubkey: matchPDA,                       isSigner: false, isWritable: true  },
      { pubkey: mint,                           isSigner: false, isWritable: false },
      { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
      { pubkey: escrowATA,                      isSigner: false, isWritable: true  },
      { pubkey: playerATA,                      isSigner: false, isWritable: true  },
      { pubkey: walletPubkey,                   isSigner: true,  isWritable: true  },
      { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });

    let retries = 3;
    let lastError: any;
    while (retries > 0) {
      try {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
        const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'createTokenMatch');
        const confirmation = await this.connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight }, 'confirmed',
        );
        if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log('Token match created:', signature);
        return { signature, matchPubkey: matchPDA };
      } catch (error: any) {
        lastError = error;
        if (error.message?.includes('Attempt to debit')) throw new Error('Insufficient balance for token wager.');
        if (error.message?.toLowerCase().includes('missing signature')) throw error;
        if (error.message?.includes('blockhash') && retries > 1) { retries--; await new Promise(r => setTimeout(r, 1000)); continue; }
        throw error;
      }
    }
    throw new Error(`Failed after retries: ${lastError?.message}`);
  }

  // ═══════════════════════════════════════════════════
  // join_token_match
  // ═══════════════════════════════════════════════════
  async joinTokenMatch(matchPubkey: PublicKey, mint: PublicKey): Promise<string> {
    const walletPubkey = this.requireWallet();

    const tokenProgramId = getTokenProgramForMint(mint);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPubkey);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const playerBATA = getAssociatedTokenAddressSync(mint, walletPubkey, false, tokenProgramId);

    const data = Buffer.alloc(8);
    DISC.joinTokenMatch.copy(data, 0);

    const keys = [
      { pubkey: matchPubkey,                    isSigner: false, isWritable: true  },
      { pubkey: mint,                           isSigner: false, isWritable: false },
      { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
      { pubkey: escrowATA,                      isSigner: false, isWritable: true  },
      { pubkey: playerBATA,                     isSigner: false, isWritable: true  },
      { pubkey: walletPubkey,                   isSigner: true,  isWritable: true  },
      { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'joinTokenMatch');
    const confirmation = await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    if (confirmation.value.err) throw new Error(`Join failed: ${JSON.stringify(confirmation.value.err)}`);
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // submit_token_result
  // ═══════════════════════════════════════════════════
  async submitTokenResult(matchPubkey: PublicKey, winner: PublicKey): Promise<string> {
    const walletPubkey = this.requireWallet();

    const data = Buffer.alloc(40);
    DISC.submitTokenResult.copy(data, 0);
    winner.toBuffer().copy(data, 8);

    const keys = [
      { pubkey: matchPubkey,  isSigner: false, isWritable: true  },
      { pubkey: walletPubkey, isSigner: true,  isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'submitTokenResult');
    const confirmation = await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    if (confirmation.value.err) throw new Error(`Submit result failed: ${JSON.stringify(confirmation.value.err)}`);
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // confirm_token_payout
  // ═══════════════════════════════════════════════════
  async confirmTokenPayout(
    matchPubkey: PublicKey,
    mint: PublicKey,
    winner: PublicKey,
    playerA: PublicKey,
  ): Promise<string> {
    const walletPubkey = this.requireWallet();

    const tokenProgramId = getTokenProgramForMint(mint);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPubkey);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const [feeVaultAuthority] = deriveTokenFeeVaultAuthorityPDA();
    const feeVaultATA = getAssociatedTokenAddressSync(mint, feeVaultAuthority, true, tokenProgramId);
    const winnerATA = getAssociatedTokenAddressSync(mint, winner, false, tokenProgramId);

    const data = Buffer.alloc(8);
    DISC.confirmTokenPayout.copy(data, 0);

    const keys = [
      { pubkey: matchPubkey,                    isSigner: false, isWritable: true  },
      { pubkey: mint,                           isSigner: false, isWritable: false },
      { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
      { pubkey: escrowATA,                      isSigner: false, isWritable: true  },
      { pubkey: feeVaultAuthority,              isSigner: false, isWritable: false },
      { pubkey: feeVaultATA,                    isSigner: false, isWritable: true  },
      { pubkey: winnerATA,                      isSigner: false, isWritable: true  },
      { pubkey: winner,                         isSigner: false, isWritable: true  },
      { pubkey: playerA,                        isSigner: false, isWritable: true  },
      { pubkey: walletPubkey,                   isSigner: true,  isWritable: true  },
      { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'confirmTokenPayout');
    const confirmation = await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    if (confirmation.value.err) throw new Error(`Payout failed: ${JSON.stringify(confirmation.value.err)}`);
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // submit + confirm in a SINGLE transaction
  // Avoids MWA session drops between two back-to-back TXs
  // ═══════════════════════════════════════════════════
  async submitResultAndPayout(
    matchPubkey: PublicKey,
    mint: PublicKey,
    winner: PublicKey,
    playerA: PublicKey,
  ): Promise<string> {
    const walletPubkey = this.requireWallet();

    // Instruction 1: submit_token_result
    const submitData = Buffer.alloc(40);
    DISC.submitTokenResult.copy(submitData, 0);
    winner.toBuffer().copy(submitData, 8);
    const submitIx = new TransactionInstruction({
      keys: [
        { pubkey: matchPubkey,  isSigner: false, isWritable: true  },
        { pubkey: walletPubkey, isSigner: true,  isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: submitData,
    });

    // Instruction 2: confirm_token_payout
    const tokenProgramId = getTokenProgramForMint(mint);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPubkey);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const [feeVaultAuthority] = deriveTokenFeeVaultAuthorityPDA();
    const feeVaultATA = getAssociatedTokenAddressSync(mint, feeVaultAuthority, true, tokenProgramId);
    const winnerATA = getAssociatedTokenAddressSync(mint, winner, false, tokenProgramId);

    const payoutData = Buffer.alloc(8);
    DISC.confirmTokenPayout.copy(payoutData, 0);
    const payoutIx = new TransactionInstruction({
      keys: [
        { pubkey: matchPubkey,                    isSigner: false, isWritable: true  },
        { pubkey: mint,                           isSigner: false, isWritable: false },
        { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
        { pubkey: escrowATA,                      isSigner: false, isWritable: true  },
        { pubkey: feeVaultAuthority,              isSigner: false, isWritable: false },
        { pubkey: feeVaultATA,                    isSigner: false, isWritable: true  },
        { pubkey: winnerATA,                      isSigner: false, isWritable: true  },
        { pubkey: winner,                         isSigner: false, isWritable: true  },
        { pubkey: playerA,                        isSigner: false, isWritable: true  },
        { pubkey: walletPubkey,                   isSigner: true,  isWritable: true  },
        { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: payoutData,
    });

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildMultiSignAndSend([submitIx, payoutIx], blockhash, lastValidBlockHeight, 'submitResultAndPayout');
    const confirmation = await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    if (confirmation.value.err) throw new Error(`Submit+Payout failed: ${JSON.stringify(confirmation.value.err)}`);
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // cancel_token_match
  // ═══════════════════════════════════════════════════
  async cancelTokenMatch(matchPubkey: PublicKey, mint: PublicKey): Promise<string> {
    const walletPubkey = this.requireWallet();

    const tokenProgramId = getTokenProgramForMint(mint);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPubkey);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const playerAATA = getAssociatedTokenAddressSync(mint, walletPubkey, false, tokenProgramId);

    const data = Buffer.alloc(8);
    DISC.cancelTokenMatch.copy(data, 0);

    const keys = [
      { pubkey: matchPubkey,                    isSigner: false, isWritable: true },
      { pubkey: mint,                           isSigner: false, isWritable: false },
      { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
      { pubkey: escrowATA,                      isSigner: false, isWritable: true },
      { pubkey: playerAATA,                     isSigner: false, isWritable: true },
      { pubkey: walletPubkey,                   isSigner: true,  isWritable: true },
      { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'cancelTokenMatch');
    await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // abandon_token_match
  // ═══════════════════════════════════════════════════
  async abandonTokenMatch(
    matchPubkey: PublicKey,
    mint: PublicKey,
    playerA: PublicKey,
    playerB: PublicKey,
  ): Promise<string> {
    const walletPubkey = this.requireWallet();

    const tokenProgramId = getTokenProgramForMint(mint);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPubkey);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const playerAATA = getAssociatedTokenAddressSync(mint, playerA, false, tokenProgramId);
    const playerBATA = getAssociatedTokenAddressSync(mint, playerB, false, tokenProgramId);

    const data = Buffer.alloc(8);
    DISC.abandonTokenMatch.copy(data, 0);

    const keys = [
      { pubkey: matchPubkey,                    isSigner: false, isWritable: true  },
      { pubkey: mint,                           isSigner: false, isWritable: false },
      { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
      { pubkey: escrowATA,                      isSigner: false, isWritable: true  },
      { pubkey: playerAATA,                     isSigner: false, isWritable: true  },
      { pubkey: playerA,                        isSigner: false, isWritable: true  },
      { pubkey: playerBATA,                     isSigner: false, isWritable: true  },
      { pubkey: playerB,                        isSigner: false, isWritable: true  },
      { pubkey: walletPubkey,                   isSigner: true,  isWritable: false },
      { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'abandonTokenMatch');
    await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // force_token_refund
  // ═══════════════════════════════════════════════════
  async forceTokenRefund(
    matchPubkey: PublicKey,
    mint: PublicKey,
    playerA: PublicKey,
    playerB: PublicKey,
  ): Promise<string> {
    const walletPubkey = this.requireWallet();

    const tokenProgramId = getTokenProgramForMint(mint);
    const [escrowAuthority] = deriveTokenEscrowAuthorityPDA(matchPubkey);
    const escrowATA = getAssociatedTokenAddressSync(mint, escrowAuthority, true, tokenProgramId);
    const playerAATA = getAssociatedTokenAddressSync(mint, playerA, false, tokenProgramId);
    const playerBATA = getAssociatedTokenAddressSync(mint, playerB, false, tokenProgramId);

    const data = Buffer.alloc(8);
    DISC.forceTokenRefund.copy(data, 0);

    const keys = [
      { pubkey: matchPubkey,                    isSigner: false, isWritable: true  },
      { pubkey: mint,                           isSigner: false, isWritable: false },
      { pubkey: escrowAuthority,                isSigner: false, isWritable: false },
      { pubkey: escrowATA,                      isSigner: false, isWritable: true  },
      { pubkey: playerAATA,                     isSigner: false, isWritable: true  },
      { pubkey: playerA,                        isSigner: false, isWritable: true  },
      { pubkey: playerBATA,                     isSigner: false, isWritable: true  },
      { pubkey: playerB,                        isSigner: false, isWritable: true  },
      { pubkey: walletPubkey,                   isSigner: true,  isWritable: false },
      { pubkey: tokenProgramId,                 isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,        isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({ keys, programId: PROGRAM_ID, data });
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
    const signature = await this.buildSignAndSend(instruction, blockhash, lastValidBlockHeight, 'forceTokenRefund');
    await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
  }

  // ═══════════════════════════════════════════════════
  // Fetch + parse TokenMatch account
  // ═══════════════════════════════════════════════════
  async fetchTokenMatch(matchPubkey: PublicKey): Promise<TokenMatchAccount | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(matchPubkey);
      if (!accountInfo) return null;

      const buf = Buffer.from(accountInfo.data);
      // Layout: disc(8) + playerA(32) + optPlayerB(33) + mint(32) + stakeTier(1)
      //       + stakeAmount(8) + joinDeadline(8) + status(1) + optWinner(33) + bump(1) + escrowBump(1) + activatedAt(8)
      const EXPECTED = 8 + 32 + 33 + 32 + 1 + 8 + 8 + 1 + 33 + 1 + 1 + 8; // 166
      if (buf.length < EXPECTED) return null;

      let offset = 8; // skip discriminator

      const playerA = new PublicKey(buf.slice(offset, offset + 32)); offset += 32;

      const hasPlayerB = buf[offset] === 1; offset += 1;
      const playerB = hasPlayerB ? new PublicKey(buf.slice(offset, offset + 32)) : null; offset += 32;

      const mint = new PublicKey(buf.slice(offset, offset + 32)); offset += 32;

      const stakeTier = buf[offset]; offset += 1;

      // Read u64 stake_amount (little-endian)
      const stakeAmountLo = buf.readUInt32LE(offset);
      const stakeAmountHi = buf.readUInt32LE(offset + 4);
      const stakeAmount = BigInt(stakeAmountLo) + (BigInt(stakeAmountHi) << 32n);
      offset += 8;

      // Read i64 join_deadline
      const jdLo = buf[offset] | (buf[offset+1] << 8) | (buf[offset+2] << 16) | ((buf[offset+3] << 24) >>> 0);
      const jdHi = buf[offset+4] | (buf[offset+5] << 8) | (buf[offset+6] << 16) | ((buf[offset+7] << 24) >>> 0);
      const joinDeadline = jdLo + jdHi * 0x100000000;
      offset += 8;

      const statusByte = buf[offset]; offset += 1;
      let status: MatchStatus;
      switch (statusByte) {
        case 0: status = MatchStatus.Open; break;
        case 1: status = MatchStatus.Active; break;
        case 2: status = MatchStatus.Finished; break;
        case 3: status = MatchStatus.Cancelled; break;
        default: status = MatchStatus.Open;
      }

      const hasWinner = buf[offset] === 1; offset += 1;
      const winner = hasWinner ? new PublicKey(buf.slice(offset, offset + 32)) : null; offset += 32;

      const bump = buf[offset]; offset += 1;
      const escrowBump = buf[offset]; offset += 1;

      // Read i64 activated_at
      const aaLo = buf[offset] | (buf[offset+1] << 8) | (buf[offset+2] << 16) | ((buf[offset+3] << 24) >>> 0);
      const aaHi = buf[offset+4] | (buf[offset+5] << 8) | (buf[offset+6] << 16) | ((buf[offset+7] << 24) >>> 0);
      const activatedAt = aaLo + aaHi * 0x100000000;

      return { playerA, playerB, mint, stakeTier, stakeAmount, joinDeadline, status, winner, bump, escrowBump, activatedAt };
    } catch (error) {
      console.error('Error fetching token match:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════
  // Fetch all open token matches
  // ═══════════════════════════════════════════════════
  async fetchAllOpenTokenMatches(): Promise<Array<{ pubkey: PublicKey; account: TokenMatchAccount }>> {
    try {
      // TokenMatch discriminator: sha256("account:TokenMatch")[0..8]
      // We just fetch all program accounts and filter by size + status
      const accounts = await this.connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: 166 }, // TokenMatch size
        ],
      });

      const matches: Array<{ pubkey: PublicKey; account: TokenMatchAccount }> = [];
      for (const { pubkey } of accounts) {
        const matchAccount = await this.fetchTokenMatch(pubkey);
        if (matchAccount && matchAccount.status === MatchStatus.Open) {
          matches.push({ pubkey, account: matchAccount });
        }
      }
      return matches;
    } catch (error) {
      console.error('Error fetching open token matches:', error);
      return [];
    }
  }
}
