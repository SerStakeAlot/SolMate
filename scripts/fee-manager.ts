#!/usr/bin/env npx ts-node
/**
 * SolMate Fee Management Script
 * 
 * Usage:
 *   npx ts-node scripts/fee-manager.ts view     - View accumulated fees
 *   npx ts-node scripts/fee-manager.ts withdraw - Withdraw all fees
 *   npx ts-node scripts/fee-manager.ts withdraw 0.5 - Withdraw specific amount
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const ADMIN_PUBKEY = new PublicKey('7BKqimAdco1XsknW88N38qf4PgXGieWN8USPgKxcf87B');
const RPC_URL = 'https://api.devnet.solana.com'; // Change to mainnet when ready

// Derive Fee Vault PDA
function getFeeVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault')],
    PROGRAM_ID
  );
}

async function viewFees() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const [feeVaultPda, bump] = getFeeVaultPDA();
  
  console.log('\n📊 SolMate Fee Vault Status');
  console.log('═'.repeat(50));
  console.log(`Fee Vault Address: ${feeVaultPda.toString()}`);
  console.log(`Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`Admin Wallet: ${ADMIN_PUBKEY.toString()}`);
  console.log('─'.repeat(50));
  
  try {
    const accountInfo = await connection.getAccountInfo(feeVaultPda);
    
    if (!accountInfo) {
      console.log('\n⚠️  Fee vault has not been created yet.');
      console.log('   It will be created when the first match payout occurs.');
      return;
    }
    
    const balance = accountInfo.lamports;
    const rentExempt = await connection.getMinimumBalanceForRentExemption(accountInfo.data.length);
    const availableBalance = balance - rentExempt;
    
    console.log(`\n💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    console.log(`🔒 Rent Reserve: ${(rentExempt / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    console.log(`✅ Available to Withdraw: ${(availableBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    
    // Try to parse the account data for total_collected
    if (accountInfo.data.length >= 16) {
      // Skip 8-byte discriminator, read u64 total_collected
      const totalCollected = accountInfo.data.readBigUInt64LE(8);
      console.log(`📈 Total Collected (all time): ${(Number(totalCollected) / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    }
    
  } catch (error) {
    console.error('Error fetching fee vault:', error);
  }
  
  console.log('\n' + '═'.repeat(50));
}

async function withdrawFees(amount?: number) {
  console.log('\n💸 Withdraw Fees');
  console.log('═'.repeat(50));
  
  // Check if we have admin keypair
  const keypairPath = process.env.ADMIN_KEYPAIR || path.join(process.env.HOME || '', '.config/solana/id.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.log('\n❌ Admin keypair not found!');
    console.log(`   Expected at: ${keypairPath}`);
    console.log('\n   To withdraw, you need to:');
    console.log('   1. Import your admin wallet keypair');
    console.log('   2. Set ADMIN_KEYPAIR environment variable');
    console.log('\n   Or use Phantom/CLI with your admin wallet.');
    return;
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  if (adminKeypair.publicKey.toString() !== ADMIN_PUBKEY.toString()) {
    console.log('\n❌ Keypair does not match admin wallet!');
    console.log(`   Keypair pubkey: ${adminKeypair.publicKey.toString()}`);
    console.log(`   Expected admin: ${ADMIN_PUBKEY.toString()}`);
    return;
  }
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const [feeVaultPda, bump] = getFeeVaultPDA();
  
  // Get current balance
  const accountInfo = await connection.getAccountInfo(feeVaultPda);
  if (!accountInfo) {
    console.log('\n⚠️  Fee vault does not exist yet. No fees to withdraw.');
    return;
  }
  
  const rentExempt = await connection.getMinimumBalanceForRentExemption(accountInfo.data.length);
  const availableBalance = accountInfo.lamports - rentExempt;
  
  if (availableBalance <= 0) {
    console.log('\n⚠️  No available balance to withdraw.');
    return;
  }
  
  const withdrawAmount = amount ? Math.floor(amount * LAMPORTS_PER_SOL) : 0; // 0 = withdraw all
  
  console.log(`Available: ${(availableBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Withdrawing: ${withdrawAmount === 0 ? 'ALL' : (withdrawAmount / LAMPORTS_PER_SOL).toFixed(4) + ' SOL'}`);
  
  // Build withdraw instruction
  // Instruction discriminator for withdraw_fees (Anchor generates this from sha256("global:withdraw_fees")[0..8])
  const discriminator = Buffer.from([198, 212, 171, 109, 144, 215, 174, 89]); // withdraw_fees discriminator
  
  // Amount as u64 little-endian
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(withdrawAmount));
  
  const data = Buffer.concat([discriminator, amountBuffer]);
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: feeVaultPda, isSigner: false, isWritable: true },
      { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
  
  const transaction = new Transaction().add(instruction);
  
  try {
    const signature = await connection.sendTransaction(transaction, [adminKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`\n✅ Withdrawal successful!`);
    console.log(`   Signature: ${signature}`);
    console.log(`   View on Solscan: https://solscan.io/tx/${signature}?cluster=devnet`);
  } catch (error) {
    console.error('\n❌ Withdrawal failed:', error);
  }
}

// Main
const command = process.argv[2];
const amount = process.argv[3] ? parseFloat(process.argv[3]) : undefined;

switch (command) {
  case 'view':
    viewFees();
    break;
  case 'withdraw':
    withdrawFees(amount);
    break;
  default:
    console.log(`
SolMate Fee Manager
═══════════════════

Usage:
  npx ts-node scripts/fee-manager.ts view           View accumulated fees
  npx ts-node scripts/fee-manager.ts withdraw       Withdraw ALL fees
  npx ts-node scripts/fee-manager.ts withdraw 0.5   Withdraw specific amount (SOL)

Environment:
  ADMIN_KEYPAIR - Path to admin wallet keypair JSON file
`);
}
