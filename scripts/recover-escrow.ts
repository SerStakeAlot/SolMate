/**
 * Recovery script: Call confirmPayout on the stuck match to release escrow funds.
 * 
 * The match 4L74YKdJoqqzgdSYaMKrzzTn5jN7FBYPaWyWAVKGF6Ab has the wrong winner
 * recorded on-chain (Player B instead of Player A). Since the program can't be
 * upgraded (deployer keypair lost), we call confirmPayout to send funds to
 * the on-chain winner (Player B), then transfer them back from Player B's wallet.
 * 
 * This script outputs the raw transaction for signing via the refund page,
 * OR can run with a local keypair.
 * 
 * Usage:
 *   npx ts-node scripts/recover-escrow.ts simulate
 *   npx ts-node scripts/recover-escrow.ts execute <path-to-keypair.json>
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as fs from 'fs';

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');

// The stuck match
const MATCH_PUBKEY = new PublicKey('4L74YKdJoqqzgdSYaMKrzzTn5jN7FBYPaWyWAVKGF6Ab');

// On-chain winner (Player B) - funds will be sent here by confirmPayout
const WINNER_PUBKEY = new PublicKey('6hVBiRqqdW4gSdfzrWa2DKHupLbhzg2HbftsMKf7sDXi');

// Player A (match creator, actual winner) - receives match account rent
const PLAYER_A_PUBKEY = new PublicKey('7BKqimAdco1XsknW88N38qf4PgXGieWN8USPgKxcf87B');

function deriveEscrowPDA(matchPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), matchPubkey.toBuffer()],
    PROGRAM_ID
  );
}

function deriveFeeVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault')],
    PROGRAM_ID
  );
}

async function main() {
  const mode = process.argv[2] || 'simulate';
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('=== Escrow Recovery: confirmPayout ===');
  console.log(`Match:    ${MATCH_PUBKEY.toString()}`);
  console.log(`Winner:   ${WINNER_PUBKEY.toString()} (Player B - on-chain winner)`);
  console.log(`Player A: ${PLAYER_A_PUBKEY.toString()} (actual winner - gets rent back)`);
  console.log('');

  // Check current state
  const matchInfo = await connection.getAccountInfo(MATCH_PUBKEY);
  if (!matchInfo) {
    console.log('❌ Match account no longer exists! It may have already been closed.');
    return;
  }
  console.log(`Match account: ${matchInfo.lamports / LAMPORTS_PER_SOL} SOL (rent)`);

  const [escrowPDA] = deriveEscrowPDA(MATCH_PUBKEY);
  const escrowInfo = await connection.getAccountInfo(escrowPDA);
  if (!escrowInfo || escrowInfo.lamports === 0) {
    console.log('❌ Escrow is empty! Funds may have already been released.');
    return;
  }
  console.log(`Escrow:   ${escrowInfo.lamports / LAMPORTS_PER_SOL} SOL`);

  const [feeVaultPDA] = deriveFeeVaultPDA();
  const feeVaultInfo = await connection.getAccountInfo(feeVaultPDA);
  console.log(`Fee Vault: ${feeVaultInfo ? feeVaultInfo.lamports / LAMPORTS_PER_SOL : 0} SOL`);

  // Calculate expected payouts
  const totalPot = escrowInfo.lamports;
  const fee = Math.floor(totalPot / 10); // 10%
  const payout = totalPot - fee;
  console.log('');
  console.log(`Expected payout to Player B: ${payout / LAMPORTS_PER_SOL} SOL`);
  console.log(`Expected fee to vault:       ${fee / LAMPORTS_PER_SOL} SOL`);
  console.log(`Rent refund to Player A:     ${matchInfo.lamports / LAMPORTS_PER_SOL} SOL`);
  console.log('');

  // Build the confirmPayout instruction
  const discriminator = Buffer.from([0x94, 0x61, 0x91, 0x02, 0x55, 0x8b, 0x04, 0x8c]);
  const instructionData = Buffer.alloc(8);
  discriminator.copy(instructionData, 0);

  if (mode === 'simulate') {
    console.log('📋 SIMULATION MODE');
    console.log('To execute, run with: npx ts-node scripts/recover-escrow.ts execute <keypair.json>');
    console.log('The keypair can be ANY funded wallet (just needs gas). Player B does NOT need to sign.');
    console.log('');

    // Simulate the transaction
    const tempKeypair = Keypair.generate();
    const keys = [
      { pubkey: MATCH_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: feeVaultPDA, isSigner: false, isWritable: true },
      { pubkey: WINNER_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: PLAYER_A_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: tempKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    });

    const { blockhash } = await connection.getLatestBlockhash('finalized');
    const tx = new Transaction().add(instruction);
    tx.recentBlockhash = blockhash;
    tx.feePayer = tempKeypair.publicKey;

    const simResult = await connection.simulateTransaction(tx, [tempKeypair]);
    if (simResult.value.err) {
      console.log('❌ Simulation FAILED:', JSON.stringify(simResult.value.err));
      if (simResult.value.logs) {
        console.log('Logs:', simResult.value.logs.join('\n'));
      }
    } else {
      console.log('✅ Simulation SUCCESS');
      if (simResult.value.logs) {
        const payoutLogs = simResult.value.logs.filter((l: string) => l.includes('lamports') || l.includes('Payout') || l.includes('Fee'));
        payoutLogs.forEach((l: string) => console.log('  ', l));
      }
    }

  } else if (mode === 'execute') {
    const keypairPath = process.argv[3];
    if (!keypairPath) {
      console.log('❌ Please provide keypair path: npx ts-node scripts/recover-escrow.ts execute <keypair.json>');
      return;
    }

    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`Payer: ${payer.publicKey.toString()}`);

    const payerBalance = await connection.getBalance(payer.publicKey);
    console.log(`Payer balance: ${payerBalance / LAMPORTS_PER_SOL} SOL`);
    if (payerBalance < 10000) {
      console.log('❌ Payer needs some SOL for gas fees (~0.00001 SOL)');
      return;
    }

    const keys = [
      { pubkey: MATCH_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: feeVaultPDA, isSigner: false, isWritable: true },
      { pubkey: WINNER_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: PLAYER_A_PUBKEY, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      keys,
      programId: PROGRAM_ID,
      data: instructionData,
    });

    console.log('🚀 Sending confirmPayout transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer],
      { commitment: 'confirmed' }
    );

    console.log('');
    console.log('✅ SUCCESS!');
    console.log(`Transaction: https://solscan.io/tx/${signature}`);
    console.log('');
    console.log(`${payout / LAMPORTS_PER_SOL} SOL sent to Player B: ${WINNER_PUBKEY.toString()}`);
    console.log(`${fee / LAMPORTS_PER_SOL} SOL sent to fee vault`);
    console.log(`${matchInfo.lamports / LAMPORTS_PER_SOL} SOL (rent) sent to Player A: ${PLAYER_A_PUBKEY.toString()}`);
    console.log('');
    console.log('📋 NEXT STEP: Transfer the funds from Player B wallet back to Player A');
  }
}

main().catch(console.error);
